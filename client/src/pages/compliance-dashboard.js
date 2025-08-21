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
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Calendar } from "lucide-react";
import ComplianceTrendsChart from "@/components/charts/compliance-trends-chart";
import ComplianceCategoryChart from "@/components/charts/compliance-category-chart";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
// Error boundary wrapper
function ErrorBoundary(_a) {
    var children = _a.children;
    // No error boundary needed, just render children
    return _jsx(React.Fragment, { children: children });
}
export default function ComplianceDashboard() {
    var _this = this;
    var navigate = useNavigate();
    var _a = useState(false), activeIssuesModalOpen = _a[0], setActiveIssuesModalOpen = _a[1];
    var _b = useState(false), upcomingDeadlinesModalOpen = _b[0], setUpcomingDeadlinesModalOpen = _b[1];
    var _c = useState(false), authChecked = _c[0], setAuthChecked = _c[1];
    // Fetch all compliance filings (live data)
    var _d = useQuery({
        queryKey: ["/api/compliance/list"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/compliance/list", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("Failed to fetch compliance data");
                        return [2 /*return*/, res.json()];
                }
            });
        }); },
        refetchInterval: false, // Disable auto-refresh
    }), complianceList = _d.data, complianceLoading = _d.isLoading;
    // Compute metrics, issues, deadlines from complianceList
    var now = useMemo(function () { return new Date(); }, []);
    // Compute trends data (submissions per month for last 6 months)
    var trendsData = useMemo(function () {
        if (!complianceList)
            return [];
        var months = {};
        var nowDate = new Date();
        for (var i = 5; i >= 0; i--) {
            var d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
            var key = "".concat(d.getFullYear(), "-").concat((d.getMonth() + 1).toString().padStart(2, "0"));
            months[key] = { submitted: 0, total: 0 };
        }
        complianceList.forEach(function (c) {
            if (!c.createdAt)
                return;
            var created = new Date(c.createdAt);
            var key = "".concat(created.getFullYear(), "-").concat((created.getMonth() + 1).toString().padStart(2, "0"));
            if (months[key]) {
                months[key].total++;
                if (c.status === "Submitted")
                    months[key].submitted++;
            }
        });
        return Object.entries(months).map(function (_a) {
            var date = _a[0], v = _a[1];
            return (__assign({ date: date }, v));
        });
    }, [complianceList]);
    // Compute category breakdown (issues by category)
    var categoryData = useMemo(function () {
        if (!complianceList)
            return [];
        var map = {};
        complianceList.forEach(function (c) {
            if (!c.category)
                return;
            if (!map[c.category])
                map[c.category] = 0;
            if (["Pending", "Overdue"].includes(c.status))
                map[c.category]++;
        });
        return Object.entries(map).map(function (_a) {
            var category = _a[0], count = _a[1];
            return ({ category: category, count: count });
        });
    }, [complianceList]);
    var metrics = useMemo(function () {
        if (!complianceList)
            return {};
        var total = complianceList.length;
        var completed = complianceList.filter(function (c) { return c.status === "Submitted"; }).length;
        var complianceScore = total ? Math.round((completed / total) * 100) : 100;
        var requiredActions = complianceList.filter(function (c) { return ["Pending", "Overdue"].includes(c.status); }).length;
        var activeIssues = complianceList.filter(function (c) { return c.status === "Overdue"; }).length;
        var upcomingDeadlines = complianceList.filter(function (c) {
            if (!c.submissionDeadline || c.status === "Submitted")
                return false;
            var deadline = new Date(c.submissionDeadline);
            return deadline >= now && deadline <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }).length;
        return { complianceScore: complianceScore, requiredActions: requiredActions, activeIssues: activeIssues, upcomingDeadlines: upcomingDeadlines };
    }, [complianceList, now]);
    var activeIssues = useMemo(function () {
        if (!complianceList)
            return [];
        return complianceList.filter(function (c) { return c.status === "Overdue"; });
    }, [complianceList]);
    var upcomingDeadlines = useMemo(function () {
        if (!complianceList)
            return [];
        return complianceList.filter(function (c) {
            if (!c.submissionDeadline || c.status === "Submitted")
                return false;
            var deadline = new Date(c.submissionDeadline);
            return deadline >= now && deadline <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        });
    }, [complianceList, now]);
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
            if (token) {
                setAuthChecked(true);
            }
            else {
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
    if (complianceLoading) {
        return (_jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx(Skeleton, { className: "h-8 w-48 mb-2" }), _jsx(Skeleton, { className: "h-4 w-96" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: Array.from({ length: 4 }).map(function (_, i) { return (_jsx(Skeleton, { className: "h-32" }, i)); }) })] }));
    }
    return (_jsx(ErrorBoundary, { children: _jsxs("div", { className: "p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen", children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }, children: _jsx(motion.button, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, onClick: handleLogout, style: {
                            padding: '8px 16px',
                            background: '#f44336',
                            color: '#fff',
                            border: 0,
                            borderRadius: 4,
                            fontWeight: 600
                        }, children: "Logout" }) }), _jsxs("div", { className: "flex gap-4 mb-8", children: [_jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.98 }, children: _jsx(Button, { variant: window.location.pathname === '/dashboard' ? 'default' : 'outline', onClick: function () { return handleTabClick('subscription'); }, className: "transition-all duration-300", children: "Subscription" }) }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.98 }, children: _jsx(Button, { variant: window.location.pathname === '/compliance-dashboard' ? 'default' : 'outline', onClick: function () { return handleTabClick('compliance'); }, className: "transition-all duration-300", children: "Compliance" }) })] }), _jsxs(motion.div, { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 }, className: "mb-8", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900", children: "Compliance Dashboard" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Overview of your compliance status and analytics" })] }), _jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.2, duration: 0.5 }, className: "mb-6 flex justify-between items-center", children: _jsxs("div", { className: "flex space-x-4", children: [_jsxs(Select, { defaultValue: "30days", children: [_jsx(SelectTrigger, { className: "w-48 transition-all duration-300 hover:border-blue-400 focus:border-blue-500", children: _jsx(SelectValue, { placeholder: "Last 30 days" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "30days", children: "Last 30 days" }), _jsx(SelectItem, { value: "90days", children: "Last 90 days" }), _jsx(SelectItem, { value: "custom", children: "Custom range" })] })] }), _jsxs(Select, { defaultValue: "all", children: [_jsx(SelectTrigger, { className: "w-48 transition-all duration-300 hover:border-blue-400 focus:border-blue-500", children: _jsx(SelectValue, { placeholder: "All Categories" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Categories" }), _jsx(SelectItem, { value: "security", children: "Security" }), _jsx(SelectItem, { value: "privacy", children: "Privacy" }), _jsx(SelectItem, { value: "regulatory", children: "Regulatory" })] })] })] }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: [_jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3, duration: 0.5 }, whileHover: { y: -5 }, children: _jsx(Card, { className: "h-full transition-all duration-300 hover:shadow-lg border-l-4 border-l-green-500", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Compliance Score" }), _jsx("p", { className: "text-3xl font-bold text-gray-900", children: (metrics === null || metrics === void 0 ? void 0 : metrics.complianceScore) != null ? "".concat(metrics.complianceScore, "%") : '0%' }), _jsxs("p", { className: "text-sm mt-1 flex items-center text-green-600", children: [_jsx(TrendingUp, { className: "w-4 h-4 mr-1" }), " 5% from last period"] })] }), _jsx("div", { className: "w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center", children: _jsx(CheckCircle, { className: "text-green-600" }) })] }) }) }) }), _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.4, duration: 0.5 }, whileHover: { y: -5 }, children: _jsx(Card, { className: "h-full transition-all duration-300 hover:shadow-lg border-l-4 border-l-orange-500", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Required Actions" }), _jsx("p", { className: "text-3xl font-bold text-gray-900", children: (metrics === null || metrics === void 0 ? void 0 : metrics.requiredActions) || 0 }), _jsxs("p", { className: "text-sm mt-1 flex items-center text-orange-600", children: [_jsx(Clock, { className: "w-4 h-4 mr-1" }), " Need attention"] })] }), _jsx("div", { className: "w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center", children: _jsx(AlertTriangle, { className: "text-orange-600" }) })] }) }) }) }), _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.5, duration: 0.5 }, whileHover: { y: -5 }, className: "md:col-span-2 lg:col-span-2", children: _jsx(Card, { className: "h-full transition-all duration-300 hover:shadow-lg", children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex flex-col md:flex-row gap-4 h-full", children: [_jsx(motion.div, { className: "flex-1", whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, children: _jsxs(Button, { variant: "outline", className: "w-full h-full flex flex-col items-center justify-center p-6 transition-all duration-300 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50", onClick: function () { return navigate("/calendar-monthly"); }, children: [_jsx(Calendar, { className: "h-8 w-8 text-blue-500 mb-2" }), _jsx("span", { className: "text-lg font-medium", children: "Monthly Calendar" })] }) }), _jsx(motion.div, { className: "flex-1", whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, children: _jsxs(Button, { variant: "outline", className: "w-full h-full flex flex-col items-center justify-center p-6 transition-all duration-300 border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50", onClick: function () { return navigate("/calendar-yearly"); }, children: [_jsx(Calendar, { className: "h-8 w-8 text-purple-500 mb-2" }), _jsx("span", { className: "text-lg font-medium", children: "Yearly Calendar" })] }) })] }) }) }) })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8", children: [_jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.6, duration: 0.5 }, whileHover: { y: -5 }, children: _jsxs(Card, { className: "h-full transition-all duration-300 hover:shadow-lg", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center", children: [_jsx(TrendingUp, { className: "mr-2 h-5 w-5 text-blue-500" }), "Compliance Trends"] }) }), _jsx(CardContent, { className: "h-80", children: _jsx(ComplianceTrendsChart, { data: trendsData }) })] }) }), _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.7, duration: 0.5 }, whileHover: { y: -5 }, children: _jsxs(Card, { className: "h-full transition-all duration-300 hover:shadow-lg", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center", children: [_jsx(AlertTriangle, { className: "mr-2 h-5 w-5 text-orange-500" }), "Issue Categories"] }) }), _jsx(CardContent, { className: "h-80", children: _jsx(ComplianceCategoryChart, { data: categoryData }) })] }) })] }), _jsx(Dialog, { open: activeIssuesModalOpen, onOpenChange: setActiveIssuesModalOpen, children: _jsxs(DialogContent, { className: "max-w-4xl max-h-[80vh] overflow-y-auto backdrop-blur-sm bg-white/95", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { className: "flex items-center", children: [_jsx(AlertTriangle, { className: "mr-2 h-5 w-5 text-red-500" }), "Active Compliance Issues (", (activeIssues === null || activeIssues === void 0 ? void 0 : activeIssues.length) || 0, ")"] }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Issue" }), _jsx(TableHead, { children: "Category" }), _jsx(TableHead, { children: "Severity" }), _jsx(TableHead, { children: "Status" }), _jsx(TableHead, { children: "Due Date" }), _jsx(TableHead, { children: "Assigned To" })] }) }), _jsx(TableBody, { children: activeIssues === null || activeIssues === void 0 ? void 0 : activeIssues.map(function (issue) {
                                                var dueDate = issue.submissionDeadline ? new Date(issue.submissionDeadline) : null;
                                                return (_jsxs(TableRow, { className: "hover:bg-gray-50 transition-colors", children: [_jsx(TableCell, { className: "font-medium", children: issue.filingName }), _jsx(TableCell, { children: _jsx(Badge, { variant: "outline", children: issue.category }) }), _jsx(TableCell, { children: _jsx(Badge, { variant: dueDate && (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7 ? 'destructive' :
                                                                    dueDate && (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 14 ? 'default' :
                                                                        'secondary', children: dueDate && (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7 ? 'High' :
                                                                    dueDate && (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 14 ? 'Medium' :
                                                                        'Low' }) }), _jsx(TableCell, { children: issue.status }), _jsx(TableCell, { children: dueDate ? dueDate.toLocaleDateString() : '' }), _jsx(TableCell, { children: issue.assignedTo || '-' })] }, issue._id));
                                            }) })] }) })] }) }), _jsx(Dialog, { open: upcomingDeadlinesModalOpen, onOpenChange: setUpcomingDeadlinesModalOpen, children: _jsxs(DialogContent, { className: "max-w-4xl max-h-[80vh] overflow-y-auto backdrop-blur-sm bg-white/95", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { className: "flex items-center", children: [_jsx(Clock, { className: "mr-2 h-5 w-5 text-orange-500" }), "Upcoming Deadlines - Next 30 Days"] }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: "Task" }), _jsx(TableHead, { children: "Category" }), _jsx(TableHead, { children: "Priority" }), _jsx(TableHead, { children: "Due Date" }), _jsx(TableHead, { children: "Days Until Due" }), _jsx(TableHead, { children: "Status" })] }) }), _jsx(TableBody, { children: upcomingDeadlines === null || upcomingDeadlines === void 0 ? void 0 : upcomingDeadlines.map(function (deadline) {
                                                var dueDate = deadline.submissionDeadline ? new Date(deadline.submissionDeadline) : null;
                                                var daysUntil = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : '';
                                                return (_jsxs(TableRow, { className: "hover:bg-gray-50 transition-colors", children: [_jsx(TableCell, { className: "font-medium", children: deadline.filingName }), _jsx(TableCell, { children: _jsx(Badge, { variant: "outline", children: deadline.category }) }), _jsx(TableCell, { children: _jsx(Badge, { variant: daysUntil !== '' && daysUntil <= 7 ? 'destructive' :
                                                                    daysUntil !== '' && daysUntil <= 14 ? 'default' :
                                                                        'secondary', children: daysUntil !== '' && daysUntil <= 7 ? 'High' :
                                                                    daysUntil !== '' && daysUntil <= 14 ? 'Medium' :
                                                                        'Low' }) }), _jsx(TableCell, { children: dueDate ? dueDate.toLocaleDateString() : '' }), _jsx(TableCell, { children: _jsx(Badge, { variant: daysUntil !== '' && daysUntil <= 7 ? 'destructive' :
                                                                    daysUntil !== '' && daysUntil <= 14 ? 'default' :
                                                                        'secondary', children: daysUntil !== '' ? daysUntil + ' days' : '' }) }), _jsx(TableCell, { children: deadline.status })] }, deadline._id));
                                            }) })] }) })] }) })] }) }));
}
