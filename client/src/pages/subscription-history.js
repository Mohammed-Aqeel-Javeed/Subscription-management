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
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2, AlertCircle, Search, Download } from "lucide-react";
import { format } from "date-fns";
function formatDate(date) {
    return format(new Date(date), "MMM dd, yyyy");
}
export default function SubscriptionHistory() {
    var _this = this;
    // Get serviceName from query params if present
    var location = useLocation();
    // More robust extraction of id from URL
    var idParam = null;
    try {
        var urlParams = new URLSearchParams(location.search || "");
        idParam = urlParams.get("id");
    }
    catch (e) {
        idParam = null;
    }
    var serviceNameParam = null; // Not used
    var _a = useState(""), searchTerm = _a[0], setSearchTerm = _a[1];
    var _b = useState([]), filteredHistory = _b[0], setFilteredHistory = _b[1];
    var queryClient = useQueryClient();
    // Listen for subscription changes and refresh history
    React.useEffect(function () {
        function handleSubscriptionChange() {
            queryClient.invalidateQueries({ queryKey: ["history"] });
        }
        window.addEventListener('subscription-created', handleSubscriptionChange);
        window.addEventListener('subscription-updated', handleSubscriptionChange);
        window.addEventListener('account-changed', handleSubscriptionChange);
        window.addEventListener('login', handleSubscriptionChange);
        window.addEventListener('logout', handleSubscriptionChange);
        return function () {
            window.removeEventListener('subscription-created', handleSubscriptionChange);
            window.removeEventListener('subscription-updated', handleSubscriptionChange);
            window.removeEventListener('account-changed', handleSubscriptionChange);
            window.removeEventListener('login', handleSubscriptionChange);
            window.removeEventListener('logout', handleSubscriptionChange);
        };
    }, [queryClient]);
    var _c = useQuery({
        queryKey: ["history", idParam],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var url, res, errorText, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = idParam ? "/api/history/".concat(idParam) : "/api/history/list";
                        console.log("Fetching history data from: ".concat(url));
                        return [4 /*yield*/, fetch(url, {
                                headers: {
                                    "Cache-Control": "no-cache"
                                }
                            })];
                    case 1:
                        res = _a.sent();
                        if (!!res.ok) return [3 /*break*/, 3];
                        console.error("API returned status: ".concat(res.status));
                        return [4 /*yield*/, res.text()];
                    case 2:
                        errorText = _a.sent();
                        console.error("Error details: ".concat(errorText));
                        throw new Error("API error: ".concat(res.status));
                    case 3: return [4 /*yield*/, res.json()];
                    case 4:
                        result = _a.sent();
                        if (!Array.isArray(result)) {
                            console.error('Unexpected API response format:', result);
                            return [2 /*return*/, []];
                        }
                        console.log("Received ".concat(result.length, " history records from API"));
                        return [2 /*return*/, result];
                }
            });
        }); },
        retry: 1, // Retry once if request fails
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        staleTime: 0
    }), data = _c.data, isLoading = _c.isLoading, error = _c.error;
    var history = Array.isArray(data) ? data : [];
    // Filter based on search term only - the API already filters by subscriptionId
    useEffect(function () {
        if (!history)
            return;
        console.log("Starting filter with ".concat(history.length, " history records"));
        // Log all returned subscription IDs for debugging
        if (history && history.length > 0) {
            console.log('Returned history records:');
            history.forEach(function (item, idx) {
                var _a, _b, _c, _d, _e;
                var itemSubId = (_a = item.subscriptionId) === null || _a === void 0 ? void 0 : _a.toString();
                var dataId = (_c = (_b = item.data) === null || _b === void 0 ? void 0 : _b._id) === null || _c === void 0 ? void 0 : _c.toString();
                var updatedFieldsId = (_e = (_d = item.updatedFields) === null || _d === void 0 ? void 0 : _d._id) === null || _e === void 0 ? void 0 : _e.toString();
                console.log("Record #".concat(idx, ": subscriptionId=").concat(itemSubId, ", data._id=").concat(dataId, ", updatedFields._id=").concat(updatedFieldsId));
            });
            console.log("Selected subscription ID: ".concat(idParam));
        }
        // Create a copy of the array and ensure it's properly typed
        var filtered = __spreadArray([], history, true);
        // Log the initial history length
        console.log("Initial history records: ".concat(filtered.length));
        // We don't need to filter by subscription ID here since the API already does that
        // Apply search term filter
        if (searchTerm) {
            var searchLower_1 = searchTerm.toLowerCase();
            filtered = filtered.filter(function (item) {
                var _a, _b, _c, _d;
                var record = item.data || item.updatedFields || {};
                return (((_a = record.serviceName) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchLower_1)) ||
                    ((_b = record.owner) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(searchLower_1)) ||
                    ((_c = record.ownerName) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(searchLower_1)) ||
                    ((_d = record.status) === null || _d === void 0 ? void 0 : _d.toLowerCase().includes(searchLower_1)));
            });
        }
        // Sort by timestamp descending (newest first)
        filtered = filtered.sort(function (a, b) {
            var timeA = new Date(b.timestamp || '').getTime();
            var timeB = new Date(a.timestamp || '').getTime();
            if (timeA === timeB) {
                // If timestamps are equal, use _id for consistent ordering
                return (b._id || '').localeCompare(a._id || '');
            }
            return timeA - timeB;
        });
        setFilteredHistory(filtered);
    }, [history, searchTerm, idParam]); // Include idParam in dependencies
    var exportData = function () {
        // Implementation for exporting data
        console.log("Exporting data...");
    };
    var getStatusColor = function (status) {
        switch (status === null || status === void 0 ? void 0 : status.toLowerCase()) {
            case "active":
                return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
            case "inactive":
                return "bg-rose-100 text-rose-800 hover:bg-rose-200";
            case "pending":
                return "bg-amber-100 text-amber-800 hover:bg-amber-200";
            default:
                return "bg-slate-100 text-slate-800 hover:bg-slate-200";
        }
    };
    return (_jsx(motion.div, { className: "min-h-screen p-4 md:p-8 bg-gradient-to-br from-indigo-50 via-white to-cyan-50", initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5 }, children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs(motion.div, { className: "mb-8", initial: { y: -20, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { delay: 0.2, duration: 0.5 }, children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-700 to-cyan-600 bg-clip-text text-transparent", children: "Subscription History" }), _jsx("p", { className: "text-slate-600 mt-2", children: "Track all changes made to your subscriptions" })] }), _jsx("div", { className: "flex gap-3 mt-4 md:mt-0", children: _jsxs(Button, { variant: "outline", size: "sm", onClick: exportData, className: "flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm", children: [_jsx(Download, { className: "h-4 w-4" }), "Export"] }) })] }), _jsx("div", { className: "flex flex-col md:flex-row gap-4", children: _jsxs("div", { className: "relative flex-1", children: [_jsx("div", { className: "absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none", children: _jsx(Search, { className: "h-5 w-5 text-slate-400" }) }), _jsx(Input, { type: "text", className: "w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 shadow-sm", placeholder: "Search subscriptions...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); } })] }) })] }), _jsx(motion.div, { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { delay: 0.3, duration: 0.5 }, children: _jsx(Card, { className: "shadow-xl border border-slate-100 rounded-2xl bg-white overflow-hidden", children: _jsx(CardContent, { className: "p-0", children: isLoading ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20", children: [_jsx(motion.div, { animate: { rotate: 360 }, transition: { duration: 1, repeat: Infinity, ease: "linear" }, children: _jsx(Loader2, { className: "w-12 h-12 text-indigo-500" }) }), _jsx("p", { className: "text-slate-600 mt-4", children: "Loading subscription history..." })] })) : error ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20", children: [_jsx("div", { className: "bg-rose-50 rounded-full p-4 mb-4", children: _jsx(AlertCircle, { className: "w-10 h-10 text-rose-500" }) }), _jsx("p", { className: "text-rose-500 font-medium text-lg", children: "Failed to load history" }), _jsx("p", { className: "text-slate-500 mt-2", children: "Please try again later" })] })) : filteredHistory.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20", children: [_jsx("div", { className: "bg-slate-100 rounded-full p-5 mb-5", children: _jsx(AlertCircle, { className: "w-12 h-12 text-slate-400" }) }), _jsx("h3", { className: "text-xl font-medium text-slate-800 mb-2", children: searchTerm
                                            ? "No matching records found"
                                            : "No history records" }), _jsx("p", { className: "text-slate-600 max-w-md text-center", children: searchTerm
                                            ? "Try adjusting your search terms"
                                            : "No changes have been made to subscriptions yet" }), searchTerm && (_jsx(Button, { variant: "outline", className: "mt-4 border-indigo-300 text-indigo-700 hover:bg-indigo-50", onClick: function () { return setSearchTerm(""); }, children: "Clear Search" }))] })) : (_jsx(motion.div, { className: "w-full", initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.4 }, children: _jsxs(Table, { className: "w-full divide-y divide-slate-100", children: [_jsx(TableHeader, { className: "bg-slate-50", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "font-semibold text-slate-800 py-4 px-6", children: "Subscription" }), _jsx(TableHead, { className: "font-semibold text-slate-800 py-4 px-6", children: "Owner" }), _jsx(TableHead, { className: "font-semibold text-slate-800 py-4 px-6", children: "Service" }), _jsx(TableHead, { className: "font-semibold text-slate-800 py-4 px-6", children: "Start Date" }), _jsx(TableHead, { className: "font-semibold text-slate-800 py-4 px-6", children: "End Date" }), _jsx(TableHead, { className: "font-semibold text-slate-800 py-4 px-6", children: "Amount" }), _jsx(TableHead, { className: "font-semibold text-slate-800 py-4 px-6", children: "Status" })] }) }), _jsx(TableBody, { className: "divide-y divide-slate-100", children: _jsx(AnimatePresence, { children: filteredHistory.map(function (item, index) {
                                                    var record = item.data || item.updatedFields || {};
                                                    return (_jsxs(motion.tr, { className: "hover:bg-slate-50 transition-colors cursor-pointer", initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { delay: 0.05 * index }, whileHover: { scale: 1.01, backgroundColor: "#f8fafc" }, children: [_jsx(TableCell, { className: "py-4 px-6 font-medium text-slate-800", children: record.serviceName || "-" }), _jsx(TableCell, { className: "py-4 px-6 text-slate-700", children: record.owner || "-" }), _jsx(TableCell, { className: "py-4 px-6 text-slate-700", children: record.serviceName || "-" }), _jsx(TableCell, { className: "py-4 px-6 text-slate-600", children: record.startDate ? formatDate(record.startDate) : "-" }), _jsx(TableCell, { className: "py-4 px-6 text-slate-600", children: record.nextRenewal ? formatDate(record.nextRenewal) : "-" }), _jsx(TableCell, { className: "py-4 px-6 text-slate-700", children: record.amount !== undefined ? "$".concat(record.amount) : "-" }), _jsx(TableCell, { className: "py-4 px-6", children: _jsx(Badge, { className: getStatusColor(record.status || ''), children: record.status || "-" }) })] }, item._id || index));
                                                }) }) })] }) })) }) }) })] }) }));
}
