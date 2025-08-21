import { z } from "zod";
export declare const users: any;
export declare const subscriptions: any;
export declare const reminders: any;
export declare const insertUserSchema: any;
export declare const insertSubscriptionSchema: any;
export declare const insertReminderSchema: any;
export type InsertUser = z.infer<typeof insertUserSchema> & {
    tenantId: string;
};
export type User = typeof users.$inferSelect & {
    tenantId: string;
};
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema> & {
    tenantId: string;
};
export type Subscription = typeof subscriptions.$inferSelect & {
    tenantId: string;
};
export type InsertReminder = z.infer<typeof insertReminderSchema> & {
    tenantId: string;
};
export type Reminder = typeof reminders.$inferSelect & {
    tenantId: string;
};
export type DashboardMetrics = {
    monthlySpend: number;
    yearlySpend: number;
    activeSubscriptions: number;
    upcomingRenewals: number;
};
export type SpendingTrend = {
    month: string;
    amount: number;
};
export type CategoryBreakdown = {
    category: string;
    amount: number;
    color: string;
};
export type RecentActivity = {
    id: string;
    type: 'added' | 'updated' | 'reminder';
    description: string;
    amount?: string;
    timestamp: string;
    username?: string;
    icon?: string;
    action?: string;
};
export type CategoryConfig = {
    name: string;
    visible: boolean;
    defaultReminderDays: number;
};
export type NotificationItem = {
    id: string;
    subscriptionId: number;
    subscriptionName: string;
    category: string;
    reminderType: string;
    reminderTriggerDate: string;
    subscriptionEndDate: string;
    status: 'active' | 'pending' | 'completed';
};
