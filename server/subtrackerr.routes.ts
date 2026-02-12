// --- Compliance Notifications API ---
// Get all compliance notifications for the current tenant

// Place this route after router is declared

// ...existing code...

// ...existing code...
// Removed duplicate router declaration

// Compliance Notifications route

// ...rest of your routes and logic...
declare global {
  namespace Express {
    interface User {
      userId?: string;
      id?: string;
      email?: string;
      tenantId?: string;
      role?: string;
      department?: string;
      // add other properties if needed
    }
  }
}

// MongoDB History Record Interface
export interface HistoryRecord {
  _id?: any; // MongoDB ObjectId
  subscriptionId: any; // ObjectId or string
  tenantId: string;
  action: "create" | "update" | "delete" | string;
  timestamp: Date;
  data?: any; // Full subscription document for create
  updatedFields?: any; // Updated subscription document for update
  serviceName?: string;
}
// --- History API ---
// List all history records

// --- Payment Methods API ---
import { ObjectId as PaymentObjectId } from "mongodb";

// List all payment methods
// --- Employees API ---
import { ObjectId as EmployeeObjectId } from "mongodb";

// --- Ledger API ---
import { ObjectId as LedgerObjectId } from "mongodb";

// --- Subscription API ---
import { ObjectId } from "mongodb";

import { Router } from "express";
// @ts-ignore
import { connectToDatabase } from "./mongo.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { User } from "./types";
import { sendSubscriptionNotifications, detectSubscriptionChanges } from "./subscription-notification.service.js";
import { sendComplianceNotifications, detectComplianceChanges } from "./compliance-notification.service.js";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

const router = Router();

// Helper to normalize incoming date strings (supports dd-mm-yyyy and yyyy-mm-dd)
function normalizeDateString(value: any): any {
  if (!value || typeof value !== 'string') return value;
  // Already ISO (yyyy-mm-dd)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // dd-mm-yyyy -> yyyy-mm-dd
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  // dd/mm/yyyy -> yyyy-mm-dd
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return value;
}

function toEpochMsServer(raw: any): number {
  if (!raw) return 0;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function notificationDedupeKey(n: any): string {
  if (!n) return '';
  const type = String(n.type || '').trim().toLowerCase();
  const eventType = String(n.eventType || (n.reminderTriggerDate || n.reminderDate ? 'reminder' : '')).trim().toLowerCase();
  const lifecycle = String(n.lifecycleEventType || '').trim().toLowerCase();
  const entityId = String(n.subscriptionId || n.complianceId || n.licenseId || n.paymentId || '').trim().toLowerCase();
  const trigger = String(n.reminderTriggerDate || n.reminderDate || '').trim().toLowerCase();
  const deadline = String(n.submissionDeadline || n.subscriptionEndDate || n.endDate || '').trim().toLowerCase();
  const reminderType = String(n.reminderType || '').trim().toLowerCase();
  const title = String(n.filingName || n.subscriptionName || n.licenseName || n.name || '').trim().toLowerCase();
  const message = String(n.message || '').trim().toLowerCase();
  return [type, eventType, lifecycle, entityId, trigger, deadline, reminderType, title, message].join('|');
}

function dedupeNotifications(list: any[]): any[] {
  if (!Array.isArray(list) || list.length === 0) return Array.isArray(list) ? list : [];

  const score = (n: any): number => {
    if (!n) return 0;
    let s = 0;
    if (n.recipientRole) s += 2;
    if (Array.isArray(n.recipientDepartments) && n.recipientDepartments.length) s += 1;
    if (n.message) s += 1;
    if (n.reminderTriggerDate || n.reminderDate) s += 1;
    if (n.filingName || n.subscriptionName || n.licenseName) s += 1;
    if (n.lifecycleEventType) s += 1;
    return s;
  };

  const pickBetter = (a: any, b: any) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa > sb ? a : b;
    const ta = toEpochMsServer(a?.timestamp || a?.createdAt);
    const tb = toEpochMsServer(b?.timestamp || b?.createdAt);
    return tb > ta ? b : a;
  };

  const map = new Map<string, any>();
  for (const n of list) {
    const key = notificationDedupeKey(n) || (n?.id ? `id:${String(n.id)}` : '');
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) map.set(key, n);
    else map.set(key, pickBetter(existing, n));
  }
  return Array.from(map.values());
}

// Helper function to generate reminders for a subscription
async function generateRemindersForCompliance(compliance: any, tenantId: string, db: any) {
  const complianceId = compliance._id ? compliance._id.toString() : (typeof compliance.id === 'string' ? compliance.id : undefined);
  if (!complianceId) return;

  // Remove all old reminders for this compliance (legacy collection + new storage in compliance_notifications)
  try {
    await db.collection("reminders").deleteMany({ complianceId });
  } catch {}
  try {
    // Delete only reminder-type notifications (those without eventType or eventType === null)
    await db.collection("compliance_notifications").deleteMany({ complianceId, $or: [ { eventType: { $exists: false } }, { eventType: null } ] });
  } catch (err) {
    // Failed to prune existing notifications - continue
  }

  // Use submissionDeadline as the primary target date for reminders.
  // If submissionDeadline is missing, fall back to endDate.
  const normalizedSubmissionDeadline = normalizeDateString(compliance.submissionDeadline);
  const targetDateStr = normalizedSubmissionDeadline || normalizeDateString(compliance.endDate);
  if (!targetDateStr) return;

  // Use reminderDays from compliance, default to 7 if not set
  const reminderDays = Number(compliance.reminderDays) || 7;
  const reminderPolicy = compliance.reminderPolicy || "One time";

  let remindersToInsert = [];

  if (reminderPolicy === "One time") {
    const reminderDate = new Date(targetDateStr);
    if (isNaN(reminderDate.getTime())) {
      return;
    }
    reminderDate.setDate(reminderDate.getDate() - reminderDays);
    remindersToInsert.push({
      type: `Before ${reminderDays} days`,
      date: reminderDate.toISOString().slice(0, 10),
    });
  } else if (reminderPolicy === "Two times") {
    const firstDate = new Date(targetDateStr);
    if (isNaN(firstDate.getTime())) {
      return;
    }
    firstDate.setDate(firstDate.getDate() - reminderDays);
    const secondDays = Math.floor(reminderDays / 2);
    const secondDate = new Date(targetDateStr);
    secondDate.setDate(secondDate.getDate() - secondDays);
    remindersToInsert.push({
      type: `Before ${reminderDays} days`,
      date: firstDate.toISOString().slice(0, 10),
    });
    if (secondDays > 0 && secondDays !== reminderDays) {
      remindersToInsert.push({
        type: `Before ${secondDays} days`,
        date: secondDate.toISOString().slice(0, 10),
      });
    }
  } else if (reminderPolicy === "Until Renewal") {
    // Daily reminders from (deadlineDate - reminderDays) to deadlineDate
    const startDate = new Date(targetDateStr);
    if (isNaN(startDate.getTime())) {
      return;
    }
    startDate.setDate(startDate.getDate() - reminderDays);
    let current = new Date(startDate);
    const end = new Date(targetDateStr);
    while (current <= end) {
      remindersToInsert.push({
        type: `Daily`,
        date: current.toISOString().slice(0, 10),
      });
      current.setDate(current.getDate() + 1);
    }
  }

  // Insert all reminders as notifications in compliance_notifications
  for (const reminder of remindersToInsert) {
    const notificationDoc = {
      complianceId,
      eventType: undefined, // No eventType for reminders
      reminderType: reminder.type,
      reminderDate: reminder.date,
      reminderTriggerDate: reminder.date, // ensure frontend filter works
      reminderDays,
      reminderPolicy,
      sent: false,
      status: compliance.status || "Active",
      createdAt: new Date(),
      tenantId,
      type: 'compliance',
      filingName: compliance.policy || compliance.filingName || compliance.complianceName || compliance.name || 'Compliance Filing',
      complianceCategory: compliance.category || compliance.complianceCategory || undefined,
      submissionDeadline: normalizedSubmissionDeadline || undefined
    };
    await db.collection("compliance_notifications").insertOne(notificationDoc);
  }
}

async function generateRemindersForSubscription(subscription: any, tenantId: string, db: any) {
  const subscriptionId = subscription._id ? subscription._id.toString() : (typeof subscription.id === 'string' ? subscription.id : undefined);
  if (!subscriptionId) return;

  // Remove all old reminders for this subscription
  await db.collection("reminders").deleteMany({ subscriptionId });

  // Use nextRenewal as the target date for reminders
  const renewalDateRaw = subscription.nextRenewal;
  if (!renewalDateRaw) {
    return;
  }

  // Normalize date strings (supports dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd)
  const normalizedRenewalDate = normalizeDateString(renewalDateRaw);
  if (!normalizedRenewalDate || typeof normalizedRenewalDate !== 'string') {
    return;
  }

  // Parse as date-only in UTC to avoid locale parsing ambiguity (e.g., 07-02-2026)
  const parseDateOnlyUtc = (value: string): Date | null => {
    if (!value) return null;
    const v = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(`${v}T00:00:00.000Z`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const renewalDate = parseDateOnlyUtc(normalizedRenewalDate);
  if (!renewalDate) return;

  // Use reminderDays from subscription, default to 7 if not set
  const reminderDays = Number(subscription.reminderDays) || 7;
  const reminderPolicy = subscription.reminderPolicy || "One time";

  let remindersToInsert = [];

  if (reminderPolicy === "One time") {
    const reminderDate = new Date(renewalDate);
    reminderDate.setUTCDate(reminderDate.getUTCDate() - reminderDays);
    remindersToInsert.push({
      type: `Before ${reminderDays} days`,
      date: reminderDate.toISOString().slice(0, 10),
    });
  } else if (reminderPolicy === "Two times") {
    const firstDate = new Date(renewalDate);
    firstDate.setUTCDate(firstDate.getUTCDate() - reminderDays);
    const secondDays = Math.floor(reminderDays / 2);
    const secondDate = new Date(renewalDate);
    secondDate.setUTCDate(secondDate.getUTCDate() - secondDays);
    remindersToInsert.push({
      type: `Before ${reminderDays} days`,
      date: firstDate.toISOString().slice(0, 10),
    });
    if (secondDays > 0 && secondDays !== reminderDays) {
      remindersToInsert.push({
        type: `Before ${secondDays} days`,
        date: secondDate.toISOString().slice(0, 10),
      });
    }
  } else if (reminderPolicy === "Until Renewal") {
    // Daily reminders from (renewalDate - reminderDays) to renewalDate
    const startDate = new Date(renewalDate);
    startDate.setUTCDate(startDate.getUTCDate() - reminderDays);
    let current = new Date(startDate);
    const end = new Date(renewalDate);
    while (current <= end) {
      remindersToInsert.push({
        type: `Daily`,
        date: current.toISOString().slice(0, 10),
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  // Insert all reminders
  for (const reminder of remindersToInsert) {
    const reminderDoc = {
      subscriptionId,
      reminderType: reminder.type,
      reminderDate: reminder.date,
      sent: false,
      status: subscription.status || "Active",
      createdAt: new Date(),
      tenantId,
  // Subscription-specific metadata only
  subscriptionName: subscription.serviceName || subscription.name || undefined,
  category: subscription.category || undefined
    };
    await db.collection("reminders").insertOne(reminderDoc);
  }
}

// JWT middleware to set req.user and req.user.tenantId
router.use((req, res, next) => {
  let token;
  // Support both Authorization header and cookie
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.replace("Bearer ", "");
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (typeof decoded === "object" && "tenantId" in decoded) {
        req.user = decoded as User;
      } else {
        req.user = undefined;
      }
    } catch (err) {
      req.user = undefined;
    }
  }
  next();
});

// Add a new history record
router.post("/api/history", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const historyCollection = db.collection("history");
    const { subscriptionId, action, data, updatedFields } = req.body;
    if (!subscriptionId) {
      return res.status(400).json({ message: "subscriptionId is required" });
    }
    // Always store subscriptionId as ObjectId for consistency (like complianceId in ledger)
    let subscriptionObjId;
    try {
      subscriptionObjId = new ObjectId(subscriptionId);
    } catch (err) {
      // If not a valid ObjectId, do not create history record
      return res.status(400).json({ message: "Invalid subscriptionId format" });
    }
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    // Create history document with tenantId
    const timestamp = new Date();
    const historyDoc = {
      subscriptionId: subscriptionObjId,
      tenantId,
      action,
      timestamp,
      data: data ? { ...data } : undefined,
      updatedFields: updatedFields ? { ...updatedFields } : undefined
    };

    const result = await historyCollection.insertOne(historyDoc);
    res.status(201).json({ 
      message: "History record created",
      _id: result.insertedId 
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create history record", error });
  }
});

// Get all history records
router.get("/api/history/list", async (req, res) => {
  try {
    const startTime = Date.now();
    
    res.setHeader('Cache-Control', 'private, max-age=60'); // 1 minute cache
    
    const db = await connectToDatabase();
    const collection = db.collection("history");
    
    // Multi-tenancy: filter by tenantId
  const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 2000) : 200;

    // Sort by timestamp and _id for consistent ordering
    const items = await collection
      .find({ tenantId })
      .project({ tenantId: 1, subscriptionId: 1, action: 1, timestamp: 1, data: 1, updatedFields: 1 })
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit)
      .toArray();

    // Import decryption function
    const { decrypt } = await import("./encryption.service.js");

    // OPTIMIZED: Only decrypt fields shown in UI (serviceName, vendor, amount, owner, status)
    const processed = items.map(item => {
      let processedData = item.data;
      let processedUpdatedFields = item.updatedFields;
      
      // Decrypt serviceName, vendor, and amount - shown in history list
      if (item.data) {
        processedData = {
          ...item.data,
          _id: item.data._id?.toString(),
          serviceName: item.data.serviceName ? decrypt(item.data.serviceName) : item.data.serviceName,
          vendor: item.data.vendor ? decrypt(item.data.vendor) : item.data.vendor,
          amount: item.data.amount ? decrypt(item.data.amount) : item.data.amount,
          owner: item.data.owner,
          ownerName: item.data.ownerName,
          status: item.data.status,
          // Skip decrypting: description, paymentMethod, notes
        };
      }
      
      if (item.updatedFields) {
        processedUpdatedFields = {
          ...item.updatedFields,
          _id: item.updatedFields._id?.toString(),
          serviceName: item.updatedFields.serviceName ? decrypt(item.updatedFields.serviceName) : item.updatedFields.serviceName,
          vendor: item.updatedFields.vendor ? decrypt(item.updatedFields.vendor) : item.updatedFields.vendor,
          amount: item.updatedFields.amount ? decrypt(item.updatedFields.amount) : item.updatedFields.amount,
          owner: item.updatedFields.owner,
          ownerName: item.updatedFields.ownerName,
          status: item.updatedFields.status,
        };
      }
      
      return {
        ...item,
        _id: item._id?.toString(),
        subscriptionId: item.subscriptionId?.toString(),
        data: processedData,
        updatedFields: processedUpdatedFields
      };
    });

    console.log(`[PERF] /api/history/list: ${items.length} records in ${Date.now() - startTime}ms`);
    res.status(200).json(processed);
  } catch (error: unknown) {
    console.error("History list error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to fetch history records", error: errorMessage });
  }
});

// Get history for a specific subscription
router.get("/api/history/:subscriptionId", async (req, res) => {
  try {
    const startTime = Date.now();
    
    res.setHeader('Cache-Control', 'private, max-age=60');
    
    const db = await connectToDatabase();
    const collection = db.collection("history");
    const { subscriptionId } = req.params;

    // Try to convert to ObjectId, but don't fail if it's not a valid ObjectId
    let subObjId;
    try {
      subObjId = new ObjectId(subscriptionId);
    } catch (err) {
      // Continue with string comparison
    }

    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    // Only match by subscriptionId and tenantId
    const filter = subObjId ?
      { subscriptionId: subObjId, tenantId } :
      { subscriptionId: subscriptionId, tenantId };

    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 2000) : 200;

    // Sort by timestamp descending (newest first)
    const items = await collection
      .find(filter)
      .project({ tenantId: 1, subscriptionId: 1, action: 1, timestamp: 1, data: 1, updatedFields: 1 })
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit)
      .toArray();
    
    // Import decryption function
    const { decrypt } = await import("./encryption.service.js");

    // OPTIMIZED: Only decrypt serviceName, vendor, and amount - shown in history list
    const processedItems = items.map(item => {
      let processedData = item.data;
      let processedUpdatedFields = item.updatedFields;
      
      if (item.data) {
        processedData = {
          ...item.data,
          _id: item.data._id?.toString ? item.data._id.toString() : item.data._id,
          serviceName: item.data.serviceName ? decrypt(item.data.serviceName) : item.data.serviceName,
          vendor: item.data.vendor ? decrypt(item.data.vendor) : item.data.vendor,
          amount: item.data.amount ? decrypt(item.data.amount) : item.data.amount,
          owner: item.data.owner,
          ownerName: item.data.ownerName,
          status: item.data.status,
        };
      }
      
      if (item.updatedFields) {
        processedUpdatedFields = {
          ...item.updatedFields,
          _id: item.updatedFields._id?.toString ? item.updatedFields._id.toString() : item.updatedFields._id,
          serviceName: item.updatedFields.serviceName ? decrypt(item.updatedFields.serviceName) : item.updatedFields.serviceName,
          vendor: item.updatedFields.vendor ? decrypt(item.updatedFields.vendor) : item.updatedFields.vendor,
          amount: item.updatedFields.amount ? decrypt(item.updatedFields.amount) : item.updatedFields.amount,
          owner: item.updatedFields.owner,
          ownerName: item.updatedFields.ownerName,
          status: item.updatedFields.status,
        };
      }
      
      return {
        ...item,
        _id: item._id.toString(),
        subscriptionId: item.subscriptionId?.toString ? item.subscriptionId.toString() : item.subscriptionId,
        data: processedData,
        updatedFields: processedUpdatedFields
      };
    });

    console.log(`[PERF] /api/history/${subscriptionId}: ${items.length} records in ${Date.now() - startTime}ms`);
    res.status(200).json(processedItems);
  } catch (error: unknown) {
    console.error("History fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to fetch history records", error: errorMessage });
  }
});

router.get("/api/payment", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("payment");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const items = await collection.find({ tenantId }).toArray();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payment methods", error });
  }
});

// Add a new payment method
router.post("/api/payment", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("payment");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const payment = {
      ...req.body,
      tenantId
    };
    // Optionally validate required fields here
    const result = await collection.insertOne(payment);
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add payment method", error });
  }
});

// Update a payment method
router.put("/api/payment/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("payment");
    const { id } = req.params;
    let filter;
    try {
      filter = { _id: new PaymentObjectId(id) };
    } catch {
      return res.status(400).json({ message: "Invalid payment id" });
    }
    const update = { $set: req.body };
    const result = await collection.updateOne(filter, update);
    if (result.matchedCount === 1) {
      res.status(200).json({ message: "Payment method updated" });
    } else {
      res.status(404).json({ message: "Payment method not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update payment method", error });
  }
});

// Delete a payment method
router.delete("/api/payment/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("payment");
    const { id } = req.params;
    let filter;
    try {
      filter = { _id: new PaymentObjectId(id) };
    } catch {
      return res.status(400).json({ message: "Invalid payment id" });
    }

    // Block deletion if this payment method is linked to any subscription.
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const existing = await collection.findOne(filter);
    const paymentName = String((existing as any)?.name || (existing as any)?.title || '').trim();
    if (!existing) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    if (paymentName) {
      const subsCollection = db.collection("subscriptions");
      const linkedCount = await subsCollection.countDocuments({
        tenantId,
        paymentMethod: paymentName,
      });

      if (linkedCount > 0) {
        return res.status(409).json({
          message: `Payment method is linked to ${linkedCount} subscription(s). Please reassign the payment method before deleting.`,
          linkedCount,
        });
      }
    }

    const result = await collection.deleteOne(filter);
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Payment method deleted" });
    } else {
      res.status(404).json({ message: "Payment method not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete payment method", error });
  }
});

// List all ledger records
router.get("/api/ledger/list", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("ledger");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const items = await collection.find({ tenantId }).toArray();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch ledger data", error });
  }
});

// Insert a new ledger record
router.post("/api/ledger/insert", async (req, res) => {
  try {
    const db = await connectToDatabase();
// Add this line
    const collection = db.collection("ledger");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const filingSubmissionDateRaw =
      req.body?.filingSubmissionDate ??
      req.body?.submissionDate ??
      req.body?.SubmissionDate;
    const submittedByRaw = req.body?.submittedBy ?? req.body?.SubmittedBy;

    if (!filingSubmissionDateRaw || !String(filingSubmissionDateRaw).trim()) {
      return res.status(400).json({ message: "Submission Date is required" });
    }

    if (!submittedByRaw || !String(submittedByRaw).trim()) {
      return res.status(400).json({ message: "Submitted By is required" });
    }

    const ledgerDoc = {
      ...req.body,
      tenantId,
      filingSubmissionDate: normalizeDateString(filingSubmissionDateRaw),
      submittedBy: String(submittedByRaw),
      createdAt: new Date(),
    };

    const result = await collection.insertOne(ledgerDoc);

    // Create an in-app compliance "Submitted" notification when ledger entry is created
    const complianceIdRaw = req.body?.complianceId ?? req.body?.complianceID ?? req.body?.compliance_id;
    if (complianceIdRaw) {
      try {
        // Prefer fetching the compliance doc to get correct owners/departments.
        let complianceDoc: any = null;
        try {
          const complianceObjId = new ObjectId(String(complianceIdRaw));
          complianceDoc = await db.collection('compliance').findOne({ _id: complianceObjId, tenantId });
        } catch {
          // ignore
        }

        const complianceForNotification: any = {
          ...(complianceDoc || {}),
          id: String(complianceIdRaw),
          tenantId,
          // Keep fallback fields from request in case lookup failed
          filingName: (complianceDoc as any)?.filingName || req.body?.filingName || req.body?.policy || req.body?.complianceName || req.body?.name,
          policy: (complianceDoc as any)?.policy || req.body?.policy || req.body?.filingName,
          owner: (complianceDoc as any)?.owner || req.body?.owner,
          ownerEmail: (complianceDoc as any)?.ownerEmail || req.body?.ownerEmail,
          owner2: (complianceDoc as any)?.owner2 || req.body?.owner2,
          owner2Email: (complianceDoc as any)?.owner2Email || req.body?.owner2Email,
          departments: (complianceDoc as any)?.departments || (Array.isArray(req.body?.departments) ? req.body.departments : undefined),
          department: (complianceDoc as any)?.department || req.body?.department,
          complianceCategory: (complianceDoc as any)?.complianceCategory || req.body?.filingComplianceCategory || req.body?.complianceCategory || req.body?.category,
          category: (complianceDoc as any)?.category || req.body?.filingComplianceCategory || req.body?.complianceCategory || req.body?.category,
          submissionDeadline: (complianceDoc as any)?.submissionDeadline || req.body?.filingSubmissionDeadline || req.body?.submissionDeadline,
          status: 'Submitted',
          filingSubmissionDate: normalizeDateString(filingSubmissionDateRaw),
          submittedBy: String(submittedByRaw),
        };

        await sendComplianceNotifications('submitted', complianceForNotification, null, tenantId, db);
      } catch (notifyErr) {
        console.error('Failed to create submitted in-app notification after ledger insert:', notifyErr);
      }
    }
// Add this line
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    console.error("Ledger insert error:", error); // Add this line
    res.status(500).json({ message: "Failed to save ledger data", error });
  }
});
// Delete a ledger record
router.delete("/api/ledger/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("ledger");
    const result = await collection.deleteOne({ _id: new LedgerObjectId(req.params.id) });
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Ledger record deleted" });
    } else {
      res.status(404).json({ message: "Ledger record not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete ledger record", error });
  }
});

// List all compliance filings from the database
router.get("/api/compliance/list", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("compliance");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    const userId = req.user?.userId;
    const userDepartment = req.user?.department;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
    let items = await collection.find({ tenantId }).toArray();
    
    // Apply role-based filtering
    if (userRole === 'contributor') {
      // Contributors can only see their own items
      items = items.filter(item => item.owner === userId);
    } else if (userRole === 'department_editor' || userRole === 'department_viewer') {
      // Department roles can only see items in their department
      if (userDepartment) {
        items = items.filter(item => {
          if (!item.department) return false;
          try {
            const depts = JSON.parse(item.department);
            return Array.isArray(depts) && depts.includes(userDepartment);
          } catch {
            return item.department === userDepartment;
          }
        });
      }
    }
    
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch compliance data", error });
  }
});
// Delete a compliance filing from the database
router.delete("/api/compliance/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("compliance");
    const { id } = req.params;
    
    // Get compliance data before deleting for notification event
    const complianceToDelete = await collection.findOne({ _id: new ObjectId(id) });
    
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      // Create notification event for compliance deletion
      if (complianceToDelete) {
        try {
          const filingName = complianceToDelete.policy || complianceToDelete.filingName || complianceToDelete.complianceName || complianceToDelete.name || 'Compliance Filing';
const notificationEvent = {
            _id: new ObjectId(),
            tenantId: req.user?.tenantId,
            type: 'compliance',
            eventType: 'deleted',
            complianceId: id,
            complianceName: filingName,
            filingName: filingName,
            category: complianceToDelete.complianceCategory || complianceToDelete.category || 'General',
            message: `Compliance filing ${filingName} deleted`,
            read: false,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reminderTriggerDate: new Date().toISOString().slice(0, 10)
          };
const notificationResult = await db.collection("compliance_notifications").insertOne(notificationEvent);
} catch (notificationError) {
          console.error(`❌ [COMPLIANCE] Failed to create deletion notification event for compliance filing:`, notificationError);
          // Don't throw - let deletion succeed even if notification fails
        }
      }
      
      res.status(200).json({ message: "Compliance filing deleted" });
    } else {
      res.status(404).json({ message: "Compliance filing not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete compliance filing", error });
  }
});

// Save a compliance filing to the database
router.post("/api/compliance/insert", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("compliance");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    // Normalize date fields before inserting so reminder generation works immediately
    const normalizedSubmissionDeadline = normalizeDateString(req.body.submissionDeadline || req.body.filingSubmissionDeadline);
    const normalizedStart = normalizeDateString(req.body.lastAudit || req.body.startDate || req.body.filingStartDate);
    const normalizedEnd = normalizeDateString(req.body.endDate || req.body.filingEndDate);

    const complianceData = { 
      ...req.body, 
      submissionDeadline: normalizedSubmissionDeadline,
      lastAudit: normalizedStart,
      endDate: normalizedEnd,
      tenantId, 
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    const result = await collection.insertOne(complianceData);
    
    // Get the created compliance document with its _id
    const createdCompliance = { ...complianceData, _id: result.insertedId };
    
    // Generate reminders for compliance
    try {
await generateRemindersForCompliance(createdCompliance, tenantId, db);
} catch (reminderError) {
      console.error(`❌ [COMPLIANCE] Failed to generate reminders:`, reminderError);
      // Don't throw - let compliance creation succeed even if reminder generation fails
    }

    // If any reminders are already due (e.g., editing deadlines to today/past), send them immediately.
    // This also creates user-scoped in-app reminder notifications.
    try {
      const { runComplianceReminderCheck } = await import("./compliance-reminder.service.js");
      await runComplianceReminderCheck(tenantId);
    } catch (e) {
      console.error(`❌ [COMPLIANCE] Immediate reminder check failed:`, e);
    }
    
    // Send lifecycle notifications for compliance creation
    try {
      await sendComplianceNotifications(
        'create',
        { ...createdCompliance, id: result.insertedId.toString() },
        null,
        tenantId,
        db
      );
    } catch (notificationError) {
      console.error(`❌ [COMPLIANCE] Failed to send lifecycle notifications:`, notificationError);
      // Don't throw - let compliance creation succeed even if notification fails
    }
    
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to save compliance data", error });
  }
});

// Edit (update) a compliance filing in the database
router.put("/api/compliance/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("compliance");
    const { id } = req.params;
    
    // Get the document before update for notification
    const oldDoc = await collection.findOne({ _id: new ObjectId(id) });
    
    const updateData: any = { ...req.body, updatedAt: new Date() };
    if ('submissionDeadline' in updateData || 'filingSubmissionDeadline' in updateData) {
      updateData.submissionDeadline = normalizeDateString(updateData.submissionDeadline || updateData.filingSubmissionDeadline);
      delete updateData.filingSubmissionDeadline;
    }
    if ('lastAudit' in updateData || 'startDate' in updateData || 'filingStartDate' in updateData) {
      updateData.lastAudit = normalizeDateString(updateData.lastAudit || updateData.startDate || updateData.filingStartDate);
      delete updateData.startDate;
      delete updateData.filingStartDate;
    }
    if ('endDate' in updateData || 'filingEndDate' in updateData) {
      updateData.endDate = normalizeDateString(updateData.endDate || updateData.filingEndDate);
      delete updateData.filingEndDate;
    }
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 1) {
      // Get the updated document for reminder generation
      const updatedDoc = await collection.findOne({ _id: new ObjectId(id) });
      
      // Regenerate reminders for compliance
      try {
        const tenantId = req.user?.tenantId;
        if (tenantId) {
          const complianceName = updatedDoc?.filingName || updatedDoc?.complianceName || updatedDoc?.name || 'Unnamed Filing';
await generateRemindersForCompliance(updatedDoc, tenantId, db);

          // Run reminder check immediately so due reminders send without requiring a server restart.
          try {
            const { runComplianceReminderCheck } = await import("./compliance-reminder.service.js");
            await runComplianceReminderCheck(tenantId);
          } catch (e) {
            console.error(`❌ [COMPLIANCE] Immediate reminder check failed:`, e);
          }
}
      } catch (reminderError) {
        console.error(`❌ [COMPLIANCE] Failed to regenerate reminders:`, reminderError);
        // Don't throw - let compliance update succeed even if reminder generation fails
      }
      
      // Send lifecycle notifications for compliance updates
      try {
        const tenantId = req.user?.tenantId;
        if (tenantId && updatedDoc) {
          // Detect what changed
          const changes = detectComplianceChanges(oldDoc, updatedDoc);
          
          console.log(`[COMPLIANCE UPDATE] Change detection for ${updatedDoc.filingName || updatedDoc.name}:`, {
            ownerChanged: changes.ownerChanged,
            submitted: changes.submitted,
            oldOwner: changes.oldOwner,
            newOwner: updatedDoc.owner,
            oldStatus: changes.oldStatus,
            newStatus: updatedDoc.status
          });
          
          // Send appropriate notifications based on what changed
          if (changes.ownerChanged) {
            console.log(`[COMPLIANCE UPDATE] Owner changed detected - sending ownerChange notifications...`);
            await sendComplianceNotifications(
              'ownerChange',
              { ...updatedDoc, id: id },
              oldDoc,
              tenantId,
              db
            );
          } else if (changes.submitted) {
            console.log(`[COMPLIANCE UPDATE] Submitted status detected - sending submitted notifications...`);
            await sendComplianceNotifications(
              'submitted',
              { ...updatedDoc, id: id },
              oldDoc,
              tenantId,
              db
            );
          } else {
            console.log(`[COMPLIANCE UPDATE] No significant changes detected for notifications`);
          }
          // Note: 'otherFields' doesn't send notifications per matrix
        }
      } catch (notificationError) {
        console.error(`❌ [COMPLIANCE] Failed to send lifecycle notifications:`, notificationError);
      }
      
      res.status(200).json({ message: "Compliance filing updated" });
    } else {
      res.status(404).json({ message: "Compliance filing not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update compliance filing", error });
  }
});

// Example: Save a subscription to the Subtrackerr database

// Get all subscriptions
router.get("/api/subscriptions", async (req, res) => {
  try {
    const startTime = Date.now();
    
    res.setHeader('Cache-Control', 'private, max-age=30'); // 30 second cache
    
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    const userId = req.user?.userId || req.user?.id;
    const userDepartment = req.user?.department;
if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // Import decryption function
    const { decrypt } = await import("./encryption.service.js");
    
    // Build Mongo filter (avoid in-memory filtering + per-item JSON.parse)
    let filter: any = { tenantId };

    // Apply role-based filtering
    if (userRole === 'contributor') {
      // Contributors can only see items where they are the owner (match by email)
      const userEmail = req.user?.email;
      filter = {
        tenantId,
        $or: [
          ...(userEmail ? [{ ownerEmail: userEmail }] : []),
          ...(userId ? [{ owner: userId }] : [])
        ]
      };
    } else if (userRole === 'department_editor' || userRole === 'department_viewer') {
      // Department roles can only see items in their department OR Company Level items
      if (userDepartment) {
        const deptRegex = new RegExp(`\\"${escapeRegex(userDepartment)}\\"`, 'i');
        const companyLevelRegex = /Company Level/i;

        filter = {
          tenantId,
          $or: [
            // departments stored as array
            { departments: { $in: ['Company Level', userDepartment] } },

            // department stored as plain string
            { department: userDepartment },
            { department: 'Company Level' },

            // department stored as JSON string
            { department: { $regex: deptRegex } },
            { department: { $regex: companyLevelRegex } }
          ]
        };
      }
    }

    // CRITICAL: Fetch all subscriptions but limit to essential fields
    const subscriptions = await collection.find(filter).toArray();
    
    // OPTIMIZED: Only decrypt fields that are displayed in the UI
    const transformedSubscriptions = subscriptions.map(sub => {
      // Decrypt serviceName, amount, vendor, paymentMethod for display
      const serviceName = sub.serviceName ? decrypt(sub.serviceName) : sub.serviceName;
      const amount = sub.amount ? decrypt(sub.amount) : sub.amount;
      const vendor = sub.vendor ? decrypt(sub.vendor) : sub.vendor;
      const paymentMethod = sub.paymentMethod ? decrypt(sub.paymentMethod) : sub.paymentMethod;
      
      return {
        ...sub,
        serviceName,
        amount,
        vendor,
        paymentMethod,
        // Don't decrypt description, notes unless needed
        id: sub._id?.toString(),
        _id: sub._id?.toString()
      };
    });
    
    console.log(`[PERF] /api/subscriptions: ${subscriptions.length} records in ${Date.now() - startTime}ms`);
    res.status(200).json(transformedSubscriptions);
  } catch (error) {
    console.error('[ERROR] /api/subscriptions:', error);
    res.status(500).json({ message: "Failed to fetch subscriptions", error });
  }
});

// Delete a subscription and its reminders (main route that frontend uses)
router.delete("/api/subscriptions/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { ObjectId } = await import("mongodb");
    const collection = db.collection("subscriptions");
    
    // Check if ID is valid
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: "Invalid subscription ID provided" });
    }
    
    // Multi-tenancy: only allow delete for current tenant
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
    let filter;
    try {
      filter = { _id: new ObjectId(id), tenantId };
    } catch {
      filter = { id: id, tenantId };
    }
    
    // Get subscription data BEFORE deletion for notifications
    const subscriptionToDelete = await collection.findOne(filter);
    
    // Delete subscription first (main operation)
    const result = await collection.deleteOne(filter);
    
    if (result.deletedCount === 1) {
      // Send success response immediately
      res.status(200).json({ message: "Subscription deleted successfully" });
      
      // Perform cleanup operations asynchronously (don't wait for them)
      setImmediate(async () => {
        try {
          // Cascade delete reminders
          await db.collection("reminders").deleteMany({ 
            $or: [ { subscriptionId: id }, { subscriptionId: new ObjectId(id) } ] 
          });
          
          // Send subscription lifecycle notifications for deletion (in-app + email)
          if (subscriptionToDelete) {
            try {
              await sendSubscriptionNotifications('delete', subscriptionToDelete, null, tenantId, db);
            } catch (notificationError) {
              console.error(`❌ [SUBTRACKERR] Failed to send deletion notifications:`, notificationError);
            }
          }
        } catch (cleanupError) {
          console.error(`❌ [SUBTRACKERR] Cleanup error after deletion:`, cleanupError);
        }
      });
    } else {
      res.status(404).json({ message: "Subscription not found or access denied" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete subscription", error });
  }
});

// Delete a subscription and its reminders (legacy route)
router.delete("/api/subtrackerr/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { ObjectId } = await import("mongodb");
    const collection = db.collection("subscriptions");
    let filter;
    try {
      filter = { _id: new ObjectId(req.params.id) };
    } catch {
      filter = { id: req.params.id };
    }
    const result = await collection.deleteOne(filter);
    if (result.deletedCount === 1) {
      // Cascade delete reminders for this subscription
      await db.collection("reminders").deleteMany({ $or: [ { subscriptionId: req.params.id }, { subscriptionId: new ObjectId(req.params.id) } ] });
      res.status(200).json({ message: "Subscription and related reminders deleted" });
    } else {
      res.status(404).json({ message: "Subscription not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete subscription", error });
  }
});

// --- Currency API ---
// List all currencies
router.get("/api/currencies", async (req, res) => {
  try {
    // Cache for 5 minutes - currencies rarely change
    res.setHeader('Cache-Control', 'public, max-age=300');
    
    const db = await connectToDatabase();
    const collection = db.collection("currencies");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const items = await collection.find({ tenantId }).toArray();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch currencies", error });
  }
});

// --- Exchange Rates API ---
// OPTIMIZED: Batch get latest exchange rates for all currencies
router.get("/api/exchange-rates/batch/latest", async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    
    const db = await connectToDatabase();
    const collection = db.collection("exchange_rates");
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    // Use aggregation to get the latest rate for each currency code
    const latestRates = await collection.aggregate([
      { $match: { tenantId } },
      { $sort: { code: 1, date: -1, createdAt: -1 } },
      { $group: {
        _id: "$code",
        latestRate: { $first: "$$ROOT" }
      }},
      { $replaceRoot: { newRoot: "$latestRate" } },
      { $project: {
        code: 1,
        rate: 1,
        relRate: 1,
        date: 1
      }}
    ]).toArray();

    // Convert to map for easy lookup
    const ratesMap: Record<string, any> = {};
    latestRates.forEach((r: any) => {
      ratesMap[r.code] = {
        rate: String(r.rate || r.relRate || '-'),
        date: typeof r.date === 'string' ? r.date : (r.date?.toISOString?.().slice(0, 10) || '')
      };
    });

    res.status(200).json(ratesMap);
  } catch (error) {
    console.error("Error fetching batch exchange rates:", error);
    res.status(500).json({ message: "Failed to fetch exchange rates", error });
  }
});

// Get exchange rates for a currency code (for current tenant)
router.get("/api/exchange-rates/:code", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("exchange_rates");
    const tenantId = req.user?.tenantId;
    const code = (req.params.code || "").toUpperCase();

    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    if (!code) {
      return res.status(400).json({ message: "Currency code is required" });
    }

    const items = await collection
      .find({ tenantId, code })
      .sort({ date: 1, createdAt: 1 })
      .toArray();

    // Normalize output
    const rates = items.map((r: any) => ({
      _id: r._id?.toString?.() || undefined,
      date: typeof r.date === 'string' ? r.date : (r.date?.toISOString?.().slice(0, 10) || ''),
      code: r.code,
      relCurrency: r.relCurrency,
      rate: String(r.rate ?? ''),
      relRate: String(r.relRate ?? '')
    }));

    res.status(200).json(rates);
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    res.status(500).json({ message: "Failed to fetch exchange rates", error });
  }
});

// Replace exchange rates for a currency code (idempotent upsert by full replace)
router.post("/api/exchange-rates/:code", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("exchange_rates");
    const tenantId = req.user?.tenantId;
    const code = (req.params.code || "").toUpperCase();

    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    if (!code) {
      return res.status(400).json({ message: "Currency code is required" });
    }

    const { rates } = req.body || {};
    if (!Array.isArray(rates)) {
      return res.status(400).json({ message: "'rates' array is required" });
    }

    // Validate and normalize incoming rows
    const normalizeDate = (val: any) => {
      if (!val) return undefined;
      if (typeof val === 'string') {
        // accept yyyy-mm-dd or dd-mm-yyyy
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
          const [dd, mm, yyyy] = val.split('-');
          return `${yyyy}-${mm}-${dd}`;
        }
      }
      // fallback: try Date parsing
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return undefined;
    };

    const docs = rates
      .map((r: any) => ({
        date: normalizeDate(r.date),
        code,
        relCurrency: (r.relCurrency || '').toString().trim().toUpperCase(),
        rate: r.rate === '' || r.rate == null ? undefined : Number(r.rate),
        relRate: r.relRate === '' || r.relRate == null ? undefined : Number(r.relRate)
      }))
      .filter((r: any) => r.date && r.relCurrency && (typeof r.rate === 'number' || typeof r.relRate === 'number'))
      .map((r: any) => ({
        ...r,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

    // Replace strategy: delete old then insert new
    await collection.deleteMany({ tenantId, code });
    if (docs.length > 0) {
      await collection.insertMany(docs);
    }

    res.status(200).json({ message: "Exchange rates saved", count: docs.length });
  } catch (error) {
    console.error("Error saving exchange rates:", error);
    res.status(500).json({ message: "Failed to save exchange rates", error });
  }
});

// Add a new currency
router.post("/api/currencies", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("currencies");
    const { code, name, symbol, isoNumber, exchangeRate } = req.body;
    
    // Validate required fields
    if (!code || !name || !symbol) {
      return res.status(400).json({ message: "Code, name, and symbol are required" });
    }
    
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
    // Check if currency code already exists for this tenant
    const existingCurrency = await collection.findOne({ code: code.toUpperCase(), tenantId });
    if (existingCurrency) {
      return res.status(409).json({ message: "Currency code already exists" });
    }
    
    const currency = {
      code: code.toUpperCase(),
      name: name.trim(),
      symbol: symbol.trim(),
      isoNumber: isoNumber || "",
      exchangeRate: exchangeRate !== undefined && exchangeRate !== null ? Number(exchangeRate) : 1,
      visible: true,
      created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      createdAt: new Date(),
      tenantId
    };
    
    const result = await collection.insertOne(currency);
    res.status(201).json({ insertedId: result.insertedId, currency });
  } catch (error) {
    res.status(500).json({ message: "Failed to add currency", error });
  }
});

// Update a currency
router.put("/api/currencies/:code", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("currencies");
    const { code } = req.params;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
    const update = { 
      $set: { 
        ...req.body,
        updatedAt: new Date()
      } 
    };
    
    const result = await collection.updateOne(
      { code: code.toUpperCase(), tenantId }, 
      update
    );
    
    if (result.matchedCount === 1) {
      res.status(200).json({ message: "Currency updated" });
    } else {
      res.status(404).json({ message: "Currency not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update currency", error });
  }
});

// Delete a currency
router.delete("/api/currencies/:code", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("currencies");
    const subsCollection = db.collection("subscriptions");
    const { code } = req.params;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const codeTrimmed = (code || '').toUpperCase().trim();
    const linkedCount = await subsCollection.countDocuments({
      tenantId,
      currency: { $regex: `^${escapeRegex(codeTrimmed)}$`, $options: "i" }
    });
    if (linkedCount > 0) {
      return res.status(409).json({
        message: "Please reassign the currency before deleting.",
        linkedCount,
      });
    }
    
    const result = await collection.deleteOne({ code: codeTrimmed, tenantId });
    
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Currency deleted" });
    } else {
      res.status(404).json({ message: "Currency not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete currency", error });
  }
});

// --- Category API ---
// List all categories
router.get("/api/company/categories", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("categories");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const items = await collection.find({ tenantId }).toArray();
    // Only return categories with valid, non-empty names
    const categories = items
      .filter(item => typeof item.name === "string" && item.name.trim())
      .map(item => ({
        name: item.name,
        visible: typeof item.visible === "boolean" ? item.visible : true
      }));
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories", error });
  }
});
// Add a new category
router.post("/api/company/categories", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("categories");
    let { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Category name required" });
    }
    name = name.trim();
    // Multi-tenancy: get tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    // Prevent duplicate category names WITHIN THIS TENANT
    const exists = await collection.findOne({ name, tenantId });
    if (exists) {
      return res.status(409).json({ message: "Category already exists" });
    }
    const result = await collection.insertOne({ name, visible: true, tenantId });
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add category", error });
  }
});
// Delete a category by name
router.delete("/api/company/categories/:name", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("categories");
    const subsCollection = db.collection("subscriptions");
    const name = req.params.name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Category name required" });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const trimmed = name.trim();
    const nameRegex = `^${escapeRegex(trimmed)}$`;
    const linkedCount = await subsCollection.countDocuments({
      tenantId,
      category: { $regex: nameRegex, $options: "i" }
    });
    if (linkedCount > 0) {
      return res.status(409).json({
        message: "Please reassign the category before deleting.",
        linkedCount,
      });
    }

    // Case-insensitive and trimmed match (within tenant)
    const result = await collection.deleteOne({ tenantId, name: { $regex: nameRegex, $options: "i" } });
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Category deleted" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete category", error });
  }
});

// --- Departments API ---
// List all departments
router.get("/api/company/departments", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("departments");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const items = await collection.find({ tenantId }).toArray();
    // Only return departments with valid, non-empty names
    const departments = items
      .filter(item => typeof item.name === "string" && item.name.trim())
      .map(item => ({
        _id: item._id,
        name: item.name,
        departmentHead: item.departmentHead || "",
        email: item.email || "",
        visible: typeof item.visible === "boolean" ? item.visible : true
      }));
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch departments", error });
  }
});

// Add a new department
router.post("/api/company/departments", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("departments");
    let { name, departmentHead, email } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Department name required" });
    }
    name = name.trim();
    
    // Validate departmentHead if provided
    if (departmentHead && typeof departmentHead !== "string") {
      return res.status(400).json({ message: "Invalid department head" });
    }
    departmentHead = departmentHead?.trim() || "";
    
    // Validate email if provided
    if (email && typeof email !== "string") {
      return res.status(400).json({ message: "Invalid email" });
    }
    email = email?.trim() || "";
    
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const deptNameRegex = `^${escapeRegex(name)}$`;

    // Prevent duplicate department names within the same tenant (case-insensitive)
    const exists = await collection.findOne({ tenantId, name: { $regex: deptNameRegex, $options: "i" } });
    if (exists) {
      return res.status(409).json({ message: "Department already exists" });
    }
    const result = await collection.insertOne({ 
      name, 
      departmentHead, 
      email, 
      visible: true, 
      tenantId 
    });
    
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add department", error });
  }
});

// Update department (name, departmentHead, email)
router.put("/api/company/departments/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("departments");
    const { id } = req.params;
    const { name, departmentHead, email } = req.body;
    
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Department name required" });
    }
    
    // Validate departmentHead if provided
    const validDepartmentHead = typeof departmentHead === "string" ? departmentHead.trim() : "";
    
    // Validate email if provided
    const validEmail = typeof email === "string" ? email.trim() : "";
    
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const trimmedName = name.trim();
    const deptNameRegex = `^${escapeRegex(trimmedName)}$`;
    const ObjectId = new (require('mongodb').ObjectId)(id);

    // Prevent renaming to a name that already exists in this tenant (case-insensitive)
    const duplicate = await collection.findOne({
      tenantId,
      name: { $regex: deptNameRegex, $options: "i" },
      _id: { $ne: ObjectId },
    });
    if (duplicate) {
      return res.status(409).json({ message: "Department already exists" });
    }
    
    // Get the old department data to check if email/head changed
    const oldDepartment = await collection.findOne({ _id: ObjectId, tenantId });
    
    const result = await collection.updateOne(
      { _id: ObjectId, tenantId },
      { $set: { name: trimmedName, departmentHead: validDepartmentHead, email: validEmail } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Department not found" });
    }
    
    res.status(200).json({ message: "Department updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update department", error });
  }
});

// Update department visibility
router.patch("/api/company/departments/:name", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("departments");
    const name = req.params.name;
    const { visible } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Department name required" });
    }
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    if (typeof visible !== "boolean") {
      return res.status(400).json({ message: "Invalid visible flag" });
    }

    const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const trimmed = name.trim();
    const deptNameRegex = `^${escapeRegex(trimmed)}$`;

    const result = await collection.updateOne(
      { tenantId, name: { $regex: deptNameRegex, $options: "i" } },
      { $set: { visible } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Department not found" });
    }
    res.status(200).json({ name, visible });
  } catch (error) {
    res.status(500).json({ message: "Failed to update department", error });
  }
});

// Delete a department by name
router.delete("/api/company/departments/:name", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("departments");
    const subsCollection = db.collection("subscriptions");
    const name = req.params.name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Department name required" });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const trimmed = name.trim();
    const deptNameRegex = `^${escapeRegex(trimmed)}$`;
    const deptQuotedRegex = new RegExp(`\\"${escapeRegex(trimmed)}\\"`, 'i');

    const linkedCount = await subsCollection.countDocuments({
      tenantId,
      $or: [
        // stored as array
        { departments: { $regex: deptNameRegex, $options: "i" } },
        { departments: trimmed },
        // stored as plain string
        { department: { $regex: deptNameRegex, $options: "i" } },
        { department: trimmed },
        // stored as JSON string
        { departments: { $regex: deptQuotedRegex } },
        { department: { $regex: deptQuotedRegex } }
      ]
    });
    if (linkedCount > 0) {
      return res.status(409).json({
        message: "Please reassign the department before deleting.",
        linkedCount,
      });
    }

    // Case-insensitive and trimmed match (within tenant)
    const result = await collection.deleteOne({ tenantId, name: { $regex: deptNameRegex, $options: "i" } });
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Department deleted" });
    } else {
      res.status(404).json({ message: "Department not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete department", error });
  }
});

// --- Subscriptions API ---
// Create a new subscription (with history log)
router.post("/api/subscriptions", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const historyCollection = db.collection("history");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
    // Import encryption functions
    const { encryptSubscriptionData } = await import("./encryption.service.js");
    
    const rawServiceName = String((req.body as any)?.serviceName || '').trim();
    if (!rawServiceName) {
      return res.status(400).json({ message: 'Service name is required' });
    }

    // Used to detect duplicates despite serviceName being encrypted (encryption is randomized).
    const serviceNameKey = rawServiceName.toLowerCase();
    const createIdempotencyKey = typeof (req.body as any)?.createIdempotencyKey === 'string'
      ? String((req.body as any).createIdempotencyKey).trim()
      : '';

    // If client retries the same create (slow network), return the already-created doc.
    if (createIdempotencyKey) {
      const existing = await collection.findOne({ tenantId, createIdempotencyKey, isDraft: { $ne: true } });
      if (existing?._id) {
        return res.status(200).json({
          message: 'Subscription already created',
          _id: existing._id,
          subscription: existing,
        });
      }
    }

    // Best-effort duplicate guard (works once documents have serviceNameKey)
    const existingByName = await collection.findOne({ tenantId, serviceNameKey, isDraft: { $ne: true } });
    if (existingByName?._id) {
      return res.status(200).json({
        message: 'Subscription already exists',
        _id: existingByName._id,
        subscription: existingByName,
      });
    }

    // Prepare subscription document with timestamps and tenantId
    const subscription = {
      ...req.body,
      tenantId,
      serviceNameKey,
      ...(createIdempotencyKey ? { createIdempotencyKey } : {}),
      // Normalize common date fields (UI may send dd-mm-yyyy)
      startDate: normalizeDateString(req.body.startDate),
      nextRenewal: normalizeDateString(req.body.nextRenewal),
      endDate: normalizeDateString(req.body.endDate),
      firstPurchaseDate: normalizeDateString((req.body as any)?.firstPurchaseDate),
      currentCycleStart: normalizeDateString((req.body as any)?.currentCycleStart),
      initialDate: normalizeDateString(req.body.initialDate || req.body.startDate), // Set initialDate to startDate if not provided
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Backfill ownerEmail from Employees if missing (used for reminder visibility + emails)
    if (subscription.owner && (!subscription.ownerEmail || String(subscription.ownerEmail).trim() === '')) {
      try {
        const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const ownerValue = String(subscription.owner).trim();
        const ownerRegex = new RegExp(`^${escapeRegex(ownerValue)}$`, 'i');
        const employee = await db.collection('employees').findOne({
          tenantId,
          $or: [{ email: ownerRegex }, { name: ownerRegex }],
        });
        if (employee?.email) {
          subscription.ownerEmail = String(employee.email).trim();
        }
      } catch {
        // ignore
      }
    }
    
    // ENCRYPT sensitive data before storing
    const encryptedSubscription = encryptSubscriptionData(subscription);
    
    let subscriptionId;
    try {
      const result = await collection.insertOne(encryptedSubscription);
      subscriptionId = result.insertedId;
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isDup = msg.includes('E11000') || msg.toLowerCase().includes('duplicate key');
      if (isDup) {
        const existing = createIdempotencyKey
          ? await collection.findOne({ tenantId, createIdempotencyKey, isDraft: { $ne: true } })
          : await collection.findOne({ tenantId, serviceNameKey, isDraft: { $ne: true } });

        if (existing?._id) {
          return res.status(200).json({
            message: 'Subscription already created',
            _id: existing._id,
            subscription: existing,
          });
        }
      }
      throw err;
    }

    // Respond immediately; run heavy side-effects in background.
    res.status(201).json({
      message: 'Subscription created',
      _id: subscriptionId,
    });

    void (async () => {
      try {
        const createdSubscription = await collection.findOne({ _id: subscriptionId, tenantId });
        if (!createdSubscription) return;

        // History record
        try {
          const historyRecord = {
            subscriptionId: subscriptionId,
            tenantId,
            data: {
              ...createdSubscription,
              _id: subscriptionId,
            },
            action: 'create',
            timestamp: new Date(),
            serviceName: (subscription as any).serviceName,
          };
          await historyCollection.insertOne(historyRecord);
        } catch (e) {
          console.error('❌ [SUBTRACKERR] Failed to write subscription history on create:', e);
        }

        // Notification event
        try {
          const { ObjectId } = await import('mongodb');
          const notificationEvent = {
            _id: new ObjectId(),
            tenantId,
            type: 'subscription',
            eventType: 'created',
            subscriptionId: subscriptionId.toString(),
            subscriptionName: (subscription as any).serviceName,
            category: (subscription as any).category || 'Software',
            message: `Subscription ${(subscription as any).serviceName} created`,
            read: false,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reminderTriggerDate: new Date().toISOString().slice(0, 10),
          };
          await db.collection('notification_events').insertOne(notificationEvent);
        } catch (e) {
          console.error('❌ [SUBTRACKERR] Failed to create notification event on create:', e);
        }

        // Reminders
        try {
          await generateRemindersForSubscription(createdSubscription, tenantId, db);
        } catch (e) {
          console.error('❌ [SUBTRACKERR] Failed to generate reminders on create:', e);
        }

        // Lifecycle notifications (in-app + email)
        try {
          await sendSubscriptionNotifications('create', createdSubscription, null, tenantId, db);
        } catch (e) {
          console.error('❌ [SUBTRACKERR] Failed to send lifecycle notifications on create:', e);
        }

        // Payment method expiry check (non-blocking inside background already)
        try {
          const paymentMethodName = String((subscription as any)?.paymentMethod || '').trim();
          if (paymentMethodName) {
            const { PaymentExpiryService } = await import('./payment-expiry.service.js');
            const svc = new PaymentExpiryService();
            void svc.checkAndSendPaymentMethodExpiringNotificationsForTenant({
              tenantId,
              paymentName: paymentMethodName,
              db,
            });
          }
        } catch (e) {
          console.error('❌ [SUBTRACKERR] Failed to run payment expiry check after create:', e);
        }
      } catch (e) {
        console.error('❌ [SUBTRACKERR] Background create tasks failed:', e);
      }
    })();
  } catch (error: unknown) {
    console.error("Creation error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to create subscription", error: errorMessage });
  }
});
// Note: Duplicate route was removed here. The route is defined earlier in the file.

// Save subscription as draft
router.post("/api/subscriptions/draft", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const draftSessionId = typeof req.body?.draftSessionId === "string" ? req.body.draftSessionId : null;

    // If the client provides a draftSessionId, make draft saving idempotent by upserting
    // the same draft doc instead of inserting duplicates.
    if (draftSessionId) {
      const now = new Date();
      const update = {
        $set: {
          ...req.body,
          tenantId,
          draftSessionId,
          isDraft: true,
          status: "Draft",
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      };

      const result = await collection.findOneAndUpdate(
        { tenantId, isDraft: true, draftSessionId },
        update,
        { upsert: true, returnDocument: "after" }
      );

      const createdDraft = result;
      if (!createdDraft?._id) {
        console.error("Failed to save draft - no _id returned:", createdDraft);
        return res.status(500).json({ message: "Failed to save draft - no document returned" });
      }

      return res.status(201).json({
        message: "Draft saved successfully",
        _id: createdDraft._id,
        subscription: createdDraft,
      });
    }

    // Legacy behavior (no draftSessionId provided): insert a new draft.
    const draftSubscription = {
      ...req.body,
      tenantId,
      isDraft: true,
      status: "Draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await collection.insertOne(draftSubscription);
    const subscriptionId = insertResult.insertedId;
    const createdDraft = await collection.findOne({ _id: subscriptionId });

    res.status(201).json({
      message: "Draft saved successfully",
      _id: subscriptionId,
      subscription: createdDraft,
    });
  } catch (error: unknown) {
    console.error("Draft creation error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to save draft", error: errorMessage });
  }
});

// Convert draft to active subscription
router.post("/api/subscriptions/draft/:id/activate", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const historyCollection = db.collection("history");
    const { ObjectId } = await import("mongodb");
    
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const subscriptionId = new ObjectId(req.params.id);
    
    // Find the draft subscription
    const draftSubscription = await collection.findOne({ 
      _id: subscriptionId, 
      tenantId,
      isDraft: true 
    });
    
    if (!draftSubscription) {
      return res.status(404).json({ message: "Draft subscription not found" });
    }

    // Update draft to active subscription
    const updateData = {
      ...req.body,
      isDraft: false,
      status: "Active",
      updatedAt: new Date()
    };

    const result = await collection.updateOne(
      { _id: subscriptionId, tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Draft subscription not found" });
    }

    // Get the updated subscription
    const activatedSubscription = await collection.findOne({ _id: subscriptionId });

    // Create history record for activation
    const historyRecord = {
      subscriptionId: subscriptionId,
      tenantId,
      data: activatedSubscription,
      action: "activate_draft",
      timestamp: new Date(),
      serviceName: activatedSubscription?.serviceName
    };
    await historyCollection.insertOne(historyRecord);

    // Generate reminders for the activated subscription
    await generateRemindersForSubscription(activatedSubscription, tenantId, db);

    res.status(200).json({ 
      message: "Draft activated successfully",
      subscription: activatedSubscription 
    });
  } catch (error: unknown) {
    console.error("Draft activation error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to activate draft", error: errorMessage });
  }
});

// Get all draft subscriptions
router.get("/api/subscriptions/drafts", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const drafts = await collection.find({ 
      tenantId,
      isDraft: true 
    }).sort({ createdAt: -1 }).toArray();

    res.status(200).json(drafts);
  } catch (error: unknown) {
    console.error("Error fetching drafts:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to fetch drafts", error: errorMessage });
  }
});

// Update an existing subscription
router.put("/api/subscriptions/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const historyCollection = db.collection("history");
    const { id } = req.params;
    // Multi-tenancy: only allow update for current tenant
    const tenantId = req.user?.tenantId;
// Debug log
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
    // Import encryption functions
    const { encryptSubscriptionData } = await import("./encryption.service.js");
    
    // Always try to create an ObjectId from the ID
    let subscriptionId;
    try {
      subscriptionId = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid subscription ID format" });
    }
    // Get the document before update, filtered by tenantId
    const oldDoc = await collection.findOne({ _id: subscriptionId, tenantId });
    if (!oldDoc) {
      return res.status(404).json({ message: "Subscription not found or access denied" });
    }
    // Perform the update
    // Remove tenantId from payload if present
    if ('tenantId' in req.body) {
      delete req.body.tenantId;
    }

    // Preserve existing ownerEmail if UI sends empty string (common on status-only updates like cancel)
    if ('ownerEmail' in req.body && String(req.body.ownerEmail || '').trim() === '') {
      delete req.body.ownerEmail;
    }

    // Normalize common date fields (UI may send dd-mm-yyyy)
    if ('startDate' in req.body) req.body.startDate = normalizeDateString(req.body.startDate);
    if ('nextRenewal' in req.body) req.body.nextRenewal = normalizeDateString(req.body.nextRenewal);
    if ('endDate' in req.body) req.body.endDate = normalizeDateString(req.body.endDate);
    if ('initialDate' in req.body) req.body.initialDate = normalizeDateString(req.body.initialDate);
    if ('firstPurchaseDate' in req.body) (req.body as any).firstPurchaseDate = normalizeDateString((req.body as any).firstPurchaseDate);
    if ('currentCycleStart' in req.body) (req.body as any).currentCycleStart = normalizeDateString((req.body as any).currentCycleStart);

    // If owner is being set/changed and ownerEmail not provided, backfill from Employees
    if ('owner' in req.body && (!('ownerEmail' in req.body) || String((req.body as any).ownerEmail || '').trim() === '')) {
      try {
        const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const ownerValue = String((req.body as any).owner || '').trim();
        if (ownerValue) {
          const ownerRegex = new RegExp(`^${escapeRegex(ownerValue)}$`, 'i');
          const employee = await db.collection('employees').findOne({
            tenantId,
            $or: [{ email: ownerRegex }, { name: ownerRegex }],
          });
          if (employee?.email) {
            (req.body as any).ownerEmail = String(employee.email).trim();
          }
        }
      } catch {
        // ignore
      }
    }
    
    // ENCRYPT sensitive fields in the update payload
    const encryptedPayload = encryptSubscriptionData(req.body);
    
    const preservedInitialDate = req.body.initialDate || oldDoc.initialDate;
const update = { 
      $set: { 
        ...encryptedPayload,
        status: req.body.status || oldDoc.status, // Preserve status if not provided
        initialDate: preservedInitialDate, // IMPORTANT: Preserve original initialDate
        updatedAt: new Date(),  // Add updatedAt timestamp
        tenantId // Always set tenantId from user/session, not from payload (last)
      } 
    };
    const result = await collection.updateOne({ _id: subscriptionId, tenantId }, update);
    if (result.matchedCount === 1) {
      // Get the updated document
      const updatedDoc = await collection.findOne({ _id: subscriptionId, tenantId });
      
      // Only create history record if there were actual changes
      if (result.modifiedCount > 0) {
        // Use effectiveDate if provided, otherwise use current date
        const effectiveDate = req.body.effectiveDate ? new Date(req.body.effectiveDate) : new Date();
        
        // Create history record with tenantId
        const historyRecord = {
          subscriptionId: subscriptionId,  // Store as ObjectId
          tenantId, // Always include tenantId for filtering
          data: {
            ...oldDoc,
            _id: subscriptionId
          },
          updatedFields: {
            ...updatedDoc,
            _id: subscriptionId,
            // Override startDate with effectiveDate if provided
            startDate: req.body.effectiveDate ? effectiveDate : (updatedDoc?.startDate || new Date())
          },
          action: "update",
          timestamp: effectiveDate, // Use effective date instead of new Date()
          serviceName: updatedDoc?.serviceName  // Add serviceName for easier querying
        };
try {
          const historyResult = await historyCollection.insertOne(historyRecord);
} catch (err) {
          console.error('Error inserting history record:', err);
        }
      } else {
}

      res.status(200).json({ 
        message: "Subscription updated",
        subscription: updatedDoc
      });

      // Run reminders + notifications in background so the update API stays fast.
      void (async () => {
        try {
          if (!updatedDoc) return;

          // Update reminders
          try {
            await generateRemindersForSubscription(updatedDoc, tenantId, db);
          } catch (e) {
            console.error('❌ [SUBTRACKERR] Failed to generate reminders on update:', e);
          }

          // Lifecycle notifications (in-app + email)
          if (result.modifiedCount > 0) {
            try {
              const { decryptSubscriptionData } = await import("./encryption.service.js");
              const decryptedOld = decryptSubscriptionData(oldDoc);
              const decryptedUpdated = decryptSubscriptionData(updatedDoc);
              const changes = detectSubscriptionChanges(decryptedOld, decryptedUpdated);

              if (changes.ownerChanged) {
                await sendSubscriptionNotifications('ownerChange', updatedDoc, oldDoc, tenantId, db);
              }
              if (changes.priceChanged) {
                await sendSubscriptionNotifications('priceChange', updatedDoc, oldDoc, tenantId, db);
              }
              if (changes.quantityChanged) {
                await sendSubscriptionNotifications('quantityChange', updatedDoc, oldDoc, tenantId, db);
              }
              if (changes.statusChanged) {
                const normalizedStatus = String((updatedDoc as any).status || '').trim().toLowerCase();
                const isCancelled = normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus === 'cancel';
                if (isCancelled) {
                  await sendSubscriptionNotifications('cancel', updatedDoc, oldDoc, tenantId, db);
                }
              }

              // Payment method expiry check (non-blocking inside background already)
              try {
                const paymentMethodName = String((decryptedUpdated as any)?.paymentMethod || '').trim();
                if (paymentMethodName) {
                  const { PaymentExpiryService } = await import('./payment-expiry.service.js');
                  const svc = new PaymentExpiryService();
                  void svc.checkAndSendPaymentMethodExpiringNotificationsForTenant({
                    tenantId,
                    paymentName: paymentMethodName,
                    db,
                  });
                }
              } catch (e) {
                console.error('❌ [SUBTRACKERR] Failed payment expiry check after update:', e);
              }
            } catch (e) {
              console.error(`❌ [SUBTRACKERR] Background lifecycle notifications failed for update:`, e);
            }
          }
        } catch (e) {
          console.error('❌ [SUBTRACKERR] Background update tasks failed:', e);
        }
      })();
    } else {
      res.status(404).json({ message: "Subscription not found or access denied" });
    }
  } catch (error: unknown) {
    console.error("Update error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to update subscription", error: errorMessage });
  }
});

// List all employees
router.get("/api/employees", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("employees");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const items = await collection.find({ tenantId }).toArray();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch employees", error });
  }
});

// Add a new employee
router.post("/api/employees", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("employees");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const employee = {
      ...req.body,
      tenantId
    };
    // Optionally validate required fields here
    const result = await collection.insertOne(employee);
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add employee", error });
  }
});

// Update an employee
router.put("/api/employees/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("employees");
    const loginCollection = db.collection("login");
    const { id } = req.params;
    let filter;
    try {
      filter = { _id: new EmployeeObjectId(id) };
    } catch {
      return res.status(400).json({ message: "Invalid employee id" });
    }
    const update = { $set: req.body };
    const result = await collection.updateOne(filter, update);
    
    if (result.matchedCount === 1) {
      // Sync department to login collection if email matches
      if (req.body.email && req.body.department) {
        await loginCollection.updateOne(
          { email: req.body.email },
          { $set: { department: req.body.department } }
        );
        console.log(`[Employee Update] Synced department "${req.body.department}" to login for ${req.body.email}`);
      }
      
      res.status(200).json({ message: "Employee updated" });
    } else {
      res.status(404).json({ message: "Employee not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update employee", error });
  }
});

// Delete an employee
router.delete("/api/employees/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("employees");
    const subsCollection = db.collection("subscriptions");
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    let filter;
    try {
      filter = { _id: new EmployeeObjectId(id), tenantId };
    } catch {
      return res.status(400).json({ message: "Invalid employee id" });
    }

    const employee = await collection.findOne(filter);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const empName = String(employee?.name || '').trim();
    const empEmail = String(employee?.email || '').trim();
    const empId = String(employee?._id || '').trim();

    const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ownerEmailRegex = empEmail ? { ownerEmail: { $regex: `^${escapeRegex(empEmail)}$`, $options: 'i' } } : null;
    const ownerNameRegex = empName ? { owner: { $regex: `^${escapeRegex(empName)}$`, $options: 'i' } } : null;
    const ownerIdExact = empId ? { ownerId: empId } : null;

    const or: any[] = [ownerEmailRegex, ownerNameRegex, ownerIdExact].filter(Boolean);
    const linkedCount = or.length
      ? await subsCollection.countDocuments({ tenantId, $or: or })
      : 0;

    if (linkedCount > 0) {
      return res.status(409).json({
        message: "Please reassign the subscriptions before deleting the employee.",
        linkedCount,
      });
    }

    const result = await collection.deleteOne(filter);
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Employee deleted" });
    } else {
      res.status(404).json({ message: "Employee not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete employee", error });
  }
});

// --- Users API ---

// Add a new user
router.post("/api/users", async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(401).json({ message: "Missing tenantId in user context" });
  }
  
  try {
    const { password, name, email, role, status, department } = req.body;
const db = await connectToDatabase();
    
    // Check if email already exists in login collection for this tenant
    const existingUser = await db.collection("login").findOne({ email, tenantId });
    if (existingUser) {
return res.status(400).json({ message: "Email already exists" });
    }
    
    // Check if name already exists in login collection for this tenant
    const existingName = await db.collection("login").findOne({ fullName: name, tenantId });
if (existingName) {
return res.status(400).json({ message: "User name already exists" });
    }
    
    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Store in login collection with proper structure
    const result = await db.collection("login").insertOne({
      fullName: name,
      email: email,
      password: hashedPassword,
      tenantId: tenantId,
      role: role || "viewer",
      status: status || "active",
      department: department || null,
      createdAt: new Date()
    });
    
    // Return user without password
    res.status(201).json({
      _id: result.insertedId,
      name: name,
      email: email,
      role: role || "viewer",
      status: status || "active",
      tenantId: tenantId
    });
  } catch (error) {
    console.error("User creation error:", error);
    res.status(500).json({ message: "Failed to add user", error });
  }
});

// Update a user
router.put("/api/users/:_id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("login");
    const { _id } = req.params;
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const { name, email, role, status, department, password } = req.body || {};
    
    // Check if email is being updated and already exists (excluding current user)
    if (email) {
      const existingEmail = await collection.findOne({ 
        email, 
        tenantId,
        _id: { $ne: new EmployeeObjectId(_id) }
      });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
    }
    
    // Check if name is being updated and already exists (excluding current user)
    if (name) {
      const existingName = await collection.findOne({ 
        fullName: name, 
        tenantId,
        _id: { $ne: new EmployeeObjectId(_id) }
      });
      if (existingName) {
        return res.status(400).json({ message: "User name already exists" });
      }
    }
    
    // If password is being updated, hash it
    const updateData: any = {};
    if (name) updateData.fullName = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (department !== undefined) updateData.department = department;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    
    let filter;
    try {
      filter = { _id: new EmployeeObjectId(_id), tenantId };
    } catch {
      return res.status(400).json({ message: "Invalid user _id" });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const result = await collection.findOneAndUpdate(
      filter,
      { $set: updateData },
      { returnDocument: "after" }
    );

    const updated = result?.value;
    if (updated) {
      return res.status(200).json({
        id: updated._id?.toString?.() ?? String(updated._id),
        name: updated.fullName,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        department: updated.department ?? null,
        tenantId: updated.tenantId,
      });
    }

    {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update user", error });
  }
});

// --- Subscription Fields Configuration API ---
// Save enabled fields
router.post("/api/config/fields", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("config");
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ message: "Fields must be an array" });
    }
    // Upsert a single config document for fields
    await collection.updateOne(
      { key: "subscriptionFields", tenantId: req.user?.tenantId },
      { $set: { key: "subscriptionFields", fields, tenantId: req.user?.tenantId } },
      { upsert: true }
    );
    res.status(200).json({ message: "Fields saved" });
  } catch (error) {
    res.status(500).json({ message: "Failed to save fields", error });
  }
});

// Get enabled fields
router.get("/api/config/fields", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("config");
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const doc = await collection.findOne({ key: "subscriptionFields", tenantId });
    res.status(200).json(doc?.fields || []);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch fields", error });
  }
});

// --- Compliance Fields Configuration API ---
// Save compliance field
router.post("/api/config/compliance-fields", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("Fields"); // Changed to Fields collection
    const { name } = req.body;
    
    // Validate field name
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Field name is required" });
    }

    // Check if field already exists
    const existingField = await collection.findOne({ 
      name: name.trim(),
      fieldType: "compliance" // Changed type to fieldType
    });
    
    if (existingField) {
      return res.status(409).json({ message: "Field already exists" });
    }

    // Insert new field
    const newField = {
      name: name.trim(),
      enabled: true,
      fieldType: "compliance", // Changed type to fieldType
      tenantId: req.user?.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
      displayOrder: 0, // Added display order for UI sorting
      required: false, // Added required flag
      description: "", // Added description field
      validation: {} // Added validation rules object
    };

    const result = await collection.insertOne(newField);

    res.status(201).json({ 
      insertedId: result.insertedId,
      ...newField
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to save compliance field", error });
  }
});

// Get compliance fields
router.get("/api/config/compliance-fields", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("Fields"); // Changed to Fields collection
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const fields = await collection.find({ fieldType: "compliance", tenantId }).sort({ displayOrder: 1 }).toArray();
    res.status(200).json(fields.map(field => ({
      _id: field._id,
      name: field.name,
      enabled: field.enabled,
      displayOrder: field.displayOrder,
      required: field.required,
      description: field.description,
      validation: field.validation
    })));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch compliance fields", error });
  }
});

// Update compliance field
router.patch("/api/config/compliance-fields/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("Fields"); // Changed to Fields collection
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.fieldType;
    delete updates.createdAt;

    const result = await collection.updateOne(
      { _id: new ObjectId(id), fieldType: "compliance" },
      { 
        $set: {
          ...updates,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Field not found" });
    }

    res.status(200).json({ message: "Field updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update compliance field", error });
  }
});

// Delete compliance field
router.delete("/api/config/compliance-fields/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("Fields"); // Changed to Fields collection
    const { id } = req.params;

    const result = await collection.deleteOne({
      _id: new ObjectId(id),
      fieldType: "compliance"
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Field not found" });
    }

    res.status(200).json({ message: "Field deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete compliance field", error });
  }
});

// --- Compliance Notifications API ---
// Get all compliance notifications for the current tenant
router.get("/api/notifications/compliance", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const tenantId = req.user?.tenantId;
    const userId = (req.user as any)?.userId || (req.user as any)?.id;
    const userEmail = (req.user as any)?.email;
    const userRole = (req.user as any)?.role;
    const userDept = (req.user as any)?.department;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const normalizedEmail = String(userEmail || "").trim().toLowerCase();
    const normalizedDept = String(userDept || "").trim().toLowerCase();

    const extractDepartments = (n: any): string[] => {
      if (!n) return [];
      const raw = (n as any).departments ?? (n as any).department ?? (n as any).recipientDepartments;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
      if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s) return [];
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
          if (parsed) return [String(parsed)].filter(Boolean);
        } catch {
          return [s];
        }
      }
      return [];
    };

    const isDeptRole = userRole === 'department_editor' || userRole === 'department_viewer';
    const isAdminRole = userRole === 'admin' || userRole === 'super_admin';

    const deptMatches = (n: any) => {
      if (!normalizedDept) return false;
      const depts = extractDepartments(n).map((d) => String(d || '').trim().toLowerCase()).filter(Boolean);
      return depts.includes(normalizedDept);
    };

    const ownerMatches = (n: any) => {
      if (!normalizedEmail) return false;
      const ownerEmail = String((n as any)?.ownerEmail || (n as any)?.userEmail || '').trim().toLowerCase();
      return !!ownerEmail && ownerEmail === normalizedEmail;
    };

    // 1) Fetch legacy compliance notifications (created/deleted events + reminders)
    const rawNotifications = await db
      .collection("compliance_notifications")
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .toArray();

    const legacyEventNotifications = rawNotifications
      .filter((n: any) => n.eventType === "created" || n.eventType === "deleted" || n.eventType === "updated")
      .map((n: any) => ({
        ...n,
        id: n._id?.toString?.() || n.id,
        type: "compliance",
        timestamp: n.timestamp || n.createdAt,
        createdAt: n.createdAt || n.timestamp,
      }));

    // Reminder documents in compliance_notifications are tenant-wide.
    // We return ONLY due + unsent reminders so the UI can show them even if the scheduler
    // hasn't run yet. Once the reminder job sends them, it marks them as sent=true.
    const IST_OFFSET_MINUTES = 330;
    const istNow = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
    const todayIso = istNow.toISOString().slice(0, 10);

    let reminderDocs = await db
      .collection("compliance_notifications")
      .find({
        tenantId,
        reminderTriggerDate: { $lte: todayIso },
        $or: [{ eventType: { $exists: false } }, { eventType: null }],
      })
      .sort({ reminderTriggerDate: -1, createdAt: -1 })
      .toArray();

    // Role-based filtering
    if (isDeptRole) {
      reminderDocs = normalizedDept ? reminderDocs.filter(deptMatches) : [];
    } else if (!isAdminRole) {
      reminderDocs = reminderDocs.filter(ownerMatches);
    }

    const reminderNotifications: any[] = reminderDocs.map((n: any) => ({
      ...n,
      id: n._id?.toString?.() || n.id,
      type: "compliance",
      timestamp: n.timestamp || n.createdAt,
      createdAt: n.createdAt || n.timestamp,
    }));

    // 2) Fetch lifecycle compliance notifications (from notifications collection)
    let userInAppNotifications: any[] = [];
    if (isAdminRole) {
      userInAppNotifications = await db
        .collection("notifications")
        .find({ tenantId, type: "compliance" })
        .sort({ createdAt: -1 })
        .toArray();
    } else if (isDeptRole) {
      const raw = await db
        .collection("notifications")
        .find({ tenantId, type: "compliance" })
        .sort({ createdAt: -1 })
        .toArray();
      userInAppNotifications = normalizedDept ? raw.filter(deptMatches) : [];
    } else if (userId || normalizedEmail) {
      userInAppNotifications = await db
        .collection("notifications")
        .find({
          tenantId,
          type: "compliance",
          $or: [
            ...(userId ? [{ userId: String(userId) }] : []),
            ...(normalizedEmail ? [{ userEmail: normalizedEmail }] : []),
          ],
        })
        .sort({ createdAt: -1 })
        .toArray();
    }

    userInAppNotifications = userInAppNotifications.map((n: any) => ({
      ...n,
      id: n._id?.toString?.() || n.id,
      type: "compliance",
      timestamp: n.timestamp || n.createdAt,
      createdAt: n.createdAt || n.timestamp,
    }));

    // Filter out static/demo notifications, but do NOT hide real reminders/events
    // that happen to have a default filingName.
    const notDemo = (n: any) => {
      if (!n) return false;
      if (n.complianceId || n.subscriptionId) return true;
      return !!(n?.filingName && n.filingName !== "Compliance Filing");
    };

    const allNotifications = dedupeNotifications([...legacyEventNotifications, ...reminderNotifications, ...userInAppNotifications])
      .filter(notDemo)
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp || b.createdAt || "").getTime() -
          new Date(a.timestamp || a.createdAt || "").getTime()
      );

    res.status(200).json(allNotifications);
  } catch (error) {
    console.error('[COMPLIANCE NOTIFICATIONS] Error:', error);
    res.status(500).json({ message: "Failed to fetch compliance notifications", error });
  }
});

router.get("/api/notifications/license", async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = (req.user as any)?.userId || (req.user as any)?.id;
    const userEmail = (req.user as any)?.email;
    const userRole = (req.user as any)?.role;
    const userDept = (req.user as any)?.department;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });

    const db = await connectToDatabase();
    const normalizedEmail = String(userEmail || "").trim().toLowerCase();
    const normalizedDept = String(userDept || "").trim().toLowerCase();

    const extractDepartments = (n: any): string[] => {
      if (!n) return [];
      const raw = (n as any).departments ?? (n as any).department;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
      if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s) return [];
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
          if (parsed) return [String(parsed)].filter(Boolean);
        } catch {
          return [s];
        }
      }
      return [];
    };

    const isDeptRole = userRole === 'department_editor' || userRole === 'department_viewer';
    const isAdminRole = userRole === 'admin' || userRole === 'super_admin';

    let raw: any[] = [];
    if (isAdminRole) {
      raw = await db.collection("notifications").find({ tenantId, type: "license" }).sort({ createdAt: -1 }).toArray();
    } else if (isDeptRole) {
      const all = await db.collection("notifications").find({ tenantId, type: "license" }).sort({ createdAt: -1 }).toArray();
      if (!normalizedDept) {
        raw = [];
      } else {
        raw = all.filter((n: any) => {
          const depts = extractDepartments(n).map((d) => String(d || '').trim().toLowerCase()).filter(Boolean);
          return depts.includes(normalizedDept);
        });
      }
    } else if (userId || normalizedEmail) {
      raw = await db
        .collection("notifications")
        .find({
          tenantId,
          type: "license",
          $or: [
            ...(userId ? [{ userId: String(userId) }] : []),
            ...(normalizedEmail ? [{ userEmail: normalizedEmail }] : []),
          ],
        })
        .sort({ createdAt: -1 })
        .toArray();
    }

    const userInAppNotifications = raw.map((n: any) => ({
      ...n,
      id: n._id?.toString?.() || n.id,
      type: "license",
      timestamp: n.timestamp || n.createdAt,
      createdAt: n.createdAt || n.timestamp,
    }));

    res.status(200).json(dedupeNotifications(userInAppNotifications));
  } catch (error) {
    console.error('[LICENSE NOTIFICATIONS] Error:', error);
    res.status(500).json({ message: "Failed to fetch license notifications" });
  }
});

// --- Government Licenses API ---
// Get all licenses
router.get("/api/licenses", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("licenses");
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    const userId = req.user?.userId;
    const userDepartment = req.user?.department;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    let licenses = await collection.find({ tenantId }).sort({ createdAt: -1 }).toArray();
    
    // Apply role-based filtering
    if (userRole === 'contributor') {
      // Contributors can only see their own items
      licenses = licenses.filter(license => license.owner === userId);
    } else if (userRole === 'department_editor' || userRole === 'department_viewer') {
      // Department roles can only see items in their department
      if (userDepartment) {
        licenses = licenses.filter(license => {
          if (!license.department) return false;
          try {
            const depts = JSON.parse(license.department);
            return Array.isArray(depts) && depts.includes(userDepartment);
          } catch {
            return license.department === userDepartment;
          }
        });
      }
    }
    
    // Convert ObjectIds to strings for frontend
    const processedLicenses = licenses.map(license => ({
      ...license,
      id: license._id.toString(),
      _id: undefined
    }));

    res.status(200).json(processedLicenses);
  } catch (error: unknown) {
    console.error("Error fetching licenses:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to fetch licenses", error: errorMessage });
  }
});

// Create a new license
router.post("/api/licenses", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("licenses");
    const tenantId = req.user?.tenantId;
    const userId = (req.user as any)?.userId || (req.user as any)?.id;
    const userEmailRaw = (req.user as any)?.email;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const licenseData = {
      ...req.body,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(licenseData);

    // Create in-app notification for the creating user
    try {
      const notificationsCollection = db.collection("notifications");
      const normalizedEmail = String(userEmailRaw || "").trim().toLowerCase();
      const createdAt = new Date();
      const licenseName = String((req.body as any)?.licenseName || "").trim() || "License";

      const parseDepartments = (value: any): string[] => {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(String).filter(Boolean);
        const s = String(value).trim();
        if (!s) return [];
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
          if (parsed) return [String(parsed)].filter(Boolean);
        } catch {
          return [s];
        }
        return [];
      };

      const licenseDepartments = (() => {
        const body: any = req.body || {};
        const fromDepartments = parseDepartments(body.departments);
        if (fromDepartments.length) return fromDepartments;
        const fromDepartment = parseDepartments(body.department);
        return fromDepartment;
      })();

      const notificationDoc: any = {
        tenantId,
        type: "license",
        eventType: "created",
        licenseId: result.insertedId.toString(),
        licenseName,
        departments: licenseDepartments,
        timestamp: createdAt.toISOString(),
        createdAt,
        ...(userId ? { userId: String(userId) } : {}),
        ...(normalizedEmail ? { userEmail: normalizedEmail } : {}),
        read: false,
      };

      await notificationsCollection.insertOne(notificationDoc);
    } catch {
      // Intentionally ignore notification failures to not block license creation
    }

    // Run immediate expiry reminder check for this license (in background)
    try {
      const { runLicenseExpiryReminderCheck } = await import('./license-expiry-reminder.service.js');
      void runLicenseExpiryReminderCheck({ tenantId, licenseId: result.insertedId.toString(), db });
    } catch {
      // ignore
    }
    
    res.status(201).json({ 
      message: "License created successfully",
      id: result.insertedId.toString()
    });
  } catch (error: unknown) {
    console.error("Error creating license:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to create license", error: errorMessage });
  }
});

// Update a license
router.put("/api/licenses/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("licenses");
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    const actorUserId = (req.user as any)?.userId || (req.user as any)?.id;
    const actorEmailRaw = (req.user as any)?.email;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    let licenseId;
    try {
      licenseId = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid license ID format" });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    // Remove tenantId from update payload if present
    delete updateData.tenantId;

    const existing = await collection.findOne({ _id: licenseId, tenantId });
    if (!existing) {
      return res.status(404).json({ message: "License not found or access denied" });
    }

    const parseDepartments = (value: any): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value.map(String).filter(Boolean);
      const s = String(value).trim();
      if (!s) return [];
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (parsed) return [String(parsed)].filter(Boolean);
      } catch {
        return [s];
      }
      return [];
    };

    const normalizeName = (v: any) => String(v || '').trim();

    const existingResponsible = normalizeName((existing as any)?.responsiblePerson);
    const existingSecondary = normalizeName((existing as any)?.secondaryPerson);
    const nextResponsible = normalizeName((updateData as any)?.responsiblePerson ?? (existing as any)?.responsiblePerson);
    const nextSecondary = normalizeName((updateData as any)?.secondaryPerson ?? (existing as any)?.secondaryPerson);

    const existingDepts = (() => {
      const a = parseDepartments((existing as any)?.departments);
      if (a.length) return a;
      return parseDepartments((existing as any)?.department);
    })();
    const nextDepts = (() => {
      const a = parseDepartments((updateData as any)?.departments);
      if (a.length) return a;
      const b = parseDepartments((updateData as any)?.department);
      if (b.length) return b;
      return existingDepts;
    })();

    const sameDept = (a: string[], b: string[]) => {
      const aa = [...a].map((d) => String(d || '').trim().toLowerCase()).filter(Boolean).sort();
      const bb = [...b].map((d) => String(d || '').trim().toLowerCase()).filter(Boolean).sort();
      return JSON.stringify(aa) === JSON.stringify(bb);
    };

    const changeTypes: Array<'responsible_person_changed' | 'secondary_person_changed' | 'department_changed'> = [];
    if (existingResponsible && nextResponsible && existingResponsible !== nextResponsible) changeTypes.push('responsible_person_changed');
    if (existingSecondary !== nextSecondary && (existingSecondary || nextSecondary)) changeTypes.push('secondary_person_changed');
    if (!sameDept(existingDepts, nextDepts)) changeTypes.push('department_changed');

    const result = await collection.updateOne(
      { _id: licenseId, tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "License not found or access denied" });
    }

    // In-app notifications for key changes
    try {
      if (changeTypes.length > 0) {
        const notificationsCollection = db.collection('notifications');

        const isEmail = (value: any) => {
          if (!value) return false;
          const s = String(value).trim();
          return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
        };

        const getEmployeeEmailByName = async (name: string): Promise<string> => {
          const n = String(name || '').trim();
          if (!n) return '';
          if (isEmail(n)) return n.toLowerCase();
          const employees = await db.collection('employees').find({ tenantId }).toArray();
          const target = n.toLowerCase();
          const match = employees.find((e: any) => String(e?.name || '').trim().toLowerCase() === target);
          const email = String(match?.email || '').trim();
          return email ? email.toLowerCase() : '';
        };

        const resolveDeptHeadEmails = async (departments: string[]): Promise<string[]> => {
          const deptSet = new Set((departments || []).map((d) => String(d || '').trim().toLowerCase()).filter(Boolean));
          if (deptSet.size === 0) return [];

          const deptDocs = await db.collection('departments').find({ tenantId }).toArray();
          const matches = deptDocs.filter((d: any) => deptSet.has(String(d?.name || '').trim().toLowerCase()));

          const emails: string[] = [];
          for (const d of matches) {
            const emailField = String((d as any)?.email || '').trim();
            const headField = String((d as any)?.departmentHead || '').trim();
            if (isEmail(emailField)) {
              emails.push(emailField.toLowerCase());
              continue;
            }
            if (isEmail(headField)) {
              emails.push(headField.toLowerCase());
              continue;
            }
            if (headField) {
              const empEmail = await getEmployeeEmailByName(headField);
              if (empEmail) emails.push(empEmail.toLowerCase());
            }
          }

          return Array.from(new Set(emails)).filter(Boolean);
        };

        const licenseName = String((updateData as any)?.licenseName ?? (existing as any)?.licenseName ?? '').trim() || 'License';
        const normalizedActorEmail = String(actorEmailRaw || '').trim().toLowerCase();
        const base = {
          tenantId,
          type: 'license',
          eventType: 'updated',
          licenseId: id,
          licenseName,
          departments: nextDepts,
          timestamp: new Date().toISOString(),
          createdAt: new Date(),
          read: false,
          ...(actorUserId ? { actorUserId: String(actorUserId) } : {}),
          ...(normalizedActorEmail ? { actorEmail: normalizedActorEmail } : {}),
        } as any;

        // Admin notification: visible to all admins (admin endpoint returns all tenant license notifications)
        for (const changeType of changeTypes) {
          await notificationsCollection.insertOne({
            ...base,
            lifecycleEventType: changeType,
            recipientRole: 'admin',
          });
        }

        const recipientEmailsWithRole: Array<{ email: string; role: 'responsible_person' | 'secondary_person' | 'dept_head' }> = [];
        const responsibleEmail = await getEmployeeEmailByName(nextResponsible);
        const secondaryEmail = await getEmployeeEmailByName(nextSecondary);
        if (responsibleEmail) recipientEmailsWithRole.push({ email: responsibleEmail, role: 'responsible_person' });
        if (secondaryEmail) recipientEmailsWithRole.push({ email: secondaryEmail, role: 'secondary_person' });

        const deptHeadEmails = await resolveDeptHeadEmails(nextDepts);
        for (const email of deptHeadEmails) recipientEmailsWithRole.push({ email, role: 'dept_head' });

        // Dedup by email, but prefer dept_head labeling
        const rolePriority: Record<string, number> = { dept_head: 3, responsible_person: 2, secondary_person: 1 };
        const byEmail = new Map<string, { email: string; role: any }>();
        for (const r of recipientEmailsWithRole) {
          const key = String(r.email || '').trim().toLowerCase();
          if (!key) continue;
          const existingR = byEmail.get(key);
          if (!existingR || rolePriority[r.role] > rolePriority[existingR.role]) {
            byEmail.set(key, { email: key, role: r.role });
          }
        }

        for (const changeType of changeTypes) {
          const recipients = Array.from(byEmail.values());
          for (let i = 0; i < recipients.length; i++) {
            const r = recipients[i];
            await notificationsCollection.insertOne({
              ...base,
              lifecycleEventType: changeType,
              userEmail: r.email,
              recipientRole: r.role,
              recipientDepartments: nextDepts,
            });
          }
        }
      }
    } catch {
      // Ignore notification errors so update still succeeds
    }

    // Run immediate expiry reminder check for this license (in background)
    try {
      const { runLicenseExpiryReminderCheck } = await import('./license-expiry-reminder.service.js');
      void runLicenseExpiryReminderCheck({ tenantId, licenseId: id, db });
    } catch {
      // ignore
    }

    res.status(200).json({ message: "License updated successfully" });
  } catch (error: unknown) {
    console.error("Error updating license:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to update license", error: errorMessage });
  }
});

// Delete a license
router.delete("/api/licenses/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("licenses");
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    const userId = (req.user as any)?.userId || (req.user as any)?.id;
    const userEmailRaw = (req.user as any)?.email;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    let licenseId;
    try {
      licenseId = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid license ID format" });
    }

    const existing = await collection.findOne({ _id: licenseId, tenantId });
    const result = await collection.deleteOne({ _id: licenseId, tenantId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "License not found or access denied" });
    }

    // Create in-app notification about deletion
    try {
      const notificationsCollection = db.collection("notifications");
      const normalizedEmail = String(userEmailRaw || "").trim().toLowerCase();
      const createdAt = new Date();
      const licenseName = String((existing as any)?.licenseName || '').trim() || 'License';

      const parseDepartments = (value: any): string[] => {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(String).filter(Boolean);
        const s = String(value).trim();
        if (!s) return [];
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
          if (parsed) return [String(parsed)].filter(Boolean);
        } catch {
          return [s];
        }
        return [];
      };

      const licenseDepartments = (() => {
        const fromDepartments = parseDepartments((existing as any)?.departments);
        if (fromDepartments.length) return fromDepartments;
        const fromDepartment = parseDepartments((existing as any)?.department);
        return fromDepartment;
      })();

      const notificationDoc: any = {
        tenantId,
        type: "license",
        eventType: "deleted",
        licenseId: id,
        licenseName,
        departments: licenseDepartments,
        timestamp: createdAt.toISOString(),
        createdAt,
        ...(userId ? { userId: String(userId) } : {}),
        ...(normalizedEmail ? { userEmail: normalizedEmail } : {}),
        read: false,
      };

      await notificationsCollection.insertOne(notificationDoc);
    } catch {
      // Don't block delete if notification fails
    }

    res.status(200).json({ message: "License deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting license:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to delete license", error: errorMessage });
  }
});

// --- Logs API ---
// Get all logs for the current tenant
router.get("/api/logs", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("Log");
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const logs = await collection
      .find({ tenantId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    res.status(200).json(logs);
  } catch (error: unknown) {
    console.error("Error fetching logs:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to fetch logs", error: errorMessage });
  }
});

// Create a log entry
router.post("/api/logs", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("Log");
    const tenantId = req.user?.tenantId;
    const user = req.user?.email || req.user?.userId || 'System';

    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const { licenseId, licenseName, action, changes } = req.body;

    const logEntry = {
      tenantId,
      licenseId, // Store license ID for filtering
      licenseName,
      user,
      action, // 'create', 'update', 'delete'
      changes,
      timestamp: new Date(),
    };

    const result = await collection.insertOne(logEntry);

    res.status(201).json({
      message: "Log created successfully",
      logId: result.insertedId.toString(),
    });
  } catch (error: unknown) {
    console.error("Error creating log:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to create log", error: errorMessage });
  }
});

// --- Company Information API ---
// Company Information interface
export interface CompanyInfo {
  _id?: any; // MongoDB ObjectId
  tenantId: string;
  companyName: string;
  companyLogo?: string;
  defaultCurrency?: string;
  address: string;
  country: string;
  financialYearEnd: string;
  createdAt: Date;
  updatedAt: Date;
}

// Get company information
router.get("/api/company-info", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("companyInfo");
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const companyInfo = await collection.findOne({ tenantId });
    
    if (companyInfo) {
      // Convert ObjectId to string for frontend
      res.status(200).json({
        ...companyInfo,
        _id: companyInfo._id.toString()
      });
    } else {
      res.status(404).json({ message: "Company information not found" });
    }
  } catch (error: unknown) {
    console.error("Error fetching company info:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to fetch company information", error: errorMessage });
  }
});

// Create or update company information
router.post("/api/company-info", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("companyInfo");
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

  const { companyName, companyLogo, address, country, financialYearEnd, defaultCurrency } = req.body;

    // Validate required fields
    if (!companyName || !address || !country || !financialYearEnd) {
      return res.status(400).json({ 
        message: "Company name, address, country, and financial year end are required" 
      });
    }

    const companyData: CompanyInfo = {
      tenantId,
      companyName: companyName.trim(),
      companyLogo: companyLogo || "",
      defaultCurrency: defaultCurrency || "",
      address: address.trim(),
      country: country.trim(),
      financialYearEnd: financialYearEnd.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Check if company info already exists for this tenant
    const existingInfo = await collection.findOne({ tenantId });
    
    if (existingInfo) {
      // Update existing record
      const updateData = {
        ...companyData,
        createdAt: existingInfo.createdAt, // Preserve original creation date
        updatedAt: new Date()
      };
      
      const result = await collection.updateOne(
        { tenantId },
        { $set: updateData }
      );
      
      res.status(200).json({ 
        message: "Company information updated successfully",
        _id: existingInfo._id.toString()
      });
    } else {
      // Create new record
      const result = await collection.insertOne(companyData);
      
      res.status(201).json({ 
        message: "Company information created successfully",
        _id: result.insertedId.toString()
      });
    }
  } catch (error: unknown) {
    console.error("Error saving company info:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to save company information", error: errorMessage });
  }
});

// Update company information
router.put("/api/company-info/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("companyInfo");
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    let companyId;
    try {
      companyId = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid company ID format" });
    }

  const { companyName, companyLogo, address, country, financialYearEnd, defaultCurrency } = req.body;

    // Validate required fields
    if (!companyName || !address || !country || !financialYearEnd) {
      return res.status(400).json({ 
        message: "Company name, address, country, and financial year end are required" 
      });
    }

    const updateData = {
      companyName: companyName.trim(),
      companyLogo: companyLogo || "",
      defaultCurrency: defaultCurrency || "",
      address: address.trim(),
      country: country.trim(),
      financialYearEnd: financialYearEnd.trim(),
      updatedAt: new Date()
    };

    const result = await collection.updateOne(
      { _id: companyId, tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Company information not found or access denied" });
    }

    res.status(200).json({ message: "Company information updated successfully" });
  } catch (error: unknown) {
    console.error("Error updating company info:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to update company information", error: errorMessage });
  }
});

// Delete company information
router.delete("/api/company-info/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("companyInfo");
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    let companyId;
    try {
      companyId = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid company ID format" });
    }

    const result = await collection.deleteOne({ _id: companyId, tenantId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Company information not found or access denied" });
    }

    res.status(200).json({ message: "Company information deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting company info:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to delete company information", error: errorMessage });
  }
});

// --- Subscription Users Management API ---

// Get users for a specific subscription
router.get("/api/subscriptions/:id/users", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const { id } = req.params;
    
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    let subscriptionId;
    try {
      subscriptionId = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid subscription ID format" });
    }

    const subscription = await collection.findOne({ _id: subscriptionId, tenantId });
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found or access denied" });
    }

    // Return the users array from the subscription, or empty array if none
    res.status(200).json(subscription.users || []);
  } catch (error: unknown) {
    console.error("Error fetching subscription users:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to fetch subscription users", error: errorMessage });
  }
});

// Update users for a specific subscription
router.put("/api/subscriptions/:id/users", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const historyCollection = db.collection("history");
    const { id } = req.params;
    const { users } = req.body;
    
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    if (!Array.isArray(users)) {
      return res.status(400).json({ message: "Users must be an array" });
    }

    let subscriptionId;
    try {
      subscriptionId = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid subscription ID format" });
    }

    // Get the document before update
    const oldDoc = await collection.findOne({ _id: subscriptionId, tenantId });
    if (!oldDoc) {
      return res.status(404).json({ message: "Subscription not found or access denied" });
    }

    // Update the subscription with the new users
    const result = await collection.updateOne(
      { _id: subscriptionId, tenantId },
      { 
        $set: { 
          users: users,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Subscription not found or access denied" });
    }

    // Create history record
    await historyCollection.insertOne({
      subscriptionId,
      tenantId,
      action: "update",
      timestamp: new Date(),
      updatedFields: { users },
      serviceName: oldDoc.serviceName || oldDoc.name || "Unknown Service"
    });

    res.status(200).json({ message: "Subscription users updated successfully" });
  } catch (error: unknown) {
    console.error("Error updating subscription users:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to update subscription users", error: errorMessage });
  }
});

export default router;
