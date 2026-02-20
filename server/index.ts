import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
// @ts-ignore
import { registerRoutes } from "./routes.js";
import { enforceHttps, securityHeaders, sanitizeHeaders } from "./middleware/security.middleware.js";

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

function scheduleDailyAtMidnightIST(taskName: string, task: () => Promise<void> | void) {
  const scheduleNext = () => {
    const delay = msUntilNextMidnightIST(new Date());
    setTimeout(async () => {
      try {
        log(`Running scheduled task at 12:00 AM IST: ${taskName}`, "scheduler");
        await task();
      } catch (error) {
        log(`Scheduled task failed (${taskName}): ${error}`, "scheduler");
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  scheduleNext();
  log(`Scheduler initialized: ${taskName} (runs daily at 12:00 AM IST)`, "scheduler");
}


const app = express();

// Security middleware - Must be first
app.use(enforceHttps);
app.use(securityHeaders);
app.use(sanitizeHeaders);

// CORS must be after security headers
app.use(cors({
  origin: [
    "https://subscription-management-6uje.onrender.com",
    "http://localhost:5173"
  ],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
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
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure TTL indexes for notifications, reminders, compliance_notifications
  const { ensureTTLIndexes, ensureHistoryIndexes, ensureSubscriptionIndexes } = await import("./mongo.js");
  await ensureTTLIndexes();
  await ensureHistoryIndexes();
  await ensureSubscriptionIndexes();

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
  cleanupOldNotifications();

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
  checkMonthlyReminders();

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
  checkDailyRenewalReminderEmails();

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
  checkYearlyReminders();

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
  checkComplianceReminders();

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
  checkAutoRenewals();

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
  checkPaymentMethodExpiry();

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
  checkLicenseExpiryReminders();

  // Run daily at 12:00 AM IST
  scheduleDailyAtMidnightIST("checkLicenseExpiryReminders", checkLicenseExpiryReminders);
  log("License expiry reminder scheduler initialized - will check daily", "license-reminders");

  // Send department head notification emails on startup
  const sendDepartmentHeadNotifications = async () => {
    try {
      log("Sending department head notification emails...", "departments");
      const { connectToDatabase } = await import("./mongo.js");
      const { emailService } = await import("./email.service.js");
      
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
            serviceName: sub.serviceName || 'Unknown Service',
            nextRenewal: sub.nextRenewal || new Date().toISOString(),
            amount: sub.amount || 0,
            currency: sub.currency || 'USD',
            department: sub.department || '-',
            category: sub.category || '-'
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
  checkAndSendDepartmentNotifications();

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

  const port = process.env.PORT ? Number(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
