import { users, subscriptions, reminders, type User, type InsertUser, type Subscription, type InsertSubscription, type Reminder, type InsertReminder, type DashboardMetrics, type SpendingTrend, type CategoryBreakdown, type RecentActivity, type NotificationItem } from "@shared/schema";
// Extend RecentActivity type to include serviceName for frontend display
type RecentActivityWithName = RecentActivity & { serviceName?: string };
import { MongoStorage } from "./storage.mongo";

export interface IStorage {
  // Users
  getUsers(tenantId: string): Promise<User[]>;
  getUser(id: string, tenantId: string): Promise<User | undefined>;
  getUserByEmail(email: string, tenantId: string): Promise<User | undefined>;
  createUser(user: InsertUser, tenantId: string): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>, tenantId: string): Promise<User | undefined>;
  deleteUser(id: string, tenantId: string): Promise<boolean>;

  // Subscriptions
  getSubscriptions(tenantId: string): Promise<Subscription[]>;
  getSubscription(id: string, tenantId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription, tenantId: string): Promise<Subscription>;
  updateSubscription(id: string, subscription: Partial<InsertSubscription>, tenantId: string): Promise<Subscription | undefined>;
  deleteSubscription(id: string, tenantId: string): Promise<{ success: boolean; message: string }>;

  // Reminders
  getReminders(tenantId: string): Promise<Reminder[]>;
  getReminderBySubscriptionId(subscriptionId: number, tenantId: string): Promise<Reminder | undefined>;
  createReminder(reminder: InsertReminder, tenantId: string): Promise<Reminder>;
  updateReminder(id: number, reminder: Partial<InsertReminder>, tenantId: string): Promise<Reminder | undefined>;
  deleteReminder(id: string, tenantId: string): Promise<boolean>;

  // Analytics
  getDashboardMetrics(tenantId: string): Promise<DashboardMetrics>;
  getSpendingTrends(tenantId: string): Promise<SpendingTrend[]>;
  getCategoryBreakdown(tenantId: string): Promise<CategoryBreakdown[]>;
  getRecentActivity(tenantId: string): Promise<RecentActivity[]>;

  // Notifications
  getNotifications(tenantId: string): Promise<NotificationItem[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private subscriptions: Map<string, Subscription>;
  private reminders: Map<number, Reminder>;
  private activities: RecentActivityWithName[];
  private currentUserId: number;
  private currentSubscriptionId: number;
  private currentReminderId: number;

  // Category-based default alert periods (in days)
  private getCategoryDefaultAlertDays(category: string, billingCycle: string): number {
    if (category === 'Regulatory') {
      return billingCycle === 'yearly' ? 60 : 14; // 60 days for annual, 14 for others
    }
    
    // Default periods for other categories
    const defaults: Record<string, number> = {
      'Entertainment': 7,
      'Software': 14,
      'Business Tools': 21,
      'Cloud Storage': 14,
      'Music': 7,
      'News': 7,
    };
    
    return defaults[category] || 7;
  }

  constructor() {
    this.users = new Map();
    this.subscriptions = new Map();
    this.reminders = new Map();
    this.activities = [];
    this.currentUserId = 1;
    this.currentSubscriptionId = 1;
    this.currentReminderId = 1;
  }

  private initializeData() {
    // No static data initialization
  }

  // Users
  async getUsers(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: string, tenantId: string): Promise<User | undefined> {
    return this.users.get(Number(id));
  }

  async getUserByEmail(email: string, tenantId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser, tenantId: string): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id: String(id),
      tenantId,
      name: insertUser.name,
      email: insertUser.email,
      role: insertUser.role || "viewer",
      status: insertUser.status || "active",
      lastLogin: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updateUser: Partial<InsertUser>, tenantId: string): Promise<User | undefined> {
    // For MemStorage, just convert id to number for compatibility
    const numId = Number(id);
    const user = this.users.get(numId);
    if (!user) return undefined;
    const updatedUser = { ...user, ...updateUser };
    this.users.set(numId, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string, tenantId: string): Promise<boolean> {
    // For MemStorage, just convert id to number for compatibility
    return this.users.delete(Number(id));
  }

  // Subscriptions
  async getSubscriptions(tenantId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
  }

  async getSubscription(id: string, tenantId: string): Promise<Subscription | undefined> {
    return this.subscriptions.get(id);
  }

  async createSubscription(insertSubscription: InsertSubscription, tenantId: string): Promise<Subscription> {
    const id = String(this.currentSubscriptionId++);
    const subscription: Subscription = {
      id,
      tenantId,
      serviceName: insertSubscription.serviceName,
      vendor: insertSubscription.vendor,
      amount: insertSubscription.amount !== undefined ? String(insertSubscription.amount) : "0",
      billingCycle: insertSubscription.billingCycle,
      category: insertSubscription.category,
      startDate: insertSubscription.startDate,
      nextRenewal: insertSubscription.nextRenewal,
      status: insertSubscription.status || "Active",
      reminderDays: insertSubscription.reminderDays || 7,
      reminderPolicy: insertSubscription.reminderPolicy || "One time",
      notes: insertSubscription.notes || null,
      isActive: insertSubscription.isActive ?? true,
      createdAt: new Date(),
      updatedBy: insertSubscription.updatedBy || null,
    };
    this.subscriptions.set(id, subscription);
    // Track activity
    this.activities.push({
      id: String(id),
      type: "added",
      serviceName: subscription.serviceName || '',
      amount: subscription.amount ? `$${subscription.amount}/${subscription.billingCycle}` : undefined,
      description: `${subscription.serviceName || 'Subscription'} subscription added`,
      timestamp: subscription.createdAt.toISOString(),
    });
    // Auto-create category-based reminder
    await this.createCategoryBasedReminder(subscription, tenantId);
    return subscription;
  }

  private async createCategoryBasedReminder(subscription: Subscription, tenantId: string): Promise<void> {
    const alertDays = this.getCategoryDefaultAlertDays(subscription.category, subscription.billingCycle);
    const reminderData: InsertReminder = {
      tenantId,
      subscriptionId: String(subscription.id),
      alertDays,
      emailEnabled: true,
      whatsappEnabled: subscription.category === 'Regulatory',
      reminderType: subscription.category === 'Regulatory' && subscription.billingCycle === 'monthly' ? 'monthly_recurring' : 'renewal',
      monthlyDay: subscription.category === 'Regulatory' && subscription.billingCycle === 'monthly' ? 14 : null,
    };
    await this.createReminder(reminderData, tenantId);
  }

  async updateSubscription(id: string, updateSubscription: Partial<InsertSubscription>, tenantId: string): Promise<Subscription | undefined> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return undefined;
    const updatedSubscription: Subscription = {
      ...subscription,
      ...updateSubscription,
      amount: updateSubscription.amount !== undefined ? String(updateSubscription.amount) : subscription.amount,
    };
    this.subscriptions.set(id, updatedSubscription);
    // Track activity
    this.activities.push({
      id: String(id),
      type: "updated",
      serviceName: updatedSubscription.serviceName || '',
      amount: updatedSubscription.amount ? `$${updatedSubscription.amount}/${updatedSubscription.billingCycle}` : undefined,
      description: `${updatedSubscription.serviceName || 'Subscription'} subscription updated`,
      timestamp: new Date().toISOString(),
    });
    return updatedSubscription;
  }

  async deleteSubscription(id: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      return { success: false, message: "Subscription not found" };
    }
    subscription.isActive = false;
    this.subscriptions.set(id, subscription);
    // Delete all reminders for this subscription
    Array.from(this.reminders.entries()).forEach(([reminderId, reminder]) => {
      if (String(reminder.subscriptionId) === String(id)) {
        this.reminders.delete(reminderId);
      }
    });
    return { success: true, message: "Subscription and related reminders deleted successfully" };
  }

  // Reminders
  async getReminders(tenantId: string): Promise<Reminder[]> {
    return Array.from(this.reminders.values());
  }

  async getReminderBySubscriptionId(subscriptionId: number, tenantId: string): Promise<Reminder | undefined> {
    return Array.from(this.reminders.values()).find(r => r.subscriptionId === subscriptionId);
  }

  async createReminder(insertReminder: InsertReminder, tenantId: string): Promise<Reminder> {
    const id = this.currentReminderId++;
    const reminder: Reminder = {
      id: String(id),
      tenantId,
      subscriptionId: insertReminder.subscriptionId,
      alertDays: insertReminder.alertDays ?? 7,
      emailEnabled: insertReminder.emailEnabled ?? true,
      whatsappEnabled: insertReminder.whatsappEnabled ?? false,
      reminderType: insertReminder.reminderType ?? "renewal",
      monthlyDay: insertReminder.monthlyDay ?? null,
    };
    this.reminders.set(id, reminder);
    // Track activity
    // Always use subscription name, never fallback to ID
    let serviceName = "";
    let amount = undefined;
    const sub = this.subscriptions.get(String(reminder.subscriptionId));
    if (sub) {
      serviceName = sub.serviceName;
      amount = sub.amount ? `$${sub.amount}/${sub.billingCycle}` : undefined;
    }
    this.activities.push({
      id: String(id),
      type: "reminder",
      serviceName: serviceName || '',
      amount,
      description: serviceName ? `Reminder for ${serviceName} sent` : "Reminder sent",
      timestamp: new Date().toISOString(),
    });
    return reminder;
  }

  async updateReminder(id: number, updateReminder: Partial<InsertReminder>, tenantId: string): Promise<Reminder | undefined> {
    const reminder = this.reminders.get(id);
    if (!reminder) return undefined;
    
    const updatedReminder = { ...reminder, ...updateReminder };
    this.reminders.set(id, updatedReminder);
    return updatedReminder;
  }

  async deleteReminder(id: string, tenantId: string): Promise<boolean> {
    // In-memory: try to parse id as number, fallback to string
    const numId = Number(id);
    if (!isNaN(numId)) {
      return this.reminders.delete(numId);
    }
    // If not a number, try to delete by string id (for compatibility)
    return this.reminders.delete(id as any);
  }

  // Analytics
  async getDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(sub => sub.isActive && sub.status === "Active");
    
    const monthlySpend = activeSubscriptions
      .filter(sub => sub.billingCycle === 'monthly')
      .reduce((sum, sub) => sum + parseFloat(sub.amount), 0);
    
    const yearlySpend = activeSubscriptions
      .reduce((sum, sub) => {
        const amount = parseFloat(sub.amount);
        switch (sub.billingCycle) {
          case 'monthly': return sum + (amount * 12);
          case 'yearly': return sum + amount;
          case 'quarterly': return sum + (amount * 4);
          case 'weekly': return sum + (amount * 52);
          default: return sum;
        }
      }, 0);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingRenewals = activeSubscriptions
      .filter(sub => sub.nextRenewal <= thirtyDaysFromNow).length;

    return {
      monthlySpend,
      yearlySpend,
      activeSubscriptions: activeSubscriptions.length,
      upcomingRenewals,
    };
  }

  async getSpendingTrends(): Promise<SpendingTrend[]> {
    const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    const baseAmount = 2100;
    
    return months.map((month, index) => ({
      month,
      amount: baseAmount + (index * 150) + Math.floor(Math.random() * 200),
    }));
  }

  async getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
    const categoryTotals = new Map<string, number>();
    
    activeSubscriptions.forEach(sub => {
      const amount = parseFloat(sub.amount);
      const monthlyAmount = sub.billingCycle === 'monthly' ? amount : 
                           sub.billingCycle === 'yearly' ? amount / 12 :
                           sub.billingCycle === 'quarterly' ? amount / 3 :
                           amount * 4.33; // weekly
      
      categoryTotals.set(sub.category, (categoryTotals.get(sub.category) || 0) + monthlyAmount);
    });

    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
    
    return Array.from(categoryTotals.entries()).map(([category, amount], index) => ({
      category,
      amount,
      color: colors[index % colors.length],
    }));
  }

  async getRecentActivity(tenantId: string): Promise<RecentActivity[]> {
    // Return tracked activities sorted by timestamp desc
    return this.activities.sort((a, b) => (b.timestamp || "") < (a.timestamp || "") ? -1 : 1);
  }

  async getNotifications(tenantId: string): Promise<NotificationItem[]> {
    // Build notifications from reminders and subscriptions
    const notifications: NotificationItem[] = [];
    Array.from(this.reminders.values()).forEach(rem => {
      const sub = this.subscriptions.get(String(rem.subscriptionId));
      notifications.push({
        id: String(rem.id),
        subscriptionId: rem.subscriptionId,
        subscriptionName: sub?.serviceName || "",
        category: sub?.category || "",
        reminderType: rem.reminderType || "renewal",
        reminderTriggerDate: new Date().toISOString(),
        subscriptionEndDate: sub?.nextRenewal ? sub.nextRenewal.toISOString() : "",
        status: (sub?.status === "Active" ? "active" : (sub?.status === "Pending" ? "pending" : (sub?.status === "Completed" ? "completed" : "active"))),
      });
    });
    // Sort by reminderTriggerDate asc
    return notifications.sort((a, b) => new Date(a.reminderTriggerDate).getTime() - new Date(b.reminderTriggerDate).getTime());
  }
}

export const storage = new MongoStorage();
