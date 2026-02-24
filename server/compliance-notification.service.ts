import { emailService } from "./email.service";
import { connectToDatabase } from "./mongo.js";
import type { ObjectId as MongoObjectId } from "mongodb";

const maskEmailForLog = (value: any): string => {
  const email = String(value || '').trim();
  const at = email.indexOf('@');
  if (at <= 1) return email ? '***' : '';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}***@${domain}`;
};

const maskTextForLog = (value: any): string => {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.includes('@')) return maskEmailForLog(s);
  return s.length <= 2 ? '***' : `${s[0]}***`;
};

/**
 * Compliance Lifecycle Notification Service
 * 
 * Notification Rules:
 * - IA = In-App notification
 * - EM = Email notification
 * - X = No notification
 * 
 * 1. Create Compliance: Admin (IA), Owner (IA+EM), Dept Head (IA), Owner 2 (IA)
 * 2. Modify - Owner Change: Admin (IA), New Owner (IA+EM), Dept Head (X), Owner 2 (X)
 * 3. Modify - Other Fields: Admin (X), Owner (X), Dept Head (X), Owner 2 (X)
 * 4. Submitted: Admin (IA), Owner (IA), Dept Head (X), Owner 2 (IA+EM)
 * 5. Reminder Notification: Admin (X), Owner (IA+EM), Dept Head (IA+EM), Owner 2 (IA+EM)
 */

interface NotificationRecipient {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'owner' | 'owner2' | 'dept_head';
  sendInApp: boolean;
  sendEmail: boolean;

  // Track which roles requested which delivery channels so we can send
  // separate role-specific emails (e.g., owner2 + dept_head to same address)
  sendInAppRoles?: Array<'admin' | 'owner' | 'owner2' | 'dept_head'>;
  sendEmailRoles?: Array<'admin' | 'owner' | 'owner2' | 'dept_head'>;
}

function getComplianceDepartmentsForNotification(compliance: ComplianceData): string[] {
  if (Array.isArray(compliance.departments)) return compliance.departments.map(String).filter(Boolean);
  const raw: any = (compliance as any).departments ?? (compliance as any).department;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      if (parsed) return [String(parsed)].filter(Boolean);
    } catch {
      return [value];
    }
  }
  return [];
}

interface ComplianceData {
  id?: string | number;
  _id?: string | MongoObjectId;
  filingName?: string;
  policy?: string;
  complianceName?: string;
  name?: string;
  owner?: string;
  ownerEmail?: string;
  owner2?: string;
  owner2Email?: string;
  // Can be an array or a JSON-stringified array depending on older data/imports
  departments?: string[] | string;
  department?: string;
  status?: string;
  tenantId?: string;
  complianceCategory?: string;
  category?: string;
  submissionDeadline?: string;
  reminderDays?: string | number;
  reminderPolicy?: string;
  [key: string]: any;
}

/**
 * Get all users who should receive notifications for a compliance item
 */
async function getNotificationRecipients(
  compliance: ComplianceData,
  eventType: 'created' | 'owner_changed' | 'other_fields' | 'submitted' | 'reminder',
  oldOwner?: string
): Promise<NotificationRecipient[]> {
  const recipients: NotificationRecipient[] = [];

  const isEmail = (value: any) => {
    if (!value) return false;
    const s = String(value).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  };

  try {
    const db = await connectToDatabase();
    const tenantId = compliance.tenantId;

    if (!tenantId) {
      console.error('No tenantId provided for compliance');
      return recipients;
    }

    // Get all users for this tenant (from login collection)
    const allUsers = await db.collection("login").find({ tenantId }).toArray();
    console.log(`  Found ${allUsers.length} users in tenant`);
    
    // Also get employees for owner matching
    const allEmployees = await db.collection("employees").find({ tenantId }).toArray();
    console.log(`  Found ${allEmployees.length} employees in tenant`);
    
    // Get department heads for compliance departments
    let deptHeads: any[] = [];
    let complianceDepts: string[] = [];
    
    // Parse departments - could be array, JSON string, or single string
    if (Array.isArray(compliance.departments)) {
      complianceDepts = compliance.departments;
    } else if (typeof compliance.departments === 'string' && compliance.departments.trim()) {
      try {
        const parsed = JSON.parse(compliance.departments);
        complianceDepts = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        complianceDepts = [compliance.departments];
      }
    } else if (compliance.department) {
      try {
        const parsed = JSON.parse(compliance.department);
        complianceDepts = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        complianceDepts = [compliance.department];
      }
    }

    complianceDepts = (complianceDepts || [])
      .map((d) => String(d || '').trim())
      .filter(Boolean);
    
    console.log(`  Compliance departments count: ${complianceDepts.length}`);
    
    if (complianceDepts.length > 0) {
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
      
      const compDeptSet = new Set(complianceDepts.map((d) => d.toLowerCase()));
      deptHeads = deptList.filter(dept => {
        const deptName = String(dept.name || '').trim().toLowerCase();
        return compDeptSet.has(deptName) && dept.departmentHead;
      });
      console.log(`  Found ${deptHeads.length} department heads for compliance departments`);
    }

    // Define notification rules based on event type
    const rules = {
      created: {
        admin: { inApp: true, email: false },
        owner: { inApp: true, email: true },
        owner2: { inApp: true, email: false },
        deptHead: { inApp: true, email: false }
      },
      owner_changed: {
        admin: { inApp: true, email: false },
        owner: { inApp: true, email: true }, // New owner
        owner2: { inApp: false, email: false },
        deptHead: { inApp: false, email: false }
      },
      other_fields: {
        admin: { inApp: false, email: false },
        owner: { inApp: false, email: false },
        owner2: { inApp: false, email: false },
        deptHead: { inApp: false, email: false }
      },
      submitted: {
        admin: { inApp: true, email: false },
        owner: { inApp: true, email: false },
        owner2: { inApp: true, email: true },
        deptHead: { inApp: false, email: false }
      },
      reminder: {
        admin: { inApp: false, email: false },
        owner: { inApp: true, email: true },
        owner2: { inApp: true, email: true },
        deptHead: { inApp: true, email: true }
      }
    };

    const rule = rules[eventType];

    const uniqRoles = (roles: Array<NotificationRecipient['role']> | undefined): Array<NotificationRecipient['role']> => {
      if (!roles) return [];
      const seen = new Set<string>();
      const out: Array<NotificationRecipient['role']> = [];
      for (const r of roles) {
        const key = String(r);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(r);
      }
      return out;
    };

    const pickRole = (
      existingRole: NotificationRecipient['role'],
      incomingRole: NotificationRecipient['role']
    ): NotificationRecipient['role'] => {
      const priority: Record<NotificationRecipient['role'], number> = {
        dept_head: 4,
        owner: 3,
        owner2: 2,
        admin: 1
      };
      return priority[incomingRole] > priority[existingRole] ? incomingRole : existingRole;
    };

    const upsertRecipient = (incoming: NotificationRecipient) => {
      const incomingUserId = String(incoming.userId || '').trim();
      const incomingEmail = String(incoming.email || '').trim();
      const incomingEmailNorm = incomingEmail.toLowerCase();

      const incomingInAppRoles = uniqRoles([
        ...(incoming.sendInAppRoles || []),
        ...(incoming.sendInApp ? [incoming.role] : [])
      ]);
      const incomingEmailRoles = uniqRoles([
        ...(incoming.sendEmailRoles || []),
        ...(incoming.sendEmail ? [incoming.role] : [])
      ]);

      const existingIndex = recipients.findIndex(r => {
        const rUserId = String(r.userId || '').trim();
        const rEmailNorm = String(r.email || '').trim().toLowerCase();

        if (incomingUserId && rUserId) return rUserId === incomingUserId;
        if (incomingEmailNorm && rEmailNorm) return rEmailNorm === incomingEmailNorm;
        return false;
      });

      if (existingIndex === -1) {
        recipients.push({
          ...incoming,
          sendInAppRoles: incomingInAppRoles,
          sendEmailRoles: incomingEmailRoles,
        });
        return;
      }

      const existing = recipients[existingIndex];

      const existingInAppRoles = uniqRoles([
        ...(existing.sendInAppRoles || []),
        ...(existing.sendInApp ? [existing.role] : [])
      ]);
      const existingEmailRoles = uniqRoles([
        ...(existing.sendEmailRoles || []),
        ...(existing.sendEmail ? [existing.role] : [])
      ]);

      recipients[existingIndex] = {
        ...existing,
        // Preserve existing role/name, but merge delivery capabilities
        role: pickRole(existing.role, incoming.role),
        sendInApp: Boolean(existing.sendInApp || incoming.sendInApp),
        sendEmail: Boolean(existing.sendEmail || incoming.sendEmail),
        sendInAppRoles: uniqRoles([...existingInAppRoles, ...incomingInAppRoles]),
        sendEmailRoles: uniqRoles([...existingEmailRoles, ...incomingEmailRoles]),
        // Prefer a non-empty email/userId if one is missing
        userId: existing.userId || incoming.userId,
        email: (existing.email && String(existing.email).trim()) ? existing.email : incoming.email,
        name: (existing.name && String(existing.name).trim()) ? existing.name : incoming.name,
      };
    };

    // Add admins
    const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');
    console.log(`  Found ${admins.length} admins`);
    for (const admin of admins) {
      if (rule.admin.inApp || rule.admin.email) {
        upsertRecipient({
          userId: String(admin._id),
          email: admin.email,
          name: admin.fullName || admin.name || admin.email,
          role: 'admin',
          sendInApp: rule.admin.inApp,
          sendEmail: rule.admin.email
        });
      }
    }

    // Helper function to add owner
    const addOwner = (ownerValue: string, ownerEmailValue: string | undefined, ownerRole: 'owner' | 'owner2') => {
      if (!ownerValue) return;

      const ownerValueNorm = String(ownerValue).trim().toLowerCase();
      const employee = allEmployees.find(e => {
        const employeeName = String(e.name || '').trim().toLowerCase();
        const employeeEmail = String(e.email || '').trim().toLowerCase();
        return employeeName === ownerValueNorm || employeeEmail === ownerValueNorm;
      });

      const resolvedOwnerEmail =
        (employee?.email && String(employee.email).trim()) ||
        (ownerEmailValue && String(ownerEmailValue).trim()) ||
        (typeof ownerValue === 'string' ? ownerValue.trim() : '');
      
      let owner;
      if (employee) {
        owner = allUsers.find(u => 
          u.email === employee.email || 
          u.fullName === employee.name ||
          u.name === employee.name
        );
        console.log(`  Found matching employee record for ${ownerRole}`);
      }
      
      if (!owner) {
        owner = allUsers.find(u => 
          u.fullName === ownerValue || 
          u.name === ownerValue ||
          u.email === ownerEmailValue
        );
      }
      
      const ownerRuleSettings = ownerRole === 'owner' ? rule.owner : rule.owner2;
      
      if (owner && (ownerRuleSettings.inApp || ownerRuleSettings.email)) {
        console.log(`  Found ${ownerRole} user record`);

        const explicitOwnerEmail = ownerEmailValue ? String(ownerEmailValue).trim() : '';
        const loginOwnerEmail = owner.email ? String(owner.email).trim() : '';
        const deliveryEmail = isEmail(explicitOwnerEmail)
          ? explicitOwnerEmail
          : (isEmail(loginOwnerEmail) ? loginOwnerEmail : '');
        
        upsertRecipient({
          userId: String(owner._id),
          email: deliveryEmail || loginOwnerEmail,
          name: owner.fullName || owner.name || owner.email,
          role: ownerRole,
          sendInApp: ownerRuleSettings.inApp,
          sendEmail: ownerRuleSettings.email && !!deliveryEmail
        });
      } else {
        console.log(`  ⚠️ Owner user not found in login for ${ownerRole}`);

        const fallbackEmail = isEmail(resolvedOwnerEmail) ? resolvedOwnerEmail : '';

        if (fallbackEmail && (ownerRuleSettings.email || ownerRuleSettings.inApp)) {
          console.log(`  → Using resolved ${ownerRole} email for delivery`);
          upsertRecipient({
            userId: '',
            email: fallbackEmail,
            name: ownerValue || fallbackEmail,
            role: ownerRole,
            sendInApp: ownerRuleSettings.inApp,
            sendEmail: ownerRuleSettings.email,
          });
        }
      }
    };

    // Add primary compliance owner
    addOwner(compliance.owner || '', compliance.ownerEmail, 'owner');
    
    // Add secondary compliance owner (owner2)
    addOwner(compliance.owner2 || '', compliance.owner2Email, 'owner2');

    // Add department heads
    if (rule.deptHead.inApp || rule.deptHead.email) {
      console.log(`  Looking for department heads in ${complianceDepts.length} department(s)`);
      
      for (const dept of deptHeads) {
        const deptEmail = String((dept.email || (dept.departmentEmail as any) || '')).trim();
        const deptHeadValue = String(dept.departmentHead || '').trim();
        const deptHeadIsEmail = isEmail(deptHeadValue);
        const lookupEmail = (deptEmail || (deptHeadIsEmail ? deptHeadValue : '')).toLowerCase();

        if (lookupEmail && (rule.deptHead.email || rule.deptHead.inApp)) {
          console.log(`  Using configured department head email for department`);

          const deptHeadUser = allUsers.find(u => String(u.email || '').trim().toLowerCase() === lookupEmail);
          
          if (deptHeadUser) {
            console.log(`  Found dept head user record`);
            const deliveryEmail = String(deptHeadUser.email || '').trim() || deptEmail || (deptHeadIsEmail ? deptHeadValue : '');
            upsertRecipient({
              userId: String(deptHeadUser._id),
              email: deliveryEmail,
              name: deptHeadUser.fullName || deptHeadUser.name || deptHeadUser.email,
              role: 'dept_head',
              sendInApp: rule.deptHead.inApp,
              sendEmail: rule.deptHead.email && isEmail(deliveryEmail)
            });
          } else {
            const deliveryEmail = deptEmail || (deptHeadIsEmail ? deptHeadValue : '');
            console.log(`  ⚠️ Dept head email not found in users. Creating email-only recipient.`);
            upsertRecipient({
              userId: '',
              email: deliveryEmail,
              name: deptHeadValue || dept.name,
              role: 'dept_head',
              sendInApp: rule.deptHead.inApp,
              sendEmail: rule.deptHead.email && isEmail(deliveryEmail)
            });
          }
        } else {
          const deptHead = allUsers.find(u => {
            const fullName = String(u.fullName || '').trim();
            const name = String(u.name || '').trim();
            const email = String(u.email || '').trim();
            return (
              (deptHeadValue && (fullName === deptHeadValue || name === deptHeadValue)) ||
              (deptHeadIsEmail && email.toLowerCase() === deptHeadValue.toLowerCase())
            );
          });
          if (deptHead) {
            console.log(`  Found dept head user record by name/email match`);
            const deliveryEmail = String(deptHead.email || '').trim() || deptEmail || (deptHeadIsEmail ? deptHeadValue : '');
            upsertRecipient({
              userId: String(deptHead._id),
              email: deliveryEmail,
              name: deptHead.fullName || deptHead.name || deptHead.email,
              role: 'dept_head',
              sendInApp: rule.deptHead.inApp,
              sendEmail: rule.deptHead.email && isEmail(deliveryEmail)
            });
          } else {
            console.log(`  ⚠️ Department head not found in users`);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error getting compliance notification recipients:', error);
  }

  return recipients;
}

/**
 * Create in-app notification for compliance
 */
async function createInAppNotification(
  userId: string | null | undefined,
  userEmail: string | null | undefined,
  compliance: ComplianceData,
  eventType: 'created' | 'owner_changed' | 'other_fields' | 'submitted' | 'reminder',
  additionalData?: any
) {
  try {
    const db = await connectToDatabase();

    const normalizedUserId = userId ? String(userId).trim() : '';
    const normalizedEmail = userEmail ? String(userEmail).trim().toLowerCase() : '';
    if (!normalizedUserId && !normalizedEmail) {
      console.log('Skipping in-app notification: missing userId and userEmail');
      return;
    }

    const filingName = compliance.filingName || compliance.policy || compliance.complianceName || compliance.name || 'Compliance Filing';
    const complianceDepartments = getComplianceDepartmentsForNotification(compliance);

    const baseNotificationData: any = {
      ...(normalizedUserId ? { userId: normalizedUserId } : {}),
      ...(normalizedEmail ? { userEmail: normalizedEmail } : {}),
      tenantId: compliance.tenantId,
      type: 'compliance',
      complianceId: String(compliance.id || compliance._id),
      complianceName: filingName,
      filingName: filingName,
      category: compliance.complianceCategory || compliance.category || 'General',
      complianceCategory: compliance.complianceCategory || compliance.category || 'General',
      departments: complianceDepartments,
      createdAt: new Date(),
      timestamp: new Date(),
      ...additionalData
    };

    const notificationData: any = { ...baseNotificationData };

    if (eventType === 'reminder') {
      // For reminders, we omit eventType so the UI treats it as reminder-based
      // and uses reminderTriggerDate/reminderType for display.
    } else {
      notificationData.eventType = eventType === 'created' ? 'created' : 'updated';
      notificationData.lifecycleEventType = eventType;
    }

    const result = await db.collection("notifications").insertOne(notificationData);
    console.log(`✅ Created in-app compliance notification (ID: ${result.insertedId})`);

  } catch (error) {
    console.error('Error creating in-app compliance notification:', error);
  }
}

/**
 * Send email notification for compliance
 */
async function sendEmailNotification(
  recipient: NotificationRecipient,
  compliance: ComplianceData,
  eventType: 'created' | 'owner_changed' | 'other_fields' | 'submitted' | 'reminder',
  additionalData?: any
) {
  try {
    let subject = '';
    let body = '';

    const filingName = compliance.filingName || compliance.policy || compliance.complianceName || compliance.name || 'Compliance Filing';
    const recipientName = recipient.name;
    const recipientRole = recipient.role;

    const departments = getComplianceDepartmentsForNotification(compliance);
    const departmentsLabel = departments.length ? departments.join(', ') : 'N/A';

    const roleIntro =
      recipientRole === 'owner'
        ? `<p>You are receiving this notification because you are the <strong>Compliance Owner</strong>.</p>`
        : recipientRole === 'owner2'
          ? `<p>You are receiving this notification because you are the <strong>Secondary Compliance Owner</strong>.</p>`
          : `<p>You are receiving this notification because you are an <strong>Admin</strong>.</p>`;

    const formatDate = (dateStr: any) => {
      if (!dateStr) return 'N/A';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch {
        return String(dateStr);
      }
    };

    switch (eventType) {
      case 'created':
        subject = `${recipientRole === 'admin' ? 'Admin: ' : ''}New Compliance Filing Created: ${filingName}`;
        body = `
          <h2>New Compliance Filing Created</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>A new compliance filing has been created.</p>
          <ul>
            <li><strong>Filing Name:</strong> ${filingName}</li>
            <li><strong>Category:</strong> ${compliance.complianceCategory || compliance.category || 'N/A'}</li>
            <li><strong>Authority:</strong> ${compliance.governingAuthority || 'N/A'}</li>
            <li><strong>Submission Deadline:</strong> ${formatDate(compliance.submissionDeadline)}</li>
            <li><strong>Status:</strong> ${compliance.status || 'N/A'}</li>
            <li><strong>Departments:</strong> ${departmentsLabel}</li>
          </ul>
        `;
        break;

      case 'owner_changed':
        subject = `Compliance Owner Changed: ${filingName}`;
        body = `
          <h2>Compliance Owner Changed</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>You have been assigned as the <strong>new owner</strong> of this compliance filing.</p>
          <ul>
            <li><strong>Filing Name:</strong> ${filingName}</li>
            <li><strong>Category:</strong> ${compliance.complianceCategory || compliance.category || 'N/A'}</li>
            <li><strong>Previous Owner:</strong> ${additionalData?.oldOwner || 'N/A'}</li>
            <li><strong>Submission Deadline:</strong> ${formatDate(compliance.submissionDeadline)}</li>
          </ul>
        `;
        break;

      case 'submitted':
        subject = `Compliance Filing Submitted: ${filingName}`;
        body = `
          <h2>Compliance Filing Submitted</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>The compliance filing has been marked as <strong>submitted</strong>.</p>
          <ul>
            <li><strong>Filing Name:</strong> ${filingName}</li>
            <li><strong>Category:</strong> ${compliance.complianceCategory || compliance.category || 'N/A'}</li>
            <li><strong>Submission Date:</strong> ${formatDate(compliance.submissionDate || new Date())}</li>
            <li><strong>Status:</strong> ${compliance.status || 'Submitted'}</li>
          </ul>
        `;
        break;
      case 'reminder': {
        const reminderType = additionalData?.reminderType ? String(additionalData.reminderType) : 'Reminder';
        const triggerDate = additionalData?.reminderTriggerDate || additionalData?.reminderDate;
        const deadline = additionalData?.submissionDeadline || compliance.submissionDeadline;

        subject = `Compliance Deadline Reminder: ${filingName}`;
        body = `
          <h2>Compliance Deadline Reminder</h2>
          <p>Hello ${recipientName},</p>
          ${roleIntro}
          <p>This is a reminder regarding an upcoming compliance submission deadline.</p>
          <ul>
            <li><strong>Filing:</strong> ${filingName}</li>
            <li><strong>Category:</strong> ${compliance.complianceCategory || compliance.category || 'General'}</li>
            <li><strong>Reminder:</strong> ${reminderType}</li>
            <li><strong>Reminder Date:</strong> ${formatDate(triggerDate)}</li>
            <li><strong>Submission Deadline:</strong> ${formatDate(deadline)}</li>
          </ul>
          <p>Please review and submit your filing on time.</p>
        `;
        break;
      }

      default:
        return; // No email for other_fields
    }

    // Wrap body in a proper email template
    const fullEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f4f7fb; 
            line-height: 1.6;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 32px;
          }
          h2 { color: #1a1a1a; margin-bottom: 20px; }
          p { margin: 12px 0; color: #4a4a4a; }
          ul { margin: 20px 0; padding-left: 20px; }
          li { margin: 8px 0; color: #4a4a4a; }
          strong { color: #1a1a1a; }
        </style>
      </head>
      <body>
        <div class="container">
          ${body}
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #888;">
            This is an automated notification from your Compliance Tracking System.
          </p>
        </div>
      </body>
      </html>
    `;

    console.log(`📧 Attempting to send compliance email (${eventType}) to ${maskEmailForLog(recipient.email)}...`);
    
    const sent = await emailService.sendEmail({
      to: recipient.email,
      subject,
      html: fullEmailHtml
    });

    if (sent) {
      console.log(`✅ Compliance email (${eventType}) sent to ${maskEmailForLog(recipient.email)}`);
    } else {
      console.error(
        `❌ Compliance email (${eventType}) FAILED to send to ${maskEmailForLog(recipient.email)} (email service not configured or send failed)`
      );
    }
  } catch (error) {
    console.error('Error sending compliance email notification:', error);
  }
}

/**
 * Main function to send compliance notifications
 */
export async function sendComplianceNotifications(
  eventType: 'create' | 'ownerChange' | 'otherFields' | 'submitted' | 'reminder',
  newCompliance: ComplianceData,
  oldCompliance: ComplianceData | null,
  tenantId: string,
  db: any,
  extraData?: any
) {
  try {
    const filingName = newCompliance.filingName || newCompliance.policy || newCompliance.complianceName || newCompliance.name || 'Compliance Filing';
    console.log(`🔔 Sending compliance ${eventType} notifications`);

    // Map event types to internal format
    const eventTypeMap: Record<string, 'created' | 'owner_changed' | 'other_fields' | 'submitted' | 'reminder'> = {
      'create': 'created',
      'ownerChange': 'owner_changed',
      'otherFields': 'other_fields',
      'submitted': 'submitted',
      'reminder': 'reminder'
    };

    const internalEventType = eventTypeMap[eventType];

    // Prepare additional data
    const additionalData: any = { ...(extraData || {}) };
    if (oldCompliance) {
      additionalData.oldOwner = oldCompliance.owner;
      additionalData.oldStatus = oldCompliance.status;
    }

    // Ensure tenantId is set
    if (!newCompliance.tenantId) {
      newCompliance.tenantId = tenantId;
    }

    // Get recipients based on event type
    const recipients = await getNotificationRecipients(
      newCompliance,
      internalEventType,
      additionalData?.oldOwner
    );

    console.log(`📧 Found ${recipients.length} recipients for compliance ${eventType} event`);

    const complianceDepartments = getComplianceDepartmentsForNotification(newCompliance);

    // Send notifications to each recipient
    for (const recipient of recipients) {
      console.log(`  → Recipient role=${recipient.role}: InApp=${recipient.sendInApp}, Email=${recipient.sendEmail}`);

      const perRecipientAdditionalData: any = {
        ...additionalData,
        recipientRole: recipient.role,
        recipientDepartments: complianceDepartments
      };
      
      // Create in-app notification
      if (recipient.sendInApp && (recipient.userId || recipient.email)) {
        console.log(`    Creating in-app notification...`);
        await createInAppNotification(recipient.userId, recipient.email, newCompliance, internalEventType, perRecipientAdditionalData);
      }

      // Send email notification
      if (recipient.sendEmail && recipient.email) {
        const rolesToEmail = Array.isArray((recipient as any).sendEmailRoles) && (recipient as any).sendEmailRoles.length
          ? (recipient as any).sendEmailRoles
          : [recipient.role];

        for (const emailRole of rolesToEmail) {
          console.log(`    Sending ${emailRole} email notification to ${maskEmailForLog(recipient.email)}...`);
          await sendEmailNotification(
            { ...recipient, role: emailRole },
            newCompliance,
            internalEventType,
            { ...perRecipientAdditionalData, recipientRole: emailRole }
          );
        }
      } else if (recipient.sendEmail && !recipient.email) {
        console.error(`    ⚠️ Cannot send email: missing email address`);
      }
    }

    console.log(`✅ Successfully sent compliance ${eventType} notifications`);

  } catch (error) {
    console.error('❌ Error in sendComplianceNotifications:', error);
    throw error;
  }
}

/**
 * Helper function to detect what changed in a compliance update
 */
export function detectComplianceChanges(
  oldCompliance: Partial<ComplianceData> | null | undefined,
  newCompliance: Partial<ComplianceData> | null | undefined
): {
  ownerChanged: boolean;
  statusChanged: boolean;
  submitted: boolean;
  oldOwner?: string;
  oldStatus?: string;
} {
  const oldComp = oldCompliance ?? {};
  const newComp = newCompliance ?? {};

  const normalizeString = (value: any) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const oldOwner = normalizeString(oldComp.owner);
  const newOwner = normalizeString(newComp.owner);
  const oldStatus = normalizeString(oldComp.status);
  const newStatus = normalizeString(newComp.status);

  const ownerChanged = oldOwner !== newOwner && oldOwner !== '';
  const statusChanged = oldStatus !== newStatus && oldStatus !== '';
  const submitted = newStatus.toLowerCase() === 'submitted' && oldStatus.toLowerCase() !== 'submitted';

  return {
    ownerChanged,
    statusChanged,
    submitted,
    oldOwner: oldOwner || undefined,
    oldStatus: oldStatus || undefined
  };
}
