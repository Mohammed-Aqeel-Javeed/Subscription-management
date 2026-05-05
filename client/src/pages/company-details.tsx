// import { insertUserSchema } from "@shared/schema";
import React, { useState, useEffect, useRef } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Monitor, Upload, Save, Plus, Eye, EyeOff, Settings, UserPlus, Edit, Trash2, User, Activity, UsersIcon, Search, Download, ChevronDown, Check, MoreVertical, AlertCircle, Building, Tags, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const exitConfirmActionRef = React.useRef<null | (() => void)>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedEmployeeSubscriptions, setSelectedEmployeeSubscriptions] = useState<{ employeeName: string; subscriptions: any[] }>({ employeeName: '', subscriptions: [] });
  const [dataManagementSelectKey, setDataManagementSelectKey] = useState(0);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [openActionsMenuForId, setOpenActionsMenuForId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const downloadEmployeeTemplate = () => {
    const template = [{ name: 'John Doe', email: 'john@example.com', department: 'IT', role: 'Manager', status: 'active' }];
    const csv = Papa.unparse(template, { header: true });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employees_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Template Downloaded', description: 'Use this template to import employees.' });
  };

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

  const requestExitConfirm = (action: () => void) => {
    exitConfirmActionRef.current = action;
    setExitConfirmOpen(true);
  };

  const closeEmployeeDialogNow = () => {
    setModalOpen(false);
    form.reset();
    setEditingEmployee(undefined);
  };

  const requestCloseEmployeeDialog = () => {
    if (form.formState.isDirty) {
      requestExitConfirm(() => {
        closeEmployeeDialogNow();
      });
      return;
    }
    closeEmployeeDialogNow();
  };

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
      <div className="shrink-0 pb-4 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
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
                className="pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm"
              />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
            />
            <Select
              key={dataManagementSelectKey}
              onValueChange={(value) => {
                if (value === 'export') {
                  handleExport();
                } else if (value === 'import') {
                  setImportConfirmOpen(true);
                }
                setDataManagementSelectKey((k) => k + 1);
              }}
            >
              <SelectTrigger className="w-44 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 font-medium transition-all duration-200">
                <SelectValue placeholder="Import/Export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="export" className="cursor-pointer">
                  <div className="flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </div>
                </SelectItem>
                <SelectItem value="import" className="cursor-pointer">
                  <div className="flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={modalOpen} onOpenChange={(open) => {
            if (open) {
              setModalOpen(true);
              return;
            }
            requestCloseEmployeeDialog();
          }}>
            <DialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={handleAddNew}
                  className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
                >
                  <UserPlus className="mr-2" size={16} />
                  New Employee
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl min-w-[600px] max-h-[85vh] overflow-y-auto border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter">
              {/* Header with Gradient Background */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 ">
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
                            <Input {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm" />
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
                              className={`border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm ${fieldState.error ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : ''
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
                                value={employeeDeptOpen ? employeeDeptSearch : (field.value || '')}
                                placeholder="Select department"
                                className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10 cursor-pointer bg-white shadow-sm"
                                onFocus={() => {
                                  setEmployeeDeptSearch('');
                                  setEmployeeDeptOpen(true);
                                }}
                                onClick={() => {
                                  setEmployeeDeptSearch('');
                                  setEmployeeDeptOpen(true);
                                }}
                                onChange={(e) => {
                                  setEmployeeDeptSearch(e.target.value);
                                  setEmployeeDeptOpen(true);
                                }}
                                autoComplete="off"
                              />
                              <ChevronDown
                                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                                onClick={() => {
                                  if (!employeeDeptOpen) {
                                    setEmployeeDeptSearch('');
                                  }
                                  setEmployeeDeptOpen(!employeeDeptOpen);
                                }}
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
                                  .sort((a, b) => {
                                    if (a === field.value) return -1;
                                    if (b === field.value) return 1;
                                    return 0;
                                  })
                                  .map((dept) => {
                                    const selected = field.value === dept;
                                    return (
                                      <div
                                        key={dept}
                                        className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${selected ? 'bg-blue-50 text-blue-700' : ''
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
                                          setEmployeeDeptSearch('');
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
                            <Input {...field} placeholder="e.g., Manager, Developer" className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm" />
                          </FormControl>
                          <FormMessage className="text-red-600 text-sm font-medium mt-1" />
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
                              <SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm">
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
                      <Button type="button" variant="outline" onClick={requestCloseEmployeeDialog} className="border-gray-300 text-gray-700 rounded-lg h-10 px-4">
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
                          : editingEmployee ? 'Update' : 'Create'
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>

          {/* Exit Confirmation Dialog */}
          <AlertDialog open={exitConfirmOpen} onOpenChange={(open) => !open && setExitConfirmOpen(false)}>
            <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Confirm Exit
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-700 font-medium">
                  All filled data will be deleted if you exit. Do you want to cancel or exit?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setExitConfirmOpen(false);
                    exitConfirmActionRef.current = null;
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setExitConfirmOpen(false);
                    const action = exitConfirmActionRef.current;
                    exitConfirmActionRef.current = null;
                    action?.();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white shadow-md px-6 py-2"
                >
                  Exit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Employees List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex-1 min-h-0"
      >
        <div className="rounded-2xl overflow-hidden shadow-md bg-white flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
          <div className="flex-1 overflow-y-auto">
            <Table containerClassName="overflow-visible" className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[200px]">Employee</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[140px]">Role</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[160px]">Department</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Email</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide w-[150px]">Subscriptions</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[130px]">Status</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 pr-6 text-right text-xs font-bold text-white uppercase tracking-wide w-[110px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {[...filteredEmployees].reverse().map((employee, index) => {
                  // Count subscriptions owned by this employee
                  const subscriptionCount = subscriptions.filter((sub: any) =>
                    sub.owner?.toLowerCase() === employee.name?.toLowerCase() ||
                    sub.ownerName?.toLowerCase() === employee.name?.toLowerCase()
                  ).length;

                  return (
                    <motion.tr
                      key={employee._id}
                      className={`border-b border-gray-100 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-indigo-50/40`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.04 * index }}
                    >
                      <TableCell className="px-4 py-3 w-[200px] min-w-0 text-left">
                        <button
                          type="button"
                          onClick={() => handleEdit(employee)}
                          title={employee.name}
                          className="group inline-flex items-center gap-1 max-w-full text-left"
                        >
                          <span className="relative font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors duration-200 truncate max-w-[180px]">
                            {employee.name}
                            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
                          </span>
                          <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">→</span>
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 w-[140px]">{employee.role}</TableCell>
                      <TableCell className="px-4 py-3 w-[160px]">
                        <Badge className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-xs">
                          {employee.department}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{employee.email}</TableCell>
                      <TableCell className="px-4 py-3 text-center w-[150px]">
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
                      </TableCell>
                      <TableCell className="px-4 py-3 w-[130px]">{getStatusBadge(employee.status)}</TableCell>
                      <TableCell className="px-4 pr-6 py-3 text-right w-[110px]">
                        <div className="flex justify-end">
                          {(() => {
                            const rowId = String(employee._id);
                            const isOpen = !!rowId && openActionsMenuForId === rowId;
                            const isAnotherRowOpen = !!openActionsMenuForId && openActionsMenuForId !== rowId;
                            return (
                              <DropdownMenu
                                open={isOpen}
                                onOpenChange={(open) => {
                                  if (!rowId) return;
                                  setOpenActionsMenuForId(open ? rowId : null);
                                }}
                              >
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${isAnotherRowOpen ? "invisible" : ""
                                      }`}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="z-[1000] bg-white text-gray-900 border border-gray-200 shadow-lg"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleEdit(employee)}
                                    className="cursor-pointer"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(employee)}
                                    className="cursor-pointer text-red-600 focus:text-red-600"
                                    disabled={deleteEmployeeMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })()}
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
                </AnimatePresence>

                {filteredEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-gray-400" />
                        <p className="text-sm text-gray-500">No employees found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>

      {/* Import Confirm Dialog */}
      <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
            <AlertDialogDescription>
              Select Yes to choose a file. Select No to download the template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
              onClick={() => {
                downloadEmployeeTemplate();
                setImportConfirmOpen(false);
              }}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                setImportConfirmOpen(false);
                setTimeout(() => fileInputRef.current?.click(), 0);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Employee Subscriptions Modal */}
      <Dialog open={subscriptionModalOpen} onOpenChange={setSubscriptionModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto border-0 shadow-2xl p-0 bg-white">
          {/* Header with Gradient Background */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 ">
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
                        <div className="max-w-[320px]">
                          <div
                            className="font-semibold text-gray-900 text-sm truncate"
                            title={String(sub.serviceName || '')}
                          >
                            {sub.serviceName}
                          </div>
                        </div>
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
        <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
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
                      The employee <span className="font-semibold text-gray-900">"<span className="max-w-[200px] inline-block truncate align-bottom" title={employeeToDelete?.name}>{employeeToDelete?.name}</span>"</span> is linked to <span className="font-semibold text-gray-900">{inUseCount}</span> subscription(s).
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
                    Are you sure you want to delete the employee <span className="font-semibold text-gray-900">"<span className="max-w-[200px] inline-block truncate align-bottom" title={employeeToDelete?.name}>{employeeToDelete?.name}</span>"</span>?
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
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const exitConfirmActionRef = React.useRef<null | (() => void)>(null);
  const [editingUser, setEditingUser] = useState<UserType | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [userDeleteConfirmOpen, setUserDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [openActionsMenuForId, setOpenActionsMenuForId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // User Management Data Management state
  const userFileInputRef = React.useRef<HTMLInputElement>(null);
  const [userImportConfirmOpen, setUserImportConfirmOpen] = useState(false);
  const [userDataManagementSelectKey, setUserDataManagementSelectKey] = useState(0);

  const { data: users, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // User Management Data Management functions
  const downloadUserTemplate = () => {
    const template = [{ name: 'John Doe', email: 'john@example.com', role: 'Admin' }];
    const csv = Papa.unparse(template, { header: true });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'users_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Template Downloaded', description: 'Use this template to import users.' });
  };

  const exportUsers = () => {
    try {
      const exportData = (users || []).length > 0 ? (users || []).map((user: any) => ({
        name: user.name,
        email: user.email,
        role: user.role
      })) : [{
        name: "",
        email: "",
        role: ""
      }];

      const csv = Papa.unparse(exportData, { header: true });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Exported ${(users || []).length} users successfully`,
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export users",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const importUsers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let newUsers;

      if (file.name.endsWith('.csv')) {
        newUsers = await parseCSV(text);
      } else {
        newUsers = JSON.parse(text);
      }

      if (!Array.isArray(newUsers)) {
        throw new Error('Invalid file format. Expected a list of users.');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const user of newUsers) {
        try {
          if (!user.name || !user.email || !user.role) {
            errorCount++;
            continue;
          }

          const userData = {
            name: user.name.trim(),
            email: user.email.trim(),
            role: user.role.trim()
          };

          await apiRequest("POST", "/api/users", userData);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/users"] });

      toast({
        title: successCount > 0 ? "Success" : "Error",
        description: `Imported ${successCount} users. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
        variant: errorCount > 0 ? "destructive" : "default",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import users",
        variant: "destructive",
        duration: 2000,
      });
    }

    if (userFileInputRef.current) {
      userFileInputRef.current.value = '';
    }
  };

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

  const requestExitConfirm = (action: () => void) => {
    exitConfirmActionRef.current = action;
    setExitConfirmOpen(true);
  };

  const closeUserDialogNow = () => {
    setModalOpen(false);
    setShowPassword(false);
    form.reset();
    setEditingUser(undefined);
  };

  const requestCloseUserDialog = () => {
    if (form.formState.isDirty) {
      requestExitConfirm(() => {
        closeUserDialogNow();
      });
      return;
    }
    closeUserDialogNow();
  };

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
    // Trim the data
    const trimmedData = {
      ...data,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase()
    };

    // Check for duplicate email (only if users array is available)
    if (users) {
      const duplicateEmail = users.find(user =>
        user.email.trim().toLowerCase() === trimmedData.email &&
        (!editingUser || user.id !== editingUser.id)
      );
      if (duplicateEmail) {
        toast({
          title: "Error",
          description: "A user with the same email already exists.",
          variant: "destructive",
          duration: 2000,
        });
        return;
      }

      // Check for duplicate name
      const duplicateName = users.find(user =>
        user.name.trim().toLowerCase() === trimmedData.name.toLowerCase() &&
        (!editingUser || user.id !== editingUser.id)
      );
      if (duplicateName) {
        toast({
          title: "Error",
          description: "A user with the same name already exists.",
          variant: "destructive",
          duration: 2000,
        });
        return;
      }
    }

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
      updateMutation.mutate({ id: editingUser.id, data: trimmedData });
    } else {
      createMutation.mutate(trimmedData);
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
      <div className="shrink-0 pb-4 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              className="pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm"
            />
          </div>
          <input
            type="file"
            ref={userFileInputRef}
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={importUsers}
          />
          <Select
            key={userDataManagementSelectKey}
            onValueChange={(value) => {
              if (value === 'export') {
                exportUsers();
              } else if (value === 'import') {
                setUserImportConfirmOpen(true);
              }
              setUserDataManagementSelectKey((k) => k + 1);
            }}
          >
            <SelectTrigger className="w-44 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 font-medium transition-all duration-200">
              <SelectValue placeholder="Import/Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="export" className="cursor-pointer">
                <div className="flex items-center">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </div>
              </SelectItem>
              <SelectItem value="import" className="cursor-pointer">
                <div className="flex items-center">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={modalOpen} onOpenChange={(open) => {
            if (open) {
              setModalOpen(true);
              return;
            }
            requestCloseUserDialog();
          }}>
            <DialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={handleAddNew}
                  className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md rounded-lg h-10 px-4"
                >
                  <UserPlus className="mr-2" size={16} />
                  New User
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl min-w-[600px] max-h-[85vh] overflow-y-auto border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter">
              {/* Header with Gradient Background */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 ">
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
                            <Input placeholder="" {...field} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm" />
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
                              className={`border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm ${fieldState.error ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : ''
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
                                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10 bg-white shadow-sm"
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
                              <SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm">
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
                              <SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm">
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
                      <Button type="button" variant="outline" onClick={requestCloseUserDialog} className="border-gray-300 text-gray-700 rounded-lg h-10 px-4">
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
                          : editingUser ? 'Update' : 'Create'
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>

          {/* Exit Confirmation Dialog */}
          <AlertDialog open={exitConfirmOpen} onOpenChange={(open) => !open && setExitConfirmOpen(false)}>
            <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Confirm Exit
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-700 font-medium">
                  All filled data will be deleted if you exit. Do you want to cancel or exit?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setExitConfirmOpen(false);
                    exitConfirmActionRef.current = null;
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setExitConfirmOpen(false);
                    const action = exitConfirmActionRef.current;
                    exitConfirmActionRef.current = null;
                    action?.();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white shadow-md px-6 py-2"
                >
                  Exit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
        <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
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
        <div className="rounded-2xl overflow-hidden shadow-md bg-white flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
          <div className="flex-1 overflow-y-auto">
            <Table containerClassName="overflow-visible" className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[240px]">User</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Email</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[220px]">Role</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[160px]">Status</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 pr-6 text-right text-xs font-bold text-white uppercase tracking-wide w-[110px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  <AnimatePresence>
                    {[...filteredUsers].reverse().map((user, index) => (
                      <motion.tr
                        key={user.id}
                        className={`border-b border-gray-100 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-indigo-50/40`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.04 * index }}
                      >
                        <TableCell className="px-4 py-3 w-[240px] min-w-0 text-left">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                              <User className="text-indigo-600" size={18} />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              title={user.name}
                              className="group inline-flex items-center gap-1 max-w-full text-left min-w-0"
                            >
                              <span className="relative font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors duration-200 truncate max-w-[170px]">
                                {user.name}
                                <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
                              </span>
                              <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">→</span>
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-600">{user.email}</TableCell>
                        <TableCell className="px-4 py-3 w-[220px]">{getRoleBadge(user.role)}</TableCell>
                        <TableCell className="px-4 py-3 w-[160px]">{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="px-4 pr-6 py-3 text-right w-[110px]">
                          <div className="flex justify-end">
                            {(() => {
                              const rowId = String(user.id);
                              const isOpen = !!rowId && openActionsMenuForId === rowId;
                              const isAnotherRowOpen = !!openActionsMenuForId && openActionsMenuForId !== rowId;
                              return (
                                <DropdownMenu
                                  open={isOpen}
                                  onOpenChange={(open) => {
                                    if (!rowId) return;
                                    setOpenActionsMenuForId(open ? rowId : null);
                                  }}
                                >
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${
                                        isAnotherRowOpen ? 'invisible' : ''
                                      }`}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="z-[1000] bg-white text-gray-900 border border-gray-200 shadow-lg"
                                  >
                                    <DropdownMenuItem onClick={() => handleEdit(user)} className="cursor-pointer">
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(user.id)}
                                      className="cursor-pointer text-red-600 focus:text-red-600"
                                      disabled={deleteMutation.isPending}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );
                            })()}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <UsersIcon className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-base font-medium text-gray-900">No users found</p>
                        <p className="text-gray-500 mt-1 text-sm">Try adjusting your search or add a new user</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>

      {/* User Import Confirm Dialog */}
      <AlertDialog open={userImportConfirmOpen} onOpenChange={setUserImportConfirmOpen}>
        <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
            <AlertDialogDescription>
              Select Yes to choose a file. Select No to download the template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
              onClick={() => {
                downloadUserTemplate();
                setUserImportConfirmOpen(false);
              }}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                setUserImportConfirmOpen(false);
                setTimeout(() => userFileInputRef.current?.click(), 0);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

type CompanySection = "company" | "department" | "employee" | "subscription" | "users";

const COMPANY_SECTIONS: Array<{ key: CompanySection; label: string; icon: React.ElementType }> = [
  { key: "company", label: "Company Information", icon: Building2 },
  { key: "department", label: "Department", icon: Building },
  { key: "employee", label: "Employees", icon: Users },
  { key: "subscription", label: "Subscription Category", icon: Tags },
  { key: "users", label: "User Management", icon: UserCog },
];

function isCompanySection(value: unknown): value is CompanySection {
  return (
    value === "company" ||
    value === "department" ||
    value === "employee" ||
    value === "subscription" ||
    value === "users"
  );
}

function normalizeCompanyTabFromQuery(tabParam: string | null): CompanySection | null {
  if (!tabParam) return null;
  if (tabParam === "subscription-category" || tabParam === "subscription") return "subscription";
  if (isCompanySection(tabParam)) return tabParam;
  return null;
}

function CompanyDetailsLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  if (!tabParam) {
    return <Navigate to="/company-details/company" replace />;
  }

  useEffect(() => {
    const section = normalizeCompanyTabFromQuery(tabParam);
    if (section) {
      navigate(`/company-details/${section}`, { replace: true });
    }
  }, [navigate, tabParam]);

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-[30rem] w-[30rem] rounded-full bg-blue-500/10 blur-3xl" />
      </div>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-10 flex items-center gap-4">
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-semibold text-indigo-950 truncate">Company Details</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {COMPANY_SECTIONS.map((item) => {
              const Icon = item.icon;
              const box = (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(`/company-details/${item.key}`)}
                  className="group relative overflow-hidden text-left rounded-3xl border border-white/60 bg-white/30 backdrop-blur-xl p-8 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:border-indigo-200/70"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-blue-500/15 opacity-100" />
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-br from-white/10 via-white/0 to-white/10" />

                  <div className="relative flex items-center gap-5">
                    <div className="relative h-14 w-14 rounded-2xl bg-white/70 border border-white/70 backdrop-blur-xl shadow-md flex items-center justify-center">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-blue-500/15 opacity-80" />
                      <div className="absolute inset-[1px] rounded-2xl bg-white/70" />
                      <Icon className="relative h-7 w-7 text-indigo-700" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-indigo-950 truncate">{item.label}</div>
                    </div>
                  </div>
                </button>
              );

              return (
                item.key === "users" ? (
                  <Can I="read" a="User" key={item.key} fallback={null}>
                    {box}
                  </Can>
                ) : (
                  box
                )
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyDetailsContent({ section }: { section: CompanySection }) {
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
        variant: "success",
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
  type CategoryKind = 'subscription' | 'compliance' | 'renewal';
  const queryClient = useQueryClient();

  const fetchCategoriesByKind = async (kind: CategoryKind) => {
    // Same-origin API ensures session cookies always apply.
    const res = await fetch(`/api/company/categories?kind=${encodeURIComponent(kind)}`, { credentials: 'include' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({} as any));
      const msg = (json as any)?.message || 'Failed to fetch categories';
      throw new Error(msg);
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? (data as Category[]) : [];
  };

  const DEFAULT_CATEGORIES_BY_KIND: Record<CategoryKind, string[]> = {
    subscription: [],
    compliance: ['Tax', 'Payroll', 'Regulatory', 'Legal', 'Other'],
    renewal: ['Visa', 'E-Pass', 'Govt. License', 'Insurance', 'Contract', 'Agreement', 'Maintenance', 'Others'],
  };

  const normalizeCategoryName = (value: unknown) => String(value ?? '').trim();
  const toCategoryRows = (kind: CategoryKind, fetched: Category[]): Category[] => {
    // IMPORTANT: Company Details -> Categories table should only show categories stored in DB.
    // Defaults are shown in dropdowns elsewhere (Compliance/Govt. License) and should not appear here.
    const defaultNameSet = new Set((DEFAULT_CATEGORIES_BY_KIND[kind] || []).map((n) => n.toLowerCase()));

    const rows = (Array.isArray(fetched) ? fetched : [])
      .map((c) => ({
        name: normalizeCategoryName((c as any)?.name),
        visible: typeof (c as any)?.visible === 'boolean' ? (c as any).visible : true,
      }))
      .filter((c) => c.name)
      .filter((c) => !defaultNameSet.has(c.name.toLowerCase()));

    // De-dupe by name (case-insensitive) while keeping stable order.
    const seen = new Set<string>();
    const unique: Category[] = [];
    for (const c of rows) {
      const key = c.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }
    return unique;
  };

  const {
    data: subscriptionCategories = [],
    isLoading: subscriptionCategoriesLoading,
    refetch: refetchSubscriptionCategories,
  } = useQuery<Category[]>({
    queryKey: ["/api/company/categories", "subscription"],
    queryFn: () => fetchCategoriesByKind('subscription'),
    placeholderData: [],
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: complianceCategories = [],
    isLoading: complianceCategoriesLoading,
    refetch: refetchComplianceCategories,
  } = useQuery<Category[]>({
    queryKey: ["/api/company/categories", "compliance"],
    queryFn: () => fetchCategoriesByKind('compliance'),
    placeholderData: [],
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const {
    data: renewalCategories = [],
    isLoading: renewalCategoriesLoading,
    refetch: refetchRenewalCategories,
  } = useQuery<Category[]>({
    queryKey: ["/api/company/categories", "renewal"],
    queryFn: () => fetchCategoriesByKind('renewal'),
    placeholderData: [],
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const [categoryKind, setCategoryKind] = useState<CategoryKind>('subscription');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [categoryAddOpen, setCategoryAddOpen] = useState(false);
  const [categoryEditOpen, setCategoryEditOpen] = useState(false);
  const [categoryEditingKind, setCategoryEditingKind] = useState<CategoryKind>('subscription');
  const [categoryEditingOldName, setCategoryEditingOldName] = useState('');
  const [categoryEditingNewName, setCategoryEditingNewName] = useState('');
  const [newCategoryNames, setNewCategoryNames] = useState<Record<CategoryKind, string>>({
    subscription: '',
    compliance: '',
    renewal: '',
  });
  const activeNewCategoryName = newCategoryNames[categoryKind];
  const setActiveNewCategoryName = (value: string) =>
    setNewCategoryNames((prev) => ({ ...prev, [categoryKind]: value }));

  const subscriptionCategoryRows = toCategoryRows('subscription', subscriptionCategories);
  const complianceCategoryRows = toCategoryRows('compliance', complianceCategories);
  const renewalCategoryRows = toCategoryRows('renewal', renewalCategories);

  const activeCategoryRows =
    categoryKind === 'subscription'
      ? subscriptionCategoryRows
      : categoryKind === 'compliance'
        ? complianceCategoryRows
        : renewalCategoryRows;

  const filteredActiveCategoryRows = (Array.isArray(activeCategoryRows) ? activeCategoryRows : []).filter((row) => {
    const term = categorySearchTerm.trim().toLowerCase();
    if (!term) return true;
    return String(row?.name || '').toLowerCase().includes(term);
  });

  const categoriesLoading =
    categoryKind === 'subscription'
      ? subscriptionCategoriesLoading
      : categoryKind === 'compliance'
        ? complianceCategoriesLoading
        : renewalCategoriesLoading;

  const refetchActiveCategories = () => {
    if (categoryKind === 'subscription') return refetchSubscriptionCategories();
    if (categoryKind === 'compliance') return refetchComplianceCategories();
    return refetchRenewalCategories();
  };

  const addCategoryMutation = useMutation({
    mutationFn: async (newCategory: { name: string; kind: CategoryKind }) => {
      return await apiRequest("POST", "/api/company/categories", {
        name: newCategory.name,
        visible: true,
        kind: newCategory.kind,
      });
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
      await refetchActiveCategories();
      setNewCategoryNames((prev) => ({ ...prev, [variables.kind]: '' }));
      setCategoryAddOpen(false);
      toast({
        title: "Category Added",
        description: `${variables.name} category has been added successfully`,
        variant: "success",
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

  const renameCategoryMutation = useMutation({
    mutationFn: async (payload: { oldName: string; newName: string; kind: CategoryKind }) => {
      const qs = new URLSearchParams({ kind: payload.kind }).toString();
      return await apiRequest(
        "PUT",
        `/api/company/categories/${encodeURIComponent(payload.oldName)}?${qs}`,
        { name: payload.newName }
      );
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
      await refetchActiveCategories();
      setCategoryEditOpen(false);
      setCategoryEditingOldName('');
      setCategoryEditingNewName('');
      toast({
        title: "Category Updated",
        description: "Category name updated successfully",
        variant: "success",
        duration: 1000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
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
    departmentHead: z.string().optional(),
    email: z.string().optional(),
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
    mutationFn: async (newDepartment: { name: string; departmentHead?: string; email?: string }) => {
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
    mutationFn: async ({ id, data }: { id: string; data: { name: string; departmentHead?: string; email?: string } }) => {
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

  // NOTE: category name state is managed per kind via `newCategoryNames`
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | undefined>();
  const [deptHeadOpen, setDeptHeadOpen] = useState(false);
  const [deptHeadSearch, setDeptHeadSearch] = useState('');
  const deptHeadDropdownRef = useRef<HTMLDivElement>(null);
  const [isDepartmentEmailLocked, setIsDepartmentEmailLocked] = useState(false);
  const [departmentExitConfirmOpen, setDepartmentExitConfirmOpen] = useState(false);
  const departmentExitConfirmActionRef = React.useRef<null | (() => void)>(null);
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [departmentView, setDepartmentView] = useState<'tiles' | 'table'>('tiles');
  const [openDepartmentActionsMenuForKey, setOpenDepartmentActionsMenuForKey] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [deptDeleteOpen, setDeptDeleteOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<any>(null);

  const [categoryDeleteOpen, setCategoryDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [selectedDepartmentForDetails, setSelectedDepartmentForDetails] = useState<string | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedEmployeeSubscriptions, setSelectedEmployeeSubscriptions] = useState<{ employeeName: string; subscriptions: any[] }>({ employeeName: '', subscriptions: [] });
  const { toast } = useToast();

  // File input ref for Excel import
  const companyFileInputRef = React.useRef<HTMLInputElement>(null);
  const [companyImportConfirmOpen, setCompanyImportConfirmOpen] = useState(false);

  // Department tab Data Management
  const departmentFileInputRef = React.useRef<HTMLInputElement>(null);
  const [departmentImportConfirmOpen, setDepartmentImportConfirmOpen] = useState(false);
  const [departmentDataManagementSelectKey, setDepartmentDataManagementSelectKey] = useState(0);

  // Subscription Category tab Data Management
  const categoryFileInputRef = React.useRef<HTMLInputElement>(null);
  const [categoryImportConfirmOpen, setCategoryImportConfirmOpen] = useState(false);
  const [categoryDataManagementSelectKey, setCategoryDataManagementSelectKey] = useState(0);

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

              if (!departmentData.name) {
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
        refetchSubscriptionCategories();

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
    mode: 'onSubmit',
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

  const requestDepartmentExitConfirm = (action: () => void) => {
    departmentExitConfirmActionRef.current = action;
    setDepartmentExitConfirmOpen(true);
  };

  const closeDepartmentDialogNow = () => {
    setDepartmentModalOpen(false);
    setEditingDepartment(undefined);
    departmentForm.reset({
      name: '',
      departmentHead: '',
      email: '',
    });
    setDeptHeadSearch('');
    setDeptHeadOpen(false);
    setIsDepartmentEmailLocked(false);
  };

  const requestCloseDepartmentDialog = () => {
    if (departmentForm.formState.isDirty) {
      requestDepartmentExitConfirm(() => {
        closeDepartmentDialogNow();
      });
      return;
    }
    closeDepartmentDialogNow();
  };

  const handleDepartmentModalOpenChange = (open: boolean) => {
    if (open) {
      setDepartmentModalOpen(true);
      return;
    }
    requestCloseDepartmentDialog();
  };

  // Individual Department Functions
  const downloadDepartmentTemplate = () => {
    const template = [{ 'Department Name': 'IT', 'Department Head': 'John Doe', 'Email': 'john.doe@company.com' }];
    const csv = Papa.unparse(template, { header: true });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'departments_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Template Downloaded', description: 'Use this template to import departments.' });
  };

  const exportDepartments = () => {
    try {
      const exportData = departments.length > 0 ? departments.map(dept => ({
        'Department Name': dept.name,
        'Department Head': dept.departmentHead || '',
        'Email': dept.email || ''
      })) : [{
        'Department Name': "",
        'Department Head': "",
        'Email': ""
      }];

      const csv = Papa.unparse(exportData, { header: true });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `departments_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Exported ${departments.length} departments successfully`,
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export departments",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const importDepartments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let newDepartments;

      if (file.name.endsWith('.csv')) {
        newDepartments = await parseCSV(text);
      } else {
        newDepartments = JSON.parse(text);
      }

      if (!Array.isArray(newDepartments)) {
        throw new Error('Invalid file format. Expected a list of departments.');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const dept of newDepartments) {
        try {
          if (!dept['Department Name']) {
            errorCount++;
            continue;
          }

          const departmentData = {
            name: dept['Department Name'].trim(),
            departmentHead: (dept['Department Head'] || '').trim(),
            email: (dept['Email'] || '').trim(),
            visible: true
          };

          await apiRequest("POST", "/api/company/departments", departmentData);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
      refetchDepartments();

      toast({
        title: successCount > 0 ? "Success" : "Error",
        description: `Imported ${successCount} departments. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
        variant: errorCount > 0 ? "destructive" : "default",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import departments",
        variant: "destructive",
        duration: 2000,
      });
    }

    if (departmentFileInputRef.current) {
      departmentFileInputRef.current.value = '';
    }
  };

  // Individual Subscription Category Functions
  const downloadCategoryTemplate = () => {
    const template = [{ 'Category Name': 'Cloud Services' }];
    const csv = Papa.unparse(template, { header: true });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'categories_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Template Downloaded', description: 'Use this template to import categories.' });
  };

  const exportCategories = (kind: CategoryKind = categoryKind) => {
    try {
      const list =
        kind === 'subscription'
          ? subscriptionCategoryRows
          : kind === 'compliance'
            ? complianceCategoryRows
            : renewalCategoryRows;

      const exportData = list.length > 0 ? list.map(cat => ({
        'Category Name': cat.name
      })) : [{
        'Category Name': ""
      }];

      const csv = Papa.unparse(exportData, { header: true });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `categories_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Exported ${list.length} categories successfully`,
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export categories",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const importCategories = async (event: React.ChangeEvent<HTMLInputElement>, kind: CategoryKind = categoryKind) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let newCategories;

      if (file.name.endsWith('.csv')) {
        newCategories = await parseCSV(text);
      } else {
        newCategories = JSON.parse(text);
      }

      if (!Array.isArray(newCategories)) {
        throw new Error('Invalid file format. Expected a list of categories.');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const cat of newCategories) {
        try {
          if (!cat['Category Name']) {
            errorCount++;
            continue;
          }

          await apiRequest("POST", "/api/company/categories", {
            name: cat['Category Name'].trim(),
            visible: true,
            kind,
          });
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
      refetchActiveCategories();

      toast({
        title: successCount > 0 ? "Success" : "Error",
        description: `Imported ${successCount} categories. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
        variant: errorCount > 0 ? "destructive" : "default",
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import categories",
        variant: "destructive",
        duration: 2000,
      });
    }

    if (categoryFileInputRef.current) {
      categoryFileInputRef.current.value = '';
    }
  };

  const addNewCategory = () => {
    const name = activeNewCategoryName.trim();
    if (!name) return;
    const normalizedNewName = name.toLowerCase();
    const defaultsForKind = (DEFAULT_CATEGORIES_BY_KIND[categoryKind] || []).map((n) => n.toLowerCase());
    const existsInDefaults = defaultsForKind.includes(normalizedNewName);
    const existsInCustom = (Array.isArray(activeCategoryRows) ? activeCategoryRows : []).some(
      (c) => typeof c?.name === 'string' && c.name.trim().toLowerCase() === normalizedNewName
    );
    const exists = existsInDefaults || existsInCustom;
    if (exists) return;
    addCategoryMutation.mutate({ name, kind: categoryKind });
  };

  const openEditCategory = (name: string) => {
    const nextOld = String(name || '').trim();
    if (!nextOld) return;
    setCategoryEditingKind(categoryKind);
    setCategoryEditingOldName(nextOld);
    setCategoryEditingNewName(nextOld);
    setCategoryEditOpen(true);
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
    mutationFn: async (payload: { name: string; kind: CategoryKind }) => {
      const qs = new URLSearchParams({ kind: payload.kind }).toString();
      return await apiRequest(
        "DELETE",
        `/api/company/categories/${encodeURIComponent(payload.name)}?${qs}`
      );
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/company/categories"] });
      }, 300);
      toast({
        title: "Category Deleted",
        description: "Category has been removed.",
        variant: "destructive",
        duration: 1000,
      });
      await refetchActiveCategories();
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

  const navigate = useNavigate();
  const activeTab: CompanySection = section;
  const setActiveTab = (nextTab: string) => {
    if (!isCompanySection(nextTab)) return;
    if (nextTab === section) return;
    navigate(`/company-details/${nextTab}`);
  };

  // Secure URL for all Company Details tabs
  const lastSecuredTabRef = useRef<string | null>(null);

  const setSecureUrlForCompanyDetailsTab = async (tab: string) => {
    const t = String(tab ?? '').trim();
    if (!t) return;

    // Map internal tab values to stable query params
    const tabQuery = t === 'subscription' ? 'subscription' : t;

    try {
      const secureRes = await fetch('/api/secure-link/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: '/company-details',
          query: { tab: tabQuery },
        }),
      });
      if (!secureRes.ok) return;
      const secureData = (await secureRes.json()) as { token?: string };
      const secureToken = String(secureData?.token ?? '').trim();
      if (!secureToken) return;

      window.history.replaceState(window.history.state, '', `/s/${secureToken}`);
    } catch {
      // best-effort only
    }
  };

  useEffect(() => {
    if (!activeTab) return;
    if (lastSecuredTabRef.current === activeTab) return;
    lastSecuredTabRef.current = activeTab;
    void setSecureUrlForCompanyDetailsTab(activeTab);
  }, [activeTab]);

  return (
    <div className="h-full min-h-0 bg-gray-50 font-inter">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 h-full min-h-0">
        {/* Import Confirm Dialog (Company Details Excel) */}
        <AlertDialog open={companyImportConfirmOpen} onOpenChange={setCompanyImportConfirmOpen}>
          <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
            <AlertDialogHeader>
              <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
              <AlertDialogDescription>
                Select Yes to choose a file. Select No to download the template.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                onClick={() => {
                  downloadCombinedTemplate();
                  setCompanyImportConfirmOpen(false);
                }}
              >
                No
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => {
                  setCompanyImportConfirmOpen(false);
                  setTimeout(() => companyFileInputRef.current?.click(), 0);
                }}
              >
                Yes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Exit Confirmation Dialog (Departments) */}
        <AlertDialog open={departmentExitConfirmOpen} onOpenChange={(open) => !open && setDepartmentExitConfirmOpen(false)}>
          <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Confirm Exit
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-700 font-medium">
                All filled data will be deleted if you exit. Do you want to cancel or exit?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDepartmentExitConfirmOpen(false);
                  departmentExitConfirmActionRef.current = null;
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setDepartmentExitConfirmOpen(false);
                  const action = departmentExitConfirmActionRef.current;
                  departmentExitConfirmActionRef.current = null;
                  action?.();
                }}
                className="bg-red-600 hover:bg-red-700 text-white shadow-md px-6 py-2"
              >
                Exit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <input
          ref={companyFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={importCombinedExcel}
        />

        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <TabsContent value="company" className="h-[calc(100vh-136px)] overflow-hidden">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                  >
                    <form onSubmit={handleSubmit} className="h-full flex flex-col gap-4">

                      {/* ── Header Banner ── */}
                      <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-500 rounded-2xl px-8 py-6 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner backdrop-blur-sm">
                            <Building2 className="text-white" size={26} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Company Information</h2>
                          </div>
                        </div>
                      </div>

                      {/* ── All Fields ── */}
                      <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">

                        {/* Company Name */}
                        <div className="space-y-1.5">
                          <Label htmlFor="companyName" className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Company Name</Label>
                          {companyLoading ? <Skeleton className="h-10 w-full" /> : (
                            <Input
                              id="companyName"
                              name="companyName"
                              value={companyInfo.companyName}
                              onChange={handleInputChange}
                              placeholder="e.g. Acme Corporation"
                              className="h-11 text-base border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-gray-900 font-medium transition-all duration-200"
                            />
                          )}
                        </div>

                        {/* Address */}
                        <div className="space-y-1.5">
                          <Label htmlFor="address" className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Address</Label>
                          {companyLoading ? <Skeleton className="h-10 w-full" /> : (
                            <Input
                              id="address"
                              name="address"
                              value={companyInfo.address}
                              onChange={handleInputChange}
                              placeholder="e.g. 123 Main Street, Suite 400"
                              className="h-11 text-base border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-gray-900 font-medium transition-all duration-200"
                            />
                          )}
                        </div>

                        {/* Country */}
                        <div className="space-y-1.5">
                          <Label htmlFor="country" className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Country</Label>
                          {companyLoading ? <Skeleton className="h-10 w-full" /> : (
                            <Input
                              id="country"
                              name="country"
                              value={companyInfo.country}
                              onChange={handleInputChange}
                              placeholder="e.g. India"
                              className="h-11 text-base border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-gray-900 font-medium transition-all duration-200"
                            />
                          )}
                        </div>

                        {/* Financial Year End */}
                        <div className="space-y-1.5">
                          <Label htmlFor="financialYearEnd" className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Financial Year End</Label>
                          {companyLoading ? <Skeleton className="h-10 w-full" /> : (
                            <Input
                              id="financialYearEnd"
                              name="financialYearEnd"
                              type="date"
                              value={companyInfo.financialYearEnd}
                              onChange={handleInputChange}
                              className="h-11 text-base border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-gray-900 font-medium transition-all duration-200"
                            />
                          )}
                        </div>

                        {/* Local Currency */}
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Local Currency</Label>
                          {companyLoading ? <Skeleton className="h-10 w-full" /> : (
                            (() => {
                              const selectedCurrency = companyInfo.defaultCurrency || userData?.defaultCurrency || '';
                              return (
                                <div className="space-y-1.5">
                                  <Select
                                    value={selectedCurrency}
                                    onValueChange={(val) => setCompanyInfo(prev => ({ ...prev, defaultCurrency: val }))}
                                  >
                                    <SelectTrigger className="h-12 text-base border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-gray-900 font-medium transition-all duration-200">
                                      <SelectValue placeholder={currenciesLoading ? 'Loading…' : 'Select currency'} />
                                    </SelectTrigger>
                                    <SelectContent className="dropdown-content">
                                      {selectedCurrency && !currencies.find((c: any) => c.code === selectedCurrency) && (
                                        <SelectItem key={selectedCurrency} value={selectedCurrency} className="dropdown-item">{selectedCurrency}</SelectItem>
                                      )}
                                      {currencies && currencies.length > 0 ? (
                                        currencies.map((curr: any) => (
                                          <SelectItem key={curr.code} value={curr.code} className="dropdown-item">{curr.code}</SelectItem>
                                        ))
                                      ) : (
                                        !selectedCurrency && (
                                          <SelectItem value="no-currency" disabled className="dropdown-item disabled">No currencies configured</SelectItem>
                                        )
                                      )}
                                      <div className="border-t">
                                        <button type="button" className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center" onClick={() => window.location.href = '/configuration?tab=currency'}>
                                          + New
                                        </button>
                                      </div>
                                    </SelectContent>
                                  </Select>
                                  {selectedCurrency && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      Active currency: <span className="font-semibold text-gray-700">{selectedCurrency}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}
                        </div>

                        {/* Save Button — inside the section */}
                        <div className="md:col-span-2 flex justify-end pt-2 border-t border-gray-100">
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              type="submit"
                              disabled={saveCompanyMutation.isPending || companyLoading}
                              className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white font-semibold shadow-lg hover:shadow-indigo-200 py-3 px-10 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                            >
                              <Save className="w-4 h-4" />
                              {saveCompanyMutation.isPending ? "Saving..." : "Save Company Information"}
                            </Button>
                          </motion.div>
                        </div>

                      </div>

                    </form>
                  </motion.div>
                </TabsContent>

                <TabsContent value="department" className="h-[calc(100vh-136px)] overflow-hidden">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="h-full flex flex-col gap-6 pt-4"
                  >
                    {/* Inline Header Row */}
                    <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                      <div className="flex items-center gap-4">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg"
                        >
                          <Shield className="text-white" size={20} />
                        </motion.div>
                        <div>
                          <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">Department Management</h3>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <Input
                                placeholder="Search departments..."
                                value={departmentSearchTerm}
                                onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                                className="pl-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm"
                              />
                            </div>
                            <input
                              type="file"
                              ref={departmentFileInputRef}
                              className="hidden"
                              accept=".csv,.xlsx,.xls"
                              onChange={importDepartments}
                            />
                            <Select
                              key={departmentDataManagementSelectKey}
                              onValueChange={(value) => {
                                if (value === 'export') {
                                  exportDepartments();
                                } else if (value === 'import') {
                                  setDepartmentImportConfirmOpen(true);
                                }
                                setDepartmentDataManagementSelectKey((k) => k + 1);
                              }}
                            >
                              <SelectTrigger className="w-44 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 font-medium transition-all duration-200">
                                <SelectValue placeholder="Import/Export" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="export" className="cursor-pointer">
                                  <div className="flex items-center">
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                  </div>
                                </SelectItem>
                                <SelectItem value="import" className="cursor-pointer">
                                  <div className="flex items-center">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Import
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setDepartmentView((v) => (v === 'tiles' ? 'table' : 'tiles'))}
                              className="border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                              {departmentView === 'tiles' ? 'Table View' : 'Card View'}
                            </Button>

                            <Dialog open={departmentModalOpen} onOpenChange={handleDepartmentModalOpenChange}>
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
                                    New Department
                                  </Button>
                                </motion.div>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl min-w-[600px] max-h-[85vh] overflow-y-auto border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter">
                                {/* Header with Gradient Background */}
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
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
                                                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm"
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
                                                  value={deptHeadOpen ? deptHeadSearch : (field.value || '')}
                                                  placeholder="Select employee"
                                                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10 cursor-pointer bg-white shadow-sm"
                                                  onFocus={() => {
                                                    setDeptHeadSearch('');
                                                    setDeptHeadOpen(true);
                                                  }}
                                                  onClick={() => {
                                                    setDeptHeadSearch('');
                                                    setDeptHeadOpen(true);
                                                  }}
                                                  onChange={(e) => {
                                                    setDeptHeadSearch(e.target.value);
                                                    setDeptHeadOpen(true);
                                                  }}
                                                  autoComplete="off"
                                                />
                                                <ChevronDown
                                                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                                                  onClick={() => {
                                                    if (!deptHeadOpen) {
                                                      setDeptHeadSearch('');
                                                    }
                                                    setDeptHeadOpen(!deptHeadOpen);
                                                  }}
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
                                                    .sort((a: any, b: any) => {
                                                      // Sort selected employee to the top
                                                      const aSelected = field.value === a.name;
                                                      const bSelected = field.value === b.name;
                                                      if (aSelected && !bSelected) return -1;
                                                      if (!aSelected && bSelected) return 1;
                                                      return 0;
                                                    })
                                                    .map((emp: any) => {
                                                      const duplicateNames = employeesData.filter((e: any) => e.name === emp.name);
                                                      const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                                                      const selected = field.value === emp.name;
                                                      return (
                                                        <div
                                                          key={emp._id || emp.id || emp.email}
                                                          className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${selected ? 'bg-blue-50 text-blue-700' : ''
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
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className="text-gray-700 font-medium text-sm">Email Address</FormLabel>
                                            <FormControl>
                                              <Input
                                                {...field}
                                                type="email"
                                                readOnly={isDepartmentEmailLocked}
                                                className={
                                                  isDepartmentEmailLocked
                                                    ? 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-slate-50 cursor-not-allowed shadow-sm'
                                                    : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-white shadow-sm'
                                                }
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
                                          onClick={requestCloseDepartmentDialog}
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
                                            : (editingDepartment ? 'Update ' : 'Create ')
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
                    </div>

                    {/* Department List */}
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col pt-1">
                          {/* <h3 className="text-base font-semibold text-gray-900 mb-4">Available Departments</h3> */}
                          {departmentView === 'table' ? (
                            <div className="mt-6 bg-white border border-gray-200 shadow-md overflow-hidden rounded-xl h-full flex flex-col min-h-0">
                              <div className="flex-1 min-h-0 overflow-auto">
                                <table className="min-w-full table-fixed">
                                  <thead>
                                    <tr className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[220px]">DEPARTMENT</th>
                                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[220px]">HEAD</th>
                                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[240px]">EMAIL</th>
                                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide w-[110px]">EMPLOYEES</th>
                                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide w-[140px]">SUBSCRIPTIONS</th>
                                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-right text-xs font-bold text-white uppercase tracking-wide">ACTIONS</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white">
                                    {departmentsLoading ? (
                                      <tr>
                                        <td colSpan={6} className="py-6 px-4 text-gray-500">Loading departments...</td>
                                      </tr>
                                    ) : (
                                      [...filteredDepartments].reverse().map((department, idx) => {
                                        const displayName = typeof department.name === "string" && department.name.trim() ? department.name : `Unnamed Department ${idx + 1}`;
                                        const empCount = getEmployeeCount(department.name);
                                        const subCount = getSubscriptionCount(department.name);
                                        const rowKey = String(department?.name || displayName || idx);
                                        const isOpen = openDepartmentActionsMenuForKey === rowKey;
                                        const isAnotherRowOpen = !!openDepartmentActionsMenuForKey && openDepartmentActionsMenuForKey !== rowKey;

                                        return (
                                          <tr
                                            key={displayName + idx}
                                          className={`border-b border-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-indigo-50/40`}
                                          >
                                            <td className="px-3 py-3 font-medium text-gray-800 text-sm w-[220px] max-w-[220px] overflow-hidden text-left">
                                              <span className="block truncate whitespace-nowrap" title={String(displayName)}>
                                                {String(displayName)}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3 text-gray-700 text-sm w-[220px] max-w-[220px] overflow-hidden text-left">
                                              <span className="block truncate whitespace-nowrap" title={department.departmentHead || '-'}>
                                                {department.departmentHead || '-'}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3 text-gray-600 text-sm w-[240px] max-w-[240px] overflow-hidden text-left">
                                              <span className="block truncate whitespace-nowrap" title={department.email || '-'}>
                                                {department.email || '-'}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-center w-[110px]">
                                              <button
                                                onClick={() => {
                                                  setSelectedDepartmentForDetails(department.name);
                                                  setDetailsModalOpen(true);
                                                }}
                                                className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm hover:bg-blue-200 transition-colors cursor-pointer"
                                                title="View employees"
                                              >
                                                {empCount}
                                              </button>
                                            </td>
                                            <td className="px-4 py-3 text-center w-[140px]">
                                              <span className="text-sm font-medium text-gray-900">{subCount}</span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                              <DropdownMenu
                                                open={isOpen}
                                                onOpenChange={(open) => setOpenDepartmentActionsMenuForKey(open ? rowKey : null)}
                                              >
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${isAnotherRowOpen ? 'invisible' : ''
                                                      }`}
                                                  >
                                                    <MoreVertical className="h-4 w-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                  align="end"
                                                  className="z-[1000] bg-white text-gray-900 border border-gray-200 shadow-lg"
                                                >
                                                  <DropdownMenuItem
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
                                                    className="cursor-pointer"
                                                  >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
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
                                                    className="cursor-pointer text-red-600 focus:text-red-600"
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-4">
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
                                        whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(99,102,241,0.12)' }}
                                        transition={{ duration: 0.18 }}
                                        className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col"
                                      >
                                        {/* Gradient header */}
                                        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 px-5 py-4 flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                              <Building2 className="text-white" size={17} />
                                            </div>
                                            <span className="text-white font-bold text-base truncate max-w-[140px]">{String(displayName)}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <button
                                              type="button"
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
                                              className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5 h-8 w-8 flex items-center justify-center transition-colors cursor-pointer"
                                              title="Edit Department"
                                            >
                                              <Edit size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (!department.name) return;
                                                setDeptToDelete({ department, displayName, subCount });
                                                setDeptDeleteOpen(true);
                                              }}
                                              disabled={deleteDepartmentMutation.isPending || !department.name}
                                              className="bg-red-500 hover:bg-red-600 text-white rounded-lg p-1.5 h-8 w-8 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                                              title="Delete Department"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Card body */}
                                        <div className="px-5 py-4 flex flex-col gap-3">
                                          {department.departmentHead ? (
                                            <div className="flex items-center gap-2">
                                              <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center flex-shrink-0">
                                                <User size={13} className="text-indigo-500" />
                                              </div>
                                              <span className="text-sm text-gray-600 font-medium truncate">{department.departmentHead}</span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <User size={13} className="text-gray-400" />
                                              </div>
                                              <span className="text-sm text-gray-400 italic">No head assigned</span>
                                            </div>
                                          )}

                                          {/* Employee count */}
                                          <motion.button
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            onClick={() => {
                                              setSelectedDepartmentForDetails(department.name);
                                              setDetailsModalOpen(true);
                                            }}
                                            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer border border-indigo-100 w-full"
                                          >
                                            <Users className="w-4 h-4" />
                                            <span>{empCount} {empCount === 1 ? 'Employee' : 'Employees'}</span>
                                          </motion.button>
                                        </div>
                                      </motion.div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}

                          {/* Department Delete Confirmation Dialog */}
                          <Dialog open={deptDeleteOpen} onOpenChange={(open) => {
                            setDeptDeleteOpen(open);
                            if (!open) setDeptToDelete(null);
                          }}>
                            <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
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
                                <p className="text-gray-700 text-sm leading-relaxed mb-4">
                                  Are you sure you want to delete the department <span className="font-semibold text-gray-900">"{deptToDelete?.displayName}"</span>?
                                </p>
                                <p className="text-gray-600 text-xs leading-relaxed">
                                  This will permanently remove this department from your system.
                                </p>
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
                                  Cancel
                                </Button>
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
                              </div>
                            </DialogContent>
                          </Dialog>
                    </div>

                    {/* Department Details Modal */}
                        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
                          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto border-0 shadow-2xl p-0 bg-white">
                            {/* Header with Gradient Background */}
                            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-6 ">
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
                          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto border-0 shadow-2xl p-0 bg-white">
                            {/* Header with Gradient Background */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 ">
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
                                            <div className="max-w-[320px]">
                                              <div
                                                className="font-semibold text-gray-900 text-sm truncate"
                                                title={String(sub.serviceName || '')}
                                              >
                                                {sub.serviceName}
                                              </div>
                                            </div>
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

                    {/* Department Import Confirm Dialog */}
                        <AlertDialog open={departmentImportConfirmOpen} onOpenChange={setDepartmentImportConfirmOpen}>
                          <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Select Yes to choose a file. Select No to download the template.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel
                                className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                                onClick={() => {
                                  downloadDepartmentTemplate();
                                  setDepartmentImportConfirmOpen(false);
                                }}
                              >
                                No
                              </AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-green-600 text-white hover:bg-green-700"
                                onClick={() => {
                                  setDepartmentImportConfirmOpen(false);
                                  setTimeout(() => departmentFileInputRef.current?.click(), 0);
                                }}
                              >
                                Yes
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                    </AlertDialog>
                  </motion.div>
                </TabsContent>

                <TabsContent value="employee" className="mt-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <EmployeeManagementTab departments={visibleDepartments.map(d => d.name)} />
                  </motion.div>
                </TabsContent>

                <TabsContent value="subscription" className="mt-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-6 pb-6">
                      {/* Clean Header - matching Custom Fields design */}
                      <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200 shrink-0">
                        <div className="flex items-center gap-4">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg"
                          >
                            <Settings className="h-5 w-5 text-white" />
                          </motion.div>
                          <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">Categories</h3>
                        </div>
                      </div>

                      {/* Tabs - matching Custom Fields design */}
                      <div className="space-y-6">
                        <Tabs value={categoryKind} onValueChange={(v) => setCategoryKind(v as CategoryKind)}>
                          <TabsList className="bg-transparent space-x-2 mb-6 p-0 h-auto">
                            <TabsTrigger 
                              value="subscription" 
                              className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-[#6366f1] data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
                            >
                              Subscriptions
                              <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${categoryKind === 'subscription' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {subscriptionCategoryRows.length}
                              </span>
                            </TabsTrigger>
                            <TabsTrigger 
                              value="compliance" 
                              className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-[#6366f1] data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
                            >
                              Compliance
                              <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${categoryKind === 'compliance' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {complianceCategoryRows.length}
                              </span>
                            </TabsTrigger>
                            <TabsTrigger 
                              value="renewal" 
                              className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-[#6366f1] data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
                            >
                              Renewals
                              <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${categoryKind === 'renewal' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {renewalCategoryRows.length}
                              </span>
                            </TabsTrigger>
                          </TabsList>

                          {/* Add New Category Input and Data Management */}
                          <div className="flex flex-wrap items-center gap-4 mb-6">
                            <Input
                              placeholder="Search categories..."
                              value={categorySearchTerm}
                              onChange={(e) => setCategorySearchTerm(e.target.value)}
                              className="w-[420px] max-w-full h-10 text-sm"
                            />
                            <input
                              type="file"
                              ref={categoryFileInputRef}
                              className="hidden"
                              accept=".csv,.xlsx,.xls"
                              onChange={importCategories}
                            />
                            <Select
                              key={categoryDataManagementSelectKey}
                              onValueChange={(value) => {
                                if (value === 'export') {
                                  exportCategories(categoryKind);
                                } else if (value === 'import') {
                                  setCategoryImportConfirmOpen(true);
                                }
                                setCategoryDataManagementSelectKey((k) => k + 1);
                              }}
                            >
                              <SelectTrigger className="w-44 h-10 text-sm">
                                <SelectValue placeholder="Import/Export" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="export" className="cursor-pointer">
                                  <div className="flex items-center">
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                  </div>
                                </SelectItem>
                                <SelectItem value="import" className="cursor-pointer">
                                  <div className="flex items-center">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Import
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>

                            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                              <Button
                                onClick={() => {
                                  setActiveNewCategoryName('');
                                  setCategoryAddOpen(true);
                                }}
                                className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                New Category
                              </Button>
                            </motion.div>
                          </div>

                          {/* Category List - matching Custom Fields table design */}
                          <Card className="bg-white border border-gray-200 shadow-md overflow-hidden rounded-2xl hover:shadow-lg transition-shadow">
                            <div className="p-0">
                              <Table
                                key={categoryKind}
                                containerClassName="max-h-[360px] overflow-y-auto custom-scrollbar"
                                className="w-full"
                              >
                                <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                                  <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                                    <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-6 text-left text-xs font-bold text-white uppercase tracking-wide">Category Name</TableHead>
                                    <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-6 text-right text-xs font-bold text-white uppercase tracking-wide w-[140px]">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {categoriesLoading ? (
                                    <TableRow>
                                      <TableCell colSpan={2} className="h-48 text-center text-gray-400">Loading categories...</TableCell>
                                    </TableRow>
                                  ) : filteredActiveCategoryRows.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={2} className="h-48">
                                        <div className="flex flex-col items-center justify-center text-center text-gray-500">
                                          <Settings className="h-10 w-10 text-gray-300 mb-3" />
                                          <p className="font-medium text-gray-900">No categories found</p>
                                          <p className="text-sm mt-1">Try a different search or add a new category</p>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    <AnimatePresence initial={false}>
                                      {filteredActiveCategoryRows.map((category, idx) => {
                                        const displayName =
                                          typeof category.name === 'string' && category.name.trim()
                                            ? category.name
                                            : `Unnamed Category ${idx + 1}`;
                                        const subCount =
                                          categoryKind === 'subscription' && category.name
                                            ? getCategorySubscriptions(category.name).length
                                            : 0;

                                        return (
                                          <motion.tr
                                            key={`${categoryKind}:${String(displayName).toLowerCase()}:${idx}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.2 }}
                                            className="group border-b border-gray-100 hover:bg-indigo-50/50 transition-colors"
                                          >
                                            <TableCell className="px-6 py-4 font-medium text-gray-900">
                                              <div className="break-words pr-2">{String(displayName)}</div>
                                            </TableCell>
                                            <TableCell className="px-6 py-4 text-right w-[140px]">
                                              <div className="inline-flex items-center justify-end gap-1">
                                                <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                      if (!category.name) return;
                                                      openEditCategory(category.name);
                                                    }}
                                                    disabled={!category.name}
                                                    className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg p-2 h-8 w-8"
                                                    title="Edit Category"
                                                  >
                                                    <Edit size={16} />
                                                  </Button>
                                                </motion.div>

                                                <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                      if (!category.name) return;
                                                      setCategoryToDelete({
                                                        kind: categoryKind,
                                                        category,
                                                        displayName,
                                                        subCount,
                                                      });
                                                      setCategoryDeleteOpen(true);
                                                    }}
                                                    disabled={deleteCategoryMutation.isPending || !category.name}
                                                    className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg p-2 h-8 w-8"
                                                    title="Delete Category"
                                                  >
                                                    <Trash2 size={16} />
                                                  </Button>
                                                </motion.div>
                                              </div>
                                            </TableCell>
                                          </motion.tr>
                                        );
                                      })}
                                    </AnimatePresence>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </Card>
                        </Tabs>
                      </div>

                      {/* Category Add Dialog */}
                      <Dialog open={categoryAddOpen} onOpenChange={(open) => {
                        setCategoryAddOpen(open);
                        if (!open) setActiveNewCategoryName('');
                      }}>
                        <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
                          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                            <DialogHeader>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                                  <Plus className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <DialogTitle className="text-xl font-bold tracking-tight text-white">
                                    New Category
                                  </DialogTitle>
                                  <p className="text-indigo-100 mt-0.5 text-sm font-medium">Adds to the {categoryKind} list</p>
                                </div>
                              </div>
                            </DialogHeader>
                          </div>
                          <div className="px-6 py-5 space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">Category name</Label>
                              <Input
                                value={activeNewCategoryName}
                                onChange={(e) => setActiveNewCategoryName(e.target.value)}
                                placeholder="Type a category name"
                                className="h-10"
                                onKeyDown={(e) => e.key === 'Enter' && addNewCategory()}
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setCategoryAddOpen(false)}
                                className="h-10"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={addNewCategory}
                                disabled={!activeNewCategoryName.trim() || addCategoryMutation.isPending}
                                className="h-10 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white"
                              >
                                {addCategoryMutation.isPending ? "Adding..." : "Add"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Category Edit Dialog */}
                      <Dialog open={categoryEditOpen} onOpenChange={(open) => {
                        setCategoryEditOpen(open);
                        if (!open) {
                          setCategoryEditingOldName('');
                          setCategoryEditingNewName('');
                        }
                      }}>
                        <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
                          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                            <DialogHeader>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                                  <Edit className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <DialogTitle className="text-xl font-bold tracking-tight text-white">
                                    Edit Category
                                  </DialogTitle>
                                  <p className="text-indigo-100 mt-0.5 text-sm font-medium">Renames linked {categoryEditingKind} records</p>
                                </div>
                              </div>
                            </DialogHeader>
                          </div>
                          <div className="px-6 py-5 space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">New name</Label>
                              <Input
                                value={categoryEditingNewName}
                                onChange={(e) => setCategoryEditingNewName(e.target.value)}
                                placeholder="Type a new name"
                                className="h-10"
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  const next = categoryEditingNewName.trim();
                                  if (!next) return;
                                  renameCategoryMutation.mutate({
                                    oldName: categoryEditingOldName,
                                    newName: next,
                                    kind: categoryEditingKind,
                                  });
                                }}
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setCategoryEditOpen(false)}
                                className="h-10"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={() => {
                                  const next = categoryEditingNewName.trim();
                                  if (!next) return;
                                  renameCategoryMutation.mutate({
                                    oldName: categoryEditingOldName,
                                    newName: next,
                                    kind: categoryEditingKind,
                                  });
                                }}
                                disabled={
                                  renameCategoryMutation.isPending ||
                                  !categoryEditingOldName.trim() ||
                                  !categoryEditingNewName.trim() ||
                                  categoryEditingOldName.trim().toLowerCase() === categoryEditingNewName.trim().toLowerCase()
                                }
                                className="h-10 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white"
                              >
                                {renameCategoryMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Category Import Confirm Dialog */}
                      <AlertDialog open={categoryImportConfirmOpen} onOpenChange={setCategoryImportConfirmOpen}>
                        <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Select Yes to choose a file. Select No to download the template.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                              onClick={() => {
                                downloadCategoryTemplate();
                                setCategoryImportConfirmOpen(false);
                              }}
                            >
                              No
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-green-600 text-white hover:bg-green-700"
                              onClick={() => {
                                setCategoryImportConfirmOpen(false);
                                setTimeout(() => categoryFileInputRef.current?.click(), 0);
                              }}
                            >
                              Yes
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </motion.div>
                </TabsContent>

                {/* Category Delete Confirmation Dialog */}
                <Dialog open={categoryDeleteOpen} onOpenChange={(open) => {
                  setCategoryDeleteOpen(open);
                  if (!open) setCategoryToDelete(null);
                }}>
                  <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
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
                      {categoryToDelete?.kind === 'subscription' && categoryToDelete?.subCount > 0 ? (
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
                        {categoryToDelete?.kind === 'subscription' && categoryToDelete?.subCount > 0 ? 'OK' : 'Cancel'}
                      </Button>
                      {categoryToDelete?.kind === 'subscription' && categoryToDelete?.subCount > 0 ? null : (
                        <Button
                          type="button"
                          onClick={() => {
                            const name = categoryToDelete?.category?.name;
                            if (name) {
                              deleteCategoryMutation.mutate({
                                name,
                                kind: (categoryToDelete?.kind as any) || categoryKind,
                              });
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

                <Can I="read" a="User" fallback={null}>
                  <TabsContent value="users" className="mt-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <UserManagementTab />
                    </motion.div>
                  </TabsContent>
                </Can>
              </AnimatePresence>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function CompanyDetails() {
  const { section } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Backward-compatible deep links: /company-details?tab=department
  useEffect(() => {
    if (location.pathname !== "/company-details") return;
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    const normalized = normalizeCompanyTabFromQuery(tabParam);
    if (normalized) {
      navigate(`/company-details/${normalized}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  if (!section || !isCompanySection(section)) {
    return <CompanyDetailsLanding />;
  }

  return <CompanyDetailsContent section={section} />;
}
