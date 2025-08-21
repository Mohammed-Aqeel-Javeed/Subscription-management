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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash2, Search, CreditCard, AlertCircle, Calendar, XCircle } from "lucide-react";
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
// Helper component to display departments
var DepartmentDisplay = function (_a) {
    var department = _a.department;
    if (!department)
        return _jsx("span", { children: "-" });
    try {
        // Try to parse as JSON array
        var parsed = JSON.parse(department);
        if (Array.isArray(parsed)) {
            return (_jsx("div", { className: "flex flex-wrap gap-1", children: parsed.map(function (d, index) { return (_jsx(Badge, { className: "bg-slate-100 text-slate-800", children: d }, index)); }) }));
        }
    }
    catch (e) {
        // If parsing fails, treat as a single department
        return (_jsx("div", { className: "flex flex-wrap gap-1", children: _jsx(Badge, { className: "bg-slate-100 text-slate-800", children: department }) }));
    }
    // Fallback
    return (_jsx("div", { className: "flex flex-wrap gap-1", children: _jsx(Badge, { className: "bg-slate-100 text-slate-800", children: department }) }));
};
export default function Subscriptions() {
    // ...existing code...
    // Removed duplicate declaration of subscriptions, isLoading, and refetch
    var _this = this;
    var _a;
    var _b = useState(false), modalOpen = _b[0], setModalOpen = _b[1];
    var _c = useState(), editingSubscription = _c[0], setEditingSubscription = _c[1];
    var _d = useState(""), searchTerm = _d[0], setSearchTerm = _d[1];
    var _e = useState("all"), categoryFilter = _e[0], setCategoryFilter = _e[1];
    var _f = useState("all"), vendorFilter = _f[0], setVendorFilter = _f[1];
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var tenantId = window.currentTenantId || ((_a = window.user) === null || _a === void 0 ? void 0 : _a.tenantId) || null;
    var _g = useQuery({
        queryKey: ["/api/subscriptions", tenantId],
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
        refetchInterval: false, // Disable auto-refresh
        gcTime: 0,
        staleTime: 0,
        retry: false,
        networkMode: "always",
        refetchIntervalInBackground: false
    }), subscriptions = _g.data, isLoading = _g.isLoading, refetch = _g.refetch; // Listen for login/logout/account change events and trigger immediate refetch
    React.useEffect(function () {
        function handleAccountChange() {
            // Invalidate and refetch immediately
            queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
            // Force an immediate refetch
            refetch();
        }
        // Add event listeners
        window.addEventListener('account-changed', handleAccountChange);
        window.addEventListener('login', handleAccountChange);
        window.addEventListener('logout', handleAccountChange);
        window.addEventListener('subscription-created', handleAccountChange);
        window.addEventListener('subscription-updated', handleAccountChange);
        window.addEventListener('subscription-deleted', handleAccountChange);
        // Trigger initial fetch
        handleAccountChange();
        return function () {
            // Remove event listeners
            window.removeEventListener('account-changed', handleAccountChange);
            window.removeEventListener('login', handleAccountChange);
            window.removeEventListener('logout', handleAccountChange);
            window.removeEventListener('subscription-created', handleAccountChange);
            window.removeEventListener('subscription-updated', handleAccountChange);
            window.removeEventListener('subscription-deleted', handleAccountChange);
        };
    }, [queryClient, refetch]);
    // Listen for new subscription created from modal
    React.useEffect(function () {
        function handleCreated(e) {
            if (e.detail) {
                setEditingSubscription(e.detail);
            }
        }
        window.addEventListener('subscription-created', handleCreated);
        return function () { return window.removeEventListener('subscription-created', handleCreated); };
    }, []);
    // Fetch recent activities
    var _h = useQuery({
        queryKey: ["/api/analytics/recent-activity"],
    }), recentActivitiesRaw = _h.data, isActivitiesLoading = _h.isLoading;
    // Ensure recentActivities is always an array
    var recentActivities = Array.isArray(recentActivitiesRaw) ? recentActivitiesRaw : [];
    // Watch for tenantId changes and trigger refetch
    React.useEffect(function () {
        var lastTenantId = tenantId;
        var lastSubscriptionCount = Array.isArray(subscriptions) ? subscriptions.length : 0;
        function checkChanges() {
            var _a;
            var currentTenantId = window.currentTenantId || ((_a = window.user) === null || _a === void 0 ? void 0 : _a.tenantId);
            var currentSubscriptionCount = Array.isArray(subscriptions) ? subscriptions.length : 0;
            if (currentTenantId !== lastTenantId || currentSubscriptionCount !== lastSubscriptionCount) {
                lastTenantId = currentTenantId;
                lastSubscriptionCount = currentSubscriptionCount;
                // Force immediate refetch
                queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
                refetch();
            }
        }
        // Check for changes every 5 seconds for better performance
        var intervalId = setInterval(checkChanges, 5000);
        // Initial check
        checkChanges();
        return function () { return clearInterval(intervalId); };
    }, [tenantId, refetch, subscriptions, queryClient]);
    var deleteMutation = useMutation({
        mutationFn: function (id) { return apiRequest("DELETE", "/api/subscriptions/".concat(id))
            .then(function (res) { return __awaiter(_this, void 0, void 0, function () {
            var data, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!res.ok) return [3 /*break*/, 2];
                        return [4 /*yield*/, res.json().catch(function () { return null; })];
                    case 1:
                        data = _b.sent();
                        if (data && data.message && data.message.includes("deleted")) {
                            return [2 /*return*/, data];
                        }
                        _b.label = 2;
                    case 2:
                        _a = Error.bind;
                        return [4 /*yield*/, res.text()];
                    case 3: 
                    // If not ok, throw error to trigger onError
                    throw new (_a.apply(Error, [void 0, _b.sent()]))();
                }
            });
        }); }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
            toast({
                title: "Success",
                description: "Subscription deleted successfully",
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete subscription",
                variant: "destructive",
            });
        },
    });
    var handleEdit = function (subscription) {
        var _a, _b;
        // Always use _id if present for editing
        var subscriptionId = ((_a = subscription._id) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = subscription.id) === null || _b === void 0 ? void 0 : _b.toString());
        if (!subscriptionId) {
            toast({
                title: "Error",
                description: "Invalid subscription ID",
                variant: "destructive",
            });
            return;
        }
        setEditingSubscription(__assign(__assign({}, subscription), { id: subscriptionId, _id: subscriptionId, billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "monthly", category: subscription.category && subscription.category !== "" ? subscription.category : "Software", status: subscription.status && subscription.status !== "" ? subscription.status : "Active", reminderPolicy: subscription.reminderPolicy && subscription.reminderPolicy !== "" ? subscription.reminderPolicy : "One time", amount: typeof subscription.amount === "string" ? parseFloat(subscription.amount) : subscription.amount }));
        setModalOpen(true);
    };
    var handleCloseModal = function () {
        setModalOpen(false);
        setEditingSubscription(undefined);
    };
    var handleDelete = function (id) {
        if (confirm("Are you sure you want to delete this subscription?")) {
            deleteMutation.mutate(id);
        }
    };
    var handleAddNew = function () {
        setEditingSubscription(undefined);
        setModalOpen(true);
    };
    var filteredSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter(function (sub) {
        // Only show subscriptions for current tenant
        if (tenantId && sub.tenantId !== tenantId)
            return false;
        var matchesSearch = sub.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sub.vendor.toLowerCase().includes(searchTerm.toLowerCase());
        var matchesCategory = categoryFilter === "all" || sub.category === categoryFilter;
        var matchesVendor = vendorFilter === "all" || sub.vendor === vendorFilter;
        return matchesSearch && matchesCategory && matchesVendor;
    }) : [];
    var uniqueCategories = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(function (sub) { return sub.category; }) : []));
    var uniqueVendors = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(function (sub) { return sub.vendor; }) : []));
    var getCategoryColor = function (category) {
        // No hardcoded categories, just default style
        return 'bg-gray-100 text-gray-800';
    };
    // Helper to display department(s) from JSON string or array
    var DepartmentDisplay = function (_a) {
        var department = _a.department;
        if (!department)
            return _jsx("span", { children: "-" });
        var departments = [];
        if (Array.isArray(department)) {
            departments = department;
        }
        else {
            try {
                var parsed = JSON.parse(department);
                if (Array.isArray(parsed)) {
                    departments = parsed;
                }
                else if (typeof parsed === 'string') {
                    departments = [parsed];
                }
            }
            catch (_b) {
                if (typeof department === 'string' && department.trim()) {
                    departments = [department];
                }
            }
        }
        if (!departments.length)
            return _jsx("span", { children: "-" });
        return (_jsx("div", { className: "flex flex-wrap gap-1", children: departments.map(function (dept, idx) { return (_jsx("span", { className: "inline-block bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full", children: dept }, dept + idx)); }) }));
    };
    // Helper to format date as dd/mm/yyyy
    var formatDate = function (dateStr) {
        if (!dateStr)
            return "";
        var d = new Date(dateStr);
        if (isNaN(d.getTime()))
            return dateStr;
        var dd = String(d.getDate()).padStart(2, '0');
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var yyyy = String(d.getFullYear());
        return "".concat(dd, "/").concat(mm, "/").concat(yyyy);
    };
    // Status badge component - exactly matching Compliance page
    var StatusBadge = function (_a) {
        var status = _a.status;
        var statusConfig = {
            "Active": {
                variant: "outline",
                icon: _jsx(AlertCircle, { className: "h-3 w-3 mr-1" }),
                color: "bg-emerald-50 text-emerald-700 border-emerald-200"
            },
            "Cancelled": {
                variant: "outline",
                icon: _jsx(AlertCircle, { className: "h-3 w-3 mr-1" }),
                color: "bg-rose-50 text-rose-700 border-rose-200"
            },
            "default": {
                variant: "outline",
                icon: _jsx(AlertCircle, { className: "h-3 w-3 mr-1" }),
                color: "bg-gray-100 text-gray-700 border-gray-200"
            }
        };
        var config = statusConfig[status] || statusConfig.default;
        return (_jsxs(Badge, { className: "".concat(config.color, " flex items-center font-medium"), variant: config.variant, children: [config.icon, status] }));
    };
    // --- Summary Stats Section ---
    var total = Array.isArray(subscriptions) ? subscriptions.length : 0;
    var active = Array.isArray(subscriptions) ? subscriptions.filter(function (sub) { return sub.status === "Active"; }).length : 0;
    var cancelled = Array.isArray(subscriptions) ? subscriptions.filter(function (sub) { return sub.status === "Cancelled"; }).length : 0;
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-6 border border-slate-200", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-6", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "flex items-center gap-4 mb-3", children: [_jsx("div", { className: "p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md", children: _jsx(CreditCard, { className: "h-7 w-7 text-white" }) }), _jsxs("div", { children: [_jsx(Skeleton, { className: "h-10 w-64 mb-2" }), _jsx(Skeleton, { className: "h-6 w-96" })] })] }) }), _jsx("div", { className: "flex flex-row gap-4 items-center", children: _jsx(Skeleton, { className: "h-12 w-48 rounded-xl" }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mt-4", children: [_jsx(Skeleton, { className: "h-20 w-full rounded-xl" }), _jsx(Skeleton, { className: "h-20 w-full rounded-xl" }), _jsx(Skeleton, { className: "h-20 w-full rounded-xl" })] })] }), _jsx(Card, { className: "mb-6 border-slate-200 shadow-md rounded-xl", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex flex-col md:flex-row gap-4", children: [_jsx("div", { className: "relative flex-1", children: _jsx(Skeleton, { className: "h-10 w-full rounded-lg" }) }), _jsxs("div", { className: "flex gap-4", children: [_jsx(Skeleton, { className: "h-10 w-48 rounded-lg" }), _jsx(Skeleton, { className: "h-10 w-48 rounded-lg" })] })] }) }) }), _jsx(Card, { className: "border-slate-200 shadow-lg rounded-2xl overflow-hidden", children: _jsx(CardContent, { className: "p-0", children: _jsx("div", { className: "space-y-2 p-6", children: Array.from({ length: 5 }).map(function (_, i) { return (_jsx(Skeleton, { className: "h-16 w-full" }, i)); }) }) }) })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative", children: [_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 mb-6 border border-slate-200", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-6", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "flex items-center gap-4 mb-3", children: [_jsx("div", { className: "p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md", children: _jsx(CreditCard, { className: "h-7 w-7 text-white" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-3xl md:text-4xl font-bold text-slate-900 tracking-tight", children: "Subscription Management" }), _jsx("p", { className: "text-slate-600 text-lg mt-1", children: "Manage all your active subscriptions" })] })] }) }), _jsxs("div", { className: "flex flex-row gap-4 items-center", children: [_jsxs(Button, { variant: "default", className: "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-md hover:scale-105 transition-transform", onClick: handleAddNew, title: "Add Subscription", children: [_jsx(Plus, { className: "h-5 w-5 mr-2" }), " Add New Subscription"] }), _jsxs(Button, { variant: "outline", className: "border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm", onClick: function () { return window.location.href = '/subscription-history'; }, children: [_jsx(Calendar, { className: "h-5 w-5 mr-2" }), " History"] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mt-4", children: [_jsxs(Card, { className: "bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-sm rounded-lg p-3 flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-white/20 rounded-lg", children: _jsx(CreditCard, { className: "h-6 w-6 text-white" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-white", children: total }), _jsx("div", { className: "text-white/90 text-sm", children: "Total Subscriptions" })] })] }), _jsxs(Card, { className: "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm rounded-lg p-3 flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-white/20 rounded-lg", children: _jsx(AlertCircle, { className: "h-6 w-6 text-white" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-white", children: active }), _jsx("div", { className: "text-white/90 text-sm", children: "Active" })] })] }), _jsxs(Card, { className: "bg-gradient-to-r from-rose-500 to-rose-600 shadow-sm rounded-lg p-3 flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-white/20 rounded-lg", children: _jsx(XCircle, { className: "h-6 w-6 text-white" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-white", children: cancelled }), _jsx("div", { className: "text-white/90 text-sm", children: "Cancelled" })] })] })] })] }), _jsx(Card, { className: "mb-6 border-slate-200 shadow-md rounded-xl", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex flex-col md:flex-row gap-4", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" }), _jsx(Input, { placeholder: "Search subscriptions...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "pl-12 border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg h-10" })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [_jsx("div", { className: "w-full sm:w-48", children: _jsxs(Select, { value: categoryFilter, onValueChange: setCategoryFilter, children: [_jsx(SelectTrigger, { className: "border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full", children: _jsx(SelectValue, { placeholder: "All Categories" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Categories" }), uniqueCategories.filter(function (category) { return category && category !== ""; }).map(function (category) { return (_jsx(SelectItem, { value: category, children: category }, category)); })] })] }) }), _jsx("div", { className: "w-full sm:w-48", children: _jsxs(Select, { value: vendorFilter, onValueChange: setVendorFilter, children: [_jsx(SelectTrigger, { className: "border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full", children: _jsx(SelectValue, { placeholder: "All Vendors" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Vendors" }), uniqueVendors.filter(function (vendor) { return vendor && vendor !== ""; }).map(function (vendor) { return (_jsx(SelectItem, { value: vendor, children: vendor }, vendor)); })] })] }) })] })] }) }) }), _jsx(Card, { className: "border-slate-200 shadow-lg rounded-2xl overflow-hidden", children: _jsx(CardContent, { className: "p-0", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { className: "min-w-full", children: [_jsx(TableHeader, { className: "bg-slate-50", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4", children: "Service Name" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4", children: "Vendor" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4", children: "Amount" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4", children: "Billing Cycle" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4 text-center", children: "Next Renewal" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4", children: "Status" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4", children: "Department" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4", children: "Category" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4", children: "Reminder Policy" }), _jsx(TableHead, { className: "font-semibold text-slate-700 text-sm py-3 px-4 text-right", children: "Actions" })] }) }), _jsx(TableBody, { children: filteredSubscriptions && filteredSubscriptions.length > 0 ? (filteredSubscriptions.map(function (subscription) { return (_jsxs(TableRow, { className: "hover:bg-slate-50 transition-colors", children: [_jsx(TableCell, { className: "py-3 px-4", children: _jsxs("div", { children: [_jsx("div", { className: "font-medium text-slate-900", children: subscription.serviceName }), subscription.notes && (_jsx("div", { className: "text-sm text-slate-500 mt-1", children: subscription.notes }))] }) }), _jsx(TableCell, { className: "text-slate-700 py-3 px-4", children: subscription.vendor }), _jsx(TableCell, { className: "font-medium text-slate-900 py-3 px-4", children: parseFloat(String(subscription.amount)).toFixed(2) }), _jsx(TableCell, { className: "text-slate-700 capitalize py-3 px-4", children: subscription.billingCycle }), _jsx(TableCell, { className: "text-center py-3 px-4", children: _jsxs("div", { className: "flex items-center justify-center gap-2 text-slate-700", children: [_jsx(Calendar, { className: "h-4 w-4 text-slate-400" }), formatDate(subscription.nextRenewal)] }) }), _jsx(TableCell, { className: "py-3 px-4", children: _jsx(StatusBadge, { status: subscription.status }) }), _jsx(TableCell, { className: "py-3 px-4", children: _jsx(DepartmentDisplay, { department: subscription.department }) }), _jsx(TableCell, { className: "py-3 px-4", children: _jsx(Badge, { className: getCategoryColor(subscription.category), children: subscription.category }) }), _jsxs(TableCell, { className: "text-sm text-slate-600 py-3 px-4", children: [subscription.reminderPolicy, " (", subscription.reminderDays, "d)"] }), _jsx(TableCell, { className: "text-right py-3 px-4", children: _jsxs("div", { className: "flex items-center justify-end space-x-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: function () { return handleEdit(subscription); }, className: "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg p-2 h-8 w-8", children: _jsx(Edit, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: function () { return handleDelete(subscription._id || subscription.id); }, className: "text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-2 h-8 w-8", disabled: deleteMutation.isPending, children: _jsx(Trash2, { size: 16 }) })] }) })] }, subscription._id || subscription.id)); })) : (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 9, className: "text-center py-12 text-slate-500", children: _jsxs("div", { className: "flex flex-col items-center justify-center", children: [_jsx(AlertCircle, { className: "h-12 w-12 text-slate-300 mb-3" }), _jsx("p", { className: "text-lg font-medium text-slate-600", children: "No subscription records found" }), _jsx("p", { className: "text-slate-500 mt-1", children: "Try adjusting your filters or add a new subscription" })] }) }) })) })] }) }) }) })] }), _jsx(SubscriptionModal, { open: modalOpen, onOpenChange: handleCloseModal, subscription: editingSubscription })] }));
}
