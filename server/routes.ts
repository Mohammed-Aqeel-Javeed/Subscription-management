import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectId } from "mongodb";
import { insertUserSchema, insertSubscriptionSchema, insertReminderSchema } from "@shared/schema";
import { z } from "zod";
import subtrackerrRouter from "./subtrackerr.routes";
import analyticsRouter from "./analytics.routes";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import cors from "cors";

export async function registerRoutes(app: Express): Promise<Server> {
  // Logout route - clears JWT cookie
  app.post("/api/logout", (req, res) => {
    res.cookie("token", "", {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires: new Date(0) // Expire immediately
    });
    res.status(200).json({ message: "Logout successful" });
  });
  app.use(cookieParser());
  // Allow credentials in CORS for frontend cookie access
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? "https://subscription-management-uhzp.vercel.app" 
      : "http://localhost:5000",
    credentials: true
  }));
  // Signup route - saves to signup collection
  app.post("/api/signup", async (req, res) => {
    try {
      const { fullName, email, password, tenantId } = req.body;
      if (!fullName || !email || !password || !tenantId) {
        return res.status(400).json({ message: "Missing required fields (fullName, email, password, tenantId)" });
      }
  const db = await storage["getDb"]();
  const doc = { fullName, email, password, tenantId, createdAt: new Date() };
  await db.collection("signup").insertOne(doc);
  // Also store credentials in login collection for immediate login
  await db.collection("login").insertOne(doc);
  res.status(201).json({ message: "Signup successful" });
    } catch (err) {
      res.status(500).json({ message: "Failed to save signup" });
    }
  });

  // Login route - saves to login collection
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const db = await storage["getDb"]();
      const user = await db.collection("login").findOne({ email, password });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
        // Include tenantId in JWT payload for multi-tenancy
        const tokenPayload: any = { userId: user._id, email: user.email };
        if (user.tenantId) {
          tokenPayload.tenantId = user.tenantId;
        }
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "subs_secret_key", { expiresIn: "7d" });
      res.cookie("token", token, {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/"
        // No maxAge: session cookie, deleted when browser/tab closes
      });
      res.status(200).json({ message: "Login successful" });
    } catch (err) {
      res.status(500).json({ message: "Login failed" });
    }
  });
  // Delete a notification/reminder by id
  app.delete("/api/notifications/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const deleted = await storage.deleteReminder(id);
      if (deleted) {
        res.status(200).json({ success: true });
      } else {
        res.status(404).json({ success: false, message: "Notification not found" });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: "Error deleting notification" });
    }
  });
  // Register MongoDB Subtrackerr routes
  app.use(subtrackerrRouter);
  // Register analytics routes
  app.use(analyticsRouter);
  // Users routes
  app.get("/api/users", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const users = await storage.getUsers(tenantId);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const user = await storage.getUser(id, tenantId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData, tenantId);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const userData = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(id, userData, tenantId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const deleted = await storage.deleteUser(id, tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Subscriptions routes
  app.get("/api/subscriptions", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const subscriptions = await storage.getSubscriptions(tenantId);
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.get("/api/subscriptions/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const subscription = await storage.getSubscription(id, tenantId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.post("/api/subscriptions", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      let subscriptionData = insertSubscriptionSchema.parse(req.body);
      // Ensure amount is a number
      if (typeof subscriptionData.amount !== "number") {
        subscriptionData.amount = parseFloat(subscriptionData.amount);
      }
      const subscription = await storage.createSubscription(subscriptionData, tenantId);
      res.status(201).json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid subscription data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.put("/api/subscriptions/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      let subscriptionData = insertSubscriptionSchema.partial().parse(req.body);
      // Ensure amount is a number
      if (typeof subscriptionData.amount !== "number") {
        subscriptionData.amount = parseFloat(subscriptionData.amount);
      }
      const subscription = await storage.updateSubscription(id, subscriptionData, tenantId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid subscription data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  app.delete("/api/subscriptions/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const deleted = await storage.deleteSubscription(id, tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      // Cascade delete reminders/notifications for this subscription
      const db = await storage["getDb"]();
      let objectId;
      try {
        objectId = new ObjectId(id);
      } catch {
        objectId = id;
      }
      await db.collection("reminders").deleteMany({ subscriptionId: objectId });
      await db.collection("notifications").deleteMany({ subscriptionId: objectId });
      res.json({ message: "Subscription and related reminders/notifications deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete subscription" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/dashboard", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const metrics = await storage.getDashboardMetrics(tenantId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get("/api/analytics/trends", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const trends = await storage.getSpendingTrends(tenantId);
      res.json(trends);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch spending trends" });
    }
  });

  app.get("/api/analytics/categories", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const categories = await storage.getCategoryBreakdown(tenantId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category breakdown" });
    }
  });

  app.get("/api/analytics/activity", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const activity = await storage.getRecentActivity(tenantId);
      res.json(activity);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // Reminders routes
  app.get("/api/reminders", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const reminders = await storage.getReminders(tenantId);
      res.json(reminders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  app.post("/api/reminders", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const reminderData = insertReminderSchema.parse(req.body);
      const reminder = await storage.createReminder(reminderData, tenantId);
      res.status(201).json(reminder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reminder data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create reminder" });
    }
  });

  app.put("/api/reminders/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = parseInt(req.params.id);
      const reminderData = insertReminderSchema.partial().parse(req.body);
      const reminder = await storage.updateReminder(id, reminderData, tenantId);
      if (!reminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      res.json(reminder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reminder data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  // Notifications routes
  app.get("/api/notifications", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const notifications = await storage.getNotifications(tenantId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
