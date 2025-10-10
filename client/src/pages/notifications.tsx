// Helper to check if a date string is valid
function isValidDate(date: any) {
if (!date) return false;
const d = new Date(date);
return d instanceof Date && !isNaN(d.getTime());
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Eye, Calendar, Clock, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
type NotificationItem = {
	id?: string;
	type: 'subscription' | 'compliance';
	eventType?: 'created' | 'deleted' | 'updated';
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
	submissionDeadline?: string;
	subscriptionEndDate?: string;
	[key: string]: any;
};
import type { ComplianceItem } from "@shared/types";
import { format, subDays } from "date-fns";
import { useState, useEffect } from "react";
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import type { Subscription } from "@shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export default function Notifications() {
// State to force daily refresh
const [today, setToday] = useState(new Date());
const [notificationType, setNotificationType] = useState<'subscription' | 'compliance'>('subscription');
const [statusFilter, setStatusFilter] = useState<string>('all');
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

const { data: notifications = [], isLoading, refetch, error } = useQuery<NotificationItem[]>({
queryKey: [notificationType === 'subscription' ? '/api/notifications' : '/api/notifications/compliance'],
refetchInterval: 5000, // Refresh every 5 seconds for automatic updates
});

// Debug logging
console.log('Notifications query status:', { 
  isLoading, 
  error, 
  notifications: notifications?.length || 0,
  notificationsData: notifications,
  notificationType
});
const { data: subscriptions = [], refetch: refetchSubscriptions } = useQuery<Subscription[]>({
queryKey: ['/api/subscriptions'],
});

const { data: complianceItems = [], refetch: refetchCompliance } = useQuery<ComplianceItem[]>({
queryKey: ['/api/compliance/list'],
});

// Refresh data when notification type changes
useEffect(() => {
refetch();
refetchSubscriptions();
refetchCompliance();
}, [notificationType, refetch, refetchSubscriptions, refetchCompliance]);

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
const getFilteredNotifications = () => {
    if (statusFilter === 'all') {
        return notifications.filter(n => {
            // For event-based notifications, show all
            if (n.eventType === 'created' || n.eventType === 'deleted') return true;
            // For reminder-based notifications, check trigger date
            if (!n.reminderTriggerDate) return true;
            const triggerDate = new Date(n.reminderTriggerDate);
            return triggerDate <= todayDate;
        });
    }
    
    // Handle specific filters
    if (statusFilter === 'created') {
        return notifications.filter(n => n.eventType === 'created');
    }
    
    if (statusFilter === 'deleted') {
        return notifications.filter(n => n.eventType === 'deleted');
    }
    
    return notifications.filter(notification => {
        // For renewal/pending filters, exclude event-based notifications
		if (statusFilter === 'renewal' || statusFilter === 'pending') {
			// Exclude event-based notifications
			if (notification.eventType === 'created' || notification.eventType === 'deleted') {
				return false;
			}
		}

		// Only show notifications with reminderTriggerDate <= today for reminder-based notifications
		if (notification.reminderTriggerDate) {
			const triggerDate = new Date(notification.reminderTriggerDate);
			if (triggerDate > todayDate) return false;
		}

		if (notification.type === 'subscription') {
			const subscription = subscriptions.find(sub => 
				String(sub.id) === String(notification.subscriptionId) || 
				String((sub as any)._id) === String(notification.subscriptionId)
			);
			if (!subscription) return false;
			switch (statusFilter) {
				case 'renewal':
					// Only show reminder-based notifications for active subscriptions
					return !notification.eventType && (subscription.status?.toLowerCase() === 'active' || subscription.isActive);
				default:
					return true;
			}
		} else if (notification.type === 'compliance') {
			const compliance = complianceItems.find(item => 
				String(item.id) === String(notification.complianceId) || 
				String(item._id) === String(notification.complianceId)
			);
			switch (statusFilter) {
				case 'pending':
					// Show reminder notifications (no eventType) for compliance items
					if (notification.eventType) return false; // exclude created/deleted events
					
					// If we can't find the compliance item, but it's a reminder notification, show it
					if (!compliance) {
						return !notification.eventType; // show reminder notifications even if compliance not found
					}
					
					// Check compliance status - be more inclusive for pending filter
					const compStatus = (compliance.status || '').toLowerCase();
					// Include more statuses that should show reminders
					if (!['pending', 'active', 'non-compliant', 'submitted', 'under review', ''].includes(compStatus)) {
						return false;
					}
					
					// Check trigger date
					const trigger = notification.reminderTriggerDate || notification.reminderDate;
					if (!trigger) return true; // if no trigger date, show as active reminder
					return new Date(trigger) <= todayDate;
				default:
					return true;
			}
		}
		return true;
    });
};
const filteredNotifications = getFilteredNotifications();
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
<div className="p-6">
	<div className="flex items-center justify-between mb-6">
		<div className="flex items-center gap-2">
			<Bell className="h-6 w-6" />
			<h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
			<Badge variant="secondary" className="ml-2">
				{filteredNotifications.length} Active
			</Badge>
		</div>
		<div className="flex gap-4 items-center">
			<Select value={statusFilter} onValueChange={setStatusFilter}>
				<SelectTrigger className="w-48">
					<Filter className="h-4 w-4 mr-2 text-gray-500" />
					<SelectValue placeholder="Filter" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Notifications</SelectItem>
					{notificationType === 'subscription' ? (
						<SelectItem value="renewal">Renewal Reminders Only</SelectItem>
					) : (
						<SelectItem value="pending">Pending Compliance</SelectItem>
					)}
					<SelectItem value="created">{notificationType === 'compliance' ? 'Created Compliance' : 'Creation Events Only'}</SelectItem>
					<SelectItem value="deleted">{notificationType === 'compliance' ? 'Deleted Compliance' : 'Deletion Events Only'}</SelectItem>
				</SelectContent>
			</Select>
			<Button 
				variant={notificationType === 'subscription' ? "default" : "outline"} 
				className={`px-6 py-2 font-medium rounded-lg shadow-sm transition-colors ${
					notificationType === 'subscription' 
						? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
						: 'bg-white hover:bg-blue-50 text-gray-700 border-gray-300 hover:border-blue-300'
				}`}
				onClick={() => setNotificationType('subscription')}
			>
				Subscription Notification
			</Button>
			<Button 
				variant={notificationType === 'compliance' ? "default" : "outline"} 
				className={`px-6 py-2 font-medium rounded-lg transition-colors ${
					notificationType === 'compliance' 
						? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
						: 'bg-white hover:bg-blue-50 text-gray-700 border-gray-300 hover:border-blue-300'
				}`}
				onClick={() => setNotificationType('compliance')}
			>
				Compliance Notification
			</Button>
		</div>
	</div>
{filteredNotifications.length === 0 ? (
<Card>
<CardContent className="flex flex-col items-center justify-center py-12">
<Bell className="h-12 w-12 text-gray-400 mb-4" />
<h3 className="text-base font-medium text-gray-900 mb-2">
{statusFilter === 'all' 
	? (notificationType === 'subscription' ? 'No Active Subscription Notifications' : 'No Active Compliance Notifications')
	: statusFilter === 'renewal' ? 'No Active Renewal Reminders'
	: statusFilter === 'pending' ? 'No Active Deadline Reminders'
	: statusFilter === 'created' ? 'No Creation Events'
	: statusFilter === 'deleted' ? 'No Deletion Events'
	: `No ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Notifications`}
</h3>
<p className="text-gray-500 text-center">
{statusFilter === 'all' 
	? (notificationType === 'subscription' 
		? 'All your subscription reminders are up to date. New notifications will appear here when reminders are triggered.'
		: 'All your compliance reminders are up to date. New notifications will appear here when submission deadlines approach.')
	: statusFilter === 'renewal' ? 'No active subscription renewal reminders. Renewal reminders will appear here based on your subscription reminder settings.'
	: statusFilter === 'pending' ? 'No active compliance deadline reminders. Deadline reminders will appear here when submission deadlines approach.'
	: statusFilter === 'created' ? 'No creation events found. Creation events appear when new subscriptions or compliance items are added.'
	: statusFilter === 'deleted' ? 'No deletion events found. Deletion events appear when subscriptions or compliance items are removed.'
	: `No notifications found for the ${statusFilter} filter.`}
</p>
</CardContent>
</Card>
) : (
<div className="space-y-4">
{[...filteredNotifications]
.sort((a, b) => {
// Sort by reminderTriggerDate descending (newest first)
const dateA = isValidDate(a.reminderTriggerDate) ? new Date(a.reminderTriggerDate ?? '').getTime() : 0;
const dateB = isValidDate(b.reminderTriggerDate) ? new Date(b.reminderTriggerDate ?? '').getTime() : 0;
return dateB - dateA;
})
.map((notification) => (
				<Card key={notification.id} className="hover:shadow-lg hover:border-blue-200 transition-all duration-200 bg-white border border-gray-200">
	<CardHeader className="pb-3">
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-3">
				<div className="p-2 bg-orange-100 rounded-lg">
					<Bell className="h-4 w-4 text-orange-600" />
				</div>
				<div>
 									<CardTitle className="text-base font-medium text-gray-900">
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
		 									: (notification.subscriptionName || 'Unknown Subscription')}
 									</CardTitle>
					<div className="flex items-center gap-2 mt-1">
									{/* Category badge */}
									<Badge variant="outline" className="text-xs bg-gray-100 text-gray-700 font-medium px-3 py-1 rounded-full hover:bg-gray-100 hover:text-gray-700">
 												{notification.type === 'compliance'
 													? (notification.complianceCategory || notification.category || notification.filingName || notification.complianceName || notification.name || 'Compliance')
 													: (notification.category || 'Subscription')}
									</Badge>
									
									{/* Reminder/Event badge */}
									<Badge variant="default" className={`text-xs font-medium px-3 py-1 rounded-full ${
										notification.eventType === 'created' ? 'bg-green-600 text-white hover:bg-green-600 hover:text-white' :
										notification.eventType === 'deleted' ? 'bg-red-600 text-white hover:bg-red-600 hover:text-white' :
										'bg-blue-600 text-white hover:bg-blue-600 hover:text-white'
									}`}>
										{(() => {
											// Handle event-based notifications
											if (notification.eventType === 'created') {
												return notification.type === 'compliance' ? 'Compliance Created' : 'Subscription Created';
											}
											if (notification.eventType === 'deleted') {
												return notification.type === 'compliance' ? 'Compliance Deleted' : 'Subscription Deleted';
											}
											
											// Handle reminder-based notifications
											if (notification.type === 'compliance') {
												// Try multiple fallback sources for compliance reminder info
												let reminderPolicy = (notification as any).reminderPolicy;
												let reminderDays = Number((notification as any).reminderDays || 0);
												
												if (!reminderPolicy || reminderDays === 0) {
													const compliance = complianceItems.find(ci => 
														String(ci.id) === String(notification.complianceId) || 
														String(ci._id) === String(notification.complianceId)
													);
													reminderPolicy = reminderPolicy || compliance?.reminderPolicy;
													reminderDays = reminderDays || Number(compliance?.reminderDays || 0);
												}
												
												if (reminderPolicy === "Until Renewal" && reminderDays > 0) {
													return `Daily reminder (${reminderDays} days until deadline)`;
												} else if (reminderPolicy === "One time" && reminderDays > 0) {
													return `One-time reminder (${reminderDays} days before)`;
												} else if (reminderPolicy === "Two times" && reminderDays > 0) {
													return `Two-time reminder (${reminderDays} & ${Math.floor(reminderDays/2)} days before)`;
												} else if (reminderDays > 0) {
													return `Reminder (${reminderDays} days before)`;
												} else {
													return `Reminder`;
												}
											} else {
												const subscription = subscriptions.find(sub => 
													String(sub.id) === String(notification.subscriptionId) || 
													String((sub as any)._id) === String(notification.subscriptionId)
												);
												const reminderPolicy = subscription?.reminderPolicy;
												const reminderDays = Number(subscription?.reminderDays || 0);
												
												if (reminderPolicy === "Until Renewal" && reminderDays > 0) {
													return `Daily reminder (${reminderDays} days until renewal)`;
												} else if (reminderPolicy === "One time" && reminderDays > 0) {
													return `One-time reminder (${reminderDays} days before)`;
												} else if (reminderPolicy === "Two times" && reminderDays > 0) {
													return `Two-time reminder (${reminderDays} & ${Math.floor(reminderDays/2)} days before)`;
												} else if (reminderDays > 0) {
													return `Reminder (${reminderDays} days before)`;
												} else {
													return `Reminder`;
												}
											}
										})()}
									</Badge>
					</div>
				</div>
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={() => {
					if (notification.type === 'compliance') {
						handleViewCompliance(notification.complianceId ?? '');
					} else {
						handleViewSubscription(notification.subscriptionId ?? '');
					}
				}}
				className="flex items-center gap-2"
			>
				<Eye className="h-4 w-4" />
				View
			</Button>
		</div>
	</CardHeader>
<CardContent>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
<div className="flex items-center gap-2 text-gray-600">
<Clock className="h-4 w-4" />
<span>{notification.eventType ? 'Event Date:' : 'Reminder Triggered:'}</span>
<span className="font-medium">
{notification.eventType ? (
	// For event-based notifications, show the creation/deletion date
	notification.createdAt && isValidDate(notification.createdAt)
		? format(new Date(notification.createdAt), 'MMM dd, yyyy')
		: (notification.timestamp && isValidDate(notification.timestamp)
			? format(new Date(notification.timestamp), 'MMM dd, yyyy')
			: 'N/A')
) : notification.type === 'compliance' ? (
notification.reminderTriggerDate && isValidDate(notification.reminderTriggerDate)
? format(new Date(notification.reminderTriggerDate ?? ''), 'MMM dd, yyyy')
: 'N/A'
) : (
notification.reminderTriggerDate && isValidDate(notification.reminderTriggerDate)
? format(new Date(notification.reminderTriggerDate ?? ''), 'MMM dd, yyyy')
: (() => {
const subscription = subscriptions.find(sub => sub.id === notification.subscriptionId);
const reminderPolicy = subscription?.reminderPolicy || "One time";
const reminderDays = Number(subscription?.reminderDays) || 7;
const renewalDate = notification.subscriptionEndDate;
let triggerDate: Date | null = null;
if (reminderPolicy === "One time") {
triggerDate = isValidDate(renewalDate) ? subDays(new Date(renewalDate ?? ''), reminderDays) : null;
} else if (reminderPolicy === "Two times") {
const first = isValidDate(renewalDate) ? subDays(new Date(renewalDate ?? ''), reminderDays) : null;
const second = isValidDate(renewalDate) ? subDays(new Date(renewalDate ?? ''), Math.floor(reminderDays / 2)) : null;
// Show the next upcoming trigger date
if (first && today < first) triggerDate = first;
else if (second && today < second) triggerDate = second;
else triggerDate = null;
} else if (reminderPolicy === "Until Renewal") {
// For daily, show the next upcoming date
const startDate = isValidDate(renewalDate) ? subDays(new Date(renewalDate ?? ''), reminderDays) : null;
if (startDate && today < new Date(renewalDate ?? '')) {
	triggerDate = today >= startDate ? today : startDate;
}
}
return triggerDate ? format(triggerDate, 'MMM dd, yyyy') : 'N/A';
})()
)}
</span>
</div>
{!notification.eventType && (
<div className="flex items-center gap-2 text-gray-600">
<Calendar className="h-4 w-4" />
<span>{notification.type === 'compliance' ? 'Submission Deadline:' : 'Renewal Date:'}</span>
<span className="font-medium">
{notification.type === 'compliance' ? (
isValidDate(notification.submissionDeadline)
? format(new Date(notification.submissionDeadline ?? ''), 'MMM dd, yyyy')
: 'N/A'
) : (
isValidDate(notification.subscriptionEndDate)
? format(new Date(notification.subscriptionEndDate ?? ''), 'MMM dd, yyyy')
: 'N/A'
)}
</span>
</div>
)}
</div>
<div className={`mt-4 p-3 border rounded-lg ${
	notification.eventType === 'created' ? 'bg-green-50 border-green-200' :
	notification.eventType === 'deleted' ? 'bg-red-50 border-red-200' :
	notification.type === 'compliance' ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'
}`}>
<p className={`text-sm ${
	notification.eventType === 'created' ? 'text-green-800' :
	notification.eventType === 'deleted' ? 'text-red-800' :
	notification.type === 'compliance' ? 'text-blue-800' : 'text-amber-800'
}`}>
<strong>
	{notification.eventType === 'created' ? 'Created:' :
	 notification.eventType === 'deleted' ? 'Deleted:' :
	 'Action Required:'}
</strong> 
{notification.eventType === 'created' ? (
	notification.type === 'compliance' ? (
		<>The compliance filing "{notification.filingName || 'Unknown Filing'}" has been successfully created.</>
	) : (
		<>The subscription "{notification.subscriptionName || 'Unknown Subscription'}" has been successfully created.</>
	)
) : notification.eventType === 'deleted' ? (
	notification.type === 'compliance' ? (
		<>The compliance filing "{notification.filingName || 'Unknown Filing'}" has been deleted.</>
	) : (
		<>The subscription "{notification.subscriptionName || 'Unknown Subscription'}" has been deleted.</>
	)
) : notification.type === 'compliance' ? (
<>Your {notification.filingName || 'compliance filing'} submission deadline is {isValidDate(notification.submissionDeadline)
? format(new Date(notification.submissionDeadline ?? ''), 'MMMM dd, yyyy')
: 'approaching'}.
Please review and submit your compliance filing on time.</>
) : (
<>Your {notification.subscriptionName || 'Unknown Subscription'} subscription
will renew on {isValidDate(notification.subscriptionEndDate)
? format(new Date(notification.subscriptionEndDate ?? ''), 'MMMM dd, yyyy')
: 'N/A'}.
Please review and take necessary action if needed.</>
)}
</p>
</div>
</CardContent>
</Card>
))}
</div>
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


