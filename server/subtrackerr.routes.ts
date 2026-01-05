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

  // Use submissionDeadline as the target date for reminders
  // Normalize deadline to ISO format if provided in dd-mm-yyyy etc.
  const rawDeadline = compliance.submissionDeadline;
  const deadlineDate = normalizeDateString(rawDeadline);
  if (!deadlineDate) {
    return;
  }

  // Use reminderDays from compliance, default to 7 if not set
  const reminderDays = Number(compliance.reminderDays) || 7;
  const reminderPolicy = compliance.reminderPolicy || "One time";

  let remindersToInsert = [];

  if (reminderPolicy === "One time") {
    const reminderDate = new Date(deadlineDate);
    if (isNaN(reminderDate.getTime())) {
      return;
    }
    reminderDate.setDate(reminderDate.getDate() - reminderDays);
    remindersToInsert.push({
      type: `Before ${reminderDays} days`,
      date: reminderDate.toISOString().slice(0, 10),
    });
  } else if (reminderPolicy === "Two times") {
    const firstDate = new Date(deadlineDate);
    if (isNaN(firstDate.getTime())) {
      return;
    }
    firstDate.setDate(firstDate.getDate() - reminderDays);
    const secondDays = Math.floor(reminderDays / 2);
    const secondDate = new Date(deadlineDate);
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
    const startDate = new Date(deadlineDate);
    if (isNaN(startDate.getTime())) {
      return;
    }
    startDate.setDate(startDate.getDate() - reminderDays);
    let current = new Date(startDate);
    const end = new Date(deadlineDate);
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
      sent: false,
      status: compliance.status || "Active",
      createdAt: new Date(),
      tenantId,
      type: 'compliance',
      filingName: compliance.policy || compliance.filingName || compliance.complianceName || compliance.name || 'Compliance Filing',
      complianceCategory: compliance.category || compliance.complianceCategory || undefined,
      submissionDeadline: deadlineDate // Add submission deadline for frontend display
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
  const renewalDate = subscription.nextRenewal;
  if (!renewalDate) {
    return;
  }

  // Use reminderDays from subscription, default to 7 if not set
  const reminderDays = Number(subscription.reminderDays) || 7;
  const reminderPolicy = subscription.reminderPolicy || "One time";

  let remindersToInsert = [];

  if (reminderPolicy === "One time") {
    const reminderDate = new Date(renewalDate);
    reminderDate.setDate(reminderDate.getDate() - reminderDays);
    remindersToInsert.push({
      type: `Before ${reminderDays} days`,
      date: reminderDate.toISOString().slice(0, 10),
    });
  } else if (reminderPolicy === "Two times") {
    const firstDate = new Date(renewalDate);
    firstDate.setDate(firstDate.getDate() - reminderDays);
    const secondDays = Math.floor(reminderDays / 2);
    const secondDate = new Date(renewalDate);
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
    // Daily reminders from (renewalDate - reminderDays) to renewalDate
    const startDate = new Date(renewalDate);
    startDate.setDate(startDate.getDate() - reminderDays);
    let current = new Date(startDate);
    const end = new Date(renewalDate);
    while (current <= end) {
      remindersToInsert.push({
        type: `Daily`,
        date: current.toISOString().slice(0, 10),
      });
      current.setDate(current.getDate() + 1);
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
    const { decryptSubscriptionData } = await import("./encryption.service.js");

    // Decrypt and convert all IDs to strings for consistency
    const processed = items.map(item => ({
      ...item,
      _id: item._id?.toString(),
      subscriptionId: item.subscriptionId?.toString(),
      data: item.data ? decryptSubscriptionData({
        ...item.data,
        _id: item.data._id?.toString()
      }) : undefined,
      updatedFields: item.updatedFields ? decryptSubscriptionData({
        ...item.updatedFields,
        _id: item.updatedFields._id?.toString()
      }) : undefined
    }));

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
    const { decryptSubscriptionData } = await import("./encryption.service.js");

    // Decrypt and convert IDs to strings for the frontend
    const processedItems = items.map(item => ({
      ...item,
      _id: item._id.toString(),
      subscriptionId: item.subscriptionId?.toString ? item.subscriptionId.toString() : item.subscriptionId,
      data: item.data ? decryptSubscriptionData({
        ...item.data,
        _id: item.data._id?.toString ? item.data._id.toString() : item.data._id
      }) : undefined,
      updatedFields: item.updatedFields ? decryptSubscriptionData({
        ...item.updatedFields,
        _id: item.updatedFields._id?.toString ? item.updatedFields._id.toString() : item.updatedFields._id
      }) : undefined
    }));

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
    const result = await collection.insertOne({ ...req.body, tenantId });
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
    const normalizedSubmissionDeadline = normalizeDateString(req.body.submissionDeadline);
    const normalizedStart = normalizeDateString(req.body.lastAudit || req.body.startDate);
    const normalizedEnd = normalizeDateString(req.body.endDate);

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
    
    // Create notification event for compliance creation
    try {
const filingName = complianceData.policy || complianceData.filingName || complianceData.complianceName || complianceData.name || 'Compliance Filing';
      const notificationEvent = {
        _id: new ObjectId(),
        tenantId,
        type: 'compliance',
        eventType: 'created',
        complianceId: result.insertedId.toString(),
        complianceName: filingName,
        filingName: filingName,
        category: complianceData.complianceCategory || complianceData.category || 'General',
        message: `Compliance filing ${filingName} created`,
        read: false,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        reminderTriggerDate: new Date().toISOString().slice(0, 10)
      };
const notificationResult = await db.collection("compliance_notifications").insertOne(notificationEvent);
} catch (notificationError) {
      console.error(`❌ [COMPLIANCE] Failed to create notification event:`, notificationError);
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
    
    const updateData = { ...req.body, updatedAt: new Date() };
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
}
      } catch (reminderError) {
        console.error(`❌ [COMPLIANCE] Failed to regenerate reminders:`, reminderError);
        // Don't throw - let compliance update succeed even if reminder generation fails
      }
      
      // Create notification event for compliance update ONLY if important fields changed (deadline / reminder settings / status)
      try {
        const importantFields = ['submissionDeadline','reminderDays','reminderPolicy','status'];
        const changedImportant = importantFields.some(f => String(oldDoc?.[f] ?? '') !== String(updateData?.[f] ?? ''));
        if (changedImportant) {
          const complianceName = updateData.policy || updateData.filingName || updateData.complianceName || updateData.name || oldDoc?.policy || oldDoc?.filingName || oldDoc?.complianceName || oldDoc?.name || 'Compliance Filing';
const notificationEvent = {
            _id: new ObjectId(),
            tenantId: req.user?.tenantId,
            type: 'compliance',
            eventType: 'updated',
            complianceId: id,
            complianceName: complianceName,
            filingName: complianceName,
            category: updateData.complianceCategory || updateData.category || oldDoc?.complianceCategory || oldDoc?.category || 'General',
            message: `Compliance filing ${complianceName} updated`,
            read: false,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reminderTriggerDate: new Date().toISOString().slice(0, 10)
          };
          const notificationResult = await db.collection("compliance_notifications").insertOne(notificationEvent);
} else {
}
      } catch (notificationError) {
        console.error(`❌ [COMPLIANCE] Failed to create conditional update notification event:`, notificationError);
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
    // Disable caching for role-based filtering
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
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
    
    // Import decryption function
    const { decryptSubscriptionData } = await import("./encryption.service.js");
    
    let subscriptions = await collection.find({ tenantId }).toArray();
// Apply role-based filtering
    if (userRole === 'contributor') {
      // Contributors can only see items where they are the owner (match by email)
      const userEmail = req.user?.email;
      subscriptions = subscriptions.filter(sub => {
        const isOwner = sub.ownerEmail === userEmail || sub.owner === userId;
return isOwner;
      });
} else if (userRole === 'department_editor' || userRole === 'department_viewer') {
      // Department roles can only see items in their department OR Company Level items
      console.log(`[Department Filter] User: ${req.user?.email}, Role: ${userRole}, Department: ${userDepartment}`);
      console.log(`[Department Filter] Total subscriptions before filter: ${subscriptions.length}`);
      
      if (userDepartment) {
        subscriptions = subscriptions.filter(sub => {
          if (!sub.department && !sub.departments) {
            console.log(`[Department Filter] ${sub.serviceName}: No department field - EXCLUDED`);
            return false;
          }
          
          try {
            // Try parsing department field (JSON string)
            let depts = [];
            if (sub.department) {
              depts = JSON.parse(sub.department);
            } else if (sub.departments) {
              depts = Array.isArray(sub.departments) ? sub.departments : [sub.departments];
            }
            
            // Allow access if:
            // 1. Subscription has "Company Level" in departments
            // 2. User's department is in the subscription's departments
            const hasCompanyLevel = Array.isArray(depts) && depts.includes('Company Level');
            const hasUserDepartment = Array.isArray(depts) && depts.includes(userDepartment);
            
            console.log(`[Department Filter] ${sub.serviceName}: depts=${JSON.stringify(depts)}, hasCompanyLevel=${hasCompanyLevel}, hasUserDept=${hasUserDepartment}, result=${hasCompanyLevel || hasUserDepartment}`);
            
            return hasCompanyLevel || hasUserDepartment;
          } catch {
            // Fallback for non-JSON department field
            const hasAccess = sub.department === userDepartment || sub.department === 'Company Level';
            return hasAccess;
          }
        });
        
        console.log(`[Department Filter] Subscriptions after filter: ${subscriptions.length}`);
      }
    }
    
    // Transform MongoDB documents to have consistent id field AND decrypt sensitive data
    const transformedSubscriptions = subscriptions.map(sub => {
      const decrypted = decryptSubscriptionData(sub);
      return {
        ...decrypted,
        id: sub._id?.toString(), // Add id field from _id
        _id: sub._id?.toString()  // Convert _id to string
      };
    });
    
    console.log(`[Department Filter] Final response: ${transformedSubscriptions.length} subscriptions`);
    res.status(200).json(transformedSubscriptions);
  } catch (error) {
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
          
          // Create notification event (optional, don't block on this)
          const subscriptionData = await collection.findOne(filter);
          if (subscriptionData) {
            const { decryptSubscriptionData } = await import("./encryption.service.js");
            const decrypted = decryptSubscriptionData(subscriptionData);
            
            await db.collection("notification_events").insertOne({
              _id: new ObjectId(),
              tenantId,
              type: 'subscription',
              eventType: 'deleted',
              subscriptionId: id,
              subscriptionName: decrypted.serviceName,
              category: decrypted.category || 'Software',
              message: `Subscription ${decrypted.serviceName} deleted`,
              read: false,
              timestamp: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              reminderTriggerDate: new Date().toISOString().slice(0, 10)
            });
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
    const { code } = req.params;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
    const result = await collection.deleteOne({ code: code.toUpperCase(), tenantId });
    
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
    const name = req.params.name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Category name required" });
    }
    // Case-insensitive and trimmed match
    const result = await collection.deleteOne({ name: { $regex: `^${name.trim()}$`, $options: "i" } });
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
    
    // Prevent duplicate department names within the same tenant
    const exists = await collection.findOne({ name, tenantId });
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
    
    // Get the old department data to check if email/head changed
    const oldDepartment = await collection.findOne({ _id: new (require('mongodb').ObjectId)(id), tenantId });
    
    const result = await collection.updateOne(
      { _id: new (require('mongodb').ObjectId)(id), tenantId },
      { $set: { name: name.trim(), departmentHead: validDepartmentHead, email: validEmail } }
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
    const result = await collection.updateOne({ name }, { $set: { visible } });
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
    const name = req.params.name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Department name required" });
    }
    // Case-insensitive and trimmed match
    const result = await collection.deleteOne({ name: { $regex: `^${name.trim()}$`, $options: "i" } });
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
    
    // Prepare subscription document with timestamps and tenantId
    const subscription = {
      ...req.body,
      tenantId,
      initialDate: req.body.initialDate || req.body.startDate, // Set initialDate to startDate if not provided
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // ENCRYPT sensitive data before storing
    const encryptedSubscription = encryptSubscriptionData(subscription);
    
    // Create the subscription with encrypted data
    const result = await collection.insertOne(encryptedSubscription);
    const subscriptionId = result.insertedId;
    // Get the complete subscription document
    const createdSubscription = await collection.findOne({ _id: subscriptionId });
    // Create history record
    const historyRecord = {
      subscriptionId: subscriptionId,  // Store as ObjectId
      tenantId, // Always include tenantId for filtering
      data: {
        ...createdSubscription,
        _id: subscriptionId
      },
      action: "create",
      timestamp: new Date(),
      serviceName: subscription.serviceName  // Add serviceName for easier querying
    };
await historyCollection.insertOne(historyRecord);

    // Create notification event for subscription creation
    try {
const { ObjectId } = await import("mongodb");
      
      const notificationEvent = {
        _id: new ObjectId(),
        tenantId,
        type: 'subscription',
        eventType: 'created',
        subscriptionId: subscriptionId.toString(),
        subscriptionName: subscription.serviceName,
        category: subscription.category || 'Software',
        message: `Subscription ${subscription.serviceName} created`,
        read: false,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        reminderTriggerDate: new Date().toISOString().slice(0, 10)
      };
const notificationResult = await db.collection("notification_events").insertOne(notificationEvent);
} catch (notificationError) {
      console.error(`❌ [SUBTRACKERR] Failed to create notification event for ${subscription.serviceName}:`, notificationError);
      // Don't throw - let subscription creation succeed even if notification fails
    }

    // Generate reminders for the new subscription
    await generateRemindersForSubscription(createdSubscription, tenantId, db);

    res.status(201).json({ 
      message: "Subscription created",
      _id: subscriptionId,
      subscription: createdSubscription 
    });
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

    // Prepare draft subscription document
    const draftSubscription = {
      ...req.body,
      tenantId,
      isDraft: true,
      status: "Draft",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create the draft subscription (no reminders or notifications for drafts)
    const result = await collection.insertOne(draftSubscription);
    const subscriptionId = result.insertedId;

    // Get the complete draft subscription document
    const createdDraft = await collection.findOne({ _id: subscriptionId });

    res.status(201).json({ 
      message: "Draft saved successfully",
      _id: subscriptionId,
      subscription: createdDraft 
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

      // Update reminders for the subscription
      await generateRemindersForSubscription(updatedDoc, tenantId, db);

      res.status(200).json({ 
        message: "Subscription updated",
        subscription: updatedDoc
      });
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
    const { id } = req.params;
    let filter;
    try {
      filter = { _id: new EmployeeObjectId(id) };
    } catch {
      return res.status(400).json({ message: "Invalid employee id" });
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
    const updateData = req.body;
    const tenantId = req.user?.tenantId;
    
    // Check if email is being updated and already exists (excluding current user)
    if (updateData.email) {
      const existingEmail = await collection.findOne({ 
        email: updateData.email, 
        tenantId,
        _id: { $ne: new EmployeeObjectId(_id) }
      });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
    }
    
    // Check if name is being updated and already exists (excluding current user)
    if (updateData.name) {
      const existingName = await collection.findOne({ 
        fullName: updateData.name, 
        tenantId,
        _id: { $ne: new EmployeeObjectId(_id) }
      });
      if (existingName) {
        return res.status(400).json({ message: "User name already exists" });
      }
    }
    
    // If password is being updated, hash it
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    let filter;
    try {
      filter = { _id: new EmployeeObjectId(_id) };
    } catch {
      return res.status(400).json({ message: "Invalid user _id" });
    }
    const update = { $set: updateData };
    const result = await collection.updateOne(filter, update);
    if (result.matchedCount === 1) {
      res.status(200).json({ message: "User updated" });
    } else {
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
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
  // Fetch compliance event notifications (created, deleted) and reminder notifications (no eventType)
  const rawNotifications = await db.collection("compliance_notifications").find({ tenantId }).sort({ createdAt: -1 }).toArray();
  const eventNotifications = rawNotifications.filter(n => n.eventType === 'created' || n.eventType === 'deleted');
  const updateEventsSkipped = rawNotifications.filter(n => n.eventType === 'updated').length;
    
    // Fetch compliance reminders and transform them to notification format
    const complianceReminders = rawNotifications.filter(n => !n.eventType); // now stored in same collection
    
    // Transform reminders to notification format
    const reminderNotifications = complianceReminders.map(reminder => ({
      _id: reminder._id,
      tenantId: reminder.tenantId,
      type: 'compliance',
      // No eventType for reminders (distinguishes from event notifications)
      complianceId: reminder.complianceId,
      complianceName: reminder.filingName,
      filingName: reminder.filingName,
      category: reminder.complianceCategory || 'General',
      message: `Your ${reminder.filingName || 'compliance filing'} submission deadline is approaching. Please review and submit your compliance filing on time.`,
      read: false,
      timestamp: reminder.createdAt ? reminder.createdAt.toISOString() : new Date().toISOString(),
      createdAt: reminder.createdAt ? reminder.createdAt.toISOString() : new Date().toISOString(),
      reminderTriggerDate: reminder.reminderDate,
      submissionDeadline: reminder.submissionDeadline || undefined,
      reminderType: reminder.reminderType
    }));
    
  // Filter out static/demo notifications (filingName === 'Compliance Filing')
  const filteredEvents = eventNotifications.filter(n => n.filingName && n.filingName !== 'Compliance Filing');
  const filteredReminders = reminderNotifications.filter(n => n.filingName && n.filingName !== 'Compliance Filing');
  const allNotifications = [...filteredEvents, ...filteredReminders];
  allNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
res.status(200).json(allNotifications);
  } catch (error) {
    console.error('[COMPLIANCE NOTIFICATIONS] Error:', error);
    res.status(500).json({ message: "Failed to fetch compliance notifications", error });
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

    const result = await collection.updateOne(
      { _id: licenseId, tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "License not found or access denied" });
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
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    let licenseId;
    try {
      licenseId = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid license ID format" });
    }

    const result = await collection.deleteOne({ _id: licenseId, tenantId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "License not found or access denied" });
    }

    res.status(200).json({ message: "License deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting license:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to delete license", error: errorMessage });
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
