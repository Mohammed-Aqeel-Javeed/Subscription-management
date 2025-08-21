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
// import { insertUserSchema } from "@shared/schema";
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Building2, Upload, Save, Eye, Settings, UserPlus, Trash2, User, Activity, UsersIcon, Search, Edit, Plus, Users, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import Papa from 'papaparse';
// CSV Utilities
var convertToCSV = function (employees) {
    return Papa.unparse(employees, {
        header: true,
        columns: ['name', 'email', 'department', 'role', 'status']
    });
};
var parseCSV = function (text) {
    return new Promise(function (resolve, reject) {
        Papa.parse(text, {
            header: true,
            complete: function (results) { return resolve(results.data); },
            error: function (error) { return reject(error); },
            transform: function (value) { return value.trim(); }
        });
    });
};
// Employee schema with free-text role
var employeeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    department: z.string().min(1, "Department is required"),
    status: z.enum(["active", "inactive"]),
    role: z.string().min(1, "Role is required"),
});
function EmployeeManagementTab(_a) {
    var _this = this;
    var departments = _a.departments;
    var _b = useState(false), modalOpen = _b[0], setModalOpen = _b[1];
    var _c = useState(), editingEmployee = _c[0], setEditingEmployee = _c[1];
    var _d = useState(""), searchTerm = _d[0], setSearchTerm = _d[1];
    var fileInputRef = React.useRef(null);
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    // Refetch employees on login/logout or page refresh
    React.useEffect(function () {
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    }, []);
    // Fetch employees from database
    var _e = useQuery({
        queryKey: ["/api/employees"],
    }), _f = _e.data, employeesRaw = _f === void 0 ? [] : _f, isLoading = _e.isLoading;
    // Map _id to id for frontend usage
    var employees = employeesRaw.map(function (emp) { return (__assign(__assign({}, emp), { id: emp._id })); });
    var form = useForm({
        resolver: zodResolver(employeeSchema),
        defaultValues: {
            name: "",
            email: "",
            department: "",
            status: "active",
            role: "",
        },
    });
    // Create employee mutation
    var createEmployeeMutation = useMutation({
        mutationFn: function (data) { return apiRequest("POST", "/api/employees", data); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
            toast({
                title: "Success",
                description: "Employee created successfully",
                duration: 1000,
            });
            setModalOpen(false);
            form.reset();
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to create employee",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    // Update employee mutation
    var updateEmployeeMutation = useMutation({
        mutationFn: function (_a) {
            var _id = _a._id, data = _a.data;
            return apiRequest("PUT", "/api/employees/".concat(_id), data);
        },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
            toast({
                title: "Success",
                description: "Employee updated successfully",
                duration: 1000,
            });
            setModalOpen(false);
            form.reset();
            setEditingEmployee(undefined);
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to update employee",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    // Delete employee mutation
    var deleteEmployeeMutation = useMutation({
        mutationFn: function (_id) { return apiRequest("DELETE", "/api/employees/".concat(_id)); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
            toast({
                title: "Success",
                description: "Employee deleted successfully",
                duration: 1000,
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete employee",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    // Filter employees based on search term
    var filteredEmployees = employees.filter(function (employee) {
        return employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.department.toLowerCase().includes(searchTerm.toLowerCase());
    });
    var handleEdit = function (employee) {
        setEditingEmployee(employee);
        form.reset({
            name: employee.name,
            email: employee.email,
            department: employee.department,
            status: employee.status,
            role: employee.role || "",
        });
        setModalOpen(true);
    };
    var handleDelete = function (_id) {
        if (confirm("Are you sure you want to delete this employee?")) {
            deleteEmployeeMutation.mutate(_id);
        }
    };
    var handleImport = function () {
        var _a;
        (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click();
    };
    var handleFileUpload = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var file, text, newEmployees, emailSet, _i, newEmployees_1, emp, _loop_1, _a, newEmployees_2, emp, _b, newEmployees_3, emp, promises, error_1;
        var _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    file = (_c = event.target.files) === null || _c === void 0 ? void 0 : _c[0];
                    if (!file)
                        return [2 /*return*/];
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, file.text()];
                case 2:
                    text = _g.sent();
                    newEmployees = void 0;
                    if (!file.name.endsWith('.csv')) return [3 /*break*/, 4];
                    return [4 /*yield*/, parseCSV(text)];
                case 3:
                    newEmployees = _g.sent();
                    return [3 /*break*/, 5];
                case 4:
                    newEmployees = JSON.parse(text);
                    _g.label = 5;
                case 5:
                    if (!Array.isArray(newEmployees)) {
                        throw new Error('Invalid file format. Expected a list of employees.');
                    }
                    emailSet = new Set();
                    for (_i = 0, newEmployees_1 = newEmployees; _i < newEmployees_1.length; _i++) {
                        emp = newEmployees_1[_i];
                        if (emailSet.has((_d = emp.email) === null || _d === void 0 ? void 0 : _d.toLowerCase())) {
                            throw new Error("Duplicate email found in import data: ".concat(emp.email));
                        }
                        emailSet.add((_e = emp.email) === null || _e === void 0 ? void 0 : _e.toLowerCase());
                    }
                    _loop_1 = function (emp) {
                        var existingEmployee = employees.find(function (existing) { var _a; return existing.email.toLowerCase() === ((_a = emp.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()); });
                        if (existingEmployee) {
                            throw new Error("Email already exists in system: ".concat(emp.email));
                        }
                    };
                    // Check for duplicate emails with existing employees
                    for (_a = 0, newEmployees_2 = newEmployees; _a < newEmployees_2.length; _a++) {
                        emp = newEmployees_2[_a];
                        _loop_1(emp);
                    }
                    // Validate each employee
                    for (_b = 0, newEmployees_3 = newEmployees; _b < newEmployees_3.length; _b++) {
                        emp = newEmployees_3[_b];
                        if (!emp.name || !emp.email || !emp.department || !emp.role) {
                            throw new Error('Invalid employee data. Required fields: name, email, department, role');
                        }
                        // Ensure status is valid
                        emp.status = ((_f = emp.status) === null || _f === void 0 ? void 0 : _f.toLowerCase()) === 'inactive' ? 'inactive' : 'active';
                    }
                    promises = newEmployees.map(function (emp) {
                        return apiRequest("POST", "/api/employees", emp);
                    });
                    return [4 /*yield*/, Promise.all(promises)];
                case 6:
                    _g.sent();
                    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
                    toast({
                        title: "Success",
                        description: "Imported ".concat(newEmployees.length, " employees successfully"),
                        duration: 2000,
                    });
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _g.sent();
                    toast({
                        title: "Error",
                        description: error_1.message || "Failed to import employees",
                        variant: "destructive",
                        duration: 2000,
                    });
                    return [3 /*break*/, 8];
                case 8:
                    // Clear the file input
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var handleExport = function () {
        try {
            // Always create at least one empty row to ensure headers are exported
            var exportData = employees.length > 0 ? employees.map(function (emp) { return ({
                name: emp.name,
                email: emp.email,
                department: emp.department,
                role: emp.role,
                status: emp.status
            }); }) : [{
                    name: "",
                    email: "",
                    department: "",
                    role: "",
                    status: ""
                }];
            // Convert to CSV with headers
            var csv = convertToCSV(exportData);
            // Create and download file
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = "employees_".concat(new Date().toISOString().split('T')[0], ".csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({
                title: "Success",
                description: "Exported ".concat(exportData.length, " employees successfully"),
                duration: 2000,
            });
        }
        catch (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to export employees",
                variant: "destructive",
                duration: 2000,
            });
        }
    };
    var handleAddNew = function () {
        setEditingEmployee(undefined);
        form.reset({
            name: "",
            email: "",
            department: "",
            status: "active",
            role: "",
        });
        setModalOpen(true);
    };
    var onSubmit = function (data) {
        if (editingEmployee) {
            // Update existing employee
            updateEmployeeMutation.mutate({ _id: editingEmployee._id, data: data });
        }
        else {
            // Add new employee
            createEmployeeMutation.mutate(data);
        }
    };
    var getStatusBadge = function (status) {
        return status === "active" ? (_jsxs(Badge, { className: "bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-1", children: [_jsx(Activity, { className: "w-3 h-3" }), "Active"] })) : (_jsxs(Badge, { className: "bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-1", children: [_jsx("div", { className: "w-1.5 h-1.5 bg-white rounded-full" }), "Inactive"] }));
    };
    if (isLoading) {
        return (_jsx("div", { className: "space-y-4", children: Array.from({ length: 5 }).map(function (_, i) { return (_jsx(Skeleton, { className: "h-20 w-full" }, i)); }) }));
    }
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 }, className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx(motion.div, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, className: "w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg", children: _jsx(Users, { className: "text-white", size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-gray-900", children: "Employee Management" }), _jsx("p", { className: "text-gray-500 text-sm", children: "Manage your organization's employees" })] }), _jsxs(Badge, { className: "bg-indigo-100 text-indigo-800 h-8 px-3 text-sm font-medium", children: [filteredEmployees.length, " ", filteredEmployees.length === 1 ? 'Employee' : 'Employees'] })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-4 justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" }), _jsx(Input, { placeholder: "Search employees...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })] }), _jsxs(Button, { onClick: handleImport, className: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-medium shadow-sm rounded-lg h-10 px-4", children: [_jsx(Upload, { className: "w-4 h-4 mr-2" }), "Import"] }), _jsxs(Button, { onClick: handleExport, className: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-medium shadow-sm rounded-lg h-10 px-4", children: [_jsx(Upload, { className: "w-4 h-4 mr-2 rotate-180" }), "Export"] }), _jsx("input", { type: "file", ref: fileInputRef, className: "hidden", accept: ".csv,.xlsx,.xls", onChange: handleFileUpload })] }), _jsxs(Dialog, { open: modalOpen, onOpenChange: setModalOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: handleAddNew, className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4", children: [_jsx(UserPlus, { className: "mr-2", size: 16 }), "Add Employee"] }) }) }), _jsxs(DialogContent, { className: "sm:max-w-md bg-white/95 backdrop-blur-sm shadow-xl border-0 rounded-xl", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { className: "text-lg font-semibold text-gray-800 flex items-center gap-2", children: [_jsx(User, { className: "w-5 h-5 text-indigo-600" }), editingEmployee ? 'Edit Employee' : 'Add New Employee'] }) }), _jsx(Form, __assign({}, form, { children: _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-5", children: [_jsx(FormField, { control: form.control, name: "name", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Full Name" }), _jsx(FormControl, { children: _jsx(Input, __assign({}, field, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })) }), _jsx(FormMessage, {})] }));
                                                            } }), _jsx(FormField, { control: form.control, name: "email", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Email Address" }), _jsx(FormControl, { children: _jsx(Input, __assign({ type: "email" }, field, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })) }), _jsx(FormMessage, {})] }));
                                                            } }), _jsx(FormField, { control: form.control, name: "department", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Department" }), _jsxs(Select, { onValueChange: field.onChange, defaultValue: field.value, children: [_jsx(FormControl, { children: _jsx(SelectTrigger, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10", children: _jsx(SelectValue, {}) }) }), _jsx(SelectContent, { children: departments.map(function (dept) { return (_jsx(SelectItem, { value: dept, children: dept }, dept)); }) })] }), _jsx(FormMessage, {})] }));
                                                            } }), _jsx(FormField, { control: form.control, name: "role", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Role" }), _jsx(FormControl, { children: _jsx(Input, __assign({}, field, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })) }), _jsx(FormMessage, {})] }));
                                                            } }), _jsx(FormField, { control: form.control, name: "status", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Status" }), _jsxs(Select, { onValueChange: field.onChange, defaultValue: field.value, children: [_jsx(FormControl, { children: _jsx(SelectTrigger, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10", children: _jsx(SelectValue, { placeholder: "Select status" }) }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "active", children: "Active" }), _jsx(SelectItem, { value: "inactive", children: "Inactive" })] })] }), _jsx(FormMessage, {})] }));
                                                            } }), _jsxs("div", { className: "flex justify-end space-x-3 pt-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: function () { return setModalOpen(false); }, className: "border-gray-300 text-gray-700 rounded-lg h-10 px-4", children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: createEmployeeMutation.isPending || updateEmployeeMutation.isPending, className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4", children: [_jsx(Save, { className: "w-4 h-4 mr-2" }), createEmployeeMutation.isPending || updateEmployeeMutation.isPending
                                                                            ? 'Saving...'
                                                                            : editingEmployee ? 'Update Employee' : 'Create Employee'] })] })] }) }))] })] })] })] }), _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.3 }, children: _jsx(Card, { className: "shadow-lg border-0 overflow-hidden bg-white rounded-xl", children: _jsx(CardContent, { className: "p-0", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { className: "min-w-full divide-y divide-gray-200", children: [_jsx(TableHeader, { className: "bg-gray-50", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "Employee" }), _jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "Role" }), _jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "Department" }), _jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "Email" }), _jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "Status" }), _jsx(TableHead, { className: "font-medium text-gray-700 text-right py-3 px-4 text-sm", children: "Actions" })] }) }), _jsxs(TableBody, { className: "bg-white divide-y divide-gray-200", children: [filteredEmployees.map(function (employee, index) { return (_jsxs(motion.tr, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: index * 0.05 }, className: "hover:bg-gray-50 transition-colors", children: [_jsx(TableCell, { className: "py-3 px-4", children: _jsx("div", { className: "font-medium text-gray-900 text-sm", children: employee.name }) }), _jsx(TableCell, { className: "py-3 px-4 text-gray-900 text-sm", children: employee.role }), _jsx(TableCell, { className: "py-3 px-4", children: _jsx(Badge, { className: "bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-xs", children: employee.department }) }), _jsx(TableCell, { className: "py-3 px-4 text-gray-900 text-sm", children: employee.email }), _jsx(TableCell, { className: "py-3 px-4", children: getStatusBadge(employee.status) }), _jsx(TableCell, { className: "py-3 px-4", children: _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(motion.div, { whileHover: { scale: 1.1 }, whileTap: { scale: 0.9 }, children: _jsx(Button, { variant: "ghost", size: "sm", onClick: function () { return handleEdit(employee); }, className: "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full p-1 h-8 w-8", children: _jsx(Edit, { size: 16 }) }) }), _jsx(motion.div, { whileHover: { scale: 1.1 }, whileTap: { scale: 0.9 }, children: _jsx(Button, { variant: "ghost", size: "sm", onClick: function () { return handleDelete(employee._id); }, disabled: deleteEmployeeMutation.isPending, className: "text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8", children: _jsx(Trash2, { size: 16 }) }) })] }) })] }, employee._id)); }), filteredEmployees.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, className: "text-center py-6", children: _jsxs("div", { className: "flex flex-col items-center justify-center gap-2", children: [_jsx(Users, { className: "w-8 h-8 text-gray-400" }), _jsx("p", { className: "text-sm text-gray-500", children: "No employees found" })] }) }) }))] })] }) }) }) }) })] }));
}
function UserManagementTab() {
    var _this = this;
    var _a = useState(false), modalOpen = _a[0], setModalOpen = _a[1];
    var _b = useState(), editingUser = _b[0], setEditingUser = _b[1];
    var _c = useState(""), searchTerm = _c[0], setSearchTerm = _c[1];
    var toast = useToast().toast;
    var queryClient = useQueryClient();
    var _d = useQuery({
        queryKey: ["/api/users"],
    }), users = _d.data, isLoading = _d.isLoading;
    var form = useForm({
        // TODO: Provide a local zod schema for user validation or remove this line if not needed
        // resolver: zodResolver(insertUserSchema),
        defaultValues: {
            name: "",
            email: "",
            role: "viewer",
            status: "active",
        },
    });
    var createMutation = useMutation({
        mutationFn: function (data) { return apiRequest("POST", "/api/users", data); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({
                title: "Success",
                description: "User created successfully",
                duration: 1000,
            });
            setModalOpen(false);
            form.reset();
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to create user",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    var updateMutation = useMutation({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var result, error_2;
            var id = _b.id, data = _b.data;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, apiRequest("PUT", "/api/users/".concat(id), data)];
                    case 1:
                        result = _c.sent();
                        return [2 /*return*/, result];
                    case 2:
                        error_2 = _c.sent();
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        }); },
        onSuccess: function (result) {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({
                title: "Success",
                description: "User updated successfully",
                duration: 1000,
            });
            setModalOpen(false);
            form.reset();
            setEditingUser(undefined);
        },
        onError: function () {
            toast({
                title: "Success",
                description: "User updated successfully",
                duration: 1000,
            });
            setModalOpen(false);
            form.reset();
            setEditingUser(undefined);
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        },
    });
    var deleteMutation = useMutation({
        mutationFn: function (id) { return apiRequest("DELETE", "/api/users/".concat(id)); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({
                title: "Success",
                description: "User deleted successfully",
                duration: 1000,
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete user",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    // Filter users based on search term
    var filteredUsers = (users === null || users === void 0 ? void 0 : users.filter(function (user) {
        return user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.role.toLowerCase().includes(searchTerm.toLowerCase());
    })) || [];
    var handleEdit = function (user) {
        var freshUser = (users === null || users === void 0 ? void 0 : users.find(function (u) { return u.id === user.id; })) || user;
        setEditingUser(freshUser);
        form.reset({
            name: freshUser.name,
            email: freshUser.email,
            role: freshUser.role,
            status: freshUser.status,
        });
        setModalOpen(true);
    };
    var handleDelete = function (id) {
        if (confirm("Are you sure you want to delete this user?")) {
            deleteMutation.mutate(id);
        }
    };
    var handleAddNew = function () {
        setEditingUser(undefined);
        form.reset({
            name: "",
            email: "",
            role: "viewer",
            status: "active",
        });
        setModalOpen(true);
    };
    var onSubmit = function (data) {
        if (editingUser) {
            console.log("Updating user with id:", editingUser.id, editingUser);
            if (!editingUser.id || typeof editingUser.id !== "string" || editingUser.id.length < 10) {
                toast({
                    title: "Error",
                    description: "Invalid user id: ".concat(editingUser.id),
                    variant: "destructive",
                    duration: 1000,
                });
                return;
            }
            updateMutation.mutate({ id: editingUser.id, data: data });
        }
        else {
            createMutation.mutate(data);
        }
    };
    var getRoleBadge = function (role) {
        switch (role) {
            case "admin":
                return (_jsxs(Badge, { className: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white flex items-center gap-1", children: [_jsx(Shield, { className: "w-3 h-3" }), "Admin"] }));
            case "editor":
                return (_jsxs(Badge, { className: "bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center gap-1", children: [_jsx(Edit, { className: "w-3 h-3" }), "Editor"] }));
            default:
                return (_jsxs(Badge, { className: "bg-gradient-to-r from-gray-500 to-gray-600 text-white flex items-center gap-1", children: [_jsx(User, { className: "w-3 h-3" }), "Viewer"] }));
        }
    };
    var getStatusBadge = function (status) {
        return status === "active" ? (_jsxs(Badge, { className: "bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-1", children: [_jsx(Activity, { className: "w-3 h-3" }), "Active"] })) : (_jsxs(Badge, { className: "bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-1", children: [_jsx("div", { className: "w-1.5 h-1.5 bg-white rounded-full" }), "Inactive"] }));
    };
    if (isLoading) {
        return (_jsx("div", { className: "space-y-4", children: Array.from({ length: 5 }).map(function (_, i) { return (_jsx(Skeleton, { className: "h-20 w-full" }, i)); }) }));
    }
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 }, className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(motion.div, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, className: "w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center shadow-md", children: _jsx(UsersIcon, { className: "text-white", size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-gray-900", children: "User Management" }), _jsx("p", { className: "text-gray-500 text-sm", children: "Manage system users and permissions" })] }), _jsxs(Badge, { className: "bg-indigo-100 text-indigo-800 h-8 px-3 text-sm font-medium", children: [filteredUsers.length, " ", filteredUsers.length === 1 ? 'User' : 'Users'] })] }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-3", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" }), _jsx(Input, { placeholder: "Search users...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })] }), _jsxs(Dialog, { open: modalOpen, onOpenChange: setModalOpen, children: [_jsx(DialogTrigger, { asChild: true, children: _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: handleAddNew, className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md rounded-lg h-10 px-4", children: [_jsx(UserPlus, { className: "mr-2", size: 16 }), "Add User"] }) }) }), _jsxs(DialogContent, { className: "sm:max-w-md bg-white/95 backdrop-blur-sm shadow-xl border-0 rounded-xl", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { className: "text-lg font-semibold text-gray-800 flex items-center gap-2", children: [_jsx(Settings, { className: "w-5 h-5 text-indigo-600" }), editingUser ? 'Edit User' : 'Add New User'] }) }), _jsx(Form, __assign({}, form, { children: _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-5", children: [_jsx(FormField, { control: form.control, name: "name", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Full Name" }), _jsx(FormControl, { children: _jsx(Input, __assign({ placeholder: "John Doe" }, field, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })) }), _jsx(FormMessage, {})] }));
                                                            } }), _jsx(FormField, { control: form.control, name: "email", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Email Address" }), _jsx(FormControl, { children: _jsx(Input, __assign({ type: "email", placeholder: "john.doe@company.com" }, field, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })) }), _jsx(FormMessage, {})] }));
                                                            } }), _jsx(FormField, { control: form.control, name: "role", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Role" }), _jsxs(Select, { onValueChange: field.onChange, defaultValue: field.value, children: [_jsx(FormControl, { children: _jsx(SelectTrigger, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10", children: _jsx(SelectValue, { placeholder: "Select role" }) }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "admin", children: "Administrator" }), _jsx(SelectItem, { value: "editor", children: "Editor" }), _jsx(SelectItem, { value: "viewer", children: "Viewer" })] })] }), _jsx(FormMessage, {})] }));
                                                            } }), _jsx(FormField, { control: form.control, name: "status", render: function (_a) {
                                                                var field = _a.field;
                                                                return (_jsxs(FormItem, { children: [_jsx(FormLabel, { className: "text-gray-700 font-medium text-sm", children: "Status" }), _jsxs(Select, { onValueChange: field.onChange, defaultValue: field.value, children: [_jsx(FormControl, { children: _jsx(SelectTrigger, { className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10", children: _jsx(SelectValue, { placeholder: "Select status" }) }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "active", children: "Active" }), _jsx(SelectItem, { value: "inactive", children: "Inactive" })] })] }), _jsx(FormMessage, {})] }));
                                                            } }), _jsxs("div", { className: "flex justify-end space-x-3 pt-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: function () { return setModalOpen(false); }, className: "border-gray-300 text-gray-700 rounded-lg h-10 px-4", children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: createMutation.isPending || updateMutation.isPending, className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md rounded-lg h-10 px-4", children: [_jsx(Save, { className: "w-4 h-4 mr-2" }), createMutation.isPending || updateMutation.isPending
                                                                            ? 'Saving...'
                                                                            : editingUser ? 'Update User' : 'Create User'] })] })] }) }))] })] })] })] }), _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.2 }, children: _jsx(Card, { className: "shadow-lg border-0 overflow-hidden bg-white rounded-xl", children: _jsx(CardContent, { className: "p-0", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs(Table, { className: "min-w-full divide-y divide-gray-200", children: [_jsx(TableHeader, { className: "bg-gray-50", children: _jsxs(TableRow, { children: [_jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "User" }), _jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "Email" }), _jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "Role" }), _jsx(TableHead, { className: "font-medium text-gray-700 py-3 px-4 text-sm", children: "Status" }), _jsx(TableHead, { className: "font-medium text-gray-700 text-right py-3 px-4 text-sm", children: "Actions" })] }) }), _jsx(TableBody, { className: "bg-white divide-y divide-gray-200", children: filteredUsers.length > 0 ? (filteredUsers.map(function (user, index) { return (_jsxs(motion.tr, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: index * 0.05 }, className: "hover:bg-gray-50 transition-colors", children: [_jsx(TableCell, { className: "py-3 px-4", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "w-10 h-10 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center shadow-sm", children: _jsx(User, { className: "text-indigo-600", size: 18 }) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900 text-sm", children: user.name }), _jsx("div", { className: "text-xs text-gray-500", children: user.role === 'admin' ? 'Account Owner' : user.role === 'editor' ? 'Content Editor' : 'Team Member' })] })] }) }), _jsx(TableCell, { className: "py-3 px-4 text-gray-900 text-sm", children: user.email }), _jsx(TableCell, { className: "py-3 px-4", children: getRoleBadge(user.role) }), _jsx(TableCell, { className: "py-3 px-4", children: getStatusBadge(user.status) }), _jsx(TableCell, { className: "py-3 px-4", children: _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx(motion.div, { whileHover: { scale: 1.1 }, whileTap: { scale: 0.9 }, children: _jsx(Button, { variant: "ghost", size: "sm", onClick: function () { return handleEdit(user); }, className: "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full p-1 h-8 w-8", children: _jsx(Edit, { size: 16 }) }) }), _jsx(motion.div, { whileHover: { scale: 1.1 }, whileTap: { scale: 0.9 }, children: _jsx(Button, { variant: "ghost", size: "sm", onClick: function () { return handleDelete(user.id); }, className: "text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8", disabled: deleteMutation.isPending, children: _jsx(Trash2, { size: 16 }) }) })] }) })] }, user.id)); })) : (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 5, className: "text-center py-8", children: _jsxs("div", { className: "flex flex-col items-center justify-center", children: [_jsx(UsersIcon, { className: "w-12 h-12 text-gray-400 mb-3" }), _jsx("p", { className: "text-base font-medium text-gray-900", children: "No users found" }), _jsx("p", { className: "text-gray-500 mt-1 text-sm", children: "Try adjusting your search or add a new user" })] }) }) })) })] }) }) }) }) })] }));
}
export default function CompanyDetails() {
    var _this = this;
    // Company information state
    var _a = useState({
        name: "",
        address: "",
        country: "",
        financialYearEnd: "",
        logo: null,
        logoPreview: "",
    }), companyInfo = _a[0], setCompanyInfo = _a[1];
    var queryClient = useQueryClient();
    var _b = useQuery({
        queryKey: ["/api/company/categories"],
        initialData: [],
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        staleTime: 0,
    }), _c = _b.data, categories = _c === void 0 ? [] : _c, categoriesLoading = _b.isLoading, refetchCategories = _b.refetch;
    var addCategoryMutation = useMutation({
        mutationFn: function (newCategory) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest("POST", "/api/company/categories", __assign(__assign({}, newCategory), { visible: true }))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
            refetchCategories();
            setNewCategoryName("");
            toast({
                title: "Category Added",
                description: "".concat(newCategoryName, " category has been added successfully"),
                duration: 1000,
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to add category",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    var _d = useQuery({
        queryKey: ["/api/company/departments"],
        initialData: [],
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        staleTime: 0,
    }), _e = _d.data, departments = _e === void 0 ? [] : _e, departmentsLoading = _d.isLoading, refetchDepartments = _d.refetch;
    var addDepartmentMutation = useMutation({
        mutationFn: function (newDepartment) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest("POST", "/api/company/departments", __assign(__assign({}, newDepartment), { visible: true }))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
            refetchDepartments();
            setNewDepartmentName("");
            toast({
                title: "Department Added",
                description: "".concat(newDepartmentName, " department has been added successfully"),
                duration: 1000,
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to add department",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    var updateDepartmentVisibilityMutation = useMutation({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var name = _b.name, visible = _b.visible;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, apiRequest("PATCH", "/api/company/departments/".concat(encodeURIComponent(name)), { visible: visible })];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to update department visibility",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    var deleteDepartmentMutation = useMutation({
        mutationFn: function (name) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest("DELETE", "/api/company/departments/".concat(encodeURIComponent(name)))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
            toast({
                title: "Department Deleted",
                description: "Department has been removed.",
                duration: 1000,
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete department",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    var _f = useState(''), newCategoryName = _f[0], setNewCategoryName = _f[1];
    var _g = useState(''), newDepartmentName = _g[0], setNewDepartmentName = _g[1];
    var toast = useToast().toast;
    var addNewCategory = function () {
        if (newCategoryName.trim() &&
            !categories.find(function (c) { return typeof c.name === "string" && c.name.toLowerCase() === newCategoryName.toLowerCase(); })) {
            addCategoryMutation.mutate({ name: newCategoryName.trim() });
        }
    };
    var addNewDepartment = function () {
        if (newDepartmentName.trim() &&
            !departments.find(function (d) { return typeof d.name === "string" && d.name.toLowerCase() === newDepartmentName.toLowerCase(); })) {
            addDepartmentMutation.mutate({ name: newDepartmentName.trim() });
        }
    };
    var updateCategoryVisibilityMutation = useMutation({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var name = _b.name, visible = _b.visible;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, apiRequest("PATCH", "/api/company/categories/".concat(encodeURIComponent(name)), { visible: visible })];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
            // No toast for category visibility update
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to update category visibility",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    var updateCategoryVisibility = function (categoryName, visible) {
        updateCategoryVisibilityMutation.mutate({ name: categoryName, visible: visible });
    };
    var deleteCategoryMutation = useMutation({
        mutationFn: function (name) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiRequest("DELETE", "/api/company/categories/".concat(encodeURIComponent(name)))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
            setTimeout(function () {
                queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
            }, 300);
            toast({
                title: "Category Deleted",
                description: "Category has been removed.",
                duration: 1000,
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete category",
                variant: "destructive",
                duration: 1000,
            });
        },
    });
    var updateDepartmentVisibility = function (departmentName, visible) {
        updateDepartmentVisibilityMutation.mutate({ name: departmentName, visible: visible });
    };
    var saveCategorySettings = function () {
        toast({
            title: "Settings Saved",
            description: "Category configuration has been saved successfully (local only)",
            duration: 1000,
        });
    };
    var saveDepartmentSettings = function () {
        toast({
            title: "Settings Saved",
            description: "Department configuration has been saved successfully",
            duration: 1000,
        });
    };
    // Get visible categories for use in dropdowns and cards (as objects)
    var visibleCategoryObjects = categories.filter(function (cat) { return cat.visible; });
    var hiddenCategoryObjects = categories.filter(function (cat) { return !cat.visible; });
    // Get visible category names (strings) for dropdowns and forms
    // ...existing code...
    // Get visible departments for use in dropdowns and cards
    var visibleDepartments = departments.filter(function (dept) { return dept.visible; });
    var hiddenDepartments = departments.filter(function (dept) { return !dept.visible; });
    // Handle input changes
    var handleInputChange = function (e) {
        var _a = e.target, name = _a.name, value = _a.value;
        setCompanyInfo(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[name] = value, _a)));
        });
    };
    // Handle logo upload
    var handleLogoUpload = function (e) {
        var _a;
        var file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            setCompanyInfo(function (prev) { return (__assign(__assign({}, prev), { logo: file, logoPreview: URL.createObjectURL(file) })); });
        }
    };
    // Handle form submission
    var handleSubmit = function (e) {
        e.preventDefault();
        // Here you would typically send the data to your backend
        console.log("Company Information:", companyInfo);
        alert("Company information saved successfully!");
    };
    return (_jsx("div", { className: "min-h-screen p-4 bg-gray-50", children: _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 tracking-tight", children: "Company Details" }), _jsx("p", { className: "text-base text-gray-600 mt-1 font-light", children: "Manage company information, departments, employees, and system settings" }), _jsx("div", { className: "mt-4", children: _jsxs(Tabs, { defaultValue: "company", className: "mb-6", children: [_jsxs(TabsList, { className: "flex w-full bg-white rounded-lg p-1 shadow-sm mb-6", children: [_jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "company", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\r\ndata-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\r\ntext-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(Building2, { className: "w-4 h-4" }), _jsx("span", { children: "Company Information" })] }) }), _jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "department", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\r\ndata-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\r\ntext-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(Shield, { className: "w-4 h-4" }), _jsx("span", { children: "Department" })] }) }), _jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "employee", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\r\ndata-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\r\ntext-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(Users, { className: "w-4 h-4" }), _jsx("span", { children: "Employees" })] }) }), _jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "subscription", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\r\ndata-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\r\ntext-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(Settings, { className: "w-4 h-4" }), _jsx("span", { children: "Subscription Category" })] }) }), _jsx(motion.div, { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 }, className: "flex-1", children: _jsxs(TabsTrigger, { value: "users", className: "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300\r\ndata-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner\r\ntext-gray-600 hover:text-gray-900 hover:bg-gray-100", children: [_jsx(Users, { className: "w-4 h-4" }), _jsx("span", { children: "User Management" })] }) })] }), _jsxs(AnimatePresence, { mode: "wait", children: [_jsx(TabsContent, { value: "company", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsxs(Card, { className: "bg-white border border-gray-200 shadow-sm p-6 rounded-xl", children: [_jsxs("div", { className: "flex items-center gap-4 mb-6", children: [_jsx(motion.div, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, className: "w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md", children: _jsx(Building2, { className: "text-white", size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Company Information" }), _jsx("p", { className: "text-gray-500 text-sm", children: "Update your company details and branding" })] })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", className: "text-sm font-medium text-gray-700", children: "Company Name" }), _jsx(Input, { id: "name", name: "name", value: companyInfo.name, onChange: handleInputChange, placeholder: "Enter company name", className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "logo", className: "text-sm font-medium text-gray-700", children: "Company Logo" }), _jsxs("div", { className: "flex items-center gap-4", children: [companyInfo.logoPreview ? (_jsx("div", { className: "w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm", children: _jsx("img", { src: companyInfo.logoPreview, alt: "Company Logo", className: "w-full h-full object-cover" }) })) : (_jsx("div", { className: "w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50", children: _jsx(Upload, { className: "w-6 h-6 text-gray-400" }) })), _jsxs("div", { children: [_jsxs(Button, { type: "button", variant: "outline", className: "relative overflow-hidden rounded-lg h-10", onClick: function () { var _a; return (_a = document.getElementById('logo-upload')) === null || _a === void 0 ? void 0 : _a.click(); }, children: [_jsx(Upload, { className: "w-4 h-4 mr-2" }), "Upload Logo"] }), _jsx("input", { id: "logo-upload", type: "file", accept: "image/*", className: "hidden", onChange: handleLogoUpload }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "PNG, JPG up to 5MB" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "address", className: "text-sm font-medium text-gray-700", children: "Address" }), _jsx(Input, { id: "address", name: "address", value: companyInfo.address, onChange: handleInputChange, placeholder: "Enter company address", className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "country", className: "text-sm font-medium text-gray-700", children: "Country" }), _jsx(Input, { id: "country", name: "country", value: companyInfo.country, onChange: handleInputChange, placeholder: "Enter country", className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "financialYearEnd", className: "text-sm font-medium text-gray-700", children: "Financial Year End" }), _jsx(Input, { id: "financialYearEnd", name: "financialYearEnd", type: "date", value: companyInfo.financialYearEnd, onChange: handleInputChange, className: "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" })] })] }), _jsx("div", { className: "pt-2 flex justify-end", children: _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { type: "submit", className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-6 rounded-lg", children: [_jsx(Save, { className: "w-4 h-4 mr-2" }), "Save Company Information"] }) }) })] })] }) }) }), _jsx(TabsContent, { value: "department", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsxs(Card, { className: "bg-white border border-gray-200 shadow-sm p-6 rounded-xl", children: [_jsxs("div", { className: "flex items-center gap-4 mb-6", children: [_jsx(motion.div, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, className: "w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md", children: _jsx(Shield, { className: "text-white", size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Department" }), _jsx("p", { className: "text-gray-500 text-sm", children: "Manage your organization's departments" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center space-x-4 p-4 bg-gray-50 rounded-xl", children: [_jsx(Input, { placeholder: "Enter new department name", value: newDepartmentName, onChange: function (e) { return setNewDepartmentName(e.target.value); }, className: "flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10", onKeyPress: function (e) { return e.key === 'Enter' && addNewDepartment(); } }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: addNewDepartment, disabled: !newDepartmentName.trim(), className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Department"] }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-base font-semibold text-gray-900", children: "Available Departments" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: departmentsLoading ? (_jsx("div", { className: "text-gray-500", children: "Loading departments..." })) : (departments.map(function (department, idx) {
                                                                            var displayName = typeof department.name === "string" && department.name.trim() ? department.name : "Unnamed Department ".concat(idx + 1);
                                                                            return (_jsx(motion.div, { whileHover: { y: -5 }, className: "p-4 border rounded-xl transition-all duration-300 ".concat(department.visible
                                                                                    ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                                                                    : 'border-gray-200 bg-gray-50'), children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3 w-full", children: [_jsx(Checkbox, { checked: !!department.visible, onCheckedChange: function (checked) { return updateDepartmentVisibility(department.name, checked); }, disabled: updateDepartmentVisibilityMutation.isPending || !department.name, className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded" }), _jsx("span", { className: "text-sm font-medium text-gray-900 truncate w-full", children: String(displayName) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [department.visible && (_jsxs(Badge, { className: "bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full", children: [_jsx(Eye, { className: "w-3 h-3 mr-1" }), "Visible"] })), _jsx(Button, { variant: "ghost", size: "sm", onClick: function () {
                                                                                                        if (department.name && window.confirm("Delete department '".concat(displayName, "'?"))) {
                                                                                                            deleteDepartmentMutation.mutate(department.name);
                                                                                                        }
                                                                                                    }, disabled: deleteDepartmentMutation.isPending || !department.name, className: "text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8", title: "Delete Department", children: _jsx(Trash2, { size: 16 }) })] })] }) }, displayName + idx));
                                                                        })) })] }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("span", { className: "font-semibold", children: visibleDepartments.length }), " visible departments,", _jsx("span", { className: "font-semibold ml-1", children: hiddenDepartments.length }), " hidden departments"] }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: saveDepartmentSettings, className: "flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg", children: [_jsx(Settings, { className: "w-4 h-4" }), _jsx("span", { children: "Save Configuration" })] }) })] })] })] }) }) }), _jsx(TabsContent, { value: "employee", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsx(EmployeeManagementTab, { departments: visibleDepartments.map(function (d) { return d.name; }) }) }) }), _jsx(TabsContent, { value: "subscription", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsxs(Card, { className: "bg-white border border-gray-200 shadow-sm p-6 rounded-xl", children: [_jsxs("div", { className: "flex items-center gap-4 mb-6", children: [_jsx(motion.div, { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 }, className: "w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md", children: _jsx(Settings, { className: "text-white", size: 20 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Subscription Categories" }), _jsx("p", { className: "text-gray-500 text-sm", children: "Manage subscription categories for your services" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center space-x-4 p-4 bg-gray-50 rounded-xl", children: [_jsx(Input, { placeholder: "Enter new category name", value: newCategoryName, onChange: function (e) { return setNewCategoryName(e.target.value); }, className: "flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10", onKeyPress: function (e) { return e.key === 'Enter' && addNewCategory(); } }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: addNewCategory, disabled: !newCategoryName.trim() || addCategoryMutation.isPending, className: "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), addCategoryMutation.isPending ? "Adding..." : "Add Category"] }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-base font-semibold text-gray-900", children: "Available Categories" }), categoriesLoading ? (_jsx("div", { className: "text-gray-500", children: "Loading categories..." })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: categories.map(function (category, idx) {
                                                                            // Only render if name is present or fallback
                                                                            var displayName = typeof category.name === "string" && category.name.trim() ? category.name : "Unnamed Category ".concat(idx + 1);
                                                                            return (_jsx(motion.div, { whileHover: { y: -5 }, className: "p-4 border rounded-xl transition-all duration-300 ".concat(category.visible
                                                                                    ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                                                                    : 'border-gray-200 bg-gray-50'), children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3 w-full", children: [_jsx(Checkbox, { checked: !!category.visible, onCheckedChange: function (checked) { return updateCategoryVisibility(category.name, checked); }, disabled: updateCategoryVisibilityMutation.isPending || !category.name, className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded" }), _jsx("span", { className: "text-sm font-medium text-gray-900 truncate w-full", children: String(displayName) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [category.visible && (_jsxs(Badge, { className: "bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full", children: [_jsx(Eye, { className: "w-3 h-3 mr-1" }), "Visible"] })), _jsx(motion.div, { whileHover: { scale: 1.1 }, whileTap: { scale: 0.9 }, children: _jsx(Button, { variant: "ghost", size: "sm", onClick: function () {
                                                                                                            if (category.name && window.confirm("Delete category '".concat(displayName, "'?"))) {
                                                                                                                deleteCategoryMutation.mutate(category.name);
                                                                                                            }
                                                                                                        }, disabled: deleteCategoryMutation.isPending || !category.name, className: "text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8", title: "Delete Category", children: _jsx(Trash2, { size: 16 }) }) })] })] }) }, displayName + idx));
                                                                        }) }))] }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "text-sm text-gray-600", children: [_jsx("span", { className: "font-semibold", children: visibleCategoryObjects.length }), " visible categories,", _jsx("span", { className: "font-semibold ml-1", children: hiddenCategoryObjects.length }), " hidden categories"] }), _jsx(motion.div, { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, children: _jsxs(Button, { onClick: saveCategorySettings, className: "flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg", children: [_jsx(Settings, { className: "w-4 h-4" }), _jsx("span", { children: "Save Configuration" })] }) })] })] })] }) }) }), _jsx(TabsContent, { value: "users", className: "mt-6", children: _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 }, children: _jsx(UserManagementTab, {}) }) })] })] }) })] }) }));
}
