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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
import { useState, useEffect } from "react";
// ...existing code...
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { CreditCard, X, ChevronDown, Check, History, RefreshCw } from "lucide-react";
// Update the form schema to handle multiple departments
var formSchema = z.object({
    startDate: z.string().min(1, "Start date is required"),
    nextRenewal: z.string().min(1, "End date is required"),
    paymentMethod: z.string().min(1, "Payment method is required"),
    // All other fields are optional
    serviceName: z.string().optional(),
    vendor: z.string().optional(),
    currency: z.string().optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    billingCycle: z.string().optional(),
    category: z.string().optional(),
    department: z.string().optional(),
    departments: z.array(z.string()).optional(),
    owner: z.string().optional(),
    status: z.string().optional(),
    reminderDays: z.number().optional(),
    reminderPolicy: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
}).refine(function (data) {
    // If reminderDays is present and = 1, only allow 'One time' policy
    if (data.reminderDays === 1 && data.reminderPolicy && data.reminderPolicy !== "One time") {
        return false;
    }
    return true;
}, {
    message: "When reminder days = 1, only 'One time' policy is allowed",
    path: ["reminderPolicy"],
});
function parseInputDate(dateStr) {
    if (!dateStr)
        return new Date();
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        var _a = dateStr.split('-'), dd = _a[0], mm = _a[1], yyyy = _a[2];
        return new Date("".concat(yyyy, "-").concat(mm, "-").concat(dd));
    }
    return new Date(dateStr);
}
function calculateEndDate(startDate, billingCycle) {
    if (!startDate || !billingCycle)
        return "";
    var date = parseInputDate(startDate);
    var endDate = new Date(date);
    switch (billingCycle) {
        case "monthly":
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(endDate.getDate() - 1);
            break;
        case "quarterly":
            endDate.setMonth(endDate.getMonth() + 3);
            endDate.setDate(endDate.getDate() - 1);
            break;
        case "yearly":
            endDate.setFullYear(endDate.getFullYear() + 1);
            endDate.setDate(endDate.getDate() - 1);
            break;
        case "weekly":
            endDate.setDate(endDate.getDate() + 6);
            break;
    }
    var yyyy = endDate.getFullYear();
    var mm = String(endDate.getMonth() + 1).padStart(2, '0');
    var dd = String(endDate.getDate()).padStart(2, '0');
    return "".concat(yyyy, "-").concat(mm, "-").concat(dd);
}
function calculateRenewalDates(currentEndDate, billingCycle) {
    if (!currentEndDate || !billingCycle) {
        return { newStartDate: "", newEndDate: "" };
    }
    // Calculate new start date (day after current end date)
    var currentEnd = parseInputDate(currentEndDate);
    var newStart = new Date(currentEnd);
    newStart.setDate(newStart.getDate() + 1);
    // Format new start date
    var newStartDate = "".concat(newStart.getFullYear(), "-").concat(String(newStart.getMonth() + 1).padStart(2, '0'), "-").concat(String(newStart.getDate()).padStart(2, '0'));
    // Calculate new end date based on new start date and billing cycle
    var newEndDate = calculateEndDate(newStartDate, billingCycle);
    return { newStartDate: newStartDate, newEndDate: newEndDate };
}
export default function SubscriptionModal(_a) {
    var _this = this;
    var _b;
    var open = _a.open, onOpenChange = _a.onOpenChange, subscription = _a.subscription;
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var isEditing = !!subscription;
    // Track the current subscription ObjectId for History button
    var _c = useState(), currentSubscriptionId = _c[0], setCurrentSubscriptionId = _c[1];
    useEffect(function () {
        if (open) {
            if (subscription === null || subscription === void 0 ? void 0 : subscription._id) {
                setCurrentSubscriptionId(subscription._id);
            }
            else {
                setCurrentSubscriptionId(undefined);
            }
        }
        else {
            setTimeout(function () {
                setCurrentSubscriptionId(undefined);
            }, 100);
        }
    }, [subscription, open]);
    // Query for categories
    var _d = useQuery({
        queryKey: ["/api/company/categories"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/company/categories", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); }
    }), categories = _d.data, categoriesLoading = _d.isLoading, refetchCategories = _d.refetch;
    // Query for departments
    var _e = useQuery({
        queryKey: ["/api/company/departments"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/company/departments", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.json()];
                }
            });
        }); }
    }), departments = _e.data, departmentsLoading = _e.isLoading, refetchDepartments = _e.refetch;
    // Query for currencies
    var _f = useQuery({
        queryKey: ["/api/currencies"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/currencies", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, Array.isArray(data) ? data : []];
                }
            });
        }); }
    }).data, currencies = _f === void 0 ? [] : _f;
    // Dynamic subscription fields from config
    var _g = useState([]), dynamicFields = _g[0], setDynamicFields = _g[1];
    var _h = useState(true), fieldsLoading = _h[0], setFieldsLoading = _h[1];
    // Employee list for Owner dropdown (from /api/employee)
    // Fetch employees from /api/employees (plural) to match company-details.tsx
    var _j = useQuery({
        queryKey: ['/api/employees'],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch('/api/employees', { credentials: 'include' })];
                    case 1:
                        res = _a.sent();
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, Array.isArray(data) ? data : []];
                }
            });
        }); }
    }), _k = _j.data, employeesRaw = _k === void 0 ? [] : _k, employeesLoading = _j.isLoading;
    // Map _id to id for frontend usage (like company-details)
    var employees = employeesRaw.map(function (emp) { return (__assign(__assign({}, emp), { id: emp._id })); });
    // Fetch payment methods for dynamic dropdown
    var _l = useQuery({
        queryKey: ['/api/payment'],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch('/api/payment', { credentials: 'include' })];
                    case 1:
                        res = _a.sent();
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, Array.isArray(data) ? data : []];
                }
            });
        }); }
    }), _m = _l.data, paymentMethods = _m === void 0 ? [] : _m, paymentMethodsLoading = _l.isLoading;
    // Fetch enabled fields from backend
    useEffect(function () {
        setFieldsLoading(true);
        fetch('/api/config/fields')
            .then(function (res) { return res.json(); })
            .then(function (data) {
            if (Array.isArray(data)) {
                setDynamicFields(data.filter(function (f) { return f.enabled; }));
            }
            else {
                setDynamicFields([]);
            }
        })
            .catch(function () { return setDynamicFields([]); })
            .finally(function () { return setFieldsLoading(false); });
    }, [open]);
    // Parse departments from subscription if it exists
    var parseDepartments = function (deptString) {
        if (!deptString)
            return [];
        try {
            // If it's already an array (from editing), return it
            if (Array.isArray(deptString))
                return deptString;
            // If it's a string, try to parse it as JSON
            var parsed = JSON.parse(deptString);
            return Array.isArray(parsed) ? parsed : [deptString];
        }
        catch (_a) {
            // If parsing fails, treat as a single department
            return deptString ? [deptString] : [];
        }
    };
    var form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            serviceName: (subscription === null || subscription === void 0 ? void 0 : subscription.serviceName) || "",
            vendor: (subscription === null || subscription === void 0 ? void 0 : subscription.vendor) || "",
            currency: (subscription === null || subscription === void 0 ? void 0 : subscription.currency) || "",
            amount: (subscription === null || subscription === void 0 ? void 0 : subscription.amount) !== undefined && (subscription === null || subscription === void 0 ? void 0 : subscription.amount) !== null ? String(subscription.amount) : "",
            billingCycle: (subscription === null || subscription === void 0 ? void 0 : subscription.billingCycle) && (subscription === null || subscription === void 0 ? void 0 : subscription.billingCycle) !== "" ? subscription.billingCycle : "monthly",
            category: (subscription === null || subscription === void 0 ? void 0 : subscription.category) || "",
            department: (subscription === null || subscription === void 0 ? void 0 : subscription.department) || "",
            departments: parseDepartments(subscription === null || subscription === void 0 ? void 0 : subscription.department),
            owner: (subscription === null || subscription === void 0 ? void 0 : subscription.owner) || "", // Added owner to defaultValues
            paymentMethod: (subscription === null || subscription === void 0 ? void 0 : subscription.paymentMethod) || "", // Added payment method to defaultValues
            startDate: (subscription === null || subscription === void 0 ? void 0 : subscription.startDate) ? new Date(subscription.startDate).toISOString().split('T')[0] : "",
            nextRenewal: (subscription === null || subscription === void 0 ? void 0 : subscription.nextRenewal) ? new Date(subscription.nextRenewal).toISOString().split('T')[0] : "",
            status: (subscription === null || subscription === void 0 ? void 0 : subscription.status) && (subscription === null || subscription === void 0 ? void 0 : subscription.status) !== "" ? subscription.status : "Active",
            reminderDays: (subscription === null || subscription === void 0 ? void 0 : subscription.reminderDays) || 7,
            reminderPolicy: (subscription === null || subscription === void 0 ? void 0 : subscription.reminderPolicy) && (subscription === null || subscription === void 0 ? void 0 : subscription.reminderPolicy) !== "" ? subscription.reminderPolicy : "One time",
            notes: (subscription === null || subscription === void 0 ? void 0 : subscription.notes) || "",
            isActive: (_b = subscription === null || subscription === void 0 ? void 0 : subscription.isActive) !== null && _b !== void 0 ? _b : true,
        },
    });
    var _o = useState((subscription === null || subscription === void 0 ? void 0 : subscription.startDate) ? new Date(subscription.startDate).toISOString().split('T')[0] : ""), startDate = _o[0], setStartDate = _o[1];
    var _p = useState((subscription === null || subscription === void 0 ? void 0 : subscription.billingCycle) || "monthly"), billingCycle = _p[0], setBillingCycle = _p[1];
    var _q = useState((subscription === null || subscription === void 0 ? void 0 : subscription.nextRenewal) ? new Date(subscription.nextRenewal).toISOString().split('T')[0] : ""), endDate = _q[0], setEndDate = _q[1];
    var _r = useState(false), endDateManuallySet = _r[0], setEndDateManuallySet = _r[1];
    var _s = useState(parseDepartments(subscription === null || subscription === void 0 ? void 0 : subscription.department)), selectedDepartments = _s[0], setSelectedDepartments = _s[1];
    var _t = useState(false), isPopoverOpen = _t[0], setIsPopoverOpen = _t[1];
    var _u = useState(false), isRenewing = _u[0], setIsRenewing = _u[1];
    // Refetch data when modal opens
    useEffect(function () {
        if (open) {
            refetchCategories();
            refetchDepartments();
        }
    }, [open, refetchCategories, refetchDepartments]);
    useEffect(function () {
        var _a;
        if (subscription) {
            var start = subscription.startDate ? new Date(subscription.startDate).toISOString().split('T')[0] : "";
            var end = subscription.nextRenewal ? new Date(subscription.nextRenewal).toISOString().split('T')[0] : "";
            var depts = parseDepartments(subscription.department);
            setStartDate(start);
            setBillingCycle(subscription.billingCycle || "monthly");
            setEndDate(end);
            setEndDateManuallySet(!!end);
            setSelectedDepartments(depts);
            form.reset({
                serviceName: subscription.serviceName || "",
                vendor: subscription.vendor || "",
                amount: subscription.amount !== undefined && subscription.amount !== null ? String(subscription.amount) : "",
                billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "monthly",
                category: subscription.category || "",
                department: subscription.department || "",
                departments: depts,
                owner: subscription.owner || "", // Added owner to reset values
                startDate: start,
                nextRenewal: end,
                status: subscription.status && subscription.status !== "" ? subscription.status : "Active",
                reminderDays: subscription.reminderDays || 7,
                reminderPolicy: subscription.reminderPolicy && subscription.reminderPolicy !== "" ? subscription.reminderPolicy : "One time",
                notes: subscription.notes || "",
                isActive: (_a = subscription.isActive) !== null && _a !== void 0 ? _a : true,
            });
        }
        else {
            setStartDate("");
            setBillingCycle("monthly");
            setEndDate("");
            setEndDateManuallySet(false);
            setSelectedDepartments([]);
            form.reset({
                serviceName: "",
                vendor: "",
                amount: "",
                billingCycle: "monthly",
                category: "",
                department: "",
                departments: [],
                owner: "", // Added owner to reset values
                startDate: "",
                nextRenewal: "",
                status: "Active",
                reminderDays: 7,
                reminderPolicy: "One time",
                notes: "",
                isActive: true,
            });
        }
    }, [subscription, form]);
    useEffect(function () {
        if (startDate && billingCycle) {
            if (!endDateManuallySet || (subscription && startDate !== (subscription.startDate ? new Date(subscription.startDate).toISOString().split('T')[0] : ""))) {
                var calculatedEndDate = calculateEndDate(startDate, billingCycle);
                setEndDate(calculatedEndDate);
                form.setValue('nextRenewal', calculatedEndDate);
                setEndDateManuallySet(false);
            }
        }
    }, [startDate, billingCycle, endDateManuallySet, form]);
    var mutation = useMutation({
        mutationFn: function (data) { return __awaiter(_this, void 0, void 0, function () {
            var _a, id, createdAt, rest, subscriptionData, res, subId;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = data, id = _a.id, createdAt = _a.createdAt, rest = __rest(_a, ["id", "createdAt"]);
                        subscriptionData = __assign(__assign({}, rest), { department: JSON.stringify(data.departments || []), startDate: new Date(data.startDate).toISOString(), nextRenewal: new Date(data.nextRenewal).toISOString() });
                        subId = subscription === null || subscription === void 0 ? void 0 : subscription._id;
                        if (!(isEditing && subId)) return [3 /*break*/, 2];
                        return [4 /*yield*/, apiRequest("PUT", "/api/subscriptions/".concat(subId), subscriptionData)];
                    case 1:
                        res = _b.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, apiRequest("POST", "/api/subscriptions", subscriptionData)];
                    case 3:
                        res = _b.sent();
                        _b.label = 4;
                    case 4: return [2 /*return*/, res.json()];
                }
            });
        }); },
        onSuccess: function (data, variables) { return __awaiter(_this, void 0, void 0, function () {
            var subId, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Use only the subscription's _id
                        if (subscription === null || subscription === void 0 ? void 0 : subscription._id) {
                            setCurrentSubscriptionId(subscription._id);
                        }
                        queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/analytics/categories"] });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        subId = (subscription === null || subscription === void 0 ? void 0 : subscription._id) || data.insertedId;
                        if (!subId) return [3 /*break*/, 3];
                        return [4 /*yield*/, axios.post("/api/history", {
                                subscriptionId: subId.toString(),
                                data: __assign(__assign({}, variables), { serviceName: variables.serviceName, owner: variables.owner, startDate: variables.startDate, nextRenewal: variables.nextRenewal, status: variables.status }),
                                timestamp: new Date().toISOString(),
                                action: isEditing ? "update" : "create"
                            })];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        e_1 = _a.sent();
                        // Optionally show a toast if history fails
                        console.error("Failed to save history:", e_1);
                        return [3 /*break*/, 5];
                    case 5:
                        toast({
                            title: "Success",
                            description: "Subscription ".concat(isEditing ? 'updated' : 'created', " successfully"),
                        });
                        onOpenChange(false);
                        setTimeout(function () {
                            form.reset();
                        }, 300);
                        return [2 /*return*/];
                }
            });
        }); },
        onError: function (error) {
            if (isEditing) {
                toast({
                    title: "Success",
                    description: "Subscription updated successfully",
                });
                onOpenChange(false);
                setTimeout(function () {
                    form.reset();
                }, 300);
                queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
            }
            else {
                toast({
                    title: "Error",
                    description: error.message || "Failed to create subscription",
                    variant: "destructive",
                });
            }
        },
    });
    var onSubmit = function (data) { return __awaiter(_this, void 0, void 0, function () {
        var amountNum, tenantId, payload, res, result, subscriptionId, historyError_1, error_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 10, , 11]);
                    amountNum = typeof data.amount === 'string' ? parseFloat(data.amount) : (_a = data.amount) !== null && _a !== void 0 ? _a : 0;
                    tenantId = window.currentTenantId || ((_b = window.user) === null || _b === void 0 ? void 0 : _b.tenantId) || null;
                    payload = __assign(__assign({}, data), { amount: isNaN(amountNum) ? 0 : amountNum, departments: selectedDepartments, department: JSON.stringify(selectedDepartments), startDate: new Date(data.startDate), nextRenewal: new Date(data.nextRenewal), tenantId: tenantId });
                    if (!isEditing) return [3 /*break*/, 1];
                    // Update existing subscription
                    mutation.mutate(__assign(__assign({}, payload), { startDate: payload.startDate instanceof Date ? payload.startDate.toISOString() : String(payload.startDate), nextRenewal: payload.nextRenewal instanceof Date ? payload.nextRenewal.toISOString() : String(payload.nextRenewal) }));
                    return [3 /*break*/, 9];
                case 1: return [4 /*yield*/, apiRequest("POST", "/api/subscriptions", payload)];
                case 2:
                    res = _d.sent();
                    return [4 /*yield*/, res.json()];
                case 3:
                    result = _d.sent();
                    if (!(res.ok && result)) return [3 /*break*/, 8];
                    subscriptionId = result._id || ((_c = result.subscription) === null || _c === void 0 ? void 0 : _c._id);
                    if (!subscriptionId) return [3 /*break*/, 7];
                    setCurrentSubscriptionId(subscriptionId);
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, apiRequest("POST", "/api/history", {
                            subscriptionId: subscriptionId,
                            data: payload,
                            action: "create",
                            timestamp: new Date().toISOString()
                        })];
                case 5:
                    _d.sent();
                    // Dispatch subscription creation event
                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('subscription-created', {
                            detail: __assign(__assign({}, payload), { _id: subscriptionId })
                        }));
                    }
                    return [3 /*break*/, 7];
                case 6:
                    historyError_1 = _d.sent();
                    console.error("Failed to create history record:", historyError_1);
                    toast({
                        title: "Warning",
                        description: "Subscription saved, but failed to create history.",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 7];
                case 7:
                    // Invalidate queries to refresh data
                    queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/history"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
                    toast({
                        title: "Success",
                        description: "Subscription created successfully",
                    });
                    onOpenChange(false);
                    return [3 /*break*/, 9];
                case 8: throw new Error("Failed to create subscription");
                case 9: return [3 /*break*/, 11];
                case 10:
                    error_1 = _d.sent();
                    toast({
                        title: "Error",
                        description: error_1.message || "Failed to save subscription",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    // Handle department selection
    var handleDepartmentChange = function (departmentName, checked) {
        var newSelectedDepartments = checked
            ? __spreadArray(__spreadArray([], selectedDepartments, true), [departmentName], false) : selectedDepartments.filter(function (dept) { return dept !== departmentName; });
        setSelectedDepartments(newSelectedDepartments);
        form.setValue("departments", newSelectedDepartments);
    };
    // Remove a department from the selected list
    var removeDepartment = function (departmentName) {
        var newSelectedDepartments = selectedDepartments.filter(function (dept) { return dept !== departmentName; });
        setSelectedDepartments(newSelectedDepartments);
        form.setValue("departments", newSelectedDepartments);
    };
    // Handle popover open/close
    var handlePopoverOpenChange = function (open) {
        setIsPopoverOpen(open);
        if (open) {
            refetchDepartments();
        }
    };
    // Handle renewal logic
    var handleRenew = function () { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            if (!endDate || !billingCycle) {
                toast({
                    title: "Cannot Renew",
                    description: "Please ensure both end date and billing cycle are set",
                    variant: "destructive",
                });
                return [2 /*return*/];
            }
            setIsRenewing(true);
            setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                var _a, newStartDate, newEndDate, payload, subId, e_2;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = calculateRenewalDates(endDate, billingCycle), newStartDate = _a.newStartDate, newEndDate = _a.newEndDate;
                            setStartDate(newStartDate);
                            setEndDate(newEndDate);
                            form.setValue('startDate', newStartDate);
                            form.setValue('nextRenewal', newEndDate);
                            setEndDateManuallySet(true);
                            payload = __assign(__assign({}, form.getValues()), { startDate: newStartDate, nextRenewal: newEndDate });
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 5, , 6]);
                            subId = (subscription === null || subscription === void 0 ? void 0 : subscription._id) || (subscription === null || subscription === void 0 ? void 0 : subscription.id);
                            if (!subId) return [3 /*break*/, 3];
                            return [4 /*yield*/, apiRequest("PUT", "/api/subscriptions/".concat(subId), payload)];
                        case 2:
                            _b.sent();
                            _b.label = 3;
                        case 3: 
                        // Insert into history table
                        return [4 /*yield*/, axios.post("/api/history", {
                                subscriptionId: subId,
                                data: payload,
                                action: "renew"
                            })];
                        case 4:
                            // Insert into history table
                            _b.sent();
                            return [3 /*break*/, 6];
                        case 5:
                            e_2 = _b.sent();
                            return [3 /*break*/, 6];
                        case 6:
                            setIsRenewing(false);
                            toast({
                                title: "Subscription Renewed",
                                description: "Subscription renewed from ".concat(formatDate(newStartDate), " to ").concat(formatDate(newEndDate)),
                            });
                            onOpenChange(false);
                            return [2 /*return*/];
                    }
                });
            }); }, 500);
            return [2 /*return*/];
        });
    }); };
    // Format date for display
    var formatDate = function (dateString) {
        var date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };
    // CSS for animations
    var animationStyles = "\n    @keyframes fadeIn {\n      from { opacity: 0; transform: translateY(-10px); }\n      to { opacity: 1; transform: translateY(0); }\n    }\n    .animate-fadeIn {\n      animation: fadeIn 0.3s ease-out forwards;\n    }\n    @keyframes spin {\n      from { transform: rotate(0deg); }\n      to { transform: rotate(360deg); }\n    }\n    .animate-spin {\n      animation: spin 1s linear infinite;\n    }\n  ";
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: animationStyles }), _jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-4xl min-w-[400px] max-h-[80vh] overflow-y-auto rounded-2xl border-slate-200 shadow-2xl p-0", children: [_jsxs(DialogHeader, { className: "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6 rounded-t-2xl flex flex-row items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(CreditCard, { className: "h-6 w-6" }), _jsx(DialogTitle, { className: "text-xl font-bold", children: isEditing ? 'Edit Subscription' : 'Add New Subscription' })] }), _jsxs("div", { className: "flex gap-3 items-center ml-auto mr-6", children: [_jsx(Button, { type: "button", variant: "outline", className: "bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-5 py-2 rounded-lg shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 min-w-[90px] border-indigo-200", onClick: function () { return window.location.href = "/subscription-user"; }, children: "User" }), _jsxs(Button, { type: "button", variant: "outline", className: "bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-5 py-2 rounded-lg shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 min-w-[90px] border-indigo-200 flex items-center gap-2", onClick: handleRenew, disabled: isRenewing || !endDate || !billingCycle, children: [isRenewing ? (_jsx(RefreshCw, { className: "h-4 w-4 animate-spin" })) : (_jsx(RefreshCw, { className: "h-4 w-4" })), "Renew"] }), _jsxs(Button, { type: "button", variant: "outline", className: "bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-5 py-2 rounded-lg shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 min-w-[90px] border-indigo-200 flex items-center gap-2 ".concat(!isEditing ? 'opacity-50 cursor-not-allowed' : ''), onClick: function () {
                                                if (isEditing && (subscription === null || subscription === void 0 ? void 0 : subscription._id)) {
                                                    // Only pass the ID, removing serviceName to simplify filtering
                                                    window.location.href = "/subscription-history?id=".concat(subscription._id);
                                                }
                                            }, disabled: !isEditing, title: !isEditing ? "History is available only for existing subscriptions" : undefined, children: [_jsx(History, { className: "h-4 w-4" }), "View"] })] })] }), _jsx(Form, __assign({}, form, { children: _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 mb-6", children: [_jsx(FormField, { control: form.control, name: "serviceName", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Service Name" }), _jsx(FormControl, { children: _jsx(Input, __assign({ className: "w-full border-slate-300 rounded-lg p-2 text-base" }, field, { placeholder: "Enter service name" })) }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "vendor", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Vendor" }), _jsx(FormControl, { children: _jsx(Input, __assign({ className: "w-full border-slate-300 rounded-lg p-2 text-base" }, field, { placeholder: "Enter vendor name" })) }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "currency", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Currency" }), _jsxs(Select, { value: field.value || '', onValueChange: field.onChange, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select currency" }) }), _jsx(SelectContent, { children: currencies && currencies.length > 0 ? (currencies.map(function (curr) { return (_jsxs(SelectItem, { value: curr.code, children: [curr.symbol, " ", curr.code, " - ", curr.name] }, curr.code)); })) : (_jsx(SelectItem, { value: "no-currency", disabled: true, children: "No currencies configured" })) })] }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "amount", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Amount" }), _jsx(FormControl, { children: _jsx(Input, __assign({ type: "number", step: "0.01", className: "w-full border-slate-300 rounded-lg p-2 text-base text-right font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" }, field, { placeholder: "0.00" })) }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "billingCycle", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Billing Cycle" }), _jsxs(Select, { value: billingCycle, onValueChange: function (val) { setBillingCycle(val); field.onChange(val); }, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select cycle" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "monthly", children: "Monthly" }), _jsx(SelectItem, { value: "yearly", children: "Yearly" }), _jsx(SelectItem, { value: "quarterly", children: "Quarterly" }), _jsx(SelectItem, { value: "weekly", children: "Weekly" })] })] }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "status", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Status" }), _jsxs(Select, { onValueChange: field.onChange, defaultValue: field.value, children: [_jsx(FormControl, { children: _jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select status" }) }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "Active", children: "Active" }), _jsx(SelectItem, { value: "Cancelled", children: "Cancelled" })] })] }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "category", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Category" }), _jsxs(Select, { value: field.value || "", onValueChange: field.onChange, disabled: categoriesLoading, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: categoriesLoading ? "Loading..." : "Select category" }) }), _jsx(SelectContent, { children: Array.isArray(categories) && categories.length > 0 ? (categories
                                                                            .filter(function (cat) { return cat.visible; })
                                                                            .map(function (cat) { return (_jsx(SelectItem, { value: cat.name, children: cat.name }, cat.name)); })) : (_jsx(SelectItem, { value: "no-category", disabled: true, children: "No categories found" })) })] }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "departments", render: function () { return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Departments" }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Popover, { open: isPopoverOpen, onOpenChange: handlePopoverOpenChange, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { variant: "outline", role: "combobox", "aria-expanded": isPopoverOpen, className: "w-full justify-between border-slate-300 rounded-lg p-2 text-base h-10", children: [selectedDepartments.length > 0
                                                                                        ? "".concat(selectedDepartments.length, " department").concat(selectedDepartments.length > 1 ? 's' : '', " selected")
                                                                                        : "Select departments", _jsx(ChevronDown, { className: "ml-2 h-4 w-4 shrink-0 opacity-50" })] }) }), _jsx(PopoverContent, { className: "w-full p-0", children: _jsx("div", { className: "max-h-60 overflow-auto p-2", children: Array.isArray(departments) && departments.length > 0 ? (departments
                                                                                    .filter(function (dept) { return dept.visible; })
                                                                                    .map(function (dept) { return (_jsxs("div", { className: "flex items-center space-x-2 px-2 py-2 hover:bg-slate-100 rounded-md", children: [_jsx(Checkbox, { id: "dept-".concat(dept.name), checked: selectedDepartments.includes(dept.name), onCheckedChange: function (checked) { return handleDepartmentChange(dept.name, checked); }, disabled: departmentsLoading }), _jsx("label", { htmlFor: "dept-".concat(dept.name), className: "text-sm font-medium cursor-pointer flex-1", children: dept.name }), selectedDepartments.includes(dept.name) && (_jsx(Check, { className: "h-4 w-4 text-indigo-600" }))] }, dept.name)); })) : (_jsx("div", { className: "px-2 py-2 text-sm text-gray-500", children: "No departments found" })) }) })] }), selectedDepartments.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2 mt-2", children: selectedDepartments.map(function (dept) { return (_jsxs(Badge, { variant: "secondary", className: "flex items-center gap-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-200", children: [dept, _jsx("button", { type: "button", onClick: function () { return removeDepartment(dept); }, className: "ml-1 rounded-full hover:bg-indigo-300", children: _jsx(X, { className: "h-3 w-3" }) })] }, dept)); }) }))] }), _jsx(FormMessage, {})] })); } }), _jsx(FormField, { control: form.control, name: "owner", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Owner" }), _jsxs(Select, { value: field.value || '', onValueChange: field.onChange, disabled: employeesLoading, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: employeesLoading ? 'Loading employees...' : 'Select owner' }) }), _jsx(SelectContent, { children: Array.isArray(employees) && employees.length > 0 ? (employees.map(function (emp) { return (_jsx(SelectItem, { value: emp.name, children: emp.name }, emp.id || emp._id || emp.name)); })) : (_jsx(SelectItem, { value: "no-employee", disabled: true, children: "No employees found" })) })] }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "paymentMethod", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Payment Method" }), _jsxs(Select, { value: field.value || '', onValueChange: field.onChange, disabled: paymentMethodsLoading, children: [_jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: paymentMethodsLoading ? 'Loading...' : 'Select payment method' }) }), _jsx(SelectContent, { children: Array.isArray(paymentMethods) && paymentMethods.length > 0 ? (paymentMethods.map(function (pm) { return (_jsx(SelectItem, { value: pm.name, children: pm.name }, pm._id || pm.id || pm.name)); })) : (_jsx(SelectItem, { value: "no-method", disabled: true, children: "No payment methods found" })) })] }), _jsx(FormMessage, {})] }));
                                                } }), fieldsLoading ? (_jsx("div", { className: "col-span-full flex justify-center py-4", children: _jsx("span", { className: "text-gray-500 text-sm", children: "Loading fields..." }) })) : dynamicFields.length > 0 && (_jsx(_Fragment, { children: dynamicFields.map(function (field) { return (_jsx(FormField, { control: form.control, name: field.name, render: function (_a) {
                                                        var formField = _a.field;
                                                        return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: field.name }), _jsx(FormControl, { children: field.type === 'number' ? (_jsx(Input, __assign({ type: "number", className: "w-full border-slate-300 rounded-lg p-2 text-base" }, formField, { value: typeof formField.value === "boolean"
                                                                            ? ""
                                                                            : formField.value === undefined
                                                                                ? ""
                                                                                : formField.value, placeholder: "Enter ".concat(field.name) }))) : (_jsx(Input, __assign({ type: "text", className: "w-full border-slate-300 rounded-lg p-2 text-base" }, formField, { value: typeof formField.value === "boolean" || Array.isArray(formField.value)
                                                                            ? ""
                                                                            : formField.value === undefined
                                                                                ? ""
                                                                                : formField.value, placeholder: "Enter ".concat(field.name) }))) }), _jsx(FormMessage, {})] }));
                                                    } }, field.name)); }) }))] }), _jsx("h2", { className: "text-lg font-semibold mt-6 mb-3", children: "Date Information" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6", children: [_jsx(FormField, { control: form.control, name: "startDate", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Start Date" }), _jsx(FormControl, { children: _jsx(Input, { type: "date", className: "w-full border-slate-300 rounded-lg p-2 text-base", value: startDate, onChange: function (e) { setStartDate(e.target.value); field.onChange(e); } }) }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "nextRenewal", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "End Date" }), _jsx(FormControl, { children: _jsx(Input, { type: "date", className: "w-full border-slate-300 rounded-lg p-2 text-base", value: endDate, onChange: function (e) {
                                                                        setEndDateManuallySet(true);
                                                                        setEndDate(e.target.value);
                                                                        field.onChange(e);
                                                                    } }) }), _jsx(FormMessage, {})] }));
                                                } })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6", children: [_jsx(FormField, { control: form.control, name: "reminderDays", render: function (_a) {
                                                    var field = _a.field;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Reminder Days" }), _jsx(FormControl, { children: _jsx(Input, __assign({ type: "number", min: "1", max: "365", className: "w-full border-slate-300 rounded-lg p-2 text-base", placeholder: "7" }, field, { onChange: function (e) { return field.onChange(parseInt(e.target.value) || 1); } })) }), _jsx(FormMessage, {})] }));
                                                } }), _jsx(FormField, { control: form.control, name: "reminderPolicy", render: function (_a) {
                                                    var field = _a.field;
                                                    var reminderDays = form.watch("reminderDays");
                                                    var isOnlyOneTimeAllowed = reminderDays === 1;
                                                    return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Reminder Policy" }), _jsxs(Select, { onValueChange: function (val) {
                                                                    if (["One time", "Two times", "Until Renewal"].includes(val)) {
                                                                        field.onChange(val);
                                                                    }
                                                                    else {
                                                                        field.onChange("One time");
                                                                    }
                                                                }, value: field.value && ["One time", "Two times", "Until Renewal"].includes(field.value) ? field.value : "One time", defaultValue: field.value && ["One time", "Two times", "Until Renewal"].includes(field.value) ? field.value : "One time", disabled: isOnlyOneTimeAllowed, children: [_jsx(FormControl, { children: _jsx(SelectTrigger, { className: "w-full border-slate-300 rounded-lg p-2 text-base", children: _jsx(SelectValue, { placeholder: "Select policy" }) }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "One time", children: "One time" }), _jsx(SelectItem, { value: "Two times", disabled: isOnlyOneTimeAllowed, children: "Two times" }), _jsx(SelectItem, { value: "Until Renewal", disabled: isOnlyOneTimeAllowed, children: "Until Renewal" })] })] }), isOnlyOneTimeAllowed && (_jsx("p", { className: "text-sm text-red-500 font-medium", children: "When reminder days = 1, only \"One time\" policy is allowed" })), _jsxs("ul", { className: "text-xs text-slate-600 mt-2 list-disc pl-4", children: [_jsxs("li", { children: ["One time: One reminder at ", reminderDays, " days before renewal"] }), _jsxs("li", { children: ["Two times: Reminders at ", reminderDays !== null && reminderDays !== void 0 ? reminderDays : 7, " and ", Math.floor((reminderDays !== null && reminderDays !== void 0 ? reminderDays : 7) / 2), " days before"] }), _jsxs("li", { children: ["Until Renewal: Daily reminders from ", reminderDays, " days until renewal"] })] }), _jsx(FormMessage, {})] }));
                                                } })] }), _jsx("h2", { className: "text-lg font-semibold mt-6 mb-3", children: "Notes" }), _jsx("div", { className: "grid grid-cols-1 gap-4 mb-6", children: _jsx(FormField, { control: form.control, name: "notes", render: function (_a) {
                                                var field = _a.field;
                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "block text-sm font-medium text-slate-700", children: "Additional Notes" }), _jsx(FormControl, { children: _jsx(Textarea, __assign({ className: "w-full border border-slate-400 rounded-lg p-2 text-base min-h-[80px] max-h-[120px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500", placeholder: "Enter any additional notes about this subscription...", rows: 3 }, field, { value: field.value || '' })) }), _jsx(FormMessage, {})] }));
                                            } }) }), form.formState.errors && Object.keys(form.formState.errors).length > 0 && (_jsx("div", { className: "text-red-600 font-semibold text-center mb-4", children: Object.values(form.formState.errors).map(function (err, idx) { return (_jsx("div", { children: err.message }, idx)); }) })), _jsxs("div", { className: "flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200", children: [_jsx(Button, { type: "button", variant: "outline", className: "border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2", onClick: function () { return onOpenChange(false); }, children: "Cancel" }), _jsx(Button, { type: "submit", className: "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium px-4 py-2 shadow-md hover:shadow-lg", disabled: mutation.isPending, children: mutation.isPending ? 'Saving...' : isEditing ? 'Update Subscription' : 'Save Subscription' })] })] }) }))] }) })] }));
}
