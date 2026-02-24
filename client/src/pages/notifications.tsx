import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { ComplianceItem } from "@shared/types";
import { format, isValid as isValidDateFns, parse, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import type { Subscription } from "@shared/types";

type NotificationItem = {
	id?: string;
	type: 'subscription' | 'compliance' | 'license';
	eventType?: 'created' | 'deleted' | 'updated' | 'reminder' | 'payment_method_expiring';
	recipientRole?: string;
	recipientDepartments?: string[];
	filingName?: string;
	complianceName?: string;
	name?: string;
	category?: string;
	complianceCategory?: string;
	subscriptionName?: string;
	reminderTriggerDate?: string;
	createdAt?: string;
	timestamp?: string;
	complianceId?: string;
	subscriptionId?: string;
	licenseId?: string;
	licenseName?: string;
	submissionDeadline?: string;
	subscriptionEndDate?: string;
	[key: string]: any;
};

export default function Notifications() {
// State to force daily refresh
const [, setToday] = useState(new Date());
const [, setLocation] = useLocation();
const [notificationType, setNotificationType] = useState<'subscription' | 'compliance' | 'license'>('subscription');
const [, setExpandedNotificationId] = useState<string | null>(null);
const queryClient = useQueryClient();

useEffect(() => {
const timer = setInterval(() => {
setToday(new Date());
}, 1000 * 60 * 60); // Refresh every hour (can change to 24h for production)
return () => clearInterval(timer);
}, []);

const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
const [selectedCompliance, setSelectedCompliance] = useState<ComplianceItem | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);
// Track modal close to trigger notifications refetch
const [modalJustClosed, setModalJustClosed] = useState(false);

const { data: notifications = [], isLoading, refetch } = useQuery<NotificationItem[]>({
queryKey: [
	notificationType === 'subscription'
		? '/api/notifications'
		: notificationType === 'compliance'
			? '/api/notifications/compliance'
			: '/api/notifications/license'
],
});

const { data: subscriptions = [], refetch: refetchSubscriptions } = useQuery<Subscription[]>({
queryKey: ['/api/subscriptions'],
});

const { data: complianceItems = [], refetch: refetchCompliance } = useQuery<ComplianceItem[]>({
queryKey: ['/api/compliance/list'],
});

// Refresh data when notification type changes
useEffect(() => {
// Invalidate cache for the new query
queryClient.invalidateQueries({ 
	queryKey: [
		notificationType === 'subscription'
			? '/api/notifications'
			: notificationType === 'compliance'
				? '/api/notifications/compliance'
				: '/api/notifications/license'
	]
});
refetch();
refetchSubscriptions();
refetchCompliance();
setExpandedNotificationId(null); // Collapse any expanded notification
}, [notificationType, refetch, refetchSubscriptions, refetchCompliance, queryClient]);

// Auto-refresh when coming back to the page
useEffect(() => {
const handleVisibilityChange = () => {
  if (!document.hidden) {
    refetch();
    refetchSubscriptions();
    refetchCompliance();
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);
return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [refetch, refetchSubscriptions, refetchCompliance]);

// Filter notifications based on the selected status
const todayDate = new Date();
const filteredNotifications = notifications.filter(n => {
	// For event-based notifications (created/deleted/updated), show all
	if (n.eventType === 'created' || n.eventType === 'deleted' || n.eventType === 'updated') return true;
	// For reminder-based notifications, show only when due
	if (!n.reminderTriggerDate) return true;
	const triggerDate = new Date(n.reminderTriggerDate);
	return triggerDate <= todayDate;
});

const dateOnly = (raw: any): string => {
	if (!raw) return '';
	if (raw instanceof Date) return raw.toISOString().slice(0, 10);
	const s = String(raw).trim();
	if (!s) return '';
	return s.length >= 10 ? s.slice(0, 10) : '';
};

const notificationDedupeKey = (n: NotificationItem): string => {
	const type = String(n.type || '').trim().toLowerCase();
	const entityId = String(n.subscriptionId || n.complianceId || n.licenseId || n.id || '').trim().toLowerCase();
	if (!type || !entityId) return '';

	const eventType = String(n.eventType || '').trim().toLowerCase();
	const lifecycle = String((n as any).lifecycleEventType || '').trim().toLowerCase();
	const hasReminderSignals = Boolean(
		n.reminderTriggerDate || (n as any).reminderDate || (n as any).reminderType || (n as any).reminderDays || n.submissionDeadline || n.subscriptionEndDate
	);
	const kind = eventType || (lifecycle ? 'updated' : (hasReminderSignals ? 'reminder' : ''));

	const parts: string[] = [type, entityId, kind];
	if (kind === 'updated' && lifecycle) {
		parts.push(lifecycle);
		parts.push(dateOnly(n.timestamp || n.createdAt));
	}
	if (kind === 'reminder' || (hasReminderSignals && !eventType)) {
		parts.push(String((n as any).reminderType || (n as any).reminderPolicy || '').trim().toLowerCase());
		parts.push(String((n as any).reminderDays || '').trim().toLowerCase());
		parts.push(dateOnly(n.reminderTriggerDate || (n as any).reminderDate || n.timestamp || n.createdAt));
		parts.push(dateOnly(n.submissionDeadline || n.subscriptionEndDate));
	}

	return parts.join('|');
};

const dedupedNotifications = (() => {
	const score = (n: NotificationItem): number => {
		let s = 0;
		if ((n as any).recipientRole) s += 2;
		if (Array.isArray((n as any).recipientDepartments) && (n as any).recipientDepartments.length) s += 1;
		if ((n as any).message) s += 1;
		if (n.reminderTriggerDate) s += 1;
		if (n.filingName || n.subscriptionName || n.licenseName) s += 1;
		if ((n as any).lifecycleEventType) s += 1;
		return s;
	};

	const pickBetter = (a: NotificationItem, b: NotificationItem): NotificationItem => {
		const sa = score(a);
		const sb = score(b);
		if (sa !== sb) return sa > sb ? a : b;
		const ta = toEpochMs(a.timestamp || a.createdAt || a.reminderTriggerDate);
		const tb = toEpochMs(b.timestamp || b.createdAt || b.reminderTriggerDate);
		return tb > ta ? b : a;
	};

	const map = new Map<string, NotificationItem>();
	for (const n of filteredNotifications) {
		const key = notificationDedupeKey(n) || String(n.id || '');
		if (!key) continue;
		const existing = map.get(key);
		map.set(key, existing ? pickBetter(existing, n) : n);
	}
	return Array.from(map.values());
})();

function toEpochMs(raw: any): number {
	if (!raw) return 0;
	const value = String(raw).trim();
	let parsedDate: Date;

	// ISO strings and most server timestamps
	if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
		parsedDate = parseISO(value);
		return isValidDateFns(parsedDate) ? parsedDate.getTime() : 0;
	}

	// Date-only values
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		parsedDate = parse(value, 'yyyy-MM-dd', new Date());
		return isValidDateFns(parsedDate) ? parsedDate.getTime() : 0;
	}
	if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
		parsedDate = parse(value, 'dd-MM-yyyy', new Date());
		return isValidDateFns(parsedDate) ? parsedDate.getTime() : 0;
	}

	// Last resort
	parsedDate = new Date(value);
	return isValidDateFns(parsedDate) ? parsedDate.getTime() : 0;
};

const handleViewSubscription = async (subscriptionId: string | number) => {
// Convert to string for backend lookup
const idStr = String(subscriptionId);
try {
const res = await apiRequest('GET', `/api/subscriptions/${idStr}`);
const latestSubscription = await res.json();
if (latestSubscription && (String(latestSubscription.id) === idStr || String((latestSubscription as any)._id ?? '') === idStr)) {
setSelectedSubscription(latestSubscription);
setIsModalOpen(true);
return;
}
} catch {}
// fallback to cached
const subscription = subscriptions.find(sub => String(sub.id) === idStr || String((sub as any)._id ?? '') === idStr);
if (subscription) {
setSelectedSubscription(subscription);
setIsModalOpen(true);
}
};
const handleViewCompliance = async (complianceId: string | number) => {
// Convert to string for backend lookup
const idStr = String(complianceId);
try {
const res = await apiRequest('GET', `/api/compliance/list`);
const allCompliance = await res.json();
const complianceItem = allCompliance.find((item: ComplianceItem) => 
	String(item.id) === idStr || String(item._id ?? '') === idStr
);
if (complianceItem) {
setSelectedCompliance(complianceItem);
setIsModalOpen(true);
return;
}
} catch {}
// fallback to cached
const complianceItem = complianceItems.find(item => 
String(item.id) === idStr || String(item._id ?? '') === idStr
);
if (complianceItem) {
setSelectedCompliance(complianceItem);
setIsModalOpen(true);
}
};

if (isLoading) {
return (
<div className="p-6">
<div className="flex items-center gap-2 mb-6">
<Bell className="h-6 w-6" />
<h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
</div>
<div className="animate-pulse space-y-4">
{[...Array(3)].map((_, i) => (
<div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
))}
</div>
</div>
);
}
return (
<div className="p-6 max-w-7xl mx-auto">
	<div className="flex items-center justify-between mb-6">
		<div className="flex items-center gap-3">
			<h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
			<span className="text-lg text-gray-500 font-normal">{filteredNotifications.length} Active</span>
		</div>
		<div className="flex gap-3 items-center">
			<Button 
				variant={notificationType === 'subscription' ? "default" : "outline"} 
				className={`px-5 py-2.5 h-10 font-medium rounded-lg transition-colors ${
					notificationType === 'subscription' 
						? 'bg-blue-600 hover:bg-blue-700 text-white' 
						: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
				}`}
				onClick={() => setNotificationType('subscription')}
			>
				Subscription Notification
			</Button>
			<Button 
				variant={notificationType === 'compliance' ? "default" : "outline"} 
				className={`px-5 py-2.5 h-10 font-medium rounded-lg transition-colors ${
					notificationType === 'compliance' 
						? 'bg-blue-600 hover:bg-blue-700 text-white' 
						: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
				}`}
				onClick={() => setNotificationType('compliance')}
			>
				Compliance Notification
			</Button>
			<Button 
				variant={notificationType === 'license' ? "default" : "outline"} 
				className={`px-5 py-2.5 h-10 font-medium rounded-lg transition-colors ${
					notificationType === 'license' 
						? 'bg-blue-600 hover:bg-blue-700 text-white' 
						: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
				}`}
				onClick={() => setNotificationType('license')}
			>
				Renewal Notification
			</Button>
		</div>
	</div>
{filteredNotifications.length === 0 ? (
<Card>
<CardContent className="flex flex-col items-center justify-center py-12">
<Bell className="h-12 w-12 text-gray-400 mb-4" />
<h3 className="text-base font-medium text-gray-900 mb-2">
{notificationType === 'subscription'
	? 'No Active Subscription Notifications'
	: notificationType === 'compliance'
		? 'No Active Compliance Notifications'
		: 'No Active Renewal Notifications'}
</h3>
<p className="text-gray-500 text-center">
{notificationType === 'subscription'
	? 'No active subscription notifications. Notifications will appear here based on your subscription reminder settings.'
	: notificationType === 'compliance'
		? 'No active compliance notifications. Deadline reminders will appear here when submission deadlines approach.'
		: 'No active renewal notifications. License-related notifications will appear here.'}
</p>
</CardContent>
</Card>
) : (
<>
<div className="space-y-3">
{[...dedupedNotifications]
.sort((a, b) => {
// Sort newest first using time-aware fields first.
// reminderTriggerDate is date-only, so it should be a fallback.
const rawA = a.timestamp || a.createdAt || a.reminderTriggerDate;
const rawB = b.timestamp || b.createdAt || b.reminderTriggerDate;
return toEpochMs(rawB) - toEpochMs(rawA);
})
.map((notification) => {
return (
				<div 
					key={
						String(
							notification.id ||
							(notification as any)._id ||
							`${notification.type}-${notification.eventType || 'reminder'}-${notification.complianceId || notification.subscriptionId || 'unknown'}-${notification.timestamp || notification.createdAt || notification.reminderTriggerDate || ''}`
						)
					}
					className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
				>
	<div className="flex items-center justify-between">
		<div className="flex items-center gap-4 flex-1">
			<div className="p-2.5 bg-orange-50 rounded-lg flex-shrink-0">
				<Bell className="h-5 w-5 text-orange-500" />
			</div>
			<div className="flex-1 min-w-0">
 								<h3 className="text-base font-semibold text-gray-900 mb-1.5 truncate">
	 								{notification.type === 'compliance'
	 									? (
	 										notification.filingName
	 										|| (() => {
	 											const compliance = complianceItems.find(item =>
	 												String(item.id) === String(notification.complianceId) || String(item._id) === String(notification.complianceId)
	 											);
	 											return compliance?.filingName || compliance?.policy || 'Compliance Filing';
	 										})()
	 									)
	 									: notification.type === 'license'
	 										? (notification.licenseName || 'License')
	 										: (() => {
	 											const subscription = subscriptions.find(sub => 
	 												String(sub.id) === String(notification.subscriptionId) || 
	 												String((sub as any)._id) === String(notification.subscriptionId)
	 											);
	 											return subscription?.serviceName || notification.subscriptionName || 'Unknown Subscription';
	 										})()}
 								</h3>
				<div className="flex items-center gap-2 flex-wrap">
								{/* Category text */}
								<span className="text-sm text-gray-600">
	 												{notification.type === 'compliance'
	 													? (notification.complianceCategory || notification.category || notification.filingName || notification.complianceName || notification.name || 'Compliance')
	 													: notification.type === 'license'
	 														? (notification.category || 'License')
	 														: (notification.category || 'Subscription')}
								</span>
								<span className="text-gray-400">•</span>
								
								{/* Reminder/Event badge */}
								<Badge className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
									notification.eventType === 'created' ? 'bg-green-600 text-white hover:bg-green-600' :
									notification.eventType === 'deleted' ? 'bg-red-600 text-white hover:bg-red-600' :
									notification.eventType === 'updated' ? (() => {
										const lifecycle = String((notification as any).lifecycleEventType || '').toLowerCase();
										if (notification.type === 'compliance' && lifecycle === 'submitted') {
											return 'bg-emerald-600 text-white hover:bg-emerald-600';
										}
										return 'bg-purple-600 text-white hover:bg-purple-600';
									})() :
									notification.eventType === 'payment_method_expiring' ? 'bg-orange-600 text-white hover:bg-orange-600' :
									'bg-blue-600 text-white hover:bg-blue-600'
								}`}>
									{(() => {
										// Handle event-based notifications
										if (notification.eventType === 'created') {
														if (notification.type === 'compliance') return 'Compliance Created';
														if (notification.type === 'license') return 'License Created';
														return 'Subscription Created';
										}
										if (notification.eventType === 'deleted') {
														if (notification.type === 'compliance') return 'Compliance Deleted';
														if (notification.type === 'license') return 'License Deleted';
														return 'Subscription Deleted';
										}

										if (notification.eventType === 'payment_method_expiring') {
											return 'Payment Method Expiring';
										}

										// Handle lifecycle updates (for both subscription and compliance)
										if (notification.eventType === 'updated') {
											const lifecycle = String((notification as any).lifecycleEventType || '').toLowerCase();
											
											// Compliance lifecycle events
											if (notification.type === 'compliance') {
												switch (lifecycle) {
													case 'owner_changed':
														return 'Owner Changed';
													case 'submitted':
														return 'Submitted';
													default:
														return 'Compliance Updated';
												}
											}

											// License lifecycle events
											if (notification.type === 'license') {
												switch (lifecycle) {
													case 'department_changed':
														return 'Department Changed';
													case 'responsible_person_changed':
														return 'Responsible Person Changed';
													case 'secondary_person_changed':
														return 'Secondary Person Changed';
													default:
														return 'License Updated';
												}
											}
											
											// Subscription lifecycle events
											switch (lifecycle) {
												case 'owner_changed':
													return 'Owner Changed';
												case 'price_changed':
													return 'Price Changed';
												case 'quantity_changed':
													return 'Quantity Changed';
												case 'cancelled':
													return 'Subscription Cancelled';
												default:
													return 'Subscription Updated';
											}
										}
										
										// Handle reminder-based notifications - simplified to always show "One-time reminder"
										if (notification.type === 'compliance') {
											let reminderDays = Number((notification as any).reminderDays || 0);
											
											if (reminderDays === 0) {
												const compliance = complianceItems.find(ci => 
													String(ci.id) === String(notification.complianceId) || 
													String(ci._id) === String(notification.complianceId)
												);
												reminderDays = Number(compliance?.reminderDays || 0);
											}
											
											if (reminderDays > 0) {
												return `One-time reminder (${reminderDays} days before)`;
											} else {
												return `Reminder`;
											}
													} else if (notification.type === 'license') {
														let reminderDays = Number((notification as any).reminderDays || 0);
														const policy = String((notification as any).reminderPolicy || '').trim();
														if (policy === 'Until Renewal') return 'Daily reminder';
														if (reminderDays > 0) return `One-time reminder (${reminderDays} days before)`;
														return 'Reminder';
													} else {
											const subscription = subscriptions.find(sub => 
												String(sub.id) === String(notification.subscriptionId) || 
												String((sub as any)._id) === String(notification.subscriptionId)
											);
											const reminderDays = Number(subscription?.reminderDays || 0);
											
											if (reminderDays > 0) {
												return `One-time reminder (${reminderDays} days before)`;
											} else {
												return `Reminder`;
											}
										}
									})()}
									</Badge>
									{/* Removed department head reason text as requested */}
				</div>
			</div>
		</div>
		<Button
			variant="outline"
			size="sm"
			onClick={(e) => {
				e.stopPropagation();
				if (notification.eventType === 'payment_method_expiring') {
					setLocation('/configuration');
					return;
				}
				if (notification.type === 'license') {
					setLocation('/government-license');
					return;
				}
				if (notification.type === 'compliance') {
					handleViewCompliance(notification.complianceId ?? '');
				} else {
					handleViewSubscription(notification.subscriptionId ?? '');
				}
			}}
			className="flex items-center gap-2 text-sm px-4 py-2 h-9 flex-shrink-0"
		>
			<Eye className="h-4 w-4" />
			{notification.eventType === 'payment_method_expiring' ? 'Open Config' : 'View'}
		</Button>
	</div>
</div>
);})}
</div>
</>
)}
{selectedSubscription && (
<SubscriptionModal
open={isModalOpen && notificationType === 'subscription'}
onOpenChange={(open) => {
setIsModalOpen(open);
if (!open) {
setModalJustClosed(true);
setSelectedSubscription(null);
}
}}
subscription={selectedSubscription ? {
...selectedSubscription,
amount: String(selectedSubscription.amount),
startDate: new Date(selectedSubscription.startDate),
nextRenewal: new Date(selectedSubscription.nextRenewal),
createdAt: selectedSubscription.createdAt ? new Date(selectedSubscription.createdAt) : undefined
} : undefined}
/>
)}

{selectedCompliance && notificationType === 'compliance' && (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
<div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
<h2 className="text-xl font-bold mb-4">Compliance Filing Details</h2>
<div className="space-y-3">
<div><strong>Filing Name:</strong> {selectedCompliance.filingName}</div>
<div><strong>Category:</strong> {selectedCompliance.complianceCategory}</div>
<div><strong>Authority:</strong> {selectedCompliance.governingAuthority}</div>
<div><strong>Frequency:</strong> {selectedCompliance.filingFrequency}</div>
<div><strong>Submission Deadline:</strong> {format(new Date(selectedCompliance.submissionDeadline), 'MMM dd, yyyy')}</div>
<div><strong>Status:</strong> {selectedCompliance.status}</div>
{selectedCompliance.remarks && <div><strong>Remarks:</strong> {selectedCompliance.remarks}</div>}
</div>
<div className="flex justify-end mt-6">
<Button onClick={() => {
setIsModalOpen(false);
setSelectedCompliance(null);
}}>
Close
</Button>
</div>
</div>
</div>
)}

{/* Refetch notifications and subscriptions instantly after modal closes */}
{modalJustClosed && (() => {
setModalJustClosed(false);
refetch();
refetchSubscriptions();
if (notificationType === 'compliance') {
refetchCompliance();
}
return null;
})()}
</div>
);
}

