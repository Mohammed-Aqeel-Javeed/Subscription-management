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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash2, Search, Calendar, FileText, AlertCircle, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// Helper functions remain the same
var mapStatus = function (status) {
    return "Pending";
};
var calculateEndDate = function (start, freq) {
    if (!start)
        return "";
    var date = new Date(start);
    var endDate = new Date(date);
    if (freq === "Yearly") {
        endDate.setFullYear(date.getFullYear() + 1);
        endDate.setDate(endDate.getDate() - 1);
    }
    else if (freq === "Quarterly") {
        endDate.setMonth(date.getMonth() + 3);
        endDate.setDate(endDate.getDate() - 1);
    }
    else if (freq === "Monthly") {
        endDate.setMonth(date.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
    }
    var yyyy = endDate.getFullYear();
    var mm = String(endDate.getMonth() + 1).padStart(2, "0");
    var dd = String(endDate.getDate()).padStart(2, "0");
    return "".concat(yyyy, "-").concat(mm, "-").concat(dd);
};
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
function getNextPeriodDates(startDate, endDate, frequency) {
    var start = new Date(endDate);
    var nextStart = new Date(start);
    var nextEnd = new Date(start);
    nextStart.setDate(start.getDate() + 1);
    if (frequency === "Monthly") {
        nextEnd.setMonth(nextStart.getMonth() + 1);
        nextEnd.setDate(nextEnd.getDate() - 1);
    }
    else if (frequency === "Quarterly") {
        nextEnd.setMonth(nextStart.getMonth() + 3);
        nextEnd.setDate(nextEnd.getDate() - 1);
    }
    else if (frequency === "Yearly") {
        nextEnd.setFullYear(nextStart.getFullYear() + 1);
        nextEnd.setDate(nextEnd.getDate() - 1);
    }
    var format = function (d) {
        return "".concat(d.getFullYear(), "-").concat(String(d.getMonth() + 1).padStart(2, "0"), "-").concat(String(d.getDate()).padStart(2, "0"));
    };
    return { nextStartDate: format(nextStart), nextEndDate: format(nextEnd) };
}
export default function Compliance() {
    var _this = this;
    var _a;
    // --- Dynamic Compliance Fields ---
    var _b = useState([]), complianceFields = _b[0], setComplianceFields = _b[1];
    var _c = useState(true), isLoadingComplianceFields = _c[0], setIsLoadingComplianceFields = _c[1];
    useEffect(function () {
        var fetchComplianceFields = function () {
            setIsLoadingComplianceFields(true);
            fetch('/api/config/compliance-fields')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                if (Array.isArray(data))
                    setComplianceFields(data);
                else
                    setComplianceFields([]);
            })
                .catch(function () { return setComplianceFields([]); })
                .finally(function () { return setIsLoadingComplianceFields(false); });
        };
        fetchComplianceFields();
        // Add event listeners for account changes
        window.addEventListener("accountChanged", fetchComplianceFields);
        window.addEventListener("logout", fetchComplianceFields);
        window.addEventListener("login", fetchComplianceFields);
        return function () {
            window.removeEventListener("accountChanged", fetchComplianceFields);
            window.removeEventListener("logout", fetchComplianceFields);
            window.removeEventListener("login", fetchComplianceFields);
        };
    }, []);
    // Store dynamic field values in form state
    var _d = useState({}), dynamicFieldValues = _d[0], setDynamicFieldValues = _d[1];
    var _e = useState(""), searchTerm = _e[0], setSearchTerm = _e[1];
    var _f = useState("all"), categoryFilter = _f[0], setCategoryFilter = _f[1];
    var _g = useState("all"), statusFilter = _g[0], setStatusFilter = _g[1];
    var _h = useState(false), modalOpen = _h[0], setModalOpen = _h[1];
    var _j = useState(null), editIndex = _j[0], setEditIndex = _j[1];
    var _k = useState({
        filingName: "",
        filingFrequency: "Monthly",
        filingComplianceCategory: "",
        filingGoverningAuthority: "",
        filingStartDate: "",
        filingEndDate: "",
        filingSubmissionDeadline: "",
        filingSubmissionStatus: "Pending",
        filingRecurringFrequency: "",
        filingRemarks: "",
        filingSubmissionDate: "",
        reminderDays: "7",
        reminderPolicy: "One time",
        submittedBy: "",
        amount: "",
    }), form = _k[0], setForm = _k[1];
    // Fetch employees for the submit by dropdown with auto-refresh
    var _l = useQuery({
        queryKey: ["/api/employees"], // Match the queryKey used in company-details.tsx
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/employees")];
                    case 1:
                        response = _a.sent();
                        if (!response.ok)
                            throw new Error("Failed to fetch employees");
                        return [2 /*return*/, response.json()];
                }
            });
        }); },
        refetchInterval: false, // Disable auto-refresh
        refetchOnWindowFocus: true, // Refresh when window regains focus
        refetchOnMount: true, // Refresh when component mounts
        staleTime: 0 // Consider data immediately stale so it refreshes
    }).data, employees = _l === void 0 ? [] : _l;
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var handleFormChange = function (field, value) {
        setForm(function (prev) {
            var _a;
            var newState = __assign(__assign({}, prev), (_a = {}, _a[field] = value, _a));
            if (field === "filingStartDate" || field === "filingFrequency") {
                var startDate = field === "filingStartDate" ? value : prev.filingStartDate;
                var frequency = field === "filingFrequency" ? value : prev.filingFrequency;
                var endDate = calculateEndDate(startDate, frequency);
                return __assign(__assign({}, newState), { filingStartDate: startDate, filingEndDate: endDate });
            }
            return newState;
        });
    };
    // For dynamic compliance fields
    var handleDynamicFieldChange = function (fieldName, value) {
        setDynamicFieldValues(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[fieldName] = value, _a)));
        });
    };
    var _m = useQuery({
        queryKey: ["compliance"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/compliance/list")];
                    case 1:
                        response = _a.sent();
                        if (!response.ok)
                            throw new Error("Failed to fetch compliance filings");
                        return [2 /*return*/, response.json()];
                }
            });
        }); },
        refetchInterval: false, // Disable auto-refresh
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        staleTime: 0 // Always consider data stale
    }), _o = _m.data, complianceItems = _o === void 0 ? [] : _o, isLoading = _m.isLoading;
    useEffect(function () {
        var invalidateCompliance = function () {
            queryClient.invalidateQueries({ queryKey: ["compliance"] });
        };
        window.addEventListener("accountChanged", invalidateCompliance);
        window.addEventListener("logout", invalidateCompliance);
        window.addEventListener("login", invalidateCompliance);
        return function () {
            window.removeEventListener("accountChanged", invalidateCompliance);
            window.removeEventListener("logout", invalidateCompliance);
            window.removeEventListener("login", invalidateCompliance);
        };
    }, [queryClient]);
    var addMutation = useMutation({
        mutationFn: function (data) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/compliance/insert", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(data)
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok)
                            throw new Error("Failed to save compliance");
                        return [2 /*return*/, response.json()];
                }
            });
        }); },
        onSuccess: function (newItem) {
            queryClient.setQueryData(["compliance"], function (oldData) {
                return oldData ? __spreadArray(__spreadArray([], oldData, true), [newItem], false) : [newItem];
            });
            queryClient.invalidateQueries({ queryKey: ["compliance"] });
        }
    });
    var deleteMutation = useMutation({
        mutationFn: function (_id) { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/compliance/".concat(_id), { method: "DELETE" })];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("Failed to delete compliance item.");
                        return [2 /*return*/, _id];
                }
            });
        }); },
        onSuccess: function (deletedId) {
            queryClient.setQueryData(["compliance"], function (oldData) {
                return oldData ? oldData.filter(function (item) { return item._id !== deletedId; }) : [];
            });
            queryClient.invalidateQueries({ queryKey: ["compliance"] });
        }
    });
    var editMutation = useMutation({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var res;
            var _id = _b._id, data = _b.data;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, fetch("/api/compliance/".concat(_id), {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(data)
                        })];
                    case 1:
                        res = _c.sent();
                        if (!res.ok)
                            throw new Error("Failed to update compliance item.");
                        return [2 /*return*/, { _id: _id, data: data }];
                }
            });
        }); },
        onSuccess: function (_a) {
            var _id = _a._id, data = _a.data;
            queryClient.setQueryData(["compliance"], function (oldData) {
                return oldData ? oldData.map(function (item) {
                    return item._id === _id ? __assign(__assign({}, item), data) : item;
                }) : [];
            });
            queryClient.invalidateQueries({ queryKey: ["compliance"] });
        }
    });
    var uniqueCategories = Array.from(new Set(complianceItems.map(function (item) { return item.category; }))).filter(Boolean);
    var filteredItems = complianceItems.filter(function (item) {
        var _a;
        var matchesSearch = (_a = item.policy) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchTerm.toLowerCase());
        var matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        var matchesStatus = statusFilter === "all" || mapStatus(item.status) === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
    });
    // Status badge component
    var StatusBadge = function (_a) {
        var status = _a.status;
        var statusConfig = {
            "Pending": {
                variant: "outline",
                icon: _jsx(AlertCircle, { className: "h-3 w-3 mr-1" }),
                color: "bg-amber-50 text-amber-700 border-amber-200"
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
    var total = complianceItems.length;
    var pending = complianceItems.filter(function (item) { return mapStatus(item.status) === "Pending"; }).length;
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative", children: [_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-4 md:p-6 mb-6 border border-slate-200", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md", children: _jsx(FileText, { className: "h-7 w-7 text-white" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold text-slate-900 tracking-tight", children: "Compliance Management" }), _jsx("p", { className: "text-slate-600", children: "Enterprise Compliance Tracking System" })] })] }), _jsxs("div", { className: "flex flex-row gap-3 items-center", children: [_jsxs(Button, { variant: "outline", className: "border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold shadow-sm hover:shadow-md transition-all duration-300 h-10", onClick: function () {
                                                    window.location.href = "/compliance-ledger";
                                                }, children: [_jsx(FileText, { className: "h-4 w-4 mr-2" }), " Compliance Ledger"] }), _jsxs(Button, { variant: "default", className: "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-md hover:scale-105 transition-transform h-10", onClick: function () {
                                                    setEditIndex(null);
                                                    setForm({
                                                        filingName: "",
                                                        filingFrequency: "Monthly",
                                                        filingComplianceCategory: "",
                                                        filingGoverningAuthority: "",
                                                        filingStartDate: "",
                                                        filingEndDate: "",
                                                        filingSubmissionDeadline: "",
                                                        filingSubmissionStatus: "Pending",
                                                        filingRecurringFrequency: "",
                                                        filingRemarks: "",
                                                        filingSubmissionDate: "",
                                                        reminderDays: "7",
                                                        reminderPolicy: "One time",
                                                        submittedBy: "",
                                                        amount: ""
                                                    });
                                                    setModalOpen(true);
                                                }, title: "Add Compliance", children: [_jsx(Plus, { className: "h-5 w-5 mr-2" }), " Add Compliance"] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-3", children: [_jsxs("div", { className: "bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-3 flex items-center gap-3", children: [_jsx(FileText, { className: "h-6 w-6 text-white" }), _jsxs("div", { children: [_jsx("div", { className: "text-xl font-bold text-white", children: total }), _jsx("div", { className: "text-white text-xs", children: "Total Filings" })] })] }), _jsxs("div", { className: "bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl shadow-lg p-3 flex items-center gap-3", children: [_jsx(AlertCircle, { className: "h-6 w-6 text-white" }), _jsxs("div", { children: [_jsx("div", { className: "text-xl font-bold text-white", children: pending }), _jsx("div", { className: "text-white text-xs", children: "Pending" })] })] }), _jsxs("div", { className: "col-span-2 flex items-center gap-2", children: [_jsxs("div", { className: "relative w-1/2", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" }), _jsx(Input, { placeholder: "Search compliance policies...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "pl-10 border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg h-10" })] }), _jsx("div", { className: "w-1/2", children: _jsxs(Select, { value: categoryFilter, onValueChange: function (value) { return setCategoryFilter(value); }, children: [_jsx(SelectTrigger, { className: "border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full", children: _jsx(SelectValue, { placeholder: "Category" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "All Categories" }), uniqueCategories.map(function (cat, idx) { return (_jsx(SelectItem, { value: cat, children: cat }, String(cat) + idx)); })] })] }) })] })] })] }), _jsx(Card, { className: "border-slate-200 shadow-lg rounded-2xl overflow-hidden", children: _jsx(CardContent, { className: "p-0", children: isLoading ? (_jsx("div", { className: "p-6 space-y-4", children: __spreadArray([], Array(5), true).map(function (_, i) { return (_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx(Skeleton, { className: "h-12 w-12 rounded-xl" }), _jsxs("div", { className: "space-y-2 flex-1", children: [_jsx(Skeleton, { className: "h-4 w-3/4" }), _jsx(Skeleton, { className: "h-4 w-1/2" })] })] }, i)); }) })) : (_jsxs(Table, { className: "", children: [_jsx(TableHeader, { className: "bg-gradient-to-r from-indigo-100 to-indigo-50", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "font-bold text-indigo-700 text-base py-3", children: "Policy" }), _jsx(TableHead, { className: "font-bold text-indigo-700 text-base py-3", children: "Category" }), _jsx(TableHead, { className: "font-bold text-indigo-700 text-base py-3", children: "Status" }), _jsx(TableHead, { className: "font-bold text-indigo-700 text-base py-3 text-center", children: "Due Date" }), _jsx(TableHead, { className: "font-bold text-indigo-700 text-base py-3 text-center", children: "Submitted Date" }), _jsx(TableHead, { className: "font-bold text-indigo-700 text-base py-3 text-right", children: "Actions" })] }) }), _jsx(TableBody, { children: filteredItems.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, className: "text-center py-8 text-slate-500", children: _jsxs("div", { className: "flex flex-col items-center justify-center", children: [_jsx(AlertCircle, { className: "h-10 w-10 text-slate-300 mb-2" }), _jsx("p", { className: "text-lg font-medium text-slate-600", children: "No compliance records found" }), _jsx("p", { className: "text-slate-500 mt-1", children: "Try adjusting your filters or add a new compliance record" })] }) }) })) : (filteredItems.map(function (item) { return (_jsxs(TableRow, { className: "hover:bg-indigo-50/40 transition-colors", children: [_jsx(TableCell, { className: "font-semibold text-slate-900 text-base py-3", children: item.policy }), _jsx(TableCell, { children: _jsx(Badge, { variant: "secondary", className: "bg-indigo-100 text-indigo-700 font-medium", children: item.category }) }), _jsx(TableCell, { children: _jsx(StatusBadge, { status: mapStatus(item.status) }) }), _jsx(TableCell, { className: "text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-2 text-slate-700 font-medium", children: [_jsx(Calendar, { className: "h-4 w-4 text-indigo-400" }), formatDate(item.submissionDeadline)] }) }), _jsx(TableCell, { className: "text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-2 text-slate-700 font-medium", children: [_jsx(Calendar, { className: "h-4 w-4 text-indigo-400" }), formatDate(item.filingSubmissionDate)] }) }), _jsx(TableCell, { className: "text-right", children: _jsxs("div", { className: "flex items-center justify-end space-x-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: function () {
                                                                    var index = complianceItems.findIndex(function (ci) { return (ci._id || ci.id) === (item._id || item.id); });
                                                                    setEditIndex(index);
                                                                    setModalOpen(true);
                                                                    var currentItem = complianceItems[index];
                                                                    setForm({
                                                                        filingName: currentItem.policy,
                                                                        filingFrequency: currentItem.frequency || "Monthly",
                                                                        filingComplianceCategory: currentItem.category,
                                                                        filingGoverningAuthority: currentItem.governingAuthority || "",
                                                                        filingStartDate: currentItem.lastAudit || "",
                                                                        filingEndDate: currentItem.endDate || "",
                                                                        filingSubmissionDeadline: currentItem.submissionDeadline || "",
                                                                        filingSubmissionStatus: mapStatus(currentItem.status),
                                                                        filingRecurringFrequency: currentItem.recurringFrequency || "",
                                                                        filingRemarks: currentItem.remarks || "",
                                                                        filingSubmissionDate: "",
                                                                        reminderDays: currentItem.reminderDays !== undefined && currentItem.reminderDays !== null ? String(currentItem.reminderDays) : "7",
                                                                        reminderPolicy: currentItem.reminderPolicy || "One time",
                                                                        submittedBy: currentItem.submittedBy || "",
                                                                        amount: currentItem.amount !== undefined && currentItem.amount !== null ? String(currentItem.amount) : ""
                                                                    });
                                                                }, className: "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg p-2", children: _jsx(Edit, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: function () {
                                                                    if (window.confirm("Do you want to delete this compliance item?")) {
                                                                        deleteMutation.mutate(item._id);
                                                                    }
                                                                }, className: "text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg p-2", children: _jsx(Trash2, { size: 16 }) })] }) })] }, item._id || item.id)); })) })] })) }) })] }), _jsx(Dialog, { open: modalOpen, onOpenChange: setModalOpen, children: _jsxs(DialogContent, { className: "max-w-4xl min-w-[400px] max-h-[80vh] overflow-y-auto rounded-2xl border-slate-200 shadow-2xl p-0", children: [_jsx(DialogHeader, { className: "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6 rounded-t-2xl", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs(DialogTitle, { className: "text-xl font-bold flex items-center gap-3", children: [_jsx(FileText, { className: "h-6 w-6" }), editIndex !== null ? "Edit Compliance" : "Add New Compliance"] }), editIndex !== null && ((_a = complianceItems[editIndex]) === null || _a === void 0 ? void 0 : _a._id) && (_jsxs(Button, { type: "button", variant: "default", className: "bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-4 py-2 flex items-center gap-2 shadow-md transition-all duration-300", onClick: function () {
                                            window.location.href = "/compliance-ledger?id=".concat(complianceItems[editIndex]._id);
                                        }, title: "View Ledger", children: [_jsx(ExternalLink, { size: 16 }), "View Ledger"] }))] }) }), _jsxs("form", { className: "p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Filing Name" }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", value: form.filingName, onChange: function (e) { return handleFormChange("filingName", e.target.value); }, placeholder: "Enter filing name" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Filing Frequency" }), _jsxs(Select, { value: form.filingFrequency, onValueChange: function (val) { return handleFormChange("filingFrequency", val); }, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select frequency" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "Monthly", children: "Monthly" }), _jsx(SelectItem, { value: "Quarterly", children: "Quarterly" }), _jsx(SelectItem, { value: "Yearly", children: "Yearly" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Compliance Category" }), _jsxs(Select, { value: form.filingComplianceCategory, onValueChange: function (val) { return handleFormChange("filingComplianceCategory", val); }, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select category" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "Tax", children: "Tax" }), _jsx(SelectItem, { value: "Legal", children: "Legal" }), _jsx(SelectItem, { value: "Other", children: "Other" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Governing Authority" }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", value: form.filingGoverningAuthority, onChange: function (e) { return handleFormChange("filingGoverningAuthority", e.target.value); }, placeholder: "Enter governing authority" })] }), isLoadingComplianceFields ? (_jsx("div", { className: "col-span-2 text-center text-slate-500", children: "Loading compliance fields..." })) : (complianceFields.filter(function (f) { return f.enabled; }).map(function (field) { return (_jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "block text-sm font-medium text-slate-700", children: [field.name, field.required ? _jsx("span", { className: "text-red-500 ml-1", children: "*" }) : null, field.description && _jsx("span", { className: "block text-xs text-slate-500", children: field.description })] }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", value: dynamicFieldValues[field.name] || '', onChange: function (e) { return handleDynamicFieldChange(field.name, e.target.value); }, placeholder: field.placeholder || "Enter ".concat(field.name), required: !!field.required })] }, field._id || field.name)); }))] }), _jsx("h2", { className: "text-lg font-semibold mt-6 mb-3", children: "Date Information" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Start Date" }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", type: "date", value: form.filingStartDate, onChange: function (e) { return handleFormChange("filingStartDate", e.target.value); } })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "End Date" }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", type: "date", value: form.filingEndDate, onChange: function (e) { return handleFormChange("filingEndDate", e.target.value); } })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Submission Deadline" }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", type: "date", value: form.filingSubmissionDeadline, onChange: function (e) { return handleFormChange("filingSubmissionDeadline", e.target.value); } })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Submission Date" }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", type: "date", value: form.filingSubmissionDate, onChange: function (e) { return handleFormChange("filingSubmissionDate", e.target.value); } })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Amount" }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", type: "number", min: "0", step: "0.01", placeholder: "Enter amount", value: form.amount || '', onChange: function (e) { return handleFormChange("amount", e.target.value); } })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Submission Status" }), _jsxs(Select, { value: form.filingSubmissionStatus, onValueChange: function (val) { return handleFormChange("filingSubmissionStatus", val); }, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select status" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "Pending", children: "Pending" }), _jsx(SelectItem, { value: "Completed", children: "Completed" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Submit By" }), _jsxs(Select, { value: form.submittedBy || '', onValueChange: function (val) { return handleFormChange("submittedBy", val); }, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select employee" }) }), _jsx(SelectContent, { children: employees === null || employees === void 0 ? void 0 : employees.map(function (emp) { return (_jsx(SelectItem, { value: emp._id, children: emp.name }, emp._id)); }) })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Reminder Days" }), _jsx(Input, { className: "w-full border-slate-300 rounded-lg p-2 text-base", type: "number", value: form.reminderDays, onChange: function (e) { return handleFormChange("reminderDays", e.target.value); }, placeholder: "Days before reminder" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Reminder Policy" }), _jsxs(Select, { value: form.reminderPolicy, onValueChange: function (val) { return handleFormChange("reminderPolicy", val); }, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select policy" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "One time", children: "One time" }), _jsx(SelectItem, { value: "Repeat", children: "Repeat" })] })] }), _jsxs("ul", { className: "text-xs text-slate-600 mt-2 list-disc pl-4", children: [_jsxs("li", { children: ["One time: One reminder at ", form.reminderDays, " days before renewal"] }), _jsxs("li", { children: ["Two times: Reminders at ", form.reminderDays, " and 3 days before"] }), _jsxs("li", { children: ["Until Renewal: Daily reminders from ", form.reminderDays, " days until renewal"] })] })] })] }), _jsx("h2", { className: "text-lg font-semibold mt-6 mb-3", children: "Remarks" }), _jsx("div", { className: "grid grid-cols-1 gap-4", children: _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium text-slate-700", children: "Additional Notes" }), _jsx("textarea", { className: "w-full border border-slate-400 rounded-lg p-2 text-base min-h-[80px] max-h-[120px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500", value: form.filingRemarks, onChange: function (e) { return handleFormChange("filingRemarks", e.target.value); }, placeholder: "Enter any additional remarks or notes" })] }) }), _jsxs("div", { className: "flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200", children: [_jsx(Button, { type: "button", variant: "outline", className: "border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2", onClick: function () { return setModalOpen(false); }, children: "Cancel" }), _jsx(Button, { type: "button", className: "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium px-4 py-2 shadow-md hover:shadow-lg", onClick: function () { return __awaiter(_this, void 0, void 0, function () {
                                                var isCompleted, hasSubmissionDate, newStartDate, newEndDate, newSubmissionDeadline, frequency, saveData, complianceId, currentEndDate, nextStartDateObj, prevDeadline, nextDeadline, yyyy, mm, dd, itemToEdit, ledgerData, res, error_1;
                                                var _a;
                                                return __generator(this, function (_b) {
                                                    switch (_b.label) {
                                                        case 0:
                                                            isCompleted = form.filingSubmissionStatus === "Completed";
                                                            hasSubmissionDate = !!form.filingSubmissionDate;
                                                            newStartDate = form.filingStartDate;
                                                            newEndDate = form.filingEndDate;
                                                            newSubmissionDeadline = form.filingSubmissionDeadline;
                                                            frequency = form.filingFrequency || form.filingRecurringFrequency || "Monthly";
                                                            saveData = {
                                                                policy: form.filingName,
                                                                category: form.filingComplianceCategory,
                                                                status: "Non-Compliant",
                                                                lastAudit: newStartDate,
                                                                issues: 0,
                                                                frequency: form.filingFrequency,
                                                                governingAuthority: form.filingGoverningAuthority,
                                                                endDate: newEndDate,
                                                                submissionDeadline: newSubmissionDeadline,
                                                                recurringFrequency: form.filingRecurringFrequency,
                                                                remarks: form.filingRemarks,
                                                                filingSubmissionDate: form.filingSubmissionDate,
                                                                reminderDays: form.reminderDays,
                                                                reminderPolicy: form.reminderPolicy,
                                                                submittedBy: form.submittedBy,
                                                                complianceFieldValues: dynamicFieldValues // <--- store dynamic field values
                                                            };
                                                            complianceId = null;
                                                            if (editIndex !== null && ((_a = complianceItems[editIndex]) === null || _a === void 0 ? void 0 : _a._id)) {
                                                                complianceId = complianceItems[editIndex]._id;
                                                            }
                                                            if (isCompleted && hasSubmissionDate) {
                                                                currentEndDate = new Date(form.filingEndDate);
                                                                if (!isNaN(currentEndDate.getTime())) {
                                                                    nextStartDateObj = new Date(currentEndDate);
                                                                    nextStartDateObj.setDate(currentEndDate.getDate() + 1);
                                                                    newStartDate = "".concat(nextStartDateObj.getFullYear(), "-").concat(String(nextStartDateObj.getMonth() + 1).padStart(2, "0"), "-").concat(String(nextStartDateObj.getDate()).padStart(2, "0"));
                                                                    newEndDate = calculateEndDate(newStartDate, frequency);
                                                                    prevDeadline = new Date(form.filingSubmissionDeadline);
                                                                    if (!isNaN(prevDeadline.getTime())) {
                                                                        nextDeadline = new Date(prevDeadline);
                                                                        if (frequency === "Monthly") {
                                                                            nextDeadline.setMonth(prevDeadline.getMonth() + 1);
                                                                        }
                                                                        else if (frequency === "Quarterly") {
                                                                            nextDeadline.setMonth(prevDeadline.getMonth() + 3);
                                                                        }
                                                                        else if (frequency === "Yearly") {
                                                                            nextDeadline.setFullYear(prevDeadline.getFullYear() + 1);
                                                                        }
                                                                        yyyy = nextDeadline.getFullYear();
                                                                        mm = String(nextDeadline.getMonth() + 1).padStart(2, "0");
                                                                        dd = String(nextDeadline.getDate()).padStart(2, "0");
                                                                        newSubmissionDeadline = "".concat(yyyy, "-").concat(mm, "-").concat(dd);
                                                                    }
                                                                    else {
                                                                        newSubmissionDeadline = newStartDate;
                                                                    }
                                                                }
                                                                saveData = __assign(__assign({}, saveData), { lastAudit: newStartDate, endDate: newEndDate, submissionDeadline: newSubmissionDeadline });
                                                            }
                                                            if (!(editIndex !== null)) return [3 /*break*/, 3];
                                                            itemToEdit = complianceItems[editIndex];
                                                            if (!itemToEdit._id) return [3 /*break*/, 2];
                                                            return [4 /*yield*/, editMutation.mutateAsync({ _id: itemToEdit._id, data: saveData })];
                                                        case 1:
                                                            _b.sent();
                                                            queryClient.setQueryData(["compliance"], function (oldData) {
                                                                return oldData ? oldData.map(function (item, idx) {
                                                                    return idx === editIndex ? __assign(__assign({}, item), saveData) : item;
                                                                }) : [];
                                                            });
                                                            _b.label = 2;
                                                        case 2: return [3 /*break*/, 5];
                                                        case 3: return [4 /*yield*/, addMutation.mutateAsync(saveData)];
                                                        case 4:
                                                            _b.sent();
                                                            _b.label = 5;
                                                        case 5:
                                                            if (!(isCompleted && hasSubmissionDate)) return [3 /*break*/, 9];
                                                            _b.label = 6;
                                                        case 6:
                                                            _b.trys.push([6, 8, , 9]);
                                                            ledgerData = __assign(__assign({}, form), { complianceId: complianceId });
                                                            return [4 /*yield*/, fetch('/api/ledger/insert', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify(ledgerData)
                                                                })];
                                                        case 7:
                                                            res = _b.sent();
                                                            if (!res.ok)
                                                                throw new Error('Failed to save ledger data');
                                                            toast({ title: 'Ledger entry created' });
                                                            return [3 /*break*/, 9];
                                                        case 8:
                                                            error_1 = _b.sent();
                                                            toast({
                                                                title: 'Error',
                                                                description: 'Failed to create ledger',
                                                                variant: 'destructive'
                                                            });
                                                            return [3 /*break*/, 9];
                                                        case 9:
                                                            setForm(function (prev) { return (__assign(__assign({}, prev), { filingStartDate: isCompleted && hasSubmissionDate ? newStartDate : prev.filingStartDate, filingEndDate: isCompleted && hasSubmissionDate ? newEndDate : prev.filingEndDate, filingSubmissionDeadline: isCompleted && hasSubmissionDate ? newSubmissionDeadline : prev.filingSubmissionDeadline, filingSubmissionStatus: "Pending", filingSubmissionDate: "", amount: "" })); });
                                                            setDynamicFieldValues({});
                                                            setModalOpen(false);
                                                            setEditIndex(null);
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); }, children: "Save & Submit" })] })] })] }) })] }));
}
