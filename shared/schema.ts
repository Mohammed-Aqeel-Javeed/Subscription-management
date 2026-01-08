import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(), // Multi-tenancy
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer"), // super_admin, admin, viewer, contributor, department_editor, department_viewer
  department: text("department"), // For department-based roles
  status: text("status").notNull().default("active"), // active, inactive
  lastLogin: timestamp("last_login"),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(), // Multi-tenancy
  serviceName: text("service_name").notNull(),
  website: text("website"), // Website URL
  vendor: text("vendor").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  billingCycle: text("billing_cycle").notNull(), // monthly, yearly, quarterly, weekly
  category: text("category").notNull(),
  departments: text("departments").array().notNull().default([]), // Array of department names
  paymentMethod: text("payment_method"), // Payment method name
  startDate: timestamp("start_date").notNull(),
  nextRenewal: timestamp("next_renewal").notNull(),
  status: text("status").notNull().default("Active"), // Active, Cancelled
  isDraft: boolean("is_draft").notNull().default(false), // Draft status
  reminderDays: integer("reminder_days").notNull().default(7),
  reminderPolicy: text("reminder_policy").notNull().default("One time"), // One time, Two times, Until Renewal
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  totalAmountInclTax: decimal("total_amount_incl_tax", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedBy: text("updated_by"), // username who last updated
});

export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull(), // Multi-tenancy
  subscriptionId: text("subscription_id").notNull(),
  alertDays: integer("alert_days").notNull().default(7),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
  reminderType: text("reminder_type").notNull().default("renewal"), // renewal, monthly_recurring
  monthlyDay: integer("monthly_day"), // for monthly recurring reminders (1-31)
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  lastLogin: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.number(),
  departments: z.array(z.string()),
  startDate: z.preprocess((val) => new Date(val as string), z.date()),
  nextRenewal: z.preprocess((val) => new Date(val as string), z.date()),
  taxAmount: z.number().optional(),
  totalAmountInclTax: z.number().optional(),
});

export const insertReminderSchema = createInsertSchema(reminders).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema> & { tenantId: string };
export type User = Omit<typeof users.$inferSelect, 'id'> & { id: string; tenantId: string };
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema> & { tenantId: string };
export type Subscription = Omit<typeof subscriptions.$inferSelect, 'id'> & { id: string; tenantId: string };
export type InsertReminder = z.infer<typeof insertReminderSchema> & { tenantId: string; subscriptionId: string };
export type Reminder = Omit<typeof reminders.$inferSelect, 'id'> & { id: string; tenantId: string; subscriptionId: string };

// Analytics types
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

// Category configuration types
export type CategoryConfig = {
  name: string;
  visible: boolean;
  defaultReminderDays: number;
};

export type NotificationItem = {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  category: string;
  reminderType: string;
  reminderTriggerDate: string;
  subscriptionEndDate: string;
  status: 'active' | 'pending' | 'completed';
};
