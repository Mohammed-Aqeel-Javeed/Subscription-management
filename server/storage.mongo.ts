import { Db, ObjectId } from "mongodb";
import { connectToDatabase } from "./mongo";
import type { IStorage } from "./storage";
import type { User, InsertUser, Subscription, InsertSubscription, Reminder, InsertReminder, DashboardMetrics, SpendingTrend, CategoryBreakdown, RecentActivity, NotificationItem } from "@shared/schema";

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
    // Map MongoDB _id to id for frontend compatibility
    return users.map(u => ({ ...u, id: u._id?.toString() }));
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
    return { ...user, id: user._id?.toString() };
  }
  async getUserByEmail(email: string): Promise<User | undefined> { throw new Error('Not implemented'); }
  async createUser(user: InsertUser, tenantId: string): Promise<User> {
    const db = await this.getDb();
    // Always generate a new ObjectId for MongoDB _id
    const { ObjectId } = await import("mongodb");
    const doc = { ...user, tenantId, _id: new ObjectId() };
    await db.collection("users").insertOne(doc);
    // Return user with both id and _id for frontend compatibility
    return { ...user, id: doc._id.toString(), _id: doc._id, tenantId } as User;
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
    return { ...result.value, id: result.value._id?.toString(), _id: result.value._id } as User;
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
    const subs = await db.collection<Subscription>("subscriptions").find(getTenantFilter(tenantId)).toArray();
    // Ensure no empty string for Select fields
    return subs.map(s => ({
      ...s,
      billingCycle: s.billingCycle && s.billingCycle !== "" ? s.billingCycle : "monthly",
      category: s.category && s.category !== "" ? s.category : "Software",
      status: s.status && s.status !== "" ? s.status : "Active",
      reminderPolicy: s.reminderPolicy && s.reminderPolicy !== "" ? s.reminderPolicy : "One time",
    }));
  }
  async getSubscription(id: string, tenantId: string): Promise<Subscription | undefined> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [ { _id: new ObjectId(id), tenantId }, { id, tenantId } ] };
    const subscription = await db.collection("subscriptions").findOne(filter);
    if (!subscription) return undefined;
    return {
      ...subscription,
      id: subscription._id?.toString(),
      billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "monthly",
      category: subscription.category && subscription.category !== "" ? subscription.category : "Software",
      status: subscription.status && subscription.status !== "" ? subscription.status : "Active",
      reminderPolicy: subscription.reminderPolicy && subscription.reminderPolicy !== "" ? subscription.reminderPolicy : "One time",
    };
  }
  async createSubscription(subscription: InsertSubscription, tenantId: string): Promise<Subscription> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    // Remove updatedAt if present
    const { updatedAt, ...rest } = subscription;
    const doc = { ...rest, tenantId, _id: new ObjectId() };
    await db.collection("subscriptions").insertOne(doc);
    // Generate reminders for this subscription
    await this.generateAndInsertRemindersForSubscription(doc, tenantId);
    return { ...rest, id: doc._id.toString(), tenantId } as Subscription;
  }
  async updateSubscription(id: string, subscription: Partial<InsertSubscription>, tenantId: string): Promise<Subscription | undefined> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    let filter: any = { $or: [ { _id: new ObjectId(id), tenantId }, { id, tenantId } ] };
    const { updatedAt, ...rest } = subscription;
    const result = await db.collection("subscriptions").findOneAndUpdate(
      filter,
      { $set: rest },
      { returnDocument: "after" }
    );
    if (!result || !result.value) return undefined;
    const subscriptionId = result.value._id?.toString();
    if (subscriptionId) {
      await db.collection("reminders").deleteMany({ subscriptionId });
    }
    await this.generateAndInsertRemindersForSubscription(result.value, tenantId);
    return result.value as Subscription | undefined;
  }
  /**
   * Generate and insert reminders for a subscription (on create or update)
   */
  private async generateAndInsertRemindersForSubscription(subscription: any, tenantId?: string) {
    const db = await this.getDb();
    // Always use _id string for subscriptionId
    const subscriptionId = subscription._id?.toString();
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
    const result = await db.collection("subscriptions").findOneAndDelete(filter);
    if (result && result.value) {
      const subscriptionId = result.value._id?.toString();
      if (subscriptionId) {
        await db.collection("reminders").deleteMany({ $or: [ { subscriptionId }, { subscriptionId: new ObjectId(subscriptionId) } ] });
      }
      if (subscriptionId) {
        await db.collection("notifications").deleteMany({ $or: [ { subscriptionId }, { subscriptionId: new ObjectId(subscriptionId) } ] });
      }
      return { success: true, message: "Subscription deleted successfully" };
    }
    return { success: false, message: "Subscription not found" };
  }

  // Reminders
  async getReminders(tenantId: string): Promise<Reminder[]> {
    const db = await this.getDb();
    const reminders = await db.collection("reminders").find(getTenantFilter(tenantId)).toArray();
    return reminders.map(r => ({ ...r, id: r._id?.toString() }));
  }
  async getReminderBySubscriptionId(subscriptionId: number): Promise<Reminder | undefined> {
    const db = await this.getDb();
    const reminder = await db.collection("reminders").findOne({ subscriptionId });
    if (!reminder) return undefined;
    return { ...reminder, id: reminder._id?.toString() };
  }
  async createReminder(reminder: InsertReminder, tenantId: string): Promise<Reminder> {
    const db = await this.getDb();
    const { ObjectId } = await import("mongodb");
    const doc = { ...reminder, tenantId, _id: new ObjectId() };
    await db.collection("reminders").insertOne(doc);
    return { ...reminder, id: doc._id.toString(), tenantId } as Reminder;
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
    if (!result) return undefined;
    return result.value as Reminder | undefined;
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
          let found = null;
          let current = new Date(start);
          while (current <= end) {
            if (current >= today) {
              found = new Date(current);
              break;
            }
            current.setDate(current.getDate() + 1);
          }
          reminderTriggeredDate = found;
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
      });
    }
    return notifications;
  }
}

export const storage = new MongoStorage();
