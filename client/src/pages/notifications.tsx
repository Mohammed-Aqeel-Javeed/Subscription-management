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
import type { NotificationItem } from "@shared/types";
import { format, addDays, subDays, eachDayOfInterval } from "date-fns";
import { useState, useEffect } from "react";
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import type { Subscription } from "@shared/types";

export default function Notifications() {
// State to force daily refresh
const [today, setToday] = useState(new Date());
useEffect(() => {
const timer = setInterval(() => {
setToday(new Date());
}, 1000 * 60 * 60); // Refresh every hour (can change to 24h for production)
return () => clearInterval(timer);
}, []);
const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);
// Track modal close to trigger notifications refetch
const [modalJustClosed, setModalJustClosed] = useState(false);
// Helper to calculate notification dates
function getNotificationDates(reminderPolicy: string, reminderDays: number, renewalDate: string) {
if (!isValidDate(renewalDate) || !reminderDays) return [];
const endDate = new Date(renewalDate);
let dates: Date[] = [];
if (reminderPolicy === "One time") {
dates = [subDays(endDate, reminderDays)];
} else if (reminderPolicy === "Two times") {
const first = subDays(endDate, reminderDays);
const second = subDays(endDate, Math.floor(reminderDays / 2));
dates = [first, second].filter(d => d <= endDate && d >= new Date());
// If both dates are invalid, fallback to one time
if (dates.length === 0) {
dates = [subDays(endDate, reminderDays)].filter(d => d <= endDate && d >= new Date());
}
} else if (reminderPolicy === "Until Renewal") {
const startDate = subDays(endDate, reminderDays);
dates = eachDayOfInterval({ start: startDate, end: endDate }).filter(d => d >= new Date());
}
// Only future dates
return dates;
}
const { data: notifications = [], isLoading, refetch } = useQuery<NotificationItem[]>({
queryKey: ['/api/notifications'],
refetchInterval: false, // Disable auto-refresh
});
const { data: subscriptions = [], refetch: refetchSubscriptions } = useQuery<Subscription[]>({
queryKey: ['/api/subscriptions'],
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
const getBadgeVariant = (reminderType: string) => {
if (reminderType.includes('Daily')) return 'destructive';
if (reminderType.includes('Second')) return 'secondary';
return 'default';
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
			<Button variant="default" className="px-6 py-2 font-semibold rounded-lg shadow-sm">Subscription Notification</Button>
			<Button variant="outline" className="px-6 py-2 font-semibold rounded-lg">Compliance Notification</Button>
		</div>
	</div>
{notifications.length === 0 ? (
<Card>
<CardContent className="flex flex-col items-center justify-center py-12">
<Bell className="h-12 w-12 text-gray-400 mb-4" />
<h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Notifications</h3>
<p className="text-gray-500 text-center">
All your subscription reminders are up to date. New notifications will appear here when reminders are triggered.
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
<CardTitle className="text-lg">{notification.subscriptionName || 'Unknown Subscription'}</CardTitle>
<div className="flex items-center gap-2 mt-1">
<Badge variant="outline" className="text-xs">
{notification.category}
</Badge>
<Badge variant="default" className="text-xs bg-blue-600 text-white font-semibold px-3 py-1 rounded-full">
{(() => {
const subscription = subscriptions.find(sub => sub.id === notification.subscriptionId);
if (!subscription) return 'Reminder';
const reminderPolicy = subscription.reminderPolicy;
const reminderDays = Number(subscription.reminderDays);
if (reminderPolicy === "Until Renewal" && reminderDays > 0) {
return `Daily reminder (${reminderDays} days until renewal)`;
} else if (reminderPolicy === "One time" && reminderDays > 0) {
return `One-time reminder (${reminderDays} days before)`;
} else if (reminderPolicy === "Two times" && reminderDays > 0) {
return `Two-time reminder (${reminderDays} & ${Math.floor(reminderDays/2)} days before)`;
} else {
return `Reminder`;
}
})()}
</Badge>
</div>
</div>
</div>
<Button
variant="outline"
size="sm"
onClick={() => handleViewSubscription(notification.subscriptionId ?? '')}
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
{notification.reminderTriggerDate && isValidDate(notification.reminderTriggerDate)
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
}
</span>
</div>
<div className="flex items-center gap-2 text-gray-600">
<Calendar className="h-4 w-4" />
<span>Renewal Date:</span>
<span className="font-medium">
{isValidDate(notification.subscriptionEndDate)
? format(new Date(notification.subscriptionEndDate ?? ''), 'MMM dd, yyyy')
: 'N/A'}
</span>
</div>
</div>
<div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
<p className="text-sm text-amber-800">
<strong>Action Required:</strong> Your {notification.subscriptionName || 'Unknown Subscription'} subscription
will renew on {isValidDate(notification.subscriptionEndDate)
? format(new Date(notification.subscriptionEndDate ?? ''), 'MMMM dd, yyyy')
: 'N/A'}.
Please review and take necessary action if needed.
</p>
{/* Removed Upcoming Notification Dates section as requested */}
</div>
</CardContent>
</Card>
))}
</div>
)}
{selectedSubscription && (
<SubscriptionModal
open={isModalOpen}
onOpenChange={(open) => {
setIsModalOpen(open);
if (!open) {
setModalJustClosed(true);
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
refetch();
refetchSubscriptions();
return null;
})()}
</div>
);
}


