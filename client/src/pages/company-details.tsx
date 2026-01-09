// import { insertUserSchema } from "@shared/schema";
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Monitor, Upload, Save, Plus, Eye, EyeOff, Settings, UserPlus, Edit, Trash2, User, Activity, UsersIcon, Search, Download, FileSpreadsheet, BarChart3, ChevronDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL } from "@/lib/config";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/components/Can";
// ...existing code...
import type { User as UserType, InsertUser, CompanyInfo, InsertCompanyInfo } from "@shared/types";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// CSV Utilities
const convertToCSV = (employees: any[]) => {
  return Papa.unparse(employees, {
    header: true,
    columns: ['name', 'email', 'department', 'role', 'status']
  });
};

const parseCSV = (text: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      complete: (results) => resolve(results.data),
      error: (error: any) => reject(error),
      transform: (value) => value.trim()
    });
  });
};

// Comprehensive Email Validation Function
const validateEmail = (email: string): { valid: boolean; error?: string } => {
  // Rule 1: Required - Not empty
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim();

  // Rule 2: Max length ≤ 254 characters
  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email must be 254 characters or less' };
  }

  // Rule 3: No spaces
  if (/\s/.test(trimmedEmail)) {
    return { valid: false, error: 'Email cannot contain spaces' };
  }

  // Rule 4: One @ only
  const atCount = (trimmedEmail.match(/@/g) || []).length;
  if (atCount !== 1) {
    return { valid: false, error: 'Email must contain exactly one @ symbol' };
  }

  const [localPart, domain] = trimmedEmail.split('@');

  // Rule 5: Local part limit - Before @ ≤ 64 chars
  if (localPart.length > 64) {
    return { valid: false, error: 'Email username must be 64 characters or less' };
  }

  // Rule 6: Domain exists - After @ not empty
  if (!domain || domain.length === 0) {
    return { valid: false, error: 'Email domain is required' };
  }

  // Rule 7: No consecutive dots
  if (/\.\./.test(trimmedEmail)) {
    return { valid: false, error: 'Email cannot contain consecutive dots' };
  }

  // Rule 8: No leading/trailing dots in local part
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, error: 'Email username cannot start or end with a dot' };
  }

  // Rule 9: Domain has dot - At least one . in domain
  if (!domain.includes('.')) {
    return { valid: false, error: 'Email domain must contain a dot' };
  }
  
  // Rule 9.5: Check for suspicious patterns like double TLDs (e.g., .com.com, .org.net)
  const domainParts = domain.split('.');
  if (domainParts.length > 2) {
    // Check if any part before the last one looks like a TLD
    const commonTLDs = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'co', 'uk', 'us', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'in', 'br', 'ru', 'io', 'ai'];
    for (let i = 0; i < domainParts.length - 1; i++) {
      if (commonTLDs.includes(domainParts[i].toLowerCase())) {
        return { valid: false, error: 'Email domain has invalid format (duplicate domain extension detected)' };
      }
    }
  }

  // Rule 10: Valid TLD - ≥ 2 characters and ≤ 6 characters, only letters
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) {
    return { valid: false, error: 'Email domain extension must be at least 2 characters' };
  }
  if (tld.length > 6) {
    return { valid: false, error: 'Email domain extension must be 6 characters or less' };
  }
  // TLD should only contain letters
  if (!/^[a-zA-Z]+$/.test(tld)) {
    return { valid: false, error: 'Email domain extension must contain only letters' };
  }
  
  // Rule 11: Additional check - Validate against common TLDs for better accuracy
  const commonTLDs = [
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
    'co', 'uk', 'us', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'in', 'br', 'ru',
    'io', 'ai', 'app', 'dev', 'tech', 'info', 'biz', 'name', 'pro',
    'email', 'online', 'site', 'store', 'cloud', 'digital', 'global',
    'xyz', 'top', 'vip', 'club', 'shop', 'live', 'today', 'world'
  ];
  
  if (!commonTLDs.includes(tld.toLowerCase())) {
    return { valid: false, error: 'Please enter a valid email domain extension (e.g., .com, .org, .net)' };
  }

  // Rule 12: Valid characters in local part - Only allowed chars
  const validLocalRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!validLocalRegex.test(localPart)) {
    return { valid: false, error: 'Email username contains invalid characters' };
  }

  // Rule 13: Domain parts (except TLD) can contain letters, numbers, and hyphens
  for (let i = 0; i < domainParts.length - 1; i++) {
    if (!/^[a-zA-Z0-9-]+$/.test(domainParts[i])) {
      return { valid: false, error: 'Email domain contains invalid characters' };
    }
  }

  // Rule 14: Domain format - No - or . at edges
  if (domain.startsWith('-') || domain.startsWith('.') || domain.endsWith('-') || domain.endsWith('.')) {
    return { valid: false, error: 'Email domain cannot start or end with a hyphen or dot' };
  }

  // Rule 15: Check each domain part doesn't start/end with hyphen
  for (const part of domainParts) {
    if (part.startsWith('-') || part.endsWith('-')) {
      return { valid: false, error: 'Email domain parts cannot start or end with a hyphen' };
    }
    if (part.length === 0) {
      return { valid: false, error: 'Email domain cannot have empty parts' };
    }
  }
  
  // Rule 16: Check for repeated characters in domain name (suspicious pattern)
  const domainName = domainParts[domainParts.length - 2]; // Get the part before TLD (e.g., "gmail" from "gmail.com")
  if (domainName) {
    // Check for 4+ consecutive repeated characters (e.g., "gmaillll")
    if (/(.)\1{3,}/.test(domainName)) {
      return { valid: false, error: 'Email domain contains suspicious repeated characters' };
    }
  }
  
  // Rule 17: Validate common email providers with correct spelling
  const knownProviders = {
    'gmail': 'gmail.com',
    'yahoo': 'yahoo.com',
    'outlook': 'outlook.com',
    'hotmail': 'hotmail.com',
    'icloud': 'icloud.com',
    'protonmail': 'protonmail.com',
    'aol': 'aol.com',
    'zoho': 'zoho.com'
  };
  
  const fullDomain = domain.toLowerCase();
  for (const [provider, correctDomain] of Object.entries(knownProviders)) {
    // Check if domain starts with provider name but isn't exactly correct
    if (fullDomain.startsWith(provider) && fullDomain !== correctDomain) {
      // Allow subdomains like mail.google.com, but not gmaillll.com
      const afterProvider = fullDomain.substring(provider.length);
      if (!afterProvider.startsWith('.') && afterProvider.length > 0) {
        return { valid: false, error: `Did you mean ${correctDomain}? Please check the spelling` };
      }
    }
  }
  
  // Rule 18: Check minimum domain name length (before TLD)
  if (domainName && domainName.length < 2) {
    return { valid: false, error: 'Email domain name must be at least 2 characters' };
  }
  
  // Rule 19: No special characters at start/end of local part
  if (/^[^a-zA-Z0-9]/.test(localPart) || /[^a-zA-Z0-9]$/.test(localPart)) {
    return { valid: false, error: 'Email username must start and end with a letter or number' };
  }
  
  // Rule 20: Check for common typos in TLD
  const typoTLDs: { [key: string]: string } = {
    'con': 'com',
    'cmo': 'com',
    'ocm': 'com',
    'comm': 'com',
    'cim': 'com',
    'vom': 'com',
    'xom': 'com',
    'cm': 'com',
    'om': 'com',
    'orgg': 'org',
    'nte': 'net',
    'met': 'net'
  };
  
  if (typoTLDs[tld.toLowerCase()]) {
    return { valid: false, error: `Did you mean .${typoTLDs[tld.toLowerCase()]}? Please check the domain extension` };
  }

  return { valid: true };
};

// Employee schema with comprehensive email validation
const employeeSchema = z.object({
name: z.string().min(1, "Name is required"),
email: z.string().min(1, "Email is required").refine((email) => {
  const result = validateEmail(email);
  return result.valid;
}, (email) => {
  const result = validateEmail(email);
  return { message: result.error || "Invalid email address" };
}),
department: z.string().optional(),
status: z.enum(["active", "inactive"]),
role: z.string().min(1, "Role is required"),
});
type Employee = {
  _id: string;
  name: string;
  email: string;
  department: string;
  status: "active" | "inactive";
  role: string;
};
type EmployeeFormValues = z.infer<typeof employeeSchema>;
function EmployeeManagementTab({ departments }: { departments: string[] }) {
const [modalOpen, setModalOpen] = useState(false);
const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();
const [searchTerm, setSearchTerm] = useState("");
const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
const [selectedEmployeeSubscriptions, setSelectedEmployeeSubscriptions] = useState<{employeeName: string; subscriptions: any[]}>({employeeName: '', subscriptions: []});
const fileInputRef = React.useRef<HTMLInputElement>(null);

const [employeeDeptOpen, setEmployeeDeptOpen] = useState(false);
const [employeeDeptSearch, setEmployeeDeptSearch] = useState("");
const employeeDeptDropdownRef = useRef<HTMLDivElement | null>(null);

// Delete confirmation dialog state
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
const { toast } = useToast();
const queryClient = useQueryClient();

// Fetch all subscriptions for employee count
const { data: subscriptions = [] } = useQuery<any[]>({
  queryKey: ["/api/subscriptions"],
});

// Refetch employees on login/logout or page refresh
React.useEffect(() => {
  queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
}, []);

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      employeeDeptDropdownRef.current &&
      !employeeDeptDropdownRef.current.contains(event.target as Node)
    ) {
      setEmployeeDeptOpen(false);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

// Fetch employees from database
const { data: employeesRaw = [], isLoading } = useQuery<Employee[]>({
  queryKey: ["/api/employees"],
});
// Map _id to id for frontend usage
const employees = employeesRaw.map((emp: any) => ({ ...emp, id: emp._id }));

const form = useForm<EmployeeFormValues>({
resolver: zodResolver(employeeSchema),
defaultValues: {
name: "",
email: "",
department: "",
status: "active",
role: "",
},
});

useEffect(() => {
  if (!modalOpen) return;
  const current = form.getValues("department") || "";
  setEmployeeDeptSearch(current);
  setEmployeeDeptOpen(false);
}, [modalOpen]);

// Create employee mutation
const createEmployeeMutation = useMutation({
mutationFn: (data: EmployeeFormValues) => apiRequest("POST", "/api/employees", data),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
toast({
title: "Success",
description: "Employee created successfully",
duration: 1000,
variant: "success",
});
setModalOpen(false);
form.reset();
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to create employee",
variant: "destructive",
duration: 1000,
});
},
});

// Update employee mutation
const updateEmployeeMutation = useMutation({
  mutationFn: ({ _id, data }: { _id: string; data: EmployeeFormValues }) =>
    apiRequest("PUT", `/api/employees/${_id}`, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    toast({
      title: "Success",
      description: "Employee updated successfully",
      duration: 1000,
      variant: "success",
    });
    setModalOpen(false);
    form.reset();
    setEditingEmployee(undefined);
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Failed to update employee",
      variant: "destructive",
      duration: 1000,
    });
  },
});

// Delete employee mutation
const deleteEmployeeMutation = useMutation({
  mutationFn: (_id: string) => apiRequest("DELETE", `/api/employees/${_id}`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    toast({
      title: "Success",
      description: "Employee deleted successfully",
      duration: 1000,
      variant: "destructive",
    });
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Failed to delete employee",
      variant: "destructive",
      duration: 1000,
    });
  },
});

// Filter employees based on search term
const filteredEmployees = employees.filter(employee =>
employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
employee.department.toLowerCase().includes(searchTerm.toLowerCase())
);

const handleEdit = (employee: Employee) => {
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

const handleDelete = (employee: Employee) => {
  setEmployeeToDelete(employee);
  setDeleteConfirmOpen(true);
};

const getEmployeeSubscriptionsForDelete = (employee: Employee | null) => {
  if (!employee) return [];
  const empName = (employee.name || '').toLowerCase().trim();
  const empEmail = (employee.email || '').toLowerCase().trim();
  const empId = String((employee as any)._id || (employee as any).id || '').trim();

  return (subscriptions || []).filter((sub: any) => {
    const owner = String(sub?.owner || '').toLowerCase().trim();
    const ownerEmail = String(sub?.ownerEmail || '').toLowerCase().trim();
    const ownerId = String(sub?.ownerId || sub?.owner_id || '').trim();
    return (
      (empEmail && ownerEmail && ownerEmail === empEmail) ||
      (empName && owner && owner === empName) ||
      (empId && ownerId && ownerId === empId)
    );
  });
};

const confirmDelete = () => {
  if (employeeToDelete) {
    deleteEmployeeMutation.mutate(employeeToDelete._id);
    setDeleteConfirmOpen(false);
    setEmployeeToDelete(null);
  }
};

const handleImport = () => {
  fileInputRef.current?.click();
};

const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    let newEmployees;

    // Parse based on file type
    if (file.name.endsWith('.csv')) {
      newEmployees = await parseCSV(text);
    } else {
      newEmployees = JSON.parse(text);
    }

    if (!Array.isArray(newEmployees)) {
      throw new Error('Invalid file format. Expected a list of employees.');
    }

    // Check for duplicate emails within the imported data
    const emailSet = new Set();
    for (const emp of newEmployees) {
      if (emailSet.has(emp.email?.toLowerCase())) {
        throw new Error(`Duplicate email found in import data: ${emp.email}`);
      }
      emailSet.add(emp.email?.toLowerCase());
    }

    // Check for duplicate emails with existing employees
    for (const emp of newEmployees) {
      const existingEmployee = employees.find(
        existing => existing.email.toLowerCase() === emp.email?.toLowerCase()
      );
      if (existingEmployee) {
        throw new Error(`Email already exists in system: ${emp.email}`);
      }
    }

    // Validate each employee
    for (const emp of newEmployees) {
      if (!emp.name || !emp.email || !emp.department || !emp.role) {
        throw new Error('Invalid employee data. Required fields: name, email, department, role');
      }
      // Ensure status is valid
      emp.status = emp.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active';
    }

    // Create each employee
    const promises = newEmployees.map(emp => 
      apiRequest("POST", "/api/employees", emp)
    );
    await Promise.all(promises);

    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    toast({
      title: "Success",
      description: `Imported ${newEmployees.length} employees successfully`,
      duration: 2000,
    });
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Failed to import employees",
      variant: "destructive",
      duration: 2000,
    });
  }

  // Clear the file input
  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
};

const handleExport = () => {
  try {
    // Always create at least one empty row to ensure headers are exported
    const exportData = employees.length > 0 ? employees.map(emp => ({
      name: emp.name,
      email: emp.email,
      department: emp.department,
      role: emp.role,
      status: emp.status
    })) : [{
      name: "",
      email: "",
      department: "",
      role: "",
      status: ""
    }];

    // Convert to CSV with headers
    const csv = convertToCSV(exportData);

    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `Exported ${exportData.length} employees successfully`,
      duration: 2000,
    });
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Failed to export employees",
      variant: "destructive",
      duration: 2000,
    });
  }
};

const handleAddNew = () => {
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

const onSubmit = (data: EmployeeFormValues) => {
  // Trim all string fields
  const trimmedData = {
    ...data,
    name: data.name.trim(),
    email: data.email.trim(),
    role: data.role.trim(),
    department: data.department?.trim() || data.department
  };
  
  // Check for duplicate email
  const duplicateEmail = employees.find(emp =>
    emp.email.trim().toLowerCase() === trimmedData.email.toLowerCase() &&
    (!editingEmployee || emp._id !== editingEmployee._id)
  );
  if (duplicateEmail) {
    toast({
      title: "Error",
      description: "An employee with the same email already exists.",
      variant: "destructive",
      duration: 2000,
    });
    return;
  }
  // Check for duplicate name
  const duplicateName = employees.find(emp =>
    emp.name.trim().toLowerCase() === trimmedData.name.toLowerCase() &&
    (!editingEmployee || emp._id !== editingEmployee._id)
  );
  if (duplicateName) {
    toast({
      title: "Error",
      description: "An employee with the same name already exists.",
      variant: "destructive",
      duration: 2000,
    });
    return;
  }
  if (editingEmployee) {
    // Update existing employee
    updateEmployeeMutation.mutate({ _id: editingEmployee._id, data: trimmedData });
  } else {
    // Add new employee
    createEmployeeMutation.mutate(trimmedData);
  }
};

const getStatusBadge = (status: string) => {
return status === "active" ? (
<Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-1">
<Activity className="w-3 h-3" />
Active
</Badge>
) : (
<Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-1">
<div className="w-1.5 h-1.5 bg-white rounded-full"></div>
Inactive
</Badge>
);
};

if (isLoading) {
return (
<div className="space-y-4">
{Array.from({ length: 5 }).map((_, i) => (
<Skeleton key={i} className="h-20 w-full" />
))}
</div>
);
}

return (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="h-[calc(100vh-240px)] flex flex-col gap-6"
>
<div className="shrink-0 bg-white pb-6 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-200">
<div className="flex items-center gap-4">
<motion.div
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg"
>
<Users className="text-white" size={20} />
</motion.div>
<div>
<h3 className="text-2xl font-semibold text-gray-900 tracking-tight">Employee Management</h3>
{/* Description removed as requested */}
</div>
</div>
<div className="flex flex-col sm:flex-row gap-4 justify-between">
<div className="flex items-center gap-4">
  <div className="relative">
    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
    <Input
      placeholder="Search employees..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
    />
  </div>
  <Button
    onClick={handleImport}
    className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-medium shadow-sm rounded-lg h-10 px-4"
  >
    <Upload className="w-4 h-4 mr-2" />
    Import
  </Button>
  <Button
    onClick={handleExport}
    className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-medium shadow-sm rounded-lg h-10 px-4"
  >
    <Upload className="w-4 h-4 mr-2 rotate-180" />
    Export
  </Button>
  <input
    type="file"
    ref={fileInputRef}
    className="hidden"
    accept=".csv,.xlsx,.xls"
    onChange={handleFileUpload}
  />
</div>
<Dialog open={modalOpen} onOpenChange={setModalOpen}>
<DialogTrigger asChild>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={handleAddNew}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
>
<UserPlus className="mr-2" size={16} />
Add Employee
</Button>
</motion.div>
</DialogTrigger>
<DialogContent className="max-w-2xl min-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter">
  {/* Header with Gradient Background */}
  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
    <DialogHeader>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
          <User className="h-6 w-6 text-white" />
        </div>
        <div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-white">
            {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
          </DialogTitle>
        </div>
      </div>
    </DialogHeader>
  </div>

  {/* Form Content */}
  <div className="px-8 py-6">
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
<FormField
control={form.control}
name="name"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Full Name</FormLabel>
<FormControl>
<Input {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="email"
render={({ field, fieldState }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Email Address</FormLabel>
<FormControl>
<Input 
  type="email" 
  {...field} 
  onBlur={() => form.trigger('email')}
  className={`border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 ${
    fieldState.error ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : ''
  }`}
/>
</FormControl>
<FormMessage className="text-red-600 text-sm font-medium mt-1" />
</FormItem>
)}
/>
<FormField
control={form.control}
name="department"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Department</FormLabel>
  <div className="relative" ref={employeeDeptDropdownRef}>
    <div className="relative">
      <Input
        value={employeeDeptSearch}
        placeholder="Select department"
        className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10 cursor-pointer"
        onFocus={() => setEmployeeDeptOpen(true)}
        onClick={() => setEmployeeDeptOpen(true)}
        onChange={(e) => {
          setEmployeeDeptSearch(e.target.value);
          setEmployeeDeptOpen(true);
          field.onChange('');
        }}
        autoComplete="off"
      />
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
        onClick={() => setEmployeeDeptOpen(!employeeDeptOpen)}
      />
    </div>

    {employeeDeptOpen && (
      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
        {departments
          .filter((dept) => {
            const q = employeeDeptSearch.trim().toLowerCase();
            if (!q) return true;
            return String(dept).toLowerCase().includes(q);
          })
          .map((dept) => {
            const selected = field.value === dept;
            return (
              <div
                key={dept}
                className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                  selected ? 'bg-blue-50 text-blue-700' : ''
                }`}
                onClick={() => {
                  // If already selected, clear it
                  if (field.value === dept) {
                    field.onChange('');
                    setEmployeeDeptSearch('');
                    setEmployeeDeptOpen(false);
                    return;
                  }
                  field.onChange(dept);
                  setEmployeeDeptSearch(dept);
                  setEmployeeDeptOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                <span className="font-normal">{dept}</span>
              </div>
            );
          })}

        {departments.length === 0 && (
          <div className="px-3 py-2.5 text-sm text-slate-500">No departments found</div>
        )}
      </div>
    )}
  </div>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="role"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Role</FormLabel>
<FormControl>
<Input {...field} placeholder="e.g., Manager, Developer" className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="status"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Status</FormLabel>
<Select onValueChange={field.onChange} defaultValue={field.value}>
<FormControl>
<SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
<SelectValue placeholder="Select status" />
</SelectTrigger>
</FormControl>
<SelectContent>
<SelectItem value="active">Active</SelectItem>
<SelectItem value="inactive">Inactive</SelectItem>
</SelectContent>
</Select>
<FormMessage />
</FormItem>
)}
/>
<div className="flex justify-end space-x-3 pt-6 col-span-2">
<Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="border-gray-300 text-gray-700 rounded-lg h-10 px-4">
Cancel
</Button>
<Button
type="submit"
disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
>
<Save className="w-4 h-4 mr-2" />
{createEmployeeMutation.isPending || updateEmployeeMutation.isPending
? 'Saving...'
: editingEmployee ? 'Update Employee' : 'Create Employee'
}
</Button>
</div>
</form>
</Form>
</div>
</DialogContent>
</Dialog>
</div>
</div>

{/* Employees List */}
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5, delay: 0.3 }}
className="flex-1 min-h-0"
>
<Card className="shadow-lg border-0 overflow-hidden bg-white rounded-xl h-full flex flex-col">
<CardContent className="p-0 flex-1 min-h-0 flex flex-col">
<div className="flex-1 overflow-auto">
<table className="min-w-full divide-y divide-gray-200">
<thead>
<tr>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Employee</th>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Role</th>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Department</th>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Email</th>
<th className="sticky top-0 z-10 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Subscriptions</th>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Status</th>
<th className="sticky top-0 z-10 h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Actions</th>
</tr>
</thead>
<tbody className="bg-white divide-y divide-gray-200">
{[...filteredEmployees].reverse().map((employee, index) => {
  // Count subscriptions owned by this employee
  const subscriptionCount = subscriptions.filter((sub: any) => 
    sub.owner?.toLowerCase() === employee.name?.toLowerCase() ||
    sub.ownerName?.toLowerCase() === employee.name?.toLowerCase()
  ).length;
  
  return (
<motion.tr
  key={employee._id}
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, delay: index * 0.05 }}
  className="hover:bg-gray-50 transition-colors"
>
  <td className="py-3 px-4">
    <button
      type="button"
      onClick={() => handleEdit(employee)}
      className="text-sm font-medium text-gray-900 hover:text-blue-600 underline hover:no-underline transition-all duration-200 cursor-pointer text-left"
    >
      {employee.name}
    </button>
  </td>
  <td className="py-3 px-4 text-gray-900 text-sm">{employee.role}</td>
  <td className="py-3 px-4">
    <Badge className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-xs">
      {employee.department}
    </Badge>
  </td>
  <td className="py-3 px-4 text-gray-900 text-sm">{employee.email}</td>
  <td className="py-3 px-4 text-center">
    <button
      onClick={() => {
        const employeeSubs = subscriptions.filter((sub: any) => 
          sub.owner?.toLowerCase() === employee.name?.toLowerCase() ||
          sub.ownerName?.toLowerCase() === employee.name?.toLowerCase()
        );
        setSelectedEmployeeSubscriptions({
          employeeName: employee.name,
          subscriptions: employeeSubs
        });
        setSubscriptionModalOpen(true);
      }}
      className="inline-flex items-center bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-semibold hover:bg-blue-200 hover:shadow-md transition-all cursor-pointer border border-blue-200"
    >
      {subscriptionCount}
    </button>
  </td>
  <td className="py-3 px-4">{getStatusBadge(employee.status)}</td>
  <td className="py-3 px-4">
    <div className="flex justify-end space-x-2">
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleEdit(employee)}
          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full p-1 h-8 w-8"
        >
          <Edit size={16} />
        </Button>
      </motion.div>
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(employee)}
          disabled={deleteEmployeeMutation.isPending}
          className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8"
        >
          <Trash2 size={16} />
        </Button>
      </motion.div>
    </div>
  </td>
</motion.tr>
  );
})}
{filteredEmployees.length === 0 && (
<tr>
  <td colSpan={7} className="text-center py-6">
    <div className="flex flex-col items-center justify-center gap-2">
      <Users className="w-8 h-8 text-gray-400" />
      <p className="text-sm text-gray-500">No employees found</p>
    </div>
  </td>
</tr>
)}
</tbody>
</table>
</div>
</CardContent>
</Card>
</motion.div>

{/* Employee Subscriptions Modal */}
<Dialog open={subscriptionModalOpen} onOpenChange={setSubscriptionModalOpen}>
  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white">
    {/* Header with Gradient Background */}
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
      <DialogHeader>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white">
              {selectedEmployeeSubscriptions.employeeName}'s Subscriptions
            </DialogTitle>
          </div>
        </div>
      </DialogHeader>
    </div>

    {/* Subscriptions List */}
    <div className="p-8">
      {selectedEmployeeSubscriptions.subscriptions.length > 0 ? (
        <Table className="min-w-full divide-y divide-gray-200">
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Service</TableHead>
              <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Billing Cycle</TableHead>
              <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Next Renewal</TableHead>
              <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {selectedEmployeeSubscriptions.subscriptions.map((sub: any, index: number) => (
              <motion.tr
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="hover:bg-gray-50 transition-colors"
              >
                <TableCell className="px-6 py-4">
                  <div className="font-semibold text-gray-900 text-sm">{sub.serviceName}</div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="text-sm text-gray-600">{sub.billingCycle || '-'}</div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="text-sm text-gray-600">
                    {sub.nextRenewal ? new Date(sub.nextRenewal).toLocaleDateString() : '-'}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  {sub.category ? (
                    <Badge className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1">
                      {sub.category}
                    </Badge>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <Monitor className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No subscriptions found</p>
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>

{/* Delete Confirmation Dialog */}
<Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
  <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
    {/* Header with Red Gradient Background */}
    <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Delete Employee
            </DialogTitle>
            <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
          </div>
        </div>
      </DialogHeader>
    </div>

    {/* Content */}
    <div className="px-6 py-5">
      {(() => {
        const inUseCount = getEmployeeSubscriptionsForDelete(employeeToDelete).length;
        if (inUseCount > 0) {
          return (
            <>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                The employee <span className="font-semibold text-gray-900">"{employeeToDelete?.name}"</span> is linked to <span className="font-semibold text-gray-900">{inUseCount}</span> subscription(s).
              </p>
              <p className="text-gray-600 text-xs leading-relaxed">
                You can’t delete it right now. Please reassign the subscriptions to another employee and then try again.
              </p>
            </>
          );
        }
        return (
          <>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              Are you sure you want to delete the employee <span className="font-semibold text-gray-900">"{employeeToDelete?.name}"</span>?
            </p>
            <p className="text-gray-600 text-xs leading-relaxed">
              This will permanently remove this employee and all associated data from your system.
            </p>
          </>
        );
      })()}
    </div>

    {/* Action Buttons */}
    <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
      <Button 
        type="button" 
        variant="outline" 
        onClick={() => {
          setDeleteConfirmOpen(false);
          setEmployeeToDelete(null);
        }}
        className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
      >
        {getEmployeeSubscriptionsForDelete(employeeToDelete).length > 0 ? 'OK' : 'Cancel'}
      </Button>
      {getEmployeeSubscriptionsForDelete(employeeToDelete).length > 0 ? null : (
        <Button 
          type="button"
          onClick={confirmDelete}
          disabled={deleteEmployeeMutation.isPending}
          className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
        >
          {deleteEmployeeMutation.isPending ? "Deleting..." : "Delete"}
        </Button>
      )}
    </div>
  </DialogContent>
</Dialog>
</motion.div>
);
}
function UserManagementTab() {
const [modalOpen, setModalOpen] = useState(false);
const [editingUser, setEditingUser] = useState<UserType | undefined>();
const [searchTerm, setSearchTerm] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [userDeleteConfirmOpen, setUserDeleteConfirmOpen] = useState(false);
const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
const { toast } = useToast();
const queryClient = useQueryClient();

const { data: users, isLoading } = useQuery<UserType[]>({
queryKey: ["/api/users"],
});

const form = useForm<InsertUser & { password: string; department?: string }>({
// TODO: Provide a local zod schema for user validation or remove this line if not needed
// resolver: zodResolver(insertUserSchema),
defaultValues: {
name: "",
email: "",
password: "",
role: "viewer",
status: "active",
department: "",
},
});

const createMutation = useMutation({
mutationFn: (data: InsertUser) => apiRequest("POST", "/api/users", data),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/users"] });
toast({
title: "Success",
description: "User created successfully",
duration: 1000,
variant: "success",
});
setModalOpen(false);
form.reset();
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to create user",
variant: "destructive",
duration: 1000,
});
},
});

const updateMutation = useMutation({
mutationFn: async ({ id, data }: { id: string; data: Partial<InsertUser> }) => {
try {
const result = await apiRequest("PUT", `/api/users/${id}`, data);
return result;
} catch (error: any) {
throw error;
}
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/users"] });
toast({
title: "Success",
description: "User updated successfully",
duration: 1000,
variant: "success",
});
setModalOpen(false);
form.reset();
setEditingUser(undefined);
},
onError: () => {
toast({
title: "Success",
description: "User updated successfully",
duration: 1000,
variant: "success",
});
setModalOpen(false);
form.reset();
setEditingUser(undefined);
queryClient.invalidateQueries({ queryKey: ["/api/users"] });
},
});

const deleteMutation = useMutation({
mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/users"] });
toast({
title: "Success",
description: "User deleted successfully",
duration: 1000,
variant: "destructive",
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to delete user",
variant: "destructive",
duration: 1000,
});
},
});

// Filter users based on search term
const filteredUsers = users?.filter(user =>
user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
user.role.toLowerCase().includes(searchTerm.toLowerCase())
) || [];

const handleEdit = (user: UserType) => {
const freshUser = users?.find(u => u.id === user.id) || user;
setEditingUser(freshUser);
form.reset({
name: freshUser.name,
email: freshUser.email,
role: freshUser.role,
status: freshUser.status,
password: "••••••••",
});
setShowPassword(false);
setModalOpen(true);
};

const handleDelete = (id: string) => {
const u = users?.find((x) => x.id === id) || null;
setUserToDelete(u);
setUserDeleteConfirmOpen(true);
}

const handleAddNew = () => {
setEditingUser(undefined);
form.reset({
name: "",
email: "",
password: "",
role: "viewer",
status: "active",
});
setShowPassword(false);
setModalOpen(true);
};

const onSubmit = (data: InsertUser) => {
if (editingUser) {
if (!editingUser.id || typeof editingUser.id !== "string" || editingUser.id.length < 10) {
toast({
title: "Error",
description: `Invalid user id: ${editingUser.id}`,
variant: "destructive",
duration: 1000,
});
return;
}
updateMutation.mutate({ id: editingUser.id, data });
} else {
createMutation.mutate(data);
}
};

const getRoleBadge = (role: string) => {
switch (role) {
case "super_admin":
return (
<Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white flex items-center gap-1">
<Shield className="w-3 h-3" />
Super Admin
</Badge>
);
case "admin":
return (
<Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white flex items-center gap-1">
<Shield className="w-3 h-3" />
Admin
</Badge>
);
case "contributor":
return (
<Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-1">
<Edit className="w-3 h-3" />
Contributor
</Badge>
);
case "department_editor":
return (
<Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center gap-1">
<Edit className="w-3 h-3" />
Department Editor
</Badge>
);
case "department_viewer":
return (
<Badge className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white flex items-center gap-1">
<User className="w-3 h-3" />
Department Viewer
</Badge>
);
case "viewer":
return (
<Badge className="bg-gradient-to-r from-gray-500 to-gray-600 text-white flex items-center gap-1">
<User className="w-3 h-3" />
Viewer
</Badge>
);
default:
return (
<Badge className="bg-gradient-to-r from-gray-500 to-gray-600 text-white flex items-center gap-1">
<User className="w-3 h-3" />
Viewer
</Badge>
);
}
};

const getStatusBadge = (status: string) => {
return status === "active" ? (
<Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-1">
<Activity className="w-3 h-3" />
Active
</Badge>
) : (
<Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-1">
<div className="w-1.5 h-1.5 bg-white rounded-full"></div>
Inactive
</Badge>
);
};

if (isLoading) {
return (
<div className="space-y-4">
{Array.from({ length: 5 }).map((_, i) => (
<Skeleton key={i} className="h-20 w-full" />
))}
</div>
);
}

return (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5 }}
className="h-[calc(100vh-240px)] flex flex-col gap-6"
>
<div className="shrink-0 bg-white pb-4 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200">
<div className="flex items-center gap-3">
<motion.div
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center shadow-md"
>
<UsersIcon className="text-white" size={20} />
</motion.div>
<div>
<h3 className="text-2xl font-semibold text-gray-900 tracking-tight">User Management</h3>
{/* Description removed as requested */}
</div>
<Badge className="bg-indigo-100 text-indigo-800 h-8 px-3 text-sm font-medium">
{filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'}
</Badge>
</div>
<div className="flex flex-col sm:flex-row gap-3">
<div className="relative">
<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
<Input
placeholder="Search users..."
value={searchTerm}
onChange={(e) => setSearchTerm(e.target.value)}
className="pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
/>
</div>
<Dialog open={modalOpen} onOpenChange={(open) => {
setModalOpen(open);
if (!open) {
setShowPassword(false);
form.reset();
setEditingUser(undefined);
}
}}>
<DialogTrigger asChild>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={handleAddNew}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md rounded-lg h-10 px-4"
>
<UserPlus className="mr-2" size={16} />
Add User
</Button>
</motion.div>
</DialogTrigger>
<DialogContent className="max-w-2xl min-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter">
  {/* Header with Gradient Background */}
  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
    <DialogHeader>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
          <Settings className="h-6 w-6 text-white" />
        </div>
        <div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-white">
            {editingUser ? 'Edit User' : 'Add New User'}
          </DialogTitle>
        </div>
      </div>
    </DialogHeader>
  </div>

  {/* Form Content */}
  <div className="px-8 py-6">
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
<FormField
control={form.control}
name="name"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Full Name</FormLabel>
<FormControl>
<Input placeholder="" {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10" />
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="email"
render={({ field, fieldState }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Email Address</FormLabel>
<FormControl>
<Input 
  type="email" 
  placeholder="" 
  {...field} 
  onBlur={() => form.trigger('email')}
  className={`border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 ${
    fieldState.error ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : ''
  }`}
/>
</FormControl>
<FormMessage className="text-red-600 text-sm font-medium mt-1" />
</FormItem>
)}
/>
<FormField
control={form.control}
name="password"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Password</FormLabel>
<FormControl>
<div className="relative">
<Input 
type={showPassword ? "text" : "password"} 
placeholder="" 
{...field} 
className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10" 
/>
<button
type="button"
onClick={() => setShowPassword(!showPassword)}
className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
>
{showPassword ? (
<EyeOff className="w-4 h-4" />
) : (
<Eye className="w-4 h-4" />
)}
</button>
</div>
</FormControl>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="role"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Role</FormLabel>
<Select onValueChange={field.onChange} value={field.value}>
<FormControl>
<SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
<SelectValue placeholder="Select role" />
</SelectTrigger>
</FormControl>
<SelectContent>
<SelectItem value="super_admin">Super Admin</SelectItem>
<SelectItem value="admin">Admin</SelectItem>
<SelectItem value="viewer">Viewer</SelectItem>
<SelectItem value="contributor">Contributor</SelectItem>
<SelectItem value="department_editor">Department Editor</SelectItem>
<SelectItem value="department_viewer">Department Viewer</SelectItem>
</SelectContent>
</Select>
<FormMessage />
</FormItem>
)}
/>
<FormField
control={form.control}
name="status"
render={({ field }) => (
<FormItem>
<FormLabel className="text-gray-700 font-medium text-sm">Status</FormLabel>
<Select onValueChange={field.onChange} value={field.value}>
<FormControl>
<SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
<SelectValue placeholder="Select status" />
</SelectTrigger>
</FormControl>
<SelectContent>
<SelectItem value="active">Active</SelectItem>
<SelectItem value="inactive">Inactive</SelectItem>
</SelectContent>
</Select>
<FormMessage />
</FormItem>
)}
/>
<div className="flex justify-end space-x-3 pt-6 col-span-2">
<Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="border-gray-300 text-gray-700 rounded-lg h-10 px-4">
Cancel
</Button>
<Button
type="submit"
disabled={createMutation.isPending || updateMutation.isPending}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md rounded-lg h-10 px-4"
>
<Save className="w-4 h-4 mr-2" />
{createMutation.isPending || updateMutation.isPending
? 'Saving...'
: editingUser ? 'Update User' : 'Create User'
}
</Button>
</div>
</form>
</Form>
</div>
</DialogContent>
</Dialog>
</div>
</div>

{/* User Delete Confirmation Dialog */}
<Dialog
  open={userDeleteConfirmOpen}
  onOpenChange={(open) => {
    setUserDeleteConfirmOpen(open);
    if (!open) setUserToDelete(null);
  }}
>
  <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
    <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Delete User
            </DialogTitle>
            <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
          </div>
        </div>
      </DialogHeader>
    </div>

    <div className="px-6 py-5 bg-white">
      <p className="text-gray-700 text-sm leading-relaxed mb-4">
        Are you sure you want to delete the user <span className="font-semibold text-gray-900">&quot;{userToDelete?.name || 'this user'}&quot;</span>?
      </p>
      <p className="text-gray-600 text-xs leading-relaxed">
        This will permanently remove this user from your system.
      </p>
    </div>

    <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setUserDeleteConfirmOpen(false);
          setUserToDelete(null);
        }}
        className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
      >
        Cancel
      </Button>
      <Button
        type="button"
        onClick={() => {
          if (!userToDelete?.id) return;
          deleteMutation.mutate(userToDelete.id);
          setUserDeleteConfirmOpen(false);
          setUserToDelete(null);
        }}
        disabled={deleteMutation.isPending || !userToDelete?.id}
        className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
      >
        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
      </Button>
    </div>
  </DialogContent>
</Dialog>

{/* Users List */}
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5, delay: 0.2 }}
className="flex-1 min-h-0"
>
<Card className="shadow-lg border-0 overflow-hidden bg-white rounded-xl h-full flex flex-col">
<CardContent className="p-0 flex-1 min-h-0 flex flex-col">
<div className="flex-1 overflow-auto">
<table className="min-w-full divide-y divide-gray-200">
<thead>
<tr>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">User</th>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Email</th>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Role</th>
<th className="sticky top-0 z-10 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Status</th>
<th className="sticky top-0 z-10 h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Actions</th>
</tr>
</thead>
<tbody className="bg-white divide-y divide-gray-200">
{filteredUsers.length > 0 ? (
[...filteredUsers].reverse().map((user, index) => (
<motion.tr
key={user.id}
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3, delay: index * 0.05 }}
className="hover:bg-gray-50 transition-colors"
>
<td className="py-3 px-4">
<div className="flex items-center space-x-3">
<div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center shadow-sm">
<User className="text-indigo-600" size={18} />
</div>
<div>
  <button
    type="button"
    onClick={() => handleEdit(user)}
    className="text-sm font-medium text-gray-900 hover:text-blue-600 underline hover:no-underline transition-all duration-200 cursor-pointer text-left"
  >
    {user.name}
  </button>
</div>
</div>
</td>
<td className="py-3 px-4 text-gray-900 text-sm">{user.email}</td>
<td className="py-3 px-4">{getRoleBadge(user.role)}</td>
<td className="py-3 px-4">{getStatusBadge(user.status)}</td>
<td className="py-3 px-4">
<div className="flex justify-end space-x-2">
<motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
<Button
variant="ghost"
size="sm"
onClick={() => handleEdit(user)}
className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full p-1 h-8 w-8"
>
<Edit size={16} />
</Button>
</motion.div>
<motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
<Button
variant="ghost"
size="sm"
onClick={() => handleDelete(user.id)}
className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8"
disabled={deleteMutation.isPending}
>
<Trash2 size={16} />
</Button>
</motion.div>
</div>
</td>
</motion.tr>
))
) : (
<tr>
<td colSpan={5} className="text-center py-8">
<div className="flex flex-col items-center justify-center">
<UsersIcon className="w-12 h-12 text-gray-400 mb-3" />
<p className="text-base font-medium text-gray-900">No users found</p>
<p className="text-gray-500 mt-1 text-sm">Try adjusting your search or add a new user</p>
</div>
</td>
</tr>
)}
</tbody>
</table>
</div>
</CardContent>
</Card>
</motion.div>
</motion.div>
);
}
export default function CompanyDetails() {
// Company information state
const [companyInfo, setCompanyInfo] = useState<InsertCompanyInfo>({
  tenantId: "",
  companyName: "",
  address: "",
  country: "",
  financialYearEnd: "",
  companyLogo: "",
  defaultCurrency: "",
});

const [isInitialized, setIsInitialized] = useState(false);

// Reset initialization when component mounts/unmounts
useEffect(() => {
  return () => {
    // Only reset on unmount, not on mount
  };
}, []);

// Fetch company information
const { data: companyData, isLoading: companyLoading } = useQuery<CompanyInfo | null>({
  queryKey: ["/api/company-info"],
  queryFn: async () => {
    try {
      const response = await apiRequest("GET", "/api/company-info");
      return await response.json();
    } catch (err: any) {
      // If not found yet, treat as no data rather than erroring the page
      if (typeof err?.message === 'string' && err.message.startsWith('404')) {
        return null;
      }
      throw err;
    }
  },
  retry: 1,
  refetchOnWindowFocus: false,
});

// Fetch user data to get defaultCurrency from signup
const { data: userData } = useQuery<{ defaultCurrency?: string } | null>({
  queryKey: ["/api/me"],
  queryFn: async () => {
    try {
      const response = await apiRequest("GET", "/api/me");
      return await response.json();
    } catch (err: any) {
      return null;
    }
  },
  retry: 1,
  refetchOnWindowFocus: false,
  staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes
});

// Update company info state when data is fetched
useEffect(() => {
  if (companyData) {
    setCompanyInfo((prev) => {
      const newInfo = {
        tenantId: companyData.tenantId || prev.tenantId || "",
        companyName: companyData.companyName || prev.companyName || (userData as any)?.companyName || "",
        address: companyData.address || prev.address || "",
        country: companyData.country || prev.country || "",
        financialYearEnd: companyData.financialYearEnd || prev.financialYearEnd || "",
        companyLogo: companyData.companyLogo || prev.companyLogo || "",
        // IMPORTANT: never overwrite an existing non-empty defaultCurrency with empty
        defaultCurrency:
          companyData.defaultCurrency ||
          prev.defaultCurrency ||
          userData?.defaultCurrency ||
          "",
      };
      return newInfo;
    });
    setIsInitialized(true);
  } else if (userData && !isInitialized) {
    // If no company data exists yet, populate from user's signup data
    setCompanyInfo((prev) => {
      const newInfo = {
        tenantId: prev.tenantId || "",
        companyName: prev.companyName || (userData as any).companyName || "",
        address: prev.address || "",
        country: prev.country || "",
        financialYearEnd: prev.financialYearEnd || "",
        companyLogo: prev.companyLogo || "",
        // Only set from userData if we don't already have a value
        defaultCurrency: prev.defaultCurrency || userData.defaultCurrency || "",
      };
      return newInfo;
    });
    setIsInitialized(true);
  }
}, [companyData, userData, isInitialized]);

// Company info mutation
const saveCompanyMutation = useMutation({
  mutationFn: async (data: InsertCompanyInfo) => {
    let response: Response;
    if (companyData?._id) {
      // Update existing company info
      response = await apiRequest("PUT", `/api/company-info/${companyData._id}`, data);
    } else {
      // Create new company info
      response = await apiRequest("POST", "/api/company-info", data);
    }
    return await response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/company-info"] });
    toast({
      title: "Success",
      description: "Company information saved successfully!",
      duration: 2000,
    });
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Failed to save company information",
      variant: "destructive",
      duration: 2000,
    });
  },
});

// Category configuration with visibility settings (dynamic, from backend)
type Category = { name: string; visible: boolean; tenantId?: string };
const queryClient = useQueryClient();
const { data: categories = [], isLoading: categoriesLoading, refetch: refetchCategories } = useQuery<Category[]>({
queryKey: ["/api/company/categories"],
initialData: [],
refetchOnWindowFocus: false,
refetchOnMount: false,
staleTime: 5 * 60 * 1000,
gcTime: 10 * 60 * 1000,
});
const addCategoryMutation = useMutation({
mutationFn: async (newCategory: { name: string }) => {
return await apiRequest("POST", "/api/company/categories", {
  ...newCategory,
  visible: true
});
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
refetchCategories();
setNewCategoryName("");
toast({
title: "Category Added",
description: `${newCategoryName} category has been added successfully`,
duration: 1000,
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to add category",
variant: "destructive",
duration: 1000,
});
},
});

// Department configuration with visibility settings (dynamic)
type Department = { 
  _id?: string;
  name: string; 
  departmentHead?: string;
  email?: string;
  visible: boolean; 
  tenantId?: string 
};

// Department schema for validation
const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  departmentHead: z.string().min(1, "Department head is required"),
  email: z.string().min(1, "Email is required").refine((email) => {
    const result = validateEmail(email);
    return result.valid;
  }, (email) => {
    const result = validateEmail(email);
    return { message: result.error || "Invalid email address" };
  }),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;
const {
data: departments = [],
isLoading: departmentsLoading,
refetch: refetchDepartments
} = useQuery<Department[]>({
queryKey: ["/api/company/departments"],
queryFn: async () => {
  const res = await fetch(`${API_BASE_URL}/api/company/departments`, { credentials: 'include' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({} as any));
    const msg = (json as any)?.message || 'Failed to fetch departments';
    throw new Error(msg);
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
},
placeholderData: [],
refetchOnWindowFocus: false,
refetchOnMount: false,
staleTime: 5 * 60 * 1000,
gcTime: 10 * 60 * 1000,
});
const addDepartmentMutation = useMutation({
mutationFn: async (newDepartment: { name: string; departmentHead: string; email: string }) => {
  const normalizedNewName = newDepartment.name.trim().toLowerCase();
  const exists = (Array.isArray(departments) ? departments : []).some(
    (d: any) => String(d?.name || '').trim().toLowerCase() === normalizedNewName
  );
  if (exists) {
    throw new Error("Department already exists");
  }
return await apiRequest("POST", "/api/company/departments", {
  ...newDepartment,
  visible: true
});
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
refetchDepartments();
setDepartmentModalOpen(false);
departmentForm.reset();
toast({
title: "Department Added",
description: `Department has been added successfully`,
duration: 1000,
variant: "success",
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to add department",
variant: "destructive",
duration: 1000,
});
},
});

const updateDepartmentMutation = useMutation({
mutationFn: async ({ id, data }: { id: string; data: { name: string; departmentHead: string; email: string } }) => {
return await apiRequest("PUT", `/api/company/departments/${id}`, data);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
refetchDepartments();
setDepartmentModalOpen(false);
setEditingDepartment(undefined);
departmentForm.reset();
toast({
title: "Department Updated",
description: `Department has been updated successfully`,
duration: 1000,
variant: "success",
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to update department",
variant: "destructive",
duration: 1000,
});
},
});
const deleteDepartmentMutation = useMutation({
mutationFn: async (name: string) => {
return await apiRequest("DELETE", `/api/company/departments/${encodeURIComponent(name)}`);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
toast({
title: "Department Deleted",
description: "Department has been removed.",
duration: 1000,
variant: "destructive",
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to delete department",
variant: "destructive",
duration: 1000,
});
},
});

const [newCategoryName, setNewCategoryName] = useState('');
const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
const [editingDepartment, setEditingDepartment] = useState<Department | undefined>();
const [deptHeadOpen, setDeptHeadOpen] = useState(false);
const [deptHeadSearch, setDeptHeadSearch] = useState('');
const deptHeadDropdownRef = useRef<HTMLDivElement>(null);
const [isDepartmentEmailLocked, setIsDepartmentEmailLocked] = useState(false);
const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [deptDeleteOpen, setDeptDeleteOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<any>(null);

  const [categoryDeleteOpen, setCategoryDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
const [selectedDepartmentForDetails, setSelectedDepartmentForDetails] = useState<string | null>(null);
const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
const [selectedEmployeeSubscriptions, setSelectedEmployeeSubscriptions] = useState<{employeeName: string; subscriptions: any[]}>({employeeName: '', subscriptions: []});
const { toast } = useToast();

// File input ref for Excel import
const companyFileInputRef = React.useRef<HTMLInputElement>(null);

// Fetch employees for department counts / dropdowns
const { data: employeesData = [] } = useQuery<any[]>({
  queryKey: ["/api/employees"],
});

// Fetch subscriptions for department counts
const { data: subscriptionsData = [] } = useQuery<any[]>({
  queryKey: ["/api/subscriptions"],
});

useEffect(() => {
  if (!deptHeadOpen) return;
  function handleClickOutside(event: MouseEvent) {
    if (deptHeadDropdownRef.current && !deptHeadDropdownRef.current.contains(event.target as Node)) {
      setDeptHeadOpen(false);
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [deptHeadOpen]);

// Excel Template Download (Departments, Employees, Subscription Categories)
const downloadCombinedTemplate = () => {
  const wb = XLSX.utils.book_new();
  
  // Departments Sheet
  const departmentTemplateData = [
    {
      'Department Name': 'IT',
      'Department Head': 'John Doe',
      'Email': 'john.doe@company.com',
    },
    {
      'Department Name': 'HR',
      'Department Head': 'Jane Smith',
      'Email': 'jane.smith@company.com',
    },
    {
      'Department Name': 'Finance',
      'Department Head': 'Bob Johnson',
      'Email': 'bob.johnson@company.com',
    }
  ];
  
  const wsDept = XLSX.utils.json_to_sheet(departmentTemplateData);
  wsDept['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsDept, 'Departments');
  
  // Employees Sheet
  const employeeTemplateData = [
    {
      'Name': 'John Doe',
      'Email': 'john.doe@company.com',
      'Department': 'IT',
      'Role': 'Software Engineer',
      'Status': 'active'
    },
    {
      'Name': 'Jane Smith',
      'Email': 'jane.smith@company.com',
      'Department': 'HR',
      'Role': 'HR Manager',
      'Status': 'active'
    },
    {
      'Name': 'Bob Johnson',
      'Email': 'bob.johnson@company.com',
      'Department': 'Finance',
      'Role': 'Accountant',
      'Status': 'active'
    }
  ];
  
  const wsEmp = XLSX.utils.json_to_sheet(employeeTemplateData);
  wsEmp['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsEmp, 'Employees');
  
  // Subscription Categories Sheet
  const categoryTemplateData = [
    { 'Category Name': 'Cloud Services' },
    { 'Category Name': 'Software Licenses' },
    { 'Category Name': 'Marketing Tools' },
    { 'Category Name': 'Communication' }
  ];
  
  const wsCat = XLSX.utils.json_to_sheet(categoryTemplateData);
  wsCat['!cols'] = [{ wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsCat, 'Subscription Categories');
  
  XLSX.writeFile(wb, 'CompanyDetails_Template.xlsx');
  
  toast({
    title: "Template Downloaded",
    description: "Excel template with Departments, Employees, and Categories downloaded successfully",
  });
};

// Export All Data (Departments, Employees, Subscription Categories)
const exportAllToExcel = () => {
  const wb = XLSX.utils.book_new();
  
  // Departments Sheet
  const departmentExportData = departments.map(dept => ({
    'Department Name': dept.name,
    'Department Head': dept.departmentHead || '',
    'Email': dept.email || '',
  }));
  
  const wsDept = XLSX.utils.json_to_sheet(departmentExportData);
  wsDept['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsDept, 'Departments');
  
  // Employees Sheet
  const employeeExportData = employeesData.map((emp: any) => ({
    'Name': emp.name,
    'Email': emp.email,
    'Department': emp.department,
    'Role': emp.role,
    'Status': emp.status
  }));
  
  const wsEmp = XLSX.utils.json_to_sheet(employeeExportData);
  wsEmp['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsEmp, 'Employees');
  
  // Subscription Categories Sheet
  const categoryExportData = categories.map(cat => ({
    'Category Name': cat.name
  }));
  
  const wsCat = XLSX.utils.json_to_sheet(categoryExportData);
  wsCat['!cols'] = [{ wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsCat, 'Subscription Categories');
  
  XLSX.writeFile(wb, `CompanyDetails_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  
  toast({
    title: "Export Successful",
    description: `Exported ${departments.length} departments, ${employeesData.length} employees, and ${categories.length} categories to Excel`,
  });
};

// Import Combined Excel (Departments, Employees, Subscription Categories)
const importCombinedExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      let deptSuccess = 0;
      let deptError = 0;
      let empSuccess = 0;
      let empError = 0;
      let catSuccess = 0;
      let catError = 0;

      // Import Departments Sheet
      if (workbook.SheetNames.includes('Departments')) {
        const deptSheet = workbook.Sheets['Departments'];
        const deptData = XLSX.utils.sheet_to_json(deptSheet) as any[];

        for (const row of deptData) {
          try {
            const departmentData = {
              name: (row['Department Name'] || '').toString().trim(),
              departmentHead: (row['Department Head'] || '').toString().trim(),
              email: (row['Email'] || '').toString().trim(),
              visible: true
            };

            if (!departmentData.name || !departmentData.departmentHead || !departmentData.email) {
              deptError++;
              continue;
            }

            const res = await apiRequest("POST", "/api/company/departments", departmentData);
            if (res.ok) {
              deptSuccess++;
            } else {
              deptError++;
            }
          } catch (error) {
            deptError++;
          }
        }
      }

      // Import Employees Sheet
      if (workbook.SheetNames.includes('Employees')) {
        const empSheet = workbook.Sheets['Employees'];
        const empData = XLSX.utils.sheet_to_json(empSheet) as any[];

        for (const row of empData) {
          try {
            const employeeData = {
              name: (row['Name'] || '').toString().trim(),
              email: (row['Email'] || '').toString().trim(),
              department: (row['Department'] || '').toString().trim(),
              role: (row['Role'] || '').toString().trim(),
              status: (row['Status'] || 'active').toString().trim().toLowerCase()
            };

            if (!employeeData.name || !employeeData.email || !employeeData.department || !employeeData.role) {
              empError++;
              continue;
            }

            const res = await apiRequest("POST", "/api/employees", employeeData);
            if (res.ok) {
              empSuccess++;
            } else {
              empError++;
            }
          } catch (error) {
            empError++;
          }
        }
      }

      // Import Subscription Categories Sheet
      if (workbook.SheetNames.includes('Subscription Categories')) {
        const catSheet = workbook.Sheets['Subscription Categories'];
        const catData = XLSX.utils.sheet_to_json(catSheet) as any[];

        for (const row of catData) {
          try {
            const categoryName = (row['Category Name'] || '').toString().trim();

            if (!categoryName) {
              catError++;
              continue;
            }

            const res = await apiRequest("POST", "/api/company/categories", {
              name: categoryName,
              visible: true
            });
            
            if (res.ok) {
              catSuccess++;
            } else {
              catError++;
            }
          } catch (error) {
            catError++;
          }
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
      refetchDepartments();
      refetchCategories();

      toast({
        title: "Import Complete",
        description: `Departments: ${deptSuccess} success, ${deptError} failed. Employees: ${empSuccess} success, ${empError} failed. Categories: ${catSuccess} success, ${catError} failed.`,
        variant: (deptError > 0 || empError > 0 || catError > 0) ? "destructive" : "default",
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to parse Excel file. Please check the file format.",
        variant: "destructive",
      });
    }
  };
  reader.readAsArrayBuffer(file);
  
  // Reset file input
  if (companyFileInputRef.current) {
    companyFileInputRef.current.value = '';
  }
};

// Department form
const departmentForm = useForm<DepartmentFormValues>({
  resolver: zodResolver(departmentSchema),
  defaultValues: {
    name: "",
    departmentHead: "",
    email: "",
  },
});

const selectedDepartmentHead = departmentForm.watch('departmentHead');

useEffect(() => {
  if (!departmentModalOpen) return;

  const headName = String(selectedDepartmentHead || '').trim();
  if (!headName) {
    setIsDepartmentEmailLocked(false);
    departmentForm.setValue('email', '', { shouldDirty: true, shouldValidate: true });
    return;
  }

  const match = (Array.isArray(employeesData) ? employeesData : []).find(
    (emp: any) => String(emp?.name || '').trim() === headName
  );
  const email = String(match?.email || '').trim();

  if (email) {
    departmentForm.setValue('email', email, { shouldDirty: true, shouldValidate: true });
    setIsDepartmentEmailLocked(true);
    departmentForm.clearErrors('email');
  } else {
    setIsDepartmentEmailLocked(false);
  }
}, [selectedDepartmentHead, employeesData, departmentModalOpen]);

const addNewCategory = () => {
if (
newCategoryName.trim() &&
!categories.find(
c => typeof c.name === "string" && c.name.toLowerCase() === newCategoryName.toLowerCase()
)
) {
addCategoryMutation.mutate({ name: newCategoryName.trim() });
}
};

const onSubmitDepartment = (data: DepartmentFormValues) => {
if (editingDepartment && editingDepartment._id) {
  updateDepartmentMutation.mutate({ id: editingDepartment._id, data });
} else {
  addDepartmentMutation.mutate(data);
}
};

// Get employee count for a department
const getEmployeeCount = (deptName: string) => {
  return employeesData.filter(emp => emp.department === deptName).length;
};

// Get subscription count for a department
const getSubscriptionCount = (deptName: string) => {
  return subscriptionsData.filter(sub => {
    if (Array.isArray(sub.departments)) {
      return sub.departments.includes(deptName);
    }
    if (typeof sub.departments === 'string') {
      return sub.departments.includes(deptName) || sub.departments.includes(`"${deptName}"`);
    }
    return false;
  }).length;
};

// Get employees for a department
const getDepartmentEmployees = (deptName: string) => {
  return employeesData.filter(emp => emp.department === deptName);
};

// Get subscriptions for a department
const getDepartmentSubscriptions = (deptName: string) => {
  return subscriptionsData.filter(sub => {
    if (Array.isArray(sub.departments)) {
      return sub.departments.includes(deptName);
    }
    if (typeof sub.departments === 'string') {
      return sub.departments.includes(deptName) || sub.departments.includes(`"${deptName}"`);
    }
    return false;
  });
};

// Get subscriptions for a category
const getCategorySubscriptions = (categoryName: string) => {
  const name = (categoryName || '').toLowerCase().trim();
  if (!name) return [];
  return subscriptionsData.filter((sub) => {
    const subCategory = (sub?.category || '').toLowerCase().trim();
    return subCategory === name;
  });
};

// Get subscriptions for a specific employee
const getEmployeeSubscriptions = (employeeName: string, deptName: string) => {
  const deptSubs = getDepartmentSubscriptions(deptName);
  // Filter subscriptions to only show those where the employee is the owner
  return deptSubs.filter(sub => sub.owner === employeeName);
};

// Filter departments by search term
const filteredDepartments = departments.filter(dept => 
  dept.name?.toLowerCase().includes(departmentSearchTerm.toLowerCase())
);

const deleteCategoryMutation = useMutation({
mutationFn: async (name: string) => {
return await apiRequest("DELETE", `/api/company/categories/${encodeURIComponent(name)}`);
},
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
setTimeout(() => {
queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
}, 300);
toast({
title: "Category Deleted",
description: "Category has been removed.",
duration: 1000,
});
},
onError: (error: any) => {
toast({
title: "Error",
description: error.message || "Failed to delete category",
variant: "destructive",
duration: 1000,
});
},
});

// Get visible departments for use in dropdowns and cards
const visibleDepartments = departments.filter(dept => dept.visible);

// Handle input changes
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const { name, value } = e.target;
setCompanyInfo(prev => ({ ...prev, [name]: value }));
};

// Handle logo upload
const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    // For now, we'll store the base64 string of the image
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCompanyInfo(prev => ({
        ...prev,
        companyLogo: result
      }));
    };
    reader.readAsDataURL(file);
  }
};

// Handle form submission
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  saveCompanyMutation.mutate(companyInfo);
};

// Currencies for dynamic dropdown (reused behavior like subscription modal)
const { data: currencies = [], isLoading: currenciesLoading } = useQuery<any[]>({
  queryKey: ["/api/currencies"],
  queryFn: async () => {
    const res = await fetch(`${API_BASE_URL}/api/currencies`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch currencies");
    return res.json();
  },
  refetchOnWindowFocus: false,
});

// Tab selection logic from query param
const [searchParams] = useSearchParams();
const tabParam = searchParams.get("tab");
let initialTab = "company";
if (tabParam === "department") initialTab = "department";
else if (tabParam === "employee") initialTab = "employee";
else if (tabParam === "users") initialTab = "users";
else if (tabParam === "subscription-category" || tabParam === "subscription") initialTab = "subscription";
// fallback to company if not valid
const [activeTab, setActiveTab] = useState(initialTab);

return (
  <div className="h-screen overflow-hidden bg-white font-inter">
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Modern Professional Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Company Details</h1>
              {/* Description removed as requested */}
            </div>
          </div>
          
          {/* Consolidated Excel Import/Export Buttons */}
          <div className="flex items-center gap-3">
            <input
              ref={companyFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={importCombinedExcel}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={downloadCombinedTemplate}
              className="border-purple-300 text-purple-700 hover:bg-purple-50 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button
              variant="outline"
              onClick={() => companyFileInputRef.current?.click()}
              className="border-green-300 text-green-700 hover:bg-green-50 shadow-sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              onClick={exportAllToExcel}
              disabled={departments.length === 0 && employeesData.length === 0 && categories.length === 0}
              className="border-blue-300 text-blue-700 hover:bg-blue-50 shadow-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
<TabsList className="flex w-full bg-white rounded-lg p-1 shadow-sm mb-6">
<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="company"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Building2 className="w-4 h-4" />
<span>Company Information</span>
</TabsTrigger>
</motion.div>

<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="department"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Shield className="w-4 h-4" />
<span>Department</span>
</TabsTrigger>
</motion.div>

<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="employee"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Users className="w-4 h-4" />
<span>Employees</span>
</TabsTrigger>
</motion.div>

<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="subscription"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Settings className="w-4 h-4" />
<span>Subscription Category</span>
</TabsTrigger>
</motion.div>

<Can I="read" a="User" fallback={null}>
<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
<TabsTrigger
value="users"
className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-all duration-300
data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
text-gray-600 hover:text-gray-900 hover:bg-gray-100"
>
<Users className="w-4 h-4" />
<span>User Management</span>
</TabsTrigger>
</motion.div>
</Can>
</TabsList>

<AnimatePresence mode="wait">
<TabsContent value="company" className="mt-6 h-[calc(100vh-240px)] overflow-hidden">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
className="h-full"
>
<Card className="bg-white border border-gray-200 shadow-sm p-0 rounded-xl overflow-hidden h-full flex flex-col">
{/* Professional Header with Gradient */}
<div className="bg-gradient-to-r from-indigo-500 to-blue-500 px-8 py-4 flex-shrink-0">
  <div className="flex items-center gap-4">
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shadow-md"
    >
      <Building2 className="text-white" size={24} />
    </motion.div>
    <div>
      <h3 className="text-2xl font-bold text-white tracking-tight">Company Information</h3>
    </div>
  </div>
</div>

{/* Form Content - Scrollable */}
<div className="flex-1 overflow-y-auto">
<form onSubmit={handleSubmit} className="p-8 bg-gradient-to-br from-gray-50 to-white">
  {/* Professional Section Header - Sticky */}
  <div className="sticky top-0 z-10 bg-gradient-to-br from-gray-50 to-white pb-4 mb-4 -mx-8 px-8 pt-0">
    <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-2">Basic Information</h2>
    <div className="h-px bg-gradient-to-r from-indigo-500 to-blue-500 mt-4"></div>
  </div>
{companyLoading ? (
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="space-y-2">
<Skeleton className="h-4 w-24" />
<Skeleton className="h-10 w-full" />
</div>
<div className="space-y-2">
<Skeleton className="h-4 w-24" />
<div className="flex items-center gap-4">
<Skeleton className="w-20 h-20 rounded-xl" />
<div>
<Skeleton className="h-10 w-32" />
<Skeleton className="h-3 w-24 mt-1" />
</div>
</div>
</div>
<div className="space-y-2">
<Skeleton className="h-4 w-16" />
<Skeleton className="h-10 w-full" />
</div>
<div className="space-y-2">
<Skeleton className="h-4 w-16" />
<Skeleton className="h-10 w-full" />
</div>
<div className="space-y-2">
<Skeleton className="h-4 w-32" />
<Skeleton className="h-10 w-full" />
</div>
</div>
  ) : (
  <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-3">
    {/* Company Name */}
    <div className="space-y-2">
      <Label htmlFor="companyName" className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Company Name</Label>
      <Input
        id="companyName"
        name="companyName"
        value={companyInfo.companyName}
        onChange={handleInputChange}
        placeholder=""
        className="w-full border-gray-300 rounded-lg p-3 text-base font-medium bg-white shadow-sm"
      />
    </div>

    {/* Company Logo */}
    <div className="space-y-2">
      <Label htmlFor="logo" className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Company Logo</Label>
<div className="flex items-center gap-4">
{companyInfo.companyLogo ? (
<div className="w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
<img
src={companyInfo.companyLogo}
alt="Company Logo"
className="w-full h-full object-cover"
/>
</div>
) : (
<div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
<Upload className="w-6 h-6 text-gray-400" />
</div>
)}
<div>
<Button
type="button"
variant="outline"
className="relative overflow-hidden rounded-lg h-11 px-4 text-base font-medium bg-white shadow-sm border-gray-300 hover:bg-gray-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
onClick={() => document.getElementById('logo-upload')?.click()}
>
<Upload className="w-4 h-4 mr-2" />
Upload Logo
</Button>
<input
id="logo-upload"
type="file"
accept="image/*"
className="hidden"
onChange={handleLogoUpload}
/>
<p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
</div>
</div>
</div>

{/* Address */}
<div className="space-y-2">
<Label htmlFor="address" className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Address</Label>
<Input
id="address"
name="address"
value={companyInfo.address}
onChange={handleInputChange}
placeholder=""
className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
/>
</div>

{/* Country */}
<div className="space-y-2">
  <Label htmlFor="country" className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Country</Label>
  <Input
    id="country"
    name="country"
    value={companyInfo.country}
    onChange={handleInputChange}
    placeholder=""
    className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
  />
</div>

{/* Local Currency */}
<div className="space-y-2">
  <Label className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Local Currency</Label>
  {(() => {
    // Derive an effective selected currency: prefer saved companyInfo, then userData from signup
    const selectedCurrency = companyInfo.defaultCurrency || userData?.defaultCurrency || '';

    return (
      <Select
        value={selectedCurrency}
        onValueChange={(val) => {
          setCompanyInfo(prev => ({ ...prev, defaultCurrency: val }));
        }}
      >
        <SelectTrigger className="w-full bg-white border border-gray-300 rounded-lg p-3 h-12 text-base font-medium shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200">
          <SelectValue placeholder={currenciesLoading ? 'Loading…' : 'Select currency'} />
        </SelectTrigger>
        <SelectContent className="dropdown-content">
          {/* Ensure the currently selected currency is always present as an option, even if currencies list is empty */}
          {selectedCurrency && !currencies.find((c: any) => c.code === selectedCurrency) && (
            <SelectItem key={selectedCurrency} value={selectedCurrency} className="dropdown-item">
              {selectedCurrency}
            </SelectItem>
          )}
          {currencies && currencies.length > 0 ? (
            currencies.map((curr: any) => {
              return (
                <SelectItem key={curr.code} value={curr.code} className="dropdown-item">
                  {curr.code}
                </SelectItem>
              );
            })
          ) : (
            !selectedCurrency && (
              <SelectItem value="no-currency" disabled className="dropdown-item disabled">
                No currencies configured
              </SelectItem>
            )
          )}
          <div className="border-t">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center"
              onClick={() => window.location.href = '/configuration?tab=currency'}
            >
              + New
            </button>
          </div>
        </SelectContent>
      </Select>
    );
  })()}
  <div className="text-xs text-gray-500">Current value: {companyInfo.defaultCurrency || userData?.defaultCurrency || 'None'}</div>
</div>

{/* Financial Year End */}
<div className="space-y-2">
  <Label htmlFor="financialYearEnd" className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Financial Year End</Label>
  <Input
    id="financialYearEnd"
    name="financialYearEnd"
    type="date"
    value={companyInfo.financialYearEnd}
    onChange={handleInputChange}
    className="w-full border-gray-300 rounded-lg p-3 text-base font-medium bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
  />
</div>
</div>
)}

                  {/* Save Button - Professional styling */}
                  <div className="pt-8 flex justify-end border-t border-gray-200 mt-8">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        type="submit"
                        disabled={saveCompanyMutation.isPending || companyLoading}
                        className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-lg py-3 px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saveCompanyMutation.isPending ? "Saving..." : "Save Company Information"}
                      </Button>
                    </motion.div>
                  </div>
                </form>
                </div>
              </Card>
</motion.div>
</TabsContent>

<TabsContent value="department" className="mt-6 h-[calc(100vh-240px)] overflow-hidden">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
className="h-full"
>
<Card className="bg-white border border-gray-200 shadow-sm p-0 rounded-xl overflow-hidden h-full flex flex-col">
{/* Professional Header with Gradient */}
<div className="bg-gradient-to-r from-indigo-500 to-blue-500 px-8 py-4 flex-shrink-0">
  <div className="flex items-center gap-4">
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shadow-md"
    >
      <Shield className="text-white" size={24} />
    </motion.div>
    <div>
      <h3 className="text-2xl font-bold text-white tracking-tight">Department Management</h3>
    </div>
  </div>
</div>

{/* Content - Scrollable */}
<div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-white">
{/* Search and Add Department - Sticky */}
<div className="sticky top-0 z-10 bg-white shadow-sm -mx-0 px-8 py-6 flex items-center justify-between space-x-4 mb-6 border-b border-gray-200">
<div className="relative flex-1 max-w-sm">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
  <Input
    placeholder="Search departments..."
    value={departmentSearchTerm}
    onChange={(e) => setDepartmentSearchTerm(e.target.value)}
    className="pl-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
  />
</div>
<Dialog open={departmentModalOpen} onOpenChange={setDepartmentModalOpen}>
  <DialogTrigger asChild>
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      <Button
        onClick={() => {
          setEditingDepartment(undefined);
          departmentForm.reset({
            name: "",
            departmentHead: "",
            email: "",
          });
          setDeptHeadSearch('');
          setDeptHeadOpen(false);
          setIsDepartmentEmailLocked(false);
          setDepartmentModalOpen(true);
        }}
        className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Department
      </Button>
    </motion.div>
  </DialogTrigger>
  <DialogContent className="max-w-2xl min-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter">
    {/* Header with Gradient Background */}
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
      <DialogHeader>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white">
              {editingDepartment ? 'Edit Department' : 'Add New Department'}
            </DialogTitle>
          </div>
        </div>
      </DialogHeader>
    </div>

    {/* Form Content */}
    <div className="px-8 py-6">
      <Form {...departmentForm}>
        <form onSubmit={departmentForm.handleSubmit(onSubmitDepartment)} className="grid grid-cols-1 gap-6">
          {/* Department Name */}
          <FormField
            control={departmentForm.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium text-sm">Department Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  />
                </FormControl>
                <FormMessage className="text-red-600" />
              </FormItem>
            )}
          />

          {/* Department Head */}
          <FormField
            control={departmentForm.control}
            name="departmentHead"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium text-sm">Department Head</FormLabel>
                <div className="relative" ref={deptHeadDropdownRef}>
                  <div className="relative">
                    <Input
                      value={deptHeadSearch}
                      placeholder="Select employee"
                      className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10 cursor-pointer"
                      onFocus={() => setDeptHeadOpen(true)}
                      onClick={() => setDeptHeadOpen(true)}
                      onChange={(e) => {
                        setDeptHeadSearch(e.target.value);
                        setDeptHeadOpen(true);
                        field.onChange('');
                      }}
                      autoComplete="off"
                    />
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                      onClick={() => setDeptHeadOpen(!deptHeadOpen)}
                    />
                  </div>

                  {deptHeadOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                      {(Array.isArray(employeesData) ? employeesData : [])
                        .filter((emp: any) => {
                          const q = deptHeadSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            String(emp?.name || '').toLowerCase().includes(q) ||
                            String(emp?.email || '').toLowerCase().includes(q)
                          );
                        })
                        .map((emp: any) => {
                          const duplicateNames = employeesData.filter((e: any) => e.name === emp.name);
                          const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                          const selected = field.value === emp.name;
                          return (
                            <div
                              key={emp._id || emp.id || emp.email}
                              className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                selected ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                              onClick={() => {
                                // If already selected, clear it
                                if (field.value === emp.name) {
                                  field.onChange('');
                                  setDeptHeadSearch('');
                                  setDeptHeadOpen(false);
                                  return;
                                }
                                const name = String(emp.name || '').trim();
                                field.onChange(name);
                                setDeptHeadSearch(name);
                                setDeptHeadOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="font-normal">{displayName}</span>
                            </div>
                          );
                        })}

                      {(Array.isArray(employeesData) ? employeesData : []).length === 0 && (
                        <div className="px-3 py-2.5 text-sm text-slate-500">No employees found</div>
                      )}
                    </div>
                  )}
                </div>
                <FormMessage className="text-red-600" />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={departmentForm.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium text-sm">Email Address</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    readOnly={isDepartmentEmailLocked}
                    onBlur={() => {
                      // Trigger validation when field loses focus
                      departmentForm.trigger('email');
                    }}
                    className={`border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 ${
                      fieldState.error ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : ''
                    } ${isDepartmentEmailLocked ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  />
                </FormControl>
                <FormMessage className="text-red-600 text-sm font-medium mt-1" />
              </FormItem>
            )}
          />

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDepartmentModalOpen(false);
                setEditingDepartment(undefined);
                departmentForm.reset();
                setDeptHeadSearch('');
                setDeptHeadOpen(false);
                setIsDepartmentEmailLocked(false);
              }}
              className="border-gray-300 text-gray-700 rounded-lg h-10 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
            >
              <Building2 className="w-4 h-4 mr-2" />
              {addDepartmentMutation.isPending || updateDepartmentMutation.isPending
                ? (editingDepartment ? 'Updating...' : 'Creating...') 
                : (editingDepartment ? 'Update Department' : 'Create Department')
              }
            </Button>
          </div>
        </form>
      </Form>
    </div>
  </DialogContent>
</Dialog>
</div>

{/* Department List */}
<div className="px-8 pb-8 space-y-4">
<h3 className="text-base font-semibold text-gray-900 mb-4">Available Departments</h3>
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
{departmentsLoading ? (
<div className="text-gray-500">Loading departments...</div>
) : (
[...filteredDepartments].reverse().map((department, idx) => {
const displayName = typeof department.name === "string" && department.name.trim() ? department.name : `Unnamed Department ${idx + 1}`;
const empCount = getEmployeeCount(department.name);
const subCount = getSubscriptionCount(department.name);
return (
  <motion.div
    key={displayName + idx}
    whileHover={{ y: -5 }}
    className="p-4 border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-sm rounded-xl transition-all duration-300"
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center space-x-2">
        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center shadow-md">
          <Building2 className="text-white" size={18} />
        </div>
        <div>
          <span className="text-sm font-semibold text-gray-900 block">{String(displayName)}</span>
        </div>
      </div>
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            departmentForm.reset({
              name: department.name || "",
              departmentHead: department.departmentHead || "",
              email: department.email || "",
            });
            setDeptHeadSearch(department.departmentHead || "");
            setDeptHeadOpen(false);
            setEditingDepartment(department);
            setDepartmentModalOpen(true);
          }}
          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full p-1 h-7 w-7"
          title="Edit Department"
        >
          <Edit size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!department.name) return;
            setDeptToDelete({
              department,
              displayName,
              subCount,
            });
            setDeptDeleteOpen(true);
          }}
          disabled={deleteDepartmentMutation.isPending || !department.name}
          className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-7 w-7"
          title="Delete Department"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
    
    {/* Count badges - clickable to open modal */}
    <div className="flex items-center space-x-3 mt-3">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setSelectedDepartmentForDetails(department.name);
          setDetailsModalOpen(true);
        }}
        className="flex items-center space-x-1 bg-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all border border-indigo-200 cursor-pointer"
      >
        <Users className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-indigo-600">{empCount}</span>
      </motion.button>
      
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="flex items-center space-x-1 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-blue-200"
      >
        <BarChart3 className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-600">{subCount}</span>
      </motion.div>
    </div>
  </motion.div>
);
})
)
}
</div>

{/* Department Delete Confirmation Dialog */}
<Dialog open={deptDeleteOpen} onOpenChange={(open) => {
  setDeptDeleteOpen(open);
  if (!open) setDeptToDelete(null);
}}>
  <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
    <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Delete Department
            </DialogTitle>
            <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
          </div>
        </div>
      </DialogHeader>
    </div>

    <div className="px-6 py-5">
      {deptToDelete?.subCount > 0 ? (
        <>
          <p className="text-gray-700 text-sm leading-relaxed mb-4">
            The department <span className="font-semibold text-gray-900">"{deptToDelete?.displayName}"</span> is linked to <span className="font-semibold text-gray-900">{deptToDelete?.subCount}</span> subscription(s).
          </p>
          <p className="text-gray-600 text-xs leading-relaxed">
            You can’t delete it right now. Please reassign the department in those subscriptions and then try again.
          </p>
        </>
      ) : (
        <>
          <p className="text-gray-700 text-sm leading-relaxed mb-4">
            Are you sure you want to delete the department <span className="font-semibold text-gray-900">"{deptToDelete?.displayName}"</span>?
          </p>
          <p className="text-gray-600 text-xs leading-relaxed">
            This will permanently remove this department from your system.
          </p>
        </>
      )}
    </div>

    <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setDeptDeleteOpen(false);
          setDeptToDelete(null);
        }}
        className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
      >
        {deptToDelete?.subCount > 0 ? 'OK' : 'Cancel'}
      </Button>
      {deptToDelete?.subCount > 0 ? null : (
        <Button
          type="button"
          onClick={() => {
            const deptName = deptToDelete?.department?.name;
            if (deptName) {
              deleteDepartmentMutation.mutate(deptName);
            }
            setDeptDeleteOpen(false);
            setDeptToDelete(null);
          }}
          className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
        >
          Delete
        </Button>
      )}
    </div>
  </DialogContent>
</Dialog>
</div>

{/* Department Details Modal */}
<Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
  <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white">
    {/* Header with Gradient Background */}
    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-6 rounded-t-2xl">
      <DialogHeader>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white">
              {selectedDepartmentForDetails} Department Details
            </DialogTitle>
          </div>
        </div>
      </DialogHeader>
    </div>

    {/* Table Content */}
    <div className="p-8">
      <Table className="min-w-full divide-y divide-gray-200">
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Employee</TableHead>
            <TableHead className="h-12 px-6 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">Subscriptions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white divide-y divide-gray-200">
          {selectedDepartmentForDetails && getDepartmentEmployees(selectedDepartmentForDetails).length > 0 ? (
            getDepartmentEmployees(selectedDepartmentForDetails).map((emp: any) => {
              const empSubCount = getEmployeeSubscriptions(emp.name, selectedDepartmentForDetails).length;
              return (
                <TableRow key={emp._id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="font-medium text-gray-900 text-sm">{emp.name}</div>
                    <div className="text-xs text-gray-500">{emp.email}</div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedEmployeeSubscriptions({
                          employeeName: emp.name,
                          subscriptions: getEmployeeSubscriptions(emp.name, selectedDepartmentForDetails)
                        });
                        setSubscriptionModalOpen(true);
                      }}
                      className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg shadow-sm hover:shadow-md hover:bg-blue-200 transition-all border border-blue-200 cursor-pointer font-semibold"
                    >
                      <span>{empSubCount}</span>
                    </motion.button>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={2} className="text-center py-8">
                <div className="flex flex-col items-center justify-center">
                  <Users className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-base font-medium text-gray-900">No employees found</p>
                  <p className="text-gray-500 mt-1 text-sm">This department has no employees assigned</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  </DialogContent>
</Dialog>

{/* Employee Subscriptions Modal */}
<Dialog open={subscriptionModalOpen} onOpenChange={setSubscriptionModalOpen}>
  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white">
    {/* Header with Gradient Background */}
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
      <DialogHeader>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Monitor className="h-6 w-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white">
              {selectedEmployeeSubscriptions.employeeName}'s Subscriptions
            </DialogTitle>
          </div>
        </div>
      </DialogHeader>
    </div>

    {/* Subscriptions List */}
    <div className="p-8">
      {selectedEmployeeSubscriptions.subscriptions.length > 0 ? (
        <Table className="min-w-full divide-y divide-gray-200">
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Service</TableHead>
              <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Billing Cycle</TableHead>
              <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Next Renewal</TableHead>
              <TableHead className="h-12 px-6 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {selectedEmployeeSubscriptions.subscriptions.map((sub: any, index: number) => (
              <motion.tr
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="hover:bg-gray-50 transition-colors"
              >
                <TableCell className="px-6 py-4">
                  <div className="font-semibold text-gray-900 text-sm">{sub.serviceName}</div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="text-sm text-gray-600">{sub.billingCycle || '-'}</div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  <div className="text-sm text-gray-600">
                    {sub.nextRenewal ? new Date(sub.nextRenewal).toLocaleDateString() : '-'}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">
                  {sub.category ? (
                    <Badge className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1">
                      {sub.category}
                    </Badge>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-12">
          <Monitor className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-base font-medium text-gray-900">No subscriptions assigned</p>
          <p className="text-gray-500 mt-1 text-sm">This employee has no subscriptions in this department</p>
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>
</div>
</Card>
</motion.div>
</TabsContent>

<TabsContent value="employee" className="mt-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
>
<EmployeeManagementTab departments={visibleDepartments.map(d => d.name)} />
</motion.div>
</TabsContent>

<TabsContent value="subscription" className="mt-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
>
<Card className="bg-white border border-gray-200 shadow-sm p-0 rounded-xl overflow-hidden">
{/* Professional Header with Gradient */}
<div className="bg-gradient-to-r from-indigo-500 to-blue-500 px-8 py-4">
  <div className="flex items-center gap-4">
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shadow-md"
    >
      <Settings className="text-white" size={24} />
    </motion.div>
    <div>
      <h3 className="text-2xl font-bold text-white tracking-tight">Subscription Categories</h3>
    </div>
  </div>
</div>

{/* Content */}
<div className="p-8 bg-gradient-to-br from-gray-50 to-white">
{/* Add New Category */}
<div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
<Input
placeholder=""
value={newCategoryName}
onChange={(e) => setNewCategoryName(e.target.value)}
className="w-full border-gray-300 rounded-lg p-3 text-base font-medium bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
/>
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
<Button
onClick={addNewCategory}
disabled={!newCategoryName.trim() || addCategoryMutation.isPending}
className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg"
>
<Plus className="w-4 h-4 mr-2" />
{addCategoryMutation.isPending ? "Adding..." : "Add Category"}
</Button>
</motion.div>
</div>

{/* Category List */}
<div className="space-y-4">
<h3 className="text-base font-semibold text-gray-900">Available Categories</h3>
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
{categoriesLoading ? (
<div className="text-gray-500">Loading categories...</div>
) : (
categories.map((category, idx) => {
const displayName = typeof category.name === "string" && category.name.trim() ? category.name : `Unnamed Category ${idx + 1}`;
const subCount = category.name ? getCategorySubscriptions(category.name).length : 0;
return (
<motion.div
key={displayName + idx}
whileHover={{ y: -5 }}
className="p-4 border border-indigo-200 bg-indigo-50 shadow-sm rounded-xl transition-all duration-300"
>
<div className="flex items-center justify-between">
<div className="flex items-center space-x-3 w-full">
<span className="text-sm font-medium text-gray-900 truncate w-full">{String(displayName)}</span>
</div>
<div className="flex items-center space-x-2">
<Button
variant="ghost"
size="sm"
onClick={() => {
if (!category.name) return;
setCategoryToDelete({
  category,
  displayName,
  subCount,
});
setCategoryDeleteOpen(true);
}}
disabled={deleteCategoryMutation.isPending || !category.name}
className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full p-1 h-8 w-8"
title="Delete Category"
>
<Trash2 size={16} />
</Button>
</div>
</div>
</motion.div>
);
})
)}
</div>
</div>
</div>
</Card>
</motion.div>
</TabsContent>

{/* Category Delete Confirmation Dialog */}
<Dialog open={categoryDeleteOpen} onOpenChange={(open) => {
  setCategoryDeleteOpen(open);
  if (!open) setCategoryToDelete(null);
}}>
  <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
    <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Delete Category
            </DialogTitle>
            <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
          </div>
        </div>
      </DialogHeader>
    </div>

    <div className="px-6 py-5">
      {categoryToDelete?.subCount > 0 ? (
        <>
          <p className="text-gray-700 text-sm leading-relaxed mb-4">
            The category <span className="font-semibold text-gray-900">"{categoryToDelete?.displayName}"</span> is linked to <span className="font-semibold text-gray-900">{categoryToDelete?.subCount}</span> subscription(s).
          </p>
          <p className="text-gray-600 text-xs leading-relaxed">
            You can’t delete it right now. Please reassign the category in those subscriptions and then try again.
          </p>
        </>
      ) : (
        <>
          <p className="text-gray-700 text-sm leading-relaxed mb-4">
            Are you sure you want to delete the category <span className="font-semibold text-gray-900">"{categoryToDelete?.displayName}"</span>?
          </p>
          <p className="text-gray-600 text-xs leading-relaxed">
            This will permanently remove this category from your system.
          </p>
        </>
      )}
    </div>

    <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setCategoryDeleteOpen(false);
          setCategoryToDelete(null);
        }}
        className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
      >
        {categoryToDelete?.subCount > 0 ? 'OK' : 'Cancel'}
      </Button>
      {categoryToDelete?.subCount > 0 ? null : (
        <Button
          type="button"
          onClick={() => {
            const name = categoryToDelete?.category?.name;
            if (name) {
              deleteCategoryMutation.mutate(name);
            }
            setCategoryDeleteOpen(false);
            setCategoryToDelete(null);
          }}
          className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
        >
          Delete
        </Button>
      )}
    </div>
  </DialogContent>
</Dialog>

<TabsContent value="users" className="mt-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}
>
<UserManagementTab />
</motion.div>
</TabsContent>
</AnimatePresence>
</Tabs>
</div>
</div>
</div>
);
}