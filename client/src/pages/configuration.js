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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Settings, Eye, EyeOff, CreditCard, Shield, Bell, Banknote, DollarSign, Edit, Trash2 } from "lucide-react";
import { cardImages } from "@/assets/card-icons/cardImages";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
export default function Configuration() {
    var _this = this;
    var queryClient = useQueryClient();
    var _a = useState(false), addCurrencyOpen = _a[0], setAddCurrencyOpen = _a[1];
    var _b = useState(null), selectedCurrency = _b[0], setSelectedCurrency = _b[1];
    var _c = useState([]), exchangeRates = _c[0], setExchangeRates = _c[1];
    var _d = useState(false), exchangeRateOpen = _d[0], setExchangeRateOpen = _d[1];
    var _e = useState(false), addRateOpen = _e[0], setAddRateOpen = _e[1];
    var _f = useState({
        date: '',
        code: '',
        relCurrency: '',
        rate: '',
        relRate: ''
    }), newRate = _f[0], setNewRate = _f[1];
    // Delete payment method handler (DELETE from backend)
    var handleDeletePaymentMethod = function (method) {
        if (!method._id) {
            toast({ title: "Error", description: "Cannot delete: missing id", variant: "destructive" });
            return;
        }
        fetch("/api/payment/".concat(method._id), { method: "DELETE" })
            .then(function (res) { return res.json(); })
            .then(function () {
            fetch("/api/payment")
                .then(function (res) { return res.json(); })
                .then(function (data) { return setPaymentMethods(data); });
            queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
            toast({
                title: "Payment Method Deleted",
                description: "Payment method has been deleted successfully",
                variant: "destructive",
            });
        });
    };
    // Edit payment method logic
    var openEditPayment = function (method) {
        setPaymentForm({
            title: method.title || method.name || '',
            type: method.type || '',
            description: method.description || '',
            icon: method.icon || '',
            manager: method.manager || '',
            expiresAt: method.expiresAt || '',
        });
        setEditPaymentModalOpen(true);
        setEditingPaymentId(method._id);
    };
    // Track which payment method is being edited (id only)
    var _g = useState(null), editingPaymentId = _g[0], setEditingPaymentId = _g[1];
    // Handle edit payment method submit (PUT to backend)
    var handleEditPaymentMethod = function (e) {
        e.preventDefault();
        if (!editingPaymentId) {
            toast({ title: "Error", description: "Cannot update: missing id", variant: "destructive" });
            return;
        }
        fetch("/api/payment/".concat(editingPaymentId), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: paymentForm.title,
                type: paymentForm.type,
                description: paymentForm.description,
                icon: paymentForm.icon,
                manager: paymentForm.manager,
                expiresAt: paymentForm.expiresAt,
            }),
        })
            .then(function (res) { return res.json(); })
            .then(function () {
            fetch("/api/payment")
                .then(function (res) { return res.json(); })
                .then(function (data) { return setPaymentMethods(data); });
            queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
            setEditPaymentModalOpen(false);
            setEditingPaymentId(null);
            toast({
                title: "Payment Method Updated",
                description: "Payment method has been updated successfully",
            });
        });
    };
    // Edit Payment Method Modal state
    var _h = useState(false), editPaymentModalOpen = _h[0], setEditPaymentModalOpen = _h[1];
    // Payment methods state (now loaded from backend)
    var _j = useState([]), paymentMethods = _j[0], setPaymentMethods = _j[1];
    // Fetch payment methods from backend on mount
    useEffect(function () {
        fetch("/api/payment")
            .then(function (res) { return res.json(); })
            .then(function (data) { return setPaymentMethods(data); })
            .catch(function () { return setPaymentMethods([]); });
    }, []);
    // Delete currency handler
    var deleteCurrency = function (code) {
        setCurrencies(function (prev) { return prev.filter(function (c) { return c.code !== code; }); });
        toast({
            title: "Currency Deleted",
            description: "Currency with code ".concat(code, " has been deleted."),
            variant: "destructive",
        });
    };
    var _k = useState({
        name: '',
        code: '',
        symbol: '',
        isoNumber: '',
        exchangeRate: '',
        visible: true,
        created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    }), newCurrency = _k[0], setNewCurrency = _k[1];
    var _l = useState([]), currencies = _l[0], setCurrencies = _l[1];
    var updateCurrencyVisibility = function (code, visible) {
        setCurrencies(function (prev) { return prev.map(function (c) {
            return c.code === code ? __assign(__assign({}, c), { visible: visible }) : c;
        }); });
    };
    var saveCurrencySettings = function () {
        toast({
            title: "Settings Saved",
            description: "Currency visibility configuration has been saved successfully",
        });
    };
    // Add new currency handler (restore if missing)
    var addNewCurrency = function () {
        if (newCurrency.name.trim() &&
            newCurrency.code.trim() &&
            newCurrency.symbol.trim() &&
            !currencies.find(function (c) { return c.code.toLowerCase() === newCurrency.code.toLowerCase(); })) {
            setCurrencies(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
                __assign(__assign({}, newCurrency), { name: newCurrency.name.trim(), code: newCurrency.code.trim(), symbol: newCurrency.symbol.trim() })
            ], false); });
            setNewCurrency({
                name: '',
                code: '',
                symbol: '',
                isoNumber: '',
                exchangeRate: '',
                visible: true,
                created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
            });
            toast({
                title: "Currency Added",
                description: "".concat(newCurrency.name, " currency has been added successfully"),
            });
        }
    };
    // Currency state is already defined above
    // Field Enablement state - now fully dynamic
    var _m = useState([]), fields = _m[0], setFields = _m[1]; // Initialize as empty array
    var _o = useState(''), newFieldName = _o[0], setNewFieldName = _o[1];
    var _p = useState(true), isLoading = _p[0], setIsLoading = _p[1]; // Loading state
    // Compliance Fields state
    var _q = useState([]), complianceFields = _q[0], setComplianceFields = _q[1];
    var _r = useState(''), newComplianceFieldName = _r[0], setNewComplianceFieldName = _r[1];
    var _s = useState(true), isLoadingCompliance = _s[0], setIsLoadingCompliance = _s[1];
    var toast = useToast().toast;
    // Fetch enabled fields from backend on mount
    useEffect(function () {
        setIsLoading(true);
        fetch('/api/config/fields')
            .then(function (res) {
            if (!res.ok)
                throw new Error('Failed to fetch fields');
            return res.json();
        })
            .then(function (data) {
            if (Array.isArray(data)) {
                setFields(data);
            }
            else {
                setFields([]);
                toast({
                    title: "Data Format Error",
                    description: "Received invalid field data from server",
                    variant: "destructive",
                });
            }
        })
            .catch(function (error) {
            console.error("Error fetching fields:", error);
            setFields([]);
            toast({
                title: "Error",
                description: "Failed to load field configuration",
                variant: "destructive",
            });
        })
            .finally(function () { return setIsLoading(false); });
    }, []);
    // Fetch compliance fields from backend on mount (new API)
    useEffect(function () {
        setIsLoadingCompliance(true);
        fetch('/api/config/compliance-fields')
            .then(function (res) {
            if (!res.ok)
                throw new Error('Failed to fetch compliance fields');
            return res.json();
        })
            .then(function (data) {
            if (Array.isArray(data)) {
                setComplianceFields(data);
            }
            else {
                setComplianceFields([]);
                toast({
                    title: "Data Format Error",
                    description: "Received invalid compliance field data from server",
                    variant: "destructive",
                });
            }
        })
            .catch(function (error) {
            console.error("Error fetching compliance fields:", error);
            setComplianceFields([]);
            toast({
                title: "Error",
                description: "Failed to load compliance field configuration",
                variant: "destructive",
            });
        })
            .finally(function () { return setIsLoadingCompliance(false); });
    }, []);
    // Add new field and persist to backend immediately
    var addNewField = function () { return __awaiter(_this, void 0, void 0, function () {
        var updatedFields, response, fetchRes, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(newFieldName.trim() && !fields.find(function (f) { return f.name.toLowerCase() === newFieldName.toLowerCase(); }))) return [3 /*break*/, 6];
                    updatedFields = __spreadArray(__spreadArray([], fields, true), [
                        {
                            name: newFieldName.trim(),
                            enabled: true
                        }
                    ], false);
                    setFields(updatedFields); // Optimistic update
                    setNewFieldName('');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, fetch('/api/config/fields', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fields: updatedFields }),
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok)
                        throw new Error('Failed to save fields');
                    return [4 /*yield*/, fetch('/api/config/fields')];
                case 3:
                    fetchRes = _a.sent();
                    return [4 /*yield*/, fetchRes.json()];
                case 4:
                    data = _a.sent();
                    setFields(Array.isArray(data) ? data : updatedFields);
                    toast({
                        title: "Field Added",
                        description: "".concat(newFieldName, " field has been added successfully"),
                    });
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    toast({
                        title: "Error",
                        description: "Failed to save new field to backend",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    // Add new compliance field using new backend API (POST single field)
    var addNewComplianceField = function () { return __awaiter(_this, void 0, void 0, function () {
        var name, response, fetchRes, data, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    name = newComplianceFieldName.trim();
                    if (!name || complianceFields.find(function (f) { return f.name.toLowerCase() === name.toLowerCase(); }))
                        return [2 /*return*/];
                    setIsLoadingCompliance(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, fetch('/api/config/compliance-fields', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: name,
                                enabled: true,
                                fieldType: 'compliance',
                            }),
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok)
                        throw new Error('Failed to save compliance field');
                    setNewComplianceFieldName('');
                    return [4 /*yield*/, fetch('/api/config/compliance-fields')];
                case 3:
                    fetchRes = _a.sent();
                    return [4 /*yield*/, fetchRes.json()];
                case 4:
                    data = _a.sent();
                    setComplianceFields(Array.isArray(data) ? data : []);
                    toast({
                        title: "Compliance Field Added",
                        description: "".concat(name, " field has been added successfully"),
                    });
                    return [3 /*break*/, 7];
                case 5:
                    error_2 = _a.sent();
                    toast({
                        title: "Error",
                        description: "Failed to save new compliance field to backend",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 7];
                case 6:
                    setIsLoadingCompliance(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var updateFieldEnablement = function (fieldName, enabled) {
        setFields(function (prev) { return prev.map(function (f) {
            return f.name === fieldName ? __assign(__assign({}, f), { enabled: enabled }) : f;
        }); });
    };
    // Update compliance field enablement using PATCH (new API)
    var updateComplianceFieldEnablement = function (fieldName, enabled) { return __awaiter(_this, void 0, void 0, function () {
        var field, response, fetchRes, data, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    field = complianceFields.find(function (f) { return f.name === fieldName; });
                    if (!field || !field._id)
                        return [2 /*return*/];
                    setIsLoadingCompliance(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, fetch("/api/config/compliance-fields/".concat(field._id), {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enabled: enabled }),
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok)
                        throw new Error('Failed to update compliance field');
                    return [4 /*yield*/, fetch('/api/config/compliance-fields')];
                case 3:
                    fetchRes = _a.sent();
                    return [4 /*yield*/, fetchRes.json()];
                case 4:
                    data = _a.sent();
                    setComplianceFields(Array.isArray(data) ? data : complianceFields);
                    return [3 /*break*/, 7];
                case 5:
                    error_3 = _a.sent();
                    toast({
                        title: "Error",
                        description: "Failed to update compliance field",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 7];
                case 6:
                    setIsLoadingCompliance(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    // Save enabled fields to backend and refetch after save
    var saveFieldSettings = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, fetchRes, data, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, fetch('/api/config/fields', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fields: fields }),
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok)
                        throw new Error('Failed to save fields');
                    return [4 /*yield*/, fetch('/api/config/fields')];
                case 2:
                    fetchRes = _a.sent();
                    return [4 /*yield*/, fetchRes.json()];
                case 3:
                    data = _a.sent();
                    setFields(Array.isArray(data) ? data : fields);
                    toast({
                        title: "Settings Saved",
                        description: "Field enablement configuration has been saved successfully",
                    });
                    return [3 /*break*/, 5];
                case 4:
                    error_4 = _a.sent();
                    console.error("Error saving fields:", error_4);
                    toast({
                        title: "Error",
                        description: "Failed to save field configuration",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    // Save compliance fields: update all fields (enabled/disabled/order) using PATCH for each field
    var saveComplianceFieldSettings = function () { return __awaiter(_this, void 0, void 0, function () {
        var fetchRes, data, error_5;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsLoadingCompliance(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    // Update all fields in parallel
                    return [4 /*yield*/, Promise.all(complianceFields.map(function (field) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!field._id)
                                            return [2 /*return*/];
                                        return [4 /*yield*/, fetch("/api/config/compliance-fields/".concat(field._id), {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    enabled: field.enabled,
                                                    displayOrder: field.displayOrder,
                                                }),
                                            })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 2:
                    // Update all fields in parallel
                    _a.sent();
                    return [4 /*yield*/, fetch('/api/config/compliance-fields')];
                case 3:
                    fetchRes = _a.sent();
                    return [4 /*yield*/, fetchRes.json()];
                case 4:
                    data = _a.sent();
                    setComplianceFields(Array.isArray(data) ? data : complianceFields);
                    toast({
                        title: "Compliance Settings Saved",
                        description: "Compliance field configuration has been saved successfully",
                    });
                    return [3 /*break*/, 7];
                case 5:
                    error_5 = _a.sent();
                    toast({
                        title: "Error",
                        description: "Failed to save compliance field configuration",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 7];
                case 6:
                    setIsLoadingCompliance(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    // Delete field from backend
    var deleteField = function (fieldName) { return __awaiter(_this, void 0, void 0, function () {
        var updatedFields, response, fetchRes, data, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    updatedFields = fields.filter(function (f) { return f.name !== fieldName; });
                    setFields(updatedFields);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, fetch('/api/config/fields', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fields: updatedFields }),
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok)
                        throw new Error('Failed to delete field');
                    return [4 /*yield*/, fetch('/api/config/fields')];
                case 3:
                    fetchRes = _a.sent();
                    return [4 /*yield*/, fetchRes.json()];
                case 4:
                    data = _a.sent();
                    setFields(Array.isArray(data) ? data : updatedFields);
                    toast({
                        title: "Field Deleted",
                        description: "".concat(fieldName, " field has been deleted successfully"),
                        variant: "destructive",
                    });
                    return [3 /*break*/, 6];
                case 5:
                    error_6 = _a.sent();
                    toast({
                        title: "Error",
                        description: "Failed to delete field from backend",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    // Delete compliance field using DELETE (new API, by _id)
    var deleteComplianceField = function (fieldNameOrId) { return __awaiter(_this, void 0, void 0, function () {
        var field, response, fetchRes, data, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    field = complianceFields.find(function (f) { return f._id === fieldNameOrId; });
                    if (!field)
                        field = complianceFields.find(function (f) { return f.name === fieldNameOrId; });
                    if (!field || !field._id) {
                        toast({
                            title: "Error",
                            description: "Field not found or missing id",
                            variant: "destructive",
                        });
                        return [2 /*return*/];
                    }
                    setIsLoadingCompliance(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, fetch("/api/config/compliance-fields/".concat(field._id), {
                            method: 'DELETE',
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok)
                        throw new Error('Failed to delete compliance field');
                    return [4 /*yield*/, fetch('/api/config/compliance-fields')];
                case 3:
                    fetchRes = _a.sent();
                    return [4 /*yield*/, fetchRes.json()];
                case 4:
                    data = _a.sent();
                    setComplianceFields(Array.isArray(data) ? data : complianceFields);
                    toast({
                        title: "Compliance Field Deleted",
                        description: "".concat(field.name, " field has been deleted successfully"),
                        variant: "destructive",
                    });
                    return [3 /*break*/, 7];
                case 5:
                    error_7 = _a.sent();
                    toast({
                        title: "Error",
                        description: "Failed to delete compliance field from backend",
                        variant: "destructive",
                    });
                    return [3 /*break*/, 7];
                case 6:
                    setIsLoadingCompliance(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    // Credit card details
    var _t = useState({
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardholderName: '',
    }), cardDetails = _t[0], setCardDetails = _t[1];
    var handleCardDetailsChange = function (e) {
        var _a = e.target, name = _a.name, value = _a.value;
        setCardDetails(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[name] = value, _a)));
        });
    };
    var saveCardDetails = function () {
        if (cardDetails.cardNumber && cardDetails.expiryDate && cardDetails.cvv && cardDetails.cardholderName) {
            toast({
                title: "Card Details Saved",
                description: "Credit card information has been saved successfully",
            });
        }
        else {
            toast({
                title: "Error",
                description: "Please fill in all card details",
                variant: "destructive",
            });
        }
    };
    // Handler for adding a new payment method (POST to backend)
    function handleAddPaymentMethod(e) {
        e.preventDefault();
        if (!paymentForm.title.trim() || !paymentForm.type.trim())
            return;
        fetch("/api/payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: paymentForm.title,
                type: paymentForm.type,
                description: paymentForm.description,
                icon: paymentForm.icon,
                manager: paymentForm.manager,
                expiresAt: paymentForm.expiresAt,
            }),
        })
            .then(function (res) { return res.json(); })
            .then(function () {
            // Refetch payment methods after adding
            fetch("/api/payment")
                .then(function (res) { return res.json(); })
                .then(function (data) { return setPaymentMethods(data); });
            queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
            setAddPaymentModalOpen(false);
            setPaymentForm({
                title: '',
                type: '',
                description: '',
                icon: '',
                manager: '',
                expiresAt: '',
            });
            toast({ title: 'Payment method added', description: 'A new payment method has been added.' });
        });
    }
    // --- Payment Method Modal State ---
    var _u = useState(false), addPaymentModalOpen = _u[0], setAddPaymentModalOpen = _u[1];
    var _v = useState({
        title: '',
        type: '',
        description: '',
        icon: '',
        manager: '',
        expiresAt: '',
    }), paymentForm = _v[0], setPaymentForm = _v[1];
    // Card image options for payment method
    var iconOptions = [
        { value: 'visa', label: 'Visa', img: cardImages.visa },
        { value: 'mastercard', label: 'MasterCard', img: cardImages.mastercard },
        { value: 'paypal', label: 'PayPal', img: cardImages.paypal },
        { value: 'amex', label: 'Amex', img: cardImages.amex },
        { value: 'apple_pay', label: 'Apple Pay', img: cardImages.apple_pay },
        { value: 'google_pay', label: 'Google Pay', img: cardImages.google_pay },
        { value: 'bank', label: 'Bank', img: cardImages.bank },
        { value: 'cash', label: 'Cash', img: cardImages.cash },
        { value: 'other', label: 'Other', img: cardImages.other },
    ];
    return (_jsx("div", { className: "min-h-screen p-4 bg-gray-50", children: _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 tracking-tight", children: "Setup & Configuration" }), _jsx("p", { className: "text-base text-gray-600 mt-1 font-light", children: "Configure your subscription settings, currencies, and payment methods" }), _jsx("div", { className: "mt-4", children: _jsxs(Tabs, { defaultValue: "currency", className: "mb-6", children: [_jsxs(TabsList, { className: "flex w-full bg-white rounded-lg p-1 shadow-sm mb-6", children: [_jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "currency", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\n                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\n                  text-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(DollarSign, { className: "w-4 h-4" }), _jsx("span", { children: "Currency" })] }) }), _jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "payment", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\n                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\n                  text-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(Banknote, { className: "w-4 h-4" }), _jsx("span", { children: "Payment Methods" })] }) }), _jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "reminder", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\n                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\n                  text-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(Bell, { className: "w-4 h-4" }), _jsx("span", { children: "Reminder Policy" })] }) }), _jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "subscription", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\n                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\n                  text-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(CreditCard, { className: "w-4 h-4" }), _jsx("span", { children: "Subscription" })] }) }), _jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "compliance", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\n                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\n                  text-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(Shield, { className: "w-4 h-4" }), _jsx("span", { children: "Compliance" })] }) })] }), _jsxs(AnimatePresence, { mode: "wait", children: [_jsx(TabsContent, { value: "currency", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsxs(Card, { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx(DollarSign, { className: "w-5 h-5" }), _jsx("h3", { className: "text-xl font-semibold", children: "Currency Management" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", children: "View Exchange Rates" }), _jsx(Button, { onClick: function () { return setAddCurrencyOpen(true); }, children: "Add Currency" })] })] }), _jsx(Dialog, { open: addCurrencyOpen, onOpenChange: setAddCurrencyOpen, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsx(DialogHeader, { className: "flex flex-col space-y-4", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(DialogTitle, { children: "Add New Currency" }), _jsx(Button, { className: "mr-8 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white", size: "sm", onClick: function () {
                                                                                    setSelectedCurrency(newCurrency);
                                                                                    setExchangeRateOpen(true);
                                                                                }, children: "Exchange Rate" }), _jsx(Dialog, { open: exchangeRateOpen, onOpenChange: setExchangeRateOpen, children: _jsxs(DialogContent, { className: "sm:max-w-[900px]", children: [_jsx(DialogHeader, { children: _jsx("div", { className: "flex items-center gap-2 mb-4", children: _jsxs("h1", { className: "text-2xl font-bold flex items-center gap-2", children: [_jsx("span", { className: "text-2xl", children: selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.symbol }), " ", selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.code, " - ", selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.name] }) }) }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gray-50 p-6 rounded-lg", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Currency Details" }), _jsxs("div", { className: "grid grid-cols-4 gap-6", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-sm text-gray-600", children: "Currency Code" }), _jsx("div", { className: "font-semibold", children: (selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.code) || '-' })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm text-gray-600", children: "Description" }), _jsx("div", { className: "font-semibold", children: (selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.name) || '-' })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm text-gray-600", children: "ISO Number" }), _jsx("div", { className: "font-semibold", children: (selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.isoNumber) || '-' })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm text-gray-600", children: "Symbol" }), _jsx("div", { className: "font-semibold", children: (selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.symbol) || '-' })] })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h2", { className: "text-lg font-semibold", children: ["Exchange Rates for ", selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.code] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white", onClick: function () {
                                                                                                                                var emptyRate = {
                                                                                                                                    date: '',
                                                                                                                                    code: (selectedCurrency === null || selectedCurrency === void 0 ? void 0 : selectedCurrency.code) || '',
                                                                                                                                    relCurrency: '',
                                                                                                                                    rate: '',
                                                                                                                                    relRate: '',
                                                                                                                                    isEditing: true
                                                                                                                                };
                                                                                                                                setExchangeRates(__spreadArray(__spreadArray([], exchangeRates, true), [emptyRate], false));
                                                                                                                            }, children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Rate"] }), _jsx(Button, { variant: "outline", onClick: function () {
                                                                                                                                // Handle Update Rates click
                                                                                                                                toast({
                                                                                                                                    title: "Update Rates",
                                                                                                                                    description: "Update rates functionality will be implemented here",
                                                                                                                                });
                                                                                                                            }, children: "Update Rates" })] })] }), _jsx("div", { className: "rounded-md border", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "Starting Date" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "Currency Code" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "Relational Currency" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "Exch. Rate Amount" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "Relational Exch. Rate Amount" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200 bg-white", children: exchangeRates.map(function (rate, index) { return (_jsxs("tr", { children: [_jsx("td", { className: "py-2 px-4", children: _jsx(Input, { type: "date", value: rate.date, onChange: function (e) {
                                                                                                                                            var updatedRates = __spreadArray([], exchangeRates, true);
                                                                                                                                            updatedRates[index] = __assign(__assign({}, rate), { date: e.target.value });
                                                                                                                                            setExchangeRates(updatedRates);
                                                                                                                                        }, className: "h-8" }) }), _jsx("td", { className: "py-2 px-4", children: _jsx(Input, { value: rate.code, disabled: true, className: "h-8 bg-gray-50" }) }), _jsx("td", { className: "py-2 px-4", children: _jsx(Input, { value: rate.relCurrency, onChange: function (e) {
                                                                                                                                            var updatedRates = __spreadArray([], exchangeRates, true);
                                                                                                                                            updatedRates[index] = __assign(__assign({}, rate), { relCurrency: e.target.value });
                                                                                                                                            setExchangeRates(updatedRates);
                                                                                                                                        }, placeholder: "e.g., SGD", className: "h-8" }) }), _jsx("td", { className: "py-2 px-4", children: _jsx(Input, { type: "number", value: rate.rate, onChange: function (e) {
                                                                                                                                            var updatedRates = __spreadArray([], exchangeRates, true);
                                                                                                                                            updatedRates[index] = __assign(__assign({}, rate), { rate: e.target.value });
                                                                                                                                            setExchangeRates(updatedRates);
                                                                                                                                        }, placeholder: "e.g., 1", className: "h-8" }) }), _jsxs("td", { className: "py-2 px-4 flex gap-2", children: [_jsx(Input, { type: "number", value: rate.relRate, onChange: function (e) {
                                                                                                                                                var updatedRates = __spreadArray([], exchangeRates, true);
                                                                                                                                                updatedRates[index] = __assign(__assign({}, rate), { relRate: e.target.value });
                                                                                                                                                setExchangeRates(updatedRates);
                                                                                                                                            }, placeholder: "e.g., 1.35", className: "h-8" }), _jsx(Button, { variant: "ghost", size: "sm", className: "h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50", onClick: function () {
                                                                                                                                                var updatedRates = __spreadArray([], exchangeRates, true);
                                                                                                                                                updatedRates.splice(index, 1);
                                                                                                                                                setExchangeRates(updatedRates);
                                                                                                                                            }, children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }, index)); }) })] }) })] })] })] }) })] }) }), _jsxs("div", { className: "space-y-4 py-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Currency Code" }), _jsx(Input, { placeholder: "e.g., USD, EUR", value: newCurrency.code, onChange: function (e) { return setNewCurrency(__assign(__assign({}, newCurrency), { code: e.target.value })); } })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Description" }), _jsx(Input, { placeholder: "e.g., United States Dollar", value: newCurrency.name, onChange: function (e) { return setNewCurrency(__assign(__assign({}, newCurrency), { name: e.target.value })); } })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "ISO Number" }), _jsx(Input, { placeholder: "e.g., 840", value: newCurrency.isoNumber, onChange: function (e) { return setNewCurrency(__assign(__assign({}, newCurrency), { isoNumber: e.target.value })); } })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Symbol" }), _jsx(Input, { placeholder: "e.g., $", value: newCurrency.symbol, onChange: function (e) { return setNewCurrency(__assign(__assign({}, newCurrency), { symbol: e.target.value })); } })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: function () { return setAddCurrencyOpen(false); }, children: "Cancel" }), _jsx(Button, { onClick: function () {
                                                                                addNewCurrency();
                                                                                setAddCurrencyOpen(false);
                                                                            }, children: "Add Currency" })] })] }) }), _jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "rounded-md border", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "CURRENCY CODE" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "DESCRIPTION" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "ISO NUMBER" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "SYMBOL" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "CURRENT MONTH EXCH. RATE" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "CREATED" }), _jsx("th", { className: "py-3 px-4 text-left text-sm font-semibold text-gray-900", children: "ACTIONS" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200 bg-white", children: currencies.map(function (currency) { return (_jsxs("tr", { children: [_jsx("td", { className: "py-3 px-4 text-sm text-gray-900", children: currency.code }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-900", children: currency.name }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-500", children: currency.isoNumber || '-' }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-900", children: currency.symbol }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-500", children: currency.exchangeRate || '-' }), _jsx("td", { className: "py-3 px-4 text-sm text-gray-500", children: currency.created || 'Aug 11, 2025' }), _jsx("td", { className: "py-3 px-4", children: _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", className: "h-8 w-8 p-0", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", className: "h-8 w-8 p-0", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", className: "h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50", onClick: function () { return deleteCurrency(currency.code); }, children: _jsx(Trash2, { className: "h-4 w-4" }) })] }) })] }, currency.code)); }) })] }) }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("span", { className: "font-semibold", children: currencies.filter(function (c) { return c.visible; }).length }), " enabled currencies,", _jsx("span", { className: "font-semibold ml-1", children: currencies.filter(function (c) { return !c.visible; }).length }), " disabled currencies"] }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: saveCurrencySettings, className: "flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg", children: [_jsx(Settings, { className: "w-4 h-4" }), _jsx("span", { children: "Save Configuration" })] }) })] })] })] }) }) }), _jsx(TabsContent, { value: "payment", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsxs(Card, { className: "bg-white border border-gray-200 shadow-sm p-6 rounded-xl", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6", children: [_jsx(Input, { placeholder: "Search payment methods...", className: "w-full md:w-1/2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: function () { return setAddPaymentModalOpen(true); }, className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Payment Method"] }) })] }), _jsx("div", { className: "mt-6 grid grid-cols-1 md:grid-cols-2 gap-4", children: paymentMethods.map(function (method, idx) {
                                                            var iconObj = iconOptions.find(function (opt) { return opt.value === method.icon; });
                                                            return (_jsxs("div", { className: "flex items-center gap-4 p-4 border rounded-xl bg-gray-50", children: [iconObj ? (_jsx("div", { className: "flex-shrink-0", children: _jsx("img", { src: iconObj.img, alt: iconObj.label, className: "w-12 h-8 object-contain" }) })) : (_jsx("div", { className: "w-12 h-8 bg-gray-200 rounded" })), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-semibold text-gray-900", children: method.name }), _jsx("div", { className: "text-xs text-gray-500", children: method.type })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { size: "icon", variant: "ghost", onClick: function () { return openEditPayment(method); }, title: "Edit", className: "text-indigo-600 hover:bg-indigo-50 rounded-full", children: _jsx(Edit, { size: 18 }) }), _jsx(Button, { size: "icon", variant: "ghost", onClick: function () { return handleDeletePaymentMethod(method); }, title: "Delete", className: "text-red-600 hover:bg-red-50 rounded-full", children: _jsx(Trash2, { size: 18 }) })] })] }, idx));
                                                        }) }), _jsx(Dialog, { open: editPaymentModalOpen, onOpenChange: setEditPaymentModalOpen, children: _jsxs(DialogContent, { className: "sm:max-w-lg bg-white/95 backdrop-blur-sm shadow-xl border-0 rounded-xl", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { className: "text-lg font-semibold text-gray-800 flex items-center gap-2", children: "Edit Payment Method" }) }), _jsxs("form", { onSubmit: handleEditPaymentMethod, className: "space-y-5", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Title (*)" }), _jsx(Input, { required: true, placeholder: "Title", value: paymentForm.title, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { title: e.target.value })); }); } })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Type (*)" }), _jsxs("select", { required: true, className: "w-full border-gray-300 rounded-lg h-10", value: paymentForm.type, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { type: e.target.value })); }); }, children: [_jsx("option", { value: "", children: "Select type" }), _jsx("option", { value: "Credit", children: "Credit" }), _jsx("option", { value: "Debit", children: "Debit" }), _jsx("option", { value: "Cash", children: "Cash" }), _jsx("option", { value: "Other", children: "Other" })] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Description" }), _jsx(Input, { placeholder: "Description", value: paymentForm.description, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { description: e.target.value })); }); } })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Card Image" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-2", children: iconOptions.map(function (opt) { return (_jsx("button", { type: "button", className: "p-2 border rounded-lg bg-white ".concat(paymentForm.icon === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'), onClick: function () { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { icon: opt.value })); }); }, title: opt.label, children: _jsx("img", { src: opt.img, alt: opt.label, className: "w-12 h-8 object-contain" }) }, opt.value)); }) })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Managed by" }), _jsx(Input, { placeholder: "Manager name", value: paymentForm.manager, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { manager: e.target.value })); }); } })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Expires at" }), _jsx(Input, { type: "date", value: paymentForm.expiresAt, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { expiresAt: e.target.value })); }); } })] }), _jsxs("div", { className: "flex justify-end space-x-3 pt-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: function () { return setEditPaymentModalOpen(false); }, className: "border-gray-300 text-gray-700 rounded-lg h-10 px-4", children: "Cancel" }), _jsx(Button, { type: "submit", className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4", children: "Save Changes" })] })] })] }) }), _jsx(Dialog, { open: addPaymentModalOpen, onOpenChange: setAddPaymentModalOpen, children: _jsxs(DialogContent, { className: "sm:max-w-lg bg-white/95 backdrop-blur-sm shadow-xl border-0 rounded-xl", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { className: "text-lg font-semibold text-gray-800 flex items-center gap-2", children: "Create new method" }) }), _jsxs("form", { onSubmit: handleAddPaymentMethod, className: "space-y-5", children: [_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Title (*)" }), _jsx(Input, { required: true, placeholder: "Title", value: paymentForm.title, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { title: e.target.value })); }); } })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Type (*)" }), _jsxs("select", { required: true, className: "w-full border-gray-300 rounded-lg h-10", value: paymentForm.type, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { type: e.target.value })); }); }, children: [_jsx("option", { value: "", children: "Select type" }), _jsx("option", { value: "Credit", children: "Credit" }), _jsx("option", { value: "Debit", children: "Debit" }), _jsx("option", { value: "Cash", children: "Cash" }), _jsx("option", { value: "Other", children: "Other" })] })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Description" }), _jsx(Input, { placeholder: "Description", value: paymentForm.description, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { description: e.target.value })); }); } })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Card Image" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-2", children: iconOptions.map(function (opt) { return (_jsx("button", { type: "button", className: "p-2 border rounded-lg bg-white ".concat(paymentForm.icon === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'), onClick: function () { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { icon: opt.value })); }); }, title: opt.label, children: _jsx("img", { src: opt.img, alt: opt.label, className: "w-12 h-8 object-contain" }) }, opt.value)); }) })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Managed by" }), _jsx(Input, { placeholder: "Manager name", value: paymentForm.manager, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { manager: e.target.value })); }); } })] }), _jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium text-gray-700", children: "Expires at" }), _jsx(Input, { type: "date", value: paymentForm.expiresAt, onChange: function (e) { return setPaymentForm(function (f) { return (__assign(__assign({}, f), { expiresAt: e.target.value })); }); } })] }), _jsxs("div", { className: "flex justify-end space-x-3 pt-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: function () { return setAddPaymentModalOpen(false); }, className: "border-gray-300 text-gray-700 rounded-lg h-10 px-4", children: "Cancel" }), _jsx(Button, { type: "submit", className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4", children: "Create" })] })] })] }) })] }) }) }), _jsx(TabsContent, { value: "reminder", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsxs(Card, { className: "bg-white border border-gray-200 shadow-sm p-6 rounded-xl", children: [_jsxs("div", { className: "flex items-center gap-4 mb-6", children: [_jsx(motion.div, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, className: "w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md", children: _jsx(Bell, { className: "text-white", size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Reminder Policy" }), _jsx("p", { className: "text-gray-500 text-sm", children: "Configure reminder settings" })] })] }), _jsx("div", { className: "text-gray-600 py-8 text-center", children: "Reminder policy configuration will appear here." })] }) }) }), _jsx(TabsContent, { value: "subscription", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsxs(Card, { className: "bg-white border border-gray-200 shadow-sm p-6 rounded-xl", children: [_jsxs("div", { className: "flex items-center gap-4 mb-6", children: [_jsx(motion.div, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, className: "w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md", children: _jsx(Settings, { className: "text-white", size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Field Enablement" }), _jsx("p", { className: "text-gray-500 text-sm", children: "Configure which fields are enabled for subscriptions" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center space-x-4 p-4 bg-gray-50 rounded-xl", children: [_jsx(Input, { placeholder: "Enter new field name", value: newFieldName, onChange: function (e) { return setNewFieldName(e.target.value); }, className: "flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10", onKeyPress: function (e) { return e.key === 'Enter' && addNewField(); } }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: addNewField, disabled: !newFieldName.trim(), className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Field"] }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-base font-semibold text-gray-900", children: "Available Fields" }), isLoading ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" }) })) : fields.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No fields configured. Add your first field above." })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: fields.map(function (field) { return (_jsx(motion.div, { whileHover: { y: -5 }, className: "p-4 border rounded-xl transition-all duration-300 ".concat(field.enabled
                                                                                ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                                                                : 'border-gray-200 bg-gray-50'), children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Checkbox, { checked: field.enabled, onCheckedChange: function (checked) { return updateFieldEnablement(field.name, checked); }, className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded" }), _jsx(Label, { className: "text-sm font-medium cursor-pointer text-gray-900", children: field.name })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [field.enabled ? (_jsxs(Badge, { className: "bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full", children: [_jsx(Eye, { className: "w-3 h-3 mr-1" }), "Enabled"] })) : (_jsxs(Badge, { className: "bg-gray-100 text-gray-600 text-xs font-semibold py-1 px-3 rounded-full", children: [_jsx(EyeOff, { className: "w-3 h-3 mr-1" }), "Disabled"] })), _jsx("button", { className: "text-red-500 hover:text-red-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300", title: "Delete field", onClick: function () { return deleteField(field.name); }, children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] })] }) }, field.name)); }) }))] }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("span", { className: "font-semibold", children: fields.filter(function (f) { return f.enabled; }).length }), " enabled fields,", _jsx("span", { className: "font-semibold ml-1", children: fields.filter(function (f) { return !f.enabled; }).length }), " disabled fields"] }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: saveFieldSettings, disabled: isLoading || fields.length === 0, className: "flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg disabled:opacity-50", children: [_jsx(Settings, { className: "w-4 h-4" }), _jsx("span", { children: "Save Configuration" })] }) })] })] })] }) }) }), _jsx(TabsContent, { value: "compliance", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsxs(Card, { className: "bg-white border border-gray-200 shadow-sm p-6 rounded-xl", children: [_jsxs("div", { className: "flex items-center gap-4 mb-6", children: [_jsx(motion.div, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, className: "w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md", children: _jsx(Shield, { className: "text-white", size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Compliance Fields" }), _jsx("p", { className: "text-gray-500 text-sm", children: "Configure which compliance fields are enabled" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center space-x-4 p-4 bg-gray-50 rounded-xl", children: [_jsx(Input, { placeholder: "Enter new compliance field name", value: newComplianceFieldName, onChange: function (e) { return setNewComplianceFieldName(e.target.value); }, className: "flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10", onKeyPress: function (e) { return e.key === 'Enter' && addNewComplianceField(); } }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: addNewComplianceField, disabled: !newComplianceFieldName.trim(), className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Field"] }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-base font-semibold text-gray-900", children: "Available Compliance Fields" }), isLoadingCompliance ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" }) })) : complianceFields.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No compliance fields configured. Add your first field above." })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: complianceFields.map(function (field) { return (_jsx(motion.div, { whileHover: { y: -5 }, className: "p-4 border rounded-xl transition-all duration-300 ".concat(field.enabled
                                                                                ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                                                                : 'border-gray-200 bg-gray-50'), children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Checkbox, { checked: field.enabled, onCheckedChange: function (checked) { return updateComplianceFieldEnablement(field.name, checked); }, className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded" }), _jsx(Label, { className: "text-sm font-medium cursor-pointer text-gray-900", children: field.name })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [field.enabled ? (_jsxs(Badge, { className: "bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full", children: [_jsx(Eye, { className: "w-3 h-3 mr-1" }), "Enabled"] })) : (_jsxs(Badge, { className: "bg-gray-100 text-gray-600 text-xs font-semibold py-1 px-3 rounded-full", children: [_jsx(EyeOff, { className: "w-3 h-3 mr-1" }), "Disabled"] })), _jsx("button", { className: "text-red-500 hover:text-red-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300 ".concat(!field._id ? 'opacity-50 cursor-not-allowed' : ''), title: field._id ? "Delete field" : "Cannot delete: missing id. Please refresh or re-add this field.", onClick: function () { return field._id && deleteComplianceField(field._id); }, disabled: !field._id, children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] })] }) }, field._id || field.name)); }) }))] }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("span", { className: "font-semibold", children: complianceFields.filter(function (f) { return f.enabled; }).length }), " enabled fields,", _jsx("span", { className: "font-semibold ml-1", children: complianceFields.filter(function (f) { return !f.enabled; }).length }), " disabled fields"] }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: saveComplianceFieldSettings, disabled: isLoadingCompliance || complianceFields.length === 0, className: "flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg disabled:opacity-50", children: [_jsx(Settings, { className: "w-4 h-4" }), _jsx("span", { children: "Save Configuration" })] }) })] })] })] }) }) })] })] }) })] }) }));
}
