import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
// @ts-ignore
import { registerRoutes } from "./routes.js";
import { enforceHttps, securityHeaders, sanitizeHeaders } from "./middleware/security.middleware.js";
// @ts-ignore
import { registerStripeRoutes } from "./stripe.routes.js";
import net from "node:net";

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`[${formattedTime}] [${source}] ${message}`);
}

function normalizeDateString(value: any): any {
  if (!value || typeof value !== "string") return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return value;
}

function parseDateOnlyUtc(value: any): Date | null {
  if (!value) return null;
  const normalized = normalizeDateString(value);
  if (typeof normalized === "string" && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const d = new Date(`${normalized}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(normalized));
  return isNaN(d.getTime()) ? null : d;
}

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

function msUntilNextMidnightIST(nowUtc = new Date()): number {
  const nowUtcMs = nowUtc.getTime();
  const nowIstMs = nowUtcMs + IST_OFFSET_MS;
  const nowIst = new Date(nowIstMs);

  // Treat IST time as UTC for calculation (use UTC getters/setters)
  const y = nowIst.getUTCFullYear();
  const m = nowIst.getUTCMonth();
  const d = nowIst.getUTCDate();

  // Next day's midnight in IST
  const nextMidnightIstMs = Date.UTC(y, m, d + 1, 0, 0, 0, 0);
  const nextMidnightUtcMs = nextMidnightIstMs - IST_OFFSET_MS;
  const delay = nextMidnightUtcMs - nowUtcMs;

  // Safety: never schedule negative/zero delays
  return Math.max(delay, 1000);
}

async function recordJobRun(event: {
  taskName: string;
  startedAt: Date;
  finishedAt: Date;
  success: boolean;
  errorMessage?: string | null;
}) {
  try {
    const { connectToDatabase } = await import("./mongo.js");
    const db = await connectToDatabase();
    const durationMs = event.finishedAt.getTime() - event.startedAt.getTime();

    await db.collection("job_runs").insertOne({
      taskName: event.taskName,
      startedAt: event.startedAt,
      finishedAt: event.finishedAt,
      durationMs,
      success: event.success,
      errorMessage: event.errorMessage ?? null,
      createdAt: new Date(),
    });

    // Also surface scheduler execution in the audit/activity stream.
    // Keeps platform audit from being empty in real deployments.
    await db.collection("history").insertOne({
      tenantId: null,
      type: "scheduler",
      action: "SCHEDULER_RUN",
      description: event.success
        ? `Scheduler job completed: ${event.taskName}`
        : `Scheduler job failed: ${event.taskName}`,
      severity: event.success ? "info" : "error",
      meta: {
        taskName: event.taskName,
        durationMs,
        errorMessage: event.errorMessage ?? null,
      },
      timestamp: new Date(),
      createdAt: new Date(),
    });
  } catch (e) {
    log(`Failed to record job run (${event.taskName}): ${e}`, "scheduler");
  }
}

async function runJobNow(taskName: string, task: () => Promise<void> | void) {
  const startedAt = new Date();
  let success = true;
  let errorMessage: string | null = null;

  try {
    await task();
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    await recordJobRun({
      taskName,
      startedAt,
      finishedAt: new Date(),
      success,
      errorMessage,
    });
  }
}

function scheduleDailyAtMidnightIST(taskName: string, task: () => Promise<void> | void) {
  const scheduleNext = () => {
    const delay = msUntilNextMidnightIST(new Date());
    setTimeout(async () => {
      const startedAt = new Date();
      let success = true;
      let errorMessage: string | null = null;

      try {
        log(`Running scheduled task at 12:00 AM IST: ${taskName}`, "scheduler");
        await task();
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        log(`Scheduled task failed (${taskName}): ${errorMessage}`, "scheduler");
      } finally {
        await recordJobRun({
          taskName,
          startedAt,
          finishedAt: new Date(),
          success,
          errorMessage,
        });
        scheduleNext();
      }
    }, delay);
  };

  scheduleNext();
  log(`Scheduler initialized: ${taskName} (runs daily at 12:00 AM IST)`, "scheduler");
}

async function assertPortAvailable(port: number, host = "0.0.0.0"): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tester = net
      .createServer()
      .once("error", reject)
      .once("listening", () => tester.close(() => resolve()))
      .listen(port, host);
  });
}

async function pickAvailablePort(startPort: number, host = "0.0.0.0", maxAttempts = 25): Promise<number> {
  let port = startPort;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await assertPortAvailable(port, host);
      return port;
    } catch (e: any) {
      if (e?.code === "EADDRINUSE") {
        port += 1;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`No available port found starting at ${startPort}`);
}

const app = express();

// Process-level crash logging (best-effort, non-blocking).
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  log(`UnhandledRejection: ${message}`, "process");
  (async () => {
    try {
      const { connectToDatabase } = await import("./mongo.js");
      const db = await connectToDatabase();
      await db.collection("error_logs").insertOne({
        kind: "process",
        message: `unhandledRejection: ${String(message).slice(0, 500)}`,
        createdAt: new Date(),
      });
    } catch {
      // non-blocking
    }
  })();
});

process.on("uncaughtException", (err) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`UncaughtException: ${message}`, "process");
  (async () => {
    try {
      const { connectToDatabase } = await import("./mongo.js");
      const db = await connectToDatabase();
      await db.collection("error_logs").insertOne({
        kind: "process",
        message: `uncaughtException: ${String(message).slice(0, 500)}`,
        createdAt: new Date(),
      });
    } catch {
      // non-blocking
    }
  })();
});

// In-memory API health samples for platform monitoring.
// Stored in app.locals so route handlers can summarize without sharing globals.
type ApiMetricSample = {
  ts: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

const apiMetrics: ApiMetricSample[] = [];
app.locals.apiMetrics = apiMetrics;

// Security middleware - Must be first
app.use(enforceHttps);
app.use(securityHeaders);
app.use(sanitizeHeaders);

// CORS must be after security headers
const defaultCorsOrigins = [
  "https://subscription-management-6uje.onrender.com",
  "http://localhost:5173",
];

const envCorsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOrigins = Array.from(new Set([...defaultCorsOrigins, ...envCorsOrigins]));

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Compress responses (helps large JSON payloads on hosted environments)
app.use(compression());

// Needed for JWT cookie auth (req.cookies)
app.use(cookieParser());

// Stripe webhook needs raw body for signature verification — must be registered BEFORE express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Parse JSON for all other routes
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/api/stripe/webhook") return next();
  express.json({ limit: "50mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      apiMetrics.push({
        ts: Date.now(),
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: duration,
      });

      // Keep the buffer bounded to avoid unbounded memory growth.
      const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes
      while (apiMetrics.length > 3000) apiMetrics.shift();
      while (apiMetrics.length && apiMetrics[0].ts < cutoff) apiMetrics.shift();

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);

      // Best-effort persistent error logs (platform admin visibility).
      if (res.statusCode >= 500) {
        const msg =
          capturedJsonResponse && typeof (capturedJsonResponse as any).message === "string"
            ? String((capturedJsonResponse as any).message).slice(0, 500)
            : null;

        (async () => {
          try {
            const { connectToDatabase } = await import("./mongo.js");
            const db = await connectToDatabase();
            await db.collection("error_logs").insertOne({
              kind: "api",
              message: msg,
              method: req.method,
              path,
              statusCode: res.statusCode,
              durationMs: duration,
              createdAt: new Date(),
            });
          } catch {
            // non-blocking
          }
        })();
      }
    }
  });

  next();
});

(async () => {
  const requestedPort = process.env.PORT ? Number(process.env.PORT) : 5000;
  const port = await pickAvailablePort(requestedPort);
  if (port !== requestedPort) {
    log(`Port ${requestedPort} is in use; using ${port} instead.`, "startup");
  }
  process.env.PORT = String(port);

  // Ensure indexes. If MongoDB is down in dev, don't hard-crash the entire server;
  // surface it via monitoring and let API endpoints report failures as needed.
  try {
    const {
      ensureTTLIndexes,
      ensureHistoryIndexes,
      ensureSubscriptionIndexes,
      ensureLicenseIndexes,
      ensurePendingPurchasesIndexes,
    } = await import("./mongo.js");

    await ensureTTLIndexes();
    await ensureHistoryIndexes();
    await ensureSubscriptionIndexes();
    await ensureLicenseIndexes();
    await ensurePendingPurchasesIndexes();
  } catch (e) {
    log(`MongoDB init skipped (unavailable): ${e}`, "startup");
  }

  // One-time cleanup: remove compliance-only fields from subscription reminders
  try {
    const { connectToDatabase } = await import("./mongo.js");
    const db = await connectToDatabase();
    const result = await db.collection("reminders").updateMany(
      {},
      { $unset: { filingName: "", complianceCategory: "" } }
    );
    log(`Reminder cleanup: unset compliance fields in ${result.modifiedCount} docs`, "startup");
  } catch (e) {
    log(`Reminder cleanup failed: ${e}`, "startup");
  }

  // Example: Secure cookie setup in login route (adjust as needed)
  // app.post("/api/login", (req, res) => {
  //   // ...login logic...
  //   res.cookie("token", token, {
  //     httpOnly: true,
  //     secure: true,
  //     sameSite: "none",
  //   });
  //   res.json({ message: "Login successful" });
  // });

  const server = await registerRoutes(app);

  // Register Stripe routes
  const { connectToDatabase } = await import("./mongo.js");
  registerStripeRoutes(app, connectToDatabase);

  // Schedule daily cleanup of old notifications
  const { storage } = await import("./storage.mongo.js");
  
  const cleanupOldNotifications = async () => {
    try {
      await storage.cleanupOldNotifications();
      log("Old notifications cleaned up successfully", "cleanup");
    } catch (error) {
      log(`Failed to cleanup old notifications: ${error}`, "cleanup");
    }
  };

  // Run cleanup immediately on startup
  runJobNow("cleanupOldNotifications", cleanupOldNotifications);

  // Schedule cleanup to run daily at 12:00 AM IST
  scheduleDailyAtMidnightIST("cleanupOldNotifications", cleanupOldNotifications);

  // Schedule automatic monthly reminder checks
  const { MonthlyReminderService } = await import("./monthly-reminder.service.js");
  const reminderService = new MonthlyReminderService(storage);
  
  const checkMonthlyReminders = async () => {
    try {
      log("Running scheduled monthly reminder check...", "reminders");
      await reminderService.checkAndRunDailyReminders();
    } catch (error) {
      log(`Failed to check monthly reminders: ${error}`, "reminders");
    }
  };

  // Run reminder check immediately on startup (in case server restarted on the 13th)
  runJobNow("checkMonthlyReminders", checkMonthlyReminders);

  // Schedule reminder check to run daily at 12:00 AM IST
  // This will automatically send emails on the 13th of each month
  scheduleDailyAtMidnightIST("checkMonthlyReminders", checkMonthlyReminders);
  log("Monthly reminder scheduler initialized - will send on 13th of each month", "reminders");

  // Schedule daily renewal reminder emails (non-yearly; yearly handled separately)
  const { DailyRenewalReminderEmailService } = await import("./daily-renewal-reminder-email.service.js");
  const dailyRenewalReminderEmailService = new DailyRenewalReminderEmailService();

  const checkDailyRenewalReminderEmails = async () => {
    try {
      log("Running scheduled daily renewal reminder email check...", "reminders");
      const result = await dailyRenewalReminderEmailService.sendDueReminderEmails();
      log(
        `Daily renewal reminder email check done (tenants=${result.tenantsProcessed}, due=${result.subscriptionsDue}, attempted=${result.emailsAttempted}, sent=${result.emailsSent})`,
        "reminders"
      );
    } catch (error) {
      log(`Failed to send daily renewal reminder emails: ${error}`, "reminders");
    }
  };

  // Run on startup
  runJobNow("checkDailyRenewalReminderEmails", checkDailyRenewalReminderEmails);

  // Run daily at 12:00 AM IST
  scheduleDailyAtMidnightIST("checkDailyRenewalReminderEmails", checkDailyRenewalReminderEmails);
  log("Daily renewal reminder email scheduler initialized - will check daily", "reminders");

  // Schedule automatic yearly reminder checks
  const { YearlyReminderService } = await import("./yearly-reminder.service.js");
  const yearlyReminderService = new YearlyReminderService(storage);
  
  const checkYearlyReminders = async () => {
    try {
      log("Running scheduled yearly reminder check...", "reminders");
      await yearlyReminderService.checkAndSendYearlyReminders();
    } catch (error) {
      log(`Failed to check yearly reminders: ${error}`, "reminders");
    }
  };

  // Run yearly reminder check immediately on startup
  runJobNow("checkYearlyReminders", checkYearlyReminders);

  // Schedule yearly reminder check to run daily at 12:00 AM IST
  // This will check daily for any yearly subscriptions that need reminders
  scheduleDailyAtMidnightIST("checkYearlyReminders", checkYearlyReminders);
  log("Yearly reminder scheduler initialized - will check daily", "reminders");

  // Schedule compliance reminder notifications (in-app + email)
  const { runComplianceReminderCheck } = await import("./compliance-reminder.service.js");

  const checkComplianceReminders = async () => {
    try {
      log("Running scheduled compliance reminder check...", "compliance-reminders");
      const result = await runComplianceReminderCheck();
      log(
        `Compliance reminder check done (processed=${result.processed}, sent=${result.sent}, skipped=${result.skipped}, errors=${result.errors})`,
        "compliance-reminders"
      );
    } catch (error) {
      log(`Failed to check compliance reminders: ${error}`, "compliance-reminders");
    }
  };

  // Run on startup
  runJobNow("checkComplianceReminders", checkComplianceReminders);

  // Run daily at 12:00 AM IST
  scheduleDailyAtMidnightIST("checkComplianceReminders", checkComplianceReminders);
  log("Compliance reminder scheduler initialized - will check daily", "compliance-reminders");

  // Schedule automatic auto-renewal checks
  const { AutoRenewalService } = await import("./auto-renewal.service.js");
  const autoRenewalService = new AutoRenewalService(storage);
  
  const checkAutoRenewals = async () => {
    try {
      log("Running scheduled auto-renewal check...", "auto-renewal");
      await autoRenewalService.processAutoRenewals();
    } catch (error) {
      log(`Failed to process auto-renewals: ${error}`, "auto-renewal");
    }
  };

  // Run auto-renewal check immediately on startup
  runJobNow("checkAutoRenewals", checkAutoRenewals);

  // Schedule auto-renewal check to run daily at 12:00 AM IST
  // This will automatically renew subscriptions when Next Payment Date = Today
  scheduleDailyAtMidnightIST("checkAutoRenewals", checkAutoRenewals);
  log("Auto-renewal scheduler initialized - will check daily", "auto-renewal");

  // Schedule payment method expiry notifications
  const { PaymentExpiryService } = await import("./payment-expiry.service.js");
  const paymentExpiryService = new PaymentExpiryService();

  const checkPaymentMethodExpiry = async () => {
    try {
      log("Running scheduled payment method expiry check...", "payment");
      const result = await paymentExpiryService.checkAndSendPaymentMethodExpiringNotifications();
      log(
        `Payment expiry check done: tenants=${result.tenantsProcessed}, inAppCreated=${result.noticesCreated}, emailsSent=${result.emailsSent}`,
        "payment"
      );
    } catch (error) {
      log(`Failed to process payment method expiry notifications: ${error}`, "payment");
    }
  };

  // Run on startup
  runJobNow("checkPaymentMethodExpiry", checkPaymentMethodExpiry);

  // Run daily at 12:00 AM IST
  scheduleDailyAtMidnightIST("checkPaymentMethodExpiry", checkPaymentMethodExpiry);
  log("Payment method expiry scheduler initialized - will check daily", "payment");

  // Schedule license expiry reminders (in-app + email)
  const { runLicenseExpiryReminderCheck } = await import("./license-expiry-reminder.service.js");

  const checkLicenseExpiryReminders = async () => {
    try {
      log("Running scheduled license expiry reminder check...", "license-reminders");
      const result = await runLicenseExpiryReminderCheck();
      log(
        `License expiry reminder check done (tenants=${result.tenantsProcessed}, due=${result.licensesDue}, inApp=${result.inAppCreated}, attempted=${result.emailsAttempted}, sent=${result.emailsSent})`,
        "license-reminders"
      );
    } catch (error) {
      log(`Failed to check license expiry reminders: ${error}`, "license-reminders");
    }
  };

  // Run on startup
  runJobNow("checkLicenseExpiryReminders", checkLicenseExpiryReminders);

  // Run daily at 12:00 AM IST
  scheduleDailyAtMidnightIST("checkLicenseExpiryReminders", checkLicenseExpiryReminders);
  log("License expiry reminder scheduler initialized - will check daily", "license-reminders");

  // Send department head notification emails on startup
  const sendDepartmentHeadNotifications = async () => {
    try {
      log("Sending department head notification emails...", "departments");
      const { connectToDatabase } = await import("./mongo.js");
      const { emailService } = await import("./email.service.js");
      const { decrypt } = await import("./encryption.service.js");
      
      const db = await connectToDatabase();
      const collection = db.collection("departments");
      
      // Calculate next month's date range (same as monthly reminders)
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      
      log(`Looking for renewals between ${nextMonth.toISOString().split('T')[0]} and ${endOfNextMonth.toISOString().split('T')[0]}`, "departments");
      
      // Find all departments that have both departmentHead and email
      const departments = await collection.find({
        departmentHead: { $exists: true, $ne: "" },
        email: { $exists: true, $ne: "" }
      }).toArray();
      
      log(`Found ${departments.length} departments with department heads`, "departments");
      
      let successCount = 0;
      let failCount = 0;
      
      for (const dept of departments) {
        try {
          log(`Processing department: ${dept.name} (${dept.email})`, "departments");
          
          // Fetch subscriptions for this department that renew NEXT MONTH
          const subscriptionsCollection = db.collection("subscriptions");
          const allDepartmentSubscriptions = await subscriptionsCollection.find({
            tenantId: dept.tenantId,
            isActive: true,
            department: { $regex: new RegExp(`"${dept.name}"`, 'i') }
          }).toArray();
          
          log(`Found ${allDepartmentSubscriptions.length} total active subscriptions for ${dept.name}`, "departments");
          
          // Filter by next month's renewal dates
          const nextMonthRenewals = allDepartmentSubscriptions.filter((sub: any) => {
            if (!sub.nextRenewal) return false;
            const renewalDate = parseDateOnlyUtc(sub.nextRenewal);
            if (!renewalDate) return false;
            return renewalDate >= nextMonth && renewalDate <= endOfNextMonth;
          });
          
          log(`Found ${nextMonthRenewals.length} subscriptions renewing next month for ${dept.name}`, "departments");
          
          // Skip if no renewals next month
          if (nextMonthRenewals.length === 0) {
            log(`No renewals next month for ${dept.name}, skipping email`, "departments");
            continue;
          }
          
          const subscriptionsData = nextMonthRenewals.map((sub: any) => ({
            serviceName: decrypt(sub.serviceName || 'Unknown Service'),
            nextRenewal: sub.nextRenewal || new Date().toISOString(),
            amount: (() => {
              const raw = decrypt(sub.amount ?? 0);
              const n = Number(raw);
              return Number.isFinite(n) ? n : 0;
            })(),
            currency: decrypt(sub.currency || 'USD') || 'USD',
            department: sub.department || '-',
            category: decrypt(sub.category || '-') || '-'
          }));
          
          // Send email to this department head
          await emailService.sendDepartmentHeadNotification(
            dept.name,
            dept.departmentHead,
            dept.email,
            subscriptionsData
          );
          
          log(`✅ Department head notification sent to ${dept.email} (${dept.name}) with ${subscriptionsData.length} renewals`, "departments");
          successCount++;
        } catch (error) {
          log(`❌ Failed to send notification to ${dept.email} (${dept.name}): ${error}`, "departments");
          failCount++;
        }
      }
      
      log(`Department head notifications complete: ${successCount} sent, ${failCount} failed (${departments.length - successCount - failCount} skipped - no renewals)`, "departments");
    } catch (error) {
      log(`Failed to send department head notifications: ${error}`, "departments");
    }
  };

  // Check if today is the 13th and send department head notifications
  const checkAndSendDepartmentNotifications = async () => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    if (dayOfMonth === 13) {
      log("Today is the 13th - sending department head notifications", "departments");
      await sendDepartmentHeadNotifications();
    } else {
      log(`Today is the ${dayOfMonth}th - department head notifications run on the 13th`, "departments");
    }
  };

  // Run department notification check immediately on startup (if it's the 13th)
  runJobNow("checkAndSendDepartmentNotifications", checkAndSendDepartmentNotifications);

  // Schedule department notification check to run daily at 12:00 AM IST
  // This will check daily and send on the 13th of each month
  scheduleDailyAtMidnightIST("checkAndSendDepartmentNotifications", checkAndSendDepartmentNotifications);
  log("Department head notification scheduler initialized - will send on 13th of each month", "departments");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static files from client/dist in all environments
  const expressStatic = require("express").static;
  const path = require("path");
  const publicPath = path.join(process.cwd(), "dist/public");
  app.use(expressStatic(publicPath));
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicPath, "index.html"));
  });

  server.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
      log(
        `Port ${port} is already in use. Stop the other process using it or run with PORT=${port + 1}.`,
        "startup"
      );
      process.exit(1);
    }
    throw err;
  });

  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Record a platform-visible system event so the activity/audit streams are never empty.
    // Non-blocking best-effort.
    (async () => {
      try {
        const { connectToDatabase } = await import("./mongo.js");
        const db = await connectToDatabase();
        await db.collection("history").insertOne({
          tenantId: null,
          type: "system",
          action: "SERVER_START",
          description: `Server started on port ${port}`,
          severity: "info",
          meta: {
            port,
            nodeEnv: process.env.NODE_ENV ?? null,
          },
          timestamp: new Date(),
          createdAt: new Date(),
        });
      } catch {
        // ignore
      }
    })();
  });
})();
