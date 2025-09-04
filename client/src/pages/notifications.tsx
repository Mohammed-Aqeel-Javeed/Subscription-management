// Helper to check if a date string is valid
function isValidDate(date: any) {
if (!date) return false;
const d = new Date(date);
return d instanceof Date && !isNaN(d.getTime());
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Eye, Calendar, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { NotificationItem, ComplianceItem } from "@shared/types";
import { format, subDays } from "date-fns";
import { useState, useEffect } from "react";
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import type { Subscription } from "@shared/types";

export default function Notifications() {
// State to force daily refresh
const [today, setToday] = useState(new Date());
const [notificationType, setNotificationType] = useState<'subscription' | 'compliance'>('subscription');
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
refetchInterval: false, // Disable auto-refresh
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
<h1 className="text-2xl font-bold">Notifications</h1>
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
			<h1 className="text-2xl font-bold">Notifications</h1>
			<Badge variant="secondary" className="ml-2">
				{notifications.length} Active
			</Badge>
		</div>
		<div className="flex gap-4">
			<Button 
				variant={notificationType === 'subscription' ? "default" : "outline"} 
				className="px-6 py-2 font-semibold rounded-lg shadow-sm"
				onClick={() => setNotificationType('subscription')}
			>
				Subscription Notification
			</Button>
			<Button 
				variant={notificationType === 'compliance' ? "default" : "outline"} 
				className="px-6 py-2 font-semibold rounded-lg"
				onClick={() => setNotificationType('compliance')}
			>
				Compliance Notification
			</Button>
		</div>
	</div>
{notifications.length === 0 ? (
<Card>
<CardContent className="flex flex-col items-center justify-center py-12">
<Bell className="h-12 w-12 text-gray-400 mb-4" />
<h3 className="text-lg font-semibold text-gray-600 mb-2">
{notificationType === 'subscription' ? 'No Active Subscription Notifications' : 'No Active Compliance Notifications'}
</h3>
<p className="text-gray-500 text-center">
{notificationType === 'subscription' 
? 'All your subscription reminders are up to date. New notifications will appear here when reminders are triggered.'
: 'All your compliance reminders are up to date. New notifications will appear here when submission deadlines approach.'}
</p>
</CardContent>
</Card>
) : (
<div className="space-y-4">
{[...notifications]
.sort((a, b) => {
// Sort by reminderTriggerDate descending (newest first)
const dateA = isValidDate(a.reminderTriggerDate) ? new Date(a.reminderTriggerDate ?? '').getTime() : 0;
const dateB = isValidDate(b.reminderTriggerDate) ? new Date(b.reminderTriggerDate ?? '').getTime() : 0;
return dateB - dateA;
})
.map((notification) => (
<Card key={notification.id} className="hover:shadow-md transition-shadow">
	<CardHeader className="pb-3">
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-3">
				<div className="p-2 bg-orange-100 rounded-lg">
					<Bell className="h-4 w-4 text-orange-600" />
				</div>
				<div>
					<CardTitle className="text-lg">
						{notification.type === 'compliance'
							? (notification.filingName || 'Unknown Compliance Filing')
							: (notification.subscriptionName || 'Unknown Subscription')}
					</CardTitle>
					<div className="flex items-center gap-2 mt-1">
						<Badge variant="outline" className="text-xs">
							{notification.type === 'compliance'
								? (notification.complianceCategory || 'Compliance')
								: (notification.category || 'Subscription')}
						</Badge>
									<Badge variant="default" className="text-xs bg-blue-600 text-white font-semibold px-3 py-1 rounded-full">
										{(() => {
											if (notification.type === 'compliance') {
												// Try direct property, fallback to complianceItems lookup
												const reminderPolicy = (notification as any).reminderPolicy ?? complianceItems.find(ci => ci.id === notification.complianceId)?.reminderPolicy;
												const reminderDays = Number((notification as any).reminderDays ?? complianceItems.find(ci => ci.id === notification.complianceId)?.reminderDays);
												if (reminderPolicy === "Until Renewal" && reminderDays > 0) {
													return `Daily reminder (${reminderDays} days until renewal)`;
												} else if (reminderPolicy === "One time" && reminderDays > 0) {
													return `One-time reminder (${reminderDays} days before)`;
												} else if (reminderPolicy === "Two times" && reminderDays > 0) {
													return `Two-time reminder (${reminderDays} & ${Math.floor(reminderDays/2)} days before)`;
												} else {
													return `Reminder`;
												}
											} else {
												const subscription = subscriptions.find(sub => sub.id === notification.subscriptionId);
												const reminderPolicy = subscription?.reminderPolicy;
												const reminderDays = Number(subscription?.reminderDays);
												if (reminderPolicy === "Until Renewal" && reminderDays > 0) {
													return `Daily reminder (${reminderDays} days until renewal)`;
												} else if (reminderPolicy === "One time" && reminderDays > 0) {
													return `One-time reminder (${reminderDays} days before)`;
												} else if (reminderPolicy === "Two times" && reminderDays > 0) {
													return `Two-time reminder (${reminderDays} & ${Math.floor(reminderDays/2)} days before)`;
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
<span>Reminder Triggered:</span>
<span className="font-medium">
{notification.type === 'compliance' ? (
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
</div>
<div className={`mt-4 p-3 border rounded-lg ${notification.type === 'compliance' ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
<p className={`text-sm ${notification.type === 'compliance' ? 'text-blue-800' : 'text-amber-800'}`}>
<strong>Action Required:</strong> 
{notification.type === 'compliance' ? (
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


