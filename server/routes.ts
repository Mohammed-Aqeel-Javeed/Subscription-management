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
import crypto from "crypto";
import cors from "cors";
import axios from "axios";
import { connectToDatabase } from "./mongo.js";
import bcrypt from "bcrypt";
import { decrypt } from "./encryption.service.js";
import StripeLib from "stripe";
import type { Stripe } from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const StripeCtor: any = StripeLib as any;
const stripe: Stripe | null = STRIPE_SECRET_KEY
  ? (new StripeCtor(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any }) as Stripe)
  : null;

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
  app.post("/api/logout", async (req, res) => {
    try {
      let token: string | null = null;

      if (req.headers.authorization?.startsWith("Bearer ")) {
        token = String(req.headers.authorization).replace(/^Bearer\s+/i, "").trim();
      }

      if (!token) {
        const cookieHeader = String(req.headers.cookie || "");
        const parts = cookieHeader.split(";").map((p) => p.trim());
        const tokenPart = parts.find((p) => p.startsWith("token="));
        if (tokenPart) {
          token = decodeURIComponent(tokenPart.substring("token=".length));
        }
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || "subs_secret_key");
          if (typeof decoded === "object" && decoded && (decoded as any).jti) {
            const db = await connectToDatabase();
            await db.collection<{ _id: string }>("auth_sessions").updateOne(
              { _id: String((decoded as any).jti) },
              { $set: { revokedAt: new Date(), revokedReason: "logout" } }
            );
          }
        } catch {
          // ignore token errors on logout
        }
      }

      const isProd = process.env.NODE_ENV === "production";
      res.cookie("token", "", {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax") as any,
        path: "/",
        expires: new Date(0),
      });
      res.cookie("refresh_token", "", {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax") as any,
        path: "/",
        expires: new Date(0),
      });

      return res.status(200).json({ message: "Logout successful" });
    } catch {
      return res.status(200).json({ message: "Logout successful" });
    }
  });

  app.use(cookieParser());

  // Allow CORS
  app.use(
    cors({
      origin: ["http://localhost:5173", "https://subscription-management-6uje.onrender.com"],
      credentials: true,
    })
  );

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");

      const requestedWith = String(req.headers["x-requested-with"] || "");
      if (requestedWith.toLowerCase() !== "xmlhttprequest") {
        return res.status(400).json({ message: "Bad request" });
      }

      const refreshCookieRaw = String(req.cookies?.refresh_token || "").trim();
      if (!refreshCookieRaw) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parts = refreshCookieRaw.split(".");
      if (parts.length !== 2) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const sid = String(parts[0] || "").trim();
      const secret = String(parts[1] || "").trim();
      if (!sid || !secret) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const db = await connectToDatabase();
      const platformSettings = await getPlatformSettingsCached(db);
      const securitySettings = platformSettings.security;
      const authSessions = db.collection<{ _id: string }>("auth_sessions");

      const isProd = process.env.NODE_ENV === "production";

      if (!securitySettings.refreshTokensEnabled) {
        res.cookie("refresh_token", "", {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
          path: "/",
          expires: new Date(0),
        });
        return res.status(401).json({ message: "Unauthorized" });
      }

      const session = await authSessions.findOne({ _id: sid });
      if (!session || (session as any)?.revokedAt) {
        res.cookie("refresh_token", "", {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
          path: "/",
          expires: new Date(0),
        });
        res.cookie("token", "", {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
          path: "/",
          expires: new Date(0),
        });
        return res.status(401).json({ message: "Unauthorized" });
      }

      const expectedHash = String((session as any)?.refreshTokenHash || "");
      const actualHash = sha256Hex(secret);

      const expectedBuf = Buffer.from(expectedHash, "hex");
      const actualBuf = Buffer.from(actualHash, "hex");

      if (!expectedHash || expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        await authSessions.updateOne(
          { _id: sid },
          { $set: { revokedAt: new Date(), revokedReason: "refresh_token_invalid" } }
        );

        res.cookie("refresh_token", "", {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
          path: "/",
          expires: new Date(0),
        });
        res.cookie("token", "", {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
          path: "/",
          expires: new Date(0),
        });

        await writeAuditEvent(db, {
          tenantId: ((session as any)?.tenantId ?? null) as any,
          action: "REFRESH_FAILED",
          description: "Refresh token rejected",
          email: (session as any)?.email || null,
          severity: "warning",
          meta: {
            userId: String((session as any)?.userId || ""),
            sessionId: sid,
          },
        });

        return res.status(401).json({ message: "Unauthorized" });
      }

      const newSecret = crypto.randomBytes(32).toString("hex");
      const newHash = sha256Hex(newSecret);

      await authSessions.updateOne(
        { _id: sid, revokedAt: null },
        { $set: { refreshTokenHash: newHash, refreshRotatedAt: new Date(), lastSeenAt: new Date() } }
      );

      const role = String((session as any)?.role || "viewer");
      const tokenPayload: any = {
        userId: String((session as any)?.userId || ""),
        email: String((session as any)?.email || ""),
        tenantId: role === "global_admin" ? null : ((session as any)?.tenantId ?? null),
        actingTenantId: role === "global_admin" ? ((session as any)?.actingTenantId ?? null) : undefined,
        role,
        department: (session as any)?.department ?? null,
      };
      tokenPayload.jti = sid;

      const jwtSecret = process.env.JWT_SECRET || "subs_secret_key";
      const token = securitySettings.jwtExpiryEnabled
        ? jwt.sign(tokenPayload, jwtSecret, { expiresIn: `${securitySettings.jwtExpiryMinutes}m` })
        : jwt.sign(tokenPayload, jwtSecret);

      res.cookie("token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax") as any,
        path: "/",
      });

      res.cookie("refresh_token", `${sid}.${newSecret}`, {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax") as any,
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      await writeAuditEvent(db, {
        tenantId: (tokenPayload.tenantId ?? null) as any,
        action: "TOKEN_REFRESHED",
        description: "Access token refreshed",
        email: tokenPayload.email || null,
        severity: "info",
        meta: {
          userId: tokenPayload.userId,
          sessionId: sid,
          role,
        },
      });

      return res.status(200).json({ token });
    } catch {
      return res.status(500).json({ message: "Failed to refresh" });
    }
  });

  const sessionLastSeenWrite = new Map<string, number>();
  const SESSION_LAST_SEEN_WRITE_MS = 30_000;

  // JWT + session middleware
  app.use(async (req, res, next) => {
    let token;
    const tabScoped = Boolean(req.headers["x-tab-auth"]);
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.replace("Bearer ", "");
    } else if (req.cookies?.token && (!tabScoped || !req.headers.authorization)) {
      token = req.cookies.token;
    }
    if (token) {
      token = String(token).trim().replace(/^Bearer\s+/i, "");
    }

    if (!token) {
      req.user = undefined;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "subs_secret_key");
      if (typeof decoded !== "object" || !decoded) {
        req.user = undefined;
        return next();
      }

      const d: any = decoded;

      let db: any = null;
      let platformSettings: any = null;

      const needsDb = Boolean(d?.jti) || (d?.role === "global_admin" && d?.actingTenantId);
      if (needsDb) {
        db = await connectToDatabase();
        platformSettings = await getPlatformSettingsCached(db);
      }

      // Enforce impersonation toggle
      if (d?.role === "global_admin" && d?.actingTenantId) {
        const allowImpersonation = platformSettings?.security?.allowImpersonation !== false;
        if (allowImpersonation) {
          d.tenantId = d.actingTenantId;
        } else {
          d.actingTenantId = null;
          d.tenantId = null;
        }
      }

      // Enforce session controls for tokens that carry a jti/session id
      if (d?.jti && db) {
        const session = await db.collection("auth_sessions").findOne({ _id: String(d.jti) });
        if (!session || session?.revokedAt) {
          req.user = undefined;
          return next();
        }

        const timeoutMinutes = Math.max(1, Math.min(24 * 60, Number(platformSettings?.security?.sessionTimeoutMinutes ?? 30)));
        const lastSeenAt = session?.lastSeenAt ? new Date(session.lastSeenAt) : null;
        if (lastSeenAt && Number.isFinite(lastSeenAt.getTime())) {
          const idleMs = Date.now() - lastSeenAt.getTime();
          if (idleMs > timeoutMinutes * 60 * 1000) {
            await db.collection("auth_sessions").updateOne(
              { _id: String(d.jti) },
              { $set: { revokedAt: new Date(), revokedReason: "idle_timeout" } }
            );
            req.user = undefined;
            return next();
          }
        }

        const now = Date.now();
        const lastWrite = sessionLastSeenWrite.get(String(d.jti)) || 0;
        if (now - lastWrite > SESSION_LAST_SEEN_WRITE_MS) {
          sessionLastSeenWrite.set(String(d.jti), now);
          await db.collection("auth_sessions").updateOne(
            { _id: String(d.jti), revokedAt: null },
            { $set: { lastSeenAt: new Date() } }
          );
        }
      }

      req.user = d as any;

      // Log decoded token for debugging
      if (req.path === "/api/me") {
        console.log("[JWT Middleware] Decoded token for /api/me:", {
          userId: d?.userId,
          email: d?.email,
          role: d?.role,
          tenantId: d?.tenantId,
          actingTenantId: d?.actingTenantId,
          jti: d?.jti,
        });
      }

      return next();
    } catch (err) {
      console.log("[JWT Middleware] Token verification failed:", err instanceof Error ? err.message : err);
      req.user = undefined;
      return next();
    }
  });

  // Register subtrackerr router FIRST to ensure history-enabled routes take precedence
  app.use(subtrackerrRouter);

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

  const sha256Hex = (value: string): string => {
    return crypto.createHash("sha256").update(value).digest("hex");
  };

  // ===== Platform Settings (global, singleton) =====
  const PLATFORM_SETTINGS_DOC_ID = "default";
  const PLATFORM_SETTINGS_CACHE_MS = 15_000;

  const PlatformSettingsSchema = z
    .object({
      billing: z
        .object({
          stripeEnabled: z.boolean(),
          stripeMode: z.enum(["test", "live"]),
          defaultCurrency: z.enum(["USD", "INR"]),
          trialDays: z.number().int().min(0).max(365),
        })
        .strict(),
      tenantOnboarding: z
        .object({
          defaultPlan: z.enum(["free", "pro"]),
          autoCreateCompanyOnSignup: z.boolean(),
          requireEmailVerification: z.boolean(),
          allowMultipleCompaniesPerUser: z.boolean(),
        })
        .strict(),
      notifications: z
        .object({
          emailNotificationsEnabled: z.boolean(),
          reminderDays: z.array(z.number().int().min(1).max(365)).max(12),
          schedulerJobsEnabled: z.boolean(),
        })
        .strict(),
      security: z
        .object({
          jwtExpiryEnabled: z.boolean(),
          jwtExpiryMinutes: z.number().int().min(5).max(7 * 24 * 60),
          refreshTokensEnabled: z.boolean(),
          enable2FA: z.boolean(),
          forceStrongPasswords: z.boolean(),
          maxLoginAttempts: z.number().int().min(1).max(50),
          accountLockMinutes: z.number().int().min(1).max(7 * 24 * 60),
          ipTrackingEnabled: z.boolean(),
          sessionTimeoutMinutes: z.number().int().min(1).max(24 * 60),
          allowImpersonation: z.boolean(),
        })
        .strict(),
      support: z
        .object({
          globalAdminTenantDataAccess: z.boolean(),
          auditLoggingEnabled: z.boolean(),
          debugMode: z.boolean(),
        })
        .strict(),
      updatedBy: z
        .object({
          userId: z.string().optional(),
          email: z.string().optional(),
        })
        .strict()
        .nullable()
        .optional(),
      createdAt: z.any().optional(),
      updatedAt: z.any().optional(),
    })
    .strict();

  type PlatformSettings = z.infer<typeof PlatformSettingsSchema>;

  const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
    billing: {
      stripeEnabled: true,
      stripeMode: "test",
      defaultCurrency: "USD",
      trialDays: 14,
    },
    tenantOnboarding: {
      defaultPlan: "free",
      autoCreateCompanyOnSignup: true,
      requireEmailVerification: true,
      allowMultipleCompaniesPerUser: false,
    },
    notifications: {
      emailNotificationsEnabled: true,
      reminderDays: [30, 7, 1],
      schedulerJobsEnabled: true,
    },
    security: {
      jwtExpiryEnabled: true,
      jwtExpiryMinutes: 24 * 60,
      refreshTokensEnabled: true,
      enable2FA: false,
      forceStrongPasswords: true,
      maxLoginAttempts: 5,
      accountLockMinutes: 15,
      ipTrackingEnabled: false,
      sessionTimeoutMinutes: 30,
      allowImpersonation: true,
    },
    support: {
      globalAdminTenantDataAccess: true,
      auditLoggingEnabled: true,
      debugMode: false,
    },
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let platformSettingsCache: { value: PlatformSettings; fetchedAt: number } | null = null;

  const normalizeReminderDays = (days: number[]) => {
    const unique = Array.from(
      new Set(
        (Array.isArray(days) ? days : [])
          .map((d) => Number(d))
          .filter((d) => Number.isFinite(d) && d >= 1 && d <= 365)
      )
    );
    unique.sort((a, b) => b - a);
    return unique.slice(0, 12);
  };

  async function getPlatformSettingsCached(db: any, options?: { bypassCache?: boolean }): Promise<PlatformSettings> {
    const now = Date.now();

    if (!options?.bypassCache && platformSettingsCache && now - platformSettingsCache.fetchedAt < PLATFORM_SETTINGS_CACHE_MS) {
      return platformSettingsCache.value;
    }

    const existing = await db.collection("platform_settings").findOne({ _id: PLATFORM_SETTINGS_DOC_ID });
    if (!existing) {
      const createdAt = new Date();
      const seed = {
        _id: PLATFORM_SETTINGS_DOC_ID,
        ...DEFAULT_PLATFORM_SETTINGS,
        createdAt,
        updatedAt: createdAt,
      };

      await db.collection("platform_settings").updateOne(
        { _id: PLATFORM_SETTINGS_DOC_ID },
        { $setOnInsert: seed },
        { upsert: true }
      );
    }

    const docRaw = (existing ?? (await db.collection("platform_settings").findOne({ _id: PLATFORM_SETTINGS_DOC_ID }))) as any;
    const { _id: _ignoredId, ...doc } = (docRaw || {}) as any;

    const candidate = {
      ...DEFAULT_PLATFORM_SETTINGS,
      ...doc,
      billing: { ...DEFAULT_PLATFORM_SETTINGS.billing, ...(doc?.billing || {}) },
      tenantOnboarding: { ...DEFAULT_PLATFORM_SETTINGS.tenantOnboarding, ...(doc?.tenantOnboarding || {}) },
      notifications: { ...DEFAULT_PLATFORM_SETTINGS.notifications, ...(doc?.notifications || {}) },
      security: { ...DEFAULT_PLATFORM_SETTINGS.security, ...(doc?.security || {}) },
      support: { ...DEFAULT_PLATFORM_SETTINGS.support, ...(doc?.support || {}) },
    };

    candidate.notifications.reminderDays = normalizeReminderDays(candidate.notifications.reminderDays);

    const parsed = PlatformSettingsSchema.safeParse(candidate);
    const settings = parsed.success
      ? parsed.data
      : {
          ...DEFAULT_PLATFORM_SETTINGS,
          updatedAt: new Date(),
        };

    platformSettingsCache = { value: settings, fetchedAt: now };
    return settings;
  }

  const PlatformSettingsPatchSchema = z
    .object({
      billing: PlatformSettingsSchema.shape.billing.partial().optional(),
      tenantOnboarding: PlatformSettingsSchema.shape.tenantOnboarding.partial().optional(),
      notifications: PlatformSettingsSchema.shape.notifications.partial().optional(),
      security: PlatformSettingsSchema.shape.security.partial().optional(),
      support: PlatformSettingsSchema.shape.support.partial().optional(),
    })
    .strict();

  const writeAuditEvent = async (
    db: any,
    event: {
      tenantId: string | null;
      action: string;
      description: string;
      email?: string | null;
      severity?: "info" | "warning" | "error";
      meta?: Record<string, any>;
    }
  ) => {
    try {
      const settings = await getPlatformSettingsCached(db);
      if (settings?.support?.auditLoggingEnabled === false) {
        return;
      }

      await db.collection("history").insertOne({
        tenantId: event.tenantId,
        type: "audit",
        action: event.action,
        description: event.description,
        email: event.email ?? null,
        severity: event.severity ?? "info",
        meta: event.meta ?? null,
        timestamp: new Date(),
        createdAt: new Date(),
      });
    } catch {
      // Audit logging must never block the main request path.
    }
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

      const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const emailKey = normalizeEmail(email);
      const emailRegex = new RegExp(`^${escapeRegExp(emailKey)}$`, "i");

      // Check if email already exists (case-insensitive)
      const existingUser = await db.collection("login").findOne({ email: { $regex: emailRegex } });
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

      // Ensure a single OTP record per email (case-insensitive)
      await db.collection("otps").deleteMany({ email: { $regex: emailRegex } });

      // Store OTP in database (normalized key)
      await db.collection("otps").updateOne(
        { email: emailKey },
        {
          $set: {
            email: emailKey,
            otp,
            expiresAt,
            createdAt: new Date(),
            verified: false,
          },
        },
        { upsert: true }
      );

      // Send OTP email
      const { emailService } = await import("./email.service.js");
      const emailSent = await emailService.sendEmail({
        to: emailKey,
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
        const provider = diagnostics?.lastSend?.provider;
        const messageId = diagnostics?.lastSend?.id;

        await writeAuditEvent(db, {
          tenantId: null,
          action: "OTP_SEND_FAILED",
          description: "OTP email delivery failed for signup verification",
          email: emailKey,
          severity: "error",
          meta: {
            emailProvider: provider || null,
            emailMessageId: messageId || null,
          },
        });

        return res.status(502).json({
          message: "Failed to send OTP email.",
          emailSent: false,
          emailProvider: provider,
          emailMessageId: messageId,
          emailDiagnostics: diagnostics,
          devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
      }

      const successDiagnostics = typeof (emailService as any)?.getDiagnostics === 'function'
        ? (emailService as any).getDiagnostics()
        : undefined;
      const provider = (successDiagnostics as any)?.lastSend?.provider;
      const messageId = (successDiagnostics as any)?.lastSend?.id;

      await writeAuditEvent(db, {
        tenantId: null,
        action: "OTP_SENT",
        description: "OTP sent for signup verification",
        email: emailKey,
        severity: "info",
        meta: {
          emailProvider: provider || null,
          emailMessageId: messageId || null,
        },
      });

      res.status(200).json({
        message: "OTP sent successfully to your email",
        emailSent: true,
        emailProvider: provider,
        emailMessageId: messageId,
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

      const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const emailKey = normalizeEmail(email);
      const emailRegex = new RegExp(`^${escapeRegExp(emailKey)}$`, "i");

      const otpRecord = await db.collection("otps").findOne({ email: { $regex: emailRegex } });

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
        { _id: otpRecord._id },
        {
          $set: {
            email: emailKey,
            verified: true,
            verifiedAt: new Date(),
            // Give the user time to submit /api/signup after verifying.
            // This also prevents the TTL index on expiresAt from deleting the record immediately.
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
          },
        }
      );

      await writeAuditEvent(db, {
        tenantId: null,
        action: "OTP_VERIFIED",
        description: "OTP verified for signup",
        email: emailKey,
        severity: "info",
      });

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
      let { fullName, email, password, tenantId, defaultCurrency, companyName, sessionId } = req.body;
      if (!fullName || !email || !password) {
        return res.status(400).json({ message: "Missing required fields (fullName, email, password)" });
      }

      const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const emailKey = normalizeEmail(email);
      const emailRegex = new RegExp(`^${escapeRegExp(emailKey)}$`, "i");

      // Validate email format
      if (!isValidEmail(emailKey)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const db = await connectToDatabase();
      const platformSettings = await getPlatformSettingsCached(db);

      // Bootstrap rule (no env needed): if this is the very first account in a fresh DB,
      // make it the platform global admin.
      const existingLoginCount = await db.collection("login").estimatedDocumentCount();
      const bootstrapPlatformOwner = existingLoginCount === 0;
      
      if (platformSettings.tenantOnboarding.requireEmailVerification) {
        // Check if OTP was verified
        const otpRecord = await db.collection("otps").findOne({ email: { $regex: emailRegex } });
        if (!otpRecord) {
          return res.status(400).json({ message: "OTP record not found or expired. Please request a new OTP." });
        }
        if (!otpRecord.verified) {
          return res.status(400).json({ message: "Email not verified. Please verify your email with OTP first." });
        }
      }

      if (platformSettings.security.forceStrongPasswords) {
        // Validate password policy
        const passwordValidation = validatePasswordPolicy(password);
        if (!passwordValidation.valid) {
          return res.status(400).json({ message: passwordValidation.message });
        }
      }

      const existingUser = await db.collection("login").findOne({ email: { $regex: emailRegex } });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      const platformOwner = bootstrapPlatformOwner || isPlatformOwner(emailKey);

      if (!platformOwner && !tenantId) {
        if (platformSettings.tenantOnboarding.autoCreateCompanyOnSignup) {
          tenantId = `tenant-${new ObjectId().toHexString()}`;
        } else {
          return res.status(400).json({ message: "Missing required fields (tenantId)" });
        }
      }

      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, 10);

      // Enforce unique company names (case-insensitive) for tenant signups.
      // This prevents duplicates like "Perfecta" and "perfecta".
      const desiredCompanyName = platformOwner
        ? (companyName || "Platform")
        : (companyName || fullName + "'s Company");

      if (!platformOwner) {
        const normalizeCompanyKey = (value: unknown) =>
          String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        const desiredKey = normalizeCompanyKey(desiredCompanyName);
        if (desiredKey) {
          const [loginNames, companyInfoNames] = await Promise.all([
            db.collection("login").distinct("companyName", {
              tenantId: { $ne: null },
              role: { $ne: "global_admin" },
              companyName: { $exists: true, $ne: null },
            }),
            db.collection("companyInfo").distinct("companyName", { companyName: { $exists: true, $ne: null } }),
          ]);

          const existingKeys = new Set(
            [...loginNames, ...companyInfoNames].map(normalizeCompanyKey).filter(Boolean)
          );

          if (existingKeys.has(desiredKey)) {
            return res.status(409).json({ message: "Company name already exists. Please use a unique company name." });
          }
        }
      }

      // Determine initial plan: trial by default (configurable), or the purchased plan if sessionId was passed
      const now = new Date();
      const trialDays = Math.max(Number(platformSettings.billing.trialDays || 0), 0);

      let initialPlan: string = trialDays > 0 ? "trial" : platformSettings.tenantOnboarding.defaultPlan;
      let trialStartedAt: Date | null = trialDays > 0 ? now : null;
      let trialEndsAt: Date | null = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;
      let planActivatedAt: Date | null = null;
      let stripeCustomerId: string | null = null;
      let stripeSubscriptionId: string | null = null;

      if (sessionId || emailKey) {
        try {
          const queryConditions: any[] = [{ customerEmail: emailKey }];
          if (sessionId) {
            queryConditions.push({ sessionId });
          }
          const pending = await db.collection("pending_purchases").findOne({
            $or: queryConditions,
            linkedAt: null
          });
          if (pending) {
            initialPlan = pending.plan;
            planActivatedAt = pending.paidAt;
            stripeCustomerId = pending.stripeCustomerId;
            stripeSubscriptionId = pending.stripeSubscriptionId;
            trialStartedAt = null;
            trialEndsAt = null;
            
            // Re-assign sessionId to ensure we delete the correct one later
            req.body.sessionId = pending.sessionId;
          }
          
          // Proactive Fallback: If pending_purchase webhook hasn't arrived but sessionId is authentic
          if (!pending && sessionId && sessionId.startsWith('cs_')) {
            if (stripe) {
              const session = await stripe.checkout.sessions.retrieve(sessionId);
              if ((session.payment_status === "paid" || session.status === "complete") && session.metadata?.plan) {
                  initialPlan = session.metadata.plan;
                  planActivatedAt = new Date(session.created * 1000);
                  stripeCustomerId = session.customer as string;
                  stripeSubscriptionId = session.subscription as string;
                  trialStartedAt = null;
                  trialEndsAt = null;
              }
            } else {
              console.warn("[Signup] Stripe not configured; skipping session verification");
            }
          }
        } catch (e) {
          console.error("[Signup] Failed to check pending_purchases or stripe session:", e);
          // Non-fatal: proceed with trial plan
        }
      }

      let initialRole: string = platformOwner ? "global_admin" : "super_admin";
      if (!platformOwner) {
        const tenantKey = String(tenantId || "");
        const tenantVariants = Array.from(new Set([tenantId, tenantKey].filter((v: any) => v !== null && v !== undefined && String(v) !== "")));
        const existingSuperAdmins = tenantVariants.length
          ? await db.collection("login").countDocuments({ role: "super_admin", tenantId: { $in: tenantVariants } })
          : 0;

        // Only the very first user of a tenant should be super_admin by default.
        if (existingSuperAdmins > 0) {
          initialRole = "viewer";
        }
      }

      const doc: any = {
        fullName,
        email: emailKey,
        password: hashedPassword,
        tenantId: platformOwner ? null : String(tenantId),
        companyName: desiredCompanyName,
        defaultCurrency: defaultCurrency || platformSettings.billing.defaultCurrency || null,
        role: initialRole,
        status: "active",
        createdAt: now,
        // Trial / Billing fields
        plan: initialPlan,
        trialStartedAt,
        trialEndsAt,
        planActivatedAt,
        stripeCustomerId,
        stripeSubscriptionId,
      };
      await db.collection("signup").insertOne(doc);
      await db.collection("login").insertOne(doc);

      // If a pending purchase was used, mark it as linked
      const effectiveSessionId = req.body.sessionId || sessionId;
      if (effectiveSessionId && stripeCustomerId) {
        try {
          await db.collection("pending_purchases").updateOne(
            { sessionId: effectiveSessionId },
            { $set: { linkedAt: new Date(), linkedEmail: emailKey } }
          );
        } catch (e) {
          console.error("[Signup] Failed to mark pending_purchase as linked:", e);
        }
      }

      // Backfill Stripe metadata now that we know the tenant context.
      // This makes platform billing mapping deterministic (tenantId/companyName) and avoids "Unlinked" rows.
      if (stripe && stripeCustomerId) {
        try {
          const stripeMetadata: Record<string, string> = {
            tenantId: platformOwner ? "" : String(tenantId || ""),
            companyName: String(desiredCompanyName || ""),
            userEmail: String(emailKey || ""),
            plan: String(initialPlan || ""),
          };
          await stripe.customers.update(String(stripeCustomerId), { metadata: stripeMetadata } as any);
          if (stripeSubscriptionId) {
            await stripe.subscriptions.update(String(stripeSubscriptionId), { metadata: stripeMetadata } as any);
          }
        } catch (e) {
          console.warn("[Signup] Failed to backfill Stripe metadata:", e);
        }
      }

      // Fetch and store subscription period end so the profile countdown works on first login
      if (stripeSubscriptionId) {
        try {
          if (stripe) {
            const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            const periodEnd = new Date((sub as any).current_period_end * 1000);
            const periodUpdate = { $set: { subscriptionCurrentPeriodEnd: periodEnd } };
            await db.collection("login").updateOne({ email: emailKey }, periodUpdate);
            await db.collection("signup").updateOne({ email: emailKey }, periodUpdate);
          } else {
            console.warn("[Signup] Stripe not configured; skipping subscription period end fetch");
          }
        } catch (e) {
          console.error("[Signup] Failed to fetch subscription period end:", e);
        }
      }

      // Clean up OTP after successful signup
      await db.collection("otps").deleteMany({ email: { $regex: emailRegex } });

      await writeAuditEvent(db, {
        tenantId: platformOwner ? null : String(tenantId),
        action: "USER_SIGNUP",
        description: `User signup completed (${platformOwner ? "platform" : "tenant"})`,
        email: emailKey,
        severity: "info",
        meta: {
          role: initialRole,
          companyName: desiredCompanyName,
          plan: initialPlan,
        },
      });

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
      const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const emailKey = normalizeEmail(email);
      const emailRegex = new RegExp(`^${escapeRegExp(emailKey)}$`, "i");

      const db = await connectToDatabase();
      const platformSettings = await getPlatformSettingsCached(db);
      const securitySettings = platformSettings.security;

      const rawForwardedFor = String(req.headers["x-forwarded-for"] || "");
      const clientIp = (rawForwardedFor.split(",")[0] || req.ip || "").trim();
      const userAgent = String(req.headers["user-agent"] || "");

      // Env-based platform owner login (no signup required).
      // If PLATFORM_OWNER_EMAILS includes this email and PLATFORM_OWNER_PASSWORD matches,
      // issue a global_admin token even if the user doesn't exist in MongoDB.
      const platformOwnerPassword = String(process.env.PLATFORM_OWNER_PASSWORD || "");
      const isEnvPlatformOwner = isPlatformOwner(emailKey);
      if (isEnvPlatformOwner && platformOwnerPassword) {
        const isBcryptHash = platformOwnerPassword.startsWith("$2");
        const passwordOk = isBcryptHash
          ? await bcrypt.compare(password, platformOwnerPassword)
          : password === platformOwnerPassword;

        if (passwordOk) {
          const tokenPayload: any = {
            userId: "env-platform-owner",
            email: emailKey,
            tenantId: null,
            actingTenantId: null,
            role: "global_admin",
            department: null,
          };
          tokenPayload.jti = crypto.randomUUID();

          const jwtSecret = process.env.JWT_SECRET || "subs_secret_key";
          const token = securitySettings.jwtExpiryEnabled
            ? jwt.sign(tokenPayload, jwtSecret, { expiresIn: `${securitySettings.jwtExpiryMinutes}m` })
            : jwt.sign(tokenPayload, jwtSecret);
          const sessionDoc: any = {
            _id: tokenPayload.jti,
            userId: tokenPayload.userId,
            email: emailKey,
            tenantId: null,
            role: "global_admin",
            department: null,
            createdAt: new Date(),
            lastSeenAt: new Date(),
            revokedAt: null,
          };

          let refreshTokenValue: string | null = null;
          if (securitySettings.refreshTokensEnabled) {
            const refreshSecret = crypto.randomBytes(32).toString("hex");
            sessionDoc.refreshTokenHash = sha256Hex(refreshSecret);
            sessionDoc.refreshIssuedAt = new Date();
            refreshTokenValue = `${tokenPayload.jti}.${refreshSecret}`;
          }

          if (securitySettings.ipTrackingEnabled) {
            sessionDoc.ip = clientIp;
            sessionDoc.userAgent = userAgent;
          }
          await db.collection("auth_sessions").insertOne(sessionDoc);

          const isProd = process.env.NODE_ENV === "production";

          res.cookie("token", token, {
            httpOnly: true,
            secure: isProd,
            sameSite: (isProd ? "none" : "lax") as any,
            path: "/",
          });

          if (refreshTokenValue) {
            res.cookie("refresh_token", refreshTokenValue, {
              httpOnly: true,
              secure: isProd,
              sameSite: (isProd ? "none" : "lax") as any,
              path: "/",
              maxAge: 30 * 24 * 60 * 60 * 1000,
            });
          } else {
            res.cookie("refresh_token", "", {
              httpOnly: true,
              secure: isProd,
              sameSite: (isProd ? "none" : "lax") as any,
              path: "/",
              expires: new Date(0),
            });
          }

          await writeAuditEvent(db, {
            tenantId: null,
            action: "LOGIN_SUCCESS",
            description: "Platform owner logged in (env-based)",
            email: emailKey,
            severity: "info",
            meta: {
              role: "global_admin",
              auth: "env",
              ip: securitySettings.ipTrackingEnabled ? clientIp : undefined,
              userAgent: securitySettings.ipTrackingEnabled ? userAgent : undefined,
            },
          });

          return res.status(200).json({
            message: "Login successful",
            token,
            user: {
              userId: tokenPayload.userId,
              email: emailKey,
              name: "Platform Owner",
              tenantId: null,
              role: "global_admin",
              department: null,
              status: "active",
            },
          });
        }
      }
      
      // First try the 'login' collection (primary auth collection)
      // Prefer platform-level global_admin record if present
      let user = await db.collection("login").findOne({ email: { $regex: emailRegex }, role: "global_admin" });
      if (!user) {
        // If multiple tenant-bound records exist for the same email, prefer the user's chosen default.
        user =
          (await db.collection("login").findOne({ email: { $regex: emailRegex }, isDefaultCompany: true })) ||
          (await db.collection("login").findOne({ email: { $regex: emailRegex } }));
      }
      let isNewUserSystem = false;
      
      // If not found in login collection, try the 'users' collection (RBAC users with passwords)
      if (!user) {
        user = await db.collection("users").findOne({ email: { $regex: emailRegex }, password: { $exists: true } });
        isNewUserSystem = !!user;
      }
      
      if (!user) {
        await writeAuditEvent(db, {
          tenantId: null,
          action: "LOGIN_FAILED",
          description: "Login failed",
          email: emailKey,
          severity: "warning",
          meta: {
            ip: securitySettings.ipTrackingEnabled ? clientIp : undefined,
            userAgent: securitySettings.ipTrackingEnabled ? userAgent : undefined,
            reason: "user_not_found",
          },
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Block access for suspended/disabled accounts (legacy + new user system)
      // (global_admin is platform-level and should not be tenant-blocked)
      if (String((user as any)?.role || "").toLowerCase() !== "global_admin") {
        const status = String((user as any)?.status || "").trim().toLowerCase();
        if (status && status !== "active") {
          if (status === "suspended") {
            return res.status(403).json({ message: "Your organization has been suspended. Contact support." });
          }
          if (status === "disabled") {
            return res.status(403).json({ message: "Account is inactive" });
          }
          if (isNewUserSystem) {
            return res.status(401).json({ message: "Account is inactive" });
          }
          return res.status(403).json({ message: "Account is inactive" });
        }
      }

      const userCollectionName = isNewUserSystem ? "users" : "login";
      const maxLoginAttempts = Math.max(1, Math.min(50, Number(securitySettings.maxLoginAttempts ?? 5)));
      const accountLockMinutes = Math.max(1, Math.min(7 * 24 * 60, Number(securitySettings.accountLockMinutes ?? 15)));

      const lockUntil = user?.lockUntil ? new Date(user.lockUntil) : null;
      if (lockUntil && Number.isFinite(lockUntil.getTime()) && lockUntil.getTime() > Date.now()) {
        await writeAuditEvent(db, {
          tenantId: (user?.tenantId ?? null) as any,
          action: "LOGIN_FAILED",
          description: "Login attempt while account locked",
          email: emailKey,
          severity: "warning",
          meta: {
            ip: securitySettings.ipTrackingEnabled ? clientIp : undefined,
            userAgent: securitySettings.ipTrackingEnabled ? userAgent : undefined,
            lockedUntil: lockUntil,
            role: user?.role,
          },
        });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // All passwords are now hashed with bcrypt
      let isPasswordValid = false;
      if (user.password) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      }
      
      if (!isPasswordValid) {
        const previousFailedCount = Math.max(0, Number(user?.failedLoginCount ?? 0));
        const failedLoginCount = Math.min(previousFailedCount + 1, maxLoginAttempts);
        const willLock = failedLoginCount >= maxLoginAttempts;
        const nextLockUntil = willLock ? new Date(Date.now() + accountLockMinutes * 60 * 1000) : null;

        const failedLoginSet: any = {
          failedLoginCount,
          lastFailedLoginAt: new Date(),
          lockUntil: nextLockUntil,
        };
        if (securitySettings.ipTrackingEnabled) {
          failedLoginSet.lastFailedLoginIp = clientIp;
          failedLoginSet.lastFailedLoginUserAgent = userAgent;
        }

        await db.collection(userCollectionName).updateOne({ _id: user._id }, { $set: failedLoginSet });

        await writeAuditEvent(db, {
          tenantId: (user?.tenantId ?? null) as any,
          action: "LOGIN_FAILED",
          description: willLock ? "Login failed (account locked)" : "Login failed",
          email: emailKey,
          severity: "warning",
          meta: {
            ip: securitySettings.ipTrackingEnabled ? clientIp : undefined,
            userAgent: securitySettings.ipTrackingEnabled ? userAgent : undefined,
            failedLoginCount,
            maxLoginAttempts,
            lockedUntil: nextLockUntil,
            role: user?.role,
          },
        });

        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Successful login: reset protection counters + record last login
      const successfulLoginUpdate: any = {
        lastLogin: new Date(),
        failedLoginCount: 0,
        lockUntil: null,
      };
      if (securitySettings.ipTrackingEnabled) {
        successfulLoginUpdate.lastLoginIp = clientIp;
        successfulLoginUpdate.lastLoginUserAgent = userAgent;
      }

      await db.collection(userCollectionName).updateOne({ _id: user._id }, { $set: successfulLoginUpdate });

      // Keep legacy login collection in sync when authenticating from the RBAC users collection.
      if (isNewUserSystem) {
        await db.collection("login").updateOne(
          { email: { $regex: emailRegex } },
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

      // Enforce tenant assignment for non-platform users.
      // A production SaaS user must always be bound to a company (tenant).
      if (role !== "global_admin" && !user.tenantId) {
        return res.status(401).json({ message: "Account is not assigned to a company" });
      }

      // Platform-level global_admin has tenantId=null (identity is not bound to a tenant).
      // actingTenantId is only set when the global admin explicitly switches/impersonates a company.
      const actingTenantId: string | null = null;

      const tokenPayload: any = {
        userId: user._id?.toString?.() || String(user._id),
        email: emailKey,
        tenantId: role === "global_admin" ? null : (user.tenantId || null),
        actingTenantId: role === "global_admin" ? actingTenantId : undefined,
        role,
        department: userDepartment,
      };
      tokenPayload.jti = crypto.randomUUID();
      
      console.log("[Login] Creating JWT for:", {
        email: user.email,
        role,
        userId: tokenPayload.userId,
        tenantId: tokenPayload.tenantId,
        actingTenantId: tokenPayload.actingTenantId
      });
      
      const jwtSecret = process.env.JWT_SECRET || "subs_secret_key";
      const token = securitySettings.jwtExpiryEnabled
        ? jwt.sign(tokenPayload, jwtSecret, { expiresIn: `${securitySettings.jwtExpiryMinutes}m` })
        : jwt.sign(tokenPayload, jwtSecret);

      const sessionDoc: any = {
        _id: tokenPayload.jti,
        userId: tokenPayload.userId,
        email: emailKey,
        tenantId: tokenPayload.tenantId ?? null,
        actingTenantId: tokenPayload.actingTenantId ?? null,
        role,
        department: userDepartment ?? null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        revokedAt: null,
      };

      let refreshTokenValue: string | null = null;
      if (securitySettings.refreshTokensEnabled) {
        const refreshSecret = crypto.randomBytes(32).toString("hex");
        sessionDoc.refreshTokenHash = sha256Hex(refreshSecret);
        sessionDoc.refreshIssuedAt = new Date();
        refreshTokenValue = `${tokenPayload.jti}.${refreshSecret}`;
      }

      if (securitySettings.ipTrackingEnabled) {
        sessionDoc.ip = clientIp;
        sessionDoc.userAgent = userAgent;
      }
      await db.collection("auth_sessions").insertOne(sessionDoc);

      const isProd = process.env.NODE_ENV === "production";
      
      console.log("[Login] Setting cookie with secure:", isProd, "sameSite:", isProd ? "none" : "lax");
      
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax") as any,
        path: "/",
        // No maxAge - cookie expires when browser/tab closes (session cookie)
      });

      if (refreshTokenValue) {
        res.cookie("refresh_token", refreshTokenValue, {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
          path: "/",
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      } else {
        res.cookie("refresh_token", "", {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
          path: "/",
          expires: new Date(0),
        });
      }

      await writeAuditEvent(db, {
        tenantId: (tokenPayload.tenantId ?? null) as any,
        action: "LOGIN_SUCCESS",
        description: "User logged in",
        email: emailKey,
        severity: "info",
        meta: {
          role,
          department: userDepartment,
          ip: securitySettings.ipTrackingEnabled ? clientIp : undefined,
          userAgent: securitySettings.ipTrackingEnabled ? userAgent : undefined,
        },
      });

      res.status(200).json({
        message: "Login successful",
        token,
        user: {
          userId: user._id?.toString?.() || String(user._id),
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
      const db = await connectToDatabase();
      
      console.log("[/api/me] Request from user:", { 
        userId: user?.userId, 
        email: user?.email, 
        role: user?.role,
        tenantId: user?.tenantId,
        actingTenantId: user?.actingTenantId 
      });
      
      if (!user?.userId) {
        console.log("[/api/me] Unauthorized: No userId in token");
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Env-based global_admin may have a non-ObjectId userId. Allow a synthetic identity.
      if (user?.role === "global_admin" && isPlatformOwner(user?.email)) {
        try {
          // If convertible, we still try DB for richer profile.
          // Otherwise, return a synthetic platform identity.
          // eslint-disable-next-line no-new
          new ObjectId(String(user.userId));
        } catch {
          return res.status(200).json({
            userId: String(user.userId),
            email: String(user.email || ""),
            fullName: "Platform Owner",
            profileImage: null,
            companyName: null,
            tenantId: null,
            actingTenantId: null,
            defaultCurrency: null,
            role: "global_admin",
            department: user.department || undefined,
          });
        }
      }

      let userObjectId: ObjectId;
      try {
        userObjectId = new ObjectId(String(user.userId));
      } catch (err) {
        console.log("[/api/me] Invalid ObjectId:", user.userId, err);
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Fetch the user record that matches BOTH the userId (email) AND the current tenantId
      // First get the email from the userId
      const userRecord =
        (await db.collection("login").findOne({ _id: userObjectId })) ||
        (await db.collection("users").findOne({ _id: userObjectId }));
      
      console.log("[/api/me] User record found:", userRecord ? {
        _id: userRecord._id,
        email: (userRecord as any).email,
        role: (userRecord as any).role,
        tenantId: (userRecord as any).tenantId
      } : null);
      
      if (!userRecord) {
        // If token represents env-based platform owner, return a synthetic identity.
        if (user?.role === "global_admin" && isPlatformOwner(user?.email)) {
          return res.status(200).json({
            userId: String(user.userId),
            email: String(user.email || ""),
            fullName: "Platform Owner",
            profileImage: null,
            companyName: null,
            tenantId: null,
            actingTenantId: null,
            defaultCurrency: null,
            role: "global_admin",
            department: user.department || undefined,
          });
        }

        console.log("[/api/me] User not found in login or users collection");
        return res.status(404).json({ message: "User not found" });
      }

      // global_admin is platform-level (tenantId=null). It may not exist as a tenant-bound login record.
      // For global_admin, return the identity record and (optionally) a current tenant context from actingTenantId.
      if (user?.role === "global_admin") {
        const effectiveTenantId = user?.actingTenantId ?? user?.tenantId ?? null;
        const role = user.role || userRecord.role || "viewer";
        const department = user.department || userRecord.department || undefined;

        let companyName: string | null = null;
        let defaultCurrency: string | null = (userRecord as any)?.defaultCurrency || null;

        if (effectiveTenantId) {
          const companyInfo = await db.collection("companyInfo").findOne({ tenantId: effectiveTenantId });
          if (companyInfo) {
            companyName = (companyInfo as any)?.companyName || null;
            defaultCurrency = (companyInfo as any)?.defaultCurrency || defaultCurrency;
          } else {
            const anyLogin = await db.collection("login").findOne({
              tenantId: effectiveTenantId,
              companyName: { $exists: true },
            });
            companyName = (anyLogin as any)?.companyName || null;
            defaultCurrency = (anyLogin as any)?.defaultCurrency || defaultCurrency;
          }
        }

        return res.status(200).json({
          userId: userRecord._id,
          email: (userRecord as any).email,
          fullName: (userRecord as any).fullName || (userRecord as any).name || null,
          profileImage: (userRecord as any).profileImage || null,
          companyName,
          tenantId: effectiveTenantId,
          actingTenantId: user?.actingTenantId ?? null,
          defaultCurrency,
          role,
          department,
        });
      }

      const effectiveTenantId = user?.tenantId ?? null;
      if (!effectiveTenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Now fetch the specific company record for this user with the current tenantId
      const dbUser = await db.collection("login").findOne({ 
        email: (userRecord as any).email, 
        tenantId: effectiveTenantId 
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
        department: department,
        plan: (dbUser as any).plan || null,
        trialStartedAt: (dbUser as any).trialStartedAt || null,
        trialEndsAt: (dbUser as any).trialEndsAt || null,
        planActivatedAt: (dbUser as any).planActivatedAt || null,
        planExpiredAt: (dbUser as any).planExpiredAt || null,
        subscriptionCurrentPeriodEnd: (dbUser as any).subscriptionCurrentPeriodEnd || null,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });

  const requireGlobalAdmin = (req: any, res: any): boolean => {
    const role = (req.user as any)?.role;
    if (role !== "global_admin") {
      res.status(403).json({ message: "Forbidden" });
      return false;
    }
    return true;
  };

  const getStripeMonthlyAmount = (subscription: any): number => {
    const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
    return Number(
      items.reduce((total: number, item: any) => {
        const quantity = Number(item?.quantity || 1);
        const recurring = item?.price?.recurring || item?.plan || {};
        const interval = String(recurring?.interval || "month").toLowerCase();
        const intervalCount = Math.max(Number(recurring?.interval_count || 1), 1);
        const rawUnitAmount = item?.price?.unit_amount ?? item?.plan?.amount ?? 0;
        const unitAmount = Number(rawUnitAmount || 0) / 100;
        const lineAmount = unitAmount * quantity;

        let monthlyAmount = lineAmount;
        if (interval === "year") monthlyAmount = lineAmount / (12 * intervalCount);
        else if (interval === "month") monthlyAmount = lineAmount / intervalCount;
        else if (interval === "week") monthlyAmount = (lineAmount * 52) / (12 * intervalCount);
        else if (interval === "day") monthlyAmount = (lineAmount * 365) / (12 * intervalCount);

        return total + monthlyAmount;
      }, 0).toFixed(2)
    );
  };

  const isActiveStripeSubscriptionStatus = (status: any) => {
    const normalized = String(status || "").toLowerCase();
    return ["active", "trialing", "past_due"].includes(normalized);
  };

  const getStripePaymentStatus = (invoice: any): string => {
    const status = String(invoice?.status || "").toLowerCase();

    try {
      const charge = invoice?.charge && typeof invoice.charge === "object" ? invoice.charge : null;
      const chargeRefunded = Number(charge?.amount_refunded || 0) > 0;

      const paymentIntent = invoice?.payment_intent && typeof invoice.payment_intent === "object" ? invoice.payment_intent : null;
      const charges = Array.isArray(paymentIntent?.charges?.data) ? paymentIntent.charges.data : [];
      const intentRefunded = charges.some((c: any) => Number(c?.amount_refunded || 0) > 0);

      if (status === "paid" && (chargeRefunded || intentRefunded)) return "refunded";
    } catch {
      // ignore - fall back to Stripe invoice status
    }

    if (status === "paid") return "paid";
    if (["uncollectible", "void"].includes(status)) return "failed";
    if (invoice?.attempted && invoice?.paid === false && invoice?.next_payment_attempt === null) return "failed";
    if (["draft", "open"].includes(status)) return "pending";
    return status || "pending";
  };

  // ===== Platform Admin APIs =====

  app.get("/api/platform/settings", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      const db = await connectToDatabase();
      const settings = await getPlatformSettingsCached(db, { bypassCache: true });
      res.status(200).json(settings);
    } catch (e) {
      res.status(500).json({ message: "Failed to load platform settings" });
    }
  });

  app.put("/api/platform/settings", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const patchParsed = PlatformSettingsPatchSchema.safeParse(req.body ?? {});
      if (!patchParsed.success) {
        return res.status(400).json({ message: "Invalid settings payload", issues: patchParsed.error.issues });
      }

      const db = await connectToDatabase();
      const current = await getPlatformSettingsCached(db, { bypassCache: true });
      const patch = patchParsed.data;

      const actor = req.user as any;
      const updatedByCandidate: { userId?: string; email?: string } = {};
      if (actor?.userId) updatedByCandidate.userId = String(actor.userId);
      if (actor?.email) updatedByCandidate.email = String(actor.email);
      const updatedBy = Object.keys(updatedByCandidate).length > 0 ? updatedByCandidate : null;

      // Lock critical settings in production.
      const isProd = process.env.NODE_ENV === "production";
      if (isProd) {
        if (current.billing?.stripeMode === "live" && patch.billing?.stripeEnabled === false) {
          return res.status(400).json({ message: "Cannot disable Stripe while in live mode (production lock)." });
        }
        if (patch.support?.auditLoggingEnabled === false) {
          return res.status(400).json({ message: "Cannot disable audit logging in production." });
        }
        if (patch.security?.jwtExpiryEnabled === false) {
          return res.status(400).json({ message: "Cannot disable JWT expiry in production." });
        }
      }

      const next: any = {
        ...current,
        ...patch,
        billing: { ...current.billing, ...(patch.billing || {}) },
        tenantOnboarding: { ...current.tenantOnboarding, ...(patch.tenantOnboarding || {}) },
        notifications: { ...current.notifications, ...(patch.notifications || {}) },
        security: { ...current.security, ...(patch.security || {}) },
        support: { ...current.support, ...(patch.support || {}) },
        updatedBy,
        updatedAt: new Date(),
      };

      next.notifications.reminderDays = normalizeReminderDays(next.notifications.reminderDays);

      const finalParsed = PlatformSettingsSchema.safeParse(next);
      if (!finalParsed.success) {
        return res.status(400).json({ message: "Invalid settings", issues: finalParsed.error.issues });
      }

      const finalSettings = finalParsed.data;
      const { createdAt: createdAtFinal, ...finalSettingsToSet } = finalSettings;

      await db.collection<PlatformSettings & { _id: string }>("platform_settings").updateOne(
        { _id: PLATFORM_SETTINGS_DOC_ID },
        {
          $set: {
            ...finalSettingsToSet,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: createdAtFinal ?? new Date(),
          },
        },
        { upsert: true }
      );

      platformSettingsCache = { value: finalSettings, fetchedAt: Date.now() };

      await writeAuditEvent(db, {
        tenantId: null,
        action: "PLATFORM_SETTINGS_UPDATED",
        description: "Platform settings updated",
        severity: "info",
        meta: {
          sections: Object.keys(patch),
        },
      });

      res.status(200).json(finalSettings);
    } catch (e) {
      console.error("[PlatformSettings] Save failed:", e);

      const isProd = process.env.NODE_ENV === "production";
      const payload: any = { message: "Failed to save platform settings" };

      if (!isProd) {
        payload.details = e instanceof Error ? e.message : String(e);
        if ((e as any)?.code) payload.code = (e as any).code;
      }

      res.status(500).json(payload);
    }
  });

  // ===== Security Control APIs =====

  app.get("/api/security/sessions", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.userId) return res.status(401).json({ message: "Unauthorized" });

      const db = await connectToDatabase();
      const platformSettings = await getPlatformSettingsCached(db);
      const timeoutMinutes = Math.max(1, Math.min(24 * 60, Number(platformSettings.security.sessionTimeoutMinutes ?? 30)));
      const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

      const sessions = await db
        .collection("auth_sessions")
        .find({ userId: String(user.userId) })
        .sort({ lastSeenAt: -1, createdAt: -1 })
        .limit(50)
        .toArray();

      const items = sessions.map((s: any) => {
        const lastSeenAt = s?.lastSeenAt ? new Date(s.lastSeenAt) : null;
        const isActive = Boolean(!s?.revokedAt && lastSeenAt && lastSeenAt >= cutoff);
        return {
          id: String(s._id),
          userId: String(s.userId),
          email: String(s.email || ""),
          role: String(s.role || ""),
          tenantId: s.tenantId ?? null,
          actingTenantId: s.actingTenantId ?? null,
          createdAt: s.createdAt ?? null,
          lastSeenAt: s.lastSeenAt ?? null,
          revokedAt: s.revokedAt ?? null,
          revokedReason: s.revokedReason ?? null,
          ip: s.ip ?? null,
          userAgent: s.userAgent ?? null,
          isActive,
        };
      });

      return res.status(200).json({ timeoutMinutes, items });
    } catch {
      return res.status(500).json({ message: "Failed to load sessions" });
    }
  });

  app.post("/api/security/logout-all", async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.userId) return res.status(401).json({ message: "Unauthorized" });

      const db = await connectToDatabase();
      const result = await db.collection("auth_sessions").updateMany(
        { userId: String(user.userId), revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: "user_logout_all" } }
      );

      res.cookie("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as any,
        path: "/",
        expires: new Date(0),
      });
      res.cookie("refresh_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as any,
        path: "/",
        expires: new Date(0),
      });

      await writeAuditEvent(db, {
        tenantId: (user?.tenantId ?? null) as any,
        action: "SESSIONS_REVOKED",
        description: "User logged out all sessions",
        email: user?.email || null,
        severity: "info",
        meta: {
          userId: String(user.userId),
          revokedCount: result?.modifiedCount ?? 0,
        },
      });

      return res.status(200).json({ revokedCount: result?.modifiedCount ?? 0 });
    } catch {
      return res.status(500).json({ message: "Failed to revoke sessions" });
    }
  });

  app.get("/api/platform/security/sessions", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const limitRaw = Number((req.query as any)?.limit ?? 100);
      const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 100));

      const db = await connectToDatabase();
      const platformSettings = await getPlatformSettingsCached(db);
      const timeoutMinutes = Math.max(1, Math.min(24 * 60, Number(platformSettings.security.sessionTimeoutMinutes ?? 30)));
      const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

      const parseDateMaybe = (raw: unknown): Date | null => {
        if (!raw) return null;
        if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw : null;
        const text = String(raw).trim();
        if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return null;
        const d = new Date(text);
        return Number.isFinite(d.getTime()) ? d : null;
      };

      const sessions = await db
        .collection("auth_sessions")
        .find({})
        .sort({ lastSeenAt: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      const items = sessions.map((s: any) => {
        const lastSeenAt = parseDateMaybe(s?.lastSeenAt);
        const revokedAt = parseDateMaybe(s?.revokedAt);
        const isActive = Boolean(!revokedAt && lastSeenAt && lastSeenAt >= cutoff);
        return {
          id: String(s._id),
          userId: String(s.userId),
          email: String(s.email || ""),
          role: String(s.role || ""),
          tenantId: s.tenantId ?? null,
          actingTenantId: s.actingTenantId ?? null,
          createdAt: parseDateMaybe(s.createdAt)?.toISOString?.() ?? null,
          lastSeenAt: lastSeenAt?.toISOString?.() ?? null,
          revokedAt: revokedAt?.toISOString?.() ?? null,
          revokedReason: s.revokedReason ?? null,
          ip: s.ip ?? null,
          userAgent: s.userAgent ?? null,
          isActive,
        };
      });

      return res.status(200).json({ timeoutMinutes, items });
    } catch {
      return res.status(500).json({ message: "Failed to load sessions" });
    }
  });

  app.post("/api/platform/security/sessions/logout-all", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const { userId, email } = req.body ?? {};
      if (!userId && !email) {
        return res.status(400).json({ message: "userId or email is required" });
      }

      const db = await connectToDatabase();
      const filter: any = { revokedAt: null };
      if (userId) filter.userId = String(userId);
      if (email) filter.email = String(email).trim().toLowerCase();

      const result = await db.collection("auth_sessions").updateMany(filter, {
        $set: { revokedAt: new Date(), revokedReason: "platform_logout_all" },
      });

      await writeAuditEvent(db, {
        tenantId: null,
        action: "SESSIONS_REVOKED",
        description: "Platform admin revoked sessions",
        email: (req.user as any)?.email || null,
        severity: "warning",
        meta: {
          targetUserId: userId ? String(userId) : undefined,
          targetEmail: email ? String(email).trim().toLowerCase() : undefined,
          revokedCount: result?.modifiedCount ?? 0,
        },
      });

      return res.status(200).json({ revokedCount: result?.modifiedCount ?? 0 });
    } catch {
      return res.status(500).json({ message: "Failed to revoke sessions" });
    }
  });

  app.post("/api/platform/security/sessions/revoke", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const sessionId = String((req.body as any)?.sessionId || "").trim();
      const reason = String((req.body as any)?.reason || "platform_revoke").trim() || "platform_revoke";

      if (!sessionId) return res.status(400).json({ message: "sessionId is required" });
      if (!ObjectId.isValid(sessionId)) return res.status(400).json({ message: "Invalid sessionId" });

      const db = await connectToDatabase();
      const _id = new ObjectId(sessionId);

      const session = await db
        .collection("auth_sessions")
        .findOne({ _id }, { projection: { userId: 1, email: 1, tenantId: 1, revokedAt: 1 } });
      if (!session) return res.status(404).json({ message: "Session not found" });

      const result = await db
        .collection("auth_sessions")
        .updateOne({ _id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });

      await writeAuditEvent(db, {
        tenantId: null,
        action: "SESSION_REVOKED",
        description: "Platform admin revoked a session",
        email: (req.user as any)?.email || null,
        severity: "warning",
        meta: {
          sessionId,
          targetUserId: session?.userId ? String(session.userId) : undefined,
          targetEmail: session?.email ? String(session.email) : undefined,
          targetTenantId: session?.tenantId ? String(session.tenantId) : undefined,
          modifiedCount: result?.modifiedCount ?? 0,
        },
      });

      return res.status(200).json({ sessionId, revoked: Boolean(result?.modifiedCount), modifiedCount: result?.modifiedCount ?? 0 });
    } catch {
      return res.status(500).json({ message: "Failed to revoke session" });
    }
  });

  app.get("/api/platform/stripe/webhook-events", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const limitRaw = Number((req.query as any)?.limit ?? 200);
      const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 200));
      const type = typeof (req.query as any)?.type === "string" ? String((req.query as any).type) : "";
      const status = typeof (req.query as any)?.status === "string" ? String((req.query as any).status) : "";

      const filter: any = {};
      if (type) filter.type = type;
      if (status) filter.status = status;

      const db = await connectToDatabase();
      const events = await db
        .collection("stripe_webhook_events")
        .find(filter)
        .sort({ receivedAt: -1, lastReceivedAt: -1 })
        .limit(limit)
        .toArray();

      const items = events.map((e: any) => ({
        id: String(e._id),
        type: e.type ?? null,
        status: e.status ?? null,
        livemode: e.livemode ?? null,
        eventCreatedAt: e.eventCreatedAt ?? null,
        receivedAt: e.receivedAt ?? null,
        lastReceivedAt: e.lastReceivedAt ?? null,
        processedAt: e.processedAt ?? null,
        errorAt: e.errorAt ?? null,
        errorMessage: e.errorMessage ?? null,
        requestId: e.requestId ?? null,
        stripeAccount: e.stripeAccount ?? null,
        summary: e.summary ?? {},
      }));

      return res.status(200).json({ items });
    } catch {
      return res.status(500).json({ message: "Failed to load webhook events" });
    }
  });

  app.get("/api/platform/security/audit-events", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const limitRaw = Number((req.query as any)?.limit ?? 200);
      const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 200));
      const action = typeof (req.query as any)?.action === "string" ? String((req.query as any).action) : "";
      const severity = typeof (req.query as any)?.severity === "string" ? String((req.query as any).severity) : "";

      const filter: any = { type: "audit" };
      if (action) filter.action = action;
      if (severity) filter.severity = severity;

      const db = await connectToDatabase();
      const events = await db
        .collection("history")
        .find(filter)
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      const items = events.map((e: any) => ({
        id: String(e._id),
        tenantId: e.tenantId ?? null,
        action: e.action ?? null,
        description: e.description ?? null,
        email: e.email ?? null,
        severity: e.severity ?? null,
        meta: e.meta ?? null,
        timestamp: e.timestamp ?? e.createdAt ?? null,
      }));

      return res.status(200).json({ items });
    } catch {
      return res.status(500).json({ message: "Failed to load audit events" });
    }
  });

  app.get("/api/platform/error-logs", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const limitRaw = Number((req.query as any)?.limit ?? 200);
      const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 200));

      const db = await connectToDatabase();
      const errors = await db
        .collection("error_logs")
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      const items = errors.map((e: any) => ({
        id: String(e._id),
        kind: e.kind ?? null,
        message: e.message ?? null,
        method: e.method ?? null,
        path: e.path ?? null,
        statusCode: e.statusCode ?? null,
        durationMs: e.durationMs ?? null,
        createdAt: e.createdAt ?? null,
        meta: e.meta ?? null,
      }));

      return res.status(200).json({ items });
    } catch {
      return res.status(500).json({ message: "Failed to load error logs" });
    }
  });

  app.get("/api/platform/job-runs", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const limitRaw = Number((req.query as any)?.limit ?? 200);
      const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 200));

      const db = await connectToDatabase();
      const runs = await db
        .collection("job_runs")
        .find({})
        .sort({ startedAt: -1, createdAt: -1 })
        .limit(limit)
        .toArray();

      const items = runs.map((r: any) => ({
        id: String(r._id),
        taskName: r.taskName ?? null,
        startedAt: r.startedAt ?? null,
        finishedAt: r.finishedAt ?? null,
        durationMs: r.durationMs ?? null,
        success: r.success ?? null,
        errorMessage: r.errorMessage ?? null,
      }));

      return res.status(200).json({ items });
    } catch {
      return res.status(500).json({ message: "Failed to load job runs" });
    }
  });

  const ALERT_WEBHOOK_URL = String(process.env.ALERT_WEBHOOK_URL || "").trim();
  const ALERT_WEBHOOK_ENABLED = String(process.env.ALERT_WEBHOOK_ENABLED || "").toLowerCase() === "true";
  const ALERT_WEBHOOK_COOLDOWN_MS = 30 * 60 * 1000;
  const ALERT_WEBHOOK_ALLOW_LOCALHOST = String(process.env.ALERT_WEBHOOK_ALLOW_LOCALHOST || "").toLowerCase() === "true";

  let lastAlertWebhookKey = "";
  let lastAlertWebhookSentAt = 0;

  const isAllowedWebhookUrl = (raw: string): boolean => {
    if (!raw) return false;
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return false;
    }

    if (u.protocol !== "https:" && u.protocol !== "http:") return false;

    const hostname = String(u.hostname || "").toLowerCase();
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (isLocal && !ALERT_WEBHOOK_ALLOW_LOCALHOST) return false;

    return true;
  };

  app.get("/api/platform/monitoring", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      let db: any = null;
      try {
        db = await connectToDatabase();
      } catch {
        db = null;
      }

      // MongoDB health: ping + latency
      let mongoStatus: "connected" | "slow" | "down" = "down";
      let mongoLatencyMs: number | null = null;
      if (db) {
        try {
          const start = Date.now();
          await db.command({ ping: 1 });
          mongoLatencyMs = Date.now() - start;
          mongoStatus = mongoLatencyMs > 500 ? "slow" : "connected";
        } catch {
          mongoStatus = "down";
          mongoLatencyMs = null;
        }
      }

      // Persist MongoDB ping results so monitoring can report recent DB failures/latency.
      const mongoPingSamples: any[] = Array.isArray((req as any)?.app?.locals?.mongoPings)
        ? ((req as any).app.locals.mongoPings as any[])
        : [];

      mongoPingSamples.push({
        ts: Date.now(),
        ok: mongoStatus !== "down",
        latencyMs: mongoLatencyMs,
      });

      // Keep at most ~10 minutes of ping samples.
      const mongoPingCutoff = Date.now() - 10 * 60 * 1000;
      (req as any).app.locals.mongoPings = mongoPingSamples.filter(
        (s) => typeof s?.ts === "number" && s.ts >= mongoPingCutoff
      );

      // API health: compute average + p95 + error rate (last 5 minutes)
      const samples: any[] = Array.isArray((req as any)?.app?.locals?.apiMetrics)
        ? ((req as any).app.locals.apiMetrics as any[])
        : [];

      const now = Date.now();
      const windowMs = 5 * 60 * 1000;
      const windowStart = now - windowMs;
      const recent = samples.filter((s) => typeof s?.ts === "number" && s.ts >= windowStart);

      const durations = recent
        .map((s) => Number(s?.durationMs))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .sort((a, b) => a - b);

      const avgResponseMs = durations.length
        ? Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length)
        : null;

      const p95ResponseMs = durations.length
        ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
        : null;

      const errorCount = recent.filter((s) => Number(s?.statusCode) >= 500).length;
      const errorRatePct = recent.length ? Number(((errorCount / recent.length) * 100).toFixed(2)) : null;

      // MongoDB error/latency metrics (based on periodic pings performed on monitoring calls)
      const mongoPings: any[] = Array.isArray((req as any)?.app?.locals?.mongoPings)
        ? ((req as any).app.locals.mongoPings as any[])
        : [];
      const mongoRecent = mongoPings.filter((s) => typeof s?.ts === "number" && s.ts >= windowStart);
      const mongoFailureCount = mongoRecent.filter((s) => s?.ok === false).length;
      const mongoFailureRatePct = mongoRecent.length
        ? Number(((mongoFailureCount / mongoRecent.length) * 100).toFixed(2))
        : null;

      const mongoLatencies = mongoRecent
        .map((s) => Number(s?.latencyMs))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .sort((a, b) => a - b);
      const mongoP95LatencyMs = mongoLatencies.length
        ? mongoLatencies[Math.min(mongoLatencies.length - 1, Math.floor(mongoLatencies.length * 0.95))]
        : null;

      const lastMongoFailureTs = mongoRecent
        .filter((s) => s?.ok === false)
        .map((s) => Number(s?.ts))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => b - a)[0];
      const lastMongoFailureAt = Number.isFinite(lastMongoFailureTs) ? new Date(lastMongoFailureTs) : null;

      // Audit activity: last 24h volume + most recent event
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const auditFilter = { $or: [{ timestamp: { $gte: dayAgo } }, { createdAt: { $gte: dayAgo } }] };

      let eventsLast24h = 0;
      let lastEventAt: any = null;
      let tenantEventsLast24h = 0;
      let lastTenantEventAt: any = null;
      let failedJobsLast24h = 0;
      let lastJobFailureAt: any = null;

      if (db) {
        const tenantAuditFilter = {
          tenantId: { $ne: null },
          ...auditFilter,
        } as any;

        const [auditCount, lastEvent, tenantAuditCount, lastTenantEvent] = await Promise.all([
          db.collection("history").countDocuments(auditFilter),
          db.collection("history").find({}).sort({ timestamp: -1, createdAt: -1, _id: -1 }).limit(1).toArray(),
          db.collection("history").countDocuments(tenantAuditFilter),
          db
            .collection("history")
            .find({ tenantId: { $ne: null } })
            .sort({ timestamp: -1, createdAt: -1, _id: -1 })
            .limit(1)
            .toArray(),
        ]);

        eventsLast24h = auditCount;
        lastEventAt = lastEvent?.[0]?.timestamp || lastEvent?.[0]?.createdAt || null;

        tenantEventsLast24h = tenantAuditCount;
        lastTenantEventAt = lastTenantEvent?.[0]?.timestamp || lastTenantEvent?.[0]?.createdAt || null;

        // Job health: failed runs last 24h
        const jobFilter = { startedAt: { $gte: dayAgo } };
        const [failedCount, lastFailedJob] = await Promise.all([
          db.collection("job_runs").countDocuments({ ...jobFilter, success: false }),
          db.collection("job_runs").find({ ...jobFilter, success: false }).sort({ finishedAt: -1, _id: -1 }).limit(1).toArray(),
        ]);

        failedJobsLast24h = failedCount;
        lastJobFailureAt = lastFailedJob?.[0]?.finishedAt || null;
      }

      const detectedAt = new Date().toISOString();

      type PlatformAlert = {
        id: string;
        severity: "critical" | "warning" | "info";
        service: "stripe" | "mongodb" | "api" | "jobs" | "audit" | "tenant-activity";
        title: string;
        detail: string;
        suggestedAction: string;
        detectedAt: string;
      };

      const alerts: PlatformAlert[] = [];

      if (!stripe) {
        alerts.push({
          id: "stripe_not_configured",
          severity: "warning",
          service: "stripe",
          title: "Stripe is not configured",
          detail: "Billing APIs are enabled, but Stripe credentials are missing.",
          suggestedAction: "Set STRIPE_SECRET_KEY (and required price IDs) in the server environment.",
          detectedAt,
        });
      }

      if (mongoStatus === "down") {
        alerts.push({
          id: "mongodb_down",
          severity: "critical",
          service: "mongodb",
          title: "MongoDB is down",
          detail: "Database ping failed. Platform data may be stale or unavailable.",
          suggestedAction: "Check MongoDB connectivity (MONGODB_URI), network access, and database health.",
          detectedAt,
        });
      } else if (mongoStatus === "slow") {
        alerts.push({
          id: "mongodb_slow",
          severity: "warning",
          service: "mongodb",
          title: "MongoDB is slow",
          detail: `Ping p95 is ${mongoP95LatencyMs ?? "—"}ms (last ${5}m).`,
          suggestedAction: "Investigate DB load, indexes, and slow queries.",
          detectedAt,
        });
      }

      if (typeof mongoFailureRatePct === "number" && mongoFailureRatePct > 0) {
        alerts.push({
          id: "mongodb_ping_failures",
          severity: mongoFailureRatePct >= 5 ? "critical" : "warning",
          service: "mongodb",
          title: "MongoDB ping failures detected",
          detail: `Failures: ${mongoFailureCount}/${mongoRecent.length} (${mongoFailureRatePct}%) in last ${5}m.`,
          suggestedAction: "Check intermittent DB/network issues and confirm MongoDB uptime.",
          detectedAt,
        });
      }

      if (typeof p95ResponseMs === "number" && p95ResponseMs > 1500) {
        alerts.push({
          id: "api_p95_high",
          severity: "warning",
          service: "api",
          title: "API p95 latency is high",
          detail: `p95 is ${p95ResponseMs}ms over the last ${5} minutes (samples ${recent.length}).`,
          suggestedAction: "Identify slow endpoints, add caching, and optimize heavy queries/indexes.",
          detectedAt,
        });
      }

      if (typeof errorRatePct === "number" && errorRatePct > 1) {
        alerts.push({
          id: "api_error_rate_high",
          severity: errorRatePct > 5 ? "critical" : "warning",
          service: "api",
          title: "API error rate elevated",
          detail: `Error rate is ${errorRatePct}% over the last ${5} minutes (errors ${errorCount}/${recent.length}).`,
          suggestedAction: "Inspect server logs for 5xx errors and fix the failing route(s).",
          detectedAt,
        });
      }

      if (typeof failedJobsLast24h === "number" && failedJobsLast24h > 0) {
        alerts.push({
          id: "jobs_failing",
          severity: "critical",
          service: "jobs",
          title: "Scheduled jobs are failing",
          detail: `${failedJobsLast24h} failed job(s) recorded in the last 24 hours.`,
          suggestedAction: "Open the Jobs view and check job error messages + stack traces.",
          detectedAt,
        });
      }

      if (typeof eventsLast24h === "number" && eventsLast24h === 0) {
        alerts.push({
          id: "audit_empty_24h",
          severity: "warning",
          service: "audit",
          title: "Audit stream is empty",
          detail: "No audit events were recorded in the last 24 hours.",
          suggestedAction: "Verify scheduler/audit writes are working and confirm DB connectivity.",
          detectedAt,
        });
      }

      const lastTenantDate = lastTenantEventAt ? new Date(String(lastTenantEventAt)) : null;
      const lastTenantMs = lastTenantDate && Number.isFinite(lastTenantDate.getTime()) ? lastTenantDate.getTime() : 0;
      const hoursSinceLastTenant = lastTenantMs ? (Date.now() - lastTenantMs) / (60 * 60 * 1000) : null;

      if (typeof hoursSinceLastTenant === "number" && hoursSinceLastTenant > 24) {
        const days = Math.floor(hoursSinceLastTenant / 24);
        alerts.push({
          id: "tenant_activity_stale",
          severity: hoursSinceLastTenant > 168 ? "critical" : "warning",
          service: "tenant-activity",
          title: "Tenant activity is stale",
          detail: days >= 1 ? `No tenant activity in last ${days} day(s).` : `No tenant activity in last ${Math.floor(hoursSinceLastTenant)}h.`,
          suggestedAction: "Confirm tenants are actively using the app, and validate auth/activity logging.",
          detectedAt,
        });
      }

      const webhookConfigured = ALERT_WEBHOOK_ENABLED && isAllowedWebhookUrl(ALERT_WEBHOOK_URL);
      const criticalAlerts = alerts.filter((a) => a.severity === "critical");
      if (webhookConfigured && criticalAlerts.length) {
        const key = criticalAlerts
          .map((a) => a.id)
          .slice()
          .sort()
          .join(",");

        const tooSoon = Date.now() - lastAlertWebhookSentAt < ALERT_WEBHOOK_COOLDOWN_MS;
        if (!tooSoon || key !== lastAlertWebhookKey) {
          lastAlertWebhookKey = key;
          lastAlertWebhookSentAt = Date.now();

          void axios
            .post(
              ALERT_WEBHOOK_URL,
              {
                source: "subscriptiontracker",
                detectedAt,
                environment: process.env.NODE_ENV ?? null,
                alerts: criticalAlerts,
              },
              { timeout: 5000 }
            )
            .catch(() => {
              // ignore: notifications are best-effort
            });
        }
      }

      res.status(200).json({
        stripeConnected: Boolean(stripe),
        mongo: {
          status: mongoStatus,
          latencyMs: mongoLatencyMs,
          windowMinutes: 5,
          samples: mongoRecent.length,
          failureCount: mongoFailureCount,
          failureRatePct: mongoFailureRatePct,
          p95LatencyMs: mongoP95LatencyMs,
          lastFailureAt: lastMongoFailureAt,
        },
        api: {
          windowMinutes: 5,
          samples: recent.length,
          avgResponseMs,
          p95ResponseMs,
          errorRatePct,
        },
        audit: {
          eventsLast24h,
          lastEventAt,
        },
        tenantActivity: {
          eventsLast24h: tenantEventsLast24h,
          lastEventAt: lastTenantEventAt,
        },
        jobs: {
          failedLast24h: failedJobsLast24h,
          lastFailureAt: lastJobFailureAt,
        },
        alerts,
        notifications: {
          webhookConfigured,
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Failed to fetch platform monitoring", error: errMsg });
    }
  });

  app.get("/api/platform/tenant-health", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const limitRaw = Number((req.query as any)?.limit ?? 200);
      const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 200));

      const activeHoursRaw = Number((req.query as any)?.activeHours ?? 24);
      const activeHours = Math.max(1, Math.min(168, Number.isFinite(activeHoursRaw) ? activeHoursRaw : 24));

      const idleDaysRaw = Number((req.query as any)?.idleDays ?? 7);
      const idleDays = Math.max(1, Math.min(90, Number.isFinite(idleDaysRaw) ? idleDaysRaw : 7));

      const db = await connectToDatabase();

      const platformSettings = await getPlatformSettingsCached(db);
      const timeoutMinutes = Math.max(1, Math.min(24 * 60, Number(platformSettings.security.sessionTimeoutMinutes ?? 30)));
      const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

      const tenants = await db
        .collection("login")
        .aggregate([
          {
            $match: {
              tenantId: { $ne: null },
              role: { $ne: "global_admin" },
            },
          },
          {
            $group: {
              _id: "$tenantId",
              companyName: { $max: "$companyName" },
              createdAt: { $min: "$createdAt" },
              status: { $max: "$status" },
              plan: { $max: "$plan" },
              subscriptionCurrentPeriodEnd: { $max: "$subscriptionCurrentPeriodEnd" },
              emails: { $addToSet: "$email" },
            },
          },
          {
            $project: {
              _id: 0,
              tenantId: { $toString: "$_id" },
              companyName: 1,
              createdAt: 1,
              status: 1,
              plan: 1,
              subscriptionCurrentPeriodEnd: 1,
              users: { $size: "$emails" },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: limit },
        ])
        .toArray();

      const tenantIds = tenants.map((t: any) => String(t.tenantId)).filter(Boolean);

      // Prefer companyInfo name when available
      const companyInfoList = await db
        .collection("companyInfo")
        .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, companyName: 1 } })
        .toArray();
      const companyInfoMap = new Map(companyInfoList.map((ci: any) => [String(ci.tenantId), String(ci.companyName || "")]));

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const activityAgg = await db
        .collection("history")
        .aggregate([
          { $match: { tenantId: { $in: tenantIds } } },
          {
            $group: {
              _id: "$tenantId",
              lastEventAt: { $max: "$timestamp" },
              eventsLast24h: {
                $sum: {
                  $cond: [{ $gte: ["$timestamp", dayAgo] }, 1, 0],
                },
              },
            },
          },
        ])
        .toArray();

      const activityMap = new Map(
        activityAgg.map((row: any) => [
          String(row._id),
          { lastEventAt: row.lastEventAt ?? null, eventsLast24h: row.eventsLast24h ?? 0 },
        ])
      );

      const sessionAgg = await db
        .collection("auth_sessions")
        .aggregate([
          {
            $match: {
              tenantId: { $in: tenantIds },
              revokedAt: null,
              lastSeenAt: { $gte: cutoff },
            },
          },
          {
            $group: {
              _id: "$tenantId",
              activeSessionCount: { $sum: 1 },
              activeUsers: { $addToSet: "$userId" },
            },
          },
          {
            $project: {
              _id: 1,
              activeSessionCount: 1,
              activeUserCount: { $size: "$activeUsers" },
            },
          },
        ])
        .toArray();

      const sessionMap = new Map(
        sessionAgg.map((row: any) => [String(row._id), { activeUsers: row.activeUserCount ?? 0, activeSessions: row.activeSessionCount ?? 0 }])
      );

      const now = Date.now();
      const items = tenants.map((t: any) => {
        const tenantId = String(t.tenantId);
        const activity = activityMap.get(tenantId);
        const sessionInfo = sessionMap.get(tenantId);

        const lastActivityAt = activity?.lastEventAt ? new Date(activity.lastEventAt) : null;
        const lastOk = lastActivityAt && Number.isFinite(lastActivityAt.getTime()) ? lastActivityAt : null;
        const hoursSinceLastActivity = lastOk ? (now - lastOk.getTime()) / (60 * 60 * 1000) : null;
        const daysSince = typeof hoursSinceLastActivity === "number" ? hoursSinceLastActivity / 24 : null;

        let activityStatus: "active" | "idle" | "inactive" = "inactive";
        if (typeof hoursSinceLastActivity === "number") {
          if (hoursSinceLastActivity <= activeHours) activityStatus = "active";
          else if (typeof daysSince === "number" && daysSince <= idleDays) activityStatus = "idle";
          else activityStatus = "inactive";
        }

        return {
          tenantId,
          companyName: companyInfoMap.get(tenantId) || t.companyName || "Unnamed Company",
          plan: t.plan ?? null,
          users: t.users ?? null,
          activeUsers: sessionInfo?.activeUsers ?? 0,
          activeSessions: sessionInfo?.activeSessions ?? 0,
          status: t.status ?? null,
          subscriptionCurrentPeriodEnd: t.subscriptionCurrentPeriodEnd ?? null,
          lastActivityAt: lastOk ? lastOk.toISOString() : null,
          hoursSinceLastActivity: typeof hoursSinceLastActivity === "number" ? Number(hoursSinceLastActivity.toFixed(2)) : null,
          eventsLast24h: activity?.eventsLast24h ?? 0,
          activityStatus,
        };
      });

      const statusRank: Record<string, number> = { active: 0, idle: 1, inactive: 2 };
      items.sort((a: any, b: any) => {
        const ra = statusRank[String(a.activityStatus)] ?? 9;
        const rb = statusRank[String(b.activityStatus)] ?? 9;
        if (ra !== rb) return ra - rb;

        const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return tb - ta;
      });

      return res.status(200).json({ activeHours, idleDays, timeoutMinutes, items });
    } catch {
      return res.status(500).json({ message: "Failed to load tenant health" });
    }
  });

  const PLATFORM_STATS_CACHE_TTL_MS = 60_000;
  let platformStatsCache: { fetchedAt: number; data: any } | null = null;
  let platformStatsInFlight: Promise<any> | null = null;

  app.get("/api/platform/stats", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const ageMs = platformStatsCache ? Date.now() - platformStatsCache.fetchedAt : null;
      if (platformStatsCache && ageMs != null && ageMs < PLATFORM_STATS_CACHE_TTL_MS) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(platformStatsCache.data);
      }

      const fetchStats = async () => {
        const db = await connectToDatabase();

        const [tenantIdsFromLogin, tenantIdsFromCompanyInfo] = await Promise.all([
          db.collection("login").distinct("tenantId", {
            tenantId: { $ne: null },
            role: { $ne: "global_admin" },
          }),
          db.collection("companyInfo").distinct("tenantId", { tenantId: { $ne: null } }),
        ]);

        const tenantIds = new Set(
          [...tenantIdsFromLogin, ...tenantIdsFromCompanyInfo]
            .map((t: any) => (t == null ? null : String(t)))
            .filter(Boolean) as string[]
        );

        const [loginEmails, usersEmails] = await Promise.all([
          db.collection("login").distinct("email", {
            tenantId: { $ne: null },
            role: { $ne: "global_admin" },
          }),
          db.collection("users").distinct("email", { tenantId: { $exists: true, $ne: null } }),
        ]);
        const emailSet = new Set(
          [...loginEmails, ...usersEmails]
            .map((e: any) => (e == null ? null : String(e).trim().toLowerCase()))
            .filter(Boolean) as string[]
        );

        let mrr = 0;
        let totalRevenue = 0;
        let monthlyCollected = 0;
        let paidInvoices = 0;
        let failedInvoices = 0;
        let activeStripeSubscriptions = 0;
        let revenueSource: "stripe" | "subscriptions" = "subscriptions";

        if (stripe) {
          const [stripeSubscriptions, stripeInvoices] = await Promise.all([
            stripe.subscriptions.list({ limit: 100, status: "all" }),
            stripe.invoices.list({ limit: 100 }),
          ]);

          for (const subscription of stripeSubscriptions.data) {
            if (!isActiveStripeSubscriptionStatus((subscription as any).status)) continue;
            activeStripeSubscriptions += 1;
            mrr += getStripeMonthlyAmount(subscription);
          }

          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);

          for (const invoice of stripeInvoices.data) {
            const paymentStatus = getStripePaymentStatus(invoice as any);
            const createdAt = (invoice as any).created
              ? new Date((invoice as any).created * 1000)
              : null;
            const amountPaid = Number((invoice as any).amount_paid ?? 0) / 100;

            if (paymentStatus === "paid") {
              paidInvoices += 1;
              totalRevenue += amountPaid;
              if (createdAt && createdAt >= monthStart) {
                monthlyCollected += amountPaid;
              }
            } else if (paymentStatus === "failed") {
              failedInvoices += 1;
            }
          }

          revenueSource = "stripe";
        } else {
          const activeSubs = await db
            .collection("subscriptions")
            .find(
              {
                tenantId: { $exists: true, $ne: null },
                status: { $regex: /^active$/i },
              },
              { projection: { amount: 1, billingCycle: 1 } }
            )
            .toArray();

          for (const sub of activeSubs) {
            const amountRaw = (sub as any).amount;
            let decryptedAmount: any = amountRaw;
            try {
              decryptedAmount = decrypt(amountRaw);
            } catch {
              decryptedAmount = amountRaw;
            }

            const amount =
              parseFloat(String(decryptedAmount).replace(/[^0-9.-]/g, "")) || 0;
            const billingCycle = String((sub as any).billingCycle || "monthly").toLowerCase();

            let monthlyAmount = amount;
            if (["yearly", "annual", "annually"].includes(billingCycle)) monthlyAmount = amount / 12;
            else if (billingCycle === "quarterly") monthlyAmount = amount / 3;
            else if (billingCycle === "weekly") monthlyAmount = (amount * 52) / 12;
            else if (billingCycle === "daily") monthlyAmount = (amount * 365) / 12;

            mrr += monthlyAmount;
          }
        }

        mrr = Number(mrr.toFixed(2));
        const arr = Number((mrr * 12).toFixed(2));
        totalRevenue = Number(totalRevenue.toFixed(2));
        monthlyCollected = Number(monthlyCollected.toFixed(2));

        return {
          totalCompanies: tenantIds.size,
          totalUsers: emailSet.size,
          mrr,
          arr,
          totalRevenue,
          monthlyCollected,
          paidInvoices,
          failedInvoices,
          activeStripeSubscriptions,
          billingConfigured: Boolean(stripe),
          revenueSource,
        };
      };

      // Stale-while-revalidate: if we have stale data, return it fast and refresh in the background.
      if (platformStatsCache) {
        res.setHeader("X-Cache", "STALE");
        if (!platformStatsInFlight) {
          platformStatsInFlight = fetchStats()
            .then((data) => {
              platformStatsCache = { fetchedAt: Date.now(), data };
              return data;
            })
            .finally(() => {
              platformStatsInFlight = null;
            });
        }
        return res.status(200).json(platformStatsCache.data);
      }

      res.setHeader("X-Cache", "MISS");
      if (!platformStatsInFlight) {
        platformStatsInFlight = fetchStats()
          .then((data) => {
            platformStatsCache = { fetchedAt: Date.now(), data };
            return data;
          })
          .finally(() => {
            platformStatsInFlight = null;
          });
      }

      const data = await platformStatsInFlight;
      return res.status(200).json(data);
    } catch (error) {
      if (platformStatsCache) {
        res.setHeader("X-Cache", "ERROR_STALE");
        return res.status(200).json(platformStatsCache.data);
      }
      const errMsg = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ message: "Failed to fetch platform stats", error: errMsg });
    }
  });

  app.get("/api/platform/companies", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      const db = await connectToDatabase();

      const companies = await db
        .collection("login")
        .aggregate([
          {
            $match: {
              tenantId: { $ne: null },
              role: { $ne: "global_admin" },
            },
          },
          {
            $group: {
              _id: "$tenantId",
              companyName: { $max: "$companyName" },
              createdAt: { $min: "$createdAt" },
              status: { $max: "$status" },
              plan: { $max: "$plan" },
              subscriptionCurrentPeriodEnd: { $max: "$subscriptionCurrentPeriodEnd" },
              stripeSubscriptionId: { $max: "$stripeSubscriptionId" },
              stripeCustomerId: { $max: "$stripeCustomerId" },
              trialEndsAt: { $max: "$trialEndsAt" },
              planActivatedAt: { $max: "$planActivatedAt" },
              planExpiredAt: { $max: "$planExpiredAt" },
              emails: { $addToSet: "$email" },
            },
          },
          {
            $project: {
              _id: 0,
              tenantId: { $toString: "$_id" },
              companyName: 1,
              createdAt: 1,
              status: 1,
              plan: 1,
              subscriptionCurrentPeriodEnd: 1,
              stripeSubscriptionId: 1,
              stripeCustomerId: 1,
              trialEndsAt: 1,
              planActivatedAt: 1,
              planExpiredAt: 1,
              users: { $size: "$emails" },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 100 },
        ])
        .toArray();

      // Prefer companyInfo name when available
      const tenantIds = companies.map((c: any) => c.tenantId).filter(Boolean);
      const companyInfoList = await db
        .collection("companyInfo")
        .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, companyName: 1, createdAt: 1 } })
        .toArray();
      const companyInfoMap = new Map(
        companyInfoList
          .map((ci: any) => [String(ci.tenantId), { companyName: ci.companyName, createdAt: ci.createdAt }])
      );

      const enriched = companies.map((c: any) => {
        const ci = companyInfoMap.get(String(c.tenantId));
        return {
          ...c,
          companyName: (ci?.companyName || c.companyName || "Unnamed Company") as string,
          createdAt: (ci?.createdAt || c.createdAt || null) as any,
        };
      });

      const PRICE_IDS = {
        starter: String(process.env.STRIPE_STARTER_PRICE_ID || ""),
        professional: String(process.env.STRIPE_PROFESSIONAL_PRICE_ID || ""),
      };

      const normalizeCompanyName = (value: unknown) =>
        String(value ?? "")
          .trim()
          .toLowerCase()
          // Drop punctuation/symbol noise but keep letters/numbers/spaces.
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, " ");

      const parseDateMaybe = (raw: unknown): Date | null => {
        if (!raw) return null;
        const d = raw instanceof Date ? raw : new Date(String(raw));
        return Number.isFinite(d.getTime()) ? d : null;
      };

      const planPriority = (plan: unknown) => {
        const normalized = String(plan ?? "").trim().toLowerCase();
        if (normalized === "premium") return 5;
        if (normalized === "professional" || normalized === "pro") return 4;
        if (normalized === "starter") return 3;
        if (normalized === "trial") return 2;
        if (normalized === "free") return 1;
        return 0;
      };

      const bestPlan = (a: unknown, b: unknown) => (planPriority(b) > planPriority(a) ? b : a);

      // Backfill plan + renewal from Stripe if linked but missing.
      if (stripe) {
        const needsStripe = enriched.filter((c: any) =>
          c?.stripeSubscriptionId && (!c?.subscriptionCurrentPeriodEnd || !c?.plan)
        );

        const uniqueSubIds = Array.from(
          new Set(needsStripe.map((c: any) => String(c.stripeSubscriptionId || "")).filter(Boolean))
        ).slice(0, 50);

        if (uniqueSubIds.length) {
          const subPairs = await Promise.all(
            uniqueSubIds.map(async (subId) => {
              try {
                const sub = await stripe.subscriptions.retrieve(subId);
                return [subId, sub] as const;
              } catch {
                return [subId, null] as const;
              }
            })
          );

          const stripeSubMap = new Map(subPairs);

          for (const company of enriched as any[]) {
            const subId = String(company?.stripeSubscriptionId || "");
            if (!subId) continue;
            const sub: any = stripeSubMap.get(subId);
            if (!sub) continue;

            const updates: Record<string, any> = {};

            if (!company.subscriptionCurrentPeriodEnd && (sub as any).current_period_end) {
              updates.subscriptionCurrentPeriodEnd = new Date((sub as any).current_period_end * 1000);
              company.subscriptionCurrentPeriodEnd = updates.subscriptionCurrentPeriodEnd;
            }

            if (!company.plan) {
              const priceId = String((sub as any)?.items?.data?.[0]?.price?.id || "");
              let derivedPlan: string | null = null;
              if (priceId && PRICE_IDS.professional && priceId === PRICE_IDS.professional) derivedPlan = "professional";
              else if (priceId && PRICE_IDS.starter && priceId === PRICE_IDS.starter) derivedPlan = "starter";
              else if ((sub as any)?.metadata?.plan) derivedPlan = String((sub as any).metadata.plan);

              if (derivedPlan) {
                updates.plan = derivedPlan;
                company.plan = derivedPlan;
              }
            }

            if (Object.keys(updates).length && company?.tenantId) {
              await db.collection("login").updateMany({ tenantId: String(company.tenantId) }, { $set: updates });
              await db.collection("signup").updateMany({ tenantId: String(company.tenantId) }, { $set: updates });
            }
          }
        }
      }

      // De-duplicate by normalized company name to avoid case-only duplicates (e.g., Perfecta vs perfecta).
      const dedupedMap = new Map<string, any>();
      for (const c of enriched as any[]) {
        const companyName = String(c.companyName || "");
        const key = normalizeCompanyName(companyName) || `tenant:${String(c.tenantId || "")}`;

        const current = dedupedMap.get(key);
        if (!current) {
          dedupedMap.set(key, { ...c, companyName: companyName || "Unnamed Company" });
          continue;
        }

        const currentUsers = Number(current.users || 0);
        const nextUsers = Number(c.users || 0);
        const keepNextAsCanonical = nextUsers > currentUsers;

        const currentCreated = parseDateMaybe(current.createdAt);
        const nextCreated = parseDateMaybe(c.createdAt);
        const currentRenewal = parseDateMaybe(current.subscriptionCurrentPeriodEnd);
        const nextRenewal = parseDateMaybe(c.subscriptionCurrentPeriodEnd);

        const currentTrial = parseDateMaybe(current.trialEndsAt);
        const nextTrial = parseDateMaybe(c.trialEndsAt);
        const currentActivated = parseDateMaybe(current.planActivatedAt);
        const nextActivated = parseDateMaybe(c.planActivatedAt);
        const currentExpired = parseDateMaybe(current.planExpiredAt);
        const nextExpired = parseDateMaybe(c.planExpiredAt);

        dedupedMap.set(key, {
          ...current,
          ...(keepNextAsCanonical ? { tenantId: c.tenantId } : null),
          companyName: keepNextAsCanonical ? (companyName || current.companyName) : current.companyName,
          createdAt:
            currentCreated && nextCreated
              ? (currentCreated < nextCreated ? currentCreated : nextCreated)
              : (current.createdAt || c.createdAt || null),
          subscriptionCurrentPeriodEnd:
            currentRenewal && nextRenewal
              ? (currentRenewal > nextRenewal ? currentRenewal : nextRenewal)
              : (current.subscriptionCurrentPeriodEnd || c.subscriptionCurrentPeriodEnd || null),
          trialEndsAt:
            currentTrial && nextTrial
              ? (currentTrial > nextTrial ? currentTrial : nextTrial)
              : (current.trialEndsAt || c.trialEndsAt || null),
          planActivatedAt:
            currentActivated && nextActivated
              ? (currentActivated > nextActivated ? currentActivated : nextActivated)
              : (current.planActivatedAt || c.planActivatedAt || null),
          planExpiredAt:
            currentExpired && nextExpired
              ? (currentExpired > nextExpired ? currentExpired : nextExpired)
              : (current.planExpiredAt || c.planExpiredAt || null),
          plan: bestPlan(current.plan, c.plan),
          users: currentUsers + nextUsers,
          status: String(current.status || "").toLowerCase() === "active" || String(c.status || "").toLowerCase() === "active" ? "active" : (current.status || c.status),
        });
      }

      const response = Array.from(dedupedMap.values())
        .sort((a: any, b: any) => {
          const at = parseDateMaybe(a.createdAt)?.getTime?.() || 0;
          const bt = parseDateMaybe(b.createdAt)?.getTime?.() || 0;
          return bt - at;
        })
        .map((c: any) => ({
          tenantId: c.tenantId ? String(c.tenantId) : null,
          companyName: String(c.companyName || "").trim() || (c.tenantId ? `Tenant ${String(c.tenantId)}` : "Organization"),
          plan: c.plan || null,
          users: Number(c.users || 0),
          status: c.status || null,
          createdAt: c.createdAt || null,
          subscriptionCurrentPeriodEnd: c.subscriptionCurrentPeriodEnd || null,
          trialEndsAt: c.trialEndsAt || null,
          planActivatedAt: c.planActivatedAt || null,
          planExpiredAt: c.planExpiredAt || null,
        }));

      res.status(200).json(response);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Failed to fetch companies", error: errMsg });
    }
  });

  app.get("/api/platform/companies/:tenantId", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const tenantId = String((req.params as any)?.tenantId || "").trim();
      if (!tenantId) return res.status(400).json({ message: "tenantId is required" });

      const db = await connectToDatabase();

      const companyInfo = await db
        .collection("companyInfo")
        .findOne({ tenantId }, { projection: { tenantId: 1, companyName: 1, createdAt: 1 } });

      const users = await db
        .collection("login")
        .find(
          { tenantId, role: { $ne: "global_admin" } },
          {
            projection: {
              _id: 1,
              email: 1,
              fullName: 1,
              role: 1,
              status: 1,
              createdAt: 1,
              lastLogin: 1,
              plan: 1,
              subscriptionCurrentPeriodEnd: 1,
              stripeCustomerId: 1,
              stripeSubscriptionId: 1,
              trialEndsAt: 1,
              planActivatedAt: 1,
              planExpiredAt: 1,
            },
          }
        )
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray();

      const normalizeDate = (raw: unknown): Date | null => {
        if (!raw) return null;
        const d = raw instanceof Date ? raw : new Date(String(raw));
        return Number.isFinite(d.getTime()) ? d : null;
      };

      const companyNameFromUsers = users
        .map((u: any) => String(u?.companyName || "").trim())
        .find((n: string) => Boolean(n));

      const deriveNameFromEmail = (email: unknown) => {
        const value = String(email || "").trim().toLowerCase();
        const at = value.indexOf("@");
        if (at < 0) return "";
        const domain = value.slice(at + 1).split("/")[0].trim();
        if (!domain) return "";
        const base = domain.split(".")[0] || domain;
        const cleaned = base.replace(/[^a-z0-9]+/gi, " ").trim();
        if (!cleaned) return domain;
        return cleaned
          .split(/\s+/)
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
          .join(" ");
      };

      const companyNameFromEmail = users
        .map((u: any) => deriveNameFromEmail(u?.email))
        .find((n: string) => Boolean(String(n || "").trim()));

      const company = {
        tenantId,
        companyName: String(companyInfo?.companyName || companyNameFromUsers || companyNameFromEmail || `Tenant ${tenantId}`),
        createdAt: companyInfo?.createdAt || null,
        users: users.length,
        status: users.find((u: any) => String(u?.status || "").toLowerCase() === "active")
          ? "active"
          : (users[0]?.status || null),
        plan: users.map((u: any) => u?.plan).find((p: any) => Boolean(String(p || "").trim())) || null,
        stripeCustomerId: users.map((u: any) => u?.stripeCustomerId).find((v: any) => Boolean(String(v || "").trim())) || null,
        stripeSubscriptionId: users.map((u: any) => u?.stripeSubscriptionId).find((v: any) => Boolean(String(v || "").trim())) || null,
        subscriptionCurrentPeriodEnd: normalizeDate(
          users
            .map((u: any) => normalizeDate(u?.subscriptionCurrentPeriodEnd))
            .filter(Boolean)
            .sort((a: any, b: any) => (a as Date).getTime() - (b as Date).getTime())
            .slice(-1)[0]
        ),
        trialEndsAt: normalizeDate(
          users
            .map((u: any) => normalizeDate(u?.trialEndsAt))
            .filter(Boolean)
            .sort((a: any, b: any) => (a as Date).getTime() - (b as Date).getTime())
            .slice(-1)[0]
        ),
        planActivatedAt: normalizeDate(
          users
            .map((u: any) => normalizeDate(u?.planActivatedAt))
            .filter(Boolean)
            .sort((a: any, b: any) => (a as Date).getTime() - (b as Date).getTime())
            .slice(-1)[0]
        ),
        planExpiredAt: normalizeDate(
          users
            .map((u: any) => normalizeDate(u?.planExpiredAt))
            .filter(Boolean)
            .sort((a: any, b: any) => (a as Date).getTime() - (b as Date).getTime())
            .slice(-1)[0]
        ),
      };

      return res.status(200).json({ company, users });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ message: "Failed to fetch company detail", error: errMsg });
    }
  });

  app.patch("/api/platform/companies/:tenantId", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const tenantId = String((req.params as any)?.tenantId || "").trim();
      if (!tenantId) return res.status(400).json({ message: "tenantId is required" });

      const companyName = typeof (req.body as any)?.companyName === "string" ? String((req.body as any).companyName).trim() : "";
      const planRaw = typeof (req.body as any)?.plan === "string" ? String((req.body as any).plan).trim().toLowerCase() : "";

      if (!companyName && !planRaw) {
        return res.status(400).json({ message: "At least one field (companyName, plan) is required" });
      }
      if (companyName && companyName.length > 200) return res.status(400).json({ message: "companyName is too long" });

      const allowedPlans = new Set(["free", "professional", "pro", "premium"]);
      const plan = planRaw ? (allowedPlans.has(planRaw) ? (planRaw === "pro" ? "professional" : planRaw) : "") : "";
      if (planRaw && !plan) {
        return res.status(400).json({ message: "plan must be free, professional, or premium" });
      }

      const db = await connectToDatabase();

      if (companyName) {
        await db.collection("companyInfo").updateOne(
          { tenantId },
          { $set: { tenantId, companyName, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );

        await db.collection("login").updateMany(
          { tenantId, role: { $ne: "global_admin" } },
          { $set: { companyName } }
        );
      }

      if (plan) {
        const now = new Date();
        await db.collection("login").updateMany(
          { tenantId, role: { $ne: "global_admin" } },
          {
            $set: {
              plan,
              planActivatedAt: now,
              planExpiredAt: null,
            },
          }
        );

        await db.collection("signup").updateMany(
          { tenantId },
          {
            $set: {
              plan,
              planActivatedAt: now,
              planExpiredAt: null,
            },
          }
        );
      }

      await writeAuditEvent(db, {
        tenantId: null,
        action: "TENANT_COMPANY_UPDATED",
        description: "Platform admin updated tenant company profile",
        email: (req.user as any)?.email || null,
        severity: "info",
        meta: { tenantId, ...(companyName ? { companyName } : {}), ...(plan ? { plan } : {}) },
      });

      return res.status(200).json({ tenantId, ...(companyName ? { companyName } : {}), ...(plan ? { plan } : {}) });
    } catch {
      return res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.get("/api/platform/companies/:tenantId/usage", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const tenantId = String((req.params as any)?.tenantId || "").trim();
      if (!tenantId) return res.status(400).json({ message: "tenantId is required" });

      const db = await connectToDatabase();

      const [usersTotal, usersActive, licensesTotal, complianceTotal] = await Promise.all([
        db.collection("login").countDocuments({ tenantId, role: { $ne: "global_admin" } }),
        db.collection("login").countDocuments({ tenantId, role: { $ne: "global_admin" }, status: "active" }),
        db.collection("licenses").countDocuments({ tenantId }),
        db.collection("compliance").countDocuments({ tenantId }),
      ]);

      return res.status(200).json({
        tenantId,
        usersTotal,
        usersActive,
        licensesTotal,
        complianceTotal,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ message: "Failed to fetch tenant usage", error: errMsg });
    }
  });

  app.post("/api/platform/companies/:tenantId/impersonate", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const tenantId = String((req.params as any)?.tenantId || "").trim();
      if (!tenantId) return res.status(400).json({ message: "tenantId is required" });

      const db = await connectToDatabase();
      const settings = await getPlatformSettingsCached(db);
      const allowImpersonation = settings?.security?.allowImpersonation !== false;
      if (!allowImpersonation) return res.status(403).json({ message: "Impersonation is disabled in platform settings" });

      const actor = req.user as any;
      const tokenPayload: any = {
        userId: String(actor?.userId || ""),
        email: String(actor?.email || ""),
        tenantId: null,
        actingTenantId: tenantId,
        role: "global_admin",
        department: actor?.department ?? null,
      };

      const jwtSecret = process.env.JWT_SECRET || "subs_secret_key";
      const token = settings?.security?.jwtExpiryEnabled
        ? jwt.sign(tokenPayload, jwtSecret, { expiresIn: `${settings.security.jwtExpiryMinutes}m` })
        : jwt.sign(tokenPayload, jwtSecret);

      await writeAuditEvent(db, {
        tenantId: null,
        action: "TENANT_IMPERSONATION_STARTED",
        description: "Platform admin started impersonation session",
        email: String(actor?.email || "") || null,
        severity: "warning",
        meta: { actingTenantId: tenantId },
      });

      return res.status(200).json({ token });
    } catch {
      return res.status(500).json({ message: "Failed to start impersonation" });
    }
  });

  app.post("/api/platform/impersonation/exit", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const db = await connectToDatabase();
      const settings = await getPlatformSettingsCached(db);

      const actor = req.user as any;
      const tokenPayload: any = {
        userId: String(actor?.userId || ""),
        email: String(actor?.email || ""),
        tenantId: null,
        actingTenantId: null,
        role: "global_admin",
        department: actor?.department ?? null,
      };

      const jwtSecret = process.env.JWT_SECRET || "subs_secret_key";
      const token = settings?.security?.jwtExpiryEnabled
        ? jwt.sign(tokenPayload, jwtSecret, { expiresIn: `${settings.security.jwtExpiryMinutes}m` })
        : jwt.sign(tokenPayload, jwtSecret);

      await writeAuditEvent(db, {
        tenantId: null,
        action: "TENANT_IMPERSONATION_ENDED",
        description: "Platform admin exited impersonation mode",
        email: String(actor?.email || "") || null,
        severity: "info",
        meta: { previousActingTenantId: String(actor?.actingTenantId || "") || null },
      });

      return res.status(200).json({ token });
    } catch {
      return res.status(500).json({ message: "Failed to exit impersonation" });
    }
  });

  app.patch("/api/platform/companies/:tenantId/status", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const tenantId = String((req.params as any)?.tenantId || "").trim();
      const statusRaw = String((req.body as any)?.status || "").trim().toLowerCase();
      if (!tenantId) return res.status(400).json({ message: "tenantId is required" });
      if (!statusRaw) return res.status(400).json({ message: "status is required" });

      const nextStatus = statusRaw === "active" ? "active" : statusRaw === "suspended" ? "suspended" : "";
      if (!nextStatus) return res.status(400).json({ message: "status must be active or suspended" });

      const db = await connectToDatabase();
      const baseFilter = { tenantId, role: { $ne: "global_admin" } };
      const filter =
        nextStatus === "active"
          ? { ...baseFilter, status: "suspended" }
          : {
              ...baseFilter,
              $or: [
                { status: "active" },
                { status: { $exists: false } },
                { status: null },
                { status: "" },
              ],
            };

      const result = await db.collection("login").updateMany(filter, { $set: { status: nextStatus } });

      if (nextStatus !== "active") {
        const userIds = await db.collection("login").find(baseFilter, { projection: { _id: 1 } }).toArray();
        const ids = userIds.map((u: any) => String(u._id)).filter(Boolean);
        if (ids.length) {
          await db.collection("auth_sessions").updateMany(
            { userId: { $in: ids }, revokedAt: null },
            { $set: { revokedAt: new Date(), revokedReason: "tenant_suspended" } }
          );
        }
      }

      await writeAuditEvent(db, {
        tenantId: null,
        action: "TENANT_STATUS_UPDATED",
        description: `Platform admin set tenant status to ${nextStatus}`,
        email: (req.user as any)?.email || null,
        severity: nextStatus === "active" ? "info" : "warning",
        meta: { tenantId, status: nextStatus, modifiedCount: result?.modifiedCount ?? 0 },
      });

      return res.status(200).json({ tenantId, status: nextStatus, modifiedCount: result?.modifiedCount ?? 0 });
    } catch {
      return res.status(500).json({ message: "Failed to update company status" });
    }
  });

  app.post("/api/platform/companies/:tenantId/offboard", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const tenantId = String((req.params as any)?.tenantId || "").trim();
      if (!tenantId) return res.status(400).json({ message: "tenantId is required" });

      const db = await connectToDatabase();
      const filter = { tenantId, role: { $ne: "global_admin" } };
      const result = await db.collection("login").updateMany(filter, { $set: { status: "disabled" } });

      const userIds = await db.collection("login").find(filter, { projection: { _id: 1 } }).toArray();
      const ids = userIds.map((u: any) => String(u._id)).filter(Boolean);
      if (ids.length) {
        await db.collection("auth_sessions").updateMany(
          { userId: { $in: ids }, revokedAt: null },
          { $set: { revokedAt: new Date(), revokedReason: "tenant_offboarded" } }
        );
      }

      await writeAuditEvent(db, {
        tenantId: null,
        action: "TENANT_OFFBOARDED",
        description: "Platform admin offboarded tenant (soft disable)",
        email: (req.user as any)?.email || null,
        severity: "warning",
        meta: { tenantId, modifiedCount: result?.modifiedCount ?? 0 },
      });

      return res.status(200).json({ tenantId, modifiedCount: result?.modifiedCount ?? 0 });
    } catch {
      return res.status(500).json({ message: "Failed to offboard tenant" });
    }
  });

  app.get("/api/platform/users", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      const db = await connectToDatabase();

      const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();

      const parseDateMaybe = (raw: unknown): Date | null => {
        if (!raw) return null;
        const d = raw instanceof Date ? raw : new Date(String(raw));
        return Number.isFinite(d.getTime()) ? d : null;
      };

      const users = await db
        .collection("login")
        .find(
          { role: { $ne: "global_admin" } },
          {
            projection: {
              _id: 1,
              email: 1,
              fullName: 1,
              companyName: 1,
              tenantId: 1,
              role: 1,
              status: 1,
              createdAt: 1,
              lastLogin: 1,
            },
          }
        )
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray();

      const tenantIds = Array.from(
        new Set(users.map((user: any) => user?.tenantId).filter(Boolean).map((tenantId: any) => String(tenantId)))
      );
      const companyInfoList = await db
        .collection("companyInfo")
        .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, companyName: 1 } })
        .toArray();
      const companyInfoMap = new Map(
        companyInfoList.map((company: any) => [String(company.tenantId), String(company.companyName || "")])
      );

      const byEmail = new Map<string, any[]>();
      for (const user of users as any[]) {
        const email = normalizeEmail(user?.email);
        if (!email) continue;
        const bucket = byEmail.get(email);
        if (bucket) bucket.push(user);
        else byEmail.set(email, [user]);
      }

      const response = Array.from(byEmail.entries())
        .map(([email, records]) => {
          const enriched = records.map((user: any) => {
            const tenantId = user?.tenantId ? String(user.tenantId) : null;
            const companyName = tenantId
              ? (companyInfoMap.get(tenantId) || user?.companyName || null)
              : (user?.companyName || null);

            return {
              ...user,
              email,
              tenantId,
              companyName,
            };
          });

          const uniqueTenantIds = Array.from(new Set(enriched.map((u: any) => u.tenantId).filter(Boolean)));
          const uniqueCompanies = Array.from(new Set(enriched.map((u: any) => u.companyName).filter(Boolean)));

          const candidates = enriched.filter((u: any) => u.tenantId) as any[];
          const pickFrom = candidates.length ? candidates : enriched;

          pickFrom.sort((a: any, b: any) => {
            const al = parseDateMaybe(a.lastLogin)?.getTime?.() || 0;
            const bl = parseDateMaybe(b.lastLogin)?.getTime?.() || 0;
            if (bl !== al) return bl - al;

            const ac = parseDateMaybe(a.createdAt)?.getTime?.() || 0;
            const bc = parseDateMaybe(b.createdAt)?.getTime?.() || 0;
            return bc - ac;
          });

          const canonical = pickFrom[0] || enriched[0];

          return {
            userId: canonical?._id?.toString?.() || String(canonical?._id || ""),
            email,
            fullName: canonical?.fullName || null,
            companyName: canonical?.companyName || null,
            tenantId: canonical?.tenantId || null,
            role: canonical?.role || null,
            status: canonical?.status || null,
            createdAt: canonical?.createdAt || null,
            lastLogin: canonical?.lastLogin || null,
            tenantIds: uniqueTenantIds,
            companyNames: uniqueCompanies,
            multipleCompanies: uniqueTenantIds.length > 1 || uniqueCompanies.length > 1,
          };
        })
        .sort((a: any, b: any) => {
          const at = parseDateMaybe(a.createdAt)?.getTime?.() || 0;
          const bt = parseDateMaybe(b.createdAt)?.getTime?.() || 0;
          return bt - at;
        });

      res.status(200).json(response);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Failed to fetch platform users", error: errMsg });
    }
  });

  app.patch("/api/platform/users/:userId/status", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const userId = String((req.params as any)?.userId || "").trim();
      const statusRaw = String((req.body as any)?.status || "").trim().toLowerCase();
      if (!userId) return res.status(400).json({ message: "userId is required" });
      if (!statusRaw) return res.status(400).json({ message: "status is required" });

      const nextStatus = statusRaw === "active" ? "active" : statusRaw === "inactive" ? "inactive" : "";
      if (!nextStatus) return res.status(400).json({ message: "status must be active or inactive" });

      const db = await connectToDatabase();
      const _id = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
      if (!_id) return res.status(400).json({ message: "Invalid userId" });

      const user = await db.collection("login").findOne({ _id }, { projection: { email: 1, tenantId: 1, role: 1 } });
      if (!user) return res.status(404).json({ message: "User not found" });
      if (String(user.role || "").toLowerCase() === "global_admin") {
        return res.status(400).json({ message: "Cannot modify a global admin account" });
      }

      const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();
      const email = normalizeEmail(user?.email);

      const relatedAccounts = email
        ? await db
            .collection("login")
            .find(
              {
                email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
                role: { $ne: "global_admin" },
              },
              { projection: { _id: 1 } }
            )
            .toArray()
        : [];
      const affectedIds = relatedAccounts.length ? relatedAccounts.map((r: any) => r._id).filter(Boolean) : [_id];
      const affectedUserIds = affectedIds.map((id: any) => String(id));

      const result = await db.collection("login").updateMany({ _id: { $in: affectedIds } }, { $set: { status: nextStatus } });

      if (nextStatus !== "active") {
        await db.collection("auth_sessions").updateMany(
          { userId: { $in: affectedUserIds }, revokedAt: null },
          { $set: { revokedAt: new Date(), revokedReason: "user_deactivated" } }
        );
      }

      await writeAuditEvent(db, {
        tenantId: user?.tenantId ?? null,
        action: "USER_STATUS_UPDATED",
        description: `Platform admin set user status to ${nextStatus}`,
        email: (req.user as any)?.email || null,
        severity: nextStatus === "active" ? "info" : "warning",
        meta: { userId, targetEmail: user?.email || null, status: nextStatus, affectedUserIds },
      });

      return res.status(200).json({ userId, status: nextStatus, modifiedCount: result?.modifiedCount ?? 0, affectedUserIds });
    } catch {
      return res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.patch("/api/platform/users/:userId/role", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const userId = String((req.params as any)?.userId || "").trim();
      const roleRaw = String((req.body as any)?.role || "").trim().toLowerCase();
      if (!userId) return res.status(400).json({ message: "userId is required" });
      if (!roleRaw) return res.status(400).json({ message: "role is required" });

      const allowed = new Set(["super_admin", "viewer", "department_editor", "department_viewer", "admin", "contributor"]);
      if (!allowed.has(roleRaw)) {
        return res.status(400).json({ message: `Invalid role. Allowed: ${Array.from(allowed).join(", ")}` });
      }

      const db = await connectToDatabase();
      const _id = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
      if (!_id) return res.status(400).json({ message: "Invalid userId" });

      const user = await db.collection("login").findOne({ _id }, { projection: { email: 1, tenantId: 1, role: 1 } });
      if (!user) return res.status(404).json({ message: "User not found" });
      if (String(user.role || "").toLowerCase() === "global_admin") {
        return res.status(400).json({ message: "Cannot modify a global admin account" });
      }

      const tenantId = user?.tenantId ? String(user.tenantId) : "";
      const currentRole = String(user?.role || "").trim().toLowerCase();
      if (tenantId && currentRole === "super_admin" && roleRaw !== "super_admin") {
        const remaining = await db.collection("login").countDocuments({ tenantId, role: "super_admin", _id: { $ne: _id } });
        if (remaining <= 0) {
          return res.status(409).json({ message: "Cannot remove the last super_admin for this tenant" });
        }
      }

      const result = await db.collection("login").updateOne({ _id }, { $set: { role: roleRaw } });

      await writeAuditEvent(db, {
        tenantId: user?.tenantId ?? null,
        action: "USER_ROLE_UPDATED",
        description: `Platform admin set user role to ${roleRaw}`,
        email: (req.user as any)?.email || null,
        severity: "warning",
        meta: { userId, targetEmail: user?.email || null, role: roleRaw },
      });

      return res.status(200).json({ userId, role: roleRaw, modifiedCount: result?.modifiedCount ?? 0 });
    } catch {
      return res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Stripe aggregation can be slow, especially on cold starts.
  // Serve cached results immediately (stale-while-revalidate) for a fast refresh UX.
  const PLATFORM_BILLING_CACHE_TTL_MS = 120_000;
  let platformBillingCache: { data: any; fetchedAt: number } | null = null;
  let platformBillingInFlight: Promise<any> | null = null;

  app.get("/api/platform/billing", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;

      const compute = async () => {
        const db = await connectToDatabase();


      const linkedAccountsRaw = await db
        .collection("login")
        .find(
          {
            role: { $ne: "global_admin" },
            $or: [
              { stripeCustomerId: { $exists: true, $nin: [null, ""] } },
              { stripeSubscriptionId: { $exists: true, $nin: [null, ""] } },
            ],
          },
          {
            projection: {
              _id: 1,
              email: 1,
              fullName: 1,
              companyName: 1,
              tenantId: 1,
              plan: 1,
              status: 1,
              createdAt: 1,
              stripeCustomerId: 1,
              stripeSubscriptionId: 1,
              planActivatedAt: 1,
              planExpiredAt: 1,
              subscriptionCurrentPeriodEnd: 1,
            },
          }
        )
        .sort({ planActivatedAt: -1, createdAt: -1 })
        .limit(250)
        .toArray();

      const tenantIds = Array.from(
        new Set(linkedAccountsRaw.map((account: any) => account?.tenantId).filter(Boolean).map((tenantId: any) => String(tenantId)))
      );
      const companyInfoList = await db
        .collection("companyInfo")
        .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, companyName: 1 } })
        .toArray();
      const companyInfoMap = new Map(
        companyInfoList.map((company: any) => [String(company.tenantId), String(company.companyName || "")])
      );

      const accountByEmail = new Map(
        linkedAccountsRaw
          .filter((account: any) => account?.email)
          .map((account: any) => [
            String(account.email).trim().toLowerCase(),
            {
              companyName: companyInfoMap.get(String(account?.tenantId || "")) || null,
              plan: account?.plan || null,
              tenantId: account?.tenantId ? String(account.tenantId) : null,
              stripeCustomerId: account?.stripeCustomerId ? String(account.stripeCustomerId) : null,
              stripeSubscriptionId: account?.stripeSubscriptionId ? String(account.stripeSubscriptionId) : null,
            },
          ])
      );

      const accountByCustomerId = new Map<string, { companyName: string | null; plan: any; tenantId: string | null }>();
      const accountBySubscriptionId = new Map<string, { companyName: string | null; plan: any; tenantId: string | null }>();

      for (const account of linkedAccountsRaw as any[]) {
        const companyName = companyInfoMap.get(String(account?.tenantId || "")) || null;
        const plan = account?.plan || null;
        const tenantId = account?.tenantId ? String(account.tenantId) : null;

        const customerId = account?.stripeCustomerId ? String(account.stripeCustomerId) : "";
        if (customerId) {
          accountByCustomerId.set(customerId, { companyName, plan, tenantId });
        }
        const subscriptionId = account?.stripeSubscriptionId ? String(account.stripeSubscriptionId) : "";
        if (subscriptionId) {
          accountBySubscriptionId.set(subscriptionId, { companyName, plan, tenantId });
        }
      }

      // Domain-based fallback: if a domain maps uniquely to a tenant, use it when Stripe only provides an email.
      // This helps when Stripe uses a billing contact email that differs from the primary login email.
      const accountByDomain = new Map<string, { companyName: string | null; plan: any; tenantId: string | null }>();
      try {
        const domainRows = await db
          .collection("login")
          .find(
            {
              role: { $ne: "global_admin" },
              email: { $exists: true, $nin: [null, ""] },
              tenantId: { $exists: true, $nin: [null, ""] },
            },
            { projection: { email: 1, tenantId: 1, companyName: 1, plan: 1 } }
          )
          .limit(5000)
          .toArray();

        const domainCandidates = new Map<string, { tenantIds: Set<string>; candidate: { companyName: string | null; plan: any; tenantId: string | null } }>();
        for (const row of domainRows as any[]) {
          const email = String(row?.email || "").trim().toLowerCase();
          const domain = email.includes("@") ? email.split("@")[1] : "";
          if (!domain) continue;
          const tenantId = row?.tenantId ? String(row.tenantId) : null;
          if (!tenantId) continue;

          const companyName = companyInfoMap.get(String(tenantId || "")) || null;
          const plan = row?.plan || null;
          const entry = domainCandidates.get(domain) || {
            tenantIds: new Set<string>(),
            candidate: { companyName, plan, tenantId },
          };
          entry.tenantIds.add(tenantId);
          domainCandidates.set(domain, entry);
        }

        for (const [domain, entry] of domainCandidates.entries()) {
          if (entry.tenantIds.size === 1) {
            accountByDomain.set(domain, entry.candidate);
          }
        }
      } catch (e) {
        console.warn("[Platform Billing] Domain mapping build failed:", e);
      }

      const linkedAccounts = linkedAccountsRaw.map((account: any) => ({
        userId: account?._id?.toString?.() || String(account?._id || ""),
        email: String(account?.email || ""),
        fullName: account?.fullName || null,
        companyName: companyInfoMap.get(String(account?.tenantId || "")) || null,
        tenantId: account?.tenantId ? String(account.tenantId) : null,
        role: account?.role || null,
        plan: account?.plan || null,
        status: account?.planExpiredAt ? "expired" : account?.status || "active",
        createdAt: account?.createdAt || account?.planActivatedAt || null,
      }));

      let invoices: any[] = [];
      let payments: any[] = [];
      let subscriptions: any[] = [];
      let mrr = 0;
      let monthlyCollected = 0;

      if (stripe) {
        const [stripeInvoices, stripeSubscriptions] = await Promise.all([
          stripe.invoices.list({ limit: 100, expand: ["data.customer", "data.charge", "data.payment_intent"] as any }),
          stripe.subscriptions.list({ limit: 100, status: "all", expand: ["data.customer"] as any }),
        ]);

        // Extend company lookup with tenantIds embedded in Stripe metadata.
        try {
          const metaTenantIds = new Set<string>();

          for (const invoice of stripeInvoices.data as any[]) {
            const customer = invoice.customer && typeof invoice.customer === "object" ? invoice.customer : null;
            const t = customer?.metadata?.tenantId ? String(customer.metadata.tenantId).trim() : "";
            if (t) metaTenantIds.add(t);
          }

          for (const sub of stripeSubscriptions.data as any[]) {
            const customer = sub.customer && typeof sub.customer === "object" ? sub.customer : null;
            const t1 = sub?.metadata?.tenantId ? String(sub.metadata.tenantId).trim() : "";
            const t2 = customer?.metadata?.tenantId ? String(customer.metadata.tenantId).trim() : "";
            if (t1) metaTenantIds.add(t1);
            if (t2) metaTenantIds.add(t2);
          }

          const missing = Array.from(metaTenantIds).filter((t) => t && !companyInfoMap.has(String(t)));
          if (missing.length) {
            const metaCompanies = await db
              .collection("companyInfo")
              .find({ tenantId: { $in: missing } }, { projection: { tenantId: 1, companyName: 1 } })
              .toArray();
            for (const row of metaCompanies as any[]) {
              const id = String(row?.tenantId || "");
              if (!id) continue;
              companyInfoMap.set(id, String(row?.companyName || ""));
            }
          }
        } catch (e) {
          console.warn("[Platform Billing] Failed to extend company map from Stripe metadata:", e);
        }

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const buildInvoiceReference = (invoice: any): string | null => {
          // Prefer Stripe invoice number in the UI; only generate a fallback reference
          // when Stripe doesn't provide one.
          const number = invoice?.number ? String(invoice.number) : "";
          if (number) return null;
          const id = invoice?.id ? String(invoice.id) : "";
          if (!id) return null;
          return `INV-${id.slice(-6).toUpperCase()}`;
        };

        invoices = stripeInvoices.data.map((invoice: any) => {
          const customer = invoice.customer && typeof invoice.customer === "object" ? invoice.customer : null;
          const customerId =
            typeof invoice.customer === "string" ? String(invoice.customer) : (customer?.id ? String(customer.id) : "");
          const metaTenantId = customer?.metadata?.tenantId ? String(customer.metadata.tenantId).trim() : "";
          const metaCompanyName = customer?.metadata?.companyName ? String(customer.metadata.companyName).trim() : "";
          const metaPlan = customer?.metadata?.plan ? String(customer.metadata.plan).trim() : "";

          const customerName = String(
            metaCompanyName || invoice.customer_name || customer?.name || customer?.email || "Stripe Customer"
          );
          const customerEmail = String(invoice.customer_email || customer?.email || "");
          const subscriptionId = invoice.subscription ? String(invoice.subscription) : "";

          const metaMatch = metaTenantId
            ? {
                tenantId: metaTenantId,
                companyName: companyInfoMap.get(metaTenantId) || metaCompanyName || null,
                plan: metaPlan || null,
              }
            : undefined;

          const accountMatch =
            metaMatch ||
            (customerId ? accountByCustomerId.get(customerId) : undefined) ||
            (subscriptionId ? accountBySubscriptionId.get(subscriptionId) : undefined) ||
            accountByEmail.get(customerEmail.trim().toLowerCase());

          // Keep invoice lifecycle status as Stripe returns it (draft/open/paid/uncollectible/void).
          const invoiceStatus = String(invoice?.status || "unknown").toLowerCase();
          // Separate, payment-oriented status used by the Payments table.
          const paymentStatus = getStripePaymentStatus(invoice);

          const amount = Number(invoice.amount_paid ?? invoice.amount_due ?? 0) / 100;
          const createdAt = invoice.created ? new Date(invoice.created * 1000).toISOString() : null;

          const paidAt = invoice?.status_transitions?.paid_at
            ? new Date(Number(invoice.status_transitions.paid_at) * 1000).toISOString()
            : null;
          const dueTs = invoice?.due_date ?? invoice?.next_payment_attempt ?? null;
          const dueDate = dueTs
            ? new Date(Number(dueTs) * 1000).toISOString()
            : null;

          if (invoiceStatus === "paid" && createdAt) {
            const createdDate = new Date(createdAt);
            if (createdDate >= monthStart) {
              monthlyCollected += amount;
            }
          }

          return {
            id: String(invoice.id),
            invoiceNumber: invoice?.number ? String(invoice.number) : null,
            invoiceReference: buildInvoiceReference(invoice),
            customerName,
            customerEmail,
            companyName: accountMatch?.companyName || metaCompanyName || null,
            plan: accountMatch?.plan || metaPlan || null,
            tenantId: accountMatch?.tenantId || (metaTenantId || null),
            status: invoiceStatus,
            paymentStatus,
            amount,
            currency: String(invoice.currency || "usd"),
            createdAt,
            paidAt,
            dueDate,
            invoiceUrl: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
            subscriptionId: subscriptionId || null,
          };
        });

        // Payments: show only invoices that reached a terminal outcome (paid/failed).
        // This keeps it distinct from the Invoices table (which shows lifecycle states).
        payments = invoices
          .filter((invoice: any) => {
            const s = String(invoice?.paymentStatus || "").toLowerCase();
            return s === "paid" || s === "failed" || s === "refunded";
          })
          .map((invoice: any) => ({
            ...invoice,
            status: String(invoice?.paymentStatus || invoice?.status || "pending"),
          }));

        subscriptions = stripeSubscriptions.data.map((subscription: any) => {
          const customer = subscription.customer && typeof subscription.customer === "object" ? subscription.customer : null;
          const customerId =
            typeof subscription.customer === "string" ? String(subscription.customer) : (customer?.id ? String(customer.id) : "");
          const firstItem = subscription.items?.data?.[0];
          const customerEmail = String(customer?.email || "");
          const subscriptionId = String(subscription.id || "");

          const metaTenantId = subscription?.metadata?.tenantId
            ? String(subscription.metadata.tenantId).trim()
            : (customer?.metadata?.tenantId ? String(customer.metadata.tenantId).trim() : "");
          const metaCompanyName = subscription?.metadata?.companyName
            ? String(subscription.metadata.companyName).trim()
            : (customer?.metadata?.companyName ? String(customer.metadata.companyName).trim() : "");
          const metaPlan = subscription?.metadata?.plan
            ? String(subscription.metadata.plan).trim()
            : (customer?.metadata?.plan ? String(customer.metadata.plan).trim() : "");

          const metaMatch = metaTenantId
            ? {
                tenantId: metaTenantId,
                companyName: companyInfoMap.get(metaTenantId) || metaCompanyName || null,
                plan: metaPlan || null,
              }
            : undefined;

          const accountMatch =
            metaMatch ||
            (customerId ? accountByCustomerId.get(customerId) : undefined) ||
            (subscriptionId ? accountBySubscriptionId.get(subscriptionId) : undefined) ||
            accountByEmail.get(customerEmail.trim().toLowerCase());
          const planName =
            String(
              firstItem?.price?.nickname ||
              firstItem?.plan?.nickname ||
              firstItem?.price?.id ||
              subscriptionId
            );
          const monthlyAmount = getStripeMonthlyAmount(subscription);

          if (isActiveStripeSubscriptionStatus(subscription.status)) {
            mrr += monthlyAmount;
          }

          return {
            id: subscriptionId,
            customerName: String(metaCompanyName || customer?.name || customer?.email || "Stripe Customer"),
            customerEmail,
            companyName: accountMatch?.companyName || metaCompanyName || null,
            tenantId: accountMatch?.tenantId || (metaTenantId || null),
            planName,
            status: String(subscription.status || "unknown"),
            cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
            pauseCollection: Boolean(subscription.pause_collection),
            amountMonthly: Number(monthlyAmount.toFixed(2)),
            currentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
          };
        });

        // Dedupe: show at most 1 active subscription per customer email.
        // This keeps the platform view clean when multiple historical subscriptions exist.
        try {
          const byEmail = new Map<string, any>();
          for (const sub of subscriptions) {
            const emailKey = String(sub.customerEmail || "").trim().toLowerCase();
            const isActive = isActiveStripeSubscriptionStatus(sub.status);
            if (!emailKey) continue;
            if (!isActive) continue;
            const existing = byEmail.get(emailKey);
            if (!existing) byEmail.set(emailKey, sub);
            else {
              const existingEnd = existing.currentPeriodEnd ? new Date(existing.currentPeriodEnd).getTime() : 0;
              const nextEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0;
              if (nextEnd > existingEnd) byEmail.set(emailKey, sub);
            }
          }
          const deduped = Array.from(byEmail.values());
          if (deduped.length) subscriptions = deduped;
        } catch {
          // ignore
        }
      }

      const summary = {
        linkedAccounts: linkedAccounts.length,
        activePlans: linkedAccounts.filter((account: any) => account.plan && account.status !== "expired").length,
        expiredPlans: linkedAccounts.filter((account: any) => account.status === "expired").length,
        paidInvoices: invoices.filter((invoice: any) => String(invoice.status).toLowerCase() === "paid").length,
        failedInvoices: invoices.filter((invoice: any) => String(invoice.paymentStatus || "").toLowerCase() === "failed").length,
        totalRevenue: Number(
          invoices
            .filter((invoice: any) => String(invoice.status).toLowerCase() === "paid")
            .reduce((total: number, invoice: any) => total + Number(invoice.amount || 0), 0)
            .toFixed(2)
        ),
        monthlyCollected: Number(monthlyCollected.toFixed(2)),
        mrr: Number(mrr.toFixed(2)),
        arr: Number((mrr * 12).toFixed(2)),
        activeStripeSubscriptions: subscriptions.filter((subscription: any) => {
          const status = String(subscription.status || "").toLowerCase();
          return isActiveStripeSubscriptionStatus(status);
        }).length,
      };

        return {
          configured: Boolean(stripe),
          summary,
          linkedAccounts,
          invoices,
          payments,
          subscriptions,
        };
      };

      // Serve cached data immediately when available.
      if (platformBillingCache) {
        const ageMs = Date.now() - platformBillingCache.fetchedAt;
        const fresh = ageMs < PLATFORM_BILLING_CACHE_TTL_MS;

        if (fresh) {
          return res.status(200).json({ ...platformBillingCache.data, cached: true });
        }

        // Cache is stale: refresh in the background (deduped) but return last-good now.
        if (!platformBillingInFlight) {
          platformBillingInFlight = compute();
          platformBillingInFlight
            .then((data) => {
              platformBillingCache = { data, fetchedAt: Date.now() };
            })
            .catch((e) => {
              console.warn(
                "[Platform Billing] Background refresh failed:",
                e instanceof Error ? e.message : e
              );
            })
            .finally(() => {
              platformBillingInFlight = null;
            });
        }

        return res.status(200).json({ ...platformBillingCache.data, cached: true, stale: true });
      }

      // No cache: if a compute is already in-flight, await it.
      if (platformBillingInFlight) {
        const data = await platformBillingInFlight;
        return res.status(200).json({ ...data, cached: true });
      }

      // Cold start.
      platformBillingInFlight = compute();
      let data: any;
      try {
        data = await platformBillingInFlight;
      } finally {
        platformBillingInFlight = null;
      }

      platformBillingCache = { data, fetchedAt: Date.now() };
      return res.status(200).json(data);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (platformBillingCache) {
        return res.status(200).json({ ...platformBillingCache.data, stale: true, error: errMsg });
      }
      return res.status(500).json({ message: "Failed to fetch platform billing", error: errMsg });
    }
  });

  app.post("/api/platform/billing/subscriptions/:subscriptionId/cancel", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      if (!stripe) return res.status(400).json({ message: "Stripe is not configured" });

      const subscriptionId = String((req.params as any)?.subscriptionId || "").trim();
      if (!subscriptionId) return res.status(400).json({ message: "subscriptionId is required" });

      const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

      platformBillingCache = null;

      const db = await connectToDatabase();
      await writeAuditEvent(db, {
        tenantId: null,
        action: "STRIPE_SUBSCRIPTION_CANCELLED",
        description: "Platform admin cancelled Stripe subscription (end of period)",
        email: (req.user as any)?.email || null,
        severity: "warning",
        meta: { subscriptionId, cancel_at_period_end: true },
      });

      return res.status(200).json({ id: updated.id, status: updated.status, cancel_at_period_end: updated.cancel_at_period_end });
    } catch (e) {
      return res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.post("/api/platform/billing/subscriptions/:subscriptionId/pause", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      if (!stripe) return res.status(400).json({ message: "Stripe is not configured" });

      const subscriptionId = String((req.params as any)?.subscriptionId || "").trim();
      if (!subscriptionId) return res.status(400).json({ message: "subscriptionId is required" });

      const updated = await stripe.subscriptions.update(subscriptionId, {
        pause_collection: { behavior: "keep_as_draft" },
      });

      platformBillingCache = null;

      const db = await connectToDatabase();
      await writeAuditEvent(db, {
        tenantId: null,
        action: "STRIPE_SUBSCRIPTION_PAUSED",
        description: "Platform admin paused Stripe subscription",
        email: (req.user as any)?.email || null,
        severity: "warning",
        meta: { subscriptionId },
      });

      return res.status(200).json({ id: updated.id, status: updated.status, pause_collection: updated.pause_collection || null });
    } catch {
      return res.status(500).json({ message: "Failed to pause subscription" });
    }
  });

  app.post("/api/platform/billing/subscriptions/:subscriptionId/resume", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      if (!stripe) return res.status(400).json({ message: "Stripe is not configured" });

      const subscriptionId = String((req.params as any)?.subscriptionId || "").trim();
      if (!subscriptionId) return res.status(400).json({ message: "subscriptionId is required" });

      const updated = await stripe.subscriptions.update(subscriptionId, {
        pause_collection: null as any,
      });

      platformBillingCache = null;

      const db = await connectToDatabase();
      await writeAuditEvent(db, {
        tenantId: null,
        action: "STRIPE_SUBSCRIPTION_RESUMED",
        description: "Platform admin resumed Stripe subscription",
        email: (req.user as any)?.email || null,
        severity: "info",
        meta: { subscriptionId },
      });

      return res.status(200).json({ id: updated.id, status: updated.status, pause_collection: updated.pause_collection || null });
    } catch {
      return res.status(500).json({ message: "Failed to resume subscription" });
    }
  });

  app.post("/api/platform/billing/subscriptions/:subscriptionId/plan", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      if (!stripe) return res.status(400).json({ message: "Stripe is not configured" });

      const subscriptionId = String((req.params as any)?.subscriptionId || "").trim();
      const plan = String((req.body as any)?.plan || "").trim().toLowerCase();
      if (!subscriptionId) return res.status(400).json({ message: "subscriptionId is required" });
      if (!plan) return res.status(400).json({ message: "plan is required" });

      const PRICE_IDS = {
        starter: String(process.env.STRIPE_STARTER_PRICE_ID || ""),
        professional: String(process.env.STRIPE_PROFESSIONAL_PRICE_ID || ""),
        premium: String(process.env.STRIPE_PREMIUM_PRICE_ID || ""),
      };

      if (!PRICE_IDS.starter && !PRICE_IDS.professional) {
        return res.status(400).json({ message: "Stripe price IDs are not configured" });
      }

      if (plan === "free") {
        // Immediate downgrade: cancel subscription now and mark the tenant as free.
        const deleted = await stripe.subscriptions.cancel(subscriptionId);

        const db = await connectToDatabase();
        const now = new Date();
        await db.collection("login").updateMany(
          { stripeSubscriptionId: subscriptionId },
          {
            $set: {
              plan: "free",
              planActivatedAt: now,
              planExpiredAt: null,
              subscriptionCurrentPeriodEnd: null,
              stripeSubscriptionId: null,
            },
          }
        );
        await db.collection("signup").updateMany(
          { stripeSubscriptionId: subscriptionId },
          {
            $set: {
              plan: "free",
              planActivatedAt: now,
              planExpiredAt: null,
              subscriptionCurrentPeriodEnd: null,
              stripeSubscriptionId: null,
            },
          }
        );

        platformBillingCache = null;

        await writeAuditEvent(db, {
          tenantId: null,
          action: "STRIPE_SUBSCRIPTION_PLAN_CHANGED",
          description: "Platform admin downgraded subscription to free (cancelled)",
          email: (req.user as any)?.email || null,
          severity: "warning",
          meta: { subscriptionId, plan: "free" },
        });

        return res.status(200).json({ id: deleted.id, status: deleted.status, plan: "free" });
      }

      const nextPriceId =
        plan === "professional" || plan === "pro"
          ? PRICE_IDS.professional
          : plan === "premium"
            ? PRICE_IDS.premium
          : plan === "starter"
            ? PRICE_IDS.starter
            : "";

      if (!nextPriceId) {
        return res.status(400).json({ message: "plan must be free, starter, professional, or premium" });
      }

      const sub: any = await stripe.subscriptions.retrieve(subscriptionId);
      const firstItem = sub?.items?.data?.[0];
      const itemId = firstItem?.id ? String(firstItem.id) : "";
      if (!itemId) return res.status(400).json({ message: "Subscription has no items to update" });

      const updated = await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: nextPriceId }],
        metadata: { ...(sub?.metadata || {}), plan },
      });

      platformBillingCache = null;

      const db = await connectToDatabase();
      await writeAuditEvent(db, {
        tenantId: null,
        action: "STRIPE_SUBSCRIPTION_PLAN_CHANGED",
        description: "Platform admin changed Stripe subscription plan",
        email: (req.user as any)?.email || null,
        severity: "warning",
        meta: { subscriptionId, plan },
      });

      return res.status(200).json({ id: updated.id, status: updated.status });
    } catch {
      return res.status(500).json({ message: "Failed to change plan" });
    }
  });

  app.post("/api/platform/billing/invoices/:invoiceId/send-email", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      if (!stripe) return res.status(400).json({ message: "Stripe is not configured" });

      const invoiceId = String((req.params as any)?.invoiceId || "").trim();
      if (!invoiceId) return res.status(400).json({ message: "invoiceId is required" });

      const sent = await stripe.invoices.sendInvoice(invoiceId);
      platformBillingCache = null;

      const db = await connectToDatabase();
      await writeAuditEvent(db, {
        tenantId: null,
        action: "STRIPE_INVOICE_SENT",
        description: "Platform admin triggered Stripe invoice email",
        email: (req.user as any)?.email || null,
        severity: "info",
        meta: { invoiceId },
      });

      return res.status(200).json({ id: sent.id, status: sent.status });
    } catch {
      return res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  app.post("/api/platform/billing/payments/:invoiceId/refund", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      if (!stripe) return res.status(400).json({ message: "Stripe is not configured" });

      const invoiceId = String((req.params as any)?.invoiceId || "").trim();
      if (!invoiceId) return res.status(400).json({ message: "invoiceId is required" });

      const invoice: any = await stripe.invoices.retrieve(invoiceId, { expand: ["payment_intent", "charge"] as any });
      const pi = invoice?.payment_intent && typeof invoice.payment_intent === "object" ? invoice.payment_intent : null;
      const charge = invoice?.charge && typeof invoice.charge === "object" ? invoice.charge : null;
      const paymentIntentId = typeof invoice?.payment_intent === "string" ? String(invoice.payment_intent) : (pi?.id ? String(pi.id) : "");
      const chargeId = typeof invoice?.charge === "string" ? String(invoice.charge) : (charge?.id ? String(charge.id) : "");

      if (!paymentIntentId && !chargeId) {
        return res.status(400).json({ message: "Invoice has no refundable payment intent/charge" });
      }

      const refund = await stripe.refunds.create(paymentIntentId ? { payment_intent: paymentIntentId } : { charge: chargeId });
      platformBillingCache = null;

      const db = await connectToDatabase();
      await writeAuditEvent(db, {
        tenantId: null,
        action: "STRIPE_PAYMENT_REFUNDED",
        description: "Platform admin created Stripe refund",
        email: (req.user as any)?.email || null,
        severity: "warning",
        meta: { invoiceId, refundId: refund?.id || null, paymentIntentId: paymentIntentId || null, chargeId: chargeId || null },
      });

      return res.status(200).json({ refundId: refund?.id || null, status: refund?.status || null });
    } catch {
      return res.status(500).json({ message: "Failed to refund payment" });
    }
  });

  app.get("/api/platform/activity", async (req, res) => {
    try {
      if (!requireGlobalAdmin(req, res)) return;
      const db = await connectToDatabase();

      // Return enough events for a correct last-7-days volume chart + latest list.
      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      const start = new Date(now.getTime() - 6 * dayMs);
      start.setHours(0, 0, 0, 0);

      const activity = await db
        .collection("history")
        .find({
          $or: [{ timestamp: { $gte: start } }, { createdAt: { $gte: start } }],
        })
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(500)
        .toArray();

      const tenantIds = Array.from(
        new Set(activity.map((a: any) => a?.tenantId).filter(Boolean).map((t: any) => String(t)))
      );
      const companyInfoList = await db
        .collection("companyInfo")
        .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, companyName: 1 } })
        .toArray();
      const companyInfoMap = new Map(companyInfoList.map((ci: any) => [String(ci.tenantId), String(ci.companyName || "")]));

      const enriched = activity.map((a: any) => ({
        ...a,
        _id: a?._id?.toString?.() || a?._id,
        companyName: companyInfoMap.get(String(a?.tenantId)) || null,
      }));

      res.status(200).json(enriched);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Failed to fetch platform activity", error: errMsg });
    }
  });

  // ===== Update Current User (Profile / Password) =====
  app.put("/api/me", async (req, res) => {
    try {
      const user = req.user as any;
      const effectiveTenantId =
        user?.role === "global_admin"
          ? (user?.actingTenantId ?? user?.tenantId ?? null)
          : (user?.tenantId ?? null);

      if (!user?.userId) {
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

      // Resolve which record we're updating.
      // - Non-global users: update the tenant-bound record (email + tenantId)
      // - global_admin: update the identity record (tenantId=null) regardless of acting tenant context
      const isGlobalAdmin = user?.role === "global_admin";
      if (!isGlobalAdmin && !effectiveTenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const dbUser = isGlobalAdmin
        ? userRecord
        : await db.collection("login").findOne({ email: userRecord.email, tenantId: effectiveTenantId });

      if (!dbUser) {
        return res.status(404).json({ message: "Company not found for this tenant" });
      }

      const tenantId = isGlobalAdmin ? (dbUser.tenantId ?? null) : effectiveTenantId;
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
        isGlobalAdmin ? { _id: dbUser._id } : { _id: dbUser._id, tenantId },
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
        const tokenPayload: any = {
          userId: user.userId,
          email: nextEmail,
          tenantId: isGlobalAdmin ? null : user.tenantId,
          actingTenantId: isGlobalAdmin ? (user.actingTenantId ?? null) : undefined,
          role,
          department,
        };
        tokenPayload.jti = crypto.randomUUID();

        const platformSettings = await getPlatformSettingsCached(db);
        const jwtSecret = process.env.JWT_SECRET || "subs_secret_key";
        const token = platformSettings.security.jwtExpiryEnabled
          ? jwt.sign(tokenPayload, jwtSecret, { expiresIn: `${platformSettings.security.jwtExpiryMinutes}m` })
          : jwt.sign(tokenPayload, jwtSecret);

        try {
          await db.collection("auth_sessions").insertOne({
            _id: tokenPayload.jti,
            userId: String(tokenPayload.userId),
            email: String(nextEmail),
            tenantId: tokenPayload.tenantId ?? null,
            actingTenantId: tokenPayload.actingTenantId ?? null,
            role: String(role || ""),
            createdAt: new Date(),
            lastSeenAt: new Date(),
            revokedAt: null,
          });
        } catch {
          // non-blocking
        }

        const isProd = process.env.NODE_ENV === "production";
        res.cookie("token", token, {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
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

      const isGlobalAdmin = user?.role === "global_admin";

      const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const makeEmailRegex = (raw: unknown) => {
        const key = normalizeEmail(raw);
        if (!key) return null;
        return new RegExp(`^${escapeRegExp(key)}$`, "i");
      };

      // Global admin sees ALL companies (tenants). Normal users are pinned to their active tenant.
      // IMPORTANT: company names may be stored in `companyInfo` even when `login.companyName` is missing.
      let companyList: Array<{ tenantId: string; companyName: string; isActive: boolean }> = [];
      if (isGlobalAdmin) {
        const [tenantIdsFromLogin, tenantIdsFromCompanyInfo] = await Promise.all([
          db.collection("login").distinct("tenantId", { tenantId: { $ne: null } }),
          db.collection("companyInfo").distinct("tenantId", { tenantId: { $ne: null } }),
        ]);

        const tenantIds = Array.from(
          new Set(
            [...tenantIdsFromLogin, ...tenantIdsFromCompanyInfo]
              .map((t: any) => (t == null ? "" : String(t)))
              .map((t) => t.trim())
              .filter((t) => {
                if (!t) return false;
                const lower = t.toLowerCase();
                if (lower === "null" || lower === "undefined") return false;
                return true;
              })
          )
        );

        if (tenantIds.length === 0) {
          return res.status(200).json([]);
        }

        const [companyInfoList, loginNameAgg] = await Promise.all([
          db
            .collection("companyInfo")
            .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, companyName: 1 } })
            .toArray(),
          db
            .collection("login")
            .aggregate([
              { $match: { tenantId: { $in: tenantIds }, companyName: { $exists: true, $ne: null } } },
              { $group: { _id: "$tenantId", companyName: { $max: "$companyName" } } },
            ])
            .toArray(),
        ]);

        const companyInfoMap = new Map(
          (companyInfoList as any[]).map((ci: any) => [String(ci.tenantId), String(ci.companyName || "").trim()])
        );
        const loginNameMap = new Map(
          (loginNameAgg as any[]).map((row: any) => [String(row._id), String(row.companyName || "").trim()])
        );

        const activeTenant = String(((user as any)?.actingTenantId ?? user.tenantId) ?? "");
        companyList = tenantIds.map((tid) => ({
          tenantId: tid,
          companyName: companyInfoMap.get(tid) || loginNameMap.get(tid) || "Unnamed Company",
          isActive: tid === activeTenant,
        }));

        companyList.sort((a, b) => a.companyName.localeCompare(b.companyName));
      } else {
        // Non-admins can switch ONLY between companies where the same email exists in multiple tenant records.
        const tokenEmail = normalizeEmail((user as any)?.email);
        const dbUser = await db
          .collection("login")
          .findOne(
            { _id: new ObjectId(user.userId) },
            { projection: { email: 1, tenantId: 1 } }
          );

        const emailKey = tokenEmail || normalizeEmail((dbUser as any)?.email);
        const emailRegex = makeEmailRegex(emailKey);

        const activeTenantId = (user as any)?.tenantId || (dbUser as any)?.tenantId;
        const activeTenant = String(((user as any)?.actingTenantId ?? activeTenantId) ?? "").trim();

        if (!emailRegex) {
          // Fall back to the active tenant only.
          const tid = String(activeTenantId || "").trim();
          if (!tid) return res.status(200).json([]);
          const companyInfo = await db
            .collection("companyInfo")
            .findOne({ tenantId: tid }, { projection: { tenantId: 1, companyName: 1 } });
          const loginCompany = await db
            .collection("login")
            .findOne({ tenantId: tid, companyName: { $exists: true, $ne: null } }, { projection: { tenantId: 1, companyName: 1 } });
          const name =
            String((companyInfo as any)?.companyName || "").trim() ||
            String((loginCompany as any)?.companyName || "").trim() ||
            "Unnamed Company";
          companyList = [{ tenantId: tid, companyName: name, isActive: tid === activeTenant }];
          return res.status(200).json(companyList);
        }

        const tenantIdsRaw = await db.collection("login").distinct("tenantId", {
          email: { $regex: emailRegex },
          tenantId: { $ne: null },
        });

        const tenantIds = Array.from(
          new Set(
            (tenantIdsRaw as any[])
              .map((t: any) => (t == null ? "" : String(t)))
              .map((t) => t.trim())
              .filter((t) => {
                if (!t) return false;
                const lower = t.toLowerCase();
                if (lower === "null" || lower === "undefined") return false;
                return true;
              })
          )
        );

        if (!tenantIds.length) {
          // Fall back to the active tenant only.
          const tid = String(activeTenantId || "").trim();
          if (!tid) return res.status(200).json([]);
          companyList = [{ tenantId: tid, companyName: "Unnamed Company", isActive: tid === activeTenant }];
          return res.status(200).json(companyList);
        }

        const [companyInfoList, loginNameAgg] = await Promise.all([
          db
            .collection("companyInfo")
            .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1, companyName: 1 } })
            .toArray(),
          db
            .collection("login")
            .aggregate([
              {
                $match: {
                  tenantId: { $in: tenantIds },
                  email: { $regex: emailRegex },
                  companyName: { $exists: true, $ne: null },
                },
              },
              { $group: { _id: "$tenantId", companyName: { $max: "$companyName" } } },
            ])
            .toArray(),
        ]);

        const companyInfoMap = new Map(
          (companyInfoList as any[]).map((ci: any) => [String(ci.tenantId), String(ci.companyName || "").trim()])
        );
        const loginNameMap = new Map(
          (loginNameAgg as any[]).map((row: any) => [String(row._id), String(row.companyName || "").trim()])
        );

        companyList = tenantIds
          .map((tid) => ({
            tenantId: tid,
            companyName: companyInfoMap.get(tid) || loginNameMap.get(tid) || "Unnamed Company",
            isActive: tid === activeTenant,
          }))
          .sort((a, b) => a.companyName.localeCompare(b.companyName));
      }
      
      res.setHeader("X-Company-Count", String(companyList.length));
      return res.status(200).json(companyList);
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
        const tenantKey = String(tenantId).trim();
        const [existsInCompanyInfo, existsInLogin] = await Promise.all([
          db.collection("companyInfo").findOne({ tenantId: tenantKey }, { projection: { tenantId: 1 } }),
          db.collection("login").findOne({ tenantId: tenantKey }, { projection: { tenantId: 1 } }),
        ]);
        if (!existsInCompanyInfo && !existsInLogin) {
          return res.status(404).json({ message: 'Company not found' });
        }
      }
      
      const normalizeEmail = (raw: unknown) => String(raw ?? "").trim().toLowerCase();
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const makeEmailRegex = (raw: unknown) => {
        const key = normalizeEmail(raw);
        if (!key) return null;
        return new RegExp(`^${escapeRegExp(key)}$`, "i");
      };

      // Non-global-admin switching is allowed ONLY when the same email exists in the target tenant.
      // This supports multi-company users without opening cross-tenant access.
      const tenantKey = String(tenantId).trim();
      if (!tenantKey) {
        return res.status(400).json({ message: "tenantId is required" });
      }

      let effectiveUser = dbUser as any;
      if (!isGlobalAdmin) {
        const emailRegex = makeEmailRegex((dbUser as any)?.email || (user as any)?.email);
        if (!emailRegex) {
          return res.status(403).json({ message: "Company switching is not available for this account." });
        }
        const match = await db.collection("login").findOne({
          email: { $regex: emailRegex },
          tenantId: tenantKey,
        });
        if (!match) {
          return res.status(403).json({ message: "You do not have access to this company." });
        }
        effectiveUser = match;
      }

      // Generate new token
      const tokenPayload: any = {
        userId: String((effectiveUser as any)._id || user.userId),
        email: String((effectiveUser as any).email || dbUser.email || user.email || ""),
        role: (effectiveUser as any).role || dbUser.role || user.role || 'viewer',
      };
      tokenPayload.jti = crypto.randomUUID();
      if (isGlobalAdmin) {
        tokenPayload.tenantId = null;
        tokenPayload.actingTenantId = tenantKey;
      } else {
        tokenPayload.tenantId = tenantKey;
      }
      
      const platformSettings = await getPlatformSettingsCached(db);
      const jwtSecret = process.env.JWT_SECRET || "subs_secret_key";
      const token = platformSettings.security.jwtExpiryEnabled
        ? jwt.sign(tokenPayload, jwtSecret, { expiresIn: `${platformSettings.security.jwtExpiryMinutes}m` })
        : jwt.sign(tokenPayload, jwtSecret);

      try {
        await db.collection("auth_sessions").insertOne({
          _id: tokenPayload.jti,
          userId: String(tokenPayload.userId),
          email: String(tokenPayload.email || ""),
          tenantId: tokenPayload.tenantId ?? null,
          actingTenantId: tokenPayload.actingTenantId ?? null,
          role: String(tokenPayload.role || ""),
          createdAt: new Date(),
          lastSeenAt: new Date(),
          revokedAt: null,
        });
      } catch {
        // non-blocking
      }
      
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: (isProd ? "none" : "lax") as any,
        path: "/",
        // No maxAge - session cookie expires when browser closes
      });
      
      res.status(200).json({ 
        message: "Company switched successfully",
        tenantId,
        token,
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

      // Enforce unique company name (case/punctuation/spacing-insensitive).
      const normalizeCompanyKey = (value: unknown) =>
        String(value ?? "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

      const desiredKey = normalizeCompanyKey(companyName);
      if (desiredKey) {
        const [loginNames, companyInfoNames] = await Promise.all([
          db.collection("login").distinct("companyName", {
            tenantId: { $ne: null },
            role: { $ne: "global_admin" },
            companyName: { $exists: true, $ne: null },
          }),
          db.collection("companyInfo").distinct("companyName", { companyName: { $exists: true, $ne: null } }),
        ]);

        const existingKeys = new Set(
          [...loginNames, ...companyInfoNames].map(normalizeCompanyKey).filter(Boolean)
        );

        if (existingKeys.has(desiredKey)) {
          return res.status(409).json({ message: "Company name already exists. Please use a unique company name." });
        }
      }

      // Multi-company mode: create a new tenant + a tenant-bound login record for the SAME email.
      // This preserves existing per-tenant data partitioning (tenantId) and works with the company switcher.
      const tenantId = `tenant-${new ObjectId().toHexString()}`;
      const now = new Date();

      const emailKey = String(email).trim().toLowerCase();
      const fullName = String((dbUser as any)?.fullName || (dbUser as any)?.name || "").trim();

      const newLoginDoc: any = {
        email: emailKey,
        password: (dbUser as any).password,
        fullName: fullName || null,
        name: (dbUser as any)?.name || null,
        tenantId,
        companyName: String(companyName).trim(),
        defaultCurrency: String(defaultCurrency).trim().toUpperCase(),
        role: "super_admin",
        status: "active",
        createdAt: now,
        lastLogin: null,
        isDefaultCompany: Boolean(setAsDefault),
      };

      if (setAsDefault) {
        await db.collection("login").updateMany(
          { email: emailKey, tenantId: { $ne: null } },
          { $set: { isDefaultCompany: false } }
        );
      }

      const insertResult = await db.collection("login").insertOne(newLoginDoc);

      // Seed companyInfo (so the company name shows consistently in dashboards/platform views).
      try {
        await db.collection("companyInfo").updateOne(
          { tenantId },
          {
            $setOnInsert: {
              tenantId,
              companyName: String(companyName).trim(),
              defaultCurrency: String(defaultCurrency).trim().toUpperCase(),
              createdAt: now,
            },
          },
          { upsert: true }
        );
      } catch {
        // non-blocking
      }

      // If requested, switch the current session into the new tenant immediately.
      if (setAsDefault) {
        const platformSettings = await getPlatformSettingsCached(db);
        const jwtSecret = process.env.JWT_SECRET || "subs_secret_key";
        const tokenPayload: any = {
          userId: insertResult.insertedId?.toString?.() || String(insertResult.insertedId),
          email: emailKey,
          tenantId,
          role: "super_admin",
        };
        tokenPayload.jti = crypto.randomUUID();

        const token = platformSettings.security.jwtExpiryEnabled
          ? jwt.sign(tokenPayload, jwtSecret, { expiresIn: `${platformSettings.security.jwtExpiryMinutes}m` })
          : jwt.sign(tokenPayload, jwtSecret);

        try {
          await db.collection("auth_sessions").insertOne({
            _id: tokenPayload.jti,
            userId: String(tokenPayload.userId),
            email: emailKey,
            tenantId,
            actingTenantId: null,
            role: "super_admin",
            createdAt: now,
            lastSeenAt: now,
            revokedAt: null,
          });
        } catch {
          // non-blocking
        }

        const isProd = process.env.NODE_ENV === "production";
        res.cookie("token", token, {
          httpOnly: true,
          secure: isProd,
          sameSite: (isProd ? "none" : "lax") as any,
          path: "/",
        });

        return res.status(200).json({ message: "Company added", tenantId, token });
      }

      return res.status(200).json({ message: "Company added", tenantId });
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
        ),
        // Subscription reminders live in the "reminders" collection (derived notifications)
        db.collection("reminders").updateMany(
          query,
          { $set: { isRead: true, readAt: new Date() } }
        )
      ];

      const results = await Promise.all(updatePromises);
      const totalModified = results.reduce((sum, r) => sum + (r.modifiedCount || 0), 0);

      console.log(
        `✅ Marked ${totalModified} notification(s) as read (notifications: ${results[0].modifiedCount}, events: ${results[1].modifiedCount}, compliance: ${results[2].modifiedCount}, reminders: ${results[3].modifiedCount})`
      );

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