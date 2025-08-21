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
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
// Dummy fallback for company name
var COMPANY_NAME = "Your Company";
// Get subscription name from query param (e.g. /subscription-user?name=ChatGPT)
function getSubscriptionNameFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get("name") || "Subscription";
}
export default function SubscriptionUserPage() {
    var _this = this;
    var subscriptionName = getSubscriptionNameFromUrl();
    var subscriptionId = null;
    // Fetch all employees
    var _a = useQuery({
        queryKey: ["/api/employees"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/api/employees", { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, Array.isArray(data) ? data : []];
                }
            });
        }); },
    }), _b = _a.data, employees = _b === void 0 ? [] : _b, employeesLoading = _a.isLoading;
    // Fetch users already added to this subscription
    var _c = useQuery({
        queryKey: ["/api/subscriptions", subscriptionId, "users"],
        enabled: !!subscriptionId,
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var res, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!subscriptionId)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, fetch("/api/subscriptions/".concat(subscriptionId, "/users"), { credentials: "include" })];
                    case 1:
                        res = _a.sent();
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, Array.isArray(data) ? data : []];
                }
            });
        }); },
    }), _d = _c.data, subscriptionUsers = _d === void 0 ? [] : _d, refetchSubscriptionUsers = _c.refetch;
    // Local state
    var _e = useState([]), selectedUsers = _e[0], setSelectedUsers = _e[1];
    var _f = useState(""), searchLeft = _f[0], setSearchLeft = _f[1];
    var _g = useState(""), searchRight = _g[0], setSearchRight = _g[1];
    var _h = useState(false), isSaving = _h[0], setIsSaving = _h[1];
    // On initial mount, set selectedUsers from backend (only once)
    useEffect(function () {
        if (Array.isArray(subscriptionUsers) && subscriptionUsers.length > 0) {
            setSelectedUsers(subscriptionUsers);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Filtered employees (not already added)
    var availableEmployees = useMemo(function () {
        return employees.filter(function (emp) {
            var _a;
            var empId = emp.id || emp._id;
            return (!selectedUsers.some(function (u) { return (u.id || u._id) === empId; }) &&
                (((_a = emp.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchLeft.toLowerCase())) || ""));
        });
    }, [employees, selectedUsers, searchLeft]);
    // Filtered selected users
    var filteredSelectedUsers = useMemo(function () {
        return selectedUsers.filter(function (u) { var _a; return (_a = u.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchRight.toLowerCase()); });
    }, [selectedUsers, searchRight]);
    // Add user
    var handleAddUser = function (emp) {
        var empId = emp.id || emp._id;
        setSelectedUsers(function (prev) {
            if (prev.some(function (u) { return (u.id || u._id) === empId; }))
                return prev;
            return __spreadArray(__spreadArray([], prev, true), [emp], false);
        });
    };
    // Remove user
    var handleRemoveUser = function (user) {
        var userId = user.id || user._id;
        setSelectedUsers(function (prev) { return prev.filter(function (u) { return (u.id || u._id) !== userId; }); });
    };
    // Add all users
    var handleAddAll = function () {
        setSelectedUsers(function (prev) {
            var newUsers = availableEmployees.filter(function (emp) {
                var empId = emp.id || emp._id;
                return !prev.some(function (u) { return (u.id || u._id) === empId; });
            });
            return __spreadArray(__spreadArray([], prev, true), newUsers, true);
        });
    };
    // Remove all
    var handleRemoveAll = function () {
        setSelectedUsers([]);
    };
    // Save handler
    var handleSave = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsSaving(true);
                    // TODO: Save to backend
                    console.log("Saving selected users:", selectedUsers);
                    // Simulate API call
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 800); })];
                case 1:
                    // Simulate API call
                    _a.sent();
                    setIsSaving(false);
                    window.history.back();
                    return [2 /*return*/];
            }
        });
    }); };
    // Cancel handler
    var handleCancel = function () {
        window.history.back();
    };
    // Animation variants
    var containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };
    var itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 24
            }
        },
        exit: {
            y: -20,
            opacity: 0,
            transition: {
                duration: 0.2
            }
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4 md:p-8", children: _jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsxs(motion.div, { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 }, className: "text-center mb-10", children: [_jsx("h1", { className: "text-3xl md:text-4xl font-bold text-gray-800 mb-2", children: "Manage Subscription Users" }), _jsxs("p", { className: "text-gray-600 max-w-2xl mx-auto", children: ["Add or remove team members from the ", _jsx("span", { className: "font-semibold text-indigo-600", children: subscriptionName }), " subscription."] })] }), _jsxs("div", { className: "flex flex-col lg:flex-row gap-8", children: [_jsxs(motion.div, { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.5, delay: 0.2 }, className: "flex-1 bg-white rounded-2xl shadow-xl overflow-hidden", children: [_jsxs("div", { className: "p-6 border-b border-gray-200", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-800", children: [COMPANY_NAME, "'s Team Members"] }), _jsxs(Badge, { variant: "secondary", className: "bg-blue-100 text-blue-800", children: [availableEmployees.length, " available"] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Input, { placeholder: "Search team members...", value: searchLeft, onChange: function (e) { return setSearchLeft(e.target.value); }, className: "pl-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" }), _jsx("svg", { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) })] }), _jsx(Button, { onClick: handleAddAll, className: "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed", disabled: availableEmployees.length === 0, children: "Add All" })] })] }), _jsx("div", { className: "p-4 max-h-[500px] overflow-y-auto", children: employeesLoading ? (_jsx("div", { className: "flex justify-center items-center h-64", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" }) })) : (_jsx(motion.div, { variants: containerVariants, initial: "hidden", animate: "visible", className: "space-y-3", children: _jsx(AnimatePresence, { children: availableEmployees.length > 0 ? (availableEmployees.map(function (emp) {
                                                var _a;
                                                return (_jsxs(motion.div, { variants: itemVariants, layout: true, exit: "exit", className: "flex items-center justify-between bg-gray-50 hover:bg-indigo-50 rounded-xl px-4 py-3 transition-colors duration-200 border border-gray-200", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md", children: (_a = emp.name) === null || _a === void 0 ? void 0 : _a.split(" ").map(function (n) { return n[0]; }).join("") }), _jsxs("div", { children: [_jsx("span", { className: "text-lg font-medium text-gray-800", children: emp.name }), _jsx("div", { className: "text-sm text-gray-500", children: emp.email || emp.department || "Team Member" })] })] }), _jsx(Button, { onClick: function () { return handleAddUser(emp); }, className: "bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105", children: "Add" })] }, emp.id || emp._id));
                                            })) : (_jsxs(motion.div, { variants: itemVariants, className: "text-center py-12", children: [_jsx("div", { className: "text-gray-400 mb-2", children: "No team members found" }), _jsx("div", { className: "text-sm text-gray-500", children: "Try adjusting your search criteria" })] })) }) })) })] }), _jsxs(motion.div, { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.5, delay: 0.4 }, className: "flex-1 bg-white rounded-2xl shadow-xl overflow-hidden", children: [_jsxs("div", { className: "p-6 border-b border-gray-200", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-800", children: ["Users in ", _jsx("span", { className: "text-indigo-600", children: subscriptionName })] }), _jsxs(Badge, { variant: "secondary", className: "bg-purple-100 text-purple-800", children: [selectedUsers.length, " added"] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Input, { placeholder: "Search added users...", value: searchRight, onChange: function (e) { return setSearchRight(e.target.value); }, className: "pl-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" }), _jsx("svg", { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) })] }), _jsx(Button, { onClick: handleRemoveAll, className: "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed", disabled: selectedUsers.length === 0, children: "Remove All" })] })] }), _jsx("div", { className: "p-4 max-h-[500px] overflow-y-auto", children: _jsx(motion.div, { variants: containerVariants, initial: "hidden", animate: "visible", className: "space-y-3", children: _jsx(AnimatePresence, { children: filteredSelectedUsers.length > 0 ? (filteredSelectedUsers.map(function (user) {
                                                var _a;
                                                return (_jsxs(motion.div, { variants: itemVariants, layout: true, exit: "exit", className: "flex items-center justify-between bg-gray-50 hover:bg-purple-50 rounded-xl px-4 py-3 transition-colors duration-200 border border-gray-200", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-md", children: (_a = user.name) === null || _a === void 0 ? void 0 : _a.split(" ").map(function (n) { return n[0]; }).join("") }), _jsxs("div", { children: [_jsx("span", { className: "text-lg font-medium text-gray-800", children: user.name }), _jsx("div", { className: "text-sm text-gray-500", children: user.email || user.department || "Team Member" })] })] }), _jsx(Button, { onClick: function () { return handleRemoveUser(user); }, className: "bg-gradient-to-r from-red-400 to-rose-500 hover:from-red-500 hover:to-rose-600 text-white font-semibold shadow-md transition-all duration-300 transform hover:scale-105", children: "Remove" })] }, user.id || user._id));
                                            })) : (_jsxs(motion.div, { variants: itemVariants, className: "text-center py-12", children: [_jsx("div", { className: "text-gray-400 mb-2", children: "No users added yet" }), _jsx("div", { className: "text-sm text-gray-500", children: "Add team members from the left panel" })] })) }) }) })] })] }), _jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.6 }, className: "flex justify-end gap-4 mt-10", children: [_jsx(Button, { variant: "outline", className: "border-gray-300 text-gray-700 px-8 py-3 text-lg font-medium rounded-xl shadow-sm hover:bg-gray-50 transition-colors duration-300", onClick: handleCancel, children: "Cancel" }), _jsx(Button, { className: "bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-75 disabled:cursor-not-allowed", onClick: handleSave, disabled: isSaving, children: isSaving ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("svg", { className: "animate-spin h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Saving..."] })) : ("Save Changes") })] })] }) }));
}
