import { Db, ObjectId } from "mongodb";
import { connectToDatabase } from "./mongo.js";
import type { IStorage } from "./storage";
// @ts-ignore
import type { User, InsertUser, Subscription, InsertSubscription, Reminder, InsertReminder, DashboardMetrics, SpendingTrend, CategoryBreakdown, RecentActivity, NotificationItem } from "../../shared/schema.js";

// Helper to get tenantId from context (pass as argument from API)
function getTenantFilter(tenantId: string) {
  return { tenantId };
}

export class MongoStorage implements IStorage {
  private db: Db | null = null;

  private async getDb() {
    if (!this.db) {
      this.db = await connectToDatabase();
    }
    return this.db;
  }

  // Users
  async getUsers(tenantId: string): Promise<User[]> {
    const db = await this.getDb();
    const users = await db.collection("users").find(getTenantFilter(tenantId)).toArray();
    // Map MongoDB _id to id (number) and ensure all required User fields
      return users.map(u => ({
    id: u._id?.toString() || "",
        tenantId: u.tenantId || tenantId,
        status: typeof u.status === 'string' ? u.status : "active",
        name: u.name || "",
        email: u.email || "",
        role: u.role || "viewer",
  lastLogin: u.lastLogin ? new Date(u.lastLogin) : null
      }));
  }

  async getUser(id: string, tenantId: string): Promise<User | undefined> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { ...getTenantFilter(tenantId) };
    try {
      filter._id = new ObjectId(id);
    } catch {
      filter.id = id;
    }
    const user = await db.collection("users").findOne(filter);
    if (!user) return undefined;
        return {
            id: user._id?.toString() || "",
          tenantId: user.tenantId || tenantId,
          status: typeof user.status === 'string' ? user.status : "active",
          name: user.name || "",
          email: user.email || "",
          role: user.role || "viewer",
          lastLogin: user && "lastLogin" in user && user.lastLogin ? new Date((user as any).lastLogin) : null
        };
  }

  async getUserByEmail(email: string, tenantId: string): Promise<User | undefined> {
    const db = await this.getDb();
    const user = await db.collection("users").findOne({ email, tenantId });
    if (!user) return undefined;
        return {
            id: user._id?.toString() || "",
          tenantId: user.tenantId || tenantId,
          status: typeof user.status === 'string' ? user.status : "active",
          name: user.name || "",
          email: user.email || "",
          role: user.role || "viewer",
          lastLogin: user && "lastLogin" in user && user.lastLogin ? new Date((user as any).lastLogin) : null
        };
  }

  async createUser(user: InsertUser, tenantId: string): Promise<User> {
    const db = await this.getDb();
    // Always generate a new ObjectId for MongoDB _id
    const { ObjectId } = await import("mongodb");
    const doc = { ...user, tenantId, _id: new ObjectId() };
    await db.collection("users").insertOne(doc);
    // Return user with both id and _id for frontend compatibility
        return {
          id: typeof doc._id === 'object' && doc._id ? doc._id.toString() : (typeof doc._id === 'string' ? doc._id : ''),
          tenantId: doc.tenantId || tenantId,
          status: typeof doc.status === 'string' ? doc.status : "active",
          name: doc.name || "",
          email: doc.email || "",
          role: doc.role || "viewer",
          lastLogin: doc && "lastLogin" in doc && doc.lastLogin ? new Date((doc as any).lastLogin) : null
        };
  }

  async updateUser(id: string, user: Partial<InsertUser>, tenantId: string): Promise<User | undefined> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { ...getTenantFilter(tenantId) };
    try {
      filter._id = new ObjectId(id);
    } catch {
      filter.id = id;
    }
    const result = await db.collection("users").findOneAndUpdate(
      filter,
      { $set: user },
      { returnDocument: "after" }
    );
    if (!result || !result.value) return undefined;
    const u = result.value;
        return {
    id: u._id?.toString() || "",
          tenantId: u.tenantId || tenantId,
          status: typeof u.status === 'string' ? u.status : "active",
          name: u.name || "",
          email: u.email || "",
          role: u.role || "viewer",
          lastLogin: u && "lastLogin" in u && u.lastLogin ? new Date((u as any).lastLogin) : null
        };
  }

  async deleteUser(id: string, tenantId: string): Promise<boolean> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { ...getTenantFilter(tenantId) };
    try {
      filter._id = new ObjectId(id);
    } catch {
      filter.id = id;
    }
    const result = await db.collection("users").deleteOne(filter);
    return result.deletedCount === 1;
  }

  // Subscriptions
  async getSubscriptions(tenantId: string): Promise<Subscription[]> {
    const db = await this.getDb();
    const subs = await db.collection("subscriptions").find(getTenantFilter(tenantId)).toArray();
    // Map MongoDB _id to id (number) and ensure all required Subscription fields
      return subs.map(s => ({
        id: s._id?.toString() || '',
        tenantId: s.tenantId || tenantId,
        serviceName: s.serviceName || "",
        vendor: s.vendor || "",
        amount: s.amount?.toString() ?? "0",
        billingCycle: s.billingCycle && s.billingCycle !== "" ? s.billingCycle : "monthly",
        commitmentCycle: s.commitmentCycle || null,
        paymentFrequency: s.paymentFrequency || null,
        category: s.category && s.category !== "" ? s.category : "Software",
        departments: s.departments || [],
        startDate: s.startDate ? new Date(s.startDate) : new Date(),
        nextRenewal: s.nextRenewal ? new Date(s.nextRenewal) : new Date(),
        status: s.status && s.status !== "" ? s.status : "Active",
        reminderDays: s.reminderDays || 7,
        reminderPolicy: s.reminderPolicy && s.reminderPolicy !== "" ? s.reminderPolicy : "One time",
        notes: s.notes || null,
        isActive: typeof s.isActive === 'boolean' ? s.isActive : true,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        updatedBy: s.updatedBy || null,
        owner: s.owner || null,  // Add the owner field
        ownerEmail: s.ownerEmail || null
      } as any));
  }

  async getSubscription(id: string, tenantId: string): Promise<Subscription | undefined> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [ { _id: new ObjectId(id), tenantId }, { id, tenantId } ] };
    const subscription = await db.collection("subscriptions").findOne(filter);
    if (!subscription) return undefined;
      return {
        id: subscription._id?.toString() || '',
        tenantId: subscription.tenantId || tenantId,
        serviceName: subscription.serviceName || "",
        vendor: subscription.vendor || "",
        amount: subscription.amount?.toString() ?? "0",
        billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "monthly",
        commitmentCycle: subscription.commitmentCycle || null,
        paymentFrequency: subscription.paymentFrequency || null,
        category: subscription.category && subscription.category !== "" ? subscription.category : "Software",
        departments: subscription.departments || [],
        startDate: subscription.startDate ? new Date(subscription.startDate) : new Date(),
        nextRenewal: subscription.nextRenewal ? new Date(subscription.nextRenewal) : new Date(),
        status: subscription.status && subscription.status !== "" ? subscription.status : "Active",
        reminderDays: subscription.reminderDays || 7,
        reminderPolicy: subscription.reminderPolicy && subscription.reminderPolicy !== "" ? subscription.reminderPolicy : "One time",
        notes: subscription.notes || null,
        isActive: typeof subscription.isActive === 'boolean' ? subscription.isActive : true,
        createdAt: subscription.createdAt ? new Date(subscription.createdAt) : new Date(),
        updatedBy: subscription.updatedBy || null,
        owner: subscription.owner || null,  // Add the owner field
        ownerEmail: subscription.ownerEmail || null
      } as any;
  }

  async createSubscription(subscription: InsertSubscription, tenantId: string): Promise<Subscription> {
    console.log(`🚀 CREATESUBSCRIPTION CALLED - Enhanced logging version active!`);
    console.log(`🚀 Creating subscription: ${subscription.serviceName} for tenant: ${tenantId}`);
    
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    // Don't destructure updatedAt, just spread subscription
    const doc = { ...subscription, tenantId, _id: new ObjectId(), createdAt: new Date(), updatedAt: new Date(), updatedBy: null };
    await db.collection("subscriptions").insertOne(doc);
    // Generate reminders for this subscription
    await this.generateAndInsertRemindersForSubscription(doc, tenantId);
    
    // Create notification event for subscription creation
    try {
      console.log(`🔄 About to create notification event for subscription: ${doc.serviceName}`);
      await this.createNotificationEvent(
        tenantId,
        'created',
        doc._id.toString(),
        doc.serviceName,
        doc.category
      );
      console.log(`✅ Notification event creation completed for subscription: ${doc.serviceName}`);
    } catch (notificationError) {
      console.error(`❌ Failed to create notification event for ${doc.serviceName}:`, notificationError);
      // Don't throw - let subscription creation succeed even if notification fails
    }
      return {
        id: doc._id?.toString() || '',
        tenantId: doc.tenantId || tenantId,
        serviceName: doc.serviceName || "",
        vendor: doc.vendor || "",
        amount: doc.amount?.toString() ?? "0",
        billingCycle: doc.billingCycle || "monthly",
        category: doc.category || "Software",
        startDate: doc.startDate ? new Date(doc.startDate) : new Date(),
        nextRenewal: doc.nextRenewal ? new Date(doc.nextRenewal) : new Date(),
        status: doc.status || "Active",
        reminderDays: doc.reminderDays || 7,
        reminderPolicy: doc.reminderPolicy || "One time",
        notes: doc.notes || null,
        isActive: typeof doc.isActive === 'boolean' ? doc.isActive : true,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedBy: doc.updatedBy || null,
        owner: doc.owner || null,
        ownerEmail: doc.ownerEmail || null
      };
  }

  async updateSubscription(id: string, subscription: Partial<InsertSubscription>, tenantId: string): Promise<Subscription | undefined> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [ { _id: new ObjectId(id), tenantId }, { id, tenantId } ] };
    // Don't destructure updatedAt, just spread subscription
    const result = await db.collection("subscriptions").findOneAndUpdate(
      filter,
      { $set: subscription },
      { returnDocument: "after" }
    );
    if (!result || !result.value) return undefined;
    const subscriptionId = result.value._id?.toString();
    if (subscriptionId) {
      await db.collection("reminders").deleteMany({ subscriptionId });
    }
    await this.generateAndInsertRemindersForSubscription(result.value, tenantId);
    const doc = result.value;
        return {
          id: doc._id?.toString() || '',
          tenantId: doc.tenantId || tenantId,
          serviceName: doc.serviceName || "",
          vendor: doc.vendor || "",
          amount: doc.amount?.toString() ?? "0",
          billingCycle: doc.billingCycle || "monthly",
          category: doc.category || "Software",
          startDate: doc.startDate ? new Date(doc.startDate) : new Date(),
          nextRenewal: doc.nextRenewal ? new Date(doc.nextRenewal) : new Date(),
          status: doc.status || "Active",
          reminderDays: doc.reminderDays || 7,
          reminderPolicy: doc.reminderPolicy || "One time",
          notes: doc.notes || null,
          isActive: typeof doc.isActive === 'boolean' ? doc.isActive : true,
          createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
          updatedBy: doc.updatedBy || null,
          owner: doc.owner || null,
          ownerEmail: doc.ownerEmail || null
        };
  }

  /**
   * Generate and insert reminders for a subscription (on create or update)
   */
  private async generateAndInsertRemindersForSubscription(subscription: any, tenantId?: string) {
    const db = await this.getDb();
    // Always use _id string for subscriptionId
    const subscriptionId = subscription._id ? subscription._id.toString() : (typeof subscription.id === 'string' ? subscription.id : undefined);
    if (!subscriptionId) return;
    // Remove all old reminders for this subscription
    await db.collection("reminders").deleteMany({ subscriptionId });
    // Only generate if subscription has a nextRenewal or endDate
    const renewalDate = subscription.nextRenewal || subscription.endDate;
    if (!renewalDate) return;
    const frequency = subscription.frequency || "Monthly";
    // Use reminderDays from subscription, default to 7 if not set
    const reminderDays = Number(subscription.reminderDays) || 7;
    const reminderPolicy = subscription.reminderPolicy || "One time";
    let remindersToInsert = [];
    if (reminderPolicy === "One time") {
      const reminderDate = new Date(renewalDate);
      reminderDate.setDate(reminderDate.getDate() - reminderDays);
      remindersToInsert.push({
        type: `Before ${reminderDays} days`,
        date: reminderDate.toISOString().slice(0, 10),
      });
    } else if (reminderPolicy === "Two times") {
      const firstDate = new Date(renewalDate);
      firstDate.setDate(firstDate.getDate() - reminderDays);
      const secondDays = Math.floor(reminderDays / 2);
      const secondDate = new Date(renewalDate);
      secondDate.setDate(secondDate.getDate() - secondDays);
      remindersToInsert.push({
        type: `Before ${reminderDays} days`,
        date: firstDate.toISOString().slice(0, 10),
      });
      if (secondDays > 0 && secondDays !== reminderDays) {
        remindersToInsert.push({
          type: `Before ${secondDays} days`,
          date: secondDate.toISOString().slice(0, 10),
        });
      }
    } else if (reminderPolicy === "Until Renewal") {
      // Daily reminders from (renewalDate - reminderDays) to renewalDate
      const startDate = new Date(renewalDate);
      startDate.setDate(startDate.getDate() - reminderDays);
      let current = new Date(startDate);
      const end = new Date(renewalDate);
      while (current <= end) {
        remindersToInsert.push({
          type: `Daily`,
          date: current.toISOString().slice(0, 10),
        });
        current.setDate(current.getDate() + 1);
      }
    }
    for (const reminder of remindersToInsert) {
      await db.collection("reminders").insertOne({
        subscriptionId,
        reminderType: reminder.type,
        reminderDate: reminder.date,
        sent: false,
        status: subscription.status || "Active",
        createdAt: new Date(),
        tenantId,
      });
    }
  }

  async deleteSubscription(id: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [ { _id: new ObjectId(id), tenantId }, { id, tenantId } ] };
    
    // Get subscription info before deleting for notification
    const subscription = await db.collection("subscriptions").findOne(filter);
    
    const result = await db.collection("subscriptions").findOneAndDelete(filter);
    if (result && result.value) {
      const subscriptionId = (result.value as any)._id?.toString();
      if (subscriptionId) {
        await db.collection("reminders").deleteMany({ $or: [ { subscriptionId }, { subscriptionId: new ObjectId(subscriptionId) } ] });
      }
      if (subscriptionId) {
        await db.collection("notifications").deleteMany({ $or: [ { subscriptionId }, { subscriptionId: new ObjectId(subscriptionId) } ] });
      }
      
      // Create notification event for subscription deletion
      if (subscription) {
        try {
          console.log(`🔄 About to create deletion notification event for subscription: ${subscription.serviceName}`);
          await this.createNotificationEvent(
            tenantId,
            'deleted',
            id,
            subscription.serviceName,
            subscription.category
          );
          console.log(`✅ Deletion notification event created for subscription: ${subscription.serviceName}`);
        } catch (notificationError) {
          console.error(`❌ Failed to create deletion notification event for ${subscription.serviceName}:`, notificationError);
          // Don't throw - let deletion succeed even if notification fails
        }
      }
      
      return { success: true, message: "Subscription deleted successfully" };
    }
    return { success: false, message: "Subscription not found" };
  }

  // Reminders
  async getReminders(tenantId: string): Promise<Reminder[]> {
    const db = await this.getDb();
    const reminders = await db.collection("reminders").find(getTenantFilter(tenantId)).toArray();
    // Map MongoDB _id to id (number) and ensure all required Reminder fields
    return reminders.map(r => ({
  id: r._id?.toString() || "",
      tenantId: r.tenantId || tenantId,
    subscriptionId: r.subscriptionId || "",
      alertDays: r.alertDays || 7,
      emailEnabled: r.emailEnabled ?? true,
      whatsappEnabled: r.whatsappEnabled ?? false,
      reminderType: r.reminderType || "renewal",
      monthlyDay: r.monthlyDay ?? null
    }));
  }

  async getReminderBySubscriptionId(subscriptionId: number): Promise<Reminder | undefined> {
    const db = await this.getDb();
    const reminder = await db.collection("reminders").findOne({ subscriptionId });
    if (!reminder) return undefined;
    return {
  id: reminder._id?.toString() || "",
      tenantId: reminder.tenantId,
    subscriptionId: reminder.subscriptionId?.toString() || "",
      alertDays: reminder.alertDays ?? 7,
      emailEnabled: reminder.emailEnabled ?? true,
      whatsappEnabled: reminder.whatsappEnabled ?? false,
      reminderType: reminder.reminderType || "renewal",
      monthlyDay: reminder.monthlyDay ?? null
    };
  }

  async createReminder(reminder: InsertReminder, tenantId: string): Promise<Reminder> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const doc = { ...reminder, tenantId, _id: new ObjectId() };
    await db.collection("reminders").insertOne(doc);
    return {
  id: doc._id?.toString() || "",
      tenantId: doc.tenantId || tenantId,
      subscriptionId: doc.subscriptionId,
      alertDays: doc.alertDays ?? 7,
      emailEnabled: doc.emailEnabled ?? true,
      whatsappEnabled: doc.whatsappEnabled ?? false,
      reminderType: doc.reminderType || "renewal",
      monthlyDay: doc.monthlyDay ?? null
    };
  }

  async updateReminder(id: number, reminder: Partial<InsertReminder>, tenantId: string): Promise<Reminder | undefined> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [ { id, tenantId }, { id: id.toString(), tenantId } ] };
    try { filter.$or.push({ _id: new ObjectId(id), tenantId }); } catch {}
    try { filter.$or.push({ _id: new ObjectId(id.toString()), tenantId }); } catch {}
    const result = await db.collection("reminders").findOneAndUpdate(
      filter,
      { $set: reminder },
      { returnDocument: "after" }
    );
    if (!result || !result.value) return undefined;
    const r = result.value;
    return {
  id: r._id?.toString() || "",
      tenantId: r.tenantId || tenantId,
    subscriptionId: r.subscriptionId?.toString() || "",
      alertDays: r.alertDays ?? 7,
      emailEnabled: r.emailEnabled ?? true,
      whatsappEnabled: r.whatsappEnabled ?? false,
      reminderType: r.reminderType || "renewal",
      monthlyDay: r.monthlyDay ?? null
    };
  }

  async deleteReminder(id: string): Promise<boolean> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [ { id }, { id: id.toString() } ] };
    try { filter.$or.push({ _id: new ObjectId(id) }); } catch {}
    try { filter.$or.push({ _id: new ObjectId(id.toString()) }); } catch {}
    const result = await db.collection("reminders").deleteOne(filter);
    return result.deletedCount === 1;
  }

  // Compliance
  async getComplianceItems(tenantId: string): Promise<any[]> {
    const db = await this.getDb();
    return await db.collection("compliance").find(getTenantFilter(tenantId)).toArray();
  }

  async createComplianceItem(item: any, tenantId: string): Promise<any> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const doc = { ...item, tenantId, _id: new ObjectId() };
    await db.collection("compliance").insertOne(doc);
    return { ...item, id: doc._id.toString(), tenantId };
  }

  async updateComplianceItem(id: string, item: any): Promise<any> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [] };
    // Try ObjectId
    try { filter.$or.push({ _id: new ObjectId(id) }); } catch {}
    // Try string id
    filter.$or.push({ id });
    const result = await db.collection("compliance").findOneAndUpdate(
      filter,
      { $set: item },
      { returnDocument: "after" }
    );
    return result?.value || null;
  }

  async deleteComplianceItem(id: string): Promise<boolean> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [] };
    // Try ObjectId
    try { filter.$or.push({ _id: new ObjectId(id) }); } catch {}
    // Try string id
    filter.$or.push({ id });
    const result = await db.collection("compliance").deleteOne(filter);
    return result.deletedCount === 1;
  }

  // History
  async getHistoryItems(tenantId: string): Promise<any[]> {
    const db = await this.getDb();
    return await db.collection("history").find(getTenantFilter(tenantId)).toArray();
  }

  async createHistoryItem(item: any, tenantId: string): Promise<any> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const doc = { ...item, tenantId, _id: new ObjectId() };
    await db.collection("history").insertOne(doc);
    return { ...item, id: doc._id.toString(), tenantId };
  }

  async updateHistoryItem(id: string, item: any): Promise<any> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [] };
    // Try ObjectId
    try { filter.$or.push({ _id: new ObjectId(id) }); } catch {}
    // Try string id
    filter.$or.push({ id });
    const result = await db.collection("history").findOneAndUpdate(
      filter,
      { $set: item },
      { returnDocument: "after" }
    );
    return result?.value || null;
  }

  async deleteHistoryItem(id: string): Promise<boolean> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [] };
    // Try ObjectId
    try { filter.$or.push({ _id: new ObjectId(id) }); } catch {}
    // Try string id
    filter.$or.push({ id });
    const result = await db.collection("history").deleteOne(filter);
    return result.deletedCount === 1;
  }

  // Payments
  async getPayments(tenantId: string): Promise<any[]> {
    const db = await this.getDb();
    return await db.collection("payment").find(getTenantFilter(tenantId)).toArray();
  }

  async createPayment(payment: any, tenantId: string): Promise<any> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const doc = { ...payment, tenantId, _id: new ObjectId() };
    await db.collection("payment").insertOne(doc);
    return { ...payment, id: doc._id.toString(), tenantId };
  }

  async updatePayment(id: string, payment: any): Promise<any> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [] };
    // Try ObjectId
    try { filter.$or.push({ _id: new ObjectId(id) }); } catch {}
    // Try string id
    filter.$or.push({ id });
    const result = await db.collection("payment").findOneAndUpdate(
      filter,
      { $set: payment },
      { returnDocument: "after" }
    );
    return result?.value || null;
  }

  async deletePayment(id: string): Promise<boolean> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [] };
    // Try ObjectId
    try { filter.$or.push({ _id: new ObjectId(id) }); } catch {}
    // Try string id
    filter.$or.push({ id });
    const result = await db.collection("payment").deleteOne(filter);
    return result.deletedCount === 1;
  }

  // Ledger
  async getLedgerItems(tenantId: string): Promise<any[]> {
    const db = await this.getDb();
    return await db.collection("ledger").find(getTenantFilter(tenantId)).toArray();
  }

  async createLedgerItem(item: any, tenantId: string): Promise<any> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const doc = { ...item, tenantId, _id: new ObjectId() };
    await db.collection("ledger").insertOne(doc);
    return { ...item, id: doc._id.toString(), tenantId };
  }

  async deleteLedgerItem(id: string): Promise<boolean> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const result = await db.collection("ledger").deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  }

  // Employees
  async getEmployees(tenantId: string): Promise<any[]> {
    const db = await this.getDb();
    return await db.collection("employees").find(getTenantFilter(tenantId)).toArray();
  }

  async createEmployee(employee: any, tenantId: string): Promise<any> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const doc = { ...employee, tenantId, _id: new ObjectId() };
    await db.collection("employees").insertOne(doc);
    return { ...employee, id: doc._id.toString(), tenantId };
  }

  // Analytics
  async getDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
    // TODO: Implement tenantId filtering for dashboard metrics
    // Example: filter subscriptions by tenantId
    const db = await this.getDb();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthlySpendAgg = await db.collection("subscriptions").aggregate([
      { $match: { tenantId, startDate: { $lte: monthEnd }, nextRenewal: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]).toArray();
    const monthlySpend = monthlySpendAgg[0]?.total || 0;
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31);
    const yearlySpendAgg = await db.collection("subscriptions").aggregate([
      { $match: { tenantId, startDate: { $lte: yearEnd }, nextRenewal: { $gte: yearStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]).toArray();
    const yearlySpend = yearlySpendAgg[0]?.total || 0;
    const activeSubscriptions = await db.collection("subscriptions").countDocuments({ tenantId, status: "Active" });
    const upcomingRenewals = await db.collection("subscriptions").countDocuments({ tenantId, nextRenewal: { $gte: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } });
    return { monthlySpend, yearlySpend, activeSubscriptions, upcomingRenewals };
  }

  async getSpendingTrends(tenantId: string): Promise<SpendingTrend[]> {
    const db = await this.getDb();
    const trends = await db.collection("subscriptions").aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$startDate" } },
          amount: { $sum: "$amount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]).toArray();
    return trends.map(t => ({ month: t._id, amount: t.amount }));
  }

  async getCategoryBreakdown(tenantId: string): Promise<CategoryBreakdown[]> {
    const db = await this.getDb();
    const categories = await db.collection("subscriptions").aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" }
        }
      }
    ]).toArray();
    const colorList = ["#6366f1", "#f59e42", "#10b981", "#ef4444", "#3b82f6", "#a78bfa", "#f43f5e", "#fbbf24"];
    return categories.map((c, i) => ({ category: c._id, amount: c.amount, color: colorList[i % colorList.length] }));
  }

  async getRecentActivity(tenantId: string): Promise<RecentActivity[]> {
    const db = await this.getDb();
    const subs = await db.collection("subscriptions").find({ tenantId }).sort({ createdAt: -1, updatedAt: -1 }).limit(20).toArray();
    const reminders = await db.collection("reminders").find({ tenantId }).sort({ createdAt: -1 }).limit(20).toArray();
    // Subscription activities: only the most recent event per subscription, with icon/action
    const subActivitiesMap = new Map<string, RecentActivity>();
    for (const s of subs) {
      let event: RecentActivity | null = null;
      if (s.updatedAt && (!s.createdAt || s.updatedAt.getTime() !== s.createdAt.getTime())) {
        let desc = `${s.serviceName} subscription updated`;
        let icon = "edit";
        let action = "updated";
        if (s.billingCycle && s.prevBillingCycle && s.billingCycle !== s.prevBillingCycle) {
          desc = `${s.serviceName} billing cycle changed to ${s.billingCycle}`;
          icon = "edit";
          action = "billing_cycle";
        }
        event = {
          id: s._id?.toString(),
          type: "updated",
          description: desc,
          amount: s.amount ? `$${Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}/${s.billingCycle}` : undefined,
          timestamp: s.updatedAt.toISOString(),
          icon,
          action
        };
      } else if (s.createdAt) {
        event = {
          id: s._id?.toString(),
          type: "added",
          description: `${s.serviceName} subscription added`,
          amount: s.amount ? `$${Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}/${s.billingCycle}` : undefined,
          timestamp: s.createdAt.toISOString(),
          icon: "plus",
          action: "added"
        };
      }
      if (event) {
        const existing = subActivitiesMap.get(event.id!);
        if (!existing || (existing.timestamp < event.timestamp)) {
          subActivitiesMap.set(event.id!, event);
        }
      }
    }
    const subActivities: RecentActivity[] = Array.from(subActivitiesMap.values());
    const reminderActivities: RecentActivity[] = reminders.map(r => {
      let desc = `Reminder for subscription ${r.subscriptionId}`;
      let icon = "bell";
      let action = "reminder";
      return {
        id: r._id?.toString(),
        type: "reminder",
        description: desc,
        amount: r.amount ? `$${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}/${r.billingCycle || "month"}` : undefined,
        timestamp: r.createdAt ? r.createdAt.toISOString() : "",
        icon,
        action
      };
    });
    const all: RecentActivity[] = [...subActivities, ...reminderActivities].sort((a, b) => (b.timestamp || "") < (a.timestamp || "") ? -1 : 1);
    return all.slice(0, 10);
  }

  async getNotifications(tenantId: string): Promise<NotificationItem[]> {
    const db = await this.getDb();
    const reminders = await db.collection("reminders").find({ tenantId, sent: false }).toArray();
    const remindersBySub = new Map();
    for (const reminder of reminders) {
      const subId = reminder.subscriptionId || reminder.subscription_id;
      if (!subId) continue;
      if (!remindersBySub.has(subId)) remindersBySub.set(subId, []);
      remindersBySub.get(subId).push(reminder);
    }
    const { ObjectId } = await import("mongodb");
    const notifications: NotificationItem[] = [];
    const today = new Date();
    const remindersEntries = Array.from(remindersBySub.entries());
    for (const entry of remindersEntries) {
      const subId = entry[0];
      const subReminders: any[] = entry[1];
      let subscription = null;
      try {
        subscription = await db.collection("subscriptions").findOne({ tenantId, _id: new ObjectId(subId) });
      } catch {
        subscription = await db.collection("subscriptions").findOne({ tenantId, id: subId });
      }
      if (!subscription) continue;
      const reminderPolicy = subscription.reminderPolicy || "One time";
      const reminderDays = Number(subscription.reminderDays) || 7;
      const renewalDate = subscription.nextRenewal || subscription.endDate;
      let reminderTriggeredDate = null;
      if (reminderPolicy === "One time") {
        if (renewalDate) {
          const trigger = new Date(renewalDate);
          trigger.setDate(trigger.getDate() - reminderDays);
          reminderTriggeredDate = trigger;
        }
      } else if (reminderPolicy === "Two times") {
        if (renewalDate) {
          const first = new Date(renewalDate);
          first.setDate(first.getDate() - reminderDays);
          const secondDays = Math.floor(reminderDays / 2);
          const second = new Date(renewalDate);
          second.setDate(second.getDate() - secondDays);
          if (first > today && second > today) reminderTriggeredDate = first;
          else if (first <= today && second > today) reminderTriggeredDate = second;
          else if (first > today && second <= today) reminderTriggeredDate = first;
          else reminderTriggeredDate = null;
        }
      } else if (reminderPolicy === "Until Renewal") {
        if (renewalDate) {
          const start = new Date(renewalDate);
          start.setDate(start.getDate() - reminderDays);
          const end = new Date(renewalDate);
          
          // For "Until Renewal", show notifications if we're within the reminder window
          // (from start date until renewal date)
          const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
          
          if (todayDate >= startDate && todayDate <= endDate) {
            reminderTriggeredDate = todayDate;
          } else {
            reminderTriggeredDate = null;
          }
        }
      }
      let reminderObj = subReminders.find((r: any) => r.reminderDate === (reminderTriggeredDate ? reminderTriggeredDate.toISOString().slice(0, 10) : null));
      if (!reminderObj && subReminders.length > 0) reminderObj = subReminders[0];
      notifications.push({
        id: reminderObj?._id?.toString() || reminderObj?.id || subId,
        subscriptionId: subId,
        subscriptionName: subscription?.serviceName || "",
        category: subscription?.category || "",
        reminderType: reminderObj?.reminderType || reminderObj?.type || "",
        reminderTriggerDate: reminderTriggeredDate ? reminderTriggeredDate.toISOString().slice(0, 10) : reminderObj?.reminderDate,
        subscriptionEndDate: subscription?.nextRenewal || subscription?.endDate || "",
        status: reminderObj?.status || subscription?.status || "Active",
        type: 'subscription',
      });
    }
    return notifications;
  }

  async getComplianceNotifications(tenantId: string): Promise<NotificationItem[]> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const notifications: NotificationItem[] = [];
    const today = new Date();
    
    // Get all compliance items for the tenant
    const complianceItems = await db.collection("compliance").find({ tenantId }).toArray();
    
    // Fetch compliance reminders from the reminders collection
    const complianceReminders = await db.collection("reminders").find({
      tenantId,
      complianceId: { $exists: true },
      status: "Active"
    }).toArray();

    console.log(`[DEBUG] Found ${complianceReminders.length} compliance reminders in database`);

    for (const reminder of complianceReminders) {
      const reminderDate = new Date(reminder.reminderDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      reminderDate.setHours(0, 0, 0, 0);

      // Show reminders that are due (today or earlier)
      if (reminderDate <= today) {
        console.log(`[DEBUG] Processing compliance reminder for ${reminder.complianceId}, reminderDate: ${reminder.reminderDate}`);

        const displayName = (
          reminder.filingName ||
          'Compliance Filing'
        );

        notifications.push({
          id: reminder._id?.toString() || Math.random().toString(),
          complianceId: reminder.complianceId,
          filingName: displayName,
          complianceCategory: reminder.complianceCategory || "",
          reminderTriggerDate: reminder.reminderDate,
          submissionDeadline: "", // Will be filled by frontend if needed
          status: reminder.status || "Active",
          type: 'compliance',
          message: `Compliance reminder for ${displayName}`,
          read: false,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    return notifications;
  }

  // Notification event tracking
  async createNotificationEvent(
    tenantId: string,
    eventType: 'created' | 'deleted',
    subscriptionId: string,
    subscriptionName: string,
    category: string
  ): Promise<void> {
    try {
      console.log(`🔧 Getting database connection for notification event...`);
      const db = await this.getDb();
      console.log(`🔧 Database connection successful, getting ObjectId...`);
      const { ObjectId } = await import("mongodb");
      
      const notification = {
        _id: new ObjectId(),
        tenantId,
        type: 'subscription',
        eventType,
        subscriptionId,
        subscriptionName,
        category,
        message: `Subscription ${subscriptionName} ${eventType}`,
        read: false,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        reminderTriggerDate: new Date().toISOString().slice(0, 10)
      };
      
      console.log(`🔄 Attempting to create notification event:`, notification);
      const result = await db.collection("notification_events").insertOne(notification);
      console.log(`✅ Notification event created successfully with ID: ${result.insertedId}`);
    } catch (error) {
      console.error(`❌ Error creating notification event:`, error);
      throw error;
    }
  }

  async createComplianceNotificationEvent(
    tenantId: string,
    eventType: 'created' | 'deleted',
    complianceId: string,
    filingName: string,
    complianceCategory: string
  ): Promise<void> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    
    const notification = {
      _id: new ObjectId(),
      tenantId,
      type: 'compliance',
      eventType,
      complianceId,
      filingName,
      complianceCategory,
      message: `Compliance filing ${filingName} ${eventType}`,
      read: false,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      reminderTriggerDate: new Date().toISOString().slice(0, 10)
    };
    
    await db.collection("notification_events").insertOne(notification);
  }

  async getNotificationEvents(tenantId: string): Promise<NotificationItem[]> {
    const db = await this.getDb();
    const events = await db.collection("notification_events")
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log(`📋 Found ${events.length} notification events for tenant ${tenantId}`);
    
    return events.map(event => ({
      id: event._id.toString(),
      type: event.type,
      eventType: event.eventType,
      subscriptionId: event.subscriptionId,
      subscriptionName: event.subscriptionName,
      complianceId: event.complianceId,
      filingName: event.filingName,
      category: event.category || event.complianceCategory,
      message: event.message,
      read: event.read,
      timestamp: event.timestamp,
      createdAt: event.createdAt,
      reminderTriggerDate: event.reminderTriggerDate
    }));
  }

  async cleanupOldNotifications(): Promise<void> {
    const db = await this.getDb();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Clean up old notification events
    await db.collection("notification_events").deleteMany({
      createdAt: { $lt: sixtyDaysAgo.toISOString() }
    });

    // Clean up old reminders (reminderDate or createdAt older than 60 days)
    await db.collection("reminders").deleteMany({
      $or: [
        { createdAt: { $lt: sixtyDaysAgo } },
        { reminderDate: { $lt: sixtyDaysAgo.toISOString().slice(0, 10) } }
      ]
    });

    // Clean up old compliance notifications (if stored in a collection)
    if (db.collection("compliance_notifications")) {
      await db.collection("compliance_notifications").deleteMany({
        createdAt: { $lt: sixtyDaysAgo.toISOString() }
      });
    }
  }
}

export const storage = new MongoStorage();