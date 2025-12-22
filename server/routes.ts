import type { Express } from "express";
import type { User } from "./types";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { ObjectId } from "mongodb";
// @ts-ignore
// @ts-ignore
import {
  insertUserSchema,
  insertSubscriptionSchema,
  insertReminderSchema
} from "../shared/schema.js";
import { z } from "zod";
import subtrackerrRouter from "./subtrackerr.routes.js";
import analyticsRouter from "./analytics.routes.js";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import cors from "cors";
import { connectToDatabase } from "./mongo.js";
import bcrypt from "bcrypt";

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

  // Register subtrackerr router FIRST to ensure history-enabled routes take precedence
  app.use(subtrackerrRouter);

  // Allow CORS
  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "https://subscription-management-6uje.onrender.com"
      ],
      credentials: true
    })
  );

  // Email validation function
  const isValidEmail = (email: string): boolean => {
    // More strict email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return false;
    }
    
    // Additional checks
    const [localPart, domain] = email.split('@');
    
    // Local part should not be empty or too long
    if (!localPart || localPart.length > 64) {
      return false;
    }
    
    // Domain should have at least one dot and valid TLD
    if (!domain || !domain.includes('.')) {
      return false;
    }
    
    const domainParts = domain.split('.');
    const tld = domainParts[domainParts.length - 1];
    
    // TLD should be at least 2 characters
    if (tld.length < 2) {
      return false;
    }
    
    return true;
  };

  // Generate random 6-digit OTP
  const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // ===== Send OTP =====
  app.post("/api/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Validate email format
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const db = await connectToDatabase();
      
      // Check if email already exists
      const existingUser = await db.collection("login").findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in database
      await db.collection("otps").updateOne(
        { email },
        { 
          $set: { 
            otp, 
            expiresAt,
            createdAt: new Date(),
            verified: false
          } 
        },
        { upsert: true }
      );

      // Send OTP email
      const { emailService } = await import("./email.service.js");
      const emailSent = await emailService.sendEmail({
        to: email,
        subject: "Your OTP for Subscription Tracker Signup",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🔐 Email Verification</h1>
              </div>
              <div style="padding: 40px 30px;">
                <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                  Your One-Time Password (OTP) for email verification is:
                </p>
                <div style="background: #f1f5f9; border: 2px dashed #3b82f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                  <p style="color: #3b82f6; font-size: 42px; font-weight: bold; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</p>
                </div>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
                  This OTP will expire in <strong>10 minutes</strong>.
                </p>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 12px 0 0 0; text-align: center;">
                  If you didn't request this, please ignore this email.
                </p>
              </div>
              <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  Subscription Tracker - Secure Email Verification
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      if (!emailSent) {
        console.warn("⚠️ Email service not configured. OTP:", otp);
        return res.status(200).json({ 
          message: "Email service not configured. Check server logs for OTP.",
          devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
      }

      res.status(200).json({ message: "OTP sent successfully to your email" });
    } catch (err) {
      console.error("Send OTP error:", err);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  // ===== Verify OTP =====
  app.post("/api/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }

      const db = await connectToDatabase();
      const otpRecord = await db.collection("otps").findOne({ email });

      if (!otpRecord) {
        return res.status(400).json({ message: "OTP not found. Please request a new one." });
      }

      if (otpRecord.verified) {
        return res.status(400).json({ message: "OTP already used. Please request a new one." });
      }

      if (new Date() > new Date(otpRecord.expiresAt)) {
        return res.status(400).json({ message: "OTP expired. Please request a new one." });
      }

      if (otpRecord.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP. Please try again." });
      }

      // Mark OTP as verified
      await db.collection("otps").updateOne(
        { email },
        { $set: { verified: true, verifiedAt: new Date() } }
      );

      res.status(200).json({ message: "Email verified successfully" });
    } catch (err) {
      console.error("Verify OTP error:", err);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Password policy validation function
  const validatePasswordPolicy = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return { valid: false, message: "Password must be at least 8 characters long" };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: "Password must contain at least one uppercase letter" };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: "Password must contain at least one lowercase letter" };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: "Password must contain at least one number" };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { valid: false, message: "Password must contain at least one special character" };
    }
    return { valid: true };
  };

  // ===== Signup =====
  app.post("/api/signup", async (req, res) => {
    try {
      const { fullName, email, password, tenantId, defaultCurrency, companyName } = req.body;
      if (!fullName || !email || !password || !tenantId) {
        return res
          .status(400)
          .json({ message: "Missing required fields (fullName, email, password, tenantId)" });
      }

      // Validate email format
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const db = await connectToDatabase();
      
      // Check if OTP was verified
      const otpRecord = await db.collection("otps").findOne({ email });
      if (!otpRecord || !otpRecord.verified) {
        return res.status(400).json({ message: "Email not verified. Please verify your email with OTP first." });
      }

      // Validate password policy
      const passwordValidation = validatePasswordPolicy(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      const existingUser = await db.collection("login").findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, 10);
      const doc = { 
        fullName, 
        email, 
        password: hashedPassword, 
        tenantId,
        companyName: companyName || fullName + "'s Company",
        defaultCurrency: defaultCurrency || null,
        role: "super_admin", // First user gets super_admin role
        status: "active",
        createdAt: new Date() 
      };
      await db.collection("signup").insertOne(doc);
      await db.collection("login").insertOne(doc);
      
      // Clean up OTP after successful signup
      await db.collection("otps").deleteOne({ email });
      
      res.status(201).json({ message: "Signup successful" });
    } catch (err) {
      console.error("Signup error:", err);
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
      
      // First try the 'login' collection (primary auth collection)
      let user = await db.collection("login").findOne({ email });
      let isNewUserSystem = false;
      
      // If not found in login collection, try the 'users' collection (RBAC users with passwords)
      if (!user) {
        user = await db.collection("users").findOne({ email, password: { $exists: true } });
        isNewUserSystem = !!user;
      }
      
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if user is active (only for new user system)
      if (isNewUserSystem && user.status !== "active") {
        return res.status(401).json({ message: "Account is inactive" });
      }

      // All passwords are now hashed with bcrypt
      let isPasswordValid = false;
      if (user.password) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      }
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Update last login in both collections if applicable
      await db.collection("login").updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );
      if (isNewUserSystem) {
        await db.collection("users").updateOne(
          { email: user.email },
          { $set: { lastLogin: new Date() } }
        );
      }

      // For department_editor and department_viewer, find their department by matching email
      let userDepartment = user.department || null;
      if ((user.role === 'department_editor' || user.role === 'department_viewer') && user.tenantId) {
        const department = await db.collection("departments").findOne({
          tenantId: user.tenantId,
          email: user.email
        });
        if (department) {
          userDepartment = department.name;
        }
      }

      // Include role and department in JWT and response
      const tokenPayload: any = {
        userId: user._id,
        email: user.email,
        tenantId: user.tenantId || null,
        role: user.role || "viewer",
        department: userDepartment
      };
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || "subs_secret_key",
        { expiresIn: "24h" } // Token expires in 24 hours
      );
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/"
        // No maxAge - cookie expires when browser/tab closes (session cookie)
      });
      res.status(200).json({
        message: "Login successful",
        user: {
          userId: user._id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId || null,
          role: user.role || "viewer",
          department: userDepartment,
          status: user.status
        }
      });
    } catch (err) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ===== Current User =====
  app.get("/api/me", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.userId || !user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const db = await connectToDatabase();
      
      // Fetch the user record that matches BOTH the userId (email) AND the current tenantId
      // First get the email from the userId
      const userRecord = await db.collection("login").findOne({ _id: new ObjectId(user.userId) });
      if (!userRecord) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Now fetch the specific company record for this user with the current tenantId
      const dbUser = await db.collection("login").findOne({ 
        email: userRecord.email, 
        tenantId: user.tenantId 
      });
      
      if (!dbUser) {
        return res.status(404).json({ message: "Company not found for this tenant" });
      }
      
      // Get role and department from JWT token (already set during login)
      const role = user.role || dbUser.role || "viewer";
      const department = user.department || dbUser.department || undefined;
      
      res.status(200).json({
        userId: dbUser._id,
        email: dbUser.email,
        fullName: dbUser.fullName || null,
        companyName: dbUser.companyName || null,
        tenantId: dbUser.tenantId || null,
        defaultCurrency: dbUser.defaultCurrency || null,
        role: role,
        department: department
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });

  // ===== Get User's Companies =====
  app.get("/api/user/companies", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const db = await connectToDatabase();
      
      // Get all companies/tenants this user has access to
      const companies = await db.collection("login")
        .find({ email: (await db.collection("login").findOne({ _id: new ObjectId(user.userId) }))?.email })
        .toArray();
      
      const companyList = companies.map(c => ({
        tenantId: c.tenantId,
        companyName: c.companyName || 'Unnamed Company',
        isActive: c.tenantId === user.tenantId
      }));
      
      res.status(200).json(companyList);
    } catch (err) {
      console.error("Failed to fetch companies:", err);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // ===== Switch Company =====
  app.post("/api/user/switch-company", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ message: "tenantId is required" });
      }
      
      const db = await connectToDatabase();
      const dbUser = await db.collection("login").findOne({ _id: new ObjectId(user.userId) });
      
      if (!dbUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify user has access to this tenant
      const hasAccess = await db.collection("login").findOne({ 
        email: dbUser.email, 
        tenantId 
      });
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this company" });
      }
      
      // Generate new token with updated tenantId
      const tokenPayload = {
        userId: user.userId,
        email: dbUser.email,
        tenantId: tenantId
      };
      
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || "subs_secret_key",
        { expiresIn: "24h" }
      );
      
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/"
        // No maxAge - session cookie expires when browser closes
      });
      
      res.status(200).json({ 
        message: "Company switched successfully",
        tenantId 
      });
    } catch (err) {
      console.error("Failed to switch company:", err);
      res.status(500).json({ message: "Failed to switch company" });
    }
  });

  // ===== Add Company =====
  app.post("/api/user/add-company", async (req, res) => {
    try {
      const { email, password, companyName, defaultCurrency, setAsDefault } = req.body;
      
      if (!email || !password || !companyName) {
        return res.status(400).json({ message: "Email, password and company name are required" });
      }

      const db = await connectToDatabase();
      const dbUser = await db.collection("login").findOne({ email: email });
      
      if (!dbUser) {
        return res.status(404).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, dbUser.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate new tenantId
      const newTenantId = 'tenant-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();

      // Create new company record
      const newCompany = {
        email: dbUser.email,
        password: dbUser.password,
        fullName: dbUser.fullName,
        tenantId: newTenantId,
        companyName: companyName,
        defaultCurrency: defaultCurrency || dbUser.defaultCurrency || 'USD',
        role: "super_admin", // User gets super_admin role for new company
        status: "active",
        createdAt: new Date()
      };

      await db.collection("login").insertOne(newCompany);

      // If setAsDefault, switch to new company by issuing new token
      if (setAsDefault) {
        const tokenPayload = {
          userId: dbUser._id.toString(),
          email: dbUser.email,
          tenantId: newTenantId
        };
        
        const token = jwt.sign(
          tokenPayload,
          process.env.JWT_SECRET || "subs_secret_key",
          { expiresIn: "24h" }
        );
        
        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/"
          // No maxAge - session cookie expires when browser closes
        });
      }

      res.status(201).json({ 
        message: "Company added successfully",
        tenantId: newTenantId,
        companyName: companyName,
        switchedToNew: setAsDefault
      });
    } catch (err) {
      console.error("Failed to add company:", err);
      res.status(500).json({ message: "Failed to add company" });
    }
  });

  // ===== Users =====
  app.get("/api/users", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const db = await connectToDatabase();
      const users = await db.collection("login").find({ tenantId }).toArray();
      
      // Map to match expected format and remove passwords
      const formattedUsers = users.map(user => ({
        id: user._id.toString(),
        _id: user._id,
        name: user.fullName || user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId
      }));
      
      res.json(formattedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
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
      
      // Return the created user without password
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
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const { name, email, role, status, password } = req.body;
      const db = await connectToDatabase();
      
      // Check if email is being updated and already exists (excluding current user)
      if (email) {
        const existingEmail = await db.collection("login").findOne({ 
          email, 
          tenantId,
          _id: { $ne: new ObjectId(id) }
        });
        if (existingEmail) {
          return res.status(400).json({ message: "Email already exists" });
        }
      }
      
      // Check if name is being updated and already exists (excluding current user)
      if (name) {
        const existingName = await db.collection("login").findOne({ 
          fullName: name, 
          tenantId,
          _id: { $ne: new ObjectId(id) }
        });
        if (existingName) {
          return res.status(400).json({ message: "User name already exists" });
        }
      }
      
      // Build update object
      const updateData: any = {};
      if (name) updateData.fullName = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (status) updateData.status = status;
      if (password) updateData.password = await bcrypt.hash(password, 10);
      
      // Update in login collection
      const result = await db.collection("login").findOneAndUpdate(
        { _id: new ObjectId(id), tenantId },
        { $set: updateData },
        { returnDocument: "after" }
      );
      
      if (!result) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: result._id.toString(),
        name: result.fullName,
        email: result.email,
        role: result.role,
        status: result.status,
        tenantId: result.tenantId
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const db = await connectToDatabase();
      
      // Delete from login collection
      const result = await db.collection("login").deleteOne({
        _id: new ObjectId(id),
        tenantId: tenantId
      });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ===== Subscriptions =====
  app.get("/api/subscriptions", async (req, res) => {
    // Disable caching for role-based filtering
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    const userId = req.user?.userId;
    const userDepartment = req.user?.department;
    
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      let subscriptions = await storage.getSubscriptions(tenantId);
      
      // Apply role-based filtering
      if (userRole === 'contributor') {
        // Contributors can only see items where they are the owner (match by email)
        const userEmail = req.user?.email;
        subscriptions = subscriptions.filter(sub => {
          const isOwner = sub.ownerEmail === userEmail || sub.owner === userId;
          return isOwner;
        });
      } else if (userRole === 'department_editor' || userRole === 'department_viewer') {
        // Department roles can only see items in their department
        if (userDepartment) {
          subscriptions = subscriptions.filter(sub => {
            if (!sub.department) {
              return false;
            }
            try {
              const depts = JSON.parse(sub.department);
              const hasAccess = Array.isArray(depts) && depts.includes(userDepartment);
              return hasAccess;
            } catch {
              const hasAccess = sub.department === userDepartment;
              return hasAccess;
            }
          });
        }
      }
      
      // Convert all IDs to strings to ensure consistent type
      const formattedSubscriptions = subscriptions.map(sub => ({
        ...sub,
        id: typeof sub.id === "string" ? sub.id : String(sub.id ?? ""),
        amount: typeof sub.amount === "number" ? sub.amount : parseFloat(sub.amount ?? "0")
      }));
      res.json(formattedSubscriptions);
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
      // Destructure to avoid duplicate property issue
      const { id: subId, amount, ...restWithoutId } = subscription;
      res.json({
        ...restWithoutId,
        id: subId !== undefined && subId !== null ? String(subId) : "",
        amount: typeof amount === "number" ? amount : parseFloat(amount ?? "0")
      });
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
      
      // Destructure to avoid duplicate property issue
      const { id: subId, amount, ...restWithoutId } = subscription;
      res.status(201).json({
        ...restWithoutId,
        id: subId !== undefined && subId !== null ? String(subId) : "",
        amount: typeof amount === "number" ? amount : parseFloat(amount ?? "0")
      });
    } catch (error) {
      console.error("❌ Error in subscription creation:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid subscription data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create subscription", error: error instanceof Error ? error.message : String(error) });
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
      // Destructure to avoid duplicate property issue
      const { id: subId, amount, ...restWithoutId } = subscription;
      res.json({
        ...restWithoutId,
        id: subId !== undefined && subId !== null ? String(subId) : "",
        amount: typeof amount === "number" ? amount : parseFloat(amount ?? "0")
      });
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
      if (!deleted.success) {
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
        message: deleted.message
      });
    } catch {
      res.status(500).json({ message: "Failed to delete subscription" });
    }
  });

  // ===== Analytics =====
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
      // Get both reminder-based notifications and event-based notifications
      const reminderNotifications = await storage.getNotifications(tenantId);
      const eventNotifications = await storage.getNotificationEvents(tenantId);
// Combine and sort by timestamp
      const allNotifications = [...reminderNotifications, ...eventNotifications]
        .sort((a, b) => new Date(b.timestamp || b.createdAt || '').getTime() - new Date(a.timestamp || a.createdAt || '').getTime());
      
      res.json(allNotifications);
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/compliance", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const notifications = await storage.getComplianceNotifications(tenantId);
      res.json(notifications);
    } catch {
      res.status(500).json({ message: "Failed to fetch compliance notifications" });
    }
  });

  // Test endpoint to manually create a notification event
  app.post("/api/notifications/test-create", async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || "default";
// Try to call createNotificationEvent directly
      await storage.createNotificationEvent(
        tenantId,
        'created',
        'test-subscription-id',
        'Test Subscription',
        'Test Category'
      );
      
      res.json({ message: "Test notification event created successfully" });
    } catch (error) {
      console.error("TEST: Error creating notification event:", error);
      res.status(500).json({ 
        message: "Failed to create test notification event", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Cleanup old notifications (run daily)
  // Cleanup old notifications (run daily)
  app.post("/api/notifications/cleanup", async (req, res) => {
    try {
      await storage.cleanupOldNotifications();
      res.json({ message: "Old notifications cleaned up successfully" });
    } catch {
      res.status(500).json({ message: "Failed to cleanup notifications" });
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

  // Fix companies without names
  app.post("/api/fix-company-names", async (req, res) => {
    try {
      const db = await connectToDatabase();
      const companies = await db.collection("login").find({ companyName: { $exists: false } }).toArray();
      
      let fixed = 0;
      for (const company of companies) {
        await db.collection("login").updateOne(
          { _id: company._id },
          { $set: { companyName: company.fullName + "'s Company" } }
        );
        fixed++;
      }
      
      res.status(200).json({ message: `Fixed ${fixed} companies without names` });
    } catch (err) {
      console.error("Fix company names error:", err);
      res.status(500).json({ message: "Failed to fix company names" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}