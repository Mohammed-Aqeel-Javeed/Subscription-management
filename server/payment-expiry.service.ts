import { connectToDatabase } from "./mongo.js";
import { emailService } from "./email.service";

type RecipientRole = "owner" | "owner2" | "dept_head";

type Recipient = {
  userId?: string;
  email?: string;
  name?: string;
  role: RecipientRole;
  recipientDepartments?: string[];
  sendInApp: boolean;
  sendEmail: boolean;
};

type PaymentDoc = {
  _id?: any;
  id?: string;
  tenantId?: string;
  name?: string;
  title?: string;
  type?: string;
  expiresAt?: string; // usually YYYY-MM or MM/YYYY
  last4Digits?: string;
  financialInstitution?: string;
  [key: string]: any;
};

type SubscriptionDoc = {
  _id?: any;
  id?: string;
  tenantId?: string;
  serviceName?: string;
  paymentMethod?: string;
  owner?: string;
  ownerEmail?: string;
  owner2?: string;
  owner2Email?: string;
  department?: any;
  departments?: any;
  category?: string;
  status?: string;
  isActive?: boolean;
  [key: string]: any;
};

function isValidEmail(value: any): boolean {
  if (!value) return false;
  const s = String(value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function normalizeKey(value: any): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseDepartments(subscription: SubscriptionDoc): string[] {
  if (Array.isArray(subscription.departments)) return subscription.departments.map(String).filter(Boolean);
  const raw = subscription.department;
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

function getPaymentName(payment: PaymentDoc): string {
  return String(payment.name || payment.title || "").trim();
}

function parseExpiresAt(expiresAt: any): { year: number; month: number } | null {
  if (!expiresAt) return null;
  const raw = String(expiresAt).trim();

  // Accept: YYYY-MM, YYYY-MM-DD
  let match = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
    return null;
  }

  // Accept: MM/YYYY or MM-YYYY
  match = raw.match(/^(\d{2})[\/-](\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    const year = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
    return null;
  }

  return null;
}

function endOfExpiryMonthUtc(year: number, month: number): Date {
  // month is 1-12
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function daysUntil(target: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((target.getTime() - now.getTime()) / msPerDay);
}

function formatExpiryLabel(expiresAt: any): string {
  const parsed = parseExpiresAt(expiresAt);
  if (!parsed) return String(expiresAt ?? "");
  const mm = String(parsed.month).padStart(2, "0");
  return `${mm}/${parsed.year}`;
}

function buildEmailHtml(params: {
  recipientName: string;
  role: RecipientRole;
  paymentName: string;
  expiresLabel: string;
  linkedCount: number;
}): string {
  const roleLabel =
    params.role === "dept_head"
      ? "Department Head"
      : params.role === "owner2"
        ? "Subscription Owner 2"
        : "Subscription Owner";

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Payment Method Expiring</title>
      <style>
        body { font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; }
        .card { background:#fff; border-radius:12px; padding:20px; max-width:640px; margin:0 auto; border:1px solid #e5e7eb; }
        h2 { margin:0 0 8px 0; color:#111827; }
        p { margin:8px 0; color:#374151; line-height:1.5; }
        .pill { display:inline-block; background:#fff7ed; color:#9a3412; border:1px solid #fed7aa; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:700; }
        .meta { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px; margin-top:12px; }
        .meta b { color:#111827; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="pill">Action Required</div>
        <h2>Payment Method Expiring Soon</h2>
        <p>Hello ${params.recipientName},</p>
        <p>You are receiving this notification because you are a <b>${roleLabel}</b>.</p>
        <div class="meta">
          <p><b>Payment method:</b> ${params.paymentName || "(Unnamed)"}</p>
          <p><b>Expiry:</b> ${params.expiresLabel || "N/A"}</p>
          <p><b>Linked subscriptions:</b> ${params.linkedCount}</p>
        </div>
        <p>Please update the payment method details in Configuration to avoid payment failures.</p>
      </div>
    </body>
  </html>`;
}

export class PaymentExpiryService {
  async checkAndSendPaymentMethodExpiringNotificationsForTenant(params: {
    tenantId: string;
    paymentName?: string;
    windowDays?: number;
    now?: Date;
    db?: any;
  }): Promise<{ noticesCreated: number; emailsSent: number }> {
    const tenantId = String(params.tenantId || '').trim();
    if (!tenantId) return { noticesCreated: 0, emailsSent: 0 };

    const windowDays = Number(params.windowDays ?? process.env.PAYMENT_METHOD_EXPIRY_DAYS ?? 30);
    const now = params.now ?? new Date();

    const db = params.db ?? (await connectToDatabase());
    const { decrypt } = await import("./encryption.service.js");

    const payments: PaymentDoc[] = await db
      .collection("payment")
      .find({ tenantId, expiresAt: { $exists: true, $ne: "" } })
      .toArray();

    const paymentNameFilterKey = params.paymentName ? normalizeKey(params.paymentName) : "";

    const expiringPayments = payments
      .map((p) => {
        const parsed = parseExpiresAt(p.expiresAt);
        if (!parsed) return null;
        const expiryEnd = endOfExpiryMonthUtc(parsed.year, parsed.month);
        const remaining = daysUntil(expiryEnd, now);
        if (remaining < 0) return null;
        if (remaining > windowDays) return null;
        return { payment: p, expiryEnd, remainingDays: remaining };
      })
      .filter(Boolean) as Array<{ payment: PaymentDoc; expiryEnd: Date; remainingDays: number }>;

    const filteredExpiringPayments = paymentNameFilterKey
      ? expiringPayments.filter(({ payment }) => normalizeKey(getPaymentName(payment)) === paymentNameFilterKey)
      : expiringPayments;

    if (filteredExpiringPayments.length === 0) return { noticesCreated: 0, emailsSent: 0 };

    const [allUsers, allEmployees, allDepts, allSubs] = await Promise.all([
      db.collection("login").find({ tenantId }).toArray(),
      db.collection("employees").find({ tenantId }).toArray(),
      db.collection("departments").find({ tenantId }).toArray(),
      db
        .collection("subscriptions")
        .find({ tenantId, $or: [{ isActive: true }, { status: { $in: ["Active", "active"] } }] })
        .toArray(),
    ]);

    const subsByPaymentName = new Map<string, SubscriptionDoc[]>();
    for (const sub of allSubs as SubscriptionDoc[]) {
      let paymentMethodName = "";
      try {
        paymentMethodName = sub.paymentMethod ? decrypt(sub.paymentMethod) : "";
      } catch {
        paymentMethodName = String(sub.paymentMethod ?? "");
      }
      const key = normalizeKey(paymentMethodName);
      if (!key) continue;
      const existing = subsByPaymentName.get(key);
      if (existing) existing.push(sub);
      else subsByPaymentName.set(key, [sub]);
    }

    const deptByName = new Map<string, any>();
    for (const dept of allDepts) {
      const k = normalizeKey((dept as any)?.name);
      if (k) deptByName.set(k, dept);
    }

    let noticesCreated = 0;
    let emailsSent = 0;

    for (const { payment } of filteredExpiringPayments) {
      const paymentName = getPaymentName(payment);
      const paymentKey = normalizeKey(paymentName);
      if (!paymentKey) continue;

      const linkedSubs = subsByPaymentName.get(paymentKey) || [];
      if (linkedSubs.length === 0) continue;

      const recipientsByKey = new Map<string, Recipient>();

      const resolveEmployeeEmailByNameOrEmail = (value: any): string => {
        const v = String(value ?? "").trim();
        if (!v) return "";
        if (isValidEmail(v)) return v;
        const key = normalizeKey(v);
        const employee = (allEmployees as any[]).find((e) => {
          const employeeName = normalizeKey(e?.name);
          const employeeEmail = normalizeKey(e?.email);
          return employeeName === key || employeeEmail === key;
        });
        const email = String(employee?.email || "").trim();
        return isValidEmail(email) ? email : "";
      };

      const addOwnerRecipient = (sub: SubscriptionDoc, role: "owner" | "owner2") => {
        const ownerValue = String((role === "owner" ? sub.owner : sub.owner2) ?? "").trim();
        const explicitEmail = String((role === "owner" ? sub.ownerEmail : sub.owner2Email) ?? "").trim();

        const resolvedOwnerEmail =
          resolveEmployeeEmailByNameOrEmail(ownerValue) ||
          (isValidEmail(explicitEmail) ? explicitEmail : "") ||
          (isValidEmail(ownerValue) ? ownerValue : "");

        const ownerUser = resolvedOwnerEmail
          ? (allUsers as any[]).find((u) => normalizeKey(u?.email) === normalizeKey(resolvedOwnerEmail))
          : undefined;

        if (ownerUser || isValidEmail(resolvedOwnerEmail)) {
          const recipientKeyBase = ownerUser?._id ? `u:${String(ownerUser._id)}` : `e:${normalizeKey(resolvedOwnerEmail)}`;
          const key = `${role}|${recipientKeyBase}`;
          if (!recipientsByKey.has(key)) {
            recipientsByKey.set(key, {
              userId: ownerUser?._id ? String(ownerUser._id) : undefined,
              email: resolvedOwnerEmail,
              name: ownerUser?.fullName || ownerUser?.name || resolvedOwnerEmail,
              role,
              sendInApp: true,
              sendEmail: true,
            });
          }
        }
      };

      for (const sub of linkedSubs) {
        addOwnerRecipient(sub, "owner");
        addOwnerRecipient(sub, "owner2");
      }

      for (const sub of linkedSubs) {
        const subscriptionDepts = parseDepartments(sub);
        for (const deptName of subscriptionDepts) {
          const dept = deptByName.get(normalizeKey(deptName));
          if (!dept) continue;

          const deptEmail = String((dept as any)?.email || "").trim();
          const deptHeadName = String((dept as any)?.departmentHead || "").trim();

          let deptHeadUser: any | undefined;
          let resolvedEmail = "";

          if (isValidEmail(deptEmail)) {
            resolvedEmail = deptEmail;
            deptHeadUser = (allUsers as any[]).find((u) => normalizeKey(u?.email) === normalizeKey(deptEmail));
          }

          if (!resolvedEmail && isValidEmail(deptHeadName)) {
            resolvedEmail = deptHeadName;
            deptHeadUser = (allUsers as any[]).find((u) => normalizeKey(u?.email) === normalizeKey(deptHeadName));
          }

          if (!deptHeadUser && deptHeadName) {
            deptHeadUser = (allUsers as any[]).find(
              (u) => normalizeKey(u?.fullName) === normalizeKey(deptHeadName) || normalizeKey(u?.name) === normalizeKey(deptHeadName)
            );
            if (deptHeadUser && isValidEmail(deptHeadUser.email)) {
              resolvedEmail = String(deptHeadUser.email).trim();
            }
          }

          if (!resolvedEmail && deptHeadName) {
            const empEmail = resolveEmployeeEmailByNameOrEmail(deptHeadName);
            if (empEmail) resolvedEmail = empEmail;
          }

          if (deptHeadUser || isValidEmail(resolvedEmail)) {
            const recipientKeyBase = deptHeadUser?._id ? `u:${String(deptHeadUser._id)}` : `e:${normalizeKey(resolvedEmail)}`;
            const key = `dept_head|${recipientKeyBase}`;
            if (!recipientsByKey.has(key)) {
              recipientsByKey.set(key, {
                userId: deptHeadUser?._id ? String(deptHeadUser._id) : undefined,
                email: resolvedEmail,
                name: deptHeadUser?.fullName || deptHeadUser?.name || deptHeadName || resolvedEmail,
                role: "dept_head",
                recipientDepartments: [String(deptName || "").trim()].filter(Boolean),
                sendInApp: true,
                sendEmail: true,
              });
            } else {
              const existing = recipientsByKey.get(key);
              const deptTrimmed = String(deptName || "").trim();
              if (existing && deptTrimmed) {
                const merged = Array.from(new Set([...(existing.recipientDepartments || []), deptTrimmed]));
                recipientsByKey.set(key, { ...existing, recipientDepartments: merged });
              }
            }
          }
        }
      }

      const paymentId = String(payment._id?.toString?.() || payment.id || paymentName);
      const expiresLabel = formatExpiryLabel(payment.expiresAt);

      for (const recipient of Array.from(recipientsByKey.values())) {
        const recipientEmail = recipient.email && isValidEmail(recipient.email) ? String(recipient.email).trim() : "";

        const noticeKey = [
          "payment_method_expiring",
          tenantId,
          paymentId,
          String(payment.expiresAt || ""),
          `role:${recipient.role}`,
          recipient.userId ? `uid:${recipient.userId}` : `email:${normalizeKey(recipientEmail)}`,
        ].join("|");

        const already = await db.collection("payment_expiry_notices").findOne({ tenantId, noticeKey });
        if (already) continue;

        let emailOk = false;
        if (recipient.sendEmail && recipientEmail) {
          const subject = `Payment method expiring soon: ${paymentName || "Payment Method"}`;
          const html = buildEmailHtml({
            recipientName: String(recipient.name || recipientEmail || "User"),
            role: recipient.role,
            paymentName,
            expiresLabel,
            linkedCount: linkedSubs.length,
          });

          emailOk = await emailService.sendEmail({
            to: recipientEmail,
            subject,
            html,
          });

          if (emailOk) emailsSent++;
        }

        let inAppOk = false;
        if (recipient.sendInApp && (recipient.userId || recipientEmail)) {
          const userEmail = recipientEmail ? normalizeKey(recipientEmail) : "";
          const existing = await db.collection("notifications").findOne({
            tenantId,
            $or: [
              ...(recipient.userId ? [{ userId: String(recipient.userId) }] : []),
              ...(userEmail ? [{ userEmail }] : []),
            ],
            eventType: "payment_method_expiring",
            paymentId,
            paymentExpiresAt: String(payment.expiresAt || ""),
            recipientRole: recipient.role,
          });

          if (!existing) {
            const message = `Payment method "${paymentName || "(Unnamed)"}" is expiring soon (${expiresLabel}).`;
            const deptNames =
              recipient.role === "dept_head"
                ? Array.from(new Set((recipient.recipientDepartments || []).map((d) => String(d || "").trim()).filter(Boolean)))
                : [];

            await db.collection("notifications").insertOne({
              tenantId,
              ...(recipient.userId ? { userId: String(recipient.userId) } : {}),
              ...(userEmail ? { userEmail } : {}),
              type: "subscription",
              eventType: "payment_method_expiring",
              message,
              recipientRole: recipient.role,
              ...(recipient.role === "dept_head" ? { recipientDepartments: deptNames } : {}),
              read: false,
              createdAt: new Date(),
              timestamp: new Date(),
              subscriptionName: paymentName || "Payment Method",
              category: "Payment Method",
              paymentId,
              paymentExpiresAt: String(payment.expiresAt || ""),
              linkedSubscriptionCount: linkedSubs.length,
            });
            inAppOk = true;
            noticesCreated++;
          }
        }

        await db.collection("payment_expiry_notices").insertOne({
          tenantId,
          noticeKey,
          paymentId,
          paymentName,
          expiresAt: payment.expiresAt,
          recipientRole: recipient.role,
          recipientUserId: recipient.userId || null,
          recipientEmail: recipientEmail || null,
          emailSent: emailOk,
          inAppCreated: inAppOk,
          createdAt: new Date(),
        });
      }
    }

    return { noticesCreated, emailsSent };
  }

  async checkAndSendPaymentMethodExpiringNotifications(params?: {
    windowDays?: number;
    now?: Date;
  }): Promise<{ tenantsProcessed: number; noticesCreated: number; emailsSent: number }> {
    const windowDays = Number(params?.windowDays ?? process.env.PAYMENT_METHOD_EXPIRY_DAYS ?? 30);
    const now = params?.now ?? new Date();

    const db = await connectToDatabase();
    const { decrypt } = await import("./encryption.service.js");

    const tenantIds: string[] = await db.collection("payment").distinct("tenantId", {});

    let tenantsProcessed = 0;
    let noticesCreated = 0;
    let emailsSent = 0;

    for (const tenantId of tenantIds.filter(Boolean)) {
      tenantsProcessed++;

      const payments: PaymentDoc[] = await db
        .collection("payment")
        .find({ tenantId, expiresAt: { $exists: true, $ne: "" } })
        .toArray();

      const expiringPayments = payments
        .map((p) => {
          const parsed = parseExpiresAt(p.expiresAt);
          if (!parsed) return null;
          const expiryEnd = endOfExpiryMonthUtc(parsed.year, parsed.month);
          const remaining = daysUntil(expiryEnd, now);
          if (remaining < 0) return null;
          if (remaining > windowDays) return null;
          return { payment: p, expiryEnd, remainingDays: remaining };
        })
        .filter(Boolean) as Array<{ payment: PaymentDoc; expiryEnd: Date; remainingDays: number }>;

      if (expiringPayments.length === 0) continue;

      const [allUsers, allEmployees, allDepts, allSubs] = await Promise.all([
        db.collection("login").find({ tenantId }).toArray(),
        db.collection("employees").find({ tenantId }).toArray(),
        db.collection("departments").find({ tenantId }).toArray(),
        db.collection("subscriptions").find({ tenantId, $or: [{ isActive: true }, { status: { $in: ["Active", "active"] } }] }).toArray(),
      ]);

      // Group subscriptions by decrypted payment method name
      const subsByPaymentName = new Map<string, SubscriptionDoc[]>();
      for (const sub of allSubs as SubscriptionDoc[]) {
        let paymentMethodName = "";
        try {
          paymentMethodName = sub.paymentMethod ? decrypt(sub.paymentMethod) : "";
        } catch {
          paymentMethodName = String(sub.paymentMethod ?? "");
        }
        const key = normalizeKey(paymentMethodName);
        if (!key) continue;
        const existing = subsByPaymentName.get(key);
        if (existing) existing.push(sub);
        else subsByPaymentName.set(key, [sub]);
      }

      // Fast lookup for departments by name (case-insensitive)
      const deptByName = new Map<string, any>();
      for (const dept of allDepts) {
        const k = normalizeKey((dept as any)?.name);
        if (k) deptByName.set(k, dept);
      }

      for (const { payment } of expiringPayments) {
        const paymentName = getPaymentName(payment);
        const paymentKey = normalizeKey(paymentName);
        if (!paymentKey) continue;

        const linkedSubs = subsByPaymentName.get(paymentKey) || [];
        if (linkedSubs.length === 0) continue;

        // Use role-specific keys so the same email can receive multiple notifications/emails
        // (e.g., an email can be both owner2 and dept_head).
        const recipientsByKey = new Map<string, Recipient>();

        const resolveEmployeeEmailByNameOrEmail = (value: any): string => {
          const v = String(value ?? "").trim();
          if (!v) return "";
          if (isValidEmail(v)) return v;
          const key = normalizeKey(v);
          const employee = (allEmployees as any[]).find((e) => {
            const employeeName = normalizeKey(e?.name);
            const employeeEmail = normalizeKey(e?.email);
            return employeeName === key || employeeEmail === key;
          });
          const email = String(employee?.email || "").trim();
          return isValidEmail(email) ? email : "";
        };

        const addOwnerRecipient = (sub: SubscriptionDoc, role: "owner" | "owner2") => {
          const ownerValue = String((role === "owner" ? sub.owner : sub.owner2) ?? "").trim();
          const explicitEmail = String((role === "owner" ? sub.ownerEmail : sub.owner2Email) ?? "").trim();

          const resolvedOwnerEmail =
            resolveEmployeeEmailByNameOrEmail(ownerValue) ||
            (isValidEmail(explicitEmail) ? explicitEmail : "") ||
            (isValidEmail(ownerValue) ? ownerValue : "");

          const ownerUser = resolvedOwnerEmail
            ? (allUsers as any[]).find((u) => normalizeKey(u?.email) === normalizeKey(resolvedOwnerEmail))
            : undefined;

          if (ownerUser || isValidEmail(resolvedOwnerEmail)) {
            const recipientKeyBase = ownerUser?._id ? `u:${String(ownerUser._id)}` : `e:${normalizeKey(resolvedOwnerEmail)}`;
            const key = `${role}|${recipientKeyBase}`;
            if (!recipientsByKey.has(key)) {
              recipientsByKey.set(key, {
                userId: ownerUser?._id ? String(ownerUser._id) : undefined,
                email: resolvedOwnerEmail,
                name: ownerUser?.fullName || ownerUser?.name || resolvedOwnerEmail,
                role,
                sendInApp: true,
                sendEmail: true,
              });
            }
          }
        };

        // Owners (Person 1) + Owners 2 (Person 2)
        for (const sub of linkedSubs) {
          addOwnerRecipient(sub, "owner");
          addOwnerRecipient(sub, "owner2");
        }

        // Dept Heads
        for (const sub of linkedSubs) {
          const subscriptionDepts = parseDepartments(sub);
          for (const deptName of subscriptionDepts) {
            const dept = deptByName.get(normalizeKey(deptName));
            if (!dept) continue;

            const deptEmail = String((dept as any)?.email || "").trim();
            const deptHeadName = String((dept as any)?.departmentHead || "").trim();

            let deptHeadUser: any | undefined;
            let resolvedEmail = "";

            if (isValidEmail(deptEmail)) {
              resolvedEmail = deptEmail;
              deptHeadUser = (allUsers as any[]).find((u) => normalizeKey(u?.email) === normalizeKey(deptEmail));
            }

            // Allow departmentHead to be an email
            if (!resolvedEmail && isValidEmail(deptHeadName)) {
              resolvedEmail = deptHeadName;
              deptHeadUser = (allUsers as any[]).find((u) => normalizeKey(u?.email) === normalizeKey(deptHeadName));
            }

            if (!deptHeadUser && deptHeadName) {
              deptHeadUser = (allUsers as any[]).find(
                (u) => normalizeKey(u?.fullName) === normalizeKey(deptHeadName) || normalizeKey(u?.name) === normalizeKey(deptHeadName)
              );
              if (deptHeadUser && isValidEmail(deptHeadUser.email)) {
                resolvedEmail = String(deptHeadUser.email).trim();
              }
            }

            // As a fallback, resolve departmentHead name through employees
            if (!resolvedEmail && deptHeadName) {
              const empEmail = resolveEmployeeEmailByNameOrEmail(deptHeadName);
              if (empEmail) resolvedEmail = empEmail;
            }

            if (deptHeadUser || isValidEmail(resolvedEmail)) {
              const recipientKeyBase = deptHeadUser?._id ? `u:${String(deptHeadUser._id)}` : `e:${normalizeKey(resolvedEmail)}`;
              const key = `dept_head|${recipientKeyBase}`;
              if (!recipientsByKey.has(key)) {
                recipientsByKey.set(key, {
                  userId: deptHeadUser?._id ? String(deptHeadUser._id) : undefined,
                  email: resolvedEmail,
                  name: deptHeadUser?.fullName || deptHeadUser?.name || deptHeadName || resolvedEmail,
                  role: "dept_head",
                  recipientDepartments: [String(deptName || "").trim()].filter(Boolean),
                  sendInApp: true,
                  sendEmail: true,
                });
              } else {
                const existing = recipientsByKey.get(key);
                const deptTrimmed = String(deptName || "").trim();
                if (existing && deptTrimmed) {
                  const merged = Array.from(new Set([...(existing.recipientDepartments || []), deptTrimmed]));
                  recipientsByKey.set(key, { ...existing, recipientDepartments: merged });
                }
              }
            }
          }
        }

        const paymentId = String(payment._id?.toString?.() || payment.id || paymentName);
        const expiresLabel = formatExpiryLabel(payment.expiresAt);

        for (const recipient of Array.from(recipientsByKey.values())) {
          const recipientEmail = recipient.email && isValidEmail(recipient.email) ? String(recipient.email).trim() : "";

          const noticeKey = [
            "payment_method_expiring",
            tenantId,
            paymentId,
            String(payment.expiresAt || ""),
            `role:${recipient.role}`,
            recipient.userId ? `uid:${recipient.userId}` : `email:${normalizeKey(recipientEmail)}`,
          ].join("|");

          const already = await db.collection("payment_expiry_notices").findOne({ tenantId, noticeKey });
          if (already) continue;

          let emailOk = false;
          if (recipient.sendEmail && recipientEmail) {
            const subject = `Payment method expiring soon: ${paymentName || "Payment Method"}`;
            const html = buildEmailHtml({
              recipientName: String(recipient.name || recipientEmail || "User"),
              role: recipient.role,
              paymentName,
              expiresLabel,
              linkedCount: linkedSubs.length,
            });

            emailOk = await emailService.sendEmail({
              to: recipientEmail,
              subject,
              html,
            });

            if (emailOk) emailsSent++;
          }

          let inAppOk = false;
          if (recipient.sendInApp && (recipient.userId || recipientEmail)) {
            const userEmail = recipientEmail ? normalizeKey(recipientEmail) : "";
            const existing = await db.collection("notifications").findOne({
              tenantId,
              $or: [
                ...(recipient.userId ? [{ userId: String(recipient.userId) }] : []),
                ...(userEmail ? [{ userEmail }] : []),
              ],
              eventType: "payment_method_expiring",
              paymentId,
              paymentExpiresAt: String(payment.expiresAt || ""),
              recipientRole: recipient.role,
            });

            if (!existing) {
              const message = `Payment method "${paymentName || "(Unnamed)"}" is expiring soon (${expiresLabel}).`;

              // For dept heads, include the departments they matched.
              const deptNames = recipient.role === "dept_head"
                ? Array.from(new Set((recipient.recipientDepartments || []).map((d) => String(d || "").trim()).filter(Boolean)))
                : [];

              await db.collection("notifications").insertOne({
                tenantId,
                ...(recipient.userId ? { userId: String(recipient.userId) } : {}),
                ...(userEmail ? { userEmail } : {}),
                type: "subscription",
                eventType: "payment_method_expiring",
                message,
                recipientRole: recipient.role,
                ...(recipient.role === "dept_head" ? { recipientDepartments: deptNames } : {}),
                read: false,
                createdAt: new Date(),
                timestamp: new Date(),
                subscriptionName: paymentName || "Payment Method",
                category: "Payment Method",
                paymentId,
                paymentExpiresAt: String(payment.expiresAt || ""),
                linkedSubscriptionCount: linkedSubs.length,
              });
              inAppOk = true;
              noticesCreated++;
            }
          }

          await db.collection("payment_expiry_notices").insertOne({
            tenantId,
            noticeKey,
            paymentId,
            paymentName,
            expiresAt: payment.expiresAt,
            recipientRole: recipient.role,
            recipientUserId: recipient.userId || null,
            recipientEmail: recipientEmail || null,
            emailSent: emailOk,
            inAppCreated: inAppOk,
            createdAt: new Date(),
          });
        }
      }
    }

    return { tenantsProcessed, noticesCreated, emailsSent };
  }
}
