var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, TriangleAlert, Calendar, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
export default function Reminders() {
    // Category configuration with visibility settings
    var _a = useState([
        { name: 'Software', visible: true, defaultDays: 7 },
        { name: 'Music', visible: true, defaultDays: 7 },
        { name: 'News', visible: true, defaultDays: 7 },
        { name: 'Business Tool', visible: true, defaultDays: 7 },
        { name: 'Cloud Storage', visible: true, defaultDays: 7 },
        { name: 'Regulatory', visible: true, defaultDays: 7 },
        { name: 'Entertainment', visible: true, defaultDays: 7 },
        { name: 'Others', visible: true, defaultDays: 7 },
    ]), categories = _a[0], setCategories = _a[1];
    // State for regulatory monthly day
    var _b = useState(14), regulatoryMonthlyDay = _b[0], setRegulatoryMonthlyDay = _b[1];
    var _c = useState(''), newCategoryName = _c[0], setNewCategoryName = _c[1];
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var _d = useQuery({
        queryKey: ["/api/subscriptions"],
    }), subscriptions = _d.data, subscriptionsLoading = _d.isLoading;
    var _e = useQuery({
        queryKey: ["/api/reminders"],
    }), reminders = _e.data, remindersLoading = _e.isLoading;
    var updateReminderMutation = useMutation({
        mutationFn: function (_a) {
            var id = _a.id, data = _a.data;
            return apiRequest("PUT", "/api/reminders/".concat(id), data);
        },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
            toast({
                title: "Success",
                description: "Reminder settings updated successfully",
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to update reminder",
                variant: "destructive",
            });
        },
    });
    // Calculate upcoming renewals with reminder details
    var subscriptionsWithReminders = (subscriptions === null || subscriptions === void 0 ? void 0 : subscriptions.map(function (sub) {
        var reminder = reminders === null || reminders === void 0 ? void 0 : reminders.find(function (r) { return r.subscriptionId === sub.id; });
        return __assign(__assign({}, sub), { reminder: reminder });
    })) || [];
    var upcomingRenewals = subscriptionsWithReminders.filter(function (sub) {
        var now = new Date();
        var renewalDate = new Date(sub.nextRenewal);
        var diffTime = renewalDate.getTime() - now.getTime();
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30 && diffDays > 0;
    }).sort(function (a, b) { return new Date(a.nextRenewal).getTime() - new Date(b.nextRenewal).getTime(); });
    var addNewCategory = function () {
        if (newCategoryName.trim() && !categories.find(function (c) { return c.name.toLowerCase() === newCategoryName.toLowerCase(); })) {
            setCategories(function (prev) { return __spreadArray(__spreadArray([], prev, true), [{
                    name: newCategoryName.trim(),
                    visible: true,
                    defaultDays: 7,
                }], false); });
            setNewCategoryName('');
            toast({
                title: "Category Added",
                description: "".concat(newCategoryName, " category has been added successfully"),
            });
        }
    };
    // State for global email and WhatsApp notifications
    var _f = useState(false), emailEnabled = _f[0], setEmailEnabled = _f[1];
    var _g = useState(false), whatsappEnabled = _g[0], setWhatsappEnabled = _g[1];
    var updateCategoryVisibility = function (categoryName, visible) {
        setCategories(function (prev) { return prev.map(function (cat) {
            return cat.name === categoryName ? __assign(__assign({}, cat), { visible: visible }) : cat;
        }); });
    };
    // Add missing updateCategoryDays function
    var updateCategoryDays = function (categoryName, days) {
        setCategories(function (prev) { return prev.map(function (cat) {
            return cat.name === categoryName ? __assign(__assign({}, cat), { defaultDays: days }) : cat;
        }); });
    };
    var saveCategorySettings = function () {
        toast({
            title: "Settings Saved",
            description: "Category configuration has been saved successfully",
        });
    };
    // Get visible categories for use in dropdowns and cards
    var visibleCategories = categories.filter(function (cat) { return cat.visible; });
    var handleReminderUpdate = function (reminderId, updates) {
        updateReminderMutation.mutate({ id: reminderId, data: updates });
    };
    var getDaysUntilRenewal = function (renewalDate) {
        var now = new Date();
        var renewal = new Date(renewalDate);
        var diffTime = renewal.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    var getRenewalBadge = function (days) {
        if (days <= 7) {
            return (_jsxs(Badge, { className: "bg-red-100 text-red-800", children: [_jsx(TriangleAlert, { className: "w-3 h-3 mr-1" }), days, " days"] }));
        }
        else {
            return (_jsxs(Badge, { className: "bg-yellow-100 text-yellow-800", children: [_jsx(Clock, { className: "w-3 h-3 mr-1" }), days, " days"] }));
        }
    };
    if (subscriptionsLoading || remindersLoading) {
        return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx(Skeleton, { className: "h-8 w-48 mb-2" }), _jsx(Skeleton, { className: "h-4 w-96" })] }), _jsx(Card, { className: "mb-8", children: _jsxs(CardContent, { className: "p-6", children: [_jsx(Skeleton, { className: "h-6 w-48 mb-4" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsx(Skeleton, { className: "h-20" }), _jsx(Skeleton, { className: "h-20" }), _jsx(Skeleton, { className: "h-20" })] })] }) }), _jsx(Card, { children: _jsxs(CardContent, { className: "p-6", children: [_jsx(Skeleton, { className: "h-6 w-48 mb-6" }), _jsx("div", { className: "space-y-4", children: Array.from({ length: 3 }).map(function (_, i) { return (_jsx(Skeleton, { className: "h-24 w-full" }, i)); }) })] }) })] }));
    }
    return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900", children: "Reminders" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Manage renewal reminders and notifications" })] }), _jsxs(Card, { className: "mb-8", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center space-x-2", children: [_jsx(Settings, { className: "w-5 h-5" }), _jsx("span", { children: "Category-Based Reminder Settings" })] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx(Input, { placeholder: "Enter new category name", value: newCategoryName, onChange: function (e) { return setNewCategoryName(e.target.value); }, className: "flex-1" }), _jsxs(Button, { onClick: addNewCategory, disabled: !newCategoryName.trim(), children: [_jsx("span", { className: "w-4 h-4 mr-2", children: "+" }), "Add Category"] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: categories.map(function (category) {
                                                var isRegulatory = category.name === 'Regulatory';
                                                var cardColor = isRegulatory ? 'border-red-200 bg-red-50' :
                                                    category.name === 'Business Tools' ? 'border-blue-200 bg-blue-50' :
                                                        'border-gray-200 bg-gray-50';
                                                var textColor = isRegulatory ? 'text-red-900' :
                                                    category.name === 'Business Tools' ? 'text-blue-900' :
                                                        'text-gray-900';
                                                var inputColor = isRegulatory ? 'text-red-700' :
                                                    category.name === 'Business Tools' ? 'text-blue-700' :
                                                        'text-gray-700';
                                                return (_jsxs(Card, { className: "p-4 ".concat(cardColor), children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h4", { className: "font-medium ".concat(textColor), children: category.name }), _jsxs("div", { className: "flex items-center space-x-2", children: [isRegulatory && (_jsx(Badge, { className: "bg-red-100 text-red-800 text-xs", children: "Special" })), _jsx(Checkbox, { checked: category.visible, onCheckedChange: function (checked) { return updateCategoryVisibility(category.name, checked); }, className: "w-4 h-4" }), _jsx(Label, { className: "text-xs text-gray-600", children: "Visible" })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Label, { className: "text-sm ".concat(inputColor, " flex-1"), children: "Default alert period:" }), _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx(Input, { type: "number", min: "1", max: "365", value: category.defaultDays, onChange: function (e) { return updateCategoryDays(category.name, parseInt(e.target.value) || 7); }, className: "w-16 h-8 text-xs" }), _jsx("span", { className: "text-xs text-gray-600", children: "days" })] })] }), isRegulatory && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Label, { className: "text-sm text-red-700 flex-1", children: "Monthly reminder day:" }), _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx(Input, { type: "number", min: "1", max: "31", value: regulatoryMonthlyDay, onChange: function (e) { return setRegulatoryMonthlyDay(parseInt(e.target.value) || 14); }, className: "w-16 h-8 text-xs" }), _jsx("span", { className: "text-xs text-gray-600", children: "th" })] })] }), _jsxs("div", { className: "text-xs text-red-600", children: [_jsx(Calendar, { className: "w-3 h-3 inline mr-1" }), "Monthly recurring alerts for compliance tracking"] })] }))] })] }, category.name));
                                            }) })] }), _jsxs("div", { className: "flex justify-between items-center pt-4 border-t", children: [_jsx("div", { className: "text-sm text-gray-600", children: "These settings will automatically apply to new subscriptions based on their category." }), _jsxs(Button, { onClick: saveCategorySettings, className: "flex items-center space-x-2", children: [_jsx(Settings, { className: "w-4 h-4" }), _jsx("span", { children: "Save Category Settings" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700 mb-2 block", children: "Global Email Notifications" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { id: "email-notifications", checked: emailEnabled, onCheckedChange: function (checked) { return setEmailEnabled(checked === true); } }), _jsx(Label, { htmlFor: "email-notifications", className: "text-sm text-gray-700", children: "Enable email alerts for all subscriptions" })] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700 mb-2 block", children: "Global WhatsApp Notifications" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { id: "whatsapp-notifications", checked: whatsappEnabled, onCheckedChange: function (checked) { return setWhatsappEnabled(checked === true); } }), _jsx(Label, { htmlFor: "whatsapp-notifications", className: "text-sm text-gray-700", children: "Enable WhatsApp alerts (recommended for regulatory)" })] })] })] })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Upcoming Renewals" }) }), _jsx(CardContent, { children: upcomingRenewals.length > 0 ? (_jsx("div", { className: "space-y-6", children: upcomingRenewals.map(function (subscription) {
                                var daysUntil = getDaysUntilRenewal(subscription.nextRenewal.toString());
                                var reminder = subscription.reminder;
                                var categoryConfig = categories.find(function (c) { return c.name === subscription.category; });
                                var defaultDays = (categoryConfig === null || categoryConfig === void 0 ? void 0 : categoryConfig.defaultDays) || 7;
                                return (_jsx("div", { className: "p-6 hover:bg-gray-50 rounded-lg border border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center", children: _jsx("div", { className: "w-6 h-6 bg-primary rounded text-white text-xs flex items-center justify-center font-bold", children: subscription.serviceName.charAt(0) }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("h4", { className: "text-sm font-medium text-gray-900", children: subscription.serviceName }), _jsx(Badge, { className: subscription.category === 'Regulatory' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800', children: subscription.category })] }), _jsxs("p", { className: "text-sm text-gray-500", children: ["Renews on ", new Date(subscription.nextRenewal).toLocaleDateString()] }), _jsxs("p", { className: "text-sm text-gray-500", children: [parseFloat(String(subscription.amount)).toFixed(2), "/", subscription.billingCycle] }), (reminder === null || reminder === void 0 ? void 0 : reminder.reminderType) === 'monthly_recurring' && (_jsxs("div", { className: "flex items-center space-x-1 mt-1", children: [_jsx(Calendar, { className: "w-3 h-3 text-blue-600" }), _jsxs("span", { className: "text-xs text-blue-600", children: ["Monthly reminder on ", reminder.monthlyDay, "th"] })] }))] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: "text-right space-y-2", children: [getRenewalBadge(daysUntil), _jsxs("div", { className: "text-xs text-gray-500", children: ["Alert: ", (reminder === null || reminder === void 0 ? void 0 : reminder.alertDays) || defaultDays, " days"] })] }), _jsxs("div", { className: "flex flex-col space-y-2", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Input, { type: "number", min: "1", max: "365", value: (reminder === null || reminder === void 0 ? void 0 : reminder.alertDays) || defaultDays, onChange: function (e) { return reminder && handleReminderUpdate(reminder.id, { alertDays: Number(e.target.value) }); }, className: "w-16 h-8 text-xs", placeholder: "Days" }), _jsx("span", { className: "text-xs text-gray-600", children: "days" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs(Label, { className: "flex items-center space-x-1", children: [_jsx(Checkbox, { checked: (reminder === null || reminder === void 0 ? void 0 : reminder.emailEnabled) || false, onCheckedChange: function (checked) { return reminder && handleReminderUpdate(reminder.id, { emailEnabled: Boolean(checked) }); } }), _jsx("span", { className: "text-xs text-gray-600", children: "Email" })] }), _jsxs(Label, { className: "flex items-center space-x-1", children: [_jsx(Checkbox, { checked: (reminder === null || reminder === void 0 ? void 0 : reminder.whatsappEnabled) || false, onCheckedChange: function (checked) { return reminder && handleReminderUpdate(reminder.id, { whatsappEnabled: Boolean(checked) }); } }), _jsx("span", { className: "text-xs text-gray-600", children: "WhatsApp" })] })] })] })] })] }) }, subscription.id));
                            }) })) : (_jsxs("div", { className: "text-center py-12 text-gray-500", children: [_jsx(Clock, { className: "w-12 h-12 mx-auto mb-4 text-gray-300" }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No Upcoming Renewals" }), _jsx("p", { className: "text-gray-600", children: "You don't have any subscriptions renewing in the next 30 days." })] })) })] })] }));
}
