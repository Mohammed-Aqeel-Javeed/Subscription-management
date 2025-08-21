// Types for frontend usage only. No drizzle-orm or Node.js-only imports.

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
};

export type RecentActivity = {
  id: string;
  action: string;
  timestamp: string;
};

export type NotificationItem = {
  id: string;
  message: string;
  read: boolean;
  timestamp: string;
  reminderTriggerDate?: string;
  subscriptionName?: string;
  category?: string;
  subscriptionId?: string;
  subscriptionEndDate?: string;
};

export type Subscription = {
  id: string;
  _id?: string;
  tenantId: string;
  serviceName: string;
  vendor: string;
  amount: number;
  billingCycle: string;
  category: string;
  startDate: string;
  nextRenewal: string;
  status: string;
  reminderDays: number;
  reminderPolicy: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedBy?: string;
};

export type Reminder = {
  id: string;
  tenantId: string;
  subscriptionId: string;
  alertDays: number;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  reminderType: string;
  monthlyDay?: number;
};

export type User = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin?: string;
};
