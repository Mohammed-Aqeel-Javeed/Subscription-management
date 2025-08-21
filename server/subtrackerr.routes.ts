// --- History API ---
// List all history records


import { ObjectId } from "mongodb";
// --- Payment Methods API ---
const PaymentObjectId = ObjectId;
// List all payment methods
// --- Employees API ---
const EmployeeObjectId = ObjectId;
// --- Ledger API ---
const LedgerObjectId = ObjectId;


import { Router, Request, Response, NextFunction } from "express";
import { connectToDatabase } from "./mongo";
import jwt from "jsonwebtoken";
import type { User } from "./types";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

const router = Router();

// JWT middleware to set req.user and req.user.tenantId
router.use((req: Request, res: Response, next: NextFunction) => {
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
router.post("/api/history", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const historyCollection = db.collection("history");
    const { subscriptionId, action, data, updatedFields } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ message: "subscriptionId is required" });
    }

    console.log(`Creating history record for subscriptionId: ${subscriptionId}`);

    // Always store subscriptionId as ObjectId for consistency (like complianceId in ledger)
    let subscriptionObjId;
    try {
      subscriptionObjId = new ObjectId(subscriptionId);
      console.log(`Converted to ObjectId successfully: ${subscriptionObjId}`);
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
router.get("/api/history/list", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("history");
    
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    // Sort by timestamp and _id for consistent ordering
    const items = await collection
      .find({ tenantId })
      .sort({ timestamp: -1, _id: -1 })
      .toArray();

    // Convert all IDs to strings for consistency
    const processed = items.map((item: any) => ({
      ...item,
      _id: item._id?.toString(),
      subscriptionId: item.subscriptionId?.toString(),
      data: item.data ? {
        ...item.data,
        _id: item.data._id?.toString()
      } : undefined,
      updatedFields: item.updatedFields ? {
        ...item.updatedFields,
        _id: item.updatedFields._id?.toString()
      } : undefined
    }));

      res.status(200).json(processed);
    } catch (error: unknown) {
      console.error("History list error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ message: "Failed to fetch history records", error: errorMessage });
    }
  }); // <-- Add this closing brace to properly end the route handler

// Get history for a specific subscription
router.get("/api/history/:subscriptionId", async (req: Request, res: Response) => {
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
    
    // Convert IDs to strings for the frontend
    const processedItems = items.map((item: any) => ({
      ...item,
      _id: item._id.toString(),
      subscriptionId: item.subscriptionId?.toString ? item.subscriptionId.toString() : item.subscriptionId,
      data: item.data ? {
        ...item.data,
        _id: item.data._id?.toString ? item.data._id.toString() : item.data._id
      } : undefined,
      updatedFields: item.updatedFields ? {
        ...item.updatedFields,
        _id: item.updatedFields._id?.toString ? item.updatedFields._id.toString() : item.updatedFields._id
      } : undefined
    }));

    res.status(200).json(processedItems);
  } catch (error: unknown) {
    console.error("History fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to fetch history records", error: errorMessage });
  }
});


router.get("/api/payment", async (req: Request, res: Response) => {
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
router.post("/api/payment", async (req: Request, res: Response) => {
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
router.put("/api/payment/:id", async (req: Request, res: Response) => {
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
router.delete("/api/payment/:id", async (req: Request, res: Response) => {
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
router.get("/api/ledger/list", async (req: Request, res: Response) => {
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
router.post("/api/ledger/insert", async (req: Request, res: Response) => {
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
router.delete("/api/ledger/:id", async (req: Request, res: Response) => {
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
router.get("/api/compliance/list", async (req: Request, res: Response) => {
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
router.delete("/api/compliance/:id", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("compliance");
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "Compliance filing deleted" });
    } else {
      res.status(404).json({ message: "Compliance filing not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete compliance filing", error });
  }
});

// Save a compliance filing to the database
router.post("/api/compliance/insert", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("compliance");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const result = await collection.insertOne({ ...req.body, tenantId });
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to save compliance data", error });
  }
});

// Edit (update) a compliance filing in the database
router.put("/api/compliance/:id", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("compliance");
    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    if (result.matchedCount === 1) {
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
router.get("/api/subscriptions", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    // Multi-tenancy: filter by tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    const subscriptions = await collection.find({ tenantId }).toArray();
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subscriptions", error });
  }
});

// Delete a subscription and its reminders
router.delete("/api/subtrackerr/:id", async (req: Request, res: Response) => {
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

// --- Category API ---
// List all categories
router.get("/api/company/categories", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("categories");
    const items = await collection.find({}).toArray();
    // Only return categories with valid, non-empty names
    const categories = items
      .filter((item: any) => typeof item.name === "string" && item.name.trim())
      .map((item: any) => ({
        name: item.name,
        visible: typeof item.visible === "boolean" ? item.visible : true
      }));
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories", error });
  }
});
// Add a new category
router.post("/api/company/categories", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("categories");
    let { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Category name required" });
    }
    name = name.trim();
    // Prevent duplicate category names
    const exists = await collection.findOne({ name });
    if (exists) {
      return res.status(409).json({ message: "Category already exists" });
    }
    const result = await collection.insertOne({ name, visible: true });
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add category", error });
  }
});
// Delete a category by name
router.delete("/api/company/categories/:name", async (req: Request, res: Response) => {
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
router.get("/api/company/departments", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("departments");
    const items = await collection.find({}).toArray();
    // Only return departments with valid, non-empty names
    const departments = items
      .filter(item => typeof item.name === "string" && item.name.trim())
      .map(item => ({
        name: item.name,
        visible: typeof item.visible === "boolean" ? item.visible : true
      }));
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch departments", error });
  }
});

// Add a new department
router.post("/api/company/departments", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("departments");
    let { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Department name required" });
    }
    name = name.trim();
    // Prevent duplicate department names
    const exists = await collection.findOne({ name });
    if (exists) {
      return res.status(409).json({ message: "Department already exists" });
    }
    const result = await collection.insertOne({ name, visible: true });
    res.status(201).json({ insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to add department", error });
  }
});

// Update department visibility
router.patch("/api/company/departments/:name", async (req: Request, res: Response) => {
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
router.delete("/api/company/departments/:name", async (req: Request, res: Response) => {
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
router.post("/api/subscriptions", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const historyCollection = db.collection("history");
    // Multi-tenancy: set tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
    // Prepare subscription document with timestamps and tenantId
    const subscription = {
      ...req.body,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    // Create the subscription
    const result = await collection.insertOne(subscription);
    const subscriptionId = result.insertedId;
    // Get the complete subscription document
    const createdSubscription = await collection.findOne({ _id: subscriptionId });
    // Create history record
    const historyRecord = {
      subscriptionId: subscriptionId,  // Store as ObjectId
      data: {
        ...createdSubscription,
        _id: subscriptionId
      },
      action: "create",
      timestamp: new Date(),
      serviceName: subscription.serviceName  // Add serviceName for easier querying
    };
    await historyCollection.insertOne(historyRecord);
    res.status(201).json({ 
      message: "Subscription created",
      subscription: createdSubscription 
    });
  } catch (error: unknown) {
    console.error("Creation error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: "Failed to create subscription", error: errorMessage });
  }
});
// Note: Duplicate route was removed here. The route is defined earlier in the file.


// Update an existing subscription
router.put("/api/subscriptions/:id", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("subscriptions");
    const historyCollection = db.collection("history");
    const { id } = req.params;
    // Multi-tenancy: only allow update for current tenant
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ message: "Missing tenantId in user context" });
    }
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
    const update = { 
      $set: { 
        ...req.body,
        tenantId, // Always preserve tenantId
        status: req.body.status || oldDoc.status, // Preserve status if not provided
        updatedAt: new Date()  // Add updatedAt timestamp
      } 
    };
    const result = await collection.updateOne({ _id: subscriptionId, tenantId }, update);
    if (result.matchedCount === 1) {
      // Get the updated document
      const updatedDoc = await collection.findOne({ _id: subscriptionId, tenantId });
      // Create history record
      const historyRecord = {
        subscriptionId: subscriptionId,  // Store as ObjectId
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
      await historyCollection.insertOne(historyRecord);
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
router.get("/api/employees", async (req: Request, res: Response) => {
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
router.post("/api/employees", async (req: Request, res: Response) => {
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
router.put("/api/employees/:id", async (req: Request, res: Response) => {
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
router.delete("/api/employees/:id", async (req: Request, res: Response) => {
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
router.post("/api/users", async (req: Request, res: Response) => {
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
router.put("/api/users/:_id", async (req: Request, res: Response) => {
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
router.post("/api/config/fields", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("config");
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ message: "Fields must be an array" });
    }
    // Upsert a single config document for fields
    await collection.updateOne(
      { key: "subscriptionFields" },
      { $set: { key: "subscriptionFields", fields } },
      { upsert: true }
    );
    res.status(200).json({ message: "Fields saved" });
  } catch (error) {
    res.status(500).json({ message: "Failed to save fields", error });
  }
});

// Get enabled fields
router.get("/api/config/fields", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("config");
    const doc = await collection.findOne({ key: "subscriptionFields" });
    res.status(200).json(doc?.fields || []);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch fields", error });
  }
});

// --- Compliance Fields Configuration API ---
// Save compliance field
router.post("/api/config/compliance-fields", async (req: Request, res: Response) => {
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
router.get("/api/config/compliance-fields", async (req: Request, res: Response) => {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("Fields"); // Changed to Fields collection
    const fields = await collection.find({ fieldType: "compliance" }).sort({ displayOrder: 1 }).toArray();
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
router.patch("/api/config/compliance-fields/:id", async (req: Request, res: Response) => {
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

export default router;
