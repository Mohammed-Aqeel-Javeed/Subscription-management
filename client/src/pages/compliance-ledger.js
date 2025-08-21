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
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Search, FileText, Calendar, CheckCircle, XCircle, Clock, Filter } from "lucide-react";
// Helper to format date as dd/mm/yyyy
var formatDate = function (dateStr) {
    if (!dateStr)
        return "";
    var d = new Date(dateStr);
    if (isNaN(d.getTime()))
        return dateStr;
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yyyy = String(d.getFullYear());
    return "".concat(dd, "/").concat(mm, "/").concat(yyyy);
};
// Function to map status values and get appropriate icon
var getStatusInfo = function (status) {
    if (status === "Completed") {
        return {
            text: "Completed",
            variant: "default",
            icon: _jsx(CheckCircle, { className: "w-4 h-4" }),
            color: "bg-green-100 text-green-800"
        };
    }
    else if (status === "Pending") {
        return {
            text: "Pending",
            variant: "secondary",
            icon: _jsx(Clock, { className: "w-4 h-4" }),
            color: "bg-yellow-100 text-yellow-800"
        };
    }
    else {
        return {
            text: status,
            variant: "destructive",
            icon: _jsx(XCircle, { className: "w-4 h-4" }),
            color: "bg-red-100 text-red-800"
        };
    }
};
export default function ComplianceLedger() {
    var _this = this;
    // Read all ledger records from MongoDB
    var _a = React.useState([]), ledgerItems = _a[0], setLedgerItems = _a[1];
    var _b = React.useState(true), loading = _b[0], setLoading = _b[1];
    var _c = React.useState(""), searchTerm = _c[0], setSearchTerm = _c[1];
    var _d = React.useState("all"), selectedCategory = _d[0], setSelectedCategory = _d[1];
    var _e = React.useState([]), categories = _e[0], setCategories = _e[1];
    // Get compliance id from URL
    var getComplianceIdFromUrl = function () {
        var params = new URLSearchParams(window.location.search);
        return params.get("id");
    };
    var fetchLedger = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, data, complianceId_1, filteredData, categorySet_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setLoading(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch("/api/ledger/list")];
                case 2:
                    res = _b.sent();
                    if (!res.ok)
                        throw new Error("Failed to fetch ledger data");
                    return [4 /*yield*/, res.json()];
                case 3:
                    data = _b.sent();
                    complianceId_1 = getComplianceIdFromUrl();
                    filteredData = data;
                    if (complianceId_1) {
                        filteredData = data.filter(function (item) { return item.complianceId === complianceId_1 || item._id === complianceId_1; });
                    }
                    setLedgerItems(filteredData);
                    categorySet_1 = new Set();
                    filteredData.forEach(function (item) {
                        if (item.filingComplianceCategory && typeof item.filingComplianceCategory === 'string') {
                            categorySet_1.add(item.filingComplianceCategory);
                        }
                    });
                    setCategories(Array.from(categorySet_1));
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    setLedgerItems([]);
                    return [3 /*break*/, 5];
                case 5:
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    React.useEffect(function () {
        fetchLedger();
        // Re-fetch if URL changes
        window.addEventListener('popstate', fetchLedger);
        return function () { return window.removeEventListener('popstate', fetchLedger); };
    }, []);
    // Filter ledger items based on search term and category
    var filteredLedgerItems = React.useMemo(function () {
        var filtered = ledgerItems;
        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(function (item) {
                var _a, _b, _c;
                return ((_a = item.filingName) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    ((_b = item.filingComplianceCategory) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    ((_c = item.filingSubmissionStatus) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(searchTerm.toLowerCase()));
            });
        }
        // Filter by category
        if (selectedCategory !== "all") {
            filtered = filtered.filter(function (item) { return item.filingComplianceCategory === selectedCategory; });
        }
        return filtered;
    }, [ledgerItems, searchTerm, selectedCategory]);
    // Delete handler
    var handleDelete = function (id) { return __awaiter(_this, void 0, void 0, function () {
        var res, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!window.confirm('Do you want to delete this ledger record?')) return [3 /*break*/, 5];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch("/api/ledger/".concat(id), { method: "DELETE" })];
                case 2:
                    res = _b.sent();
                    if (!res.ok)
                        throw new Error("Failed to delete record");
                    return [4 /*yield*/, fetchLedger()];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (_jsx("div", { className: "min-h-screen p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx("div", { className: "mb-8", children: _jsxs("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900 tracking-tight", children: "Compliance General Ledger" }), _jsx("p", { className: "text-lg text-gray-600 mt-2 font-light", children: "View all compliance records and their audit history" })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" }), _jsx(Input, { placeholder: "Search filings...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" })] }), _jsxs("div", { className: "flex gap-3", children: [_jsxs(Select, { value: selectedCategory, onValueChange: setSelectedCategory, children: [_jsxs(SelectTrigger, { className: "w-full sm:w-48 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500", children: [_jsx(Filter, { className: "w-4 h-4 mr-2" }), _jsx(SelectValue, { placeholder: "All Categories" })] }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Categories" }), categories.map(function (category) { return (_jsx(SelectItem, { value: category, children: category }, category)); })] })] }), _jsx(Button, { onClick: fetchLedger, className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md", children: "Refresh" })] })] })] }) }), _jsxs(Card, { className: "shadow-lg border-0 overflow-hidden bg-white/80 backdrop-blur-sm", children: [_jsx(CardHeader, { className: "bg-gradient-to-r from-indigo-100 to-blue-100 border-b border-gray-200", children: _jsxs(CardTitle, { className: "flex items-center gap-2 text-xl font-semibold text-gray-800", children: [_jsx(FileText, { className: "w-5 h-5 text-indigo-600" }), "Compliance Records", _jsxs(Badge, { className: "ml-2 bg-indigo-100 text-indigo-800", children: [filteredLedgerItems.length, " ", filteredLedgerItems.length === 1 ? 'Record' : 'Records'] })] }) }), _jsx(CardContent, { className: "p-0", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { children: [_jsx(TableHeader, { className: "bg-gray-50", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "font-semibold text-gray-700", children: "Filing Name" }), _jsx(TableHead, { className: "font-semibold text-gray-700", children: "Category" }), _jsx(TableHead, { className: "font-semibold text-gray-700", children: "Start Date" }), _jsx(TableHead, { className: "font-semibold text-gray-700", children: "End Date" }), _jsx(TableHead, { className: "font-semibold text-gray-700", children: "Submission Date" }), _jsx(TableHead, { className: "font-semibold text-gray-700", children: "Status" }), _jsx(TableHead, { className: "font-semibold text-gray-700 text-right", children: "Actions" })] }) }), _jsx(TableBody, { children: loading ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, className: "text-center py-12", children: _jsxs("div", { className: "flex flex-col items-center justify-center", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3" }), _jsx("p", { className: "text-gray-600", children: "Loading compliance records..." })] }) }) })) : filteredLedgerItems.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, className: "text-center py-12", children: _jsxs("div", { className: "flex flex-col items-center justify-center", children: [_jsx(FileText, { className: "w-12 h-12 text-gray-400 mb-3" }), _jsx("p", { className: "text-lg font-medium text-gray-900", children: "No records found" }), _jsx("p", { className: "text-gray-500 mt-1", children: "Try adjusting your search or check back later" })] }) }) })) : (filteredLedgerItems.map(function (item) {
                                                var statusInfo = getStatusInfo(item.filingSubmissionStatus);
                                                return (_jsxs(TableRow, { className: "hover:bg-gray-50 transition-colors", children: [_jsx(TableCell, { className: "font-medium text-gray-900", children: item.filingName }), _jsx(TableCell, { children: _jsx("div", { className: "flex items-center", children: _jsx("span", { className: "bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full", children: item.filingComplianceCategory }) }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center text-gray-700", children: [_jsx(Calendar, { className: "w-4 h-4 mr-2 text-gray-500" }), formatDate(item.filingStartDate)] }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center text-gray-700", children: [_jsx(Calendar, { className: "w-4 h-4 mr-2 text-gray-500" }), formatDate(item.filingEndDate)] }) }), _jsx(TableCell, { children: _jsxs("div", { className: "flex items-center text-gray-700", children: [_jsx(Calendar, { className: "w-4 h-4 mr-2 text-gray-500" }), formatDate(item.filingSubmissionDate)] }) }), _jsx(TableCell, { children: _jsxs(Badge, { className: "".concat(statusInfo.color, " flex items-center gap-1"), children: [statusInfo.icon, statusInfo.text] }) }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(Button, { variant: "ghost", size: "sm", className: "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50", children: _jsx(Edit, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", className: "text-red-600 hover:text-red-800 hover:bg-red-50", onClick: function () { return handleDelete(item._id); }, children: _jsx(Trash2, { size: 16 }) })] }) })] }, item._id));
                                            })) })] }) }) })] })] }) }));
}
