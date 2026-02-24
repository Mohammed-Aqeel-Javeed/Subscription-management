import { ObjectId } from "mongodb";
import { connectToDatabase } from "./mongo.js";
import { emailService } from "./email.service";

type ReminderRole = "responsible_person" | "secondary_person" | "dept_head";

type Recipient = {
  email: string;
  name: string;
  role: ReminderRole;
  recipientDepartments?: string[];
};

function isValidEmail(value: any): boolean {
  if (!value) return false;
  const s = String(value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
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

function istTodayIso(now = new Date()): string {
  const IST_OFFSET_MINUTES = 330;
  const istNow = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return istNow.toISOString().slice(0, 10);
}

function parseDepartments(license: any): string[] {
  if (Array.isArray(license?.departments)) return license.departments.map(String).filter(Boolean);
  const raw = license?.department;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      if (parsed) return [String(parsed)].filter(Boolean);
    } catch {
      return [s];
    }
  }
  return [String(raw)].filter(Boolean);
}

function buildHtml(params: {
  recipientName: string;
  licenseName: string;
  expiryDate: string;
  reminderDays: number;
  policy: string;
  departments: string[];
  role: ReminderRole;
  recipientDepartments?: string[];
}): string {
  const deptLine = params.departments.length ? params.departments.join(", ") : "-";
  // Removed department head reason text as requested
  const roleReason = "";

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>License Expiry Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; }
        .card { background:#fff; border-radius:12px; padding:20px; max-width:640px; margin:0 auto; border:1px solid #e5e7eb; }
        h2 { margin:0 0 8px 0; color:#111827; }
        p { margin:8px 0; color:#374151; line-height:1.5; }
        .meta { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px; margin-top:12px; }
        .meta b { color:#111827; }
        .reason { margin-top:10px; color:#6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>License Expiry Reminder</h2>
        <p>Hello ${params.recipientName},</p>
        <p>This is a reminder that the following license is approaching its expiry date.</p>
        <div class="meta">
          <p><b>License:</b> ${params.licenseName}</p>
          <p><b>Expiry date:</b> ${params.expiryDate}</p>
          <p><b>Reminder policy:</b> ${params.policy}</p>
          <p><b>Remind before:</b> ${params.reminderDays} days</p>
          <p><b>Department(s):</b> ${deptLine}</p>
        </div>
        ${roleReason ? `<div class="reason">${roleReason}</div>` : ""}
      </div>
    </body>
  </html>`;
}

async function ensureReminderLogIndexes(db: any) {
  try {
    await db.collection("license_reminder_log").createIndex(
      { tenantId: 1, licenseId: 1, triggerDate: 1, recipientEmail: 1, recipientRole: 1, channel: 1 },
      { unique: true, name: "uniq_license_reminder" }
    );
  } catch {
    // ignore
  }
}

async function resolveEmployeeEmailByNameOrEmail(params: { tenantId: string; value: string; employees: any[] }): Promise<string> {
  const v = String(params.value || "").trim();
  if (!v) return "";
  if (isValidEmail(v)) return v.toLowerCase();

  const target = v.toLowerCase();
  const match = (params.employees || []).find((e: any) => {
    const email = String(e?.email || "").trim().toLowerCase();
    const name = String(e?.name || "").trim().toLowerCase();
    return (email && email === target) || (name && name === target);
  });

  const email = String(match?.email || "").trim();
  return email ? email.toLowerCase() : "";
}

async function resolveUserDisplayName(params: { email: string; users: any[]; employees: any[] }): Promise<string> {
  const email = String(params.email || "").trim().toLowerCase();
  if (!email) return "";

  const u = (params.users || []).find((x: any) => String(x?.email || "").trim().toLowerCase() === email);
  if (u) return String(u?.fullName || u?.name || u?.email || email);

  const e = (params.employees || []).find((x: any) => String(x?.email || "").trim().toLowerCase() === email);
  if (e) return String(e?.name || e?.email || email);

  return email;
}

function computeTriggerDates(params: { endDate: Date; reminderDays: number; policy: string; todayIso: string }): string[] {
  const policy = String(params.policy || "One time").trim();
  const reminderDays = Math.max(0, Number(params.reminderDays) || 0);
  const endIso = params.endDate.toISOString().slice(0, 10);

  if (!reminderDays && policy !== "Until Renewal") {
    // No reminder days set - still allow a same-day reminder only if they want Until Renewal.
    return [];
  }

  const triggerDates: string[] = [];

  if (policy === "One time") {
    const t = new Date(params.endDate);
    t.setUTCDate(t.getUTCDate() - reminderDays);
    const tIso = t.toISOString().slice(0, 10);
    // catch-up: send if triggerDate already passed but expiry not passed
    if (params.todayIso >= tIso && params.todayIso <= endIso) triggerDates.push(tIso);
  } else if (policy === "Two times") {
    const first = new Date(params.endDate);
    first.setUTCDate(first.getUTCDate() - reminderDays);
    const firstIso = first.toISOString().slice(0, 10);
    if (params.todayIso >= firstIso && params.todayIso <= endIso) triggerDates.push(firstIso);

    const secondDays = Math.floor(reminderDays / 2);
    if (secondDays > 0 && secondDays !== reminderDays) {
      const second = new Date(params.endDate);
      second.setUTCDate(second.getUTCDate() - secondDays);
      const secondIso = second.toISOString().slice(0, 10);
      if (params.todayIso >= secondIso && params.todayIso <= endIso) triggerDates.push(secondIso);
    }
  } else if (policy === "Until Renewal") {
    const start = new Date(params.endDate);
    start.setUTCDate(start.getUTCDate() - reminderDays);
    const startIso = start.toISOString().slice(0, 10);
    if (params.todayIso >= startIso && params.todayIso <= endIso) {
      triggerDates.push(params.todayIso);
    }
  }

  return Array.from(new Set(triggerDates)).filter(Boolean);
}

export async function runLicenseExpiryReminderCheck(params?: {
  tenantId?: string;
  licenseId?: string;
  db?: any;
  now?: Date;
}): Promise<{ tenantsProcessed: number; licensesDue: number; emailsAttempted: number; emailsSent: number; inAppCreated: number }>
{
  const now = params?.now ?? new Date();
  const todayIso = istTodayIso(now);

  const db = params?.db ?? (await connectToDatabase());
  await ensureReminderLogIndexes(db);

  const tenantIds: string[] = params?.tenantId
    ? [params.tenantId]
    : await db.collection("licenses").distinct("tenantId", {});

  let tenantsProcessed = 0;
  let licensesDue = 0;
  let emailsAttempted = 0;
  let emailsSent = 0;
  let inAppCreated = 0;

  for (const tenantId of tenantIds.filter(Boolean)) {
    tenantsProcessed++;

    const licenseQuery: any = {
      tenantId,
      endDate: { $exists: true, $ne: "" },
    };

    if (params?.licenseId) {
      try {
        licenseQuery._id = new ObjectId(params.licenseId);
      } catch {
        // invalid id, skip
        continue;
      }
    }

    const [licenses, users, employees, departments] = await Promise.all([
      db.collection("licenses").find(licenseQuery).toArray(),
      db.collection("login").find({ tenantId }).toArray(),
      db.collection("employees").find({ tenantId }).toArray(),
      db.collection("departments").find({ tenantId }).toArray(),
    ]);

    const deptByName = new Map<string, any>();
    for (const dept of departments as any[]) {
      const key = String(dept?.name || "").trim().toLowerCase();
      if (key) deptByName.set(key, dept);
    }

    for (const license of licenses as any[]) {
      const endDate = parseDateOnlyUtc(license.endDate);
      if (!endDate) continue;

      const reminderDays = Number(license?.reminderDays) || 7;
      const policy = String(license?.reminderPolicy || "One time").trim();

      const dueTriggers = computeTriggerDates({ endDate, reminderDays, policy, todayIso });
      if (dueTriggers.length === 0) continue;

      licensesDue++;

      const licenseId = String(license._id?.toString?.() || license.id || "");
      const licenseName = String(license?.licenseName || license?.name || "License").trim() || "License";
      const licenseDepartments = parseDepartments(license);

      const recipients: Recipient[] = [];

      // Responsible person 1
      const responsibleValue = String(license?.responsiblePerson || "").trim();
      if (responsibleValue) {
        const email = await resolveEmployeeEmailByNameOrEmail({ tenantId, value: responsibleValue, employees });
        if (email) {
          const name = await resolveUserDisplayName({ email, users, employees });
          recipients.push({ email, name, role: "responsible_person" });
        }
      }

      // Responsible person 2
      const secondaryValue = String(license?.secondaryPerson || "").trim();
      if (secondaryValue) {
        const email = await resolveEmployeeEmailByNameOrEmail({ tenantId, value: secondaryValue, employees });
        if (email) {
          const name = await resolveUserDisplayName({ email, users, employees });
          recipients.push({ email, name, role: "secondary_person" });
        }
      }

      // Department head(s)
      for (const deptNameRaw of licenseDepartments) {
        const deptName = String(deptNameRaw || "").trim();
        if (!deptName) continue;

        const dept = deptByName.get(deptName.toLowerCase());
        if (!dept) continue;

        let deptEmail = String(dept?.email || "").trim();
        const headField = String(dept?.departmentHead || "").trim();

        if (!isValidEmail(deptEmail) && isValidEmail(headField)) deptEmail = headField;
        if (!isValidEmail(deptEmail) && headField) {
          const empEmail = await resolveEmployeeEmailByNameOrEmail({ tenantId, value: headField, employees });
          if (empEmail) deptEmail = empEmail;
        }

        if (isValidEmail(deptEmail)) {
          const email = String(deptEmail).trim().toLowerCase();
          const name = await resolveUserDisplayName({ email, users, employees });
          recipients.push({ email, name, role: "dept_head", recipientDepartments: [deptName] });
        }
      }

      // For each due trigger, send role-specific notifications/emails.
      for (const triggerDate of dueTriggers) {
        for (const recipient of recipients) {
          const recipientEmail = String(recipient.email || "").trim().toLowerCase();
          if (!recipientEmail) continue;

          // --- In-app notification (dedup via log) ---
          const inAppKeyDoc = {
            tenantId,
            licenseId,
            triggerDate,
            recipientEmail,
            recipientRole: recipient.role,
            channel: "in_app",
          };

          let claimedInApp = false;
          try {
            await db.collection("license_reminder_log").insertOne({
              ...inAppKeyDoc,
              createdAt: new Date(),
            });
            claimedInApp = true;
          } catch {
            claimedInApp = false;
          }

          if (claimedInApp) {
            try {
              await db.collection("notifications").insertOne({
                tenantId,
                type: "license",
                // eventType intentionally omitted => treated as reminder in UI
                licenseId,
                licenseName,
                departments: licenseDepartments,
                reminderTriggerDate: triggerDate,
                reminderDays,
                reminderPolicy: policy,
                userEmail: recipientEmail,
                recipientRole: recipient.role,
                ...(recipient.role === "dept_head"
                  ? { recipientDepartments: recipient.recipientDepartments || licenseDepartments }
                  : { recipientDepartments: licenseDepartments }),
                timestamp: new Date().toISOString(),
                createdAt: new Date(),
                read: false,
              });
              inAppCreated++;
            } catch {
              // Allow retry next run
              try {
                await db.collection("license_reminder_log").deleteOne(inAppKeyDoc);
              } catch {}
            }
          }

          // --- Email (dedup via log) ---
          const emailKeyDoc = {
            tenantId,
            licenseId,
            triggerDate,
            recipientEmail,
            recipientRole: recipient.role,
            channel: "email",
          };

          let claimedEmail = false;
          try {
            await db.collection("license_reminder_log").insertOne({
              ...emailKeyDoc,
              createdAt: new Date(),
            });
            claimedEmail = true;
          } catch {
            claimedEmail = false;
          }

          if (!claimedEmail) continue;

          emailsAttempted++;

          const subject = `License Expiry Reminder: ${licenseName}`;
          const html = buildHtml({
            recipientName: recipient.name || recipientEmail,
            licenseName,
            expiryDate: String(normalizeDateString(license.endDate) || ""),
            reminderDays,
            policy,
            departments: licenseDepartments,
            role: recipient.role,
            recipientDepartments: recipient.recipientDepartments,
          });

          try {
            const ok = await emailService.sendEmail({ to: recipientEmail, subject, html });
            if (ok) emailsSent++;
            if (!ok) {
              // allow retry
              try {
                await db.collection("license_reminder_log").deleteOne(emailKeyDoc);
              } catch {}
            }
          } catch {
            // allow retry
            try {
              await db.collection("license_reminder_log").deleteOne(emailKeyDoc);
            } catch {}
          }
        }
      }
    }
  }

  return { tenantsProcessed, licensesDue, emailsAttempted, emailsSent, inAppCreated };
}
