import type { IStorage } from "./storage.js";
import type { User, InsertUser, Subscription, InsertSubscription, Reminder, InsertReminder, DashboardMetrics, SpendingTrend, CategoryBreakdown, RecentActivity, NotificationItem } from "../../shared/schema";
export declare class MongoStorage implements IStorage {
    private db;
    private getDb;
    getUsers(tenantId: string): Promise<User[]>;
    getUser(id: string, tenantId: string): Promise<User | undefined>;
    getUserByEmail(email: string): Promise<User | undefined>;
    createUser(user: InsertUser, tenantId: string): Promise<User>;
    updateUser(id: string, user: Partial<InsertUser>, tenantId: string): Promise<User | undefined>;
    deleteUser(id: string, tenantId: string): Promise<boolean>;
    getSubscriptions(tenantId: string): Promise<Subscription[]>;
    getSubscription(id: string, tenantId: string): Promise<Subscription | undefined>;
    createSubscription(subscription: InsertSubscription, tenantId: string): Promise<Subscription>;
    updateSubscription(id: string, subscription: Partial<InsertSubscription>, tenantId: string): Promise<Subscription | undefined>;
    /**
     * Generate and insert reminders for a subscription (on create or update)
     */
    private generateAndInsertRemindersForSubscription;
    deleteSubscription(id: string, tenantId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getReminders(tenantId: string): Promise<Reminder[]>;
    getReminderBySubscriptionId(subscriptionId: number): Promise<Reminder | undefined>;
    createReminder(reminder: InsertReminder, tenantId: string): Promise<Reminder>;
    updateReminder(id: number, reminder: Partial<InsertReminder>, tenantId: string): Promise<Reminder | undefined>;
    deleteReminder(id: string): Promise<boolean>;
    getComplianceItems(tenantId: string): Promise<any[]>;
    createComplianceItem(item: any, tenantId: string): Promise<any>;
    updateComplianceItem(id: string, item: any): Promise<any>;
    deleteComplianceItem(id: string): Promise<boolean>;
    getHistoryItems(tenantId: string): Promise<any[]>;
    createHistoryItem(item: any, tenantId: string): Promise<any>;
    updateHistoryItem(id: string, item: any): Promise<any>;
    deleteHistoryItem(id: string): Promise<boolean>;
    getPayments(tenantId: string): Promise<any[]>;
    createPayment(payment: any, tenantId: string): Promise<any>;
    updatePayment(id: string, payment: any): Promise<any>;
    deletePayment(id: string): Promise<boolean>;
    getLedgerItems(tenantId: string): Promise<any[]>;
    createLedgerItem(item: any, tenantId: string): Promise<any>;
    deleteLedgerItem(id: string): Promise<boolean>;
    getEmployees(tenantId: string): Promise<any[]>;
    createEmployee(employee: any, tenantId: string): Promise<any>;
    getDashboardMetrics(tenantId: string): Promise<DashboardMetrics>;
    getSpendingTrends(tenantId: string): Promise<SpendingTrend[]>;
    getCategoryBreakdown(tenantId: string): Promise<CategoryBreakdown[]>;
    getRecentActivity(tenantId: string): Promise<RecentActivity[]>;
    getNotifications(tenantId: string): Promise<NotificationItem[]>;
}
export declare const storage: MongoStorage;
