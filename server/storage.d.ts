import { type User, type InsertUser, type Subscription, type InsertSubscription, type Reminder, type InsertReminder, type DashboardMetrics, type SpendingTrend, type CategoryBreakdown, type RecentActivity, type NotificationItem } from "../../shared/schema";
import { MongoStorage } from "./storage.mongo";
export interface IStorage {
    getUsers(tenantId: string): Promise<User[]>;
    getUser(id: string, tenantId: string): Promise<User | undefined>;
    getUserByEmail(email: string, tenantId: string): Promise<User | undefined>;
    createUser(user: InsertUser, tenantId: string): Promise<User>;
    updateUser(id: string, user: Partial<InsertUser>, tenantId: string): Promise<User | undefined>;
    deleteUser(id: string, tenantId: string): Promise<boolean>;
    getSubscriptions(tenantId: string): Promise<Subscription[]>;
    getSubscription(id: string, tenantId: string): Promise<Subscription | undefined>;
    createSubscription(subscription: InsertSubscription, tenantId: string): Promise<Subscription>;
    updateSubscription(id: string, subscription: Partial<InsertSubscription>, tenantId: string): Promise<Subscription | undefined>;
    deleteSubscription(id: string, tenantId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getReminders(tenantId: string): Promise<Reminder[]>;
    getReminderBySubscriptionId(subscriptionId: number, tenantId: string): Promise<Reminder | undefined>;
    createReminder(reminder: InsertReminder, tenantId: string): Promise<Reminder>;
    updateReminder(id: number, reminder: Partial<InsertReminder>, tenantId: string): Promise<Reminder | undefined>;
    deleteReminder(id: string, tenantId: string): Promise<boolean>;
    getDashboardMetrics(tenantId: string): Promise<DashboardMetrics>;
    getSpendingTrends(tenantId: string): Promise<SpendingTrend[]>;
    getCategoryBreakdown(tenantId: string): Promise<CategoryBreakdown[]>;
    getRecentActivity(tenantId: string): Promise<RecentActivity[]>;
    getNotifications(tenantId: string): Promise<NotificationItem[]>;
}
export declare class MemStorage implements IStorage {
    private users;
    private subscriptions;
    private reminders;
    private activities;
    private currentUserId;
    private currentSubscriptionId;
    private currentReminderId;
    private getCategoryDefaultAlertDays;
    constructor();
    private initializeData;
    getUsers(tenantId: string): Promise<User[]>;
    getUser(id: string, tenantId: string): Promise<User | undefined>;
    getUserByEmail(email: string, tenantId: string): Promise<User | undefined>;
    createUser(insertUser: InsertUser, tenantId: string): Promise<User>;
    updateUser(id: string, updateUser: Partial<InsertUser>, tenantId: string): Promise<User | undefined>;
    deleteUser(id: string, tenantId: string): Promise<boolean>;
    getSubscriptions(tenantId: string): Promise<Subscription[]>;
    getSubscription(id: string, tenantId: string): Promise<Subscription | undefined>;
    createSubscription(insertSubscription: InsertSubscription, tenantId: string): Promise<Subscription>;
    private createCategoryBasedReminder;
    updateSubscription(id: string, updateSubscription: Partial<InsertSubscription>, tenantId: string): Promise<Subscription | undefined>;
    deleteSubscription(id: string, tenantId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getReminders(tenantId: string): Promise<Reminder[]>;
    getReminderBySubscriptionId(subscriptionId: number, tenantId: string): Promise<Reminder | undefined>;
    createReminder(insertReminder: InsertReminder, tenantId: string): Promise<Reminder>;
    updateReminder(id: number, updateReminder: Partial<InsertReminder>, tenantId: string): Promise<Reminder | undefined>;
    deleteReminder(id: string, tenantId: string): Promise<boolean>;
    getDashboardMetrics(tenantId: string): Promise<DashboardMetrics>;
    getSpendingTrends(): Promise<SpendingTrend[]>;
    getCategoryBreakdown(): Promise<CategoryBreakdown[]>;
    getRecentActivity(tenantId: string): Promise<RecentActivity[]>;
    getNotifications(tenantId: string): Promise<NotificationItem[]>;
}
export declare const storage: MongoStorage;
