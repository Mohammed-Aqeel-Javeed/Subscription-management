// Helper to check if a date string is valid
function isValidDate(date: any) {
if (!date) return false;
const d = new Date(date);
return d instanceof Date && !isNaN(d.getTime());
}
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Eye, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
type NotificationItem = {
	id?: string;
	type: 'subscription' | 'compliance';
	eventType?: 'created' | 'deleted' | 'updated' | 'payment_method_expiring';
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
import { format } from "date-fns";
import { useState, useEffect } from "react";
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import type { Subscription } from "@shared/types";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export default function Notifications() {
// State to force daily refresh
const [, setToday] = useState(new Date());
const [, setLocation] = useLocation();
const [notificationType, setNotificationType] = useState<'subscription' | 'compliance'>('subscription');
const [statusFilter, setStatusFilter] = useState<string>('all');
const [, setExpandedNotificationId] = useState<string | null>(null);

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
queryKey: [notificationType === 'subscription' ? '/api/notifications' : '/api/notifications/compliance'],
refetchInterval: 5000, // Refresh every 5 seconds for automatic updates
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
setExpandedNotificationId(null); // Collapse any expanded notification
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
<div className="p-6 max-w-7xl mx-auto">
	<div className="flex items-center justify-between mb-6">
		<div className="flex items-center gap-3">
			<h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
			<span className="text-lg text-gray-500 font-normal">{filteredNotifications.length} Active</span>
		</div>
		<div className="flex gap-3 items-center">
			<Select value={statusFilter} onValueChange={setStatusFilter}>
				<SelectTrigger className="w-48 h-10">
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
	? (notificationType === 'subscription')
	: statusFilter === 'renewal' ? 'No active subscription renewal reminders. Renewal reminders will appear here based on your subscription reminder settings.'
	: statusFilter === 'pending' ? 'No active compliance deadline reminders. Deadline reminders will appear here when submission deadlines approach.'
	: statusFilter === 'created' ? 'No creation events found. Creation events appear when new subscriptions or compliance items are added.'
	: statusFilter === 'deleted' ? 'No deletion events found. Deletion events appear when subscriptions or compliance items are removed.'
	: `No notifications found for the ${statusFilter} filter.`}
</p>
</CardContent>
</Card>
) : (
<>
<div className="space-y-3">
{[...filteredNotifications]
.sort((a, b) => {
// Sort by reminderTriggerDate if present, otherwise by timestamp/createdAt
const rawA = a.reminderTriggerDate || a.timestamp || a.createdAt;
const rawB = b.reminderTriggerDate || b.timestamp || b.createdAt;
const dateA = isValidDate(rawA) ? new Date(rawA ?? '').getTime() : 0;
const dateB = isValidDate(rawB) ? new Date(rawB ?? '').getTime() : 0;
return dateB - dateA;
})
.map((notification) => {
return (
				<div 
					key={notification.id} 
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
 												: (notification.category || 'Subscription')}
								</span>
								<span className="text-gray-400">•</span>
								
								{/* Reminder/Event badge */}
								<Badge className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
									notification.eventType === 'created' ? 'bg-green-600 text-white hover:bg-green-600' :
									notification.eventType === 'deleted' ? 'bg-red-600 text-white hover:bg-red-600' :
									notification.eventType === 'updated' ? 'bg-purple-600 text-white hover:bg-purple-600' :
									notification.eventType === 'payment_method_expiring' ? 'bg-orange-600 text-white hover:bg-orange-600' :
									'bg-blue-600 text-white hover:bg-blue-600'
								}`}>
									{(() => {
										// Handle event-based notifications
										if (notification.eventType === 'created') {
											return notification.type === 'compliance' ? 'Compliance Created' : 'Subscription Created';
										}
										if (notification.eventType === 'deleted') {
											return notification.type === 'compliance' ? 'Compliance Deleted' : 'Subscription Deleted';
										}

										if (notification.eventType === 'payment_method_expiring') {
											return 'Payment Method Expiring';
										}

										// Subscription lifecycle updates (price/qty/owner/etc.)
										if (notification.type === 'subscription' && notification.eventType === 'updated') {
											const lifecycle = String((notification as any).lifecycleEventType || '').toLowerCase();
											switch (lifecycle) {
												case 'owner_changed':
													return 'Owner Changed';
												case 'price_changed':
													return 'Price Changed';
												case 'quantity_changed':
													return 'Quantity Changed';
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

