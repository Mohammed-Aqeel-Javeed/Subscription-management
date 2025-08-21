import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectId } from "mongodb";
import {
  insertUserSchema,
  insertSubscriptionSchema,
  insertReminderSchema
} from "@shared/schema";
import { z } from "zod";
import subtrackerrRouter from "./subtrackerr.routes";
import analyticsRouter from "./analytics.routes";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import cors from "cors";
import { connectToDatabase } from "./mongo";

export async function registerRoutes(app: Express): Promise<Server> {
  // Logout
  app.post("/api/logout", (req, res) => {
    res.cookie("token", "", {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires: new Date(0)
    });
    res.status(200).json({ message: "Logout successful" });
  });

  app.use(cookieParser());

  // JWT middleware
  app.use((req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.replace("Bearer ", "");
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }
    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "subs_secret_key"
        );
        if (typeof decoded === "object" && "tenantId" in decoded) {
          req.user = decoded as any;
        } else {
          req.user = undefined;
        }
      } catch {
        req.user = undefined;
      }
    }
    next();
  });

  // Allow CORS
  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true
    })
  );

  // ===== Signup =====
  app.post("/api/signup", async (req, res) => {
    try {
      const { fullName, email, password, tenantId } = req.body;
      if (!fullName || !email || !password || !tenantId) {
        return res
          .status(400)
          .json({ message: "Missing required fields (fullName, email, password, tenantId)" });
      }

      const db = await connectToDatabase();
      const existingUser = await db.collection("login").findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      const doc = { fullName, email, password, tenantId, createdAt: new Date() };
      await db.collection("signup").insertOne(doc);
      await db.collection("login").insertOne(doc);

      res.status(201).json({ message: "Signup successful" });
    } catch (err) {
      res.status(500).json({ message: "Failed to save signup" });
    }
  });

  // ===== Login =====
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const db = await connectToDatabase();
      const user = await db.collection("login").findOne({ email, password });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const tokenPayload: any = { userId: user._id, email: user.email };
      if (user.tenantId) {
        tokenPayload.tenantId = user.tenantId;
      }

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || "subs_secret_key",
        { expiresIn: "7d" }
      );

      res.cookie("token", token, {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.status(200).json({ message: "Login successful" });
    } catch (err) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ===== Users =====
  app.get("/api/users", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const users = await storage.getUsers(tenantId);
      res.json(users);
    } catch {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const user = await storage.getUser(id, tenantId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch {
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
        return res
          .status(400)
          .json({ message: "Invalid user data", errors: error.issues });
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
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid user data", errors: error.issues });
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
      if (!deleted) return res.status(404).json({ message: "User not found" });
      res.status(204).send();
    } catch {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ===== Subscriptions =====
  app.get("/api/subscriptions", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const subscriptions = await storage.getSubscriptions(tenantId);
      res.json(subscriptions);
    } catch {
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.get("/api/subscriptions/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id ?? "";
      const subscription = await storage.getSubscription(id, tenantId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      res.json({ ...subscription, id: subscription.id.toString() });
    } catch {
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.post("/api/subscriptions", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      let subscriptionData = insertSubscriptionSchema.parse(req.body);

      // ✅ Ensure amount is always a number
      if (typeof subscriptionData.amount === "string") {
        subscriptionData.amount = parseFloat(subscriptionData.amount);
      }

      const subscription = await storage.createSubscription(
        subscriptionData,
        tenantId
      );
      res.status(201).json({ ...subscription, id: subscription.id.toString() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid subscription data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.put("/api/subscriptions/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id ?? "";

      let subscriptionData = insertSubscriptionSchema.partial().parse(req.body);

      // ✅ Ensure amount is always a number
      if (typeof subscriptionData.amount === "string") {
        subscriptionData.amount = parseFloat(subscriptionData.amount);
      }

      const subscription = await storage.updateSubscription(
        id,
        subscriptionData,
        tenantId
      );
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      res.json({ ...subscription, id: subscription.id.toString() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid subscription data", errors: error.issues });
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
      const db = await storage["getDb"]();
      let objectId;
      try {
        objectId = new ObjectId(id);
      } catch {
        objectId = id;
      }
      await db.collection("reminders").deleteMany({ subscriptionId: objectId });
      await db.collection("notifications").deleteMany({ subscriptionId: objectId });
      res.json({
        message:
          "Subscription and related reminders/notifications deleted successfully"
      });
    } catch {
      res.status(500).json({ message: "Failed to delete subscription" });
    }
  });

  // ===== Analytics =====
  app.use(subtrackerrRouter);
  app.use(analyticsRouter);

  // ===== Reminders =====
  app.get("/api/reminders", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const reminders = await storage.getReminders(tenantId);
      res.json(reminders);
    } catch {
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
        return res
          .status(400)
          .json({ message: "Invalid reminder data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create reminder" });
    }
  });

  app.put("/api/reminders/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = Number(req.params.id);
      const reminderData = insertReminderSchema.partial().parse(req.body);
      const reminder = await storage.updateReminder(id, reminderData, tenantId);
      if (!reminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      res.json(reminder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid reminder data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  // ===== Notifications =====
  app.get("/api/notifications", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const notifications = await storage.getNotifications(tenantId);
      res.json(notifications);
    } catch {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const deleted = await storage.deleteReminder(id);
      if (deleted) {
        res.status(200).json({ success: true });
      } else {
        res
          .status(404)
          .json({ success: false, message: "Notification not found" });
      }
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Error deleting notification" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
