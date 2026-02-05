// Types for frontend usage only, no backend imports
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
	// Compliance notification fields
	complianceId?: string;
	filingName?: string;
	complianceCategory?: string;
	submissionDeadline?: string;
	type?: 'subscription' | 'compliance';
	// Event tracking fields
	eventType?: 'created' | 'deleted' | 'updated' | 'reminder' | 'payment_method_expiring';
	createdAt?: string;
};

export type ComplianceItem = {
		id?: string;
		_id?: string;
		tenantId: string;
		filingName: string;
		policy?: string;
		filingFrequency: string;
		complianceCategory: string;
		governingAuthority: string;
		startDate?: string;
		endDate?: string;
		submissionDeadline: string;
		submissionDate?: string;
		status: string;
		reminderPolicy?: string;
		reminderDays?: number;
		remarks?: string;
		isActive?: boolean;
		createdAt?: string;
};

export type Subscription = {
		id: string;
		_id?: string;
		tenantId: string;
	serviceName: string;
	vendor: string;
	amount: number | string;
	billingCycle: string;
	category: string;
	paymentMethod?: string;
	startDate: string;
	nextRenewal: string;
	status: string;
	reminderDays: number;
	reminderPolicy: string;
	notes?: string;
	isActive: boolean;
	createdAt: string;
	updatedBy?: string;
	department?: string;
};

export type InsertSubscription = Omit<Subscription, 'id' | 'createdAt'>;
export type User = {
	id: string;
	_id?: string;
	tenantId: string;
	name: string;
	email: string;
	role: string;
	status: string;
	lastLogin?: string;
	department?: string;
};

export type Company = {
	tenantId: string;
	companyName: string;
	isActive: boolean;
};
export type InsertUser = Omit<User, 'id' | 'lastLogin'>;
export type Reminder = {
	id: number;
	_id?: string;
	tenantId: string;
	subscriptionId: string;
	alertDays: number;
	emailEnabled: boolean;
	whatsappEnabled: boolean;
	reminderType: string;
	monthlyDay?: number;
};
export type InsertReminder = Omit<Reminder, 'id'>;

// Company Information type
export type CompanyInfo = {
	id?: string;
	_id?: string;
	tenantId: string;
	companyName: string;
	companyLogo?: string;
	// Default currency code for this tenant (e.g., "USD", "INR")
	defaultCurrency?: string;
	address: string;
	country: string;
	financialYearEnd: string;
	createdAt?: string;
	updatedAt?: string;
};

export type InsertCompanyInfo = Omit<CompanyInfo, 'id' | 'createdAt' | 'updatedAt'>;
