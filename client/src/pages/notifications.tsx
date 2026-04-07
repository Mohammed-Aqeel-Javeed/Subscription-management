import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Eye, Search, Trash2, CheckSquare, Square } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { isValid as isValidDateFns, parse, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import type { Subscription, ComplianceItem } from "@shared/types";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
	licenseEndDate?: string;
	submissionDeadline?: string;
	subscriptionEndDate?: string;
	isRead?: boolean;
	[key: string]: any;
};

export default function Notifications() {
// State to force daily refresh
const [, setToday] = useState(new Date());
const { toast } = useToast();
const navigate = useNavigate();
const [notificationType, setNotificationType] = useState<'all' | 'subscription' | 'compliance' | 'license'>('all');
const [, setExpandedNotificationId] = useState<string | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
const queryClient = useQueryClient();

const getNotificationSelectionId = (n: NotificationItem): string => {
	return String(
		n.id ||
		(n as any)._id ||
		`${n.type}-${n.eventType || 'reminder'}-${n.complianceId || n.subscriptionId || n.licenseId || 'unknown'}-${n.timestamp || n.createdAt || n.reminderTriggerDate || ''}`
	);
};

useEffect(() => {
const timer = setInterval(() => {
setToday(new Date());
}, 1000 * 60 * 60); // Refresh every hour (can change to 24h for production)
return () => clearInterval(timer);
}, []);

const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);
const [modalJustClosed, setModalJustClosed] = useState(false);

const { data: subscriptionNotifications = [], isLoading: isLoadingSubscription, refetch: refetchSubscription } = useQuery<NotificationItem[]>({
	queryKey: ['/api/notifications'],
	enabled: notificationType === 'all' || notificationType === 'subscription',
});

const { data: complianceNotifications = [], isLoading: isLoadingCompliance, refetch: refetchComplianceNotif } = useQuery<NotificationItem[]>({
	queryKey: ['/api/notifications/compliance'],
	enabled: notificationType === 'all' || notificationType === 'compliance',
});

const { data: licenseNotifications = [], isLoading: isLoadingLicense, refetch: refetchLicense } = useQuery<NotificationItem[]>({
	queryKey: ['/api/notifications/license'],
	enabled: notificationType === 'all' || notificationType === 'license',
});

// Combine notifications based on selected type
const notifications = notificationType === 'all' 
	? [...subscriptionNotifications, ...complianceNotifications, ...licenseNotifications]
	: notificationType === 'subscription'
		? subscriptionNotifications
		: notificationType === 'compliance'
			? complianceNotifications
			: licenseNotifications;

const isLoading = isLoadingSubscription || isLoadingCompliance || isLoadingLicense;

const { data: subscriptions = [], refetch: refetchSubscriptions } = useQuery<Subscription[]>({
queryKey: ['/api/subscriptions'],
});

const { data: complianceItems = [], refetch: refetchCompliance } = useQuery<ComplianceItem[]>({
queryKey: ['/api/compliance/list'],
});

// Refresh data when notification type changes
useEffect(() => {
	// Invalidate cache for relevant queries
	if (notificationType === 'all') {
		queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
		queryClient.invalidateQueries({ queryKey: ['/api/notifications/compliance'] });
		queryClient.invalidateQueries({ queryKey: ['/api/notifications/license'] });
	} else if (notificationType === 'subscription') {
		queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
	} else if (notificationType === 'compliance') {
		queryClient.invalidateQueries({ queryKey: ['/api/notifications/compliance'] });
	} else {
		queryClient.invalidateQueries({ queryKey: ['/api/notifications/license'] });
	}
	refetchSubscription();
	refetchComplianceNotif();
	refetchLicense();
	refetchSubscriptions();
	refetchCompliance();
	setExpandedNotificationId(null);
}, [notificationType, refetchSubscription, refetchComplianceNotif, refetchLicense, refetchSubscriptions, refetchCompliance, queryClient]);

// Auto-refresh when coming back to the page
useEffect(() => {
const handleVisibilityChange = () => {
  if (!document.hidden) {
    refetchSubscription();
    refetchComplianceNotif();
    refetchLicense();
    refetchSubscriptions();
    refetchCompliance();
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);
return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [refetchSubscription, refetchComplianceNotif, refetchLicense, refetchSubscriptions, refetchCompliance]);

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

// Apply search filter
const searchFilteredNotifications = dedupedNotifications.filter(notification => {
	if (!searchQuery.trim()) return true;
	
	const query = searchQuery.toLowerCase();
	const name = notification.subscriptionName || notification.filingName || notification.licenseName || notification.complianceName || '';
	const category = notification.category || notification.complianceCategory || '';
	const eventType = notification.eventType || '';
	
	return name.toLowerCase().includes(query) || 
	       category.toLowerCase().includes(query) ||
	       eventType.toLowerCase().includes(query);
});

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

const formatDueDate = (raw: any): string => {
	const ms = toEpochMs(raw);
	if (!ms) return '';
	const d = new Date(ms);
	if (!Number.isFinite(d.getTime())) return '';
	return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const handleViewSubscription = async (subscriptionId: string | number) => {
console.log('handleViewSubscription called with:', subscriptionId);
// Convert to string for backend lookup
const idStr = String(subscriptionId);
try {
const res = await apiRequest('GET', `/api/subscriptions/${idStr}`);
const latestSubscription = await res.json();
console.log('Fetched subscription:', latestSubscription);
if (latestSubscription && (String(latestSubscription.id) === idStr || String((latestSubscription as any)._id ?? '') === idStr)) {
setSelectedSubscription(latestSubscription);
setIsModalOpen(true);
return;
}
} catch (error) {
console.error('Error fetching subscription:', error);
}
// fallback to cached
const subscription = subscriptions.find(sub => String(sub.id) === idStr || String((sub as any)._id ?? '') === idStr);
console.log('Fallback subscription:', subscription);
if (subscription) {
setSelectedSubscription(subscription);
setIsModalOpen(true);
}
};
const handleViewCompliance = async (complianceId: string | number) => {
	console.log('handleViewCompliance called with:', complianceId);
	// Store the compliance ID so the compliance page can auto-open the modal
	localStorage.setItem('openComplianceId', String(complianceId));
	// Navigate to compliance page
	navigate('/compliance');
};

const handleViewLicense = async (licenseId: string | number) => {
	console.log('handleViewLicense called with:', licenseId);
	// Store the license ID so the license page can auto-open the modal
	localStorage.setItem('openLicenseId', String(licenseId));
	// Navigate to license page
	navigate('/government-license');
};

const handleMarkAsRead = async () => {
	if (selectedNotifications.size === 0) return;
	
	try {
		// Get the actual notification IDs from the selected notifications
		const notificationIds = Array.from(selectedNotifications).map(selectionId => {
			// Find the notification by selection ID
			const notification = searchFilteredNotifications.find(n => getNotificationSelectionId(n) === selectionId);
			if (!notification) return null;
			
			// Try to get the actual MongoDB _id
			const actualId = (notification as any)._id || notification.id;
			console.log('Notification:', notification.subscriptionName || notification.filingName || notification.licenseName, 'ID:', actualId);
			return actualId;
		}).filter(Boolean);

		console.log('Marking as read - IDs:', notificationIds);

		const res = await apiRequest('POST', '/api/notifications/mark-read', {
			notificationIds
		});

		const result = await res.json();
		console.log('Mark as read response:', result);
		console.log('Full response details:', {
			ok: res.ok,
			status: res.status,
			modifiedCount: result.modifiedCount,
			message: result.message
		});

		if (res.ok) {
			// Force refetch all notification queries
			await Promise.all([
				refetchSubscription(),
				refetchComplianceNotif(),
				refetchLicense()
			]);
			
			// Clear selection
			setSelectedNotifications(new Set());
			
			toast({
				title: "Marked as read",
				description: result.message || `${notificationIds.length} notification(s) marked as read`,
				variant: "success",
			});
		} else {
			throw new Error(result.message || 'Failed to mark as read');
		}
	} catch (error) {
		console.error('Error marking notifications as read:', error);
		toast({
			title: "Error",
			description: error instanceof Error ? error.message : "Failed to mark notifications as read",
			variant: "destructive",
		});
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
	{/* Header */}
	<div className="flex items-center mb-6 bg-gray-50 p-4 rounded-lg">
		<div className="flex items-center gap-3">
			<div className="p-2 bg-blue-100 rounded-lg">
				<Bell className="h-5 w-5 text-blue-600" />
			</div>
			<div>
				<h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
				<p className="text-sm text-gray-500">{searchFilteredNotifications.filter(n => !Boolean((n as any).isRead ?? (n as any).read ?? false)).length} unread · {searchFilteredNotifications.length} total</p>
			</div>
		</div>
	</div>

	{/* Search Bar and Filter Tabs in one line */}
	<div className="flex items-center gap-4 mb-4">
		<div className="relative flex-1">
			<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
			<Input
				type="text"
				placeholder="Search notifications..."
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				className="pl-10 h-10 bg-white border-gray-300"
			/>
		</div>
		<div className="flex gap-2">
			<Button 
				variant={notificationType === 'all' ? "default" : "outline"} 
				className={`px-4 py-2 h-10 text-sm font-medium rounded-lg transition-colors ${
					notificationType === 'all'
						? 'bg-blue-600 hover:bg-blue-700 text-white' 
						: 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
				}`}
				onClick={() => setNotificationType('all' as any)}
			>
				All
			</Button>
			<Button 
				variant={notificationType === 'subscription' ? "default" : "outline"} 
				className={`px-4 py-2 h-10 text-sm font-medium rounded-lg transition-colors ${
					notificationType === 'subscription' 
						? 'bg-blue-600 hover:bg-blue-700 text-white' 
						: 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
				}`}
				onClick={() => setNotificationType('subscription')}
			>
				Subscription
			</Button>
			<Button 
				variant={notificationType === 'compliance' ? "default" : "outline"} 
				className={`px-4 py-2 h-10 text-sm font-medium rounded-lg transition-colors ${
					notificationType === 'compliance' 
						? 'bg-blue-600 hover:bg-blue-700 text-white' 
						: 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
				}`}
				onClick={() => setNotificationType('compliance')}
			>
				Compliance
			</Button>
			<Button 
				variant={notificationType === 'license' ? "default" : "outline"} 
				className={`px-4 py-2 h-10 text-sm font-medium rounded-lg transition-colors ${
					notificationType === 'license' 
						? 'bg-blue-600 hover:bg-blue-700 text-white' 
						: 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300'
				}`}
				onClick={() => setNotificationType('license')}
			>
			Renewal
			</Button>
		</div>
	</div>

	{/* Action Bar */}
	{searchFilteredNotifications.length > 0 && (
		<div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						if (selectedNotifications.size === searchFilteredNotifications.length) {
							setSelectedNotifications(new Set());
						} else {
							const allIds = searchFilteredNotifications.map(getNotificationSelectionId);
							setSelectedNotifications(new Set(allIds));
						}
					}}
					className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 h-8 px-2"
				>
					{selectedNotifications.size === searchFilteredNotifications.length ? (
						<CheckSquare className="h-4 w-4" />
					) : (
						<Square className="h-4 w-4" />
					)}
					Select all
				</Button>
				{selectedNotifications.size > 0 && (
					<span className="text-sm text-gray-500">{selectedNotifications.size} selected</span>
				)}
			</div>
			{selectedNotifications.size > 0 && (
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleMarkAsRead}
						className="flex items-center gap-2 text-sm h-8 px-3 bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
					>
						<Eye className="h-4 w-4" />
						Mark as read
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowDeleteDialog(true)}
						className="flex items-center gap-2 text-sm h-8 px-3 bg-white hover:bg-red-50 text-red-600 border-red-300"
					>
						<Trash2 className="h-4 w-4" />
						Delete
					</Button>
				</div>
			)}
		</div>
	)}

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
<div className="space-y-2">
{[...searchFilteredNotifications]
.sort((a, b) => {
// Sort newest first using time-aware fields first.
// reminderTriggerDate is date-only, so it should be a fallback.
const rawA = a.timestamp || a.createdAt || a.reminderTriggerDate;
const rawB = b.timestamp || b.createdAt || b.reminderTriggerDate;
return toEpochMs(rawB) - toEpochMs(rawA);
})
.map((notification) => {
			const isUnread = !Boolean((notification as any).isRead ?? (notification as any).read ?? false);
const notificationId = getNotificationSelectionId(notification);
const isSelected = selectedNotifications.has(notificationId);

return (
				<div 
					key={notificationId}
					className={`border rounded-lg p-4 transition-colors ${
						isUnread 
							? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
							: 'bg-white border-gray-200 hover:bg-gray-50'
					}`}
				>
	<div className="flex items-center gap-3">
		{/* Checkbox */}
		<button
			onClick={() => {
				const newSelected = new Set(selectedNotifications);
				if (isSelected) {
					newSelected.delete(notificationId);
				} else {
					newSelected.add(notificationId);
				}
				setSelectedNotifications(newSelected);
			}}
			className="flex-shrink-0"
		>
			{isSelected ? (
				<CheckSquare className="h-5 w-5 text-blue-600" />
			) : (
				<Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
			)}
		</button>

		{/* Status indicator (unread dot) */}
		<div className={`w-2 h-2 rounded-full flex-shrink-0 ${isUnread ? 'bg-blue-600' : 'bg-transparent'}`}></div>

		{/* Icon */}
		<div className={`p-2 rounded-lg flex-shrink-0 ${
			notification.eventType === 'created' ? 'bg-blue-50' :
			notification.eventType === 'deleted' ? 'bg-red-50' :
			notification.eventType === 'updated' ? 'bg-purple-50' :
			notification.eventType === 'payment_method_expiring' ? 'bg-orange-50' :
			'bg-green-50'
		}`}>
			<Bell className={`h-4 w-4 ${
				notification.eventType === 'created' ? 'text-blue-600' :
				notification.eventType === 'deleted' ? 'text-red-600' :
				notification.eventType === 'updated' ? 'text-purple-600' :
				notification.eventType === 'payment_method_expiring' ? 'text-orange-600' :
				'text-green-600'
			}`} />
		</div>

		{/* Content */}
		<div className="flex-1 min-w-0">
			<div className="flex items-center gap-2 flex-wrap">
							<span className="font-semibold text-gray-900 text-sm">
								{(() => {
									let displayName = '';
									if (notification.type === 'compliance') {
										displayName =
											notification.filingName ||
											(() => {
												const compliance = complianceItems.find((item) =>
													String(item.id) === String(notification.complianceId) ||
													String((item as any)._id) === String(notification.complianceId)
												);
												return compliance?.filingName || compliance?.policy || 'Compliance Filing';
											})();
									} else if (notification.type === 'license') {
										displayName = notification.licenseName || 'License';
									} else {
										const subscription = subscriptions.find((sub) =>
											String(sub.id) === String(notification.subscriptionId) ||
											String((sub as any)._id) === String(notification.subscriptionId)
										);
										displayName = subscription?.serviceName || notification.subscriptionName || 'Unknown Subscription';
									}
									if (displayName.length > 30) {
										return displayName.substring(0, 27) + '...';
									}
									return displayName;
								})()}
							</span>
								<span className="text-gray-400">·</span>
								<span className="text-xs text-gray-500">
	 												{notification.type === 'compliance'
	 													? (notification.complianceCategory || notification.category || 'Compliance')
	 													: notification.type === 'license'
	 														? (notification.category || 'License')
	 														: (notification.category || 'Subscription')}
								</span>
								<Badge className={`text-xs font-medium px-2 py-0.5 rounded-md ${
									notification.eventType === 'created' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
									notification.eventType === 'deleted' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
									notification.eventType === 'updated' ? (() => {
										const lifecycle = String((notification as any).lifecycleEventType || '').toLowerCase();
										
										// Compliance lifecycle events
										if (notification.type === 'compliance') {
											if (lifecycle === 'submitted') return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
											if (lifecycle === 'owner_changed') return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
											return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
										}
										
										// License lifecycle events
										if (notification.type === 'license') {
											if (lifecycle === 'department_changed') return 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100';
											if (lifecycle === 'responsible_person_changed') return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100';
											if (lifecycle === 'secondary_person_changed') return 'bg-violet-100 text-violet-700 hover:bg-violet-100';
											return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
										}
										
										// Subscription lifecycle events
										if (lifecycle === 'owner_changed') return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
										if (lifecycle === 'price_changed') return 'bg-pink-100 text-pink-700 hover:bg-pink-100';
										if (lifecycle === 'quantity_changed') return 'bg-teal-100 text-teal-700 hover:bg-teal-100';
										if (lifecycle === 'cancelled') return 'bg-red-100 text-red-700 hover:bg-red-100';
										
										return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
									})() :
									notification.eventType === 'payment_method_expiring' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' :
									'bg-green-100 text-green-700 hover:bg-green-100'
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
										
										// Handle reminder-based notifications
										if (notification.type === 'compliance') {
											const compliance = complianceItems.find(ci =>
												String(ci.id) === String(notification.complianceId) ||
												String(ci._id) === String(notification.complianceId)
											);
											const dueText = formatDueDate((notification as any).submissionDeadline || (compliance as any)?.submissionDeadline);
											return dueText ? `Submission (Due: ${dueText})` : 'Submission';
														} else if (notification.type === 'license') {
															const dueText = formatDueDate((notification as any).licenseEndDate || (notification as any).endDate);
															return dueText ? `Renewal Reminder (Due: ${dueText})` : 'Renewal Reminder';
														} else {
											const subscription = subscriptions.find(sub => 
												String(sub.id) === String(notification.subscriptionId) || 
												String((sub as any)._id) === String(notification.subscriptionId)
											);
										const dueText = formatDueDate((subscription as any)?.nextRenewal || (notification as any).subscriptionEndDate);
										return dueText ? `Renewal Reminder (Due: ${dueText})` : 'Renewal Reminder';
										}
									})()}
									</Badge>
			</div>
		</div>

		{/* Time and View button */}
		<div className="flex items-center gap-3 flex-shrink-0">
			<span className="text-xs text-gray-400">
				{(() => {
					const timestamp = notification.timestamp || notification.createdAt || notification.reminderTriggerDate;
					if (!timestamp) return '';
					const date = new Date(timestamp);
					const now = new Date();
					const diffMs = now.getTime() - date.getTime();
					const diffMins = Math.floor(diffMs / 60000);
					const diffHours = Math.floor(diffMs / 3600000);
					const diffDays = Math.floor(diffMs / 86400000);
					
					if (diffMins < 1) return 'Just now';
					if (diffMins < 60) return `${diffMins} min ago`;
					if (diffHours < 24) return `${diffHours} hr ago`;
					return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
				})()}
			</span>
			<Button
				variant="ghost"
				size="sm"
				onClick={(e) => {
					e.stopPropagation();
					// Handle payment method expiring - navigate to configuration
					if (notification.eventType === 'payment_method_expiring') {
						// Store payment ID to auto-open edit modal
						const paymentId = (notification as any).paymentId;
						if (paymentId) {
							localStorage.setItem('openPaymentId', String(paymentId));
						}
						localStorage.setItem('openPaymentMethods', 'true');
						navigate('/configuration');
						return;
					}
					// Handle different notification types
					if (notification.type === 'license') {
						handleViewLicense(notification.licenseId ?? '');
					} else if (notification.type === 'compliance') {
						handleViewCompliance(notification.complianceId ?? '');
					} else {
						handleViewSubscription(notification.subscriptionId ?? '');
					}
				}}
				className="h-8 w-8 p-0 hover:bg-gray-100"
			>
				<Eye className="h-4 w-4 text-gray-500" />
			</Button>
		</div>
	</div>
</div>
);})}
</div>
</>
)}
{selectedSubscription && (
<SubscriptionModal
open={isModalOpen && selectedSubscription !== null}
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

{/* Refetch notifications and subscriptions instantly after modal closes */}
{modalJustClosed && (() => {
setModalJustClosed(false);
refetchSubscription();
refetchComplianceNotif();
refetchLicense();
refetchSubscriptions();
refetchCompliance();
return null;
})()}

{/* Delete Confirmation Dialog */}
<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
	<AlertDialogContent className="bg-white">
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Notifications</AlertDialogTitle>
			<AlertDialogDescription>
				Are you sure you want to delete {selectedNotifications.size} selected notification{selectedNotifications.size > 1 ? 's' : ''}? This action cannot be undone.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<AlertDialogAction
				disabled={isDeleting}
				onClick={async () => {
					if (selectedNotifications.size === 0) {
						setShowDeleteDialog(false);
						return;
					}

					// Use the same list the UI renders (deduped + search filtered)
					const selectedItems = searchFilteredNotifications.filter((n) =>
						selectedNotifications.has(getNotificationSelectionId(n))
					);

					setIsDeleting(true);
					try {
						await apiRequest('POST', '/api/notifications/bulk-delete', {
							notifications: selectedItems.map((n) => ({
								id: String(n.id || (n as any)._id || ''),
								dismissKey: notificationDedupeKey(n),
								type: n.type,
								eventType: n.eventType,
								subscriptionId: n.subscriptionId,
								complianceId: n.complianceId,
								reminderTriggerDate: n.reminderTriggerDate,
							})),
						});

						setSelectedNotifications(new Set());
						setShowDeleteDialog(false);

						queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
						queryClient.invalidateQueries({ queryKey: ['/api/notifications/compliance'] });
						queryClient.invalidateQueries({ queryKey: ['/api/notifications/license'] });
						refetchSubscription();
						refetchComplianceNotif();
						refetchLicense();
					} catch (e) {
						console.error('Failed to delete notifications', e);
					} finally {
						setIsDeleting(false);
					}
				}}
				className="bg-red-600 hover:bg-red-700 text-white"
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
</div>
);
}

