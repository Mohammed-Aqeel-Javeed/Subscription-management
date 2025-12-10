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
      tenantId: string;
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

  console.log('[COMPLIANCE REMINDER DEBUG] Generating reminders for compliance:', {
    complianceId,
    filingName: compliance.policy || compliance.filingName || compliance.complianceName || compliance.name || 'Compliance Filing',
    submissionDeadline: compliance.submissionDeadline,
    reminderDays: compliance.reminderDays,
    reminderPolicy: compliance.reminderPolicy
  });

  // Remove all old reminders for this compliance (legacy collection + new storage in compliance_notifications)
  try {
    await db.collection("reminders").deleteMany({ complianceId });
  } catch {}
  try {
    // Delete only reminder-type notifications (those without eventType or eventType === null)
    await db.collection("compliance_notifications").deleteMany({ complianceId, $or: [ { eventType: { $exists: false } }, { eventType: null } ] });
  } catch (err) {
    console.warn('[COMPLIANCE REMINDER DEBUG] Failed to prune existing reminder notifications', err);
  }

  // Use submissionDeadline as the target date for reminders
  // Normalize deadline to ISO format if provided in dd-mm-yyyy etc.
  const rawDeadline = compliance.submissionDeadline;
  const deadlineDate = normalizeDateString(rawDeadline);
  if (!deadlineDate) {
    console.log('[COMPLIANCE REMINDER DEBUG] No submissionDeadline found, skipping reminder generation');
    return;
  }

  // Use reminderDays from compliance, default to 7 if not set
  const reminderDays = Number(compliance.reminderDays) || 7;
  const reminderPolicy = compliance.reminderPolicy || "One time";

  let remindersToInsert = [];

  if (reminderPolicy === "One time") {
    const reminderDate = new Date(deadlineDate);
    if (isNaN(reminderDate.getTime())) {
      console.warn('[COMPLIANCE REMINDER DEBUG] Invalid submissionDeadline for one-time policy, raw value:', rawDeadline);
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
      console.warn('[COMPLIANCE REMINDER DEBUG] Invalid submissionDeadline for two-times policy, raw value:', rawDeadline);
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
      console.warn('[COMPLIANCE REMINDER DEBUG] Invalid submissionDeadline for until-renewal policy, raw value:', rawDeadline);
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

  console.log('[COMPLIANCE REMINDER DEBUG] Reminders to insert:', remindersToInsert);

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
    console.log('[COMPLIANCE REMINDER DEBUG] Inserting reminder as notification:', notificationDoc);
    await db.collection("compliance_notifications").insertOne(notificationDoc);
  }

  console.log('[COMPLIANCE REMINDER DEBUG] Successfully generated', remindersToInsert.length, 'reminders for compliance', complianceId);
}

async function generateRemindersForSubscription(subscription: any, tenantId: string, db: any) {
  const subscriptionId = subscription._id ? subscription._id.toString() : (typeof subscription.id === 'string' ? subscription.id : undefined);
  if (!subscriptionId) return;

  console.log('[REMINDER DEBUG] Generating reminders for subscription:', {
    subscriptionId,
    serviceName: subscription.serviceName,
    nextRenewal: subscription.nextRenewal,
    reminderDays: subscription.reminderDays,
    reminderPolicy: subscription.reminderPolicy
  });

  // Remove all old reminders for this subscription
  await db.collection("reminders").deleteMany({ subscriptionId });

  // Use nextRenewal as the target date for reminders
  const renewalDate = subscription.nextRenewal;
  if (!renewalDate) {
    console.log('[REMINDER DEBUG] No nextRenewal date found, skipping reminder generation');
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

  console.log('[REMINDER DEBUG] Reminders to insert:', remindersToInsert);

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
    console.log('[REMINDER DEBUG] Inserting reminder:', reminderDoc);
    await db.collection("reminders").insertOne(reminderDoc);
  }

  console.log('[REMINDER DEBUG] Successfully generated', remindersToInsert.length, 'reminders');
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
    console.log('POST /api/history called');
    console.log('Request body:', req.body);
    const db = await connectToDatabase();
    const historyCollection = db.collection("history");
    const { subscriptionId, action, data, updatedFields } = req.body;
    if (!subscriptionId) {
      console.log('No subscriptionId provided');
      return res.status(400).json({ message: "subscriptionId is required" });
    }
    console.log(`Creating history record for subscriptionId: ${subscriptionId}`);
    // Always store subscriptionId as ObjectId for consistency (like complianceId in ledger)
    let subscriptionObjId;
    try {
      subscriptionObjId = new ObjectId(subscriptionId);
      console.log(`Converted to ObjectId successfully: ${subscriptionObjId}`);
    } catch (err) {
      console.log('Invalid subscriptionId format:', subscriptionId);
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
  console.log('TenantId in update route:', tenantId, 'User:', req.user); // Debug log
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    // Sort by timestamp and _id for consistent ordering
    const items = await collection
      .find({ tenantId })
      .sort({ timestamp: -1, _id: -1 })
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

    console.log(`GET /api/history/${subscriptionId} - Fetching history for subscription`);

    // Try to convert to ObjectId, but don't fail if it's not a valid ObjectId
    let subObjId;
    try {
      subObjId = new ObjectId(subscriptionId);
      console.log(`Successfully converted to ObjectId: ${subObjId}`);
    } catch (err) {
      console.log(`Not a valid ObjectId, will use string comparison fallback`);
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

    console.log(`History API Debug: Requested subscriptionId: ${subscriptionId}`);
    console.log(`History API Debug: Filter used:`, filter);

    // Sort by timestamp descending (newest first)
    const items = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .toArray();

    console.log(`History API Debug: Returned ${items.length} records.`);
    items.forEach((item, idx) => {
      console.log(`Record #${idx}: _id=${item._id}, subscriptionId=${item.subscriptionId}`);
    });
    
    // If no records found with $or query, try individual queries to debug
    if (items.length === 0) {
      console.log(`No records found with combined filter, trying individual lookups for debugging:`);
      
      if (subObjId) {
        const objIdItems = await collection.find({ subscriptionId: subObjId }).toArray();
        console.log(`- Direct subscriptionId as ObjectId: ${objIdItems.length} records`);
      }
      
      const strItems = await collection.find({ subscriptionId: subscriptionId }).toArray();
      console.log(`- Direct subscriptionId as string: ${strItems.length} records`);
      
      const allItems = await collection.find({}).toArray();
      console.log(`- Total records in collection: ${allItems.length}`);
      
      if (allItems.length > 0) {
        console.log(`- Sample record structure: ${JSON.stringify(allItems[0])}`);
      }
    }
    
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
    console.log("Connected to DB:", db.databaseName); // Add this line
    const collection = db.collection("ledger");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const result = await collection.insertOne({ ...req.body, tenantId });
    console.log("Insert result:", result); // Add this line
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
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const items = await collection.find({ tenantId }).toArray();
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
          console.log(`🔄 [COMPLIANCE] Creating deletion notification event for compliance filing: ${filingName}`);
          
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
          
          console.log(`🔄 [COMPLIANCE] Attempting to insert deletion notification event:`, notificationEvent);
          const notificationResult = await db.collection("compliance_notifications").insertOne(notificationEvent);
          console.log(`✅ [COMPLIANCE] Deletion notification event created successfully with ID: ${notificationResult.insertedId}`);
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
      console.log(`🔄 [COMPLIANCE] Generating reminders for compliance filing: ${complianceData.filingName || complianceData.complianceName || complianceData.name || 'Unnamed Filing'}`);
      await generateRemindersForCompliance(createdCompliance, tenantId, db);
      console.log(`✅ [COMPLIANCE] Reminders generated successfully for compliance ${result.insertedId}`);
    } catch (reminderError) {
      console.error(`❌ [COMPLIANCE] Failed to generate reminders:`, reminderError);
      // Don't throw - let compliance creation succeed even if reminder generation fails
    }
    
    // Create notification event for compliance creation
    try {
      console.log(`🔄 [COMPLIANCE] Creating notification event for compliance filing: ${complianceData.complianceName || complianceData.name || 'Unnamed Filing'}`);
      
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
      
      console.log(`🔄 [COMPLIANCE] Attempting to insert notification event:`, notificationEvent);
      const notificationResult = await db.collection("compliance_notifications").insertOne(notificationEvent);
      console.log(`✅ [COMPLIANCE] Notification event created successfully with ID: ${notificationResult.insertedId}`);
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
          console.log(`🔄 [COMPLIANCE] Regenerating reminders for updated compliance filing: ${complianceName}`);
          await generateRemindersForCompliance(updatedDoc, tenantId, db);
          console.log(`✅ [COMPLIANCE] Reminders regenerated successfully for compliance ${id}`);
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
          console.log(`🔄 [COMPLIANCE] Creating update notification event for compliance filing (significant changes): ${complianceName}`);
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
          console.log(`✅ [COMPLIANCE] Update notification event created (significant) with ID: ${notificationResult.insertedId}`);
        } else {
          console.log('[COMPLIANCE] Skipping update notification event (no significant field changes)');
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
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    
    // Import decryption function
    const { decryptSubscriptionData } = await import("./encryption.service.js");
    
    const subscriptions = await collection.find({ tenantId }).toArray();
    
    // Transform MongoDB documents to have consistent id field AND decrypt sensitive data
    const transformedSubscriptions = subscriptions.map(sub => {
      const decrypted = decryptSubscriptionData(sub);
      return {
        ...decrypted,
        id: sub._id?.toString(), // Add id field from _id
        _id: sub._id?.toString()  // Convert _id to string
      };
    });
    
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
    
    // Get subscription data before deleting for notification event
    const subscriptionToDelete = await collection.findOne(filter);
    
    // Decrypt subscription data for notification
    let decryptedSubscription = subscriptionToDelete;
    if (subscriptionToDelete) {
      const { decryptSubscriptionData } = await import("./encryption.service.js");
      decryptedSubscription = decryptSubscriptionData(subscriptionToDelete);
    }
    
    const result = await collection.deleteOne(filter);
    if (result.deletedCount === 1) {
      // Create notification event for subscription deletion
      if (decryptedSubscription) {
        try {
          console.log(`🔄 [SUBTRACKERR] Creating deletion notification event for subscription: ${decryptedSubscription.serviceName}`);
          
          const notificationEvent = {
            _id: new ObjectId(),
            tenantId,
            type: 'subscription',
            eventType: 'deleted',
            subscriptionId: id,
            subscriptionName: decryptedSubscription.serviceName,
            category: decryptedSubscription.category || 'Software',
            message: `Subscription ${decryptedSubscription.serviceName} deleted`,
            read: false,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reminderTriggerDate: new Date().toISOString().slice(0, 10)
          };
          
          console.log(`🔄 [SUBTRACKERR] Attempting to insert deletion notification event:`, notificationEvent);
          const notificationResult = await db.collection("notification_events").insertOne(notificationEvent);
          console.log(`✅ [SUBTRACKERR] Deletion notification event created successfully with ID: ${notificationResult.insertedId}`);
        } catch (notificationError) {
          console.error(`❌ [SUBTRACKERR] Failed to create deletion notification event for ${decryptedSubscription?.serviceName}:`, notificationError);
          // Don't throw - let deletion succeed even if notification fails
        }
      }
      
      // Cascade delete reminders for this subscription
      await db.collection("reminders").deleteMany({ $or: [ { subscriptionId: id }, { subscriptionId: new ObjectId(id) } ] });
      res.status(200).json({ message: "Subscription and related reminders deleted" });
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
    console.log('[HISTORY DEBUG] Inserting history record:', JSON.stringify(historyRecord, null, 2));
    await historyCollection.insertOne(historyRecord);

    // Create notification event for subscription creation
    try {
      console.log(`🔄 [SUBTRACKERR] Creating notification event for subscription: ${subscription.serviceName}`);
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
      
      console.log(`🔄 [SUBTRACKERR] Attempting to insert notification event:`, notificationEvent);
      const notificationResult = await db.collection("notification_events").insertOne(notificationEvent);
      console.log(`✅ [SUBTRACKERR] Notification event created successfully with ID: ${notificationResult.insertedId}`);
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
    console.log('Update route tenantId:', tenantId, 'User:', req.user); // Debug log
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
    
    const update = { 
      $set: { 
        ...encryptedPayload,
        status: req.body.status || oldDoc.status, // Preserve status if not provided
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
            _id: subscriptionId
          },
          action: "update",
          timestamp: new Date(),
          serviceName: updatedDoc?.serviceName  // Add serviceName for easier querying
        };
        console.log('Attempting to insert history record:', JSON.stringify(historyRecord, null, 2));
        try {
          const historyResult = await historyCollection.insertOne(historyRecord);
          console.log('History insert result:', historyResult);
        } catch (err) {
          console.error('Error inserting history record:', err);
        }
      } else {
        console.log('No changes detected, skipping history record creation');
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
  try {
    const db = await connectToDatabase();
    const collection = db.collection("users");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const user = {
      ...req.body,
      tenantId
    };
    // Optionally validate other fields here
    const result = await collection.insertOne(user);
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add user", error });
  }
});

// Update a user
router.put("/api/users/:_id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("users");
    const { _id } = req.params;
    const user = req.body;
    let filter;
    try {
      filter = { _id: new EmployeeObjectId(_id) };
    } catch {
      return res.status(400).json({ message: "Invalid user _id" });
    }
    const update = { $set: user };
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
  console.log(`[COMPLIANCE NOTIFICATIONS] Returning ${filteredEvents.length} events + ${filteredReminders.length} reminders = ${allNotifications.length} total (filtered). Skipped ${updateEventsSkipped} update events.`);
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
    
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }

    const licenses = await collection.find({ tenantId }).sort({ createdAt: -1 }).toArray();
    
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
