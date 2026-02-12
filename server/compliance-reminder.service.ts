import { ObjectId } from 'mongodb';
import { connectToDatabase } from './mongo.js';
import { sendComplianceNotifications } from './compliance-notification.service.js';

type ReminderDoc = {
  _id: any;
  tenantId?: string;
  complianceId?: string;
  reminderType?: string;
  reminderDate?: string;
  reminderTriggerDate?: string;
  reminderDays?: number | string;
  reminderPolicy?: string;
  submissionDeadline?: string;
  sent?: boolean;
};

export async function runComplianceReminderCheck(specificTenantId?: string): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const db = await connectToDatabase();

  // IMPORTANT: reminderTriggerDate is stored as YYYY-MM-DD.
  // This job is scheduled at 12:00 AM IST, so we must compute "today" in IST,
  // otherwise UTC date can lag and send a day early.
  const IST_OFFSET_MINUTES = 330;
  const istNow = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
  const todayIso = istNow.toISOString().slice(0, 10);

  const staleLockBefore = new Date(Date.now() - 15 * 60 * 1000);

  const query: any = {
    $and: [
      { $or: [{ eventType: { $exists: false } }, { eventType: null }] },
      { sent: false },
      { reminderTriggerDate: { $lte: todayIso } },
      {
        $or: [
          { processingAt: { $exists: false } },
          { processingAt: null },
          { processingAt: { $lte: staleLockBefore } },
        ],
      },
    ],
  };

  if (specificTenantId) {
    query.tenantId = specificTenantId;
  }

  const dueReminders: ReminderDoc[] = await db
    .collection('compliance_notifications')
    .find(query)
    .sort({ reminderTriggerDate: 1, createdAt: 1 })
    .toArray();

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const reminder of dueReminders) {
    // Claim reminder (prevents duplicates across multiple instances)
    try {
      const claim = await db.collection('compliance_notifications').updateOne(
        {
          _id: reminder._id,
          sent: false,
          $or: [
            { processingAt: { $exists: false } },
            { processingAt: null },
            { processingAt: { $lte: staleLockBefore } },
          ],
        },
        {
          $set: { processingAt: new Date(), lastAttemptAt: new Date() },
          $inc: { attemptCount: 1 },
        }
      );

      if (!claim.matchedCount) {
        // Another instance claimed/sent it
        continue;
      }
    } catch {}

    processed++;

    const tenantId = String(reminder.tenantId || '').trim();
    const complianceId = String(reminder.complianceId || '').trim();

    if (!tenantId || !complianceId) {
      skipped++;
      try {
        await db.collection('compliance_notifications').updateOne(
          { _id: reminder._id },
          {
            $set: {
              sent: true,
              sentAt: new Date(),
              sentError: 'Missing tenantId or complianceId on reminder document',
            },
            $unset: { processingAt: "" },
          }
        );
      } catch {}
      continue;
    }

    let compliance: any = null;
    try {
      compliance = await db.collection('compliance').findOne({
        _id: new ObjectId(complianceId),
        tenantId,
      });
    } catch (err) {
      // If complianceId isn't a valid ObjectId or lookup fails
      console.error('[COMPLIANCE REMINDER] Compliance lookup failed:', err);
    }

    if (!compliance) {
      skipped++;
      try {
        await db.collection('compliance_notifications').updateOne(
          { _id: reminder._id },
          {
            $set: {
              sent: true,
              sentAt: new Date(),
              sentError: 'Compliance item not found for reminder',
            },
            $unset: { processingAt: "" },
          }
        );
      } catch {}
      continue;
    }

    const extraData = {
      reminderType: reminder.reminderType,
      reminderDate: reminder.reminderDate,
      reminderTriggerDate: reminder.reminderTriggerDate,
      reminderDays: reminder.reminderDays ?? compliance.reminderDays,
      reminderPolicy: reminder.reminderPolicy ?? compliance.reminderPolicy,
      submissionDeadline: reminder.submissionDeadline ?? compliance.submissionDeadline,
      message: `Your ${
        compliance.policy || compliance.filingName || compliance.complianceName || compliance.name || 'compliance filing'
      } submission deadline is approaching. Please review and submit on time.`,
    };

    try {
      await sendComplianceNotifications(
        'reminder',
        { ...compliance, id: String(compliance._id), tenantId },
        null,
        tenantId,
        db,
        extraData
      );

      await db.collection('compliance_notifications').updateOne(
        { _id: reminder._id },
        { $set: { sent: true, sentAt: new Date() }, $unset: { lastError: "", processingAt: "" } }
      );

      sent++;
    } catch (err) {
      errors++;
      console.error('[COMPLIANCE REMINDER] Failed to send reminder:', err);
      try {
        await db.collection('compliance_notifications').updateOne(
          { _id: reminder._id },
          {
            $set: {
              lastError: String((err as any)?.message || err),
            },
            $unset: { processingAt: "" },
          }
        );
      } catch {}
    }
  }

  return { processed, sent, skipped, errors };
}
