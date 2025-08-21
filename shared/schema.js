import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export var users = pgTable("users", {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull(), // Multi-tenancy
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    role: text("role").notNull().default("viewer"), // admin, viewer
    status: text("status").notNull().default("active"), // active, inactive
    lastLogin: timestamp("last_login"),
});
export var subscriptions = pgTable("subscriptions", {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull(), // Multi-tenancy
    serviceName: text("service_name").notNull(),
    vendor: text("vendor").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    billingCycle: text("billing_cycle").notNull(), // monthly, yearly, quarterly, weekly
    category: text("category").notNull(),
    startDate: timestamp("start_date").notNull(),
    nextRenewal: timestamp("next_renewal").notNull(),
    status: text("status").notNull().default("Active"), // Active, Cancelled
    reminderDays: integer("reminder_days").notNull().default(7),
    reminderPolicy: text("reminder_policy").notNull().default("One time"), // One time, Two times, Until Renewal
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedBy: text("updated_by"), // username who last updated
});
export var reminders = pgTable("reminders", {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").notNull(), // Multi-tenancy
    subscriptionId: integer("subscription_id").notNull().references(function () { return subscriptions.id; }),
    alertDays: integer("alert_days").notNull().default(7),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
    reminderType: text("reminder_type").notNull().default("renewal"), // renewal, monthly_recurring
    monthlyDay: integer("monthly_day"), // for monthly recurring reminders (1-31)
});
export var insertUserSchema = createInsertSchema(users).omit({
    id: true,
    lastLogin: true,
});
export var insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
    id: true,
    createdAt: true,
}).extend({
    startDate: z.preprocess(function (val) { return new Date(val); }, z.date()),
    nextRenewal: z.preprocess(function (val) { return new Date(val); }, z.date()),
});
export var insertReminderSchema = createInsertSchema(reminders).omit({
    id: true,
});
