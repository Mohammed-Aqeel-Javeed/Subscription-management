import { emailService } from "./email.service";
import { connectToDatabase } from "./mongo.js";
import type { ObjectId as MongoObjectId } from "mongodb";

/**
 * Subscription Lifecycle Notification Service
 * 
 * Notification Rules:
 * - IA = In-App notification
 * - EM = Email notification
 * - X = No notification
 * 
 * 1. Create Subscription: Admin (IA+EM), Owner (IA+EM), Dept Head (IA+EM)
 * 2. Modify - Owner Change: Admin (IA), New Owner (IA+EM), Dept Head (X)
 * 3. Modify - Price Change: Admin (IA+EM), Owner (IA+EM), Dept Head (IA+EM)
 * 4. Modify - Quantity Change: Admin (IA), Owner (IA), Dept Head (IA)
 * 5. Modify - Other Fields: Admin (X), Owner (X), Dept Head (X)
 * 6. Cancel Subscription: Admin (IA+EM), Owner (IA+EM), Dept Head (IA+EM)
 */

interface NotificationRecipient {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'owner' | 'dept_head';
  sendInApp: boolean;
  sendEmail: boolean;
}

interface SubscriptionData {
  id?: string | number;
  _id?: string | MongoObjectId;
  serviceName?: string;
  owner?: string;
  ownerEmail?: string;
  departments?: string[];
  department?: string;
  amount?: number;
  qty?: number;
  status?: string;
  tenantId?: string;
  [key: string]: any;
}

/**
 * Get all users who should receive notifications for a subscription
 */
async function getNotificationRecipients(
  subscription: SubscriptionData,
  eventType: 'created' | 'owner_changed' | 'price_changed' | 'quantity_changed' | 'cancelled' | 'deleted',
  oldOwner?: string
): Promise<NotificationRecipient[]> {
  const recipients: NotificationRecipient[] = [];

  const isEmail = (value: any) => {
    if (!value) return false;
    const s = String(value).trim();
    // simple but effective check (avoids obvious bad values like "Jaggu" or "x@gmail.c")
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  };

  try {
    const db = await connectToDatabase();
    const tenantId = subscription.tenantId;

    if (!tenantId) {
      console.error('No tenantId provided for subscription');
      return recipients;
    }

    // Get all users for this tenant (from login collection)
    const allUsers = await db.collection("login").find({ tenantId }).toArray();
    console.log(`  Found ${allUsers.length} users in tenant`);
    
    // Also get employees for owner matching
    const allEmployees = await db.collection("employees").find({ tenantId }).toArray();
    console.log(`  Found ${allEmployees.length} employees in tenant`);
    
    // Debug: Show all users
    allUsers.forEach(u => {
      console.log(`    User: ${u.fullName || u.name} (${u.email}) - Role: ${u.role}`);
    });
    
    // Get department heads for subscription departments
    let deptHeads: any[] = [];
    let subscriptionDepts: string[] = [];
    
    // Parse departments - could be array, JSON string, or single string
    if (Array.isArray(subscription.departments)) {
      subscriptionDepts = subscription.departments;
    } else if (subscription.department) {
      try {
        const parsed = JSON.parse(subscription.department);
        subscriptionDepts = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        subscriptionDepts = [subscription.department];
      }
    }
    
    console.log(`  Subscription departments: ${subscriptionDepts.join(', ') || 'none'}`);
    
    if (subscriptionDepts.length > 0) {
      const deptList = await db.collection("departments")
        .find({ 
          tenantId, 
          $and: [
            { departmentHead: { $exists: true } },
            { departmentHead: { $ne: null } },
            { departmentHead: { $ne: "" } }
          ]
        })
        .toArray();
      
      console.log(`  All departments with heads in tenant:`, deptList.map(d => `${d.name} (head: ${d.departmentHead})`));
      
      deptHeads = deptList.filter(dept => 
        subscriptionDepts.includes(dept.name) && dept.departmentHead
      );
      console.log(`  Found ${deptHeads.length} department heads for subscription departments`);
      
      if (deptHeads.length === 0 && deptList.length > 0) {
        console.log(`  ⚠️ No matching department heads. Subscription has: [${subscriptionDepts.join(', ')}], Available: [${deptList.map(d => d.name).join(', ')}]`);
      }
    }

    // Define notification rules based on event type
    const rules = {
      created: {
        admin: { inApp: true, email: true },
        owner: { inApp: true, email: true },
        deptHead: { inApp: true, email: true }
      },
      owner_changed: {
        admin: { inApp: true, email: false },
        owner: { inApp: true, email: true }, // New owner
        deptHead: { inApp: false, email: false }
      },
      price_changed: {
        admin: { inApp: true, email: true },
        owner: { inApp: true, email: true },
        deptHead: { inApp: true, email: true }
      },
      quantity_changed: {
        admin: { inApp: true, email: false },
        owner: { inApp: true, email: false },
        deptHead: { inApp: true, email: false }
      },
      cancelled: {
        admin: { inApp: true, email: true },
        owner: { inApp: true, email: true },
        deptHead: { inApp: true, email: true }
      },
      deleted: {
        admin: { inApp: true, email: false },
        owner: { inApp: true, email: false },
        deptHead: { inApp: true, email: false }
      }
    };

    const rule = rules[eventType];

    // Add admins
    const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');
    console.log(`  Found ${admins.length} admins`);
    for (const admin of admins) {
      if (rule.admin.inApp || rule.admin.email) {
        recipients.push({
          userId: String(admin._id),
          email: admin.email,
          name: admin.fullName || admin.name || admin.email,
          role: 'admin',
          sendInApp: rule.admin.inApp,
          sendEmail: rule.admin.email
        });
      }
    }

    // Add subscription owner
    if (subscription.owner) {
      // First try to find in employees collection (since owner comes from employee dropdown)
      const ownerValue = String(subscription.owner).trim().toLowerCase();
      const employee = allEmployees.find(e => {
        const employeeName = String(e.name || '').trim().toLowerCase();
        const employeeEmail = String(e.email || '').trim().toLowerCase();
        return employeeName === ownerValue || employeeEmail === ownerValue;
      });

      // Prefer the employee email (new owner) when available
      const resolvedOwnerEmail =
        (employee?.email && String(employee.email).trim()) ||
        (subscription.ownerEmail && String(subscription.ownerEmail).trim()) ||
        (typeof subscription.owner === 'string' ? subscription.owner.trim() : '');
      
      // Then find the corresponding user in login collection
      let owner;
      if (employee) {
        owner = allUsers.find(u => 
          u.email === employee.email || 
          u.fullName === employee.name ||
          u.name === employee.name
        );
        console.log(`  Found employee: ${employee.name} (${employee.email})`);

        // Keep subscription.ownerEmail aligned for downstream template/fallbacks
        if (employee.email && !subscription.ownerEmail) {
          subscription.ownerEmail = employee.email;
        }
      }
      
      // Fallback: try direct match in users
      if (!owner) {
        owner = allUsers.find(u => 
          u.fullName === subscription.owner || 
          u.name === subscription.owner ||
          u.email === subscription.ownerEmail
        );
      }
      
      if (owner && (rule.owner.inApp || rule.owner.email)) {
        console.log(`  Found owner user: ${owner.fullName || owner.name} (${owner.email}) for owner "${subscription.owner}"`);

        const explicitOwnerEmail = subscription.ownerEmail ? String(subscription.ownerEmail).trim() : '';
        const loginOwnerEmail = owner.email ? String(owner.email).trim() : '';
        const deliveryEmail = isEmail(explicitOwnerEmail)
          ? explicitOwnerEmail
          : (isEmail(loginOwnerEmail) ? loginOwnerEmail : '');

        if (isEmail(explicitOwnerEmail) && isEmail(loginOwnerEmail) && explicitOwnerEmail.toLowerCase() !== loginOwnerEmail.toLowerCase()) {
          console.log(`  ⚠️ Owner email mismatch: subscription.ownerEmail=${explicitOwnerEmail} login.email=${loginOwnerEmail}. Using subscription.ownerEmail for delivery.`);
        }
        
        // Check if owner is already added as admin - if so, don't add duplicate
        const alreadyAdded = recipients.some(r => r.userId === String(owner._id));
        if (!alreadyAdded) {
          recipients.push({
            userId: String(owner._id),
            email: deliveryEmail || loginOwnerEmail,
            name: owner.fullName || owner.name || owner.email,
            role: 'owner',
            sendInApp: rule.owner.inApp,
            sendEmail: rule.owner.email && !!deliveryEmail
          });

          if (rule.owner.email && !deliveryEmail) {
            console.log(`  ⚠️ No valid owner email resolved (subscription.ownerEmail=${explicitOwnerEmail || 'n/a'} login.email=${loginOwnerEmail || 'n/a'}). Email disabled for owner.`);
          }
        } else {
          console.log(`  ⚠️ Owner ${owner.fullName || owner.name} already added as admin - skipping duplicate`);
        }
      } else {
        console.log(`  ⚠️ Owner user not found in login for owner: ${subscription.owner}`);

        // Fallback: still send email to ownerEmail if provided (email-only recipient)
        const fallbackEmail = isEmail(resolvedOwnerEmail) ? resolvedOwnerEmail : '';

        if (fallbackEmail && rule.owner.email) {
          console.log(`  → Using resolved owner email for delivery: ${fallbackEmail}`);
          const alreadyAdded = recipients.some(r => r.email?.toLowerCase?.() === String(fallbackEmail).toLowerCase());
          if (!alreadyAdded) {
            recipients.push({
              userId: '',
              email: fallbackEmail,
              name: subscription.owner || fallbackEmail,
              role: 'owner',
              sendInApp: false,
              sendEmail: true,
            });
          }
        } else {
          if (resolvedOwnerEmail) {
            console.log(`  ⚠️ Resolved owner email is invalid, skipping: ${resolvedOwnerEmail}`);
          }
          console.log(`  Available employees: ${allEmployees.map(e => `${e.name} (${e.email})`).join(', ')}`);
        }
      }
    }

    // Edge case: owner not set but ownerEmail exists (still notify by email if required)
    if (!subscription.owner && subscription.ownerEmail && rule.owner.email && isEmail(subscription.ownerEmail)) {
      recipients.push({
        userId: '',
        email: String(subscription.ownerEmail),
        name: String(subscription.ownerEmail),
        role: 'owner',
        sendInApp: false,
        sendEmail: true,
      });
    }

    // Add department heads
    if (rule.deptHead.inApp || rule.deptHead.email) {
      console.log(`  Looking for department heads in departments: ${subscriptionDepts.join(', ')}`);
      
      if (deptHeads.length === 0) {
        console.log(`  ⚠️ No department heads configured. Please assign heads to departments in Configuration > Departments.`);
      }
      
      for (const dept of deptHeads) {
        // Use the department's email field directly if available
        if (dept.email && rule.deptHead.email) {
          console.log(`  Using department email for ${dept.name}: ${dept.email}`);
          
          // Find user by department email to get userId for in-app notification
          const deptHeadUser = allUsers.find(u => u.email === dept.email);
          
          if (deptHeadUser) {
            const alreadyAdded = recipients.some(r => r.userId === String(deptHeadUser._id));
            if (!alreadyAdded) {
              console.log(`  Found dept head user: ${deptHeadUser.fullName || deptHeadUser.name} (${deptHeadUser.email}) for ${dept.name}`);
              recipients.push({
                userId: String(deptHeadUser._id),
                email: deptHeadUser.email,
                name: deptHeadUser.fullName || deptHeadUser.name || deptHeadUser.email,
                role: 'dept_head',
                sendInApp: rule.deptHead.inApp,
                sendEmail: rule.deptHead.email
              });
            }
          } else {
            console.log(`  ⚠️ Department email ${dept.email} for ${dept.name} not found in users. Creating email-only recipient.`);
            // Create a recipient with just email (no in-app notification)
            recipients.push({
              userId: '', // No userId for email-only recipients
              email: dept.email,
              name: dept.departmentHead || dept.name,
              role: 'dept_head',
              sendInApp: false, // Can't send in-app without userId
              sendEmail: rule.deptHead.email
            });
          }
        } else {
          // Fallback: try to find department head by name in users
          const deptHead = allUsers.find(u => 
            u.fullName === dept.departmentHead || 
            u.name === dept.departmentHead
          );
          if (deptHead) {
            const alreadyAdded = recipients.some(r => r.userId === String(deptHead._id));
            if (!alreadyAdded) {
              console.log(`  Found dept head: ${deptHead.fullName || deptHead.name} (${deptHead.email}) for ${dept.name}`);
              recipients.push({
                userId: String(deptHead._id),
                email: deptHead.email,
                name: deptHead.fullName || deptHead.name || deptHead.email,
                role: 'dept_head',
                sendInApp: rule.deptHead.inApp,
                sendEmail: rule.deptHead.email
              });
            }
          } else {
            console.log(`  ⚠️ Department head "${dept.departmentHead}" for ${dept.name} not found in users`);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error getting notification recipients:', error);
  }

  return recipients;
}

/**
 * Create in-app notification
 */
async function createInAppNotification(
  userId: string,
  subscription: SubscriptionData,
  eventType: 'created' | 'owner_changed' | 'price_changed' | 'quantity_changed' | 'cancelled' | 'deleted',
  additionalData?: any
) {
  try {
    const db = await connectToDatabase();
    
    const notificationData = {
      userId,
      tenantId: subscription.tenantId,
      type: 'subscription',
      eventType: eventType === 'created' ? 'created' : 
                 (eventType === 'cancelled' || eventType === 'deleted') ? 'deleted' : 'updated',
      lifecycleEventType: eventType,
      subscriptionId: String(subscription.id || subscription._id),
      subscriptionName: subscription.serviceName,
      category: subscription.category || 'Subscription',
      createdAt: new Date(),
      timestamp: new Date(),
      ...additionalData
    };

    // Store notification in MongoDB
    await db.collection("notifications").insertOne(notificationData);
    console.log(`Created in-app notification for user ${userId}:`, notificationData);

  } catch (error) {
    console.error('Error creating in-app notification:', error);
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  recipient: NotificationRecipient,
  subscription: SubscriptionData,
  eventType: 'created' | 'owner_changed' | 'price_changed' | 'quantity_changed' | 'cancelled' | 'deleted',
  additionalData?: any
) {
  try {
    let subject = '';
    let body = '';

    const serviceName = subscription.serviceName || 'Unknown Service';
    const recipientName = recipient.name;
    const recipientRole = recipient.role;

    const getSubscriptionDepartments = (): string[] => {
      if (Array.isArray(subscription.departments)) return subscription.departments.filter(Boolean);
      const raw = subscription.department;
      if (!raw) return [];
      if (Array.isArray(raw)) return (raw as any[]).map(String);
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

    const departments = getSubscriptionDepartments();
    const departmentsLabel = departments.length ? departments.join(', ') : 'N/A';

    const formatMoney = (value: any) => {
      if (value === null || value === undefined || value === '') return 'N/A';
      const num = typeof value === 'string' ? Number(value) : value;
      const formatted = typeof num === 'number' && !isNaN(num) ? num.toFixed(2) : String(value);
      const currency = (subscription as any).currency;
      return currency ? `${currency} ${formatted}` : formatted;
    };

    const roleIntro =
      recipientRole === 'dept_head'
        ? `<p>You are receiving this notification because you are the <strong>Department Head</strong> for: <strong>${departmentsLabel}</strong>.</p>`
        : recipientRole === 'owner'
          ? `<p>You are receiving this notification because you are the <strong>Subscription Owner</strong>.</p>`
          : `<p>You are receiving this notification because you are an <strong>Admin</strong>.</p>`;

    switch (eventType) {
      case 'created':
        subject = `${recipientRole === 'admin' ? 'Admin: ' : ''}New Subscription Created: ${serviceName}`;
        body = `
          <h2>New Subscription Created</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>A new subscription has been created.</p>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Department(s):</strong> ${departmentsLabel}</li>
            <li><strong>Amount:</strong> ${formatMoney(subscription.amount)}</li>
            <li><strong>Status:</strong> ${subscription.status || 'Active'}</li>
          </ul>
          <p>Please review the subscription details in Trackla.</p>
        `;
        break;

      case 'owner_changed':
        subject = `Subscription Owner Changed: ${serviceName}`;
        body = `
          <h2>Subscription Owner Changed</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>The owner of the subscription "${serviceName}" has been changed.</p>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Department(s):</strong> ${departmentsLabel}</li>
            ${recipientRole === 'owner' ? `<li><strong>Your Role:</strong> You are now the subscription owner</li>` : ''}
            ${additionalData?.oldOwner ? `<li><strong>Previous Owner:</strong> ${additionalData.oldOwner}</li>` : ''}
          </ul>
          <p>Please review the subscription details in Trackla.</p>
        `;
        break;

      case 'price_changed':
        subject = `${recipientRole === 'admin' ? 'Admin: ' : ''}Subscription Price Updated: ${serviceName}`;
        body = `
          <h2>Subscription Price Changed</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>The price of the subscription "${serviceName}" has been updated.</p>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Department(s):</strong> ${departmentsLabel}</li>
            ${additionalData?.oldAmount !== undefined && additionalData?.oldAmount !== null ? `<li><strong>Previous Amount:</strong> ${formatMoney(additionalData.oldAmount)}</li>` : ''}
            <li><strong>New Amount:</strong> ${formatMoney(subscription.amount)}</li>
          </ul>
          <p>Please review the updated subscription details in Trackla.</p>
        `;
        break;

      case 'quantity_changed':
        subject = `Subscription Quantity Updated: ${serviceName}`;
        body = `
          <h2>Subscription Quantity Changed</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>The quantity of the subscription "${serviceName}" has been updated.</p>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Department(s):</strong> ${departmentsLabel}</li>
            ${additionalData?.oldQty ? `<li><strong>Previous Quantity:</strong> ${additionalData.oldQty}</li>` : ''}
            <li><strong>New Quantity:</strong> ${subscription.qty || 'N/A'}</li>
          </ul>
          <p>Please review the updated subscription details in Trackla.</p>
        `;
        break;

      case 'cancelled':
        subject = `${recipientRole === 'admin' ? 'Admin: ' : ''}Subscription Cancelled: ${serviceName}`;
        body = `
          <h2>Subscription Cancelled</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>The subscription "${serviceName}" has been cancelled.</p>
          <ul>
            <li><strong>Service:</strong> ${serviceName}</li>
            <li><strong>Department(s):</strong> ${departmentsLabel}</li>
            <li><strong>Previous Status:</strong> ${additionalData?.oldStatus || 'Active'}</li>
            <li><strong>New Status:</strong> Cancelled</li>
          </ul>
          <p>Please review the subscription details in Trackla if needed.</p>
        `;
        break;
    }

    const ok = await emailService.sendEmail({
      to: recipient.email,
      subject: subject,
      html: body
    });
    if (ok) {
      console.log(`✅ Email sent to ${recipient.email} for ${eventType} event`);
    } else {
      console.warn(
        `⚠️ Email NOT sent to ${recipient.email} for ${eventType} event (email service not configured or send failed)`
      );
    }

  } catch (error) {
    console.error(`❌ Error sending email notification to ${recipient.email}:`, error);
  }
}

/**
 * Main function to send notifications for subscription lifecycle events
 */
export async function sendSubscriptionNotifications(
  eventType: 'create' | 'ownerChange' | 'priceChange' | 'quantityChange' | 'cancel' | 'delete',
  newSubscription: SubscriptionData,
  oldSubscription: SubscriptionData | null,
  tenantId: string,
  db: any
) {
  try {
    // DECRYPT subscription data before processing
    const { decryptSubscriptionData } = await import("./encryption.service.js");
    
    console.log(`🔐 Before decryption - serviceName: ${newSubscription.serviceName?.substring(0, 50)}...`);
    const decryptedNew = decryptSubscriptionData(newSubscription);
    console.log(`� Aftder decryption - serviceName: ${decryptedNew.serviceName}`);
    console.log(`🔓 After decryption - owner: ${decryptedNew.owner}`);
    console.log(`🔓 After decryption - amount: ${decryptedNew.amount}`);
    
    const decryptedOld = oldSubscription ? decryptSubscriptionData(oldSubscription) : null;
    
    console.log(`🔔 Sending ${eventType} notifications for subscription: ${decryptedNew.serviceName}`);

    // Map event types to internal format
    const eventTypeMap: Record<string, 'created' | 'owner_changed' | 'price_changed' | 'quantity_changed' | 'cancelled' | 'deleted'> = {
      'create': 'created',
      'ownerChange': 'owner_changed',
      'priceChange': 'price_changed',
      'quantityChange': 'quantity_changed',
      'cancel': 'cancelled',
      'delete': 'deleted'
    };

    const internalEventType = eventTypeMap[eventType];

    // Prepare additional data from decrypted old subscription
    const additionalData: any = {};
    if (decryptedOld) {
      additionalData.oldOwner = decryptedOld.owner;
      additionalData.oldAmount = decryptedOld.amount;
      additionalData.oldQty = decryptedOld.qty;
      additionalData.oldStatus = decryptedOld.status;
    }

    // Ensure tenantId is set
    if (!decryptedNew.tenantId) {
      decryptedNew.tenantId = tenantId;
    }

    // Get recipients based on event type
    const recipients = await getNotificationRecipients(
      decryptedNew,
      internalEventType,
      additionalData?.oldOwner
    );

    console.log(`📧 Found ${recipients.length} recipients for ${eventType} event`);

    // Send notifications to each recipient
    for (const recipient of recipients) {
      console.log(`  → ${recipient.name} (${recipient.role}): InApp=${recipient.sendInApp}, Email=${recipient.sendEmail}`);
      
      // Create in-app notification (only if userId exists)
      if (recipient.userId && (recipient.sendInApp || recipient.sendEmail)) {
        await createInAppNotification(recipient.userId, decryptedNew, internalEventType, additionalData);
      }

      // Send email notification
      if (recipient.sendEmail) {
        await sendEmailNotification(recipient, decryptedNew, internalEventType, additionalData);
      }
    }

    console.log(`✅ Successfully sent ${eventType} notifications for subscription: ${decryptedNew.serviceName}`);

  } catch (error) {
    console.error('❌ Error in sendSubscriptionNotifications:', error);
    throw error;
  }
}

/**
 * Helper function to detect what changed in a subscription update
 */
export function detectSubscriptionChanges(
  oldSubscription: Partial<SubscriptionData> | null | undefined,
  newSubscription: Partial<SubscriptionData> | null | undefined
): {
  ownerChanged: boolean;
  priceChanged: boolean;
  quantityChanged: boolean;
  statusChanged: boolean;
  oldOwner?: string;
  oldAmount?: number;
  oldQty?: number;
  oldStatus?: string;
} {
  const oldSub = oldSubscription ?? {};
  const newSub = newSubscription ?? {};

  const normalizeString = (value: any) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const normalizeAmount = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (Number.isNaN(num)) return null;
    // Compare at 2-decimal precision (money)
    return Math.round(num * 100) / 100;
  };

  const normalizeQty = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : Number(String(value));
    if (Number.isNaN(num)) return null;
    return num;
  };

  const oldAmount = normalizeAmount((oldSub as any).amount);
  const newAmount = normalizeAmount((newSub as any).amount);
  const oldQty = normalizeQty((oldSub as any).qty);
  const newQty = normalizeQty((newSub as any).qty);
  const oldOwner = normalizeString((oldSub as any).owner);
  const newOwner = normalizeString((newSub as any).owner);
  const oldStatus = normalizeString((oldSub as any).status).toLowerCase();
  const newStatus = normalizeString((newSub as any).status).toLowerCase();

  const amountsDiffer = () => {
    if (oldAmount === null && newAmount === null) return false;
    if (oldAmount === null || newAmount === null) return true;
    return oldAmount !== newAmount;
  };

  const qtyDiffer = () => {
    if (oldQty === null && newQty === null) return false;
    if (oldQty === null || newQty === null) return true;
    return oldQty !== newQty;
  };

  return {
    ownerChanged: oldOwner !== newOwner,
    priceChanged: amountsDiffer(),
    quantityChanged: qtyDiffer(),
    statusChanged: oldStatus !== newStatus,
    oldOwner: (oldSub as any).owner,
    oldAmount: (oldSub as any).amount,
    oldQty: (oldSub as any).qty,
    oldStatus: (oldSub as any).status
  };
}
