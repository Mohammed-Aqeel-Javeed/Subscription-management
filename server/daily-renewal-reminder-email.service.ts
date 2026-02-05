import { connectToDatabase } from "./mongo.js";
import { emailService } from "./email.service";

type Recipient = {
  userId?: string;
  email: string;
  name: string;
};

function isValidEmail(value: any): boolean {
  if (!value) return false;
  const s = String(value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function daysUntil(target: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((target.getTime() - now.getTime()) / msPerDay);
}

function localDateOnlyString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDepartments(subscription: any): string[] {
  if (Array.isArray(subscription?.departments)) return subscription.departments.map(String).filter(Boolean);
  const raw = subscription?.department;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      if (parsed) return [String(parsed)];
    } catch {
      return [raw];
    }
  }
  return [String(raw)];
}

function buildHtml(params: {
  recipientName: string;
  serviceName: string;
  renewalDate: string;
  reminderDays: number;
}): string {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Renewal Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; }
        .card { background:#fff; border-radius:12px; padding:20px; max-width:640px; margin:0 auto; border:1px solid #e5e7eb; }
        h2 { margin:0 0 8px 0; color:#111827; }
        p { margin:8px 0; color:#374151; line-height:1.5; }
        .meta { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px; margin-top:12px; }
        .meta b { color:#111827; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Renewal Reminder</h2>
        <p>Hello ${params.recipientName},</p>
        <p>This is a reminder that the following subscription is due for renewal soon.</p>
        <div class="meta">
          <p><b>Subscription:</b> ${params.serviceName}</p>
          <p><b>Next payment date:</b> ${params.renewalDate}</p>
          <p><b>Remind before:</b> ${params.reminderDays} days</p>
        </div>
      </div>
    </body>
  </html>`;
}

export class DailyRenewalReminderEmailService {
  async sendDueReminderEmails(params?: { now?: Date }): Promise<{ tenantsProcessed: number; subscriptionsDue: number; emailsAttempted: number; emailsSent: number }> {
    const now = params?.now ?? new Date();
    const todayStr = localDateOnlyString(now);
    const emailWindowDays = Number(process.env.RENEWAL_REMINDER_EMAIL_DAYS ?? 7);

    const db = await connectToDatabase();
    const { decrypt } = await import("./encryption.service.js");

    const tenantIds: string[] = await db.collection("subscriptions").distinct("tenantId", {});

    let tenantsProcessed = 0;
    let subscriptionsDue = 0;
    let emailsAttempted = 0;
    let emailsSent = 0;

    for (const tenantId of tenantIds.filter(Boolean)) {
      tenantsProcessed++;

      const [subs, users, employees, departments] = await Promise.all([
        db
          .collection("subscriptions")
          .find({
            tenantId,
            $or: [{ isActive: true }, { status: { $in: ["Active", "active"] } }],
            nextRenewal: { $exists: true, $ne: "" },
          })
          .toArray(),
        db.collection("login").find({ tenantId }).toArray(),
        db.collection("employees").find({ tenantId }).toArray(),
        db.collection("departments").find({ tenantId }).toArray(),
      ]);

      const deptByName = new Map<string, any>();
      for (const dept of departments as any[]) {
        const key = String(dept?.name || "").trim().toLowerCase();
        if (key) deptByName.set(key, dept);
      }

      for (const sub of subs as any[]) {
        const cycle = String(sub?.billingCycle || sub?.commitmentCycle || "").trim().toLowerCase();
        // Yearly reminders already handled by YearlyReminderService
        if (cycle === "yearly") continue;

        const renewalDate = parseDateOnlyUtc(sub.nextRenewal);
        if (!renewalDate) continue;

        // Matrix: IA always (handled by in-app reminders), EM only if renewal is close.
        const daysToRenewal = daysUntil(renewalDate, now);
        const shouldSendEmail = daysToRenewal >= 0 && daysToRenewal <= emailWindowDays;

        const reminderDays = Number(sub.reminderDays) || 7;
        const policy = String(sub.reminderPolicy || "One time");

        const triggerDates: string[] = [];
        if (policy === "One time") {
          const t = new Date(renewalDate);
          t.setUTCDate(t.getUTCDate() - reminderDays);
          triggerDates.push(t.toISOString().slice(0, 10));
        } else if (policy === "Two times") {
          const first = new Date(renewalDate);
          first.setUTCDate(first.getUTCDate() - reminderDays);
          triggerDates.push(first.toISOString().slice(0, 10));
          const secondDays = Math.floor(reminderDays / 2);
          if (secondDays > 0 && secondDays !== reminderDays) {
            const second = new Date(renewalDate);
            second.setUTCDate(second.getUTCDate() - secondDays);
            triggerDates.push(second.toISOString().slice(0, 10));
          }
        } else if (policy === "Until Renewal") {
          const start = new Date(renewalDate);
          start.setUTCDate(start.getUTCDate() - reminderDays);
          const startStr = start.toISOString().slice(0, 10);
          const endStr = renewalDate.toISOString().slice(0, 10);
          if (todayStr >= startStr && todayStr <= endStr) {
            triggerDates.push(todayStr);
          }
        }

        if (!triggerDates.includes(todayStr)) continue;
        subscriptionsDue++;

        let serviceName = String(sub.serviceName || sub.name || "Subscription");
        try {
          serviceName = sub.serviceName ? decrypt(sub.serviceName) : serviceName;
        } catch {
          // ignore
        }

        const renewalLabel = normalizeDateString(sub.nextRenewal);

        const recipients: Recipient[] = [];

        // Owner
        let ownerEmail = String(sub.ownerEmail || "").trim();
        if (!isValidEmail(ownerEmail) && sub.owner) {
          const ownerValue = String(sub.owner).trim();
          const rx = new RegExp(`^${escapeRegex(ownerValue)}$`, "i");
          const employee = (employees as any[]).find((e) => rx.test(String(e?.email || "")) || rx.test(String(e?.name || "")));
          if (employee?.email) ownerEmail = String(employee.email).trim();
        }
        if (isValidEmail(ownerEmail)) {
          const ownerUser = (users as any[]).find((u) => String(u?.email || "").trim().toLowerCase() === ownerEmail.toLowerCase());
          recipients.push({
            userId: ownerUser?._id ? String(ownerUser._id) : undefined,
            email: ownerEmail,
            name: ownerUser?.fullName || ownerUser?.name || ownerEmail,
          });
        }

        // Dept head(s)
        const deptNames = parseDepartments(sub);
        for (const deptName of deptNames) {
          const dept = deptByName.get(String(deptName).trim().toLowerCase());
          if (!dept) continue;

          let deptEmail = String(dept?.email || "").trim();
          if (!isValidEmail(deptEmail) && dept?.departmentHead) {
            const headName = String(dept.departmentHead).trim();
            const headUser = (users as any[]).find(
              (u) => String(u?.fullName || "").trim().toLowerCase() === headName.toLowerCase() || String(u?.name || "").trim().toLowerCase() === headName.toLowerCase()
            );
            if (headUser?.email) deptEmail = String(headUser.email).trim();
          }

          if (isValidEmail(deptEmail)) {
            const headUser = (users as any[]).find((u) => String(u?.email || "").trim().toLowerCase() === deptEmail.toLowerCase());
            recipients.push({
              userId: headUser?._id ? String(headUser._id) : undefined,
              email: deptEmail,
              name: headUser?.fullName || headUser?.name || deptEmail,
            });
          }
        }

        // Deduplicate recipients by email
        const uniqueByEmail = new Map<string, Recipient>();
        for (const r of recipients) uniqueByEmail.set(r.email.toLowerCase(), r);

        for (const recipient of Array.from(uniqueByEmail.values())) {
          if (!shouldSendEmail) continue;
          const key = [tenantId, String(sub._id?.toString?.() || sub.id), todayStr, recipient.email.toLowerCase()].join("|");
          const already = await db.collection("renewal_reminder_email_log").findOne({ tenantId, key });
          if (already) continue;

          emailsAttempted++;

          const subject = `Renewal Reminder: ${serviceName}`;
          const html = buildHtml({
            recipientName: recipient.name,
            serviceName,
            renewalDate: String(renewalLabel || ""),
            reminderDays,
          });

          const ok = await emailService.sendEmail({ to: recipient.email, subject, html });
          if (ok) emailsSent++;

          await db.collection("renewal_reminder_email_log").insertOne({
            tenantId,
            key,
            subscriptionId: String(sub._id?.toString?.() || sub.id),
            to: recipient.email,
            sent: ok,
            createdAt: new Date(),
          });
        }
      }
    }

    return { tenantsProcessed, subscriptionsDue, emailsAttempted, emailsSent };
  }
}
