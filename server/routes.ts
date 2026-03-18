import type { Express } from "express";
import type { User } from "./types";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { ObjectId } from "mongodb";
// @ts-ignore
// @ts-ignore
import {
  insertUserSchema,
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
  const toEpochMsServer = (raw: any): number => {
    if (!raw) return 0;
    const d = raw instanceof Date ? raw : new Date(String(raw));
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const notificationDedupeKey = (n: any): string => {
    if (!n) return '';

    const norm = (v: any) => String(v ?? '').trim().toLowerCase();

    const dateOnly = (raw: any): string => {
      if (!raw) return '';
      if (raw instanceof Date) return raw.toISOString().slice(0, 10);
      const s = String(raw).trim();
      if (!s) return '';
      // ISO strings and yyyy-mm-dd are both safe for slice(0,10)
      if (s.length >= 10) return s.slice(0, 10);
      const d = new Date(s);
      const t = d.getTime();
      return Number.isFinite(t) ? d.toISOString().slice(0, 10) : '';
    };

    const type = norm(n.type);
    const entityId = norm(n.subscriptionId || n.complianceId || n.licenseId || n.paymentId || n.id || n._id);
    if (!type || !entityId) return '';

    const eventType = norm(n.eventType);
    const lifecycle = norm(n.lifecycleEventType);
    const hasReminderSignals = Boolean(
      n.reminderTriggerDate || n.reminderDate || n.reminderType || n.reminderDays || n.submissionDeadline || n.subscriptionEndDate || n.endDate
    );

    // Prefer the higher-level eventType when present (created/deleted/updated/...)
    const kind = eventType || (lifecycle ? 'updated' : (hasReminderSignals ? 'reminder' : ''));

    const parts: string[] = [type, entityId, kind];

    // For update-like events, include the lifecycle detail (owner_changed, price_changed, submitted, ...)
    if (kind === 'updated' && lifecycle) {
      parts.push(lifecycle);
      parts.push(dateOnly(n.timestamp || n.createdAt));
    }

    // For reminders, include trigger/deadline so different reminder dates don't collapse
    if (kind === 'reminder' || hasReminderSignals && !eventType) {
      parts.push(norm(n.reminderType || n.reminderPolicy));
      parts.push(norm(n.reminderDays));
      parts.push(dateOnly(n.reminderTriggerDate || n.reminderDate || n.timestamp || n.createdAt));
      parts.push(dateOnly(n.submissionDeadline || n.subscriptionEndDate || n.endDate));
    }

    return parts.join('|');
  };

  const dedupeNotifications = (list: any[]): any[] => {
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
      let better;
      if (sa !== sb) {
        better = sa > sb ? a : b;
      } else {
        const ta = toEpochMsServer(a?.timestamp || a?.createdAt);
        const tb = toEpochMsServer(b?.timestamp || b?.createdAt);
        better = tb > ta ? b : a;
      }
      // Preserve isRead if either notification is marked as read
      if (a.isRead || b.isRead) {
        better = { ...better, isRead: true, readAt: a.readAt || b.readAt };
      }
      return better;
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
  };
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
          const d: any = decoded;
          if (d?.role === "global_admin" && d?.actingTenantId) {
            d.tenantId = d.actingTenantId;
          }
          req.user = d as any;
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
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

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
                  This OTP will expire in <strong>2 minutes</strong>.
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
        const diagnostics = typeof (emailService as any)?.getDiagnostics === 'function'
          ? (emailService as any).getDiagnostics()
          : {
              configured: false,
              lastError: { message: 'Email service diagnostics unavailable' },
            };
        return res.status(200).json({
          message: "Failed to send OTP email.",
          emailSent: false,
          emailDiagnostics: diagnostics,
          devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
      }

      const successDiagnostics = typeof (emailService as any)?.getDiagnostics === 'function'
        ? (emailService as any).getDiagnostics()
        : undefined;
      res.status(200).json({
        message: "OTP sent successfully to your email",
        emailSent: true,
        emailDiagnostics: successDiagnostics,
      });
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
      // Prefer platform-level global_admin record if present
      let user = await db.collection("login").findOne({ email, role: "global_admin" });
      if (!user) {
        user = await db.collection("login").findOne({ email });
      }
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

      // For department_editor and department_viewer, find their department from employees collection
      let userDepartment = user.department || null;
      if ((user.role === 'department_editor' || user.role === 'department_viewer') && user.tenantId) {
        // Try to find department from employees collection by matching email
        const employee = await db.collection("employees").findOne({
          tenantId: user.tenantId,
          email: user.email
        });
        if (employee && employee.department) {
          userDepartment = employee.department;
          console.log(`[Login] Found department "${userDepartment}" for ${user.email} from employees collection`);
        } else {
          console.log(`[Login] No department found for ${user.email} in employees collection`);
        }
      }

      // Include role and department in JWT and response
      const role = user.role || "viewer";

      // Platform-level global_admin has tenantId=null (identity is not bound to a tenant).
      // The session carries an actingTenantId for whichever tenant is currently selected.
      let actingTenantId: string | null = null;
      if (role === "global_admin") {
        actingTenantId = user.tenantId || null;
        if (!actingTenantId) {
          const anyCompany = await db.collection("login").findOne(
            { tenantId: { $ne: null }, companyName: { $exists: true } },
            { sort: { createdAt: -1 } }
          );
          actingTenantId = anyCompany?.tenantId || null;
        }
      }

      const tokenPayload: any = {
        userId: user._id,
        email: user.email,
        tenantId: role === "global_admin" ? null : (user.tenantId || null),
        actingTenantId: role === "global_admin" ? actingTenantId : undefined,
        role,
        department: userDepartment,
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
          role,
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
        profileImage: dbUser.profileImage || null,
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

  // ===== Update Current User (Profile / Password) =====
  app.put("/api/me", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.userId || !user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { fullName, email, profileImage, currentPassword, newPassword } = req.body || {};

      const nextFullName = typeof fullName === "string" ? fullName.trim() : undefined;
      const nextEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;
      const nextProfileImage = typeof profileImage === "string" ? profileImage : undefined;
      const nextPassword = typeof newPassword === "string" ? newPassword : undefined;
      const providedCurrentPassword = typeof currentPassword === "string" ? currentPassword : undefined;

      if (!nextFullName && !nextEmail && !nextProfileImage && !nextPassword) {
        return res.status(400).json({ message: "Nothing to update" });
      }

      const db = await connectToDatabase();

      // Resolve the tenant-specific user record by email + tenantId (token userId may belong to a different tenant)
      const userRecord = await db.collection("login").findOne({ _id: new ObjectId(user.userId) });
      if (!userRecord) {
        return res.status(404).json({ message: "User not found" });
      }

      const oldEmail = String(userRecord.email || "").trim().toLowerCase();
      if (!oldEmail) {
        return res.status(500).json({ message: "Invalid user email" });
      }

      const dbUser = await db.collection("login").findOne({
        email: userRecord.email,
        tenantId: user.tenantId,
      });

      if (!dbUser) {
        return res.status(404).json({ message: "Company not found for this tenant" });
      }

      const tenantId = user.tenantId;
      const updateData: any = {};

      if (nextFullName) {
        const existingName = await db.collection("login").findOne({
          fullName: nextFullName,
          tenantId,
          _id: { $ne: dbUser._id },
        });
        if (existingName) {
          return res.status(400).json({ message: "User name already exists" });
        }
        updateData.fullName = nextFullName;
      }

      if (nextEmail) {
        if (!isValidEmail(nextEmail)) {
          return res.status(400).json({ message: "Invalid email" });
        }

        if (nextEmail !== oldEmail) {
          const existing = await db.collection("login").findOne({ email: nextEmail });
          if (existing) {
            return res.status(400).json({ message: "Email already exists" });
          }

          // Update across all tenants for this user (all docs that share the old email)
          await db.collection("login").updateMany(
            { email: oldEmail },
            { $set: { email: nextEmail } }
          );
        }
      }

      if (nextProfileImage !== undefined) {
        // Basic sanity checks; do not accept unbounded input
        if (nextProfileImage.length > 2_000_000) {
          return res.status(400).json({ message: "Profile image is too large" });
        }
        if (nextProfileImage && !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(nextProfileImage)) {
          return res.status(400).json({ message: "Unsupported image format" });
        }

        updateData.profileImage = nextProfileImage || null;

        // Keep it consistent across all tenant records for this user
        const effectiveEmail = (nextEmail || oldEmail).trim().toLowerCase();
        await db.collection("login").updateMany(
          { email: effectiveEmail },
          { $set: { profileImage: updateData.profileImage } }
        );
      }

      if (nextPassword !== undefined) {
        const effectiveRole = user.role || dbUser.role || "viewer";

        // If currentPassword is not provided, only allow super_admin/global_admin to reset their own password.
        if (!providedCurrentPassword) {
          if (effectiveRole !== "super_admin" && effectiveRole !== "global_admin") {
            return res.status(400).json({ message: "Current password is required" });
          }
        } else {
          const isPasswordValid = await bcrypt.compare(providedCurrentPassword, dbUser.password);
          if (!isPasswordValid) {
            return res.status(401).json({ message: "Current password is incorrect" });
          }
        }

        if (nextPassword.length < 6) {
          return res.status(400).json({ message: "New password must be at least 6 characters" });
        }

        updateData.password = await bcrypt.hash(nextPassword, 10);
      }

      const updated = await db.collection("login").findOneAndUpdate(
        { _id: dbUser._id, tenantId },
        { $set: updateData },
        { returnDocument: "after" }
      );

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      const role = user.role || updated.role || "viewer";
      const department = user.department || updated.department || undefined;

      // If email changed, issue a new JWT so req.user.email stays in sync
      if (nextEmail && nextEmail !== oldEmail) {
        const tokenPayload = {
          userId: user.userId,
          email: nextEmail,
          tenantId: user.tenantId,
          role,
          department,
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
          path: "/",
        });
      }

      return res.status(200).json({
        userId: updated._id,
        email: updated.email,
        fullName: updated.fullName || null,
        profileImage: updated.profileImage || null,
        companyName: updated.companyName || null,
        tenantId: updated.tenantId || null,
        defaultCurrency: updated.defaultCurrency || null,
        role,
        department,
      });
    } catch (err) {
      console.error("Failed to update current user:", err);
      return res.status(500).json({ message: "Failed to update user" });
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

      const isGlobalAdmin = user?.role === 'global_admin';

      // Global admin sees ALL companies (tenants). Normal users see only their own.
      const companies = isGlobalAdmin
        ? await db.collection('login').find({ tenantId: { $ne: null }, companyName: { $exists: true } }).toArray()
        : await db.collection("login")
            .find({ email: (await db.collection("login").findOne({ _id: new ObjectId(user.userId) }))?.email })
            .toArray();

      const companyList = companies
        .filter((c: any) => !!c?.tenantId)
        .map((c: any) => ({
          tenantId: c.tenantId,
          companyName: c.companyName || 'Unnamed Company',
          isActive: c.tenantId === user.tenantId,
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

      const isGlobalAdmin = user?.role === 'global_admin' || dbUser?.role === 'global_admin';

      // Ensure tenant exists when global admin switches
      if (isGlobalAdmin) {
        const companyExists = await db.collection('login').findOne({ tenantId, companyName: { $exists: true } });
        if (!companyExists) {
          return res.status(404).json({ message: 'Company not found' });
        }
      }
      
      // Verify user has access to this tenant (normal users only)
      if (!isGlobalAdmin) {
        const hasAccess = await db.collection("login").findOne({ 
          email: dbUser.email, 
          tenantId 
        });
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied to this company" });
        }
      }

      // Generate new token
      const tokenPayload: any = {
        userId: user.userId,
        email: dbUser.email,
        role: dbUser.role || user.role || 'viewer',
      };
      if (isGlobalAdmin) {
        tokenPayload.tenantId = null;
        tokenPayload.actingTenantId = tenantId;
      } else {
        tokenPayload.tenantId = tenantId;
      }
      
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
  function isPlatformOwner(email?: string | null): boolean {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return false;
    const allow = String(process.env.PLATFORM_OWNER_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return allow.includes(normalized);
  }

  app.get("/api/users", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const db = await connectToDatabase();
      const users = await db.collection("login").find({ tenantId }).toArray();

      const allowGlobalAdmin = isPlatformOwner(req.user?.email);
      const visibleUsers = allowGlobalAdmin
        ? users
        : users.filter((u: any) => u?.role !== 'global_admin');
      
      // Map to match expected format and remove passwords
      const formattedUsers = visibleUsers.map(user => ({
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

      if ((user as any)?.role === 'global_admin' && !isPlatformOwner(req.user?.email)) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      const id = req.params.id;
      const db = await connectToDatabase();

      // Prevent deleting internal global_admin except by platform owner
      const existing = await db.collection("login").findOne({ _id: new ObjectId(id), tenantId });
      if (existing?.role === 'global_admin' && !isPlatformOwner(req.user?.email)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
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
  const isObjectIdString = (value: unknown): value is string => {
    if (typeof value !== "string") return false;
    return /^[a-fA-F0-9]{24}$/.test(value);
  };

  const tryParseObjectId = (value: unknown): ObjectId | null => {
    if (!isObjectIdString(value)) return null;
    try {
      return new ObjectId(value);
    } catch {
      return null;
    }
  };

  type DeleteNotificationTarget = {
    id?: string;
    dismissKey?: string;
    type?: 'subscription' | 'compliance' | 'license';
    eventType?: string;
    subscriptionId?: string;
    complianceId?: string;
    reminderTriggerDate?: string;
  };

  const deleteNotificationTargets = async (tenantId: string, targets: DeleteNotificationTarget[]) => {
    const db = await connectToDatabase();

    let deletedCount = 0;
    const results: Array<{ id?: string; deleted: number }> = [];

    for (const target of targets) {
      const rawId = String(target?.id || '').trim();
      const objectId = tryParseObjectId(rawId);
      const type = target?.type;
      const reminderTriggerDate = String(target?.reminderTriggerDate || '').trim();
      const subscriptionId = String(target?.subscriptionId || '').trim();
      const complianceId = String(target?.complianceId || '').trim();

      let deletedForThis = 0;

      // 1) Stored notifications and events (ObjectId-based)
      if (objectId) {
        // In-app notifications (per-user scoped elsewhere; tenant-level delete here)
        const notifRes = await db.collection('notifications').deleteOne({
          tenantId,
          _id: objectId,
          ...(type ? { type } : {}),
        });
        deletedForThis += notifRes.deletedCount || 0;

        const eventRes = await db.collection('notification_events').deleteOne({
          tenantId,
          _id: objectId,
          ...(type ? { type } : {}),
        });
        deletedForThis += eventRes.deletedCount || 0;

        if (type === 'subscription') {
          const reminderRes = await db.collection('reminders').deleteOne({ tenantId, _id: objectId });
          deletedForThis += reminderRes.deletedCount || 0;
        }

        if (type === 'compliance') {
          const compReminderRes = await db.collection('compliance_notifications').deleteOne({ tenantId, _id: objectId });
          deletedForThis += compReminderRes.deletedCount || 0;
        }
      }

      // 2) Fallback for reminder-derived notifications (when id isn't a reminder doc id)
      // Subscription reminders: try matching by subscriptionId + reminder date
      if (deletedForThis === 0 && type === 'subscription' && subscriptionId && reminderTriggerDate) {
        const subObjId = tryParseObjectId(subscriptionId);
        const reminderRes = await db.collection('reminders').deleteOne({
          tenantId,
          $and: [
            {
              $or: [
                { subscriptionId },
                ...(subObjId ? [{ subscriptionId: subObjId }] : []),
                { subscription_id: subscriptionId },
              ],
            },
            {
              $or: [
                { reminderDate: reminderTriggerDate },
                { reminderTriggerDate },
              ],
            },
          ],
        } as any);
        deletedForThis += reminderRes.deletedCount || 0;
      }

      // Compliance reminders: try matching by complianceId + reminder date
      if (deletedForThis === 0 && type === 'compliance' && complianceId && reminderTriggerDate) {
        const compObjId = tryParseObjectId(complianceId);
        const compReminderRes = await db.collection('compliance_notifications').deleteOne({
          tenantId,
          $and: [
            {
              $or: [
                { complianceId },
                ...(compObjId ? [{ complianceId: compObjId }] : []),
              ],
            },
            {
              $or: [
                { reminderTriggerDate },
                { reminderDate: reminderTriggerDate },
              ],
            },
          ],
        } as any);
        deletedForThis += compReminderRes.deletedCount || 0;
      }

      // Legacy reminders: sometimes ids were numeric strings
      if (deletedForThis === 0 && type === 'subscription' && rawId) {
        const numericId = Number(rawId);
        if (Number.isFinite(numericId)) {
          const legacyRes = await db.collection('reminders').deleteOne({ tenantId, id: numericId } as any);
          deletedForThis += legacyRes.deletedCount || 0;
        } else {
          const legacyRes = await db.collection('reminders').deleteOne({ tenantId, id: rawId } as any);
          deletedForThis += legacyRes.deletedCount || 0;
        }
      }

      deletedCount += deletedForThis;
      results.push({ id: rawId || target?.id, deleted: deletedForThis });
    }

    return { deletedCount, results };
  };

  app.get("/api/notifications", async (req, res) => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;
    const userEmail = req.user?.email;
    const userDept = (req.user as any)?.department;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });
    try {
      // Get both reminder-based notifications and event-based notifications
      let reminderNotifications = await storage.getNotifications(tenantId);
      const eventNotifications = await storage.getNotificationEvents(tenantId);

      // Apply matrix rules for renewal reminders:
      // - Admin: no in-app reminders
      // - Subscription Owner: reminders for their subscriptions only
      // - Dept Head: reminders for their department only
      const normalizedEmail = String(userEmail || '').trim().toLowerCase();
      const normalizedDept = String(userDept || '').trim().toLowerCase();

      const extractDepartments = (n: any): string[] => {
        if (Array.isArray(n?.departments)) return n.departments.map(String).filter(Boolean);
        const raw = n?.department;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
            if (parsed) return [String(parsed)];
          } catch {
            return [raw];
          }
        }
        return [];
      };

      if (userRole === 'department_editor' || userRole === 'department_viewer') {
        if (normalizedDept) {
          reminderNotifications = reminderNotifications.filter((n: any) => {
            const depts = extractDepartments(n).map(d => String(d).trim().toLowerCase());
            return depts.includes(normalizedDept);
          });
        } else {
          // If dept-head user has no department resolved, hide reminders to avoid leaking other departments
          reminderNotifications = [];
        }
      } else {
        // Default: owner/user view
        if (normalizedEmail) {
          reminderNotifications = reminderNotifications.filter((n: any) => {
            const ownerEmail = String(n?.ownerEmail || '').trim().toLowerCase();
            return ownerEmail && ownerEmail === normalizedEmail;
          });
        } else {
          reminderNotifications = [];
        }
      }

      // Get user-scoped in-app notifications (subscription lifecycle notifications ONLY)
      let userInAppNotifications: any[] = [];
      try {
        if (userId || userEmail) {
          const db = await connectToDatabase();
          const normalizedEmailForQuery = String(userEmail || '').trim().toLowerCase();
          userInAppNotifications = await db
            .collection("notifications")
            .find({
              tenantId,
              type: 'subscription', // ONLY subscription notifications
              $or: [
                ...(userId ? [{ userId: String(userId) }] : []),
                ...(normalizedEmailForQuery ? [{ userEmail: normalizedEmailForQuery }] : []),
              ],
            })
            .sort({ createdAt: -1 })
            .toArray();

          userInAppNotifications = userInAppNotifications.map((n) => ({
            ...n,
            id: n._id?.toString?.() || n.id,
            type: 'subscription',
          }));
        }
      } catch (e) {
        console.error("❌ Error fetching user in-app notifications:", e);
      }

      // Combine, dedupe, and sort by timestamp
      let allNotifications = dedupeNotifications([
        ...reminderNotifications,
        ...eventNotifications,
        ...userInAppNotifications,
      ]).sort(
        (a, b) =>
          new Date(b.timestamp || b.createdAt || '').getTime() -
          new Date(a.timestamp || a.createdAt || '').getTime()
      );

      // Hide dismissed notifications for this user (important for derived reminders)
      try {
        const normalizedEmailForQuery = String(userEmail || '').trim().toLowerCase();
        const userIdStr = userId ? String(userId) : '';
        if (userIdStr || normalizedEmailForQuery) {
          const db = await connectToDatabase();
          const dismissalDocs = await db
            .collection('notification_dismissals')
            .find({
              tenantId,
              $or: [
                ...(userIdStr ? [{ userId: userIdStr }] : []),
                ...(normalizedEmailForQuery ? [{ userEmail: normalizedEmailForQuery }] : []),
              ],
            })
            .project({ key: 1 })
            .toArray();

          const dismissed = new Set(
            dismissalDocs
              .map((d: any) => String(d?.key || '').trim())
              .filter(Boolean)
          );

          if (dismissed.size > 0) {
            allNotifications = allNotifications.filter((n: any) => {
              const key = notificationDedupeKey(n);
              return key ? !dismissed.has(key) : true;
            });
          }
        }
      } catch (e) {
        console.error('❌ Error applying notification dismissals:', e);
      }
      
      res.json(allNotifications);
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
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

  // Bulk delete notifications (supports merged notification sources)
  app.post("/api/notifications/bulk-delete", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });

    const userId = (req.user as any)?.userId || (req.user as any)?.id;
    const userEmail = (req.user as any)?.email;

    const targets = (req.body?.notifications || req.body?.targets || []) as DeleteNotificationTarget[];
    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ message: "No notifications provided" });
    }

    try {
      const { deletedCount, results } = await deleteNotificationTargets(tenantId, targets);

      // Always record dismissals for provided keys so derived reminders disappear.
      try {
        const normalizedEmail = String(userEmail || '').trim().toLowerCase();
        const userIdStr = userId ? String(userId) : '';
        const keys = targets
          .map((t) => String(t?.dismissKey || '').trim())
          .filter(Boolean);

        if (keys.length > 0 && (userIdStr || normalizedEmail)) {
          const db = await connectToDatabase();
          const now = new Date();
          const ops = keys.map((key) => ({
            updateOne: {
              filter: {
                tenantId,
                key,
                ...(userIdStr ? { userId: userIdStr } : {}),
                ...(normalizedEmail ? { userEmail: normalizedEmail } : {}),
              },
              update: {
                $setOnInsert: {
                  tenantId,
                  key,
                  ...(userIdStr ? { userId: userIdStr } : {}),
                  ...(normalizedEmail ? { userEmail: normalizedEmail } : {}),
                  createdAt: now,
                },
              },
              upsert: true,
            },
          }));

          await db.collection('notification_dismissals').bulkWrite(ops, { ordered: false });
        }
      } catch (e) {
        console.error('❌ Error recording notification dismissals:', e);
      }

      res.json({ success: true, deletedCount, results });
    } catch (error) {
      console.error("❌ Error bulk deleting notifications:", error);
      res.status(500).json({ success: false, message: "Failed to delete notifications" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });

    const id = String(req.params.id ?? '').trim();
    if (!id || id.length > 200) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      const { deletedCount } = await deleteNotificationTargets(tenantId, [{ id }]);
      if (deletedCount > 0) return res.status(200).json({ success: true, deletedCount });
      return res.status(404).json({ success: false, message: "Notification not found" });
    } catch (error) {
      console.error("❌ Error deleting notification:", error);
      res.status(500).json({ success: false, message: "Error deleting notification" });
    }
  });

  // Mark notifications as read
  app.post("/api/notifications/mark-read", async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ message: "Missing tenantId" });

    const { notificationIds } = req.body;
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ message: "notificationIds array is required" });
    }

    try {
      const db = await connectToDatabase();
      const { ObjectId } = await import("mongodb");
      
      console.log('📝 Mark as read request - IDs:', notificationIds);
      
      // Convert IDs to ObjectIds where possible, keep both formats for matching
      const objectIds: any[] = [];
      const stringIds: string[] = [];
      
      notificationIds.forEach(id => {
        const idStr = String(id);
        stringIds.push(idStr); // Always add string version
        try {
          const oid = new ObjectId(idStr);
          objectIds.push(oid);
        } catch {
          // Not a valid ObjectId format, that's ok
        }
      });

      console.log('📝 ObjectIds:', objectIds.length, 'StringIds:', stringIds.length);

      // Build query that checks both _id (as ObjectId) and id (as string)
      const buildQuery = () => {
        const conditions: any[] = [];
        if (objectIds.length > 0) {
          conditions.push({ _id: { $in: objectIds } });
        }
        if (stringIds.length > 0) {
          conditions.push({ id: { $in: stringIds } });
        }
        return conditions.length > 0 ? { tenantId, $or: conditions } : { tenantId, _id: { $in: [] } };
      };

      const query = buildQuery();
      console.log('📝 Query:', JSON.stringify(query, null, 2));

      // First, let's check what notifications exist with these IDs
      const notificationsCheck = await db.collection("notifications").find(query).toArray();
      const eventsCheck = await db.collection("notification_events").find(query).toArray();
      const complianceCheck = await db.collection("compliance_notifications").find(query).toArray();
      
      console.log('📝 Found before update:');
      console.log('  - notifications collection:', notificationsCheck.length, notificationsCheck.map(n => ({ id: n._id?.toString(), name: n.subscriptionName || n.filingName, isRead: n.isRead })));
      console.log('  - notification_events collection:', eventsCheck.length, eventsCheck.map(n => ({ id: n._id?.toString(), name: n.subscriptionName || n.filingName, isRead: n.isRead })));
      console.log('  - compliance_notifications collection:', complianceCheck.length, complianceCheck.map(n => ({ id: n._id?.toString(), name: n.filingName, isRead: n.isRead })));

      // Update notifications in all collections
      const updatePromises = [
        db.collection("notifications").updateMany(
          query,
          { $set: { isRead: true, readAt: new Date() } }
        ),
        db.collection("notification_events").updateMany(
          query,
          { $set: { isRead: true, readAt: new Date() } }
        ),
        db.collection("compliance_notifications").updateMany(
          query,
          { $set: { isRead: true, readAt: new Date() } }
        )
      ];

      const results = await Promise.all(updatePromises);
      const totalModified = results.reduce((sum, r) => sum + (r.modifiedCount || 0), 0);

      console.log(`✅ Marked ${totalModified} notification(s) as read (notifications: ${results[0].modifiedCount}, events: ${results[1].modifiedCount}, compliance: ${results[2].modifiedCount})`);

      res.status(200).json({ 
        success: true, 
        modifiedCount: totalModified,
        message: `Marked ${totalModified} notification(s) as read`
      });
    } catch (error) {
      console.error("❌ Error marking notifications as read:", error);
      res.status(500).json({ success: false, message: "Error marking notifications as read" });
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