"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertReminderSchema = exports.insertSubscriptionSchema = exports.insertUserSchema = exports.reminders = exports.subscriptions = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    tenantId: (0, pg_core_1.text)("tenant_id").notNull(), // Multi-tenancy
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    role: (0, pg_core_1.text)("role").notNull().default("viewer"), // admin, viewer
    status: (0, pg_core_1.text)("status").notNull().default("active"), // active, inactive
    lastLogin: (0, pg_core_1.timestamp)("last_login"),
});
exports.subscriptions = (0, pg_core_1.pgTable)("subscriptions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    tenantId: (0, pg_core_1.text)("tenant_id").notNull(), // Multi-tenancy
    serviceName: (0, pg_core_1.text)("service_name").notNull(),
    vendor: (0, pg_core_1.text)("vendor").notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    billingCycle: (0, pg_core_1.text)("billing_cycle").notNull(), // monthly, yearly, quarterly, weekly
    category: (0, pg_core_1.text)("category").notNull(),
    startDate: (0, pg_core_1.timestamp)("start_date").notNull(),
    nextRenewal: (0, pg_core_1.timestamp)("next_renewal").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default("Active"), // Active, Cancelled
    reminderDays: (0, pg_core_1.integer)("reminder_days").notNull().default(7),
    reminderPolicy: (0, pg_core_1.text)("reminder_policy").notNull().default("One time"), // One time, Two times, Until Renewal
    notes: (0, pg_core_1.text)("notes"),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedBy: (0, pg_core_1.text)("updated_by"), // username who last updated
});
exports.reminders = (0, pg_core_1.pgTable)("reminders", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    tenantId: (0, pg_core_1.text)("tenant_id").notNull(), // Multi-tenancy
    subscriptionId: (0, pg_core_1.text)("subscription_id").notNull(),
    alertDays: (0, pg_core_1.integer)("alert_days").notNull().default(7),
    emailEnabled: (0, pg_core_1.boolean)("email_enabled").notNull().default(true),
    whatsappEnabled: (0, pg_core_1.boolean)("whatsapp_enabled").notNull().default(false),
    reminderType: (0, pg_core_1.text)("reminder_type").notNull().default("renewal"), // renewal, monthly_recurring
    monthlyDay: (0, pg_core_1.integer)("monthly_day"), // for monthly recurring reminders (1-31)
});
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({
    id: true,
    lastLogin: true,
});
exports.insertSubscriptionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.subscriptions).omit({
    id: true,
    createdAt: true,
}).extend({
    amount: zod_1.z.number(),
    startDate: zod_1.z.preprocess((val) => new Date(val), zod_1.z.date()),
    nextRenewal: zod_1.z.preprocess((val) => new Date(val), zod_1.z.date()),
});
exports.insertReminderSchema = (0, drizzle_zod_1.createInsertSchema)(exports.reminders).omit({
    id: true,
});
