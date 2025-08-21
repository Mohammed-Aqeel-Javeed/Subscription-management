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
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, TrendingUp, RefreshCw, Bell, Users, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TrendsChart from "@/components/charts/trends-chart";
import CategoryChart from "@/components/charts/category-chart";
import { Skeleton } from "@/components/ui/skeleton";
// Error boundary wrapper
function ErrorBoundary(_a) {
    var children = _a.children;
    // No error boundary needed, just render children
    return _jsx(React.Fragment, { children: children });
}
export default function Dashboard() {
    var _this = this;
    var location = window.location.pathname;
    var navigate = useNavigate();
    var _a = useState(false), authChecked = _a[0], setAuthChecked = _a[1];
    console.log("[Dashboard] Component mounted");
    var _b = useState(false), activeSubscriptionsModalOpen = _b[0], setActiveSubscriptionsModalOpen = _b[1];
    var _c = useState(false), upcomingRenewalsModalOpen = _c[0], setUpcomingRenewalsModalOpen = _c[1];
    var _d = useQuery({
        queryKey: ["/api/analytics/dashboard"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/analytics/dashboard", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); }
    }), metrics = _d.data, metricsLoading = _d.isLoading;
    var _e = useQuery({
        queryKey: ["/api/analytics/trends"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/analytics/trends", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); }
    }), trends = _e.data, trendsLoading = _e.isLoading;
    var _f = useQuery({
        queryKey: ["/api/analytics/categories"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/analytics/categories", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); }
    }), categories = _f.data, categoriesLoading = _f.isLoading;
    // Activity query removed as it's not currently used in the dashboard
    // const { data: activity, isLoading: activityLoading } = useQuery<RecentActivity[]>({
    //   queryKey: ["/api/analytics/activity"],
    //   queryFn: async () => {
    //     const res = await fetch("/api/analytics/activity", { credentials: "include" });
    //     return res.json();
    //   }
    // });
    var subscriptions = useQuery({
        queryKey: ["/api/subscriptions"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/subscriptions", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); }
    }).data;
    // Helper to get cookie by name
    function getCookie(name) {
        var _a;
        var value = "; ".concat(document.cookie);
        var parts = value.split("; ".concat(name, "="));
        if (parts.length === 2)
            return (_a = parts.pop()) === null || _a === void 0 ? void 0 : _a.split(';').shift();
        return null;
    }
    React.useEffect(function () {
        if (typeof window !== "undefined") {
            var token = getCookie("token");
            console.log("[Dashboard] Cookie token:", token);
            if (token) {
                setAuthChecked(true);
                console.log("[Dashboard] Authenticated, rendering dashboard.");
            }
            else {
                console.log("[Dashboard] No token found, redirecting to login.");
                navigate("/login");
            }
        }
    }, [navigate]);
    if (!authChecked) {
        return (_jsx("div", { style: { padding: 32, textAlign: 'center' }, children: _jsx("h2", { children: "Checking authentication..." }) }));
    }
    var handleLogout = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetch("/api/logout", { method: "POST", credentials: "include" })];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3:
                    navigate("/login");
                    return [2 /*return*/];
            }
        });
    }); };
    // Tab navigation handler
    var handleTabClick = function (tab) {
        if (tab === 'subscription') {
            navigate('/dashboard');
        }
        else {
            navigate('/compliance-dashboard');
        }
    };
    // Filter active subscriptions
    var activeSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter(function (sub) { return sub.status === "Active"; }) : [];
    // Filter upcoming renewals (next 30 days)
    var now = new Date();
    var thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    var upcomingRenewals = activeSubscriptions.filter(function (sub) {
        var renewalDate = new Date(sub.nextRenewal);
        // Reset time portions to compare only dates
        renewalDate.setHours(0, 0, 0, 0);
        var nowDate = new Date(now);
        nowDate.setHours(0, 0, 0, 0);
        var thirtyDaysDate = new Date(thirtyDaysFromNow);
        thirtyDaysDate.setHours(23, 59, 59, 999);
        return renewalDate <= thirtyDaysDate && renewalDate >= nowDate;
    });
    if (metricsLoading) {
        return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx(Skeleton, { className: "h-8 w-48 mb-2" }), _jsx(Skeleton, { className: "h-4 w-96" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: Array.from({ length: 4 }).map(function (_, i) { return (_jsx(Skeleton, { className: "h-32" }, i)); }) })] }));
    }
    var getGrowthIcon = function (growth) {
        if (growth > 0)
            return _jsx(TrendingUp, { className: "w-4 h-4" });
        return _jsx(TrendingUp, { className: "w-4 h-4 rotate-180" });
    };
    var getGrowthColor = function (growth) {
        if (growth > 0)
            return "text-red-600";
        if (growth < 0)
            return "text-green-600";
        return "text-gray-600";
    };
    return (_jsx(ErrorBoundary, { children: _jsxs("div", { className: "p-8", children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }, children: _jsx("button", { onClick: handleLogout, style: { padding: '8px 16px', background: '#f44336', color: '#fff', border: 0, borderRadius: 4, fontWeight: 600 }, children: "Logout" }) }), _jsxs("div", { className: "flex gap-4 mb-8", children: [_jsx(Button, { variant: location === '/dashboard' ? 'default' : 'outline', onClick: function () { return handleTabClick('subscription'); }, children: "Subscription" }), _jsx(Button, { variant: location === '/compliance-dashboard' ? 'default' : 'outline', onClick: function () { return handleTabClick('compliance'); }, children: "Compliance" })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900", children: "Dashboard" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Overview of your subscription spending and analytics" })] }), _jsx("div", { className: "mb-6 flex justify-between items-center", children: _jsxs("div", { className: "flex space-x-4", children: [_jsxs(Select, { defaultValue: "6months", children: [_jsx(SelectTrigger, { className: "w-48", children: _jsx(SelectValue, { placeholder: "Last 6 months" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "6months", children: "Last 6 months" }), _jsx(SelectItem, { value: "12months", children: "Last 12 months" }), _jsx(SelectItem, { value: "custom", children: "Custom range" })] })] }), _jsxs(Select, { defaultValue: "all", children: [_jsx(SelectTrigger, { className: "w-48", children: _jsx(SelectValue, { placeholder: "All Categories" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Categories" }), _jsx(SelectItem, { value: "software", children: "Software" }), _jsx(SelectItem, { value: "entertainment", children: "Entertainment" }), _jsx(SelectItem, { value: "business", children: "Business Tools" })] })] })] }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: [_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Monthly Spend" }), _jsxs("p", { className: "text-3xl font-bold text-gray-900", children: ["$", (metrics === null || metrics === void 0 ? void 0 : metrics.monthlySpend.toLocaleString()) || '0'] }), _jsxs("p", { className: "text-sm mt-1 flex items-center ".concat(getGrowthColor(-12)), children: [getGrowthIcon(-12), " 12% from last month"] })] }), _jsx("div", { className: "w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center", children: _jsx(CalendarDays, { className: "text-primary" }) })] }) }) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Yearly Spend" }), _jsxs("p", { className: "text-3xl font-bold text-gray-900", children: ["$", (metrics === null || metrics === void 0 ? void 0 : metrics.yearlySpend.toLocaleString()) || '0'] }), _jsxs("p", { className: "text-sm mt-1 flex items-center ".concat(getGrowthColor(8)), children: [getGrowthIcon(8), " 8% from last year"] })] }), _jsx("div", { className: "w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center", children: _jsx(TrendingUp, { className: "text-green-600" }) })] }) }) }), _jsx(Card, { className: "cursor-pointer hover:shadow-md transition-shadow", onClick: function () { return setActiveSubscriptionsModalOpen(true); }, children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Active Subscriptions" }), _jsx("p", { className: "text-3xl font-bold text-blue-600 hover:text-blue-700", children: (metrics === null || metrics === void 0 ? void 0 : metrics.activeSubscriptions) || 0 }), _jsxs("p", { className: "text-sm text-blue-600 mt-1 flex items-center", children: [_jsx(Users, { className: "w-4 h-4 mr-1" }), " Click to view details"] })] }), _jsx("div", { className: "w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center", children: _jsx(RefreshCw, { className: "text-blue-600" }) })] }) }) }), _jsx(Card, { className: "cursor-pointer hover:shadow-md transition-shadow", onClick: function () { return setUpcomingRenewalsModalOpen(true); }, children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Upcoming Renewals" }), _jsx("p", { className: "text-3xl font-bold text-orange-600 hover:text-orange-700", children: (metrics === null || metrics === void 0 ? void 0 : metrics.upcomingRenewals) || 0 }), _jsxs("p", { className: "text-sm text-orange-600 mt-1 flex items-center", children: [_jsx(Clock, { className: "w-4 h-4 mr-1" }), " Next 30 days - Click to view"] })] }), _jsx("div", { className: "w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center", children: _jsx(Bell, { className: "text-orange-600" }) })] }) }) })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Spending Trends" }) }), _jsx(CardContent, { children: trendsLoading ? (_jsx(Skeleton, { className: "h-80 w-full" })) : trends ? (_jsx(TrendsChart, { data: trends })) : (_jsx("div", { className: "h-80 flex items-center justify-center text-gray-500", children: "No trend data available" })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Category Breakdown" }) }), _jsx(CardContent, { children: categoriesLoading ? (_jsx(Skeleton, { className: "h-80 w-full" })) : categories ? (_jsx(CategoryChart, { data: categories })) : (_jsx("div", { className: "h-80 flex items-center justify-center text-gray-500", children: "No category data available" })) })] })] }), _jsx(Dialog, { open: activeSubscriptionsModalOpen, onOpenChange: setActiveSubscriptionsModalOpen, children: _jsxs(DialogContent, { className: "max-w-4xl max-h-[80vh] overflow-y-auto", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { children: ["Active Subscriptions (", activeSubscriptions.length, ")"] }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Service" }), _jsx(TableHead, { children: "Vendor" }), _jsx(TableHead, { children: "Amount" }), _jsx(TableHead, { children: "Billing Cycle" }), _jsx(TableHead, { children: "Next Renewal" }), _jsx(TableHead, { children: "Category" }), _jsx(TableHead, { children: "Reminder Policy" })] }) }), _jsx(TableBody, { children: activeSubscriptions.map(function (subscription) { return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: subscription.serviceName }), _jsx(TableCell, { children: subscription.vendor }), _jsxs(TableCell, { children: ["$", parseFloat(String(subscription.amount)).toFixed(2)] }), _jsx(TableCell, { className: "capitalize", children: subscription.billingCycle }), _jsx(TableCell, { children: new Date(subscription.nextRenewal).toLocaleDateString() }), _jsx(TableCell, { children: _jsx(Badge, { variant: "outline", children: subscription.category }) }), _jsxs(TableCell, { className: "text-sm", children: [subscription.reminderPolicy, " (", subscription.reminderDays, "d)"] })] }, subscription.id)); }) })] }) })] }) }), _jsx(Dialog, { open: upcomingRenewalsModalOpen, onOpenChange: setUpcomingRenewalsModalOpen, children: _jsxs(DialogContent, { className: "max-w-4xl max-h-[80vh] overflow-y-auto", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { children: ["Upcoming Renewals - Next 30 Days (", upcomingRenewals.length, ")"] }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Service" }), _jsx(TableHead, { children: "Vendor" }), _jsx(TableHead, { children: "Amount" }), _jsx(TableHead, { children: "Renewal Date" }), _jsx(TableHead, { children: "Days Until" }), _jsx(TableHead, { children: "Category" }), _jsx(TableHead, { children: "Reminder Policy" })] }) }), _jsx(TableBody, { children: upcomingRenewals.map(function (subscription) {
                                                var daysUntil = Math.ceil((new Date(subscription.nextRenewal).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "font-medium", children: subscription.serviceName }), _jsx(TableCell, { children: subscription.vendor }), _jsxs(TableCell, { children: ["$", parseFloat(String(subscription.amount)).toFixed(2)] }), _jsx(TableCell, { children: new Date(subscription.nextRenewal).toLocaleDateString() }), _jsx(TableCell, { children: _jsxs(Badge, { variant: daysUntil <= 7 ? "destructive" : daysUntil <= 14 ? "default" : "secondary", children: [daysUntil, " days"] }) }), _jsx(TableCell, { children: _jsx(Badge, { variant: "outline", children: subscription.category }) }), _jsxs(TableCell, { className: "text-sm", children: [subscription.reminderPolicy, " (", subscription.reminderDays, "d)"] })] }, subscription.id));
                                            }) })] }) })] }) })] }) }));
}
