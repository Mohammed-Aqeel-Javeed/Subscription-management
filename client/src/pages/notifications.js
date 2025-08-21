var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Helper to check if a date string is valid
function isValidDate(date) {
    if (!date)
        return false;
    var d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Eye, Calendar, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { useState, useEffect } from "react";
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
export default function Notifications() {
    var _this = this;
    // State to force daily refresh
    var _a = useState(new Date()), today = _a[0], setToday = _a[1];
    useEffect(function () {
        var timer = setInterval(function () {
            setToday(new Date());
        }, 1000 * 60 * 60); // Refresh every hour (can change to 24h for production)
        return function () { return clearInterval(timer); };
    }, []);
    var _b = useState(null), selectedSubscription = _b[0], setSelectedSubscription = _b[1];
    var _c = useState(false), isModalOpen = _c[0], setIsModalOpen = _c[1];
    // Track modal close to trigger notifications refetch
    var _d = useState(false), modalJustClosed = _d[0], setModalJustClosed = _d[1];
    // Helper to calculate notification dates
    function getNotificationDates(reminderPolicy, reminderDays, renewalDate) {
        if (!isValidDate(renewalDate) || !reminderDays)
            return [];
        var endDate = new Date(renewalDate);
        var dates = [];
        if (reminderPolicy === "One time") {
            dates = [subDays(endDate, reminderDays)];
        }
        else if (reminderPolicy === "Two times") {
            var first = subDays(endDate, reminderDays);
            var second = subDays(endDate, Math.floor(reminderDays / 2));
            dates = [first, second].filter(function (d) { return d <= endDate && d >= new Date(); });
            // If both dates are invalid, fallback to one time
            if (dates.length === 0) {
                dates = [subDays(endDate, reminderDays)].filter(function (d) { return d <= endDate && d >= new Date(); });
            }
        }
        else if (reminderPolicy === "Until Renewal") {
            var startDate = subDays(endDate, reminderDays);
            dates = eachDayOfInterval({ start: startDate, end: endDate }).filter(function (d) { return d >= new Date(); });
        }
        // Only future dates
        return dates;
    }
    var _e = useQuery({
        queryKey: ['/api/notifications'],
        refetchInterval: false, // Disable auto-refresh
    }), _f = _e.data, notifications = _f === void 0 ? [] : _f, isLoading = _e.isLoading, refetch = _e.refetch;
    var _g = useQuery({
        queryKey: ['/api/subscriptions'],
    }), _h = _g.data, subscriptions = _h === void 0 ? [] : _h, refetchSubscriptions = _g.refetch;
    var handleViewSubscription = function (subscriptionId) { return __awaiter(_this, void 0, void 0, function () {
        var idStr, res, latestSubscription, _a, subscription;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    idStr = String(subscriptionId);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, apiRequest('GET', "/api/subscriptions/".concat(idStr))];
                case 2:
                    res = _c.sent();
                    return [4 /*yield*/, res.json()];
                case 3:
                    latestSubscription = _c.sent();
                    if (latestSubscription && (String(latestSubscription.id) === idStr || String((_b = latestSubscription._id) !== null && _b !== void 0 ? _b : '') === idStr)) {
                        setSelectedSubscription(latestSubscription);
                        setIsModalOpen(true);
                        return [2 /*return*/];
                    }
                    return [3 /*break*/, 5];
                case 4:
                    _a = _c.sent();
                    return [3 /*break*/, 5];
                case 5:
                    subscription = subscriptions.find(function (sub) { var _a; return String(sub.id) === idStr || String((_a = sub._id) !== null && _a !== void 0 ? _a : '') === idStr; });
                    if (subscription) {
                        setSelectedSubscription(subscription);
                        setIsModalOpen(true);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var getBadgeVariant = function (reminderType) {
        if (reminderType.includes('Daily'))
            return 'destructive';
        if (reminderType.includes('Second'))
            return 'secondary';
        return 'default';
    };
    if (isLoading) {
        return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-6", children: [_jsx(Bell, { className: "h-6 w-6" }), _jsx("h1", { className: "text-2xl font-bold", children: "Notifications" })] }), _jsx("div", { className: "animate-pulse space-y-4", children: __spreadArray([], Array(3), true).map(function (_, i) { return (_jsx("div", { className: "h-24 bg-gray-200 rounded-lg" }, i)); }) })] }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "flex items-center justify-between mb-6", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Bell, { className: "h-6 w-6" }), _jsx("h1", { className: "text-2xl font-bold", children: "Notifications" }), _jsxs(Badge, { variant: "secondary", className: "ml-2", children: [notifications.length, " Active"] })] }) }), notifications.length === 0 ? (_jsx(Card, { children: _jsxs(CardContent, { className: "flex flex-col items-center justify-center py-12", children: [_jsx(Bell, { className: "h-12 w-12 text-gray-400 mb-4" }), _jsx("h3", { className: "text-lg font-semibold text-gray-600 mb-2", children: "No Active Notifications" }), _jsx("p", { className: "text-gray-500 text-center", children: "All your subscription reminders are up to date. New notifications will appear here when reminders are triggered." })] }) })) : (_jsx("div", { className: "space-y-4", children: __spreadArray([], notifications, true).sort(function (a, b) {
                    var _a, _b;
                    // Sort by reminderTriggerDate descending (newest first)
                    var dateA = isValidDate(a.reminderTriggerDate) ? new Date((_a = a.reminderTriggerDate) !== null && _a !== void 0 ? _a : '').getTime() : 0;
                    var dateB = isValidDate(b.reminderTriggerDate) ? new Date((_b = b.reminderTriggerDate) !== null && _b !== void 0 ? _b : '').getTime() : 0;
                    return dateB - dateA;
                })
                    .map(function (notification) {
                    var _a, _b, _c;
                    return (_jsxs(Card, { className: "hover:shadow-md transition-shadow", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-orange-100 rounded-lg", children: _jsx(Bell, { className: "h-4 w-4 text-orange-600" }) }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg", children: notification.subscriptionName || 'Unknown Subscription' }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx(Badge, { variant: "outline", className: "text-xs", children: notification.category }), _jsx(Badge, { variant: "default", className: "text-xs bg-blue-600 text-white font-semibold px-3 py-1 rounded-full", children: (function () {
                                                                        var subscription = subscriptions.find(function (sub) { return sub.id === notification.subscriptionId; });
                                                                        if (!subscription)
                                                                            return 'Reminder';
                                                                        var reminderPolicy = subscription.reminderPolicy;
                                                                        var reminderDays = Number(subscription.reminderDays);
                                                                        if (reminderPolicy === "Until Renewal" && reminderDays > 0) {
                                                                            return "Daily reminder (".concat(reminderDays, " days until renewal)");
                                                                        }
                                                                        else if (reminderPolicy === "One time" && reminderDays > 0) {
                                                                            return "One-time reminder (".concat(reminderDays, " days before)");
                                                                        }
                                                                        else if (reminderPolicy === "Two times" && reminderDays > 0) {
                                                                            return "Two-time reminder (".concat(reminderDays, " & ").concat(Math.floor(reminderDays / 2), " days before)");
                                                                        }
                                                                        else {
                                                                            return "Reminder";
                                                                        }
                                                                    })() })] })] })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: function () { var _a; return handleViewSubscription((_a = notification.subscriptionId) !== null && _a !== void 0 ? _a : ''); }, className: "flex items-center gap-2", children: [_jsx(Eye, { className: "h-4 w-4" }), "View"] })] }) }), _jsxs(CardContent, { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2 text-gray-600", children: [_jsx(Clock, { className: "h-4 w-4" }), _jsx("span", { children: "Reminder Triggered:" }), _jsx("span", { className: "font-medium", children: notification.reminderTriggerDate && isValidDate(notification.reminderTriggerDate)
                                                            ? format(new Date((_a = notification.reminderTriggerDate) !== null && _a !== void 0 ? _a : ''), 'MMM dd, yyyy')
                                                            : (function () {
                                                                var subscription = subscriptions.find(function (sub) { return sub.id === notification.subscriptionId; });
                                                                var reminderPolicy = (subscription === null || subscription === void 0 ? void 0 : subscription.reminderPolicy) || "One time";
                                                                var reminderDays = Number(subscription === null || subscription === void 0 ? void 0 : subscription.reminderDays) || 7;
                                                                var renewalDate = notification.subscriptionEndDate;
                                                                var triggerDate = null;
                                                                if (reminderPolicy === "One time") {
                                                                    triggerDate = isValidDate(renewalDate) ? subDays(new Date(renewalDate !== null && renewalDate !== void 0 ? renewalDate : ''), reminderDays) : null;
                                                                }
                                                                else if (reminderPolicy === "Two times") {
                                                                    var first = isValidDate(renewalDate) ? subDays(new Date(renewalDate !== null && renewalDate !== void 0 ? renewalDate : ''), reminderDays) : null;
                                                                    var second = isValidDate(renewalDate) ? subDays(new Date(renewalDate !== null && renewalDate !== void 0 ? renewalDate : ''), Math.floor(reminderDays / 2)) : null;
                                                                    // Show the next upcoming trigger date
                                                                    if (first && today < first)
                                                                        triggerDate = first;
                                                                    else if (second && today < second)
                                                                        triggerDate = second;
                                                                    else
                                                                        triggerDate = null;
                                                                }
                                                                else if (reminderPolicy === "Until Renewal") {
                                                                    // For daily, show the next upcoming date
                                                                    var startDate = isValidDate(renewalDate) ? subDays(new Date(renewalDate !== null && renewalDate !== void 0 ? renewalDate : ''), reminderDays) : null;
                                                                    if (startDate && today < new Date(renewalDate !== null && renewalDate !== void 0 ? renewalDate : '')) {
                                                                        triggerDate = today >= startDate ? today : startDate;
                                                                    }
                                                                }
                                                                return triggerDate ? format(triggerDate, 'MMM dd, yyyy') : 'N/A';
                                                            })() })] }), _jsxs("div", { className: "flex items-center gap-2 text-gray-600", children: [_jsx(Calendar, { className: "h-4 w-4" }), _jsx("span", { children: "Renewal Date:" }), _jsx("span", { className: "font-medium", children: isValidDate(notification.subscriptionEndDate)
                                                            ? format(new Date((_b = notification.subscriptionEndDate) !== null && _b !== void 0 ? _b : ''), 'MMM dd, yyyy')
                                                            : 'N/A' })] })] }), _jsx("div", { className: "mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg", children: _jsxs("p", { className: "text-sm text-amber-800", children: [_jsx("strong", { children: "Action Required:" }), " Your ", notification.subscriptionName || 'Unknown Subscription', " subscription will renew on ", isValidDate(notification.subscriptionEndDate)
                                                    ? format(new Date((_c = notification.subscriptionEndDate) !== null && _c !== void 0 ? _c : ''), 'MMMM dd, yyyy')
                                                    : 'N/A', ". Please review and take necessary action if needed."] }) })] })] }, notification.id));
                }) })), selectedSubscription && (_jsx(SubscriptionModal, { open: isModalOpen, onOpenChange: function (open) {
                    setIsModalOpen(open);
                    if (!open) {
                        setModalJustClosed(true);
                    }
                }, subscription: selectedSubscription })), modalJustClosed && (function () {
                setModalJustClosed(false);
                refetch();
                refetchSubscriptions();
                return null;
            })()] }));
}
