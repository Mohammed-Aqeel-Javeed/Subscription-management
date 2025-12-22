import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Can } from "@/components/Can";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { CalendarIcon, Edit, Trash2, Plus, Search, Shield, ShieldCheck, CheckCircle, Clock, AlertCircle, RefreshCw, Maximize2, Minimize2, Building, Calendar, MapPin, DollarSign, User, Mail, Phone, FileText, Filter, Download, Building2, Upload, X } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../hooks/use-toast";
import { z } from "zod";
import { API_BASE_URL } from "@/lib/config";
import { Checkbox } from "../components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import Papa from 'papaparse';
import { apiRequest } from "@/lib/queryClient";

// Predefined Issuing Authorities (ordered to match provided screenshot)
const ISSUING_AUTHORITIES = [
  "Government Electronic Business (GeBIZ)",
  "Ministry of Manpower (MOM) Employment Pass (EP) Online",
  "Accounting and Corporate Regulatory Authority (ACRA)",
  "Enterprise Singapore (via GoBusiness Licensing)",
  "Singapore Civil Defence Force (SCDF)",
  "National Environment Agency (NEA)",
  "Singapore Police Force (SPF)",
  "Building and Construction Authority (BCA)",
  "Singapore Food Agency (SFA)",
];

// Define the Department interface
interface Department {
  name: string;
  visible: boolean;
}

// License interface
interface License {
  id: string;
  licenseName: string;
  issuingAuthorityName: string;
  startDate: string;
  endDate: string;
  details: string;
  renewalFee: number;
  renewalCycleTime?: string;
  responsiblePerson: string;
  department: string;
  backupContact: string;
  status: 'Active' | 'Pending' | 'Expired' | 'Under Renewal' | 'Draft';
  issuingAuthorityEmail: string;
  issuingAuthorityPhone: string;
  reminderDays?: number | string;
  reminderPolicy?: string;
  // New submission fields
  renewalStatus?: string;
  renewalSubmittedDate?: string;
  expectedCompletedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Form schema (all fields optional - no mandatory validation)
const licenseSchema = z.object({
  licenseName: z.string().optional(),
  issuingAuthorityName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  details: z.string().optional(),
  renewalFee: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(Number(num)) ? undefined : Number(num);
  }, z.number().optional()),
  renewalCycleTime: z.string().optional(),
  responsiblePerson: z.string().optional(),
  department: z.string().optional(),
  departments: z.array(z.string()).optional(),
  backupContact: z.string().optional(),
  status: z.enum(['Active', 'Pending', 'Expired', 'Under Renewal', 'Draft']).optional(),
  renewalStatus: z.enum(['not_started', 'in_progress', 'submitted', 'approved', 'rejected']).optional(),
  issuingAuthorityEmail: z.string().optional(),
  issuingAuthorityPhone: z.string().optional(),
  renewalSubmittedDate: z.string().optional(),
  expectedCompletedDate: z.string().optional(),
  submissionNotes: z.string().optional(),
  reminderDays: z.union([z.string(), z.number()]).optional(),
  reminderPolicy: z.string().optional(),
});

type LicenseFormData = z.infer<typeof licenseSchema>;

export default function GovernmentLicense() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Modal header status pill
  const [headerStatus, setHeaderStatus] = useState<'Inactive' | 'Active'>("Inactive");
  // Submission details view state
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  
  // Dropdown open state for issuing authority
  const [isIssuingAuthorityOpen, setIsIssuingAuthorityOpen] = useState(false);
  
  // Department management state
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [departmentModal, setDepartmentModal] = useState<{show: boolean}>({show: false});
  const [departmentSelectOpen, setDepartmentSelectOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState<string>('');
  const [newDepartmentHead, setNewDepartmentHead] = useState<string>('');
  const [newDepartmentEmail, setNewDepartmentEmail] = useState<string>('');
  
  // Notes management state (card-based like subscription modal)
  const [notes, setNotes] = useState<Array<{id: string, text: string, createdAt: string, createdBy: string}>>([]);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showViewNoteDialog, setShowViewNoteDialog] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{id: string, text: string, createdAt: string, createdBy: string} | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  
  // Get current user name for notes (same logic as subscription modal)
  const [currentUserName, setCurrentUserName] = useState<string>('');
  
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const loggedInUser = (window as any).user;
        if (loggedInUser?.name) {
          setCurrentUserName(loggedInUser.name);
          return;
        }
        
        try {
          const meResponse = await fetch('/api/me', {
            method: 'GET',
            credentials: 'include',
          });
          if (meResponse.ok) {
            const meData = await meResponse.json();
            if (meData.fullName) {
              setCurrentUserName(meData.fullName);
              return;
            } else if (meData.name) {
              setCurrentUserName(meData.name);
              return;
            }
          }
        } catch (meError) {
          // /api/me not available
        }
        
        const userEmail = loggedInUser?.email;
        if (userEmail) {
          const response = await fetch('/api/employees', {
            method: 'GET',
            credentials: 'include',
          });
          if (response.ok) {
            const users = await response.json();
            const currentUser = users.find((u: any) => u.email?.toLowerCase() === userEmail.toLowerCase());
            if (currentUser && currentUser.name) {
              setCurrentUserName(currentUser.name);
              return;
            }
          }
          
          try {
            const usersResponse = await fetch('/api/users', {
              method: 'GET',
              credentials: 'include',
            });
            if (usersResponse.ok) {
              const allUsers = await usersResponse.json();
              const loginUser = allUsers.find((u: any) => u.email?.toLowerCase() === userEmail.toLowerCase());
              if (loginUser && loginUser.name) {
                setCurrentUserName(loginUser.name);
                return;
              }
            }
          } catch (usersError) {
            // /api/users not available
          }
          
          const fallbackName = userEmail.split('@')[0];
          const capitalizedName = fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);
          setCurrentUserName(capitalizedName);
        } else {
          setCurrentUserName('User');
        }
      } catch (error) {
        console.error('Failed to fetch current user:', error);
        const userEmail = (window as any).user?.email;
        if (userEmail) {
          setCurrentUserName(userEmail.split('@')[0]);
        } else {
          setCurrentUserName('Unknown User');
        }
      }
    };
    fetchCurrentUser();
  }, []);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isIssuingAuthorityOpen && !target.closest('.issuing-authority-dropdown')) {
        setIsIssuingAuthorityOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isIssuingAuthorityOpen]);

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      licenseName: "",
      issuingAuthorityName: "",
      startDate: "",
      endDate: "",
      details: "",
      renewalFee: undefined, // Show empty by default
      responsiblePerson: "",
      department: "",
      backupContact: "",
      status: "Active",
      issuingAuthorityEmail: "",
      issuingAuthorityPhone: "",
    },
  });

  // Fetch licenses
  const { data: licenses = [], isLoading, error } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/licenses`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return res.json();
    },
  });

  // Query for departments
  const { data: departments, isLoading: departmentsLoading, refetch: refetchDepartments } = useQuery<Department[]>({
    queryKey: ["/api/company/departments"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/company/departments`, { credentials: "include" });
      return res.json();
    }
  });

  // Query for employees (owners)
  const { data: employeesRaw = [] } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/employees`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // State for license name validation
  const [licenseNameError, setLicenseNameError] = useState<string>("");
  
  // Extract existing license names for validation (excluding current license if editing)
  const existingLicenseNames = licenses
    .filter((license: License) => editingLicense ? license.id !== editingLicense.id : true)
    .map((license: License) => license.licenseName?.toLowerCase().trim())
    .filter(Boolean);
  
  // Function to validate license name uniqueness
  const validateLicenseName = (name: string) => {
    if (!name?.trim()) {
      setLicenseNameError("");
      return true;
    }
    
    const normalizedName = name.toLowerCase().trim();
    const isDuplicate = existingLicenseNames.includes(normalizedName);
    
    if (isDuplicate) {
      setLicenseNameError("License name already exists");
      return false;
    }
    
    setLicenseNameError("");
    return true;
  };

  // Parse departments from license if it exists
  const parseDepartments = (deptString?: string) => {
    if (!deptString) return [];
    try {
      const parsed = JSON.parse(deptString);
      return Array.isArray(parsed) ? parsed : [deptString];
    } catch {
      // If parsing fails, treat as a single department
      return [deptString];
    }
  };

  // Handle department selection
  const handleDepartmentChange = (departmentName: string, checked: boolean) => {
    // If Company Level is selected, select all departments
    if (departmentName === 'Company Level' && checked) {
      const allDepts = ['Company Level', ...(departments?.filter(d => d.visible).map(d => d.name) || [])];
      setSelectedDepartments(allDepts);
      form.setValue("departments", allDepts);
      form.setValue("department", JSON.stringify(allDepts));
      return;
    }
    
    // If unchecking Company Level, uncheck all
    if (departmentName === 'Company Level' && !checked) {
      setSelectedDepartments([]);
      form.setValue("departments", []);
      form.setValue("department", JSON.stringify([]));
      return;
    }
    
    // Cannot uncheck individual departments when Company Level is selected
    if (selectedDepartments.includes('Company Level') && !checked) {
      return;
    }
    
    const newSelectedDepartments = checked
      ? [...selectedDepartments, departmentName]
      : selectedDepartments.filter(dept => dept !== departmentName);
    
    setSelectedDepartments(newSelectedDepartments);
    form.setValue("departments", newSelectedDepartments);
    form.setValue("department", JSON.stringify(newSelectedDepartments));
  };

  // Remove department
  const removeDepartment = (departmentName: string) => {
    // If removing Company Level, remove all
    if (departmentName === 'Company Level') {
      setSelectedDepartments([]);
      form.setValue("departments", []);
      form.setValue("department", JSON.stringify([]));
      return;
    }
    
    // Cannot remove individual departments when Company Level is selected
    if (selectedDepartments.includes('Company Level')) {
      return;
    }
    
    const newSelectedDepartments = selectedDepartments.filter(dept => dept !== departmentName);
    setSelectedDepartments(newSelectedDepartments);
    form.setValue("departments", newSelectedDepartments);
    form.setValue("department", JSON.stringify(newSelectedDepartments));
  };
  
  // Handle adding new department
  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) return;
    
    try {
      await apiRequest(
        "POST",
        "/api/company/departments",
        { 
          name: newDepartmentName.trim(),
          departmentHead: newDepartmentHead.trim(),
          email: newDepartmentEmail.trim()
        }
      );
      await queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });
      const updatedDepartments = [...selectedDepartments, newDepartmentName.trim()];
      setSelectedDepartments(updatedDepartments);
      form.setValue('departments', updatedDepartments);
      form.setValue('department', JSON.stringify(updatedDepartments));
      setNewDepartmentName('');
      setNewDepartmentHead('');
      setNewDepartmentEmail('');
      setDepartmentModal({ show: false });
      toast({ title: "Department added successfully" });
    } catch (error) {
      console.error('Error adding department:', error);
      toast({ title: "Failed to add department", variant: "destructive" });
    }
  };

  // Create/Update license mutation
  const licenseMutation = useMutation({
    mutationFn: async (data: LicenseFormData) => {
      const url = editingLicense 
        ? `${API_BASE_URL}/api/licenses/${editingLicense.id}`
        : `${API_BASE_URL}/api/licenses`;
      
      const res = await fetch(url, {
        method: editingLicense ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to save license");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "Success",
        description: `License ${editingLicense ? 'updated' : 'created'} successfully`,
      });
      setHeaderStatus('Active');
      setIsModalOpen(false);
      setEditingLicense(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save license",
        variant: "destructive",
      });
    },
  });

  // Draft mutation for saving license as draft
  const draftMutation = useMutation({
    mutationFn: async (data: LicenseFormData) => {
      const url = editingLicense 
        ? `${API_BASE_URL}/api/licenses/${editingLicense.id}`
        : `${API_BASE_URL}/api/licenses`;
      
      const draftData = {
        ...data,
        status: 'Draft', // Always save drafts as Draft status
        departments: selectedDepartments,
        department: JSON.stringify(selectedDepartments),
      };
      
      const res = await fetch(url, {
        method: editingLicense ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(draftData),
      });
      
      if (!res.ok) throw new Error("Failed to save draft");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "Draft saved",
        description: "License saved as draft successfully.",
      });
      setIsModalOpen(false);
      setEditingLicense(null);
      setSelectedDepartments([]);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    },
  });

  // Delete license mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/api/licenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete license");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      toast({
        title: "Success",
        description: "License deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete license",
        variant: "destructive",
      });
    },
  });

  // EXPORT current (filtered) licenses to CSV
  const handleExport = () => {
    if (!filteredLicenses.length) {
      toast({ title: 'No data', description: 'There are no licenses to export', variant: 'destructive'});
      return;
    }
    const rows = filteredLicenses.map(license => ({
      LicenseName: license.licenseName,
      IssuingAuthority: license.issuingAuthorityName,
      StartDate: license.startDate ? new Date(license.startDate).toISOString().split('T')[0] : '',
      EndDate: license.endDate ? new Date(license.endDate).toISOString().split('T')[0] : '',
      RenewalFee: license.renewalFee || 0,
      ResponsiblePerson: license.responsiblePerson,
      Department: license.department,
      BackupContact: license.backupContact,
      Status: license.status,
      IssuingAuthorityEmail: license.issuingAuthorityEmail || '',
      IssuingAuthorityPhone: license.issuingAuthorityPhone || '',
      Details: license.details || ''
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `licenses_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Licenses exported to CSV' });
  };

  const triggerImport = () => fileInputRef.current?.click();

  // IMPORT from CSV -> create licenses
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows: any[] = results.data as any[];
        if (!rows.length) {
          toast({ title: 'Empty file', description: 'No rows found in file', variant: 'destructive'});
          return;
        }
        let success = 0; let failed = 0;
        for (const row of rows) {
          try {
            const payload: any = {
              licenseName: row.LicenseName || row.licenseName || '',
              issuingAuthorityName: row.IssuingAuthority || row.issuingAuthorityName || '',
              startDate: row.StartDate || row.startDate || new Date().toISOString().split('T')[0],
              endDate: row.EndDate || row.endDate || new Date().toISOString().split('T')[0],
              renewalFee: parseFloat(row.RenewalFee) || 0,
              responsiblePerson: row.ResponsiblePerson || row.responsiblePerson || '',
              department: row.Department || row.department || '',
              backupContact: row.BackupContact || row.backupContact || '',
              status: row.Status || row.status || 'Draft',
              issuingAuthorityEmail: row.IssuingAuthorityEmail || row.issuingAuthorityEmail || '',
              issuingAuthorityPhone: row.IssuingAuthorityPhone || row.issuingAuthorityPhone || '',
              details: row.Details || row.details || ''
            };
            // Basic validation
            if (!payload.licenseName) { failed++; continue; }
            await apiRequest('POST', '/api/licenses', payload);
            success++;
          } catch (err) {
            failed++;
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
        toast({ title: 'Import finished', description: `Imported ${success} license(s). Failed: ${failed}` });
        e.target.value = '';
      },
      error: () => {
        toast({ title: 'Import error', description: 'Failed to parse file', variant: 'destructive'});
      }
    });
  };

  // Filter licenses based on search and status
  const filteredLicenses = licenses.filter((license) => {
    const q = (searchTerm || "").toLowerCase();
    const matchesSearch = 
      (license.licenseName || "").toLowerCase().includes(q) ||
      (license.issuingAuthorityName || "").toLowerCase().includes(q) ||
      (license.responsiblePerson || "").toLowerCase().includes(q) ||
      (license.department || "").toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || license.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handle form submission
  const onSubmit = (data: LicenseFormData) => {
    // Check for license name validation errors
    if (licenseNameError) {
      toast({
        title: "Validation Error",
        description: "Please fix the license name error before submitting",
        variant: "destructive",
      });
      return;
    }
    
    // Validate license name uniqueness one more time before submission
    if (data.licenseName && !validateLicenseName(data.licenseName)) {
      return;
    }
    
    // Include selected departments in the submission
    const submissionData = {
      ...data,
      departments: selectedDepartments,
      department: JSON.stringify(selectedDepartments),
    };
    
    licenseMutation.mutate(submissionData);
  };

  // Handle save draft function
  const handleSaveDraft = async () => {
    // Get current form data
    const formData = form.getValues();
    
    // Check if license name exists for draft (basic validation)
    if (!formData.licenseName?.trim()) {
      toast({
        title: "Validation Error",
        description: "License name is required to save as draft",
        variant: "destructive",
      });
      return;
    }
    
    // Validate license name uniqueness
    if (formData.licenseName && !validateLicenseName(formData.licenseName)) {
      return;
    }
    
    // Save as draft
    draftMutation.mutate(formData);
  };

  // Handle edit
  const handleEdit = (license: License) => {
    setEditingLicense(license);
    const depts = parseDepartments(license.department);
    const firstDept = depts.length > 0 ? depts[0] : '';
    setSelectedDepartments(depts);
    form.reset({
      licenseName: license.licenseName || "",
      issuingAuthorityName: license.issuingAuthorityName || "",
      startDate: license.startDate || "",
      endDate: license.endDate || "",
      details: license.details || "",
      renewalFee: typeof license.renewalFee === 'number' ? license.renewalFee : undefined,
      renewalCycleTime: license.renewalCycleTime || "",
      responsiblePerson: license.responsiblePerson || "",
      department: firstDept,
      departments: depts,
      backupContact: license.backupContact || "",
      status: (license.status as any) || 'Active',
      issuingAuthorityEmail: license.issuingAuthorityEmail || "",
      issuingAuthorityPhone: license.issuingAuthorityPhone || "",
      reminderDays: license.reminderDays || "",
      reminderPolicy: license.reminderPolicy || "",
      renewalStatus: (license.renewalStatus as "not_started" | "in_progress" | "submitted" | "approved" | "rejected" | undefined) || undefined,
      renewalSubmittedDate: license.renewalSubmittedDate || "",
      expectedCompletedDate: license.expectedCompletedDate || "",
    });
    setHeaderStatus('Active');
    setIsModalOpen(true);
  };

  // Handle add new
  const handleAddNew = () => {
  setEditingLicense(null);
  setSelectedDepartments([]);
  form.reset();
  setHeaderStatus('Inactive');
  setIsModalOpen(true);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this license?")) {
      deleteMutation.mutate(id);
    }
  };

  // Status badge component - exactly matching Subscriptions page
  const getStatusClassName = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "Pending":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200";
      case "Draft":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "Expired":
        return "bg-rose-100 text-rose-800 border border-rose-200";
      case "Under Renewal":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  // (date formatting handled inline where needed)

  // Summary stats similar to subscriptions
  const total = licenses.length;
  const active = licenses.filter(l => l.status === 'Active').length;
  // const expiringSoon = licenses.filter(l => {
  //   const end = new Date(l.endDate).getTime();
  //   const now = Date.now();
  //   const diff = end - now;
  //   return diff > 0 && diff < 1000 * 60 * 60 * 24 * 30; // within 30 days
  // }).length; // Future enhancement: show expiring soon card

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Modern Professional Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Government License Management</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Can I="create" a="License">
                <Button
                  onClick={handleAddNew}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add License
                </Button>
              </Can>
            </div>
          </div>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-100">Total Licenses</p>
                  <p className="text-2xl font-bold text-white mt-1">{total}</p>
                </div>
                <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-100">Active Licenses</p>
                  <p className="text-2xl font-bold text-white mt-1">{active}</p>
                </div>
                <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-100">Data Management</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-medium text-xs px-3 py-1 h-7"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={triggerImport}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-medium text-xs px-3 py-1 h-7"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Import
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="mb-6 border-slate-200 shadow-md rounded-xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="Search licenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg h-10"
                />
              </div>
              {/* Status Filter */}
              <div className="w-full sm:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Under Renewal">Under Renewal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Card className="border-slate-200 shadow-lg rounded-2xl overflow-hidden">
          <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Shield className="w-12 h-12 text-indigo-500" />
                  </motion.div>
                  <p className="text-slate-600 mt-4">Loading licenses...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-rose-50 rounded-full p-4 mb-4">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                  </div>
                  <p className="text-rose-500 font-medium text-lg">Failed to load licenses</p>
                  <p className="text-slate-500 mt-2">Please try again later</p>
                </div>
              ) : filteredLicenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-slate-100 rounded-full p-5 mb-5">
                    <Shield className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-medium text-slate-800 mb-2">
                    {searchTerm || statusFilter !== "all" ? "No matching licenses found" : "No licenses found"}
                  </h3>
                  <p className="text-slate-600 max-w-md text-center">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search or filter criteria" 
                      : "Get started by adding your first government license"
                    }
                  </p>
                  {/* Add First License button removed as requested */}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">License Name</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Issuing Authority</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Start Date</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">End Date</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Department</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Submission</TableHead>
                        <TableHead className="h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">Renewal Fee</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Status</TableHead>
                        <TableHead className="h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredLicenses.map((license, index) => (
                          <motion.tr 
                            key={license.id}
                            className="hover:bg-slate-50 transition-colors"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: 0.05 * index }}
                          >
                            <TableCell className="px-4 py-3 font-medium text-gray-800">
                              {license.licenseName}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm text-gray-700">
                              <div>
                                <div className="font-medium">{license.issuingAuthorityName}</div>
                                {/* Removed email and phone display as per requirements */}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {license.startDate ? new Date(license.startDate).toLocaleDateString('en-GB') : ''}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {license.endDate ? new Date(license.endDate).toLocaleDateString('en-GB') : ''}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-sm text-gray-700">
                              <div className="flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                <div className="flex flex-wrap gap-1">
                                  {(() => {
                                    const depts = parseDepartments(license.department);
                                    return depts.length > 0 ? (
                                      depts.map((dept, index) => (
                                        <Badge key={index} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                                          {dept}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-gray-500">-</span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                title="Submit now"
                                onClick={() => {
                                  setEditingLicense(license);
                                  setShowSubmissionDetails(true);
                                  setIsModalOpen(true);
                                }}
                                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 hover:text-green-800 font-medium text-sm px-3 py-1 transition-colors"
                              >
                                Submit now
                              </Button>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right text-sm text-gray-700 font-semibold">
                              {typeof license.renewalFee === 'number' ? `$${Math.round(license.renewalFee).toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusClassName(license.status)}`}>
                                {license.status}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <Can I="update" a="License">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(license)}
                                    className="hover:bg-indigo-50 hover:border-indigo-300"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </Can>
                                <Can I="delete" a="License">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(license.id)}
                                    className="hover:bg-red-50 hover:border-red-300 text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </Can>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Add/Edit License Modal */}
        <Dialog open={isModalOpen} onOpenChange={(v) => { 
          if (!v) {
            setIsFullscreen(false); 
            setShowSubmissionDetails(false);
            setSelectedDepartments([]);
            setEditingLicense(null);
          } 
          setIsModalOpen(v); 
        }}>
          <DialogContent className={`${isFullscreen ? 'max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh]' : 'max-w-4xl min-w-[400px] max-h-[80vh]'} overflow-y-auto rounded-2xl border-slate-200 shadow-2xl p-0 bg-white transition-[width,height] duration-300`}>
            <DialogHeader className={`bg-gradient-to-r from-indigo-500 to-indigo-600 text-white ${isFullscreen ? 'px-4 py-3 md:px-5 md:py-3' : 'p-5'} rounded-t-2xl flex flex-row items-center justify-between`}>
              <div className="flex items-center gap-4">
                <ShieldCheck className="h-6 w-6" />
                <DialogTitle className="text-xl font-bold leading-none">
                  {showSubmissionDetails ? 'Submission' : editingLicense ? 'Edit License' : 'License'}
                </DialogTitle>
                <span className={`ml-4 px-4 py-2 rounded-full text-sm font-semibold shadow-sm tracking-wide ${headerStatus === 'Inactive' ? 'bg-gray-400 text-white' : 'bg-green-500 text-white'}`}>{headerStatus}</span>
              </div>
              <div className="flex gap-4 items-center mr-4">
                {/* Submission Toggle Button */}
                {!showSubmissionDetails && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSubmissionDetails(!showSubmissionDetails)}
                    className="relative overflow-hidden px-3 py-1 text-sm rounded-lg font-semibold transition-all duration-300 bg-gradient-to-r from-emerald-500/70 to-green-600/70 text-white border border-emerald-300/60 hover:from-emerald-500 hover:to-green-600 hover:shadow-[0_8px_16px_rgba(16,185,129,0.25)]"
                  >
                    Submission
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                  className={`bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-3 py-2 rounded-lg shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 border-indigo-200 h-10 w-10 p-0 flex items-center justify-center`}
                  onClick={() => setIsFullscreen(f => !f)}
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
              </div>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className={`${isFullscreen ? 'p-4 md:p-6 lg:p-8' : 'p-6'}`}>
                {/* Show Submission Details when showSubmissionDetails is true */}
                {showSubmissionDetails && (
                  <>
                    <div className={`grid gap-6 mb-8 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                      {/* Renewal Status */}
                      <FormField
                        control={form.control}
                        name="renewalStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Renewal Status</FormLabel>
                            <FormControl>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                                  <SelectItem value="not_started" className="text-slate-900 hover:bg-indigo-50">Not Started</SelectItem>
                                  <SelectItem value="in_progress" className="text-slate-900 hover:bg-indigo-50">In Progress</SelectItem>
                                  <SelectItem value="submitted" className="text-slate-900 hover:bg-indigo-50">Submitted</SelectItem>
                                  <SelectItem value="approved" className="text-slate-900 hover:bg-indigo-50">Approved</SelectItem>
                                  <SelectItem value="rejected" className="text-slate-900 hover:bg-indigo-50">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {/* Renewal Submitted Date */}
                      <FormField
                        control={form.control}
                        name="renewalSubmittedDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Renewal Submitted Date</FormLabel>
                            <FormControl>
                              <Input 
                                className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40" 
                                type="date" 
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {/* Expected Completed Date */}
                      <FormField
                        control={form.control}
                        name="expectedCompletedDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Expected Completed Date</FormLabel>
                            <FormControl>
                              <Input 
                                className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40" 
                                type="date" 
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Card-based Notes Section (like subscription modal) */}
                    <div className="mt-4 mb-8">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-base font-semibold text-gray-700">Notes ({notes.length})</h3>
                        <button
                          type="button"
                          onClick={() => setShowAddNoteDialog(true)}
                          className="flex items-center justify-center w-6 h-6 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-colors"
                          title="Add note"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" x2="12" y1="8" y2="16"></line>
                            <line x1="8" x2="16" y1="12" y2="12"></line>
                          </svg>
                        </button>
                      </div>
                      
                      {notes.length > 0 ? (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {notes.map((note) => (
                            <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedNote(note);
                                    setShowViewNoteDialog(true);
                                  }}
                                  className="text-left text-cyan-600 hover:text-cyan-800 hover:underline text-base flex-1 font-medium"
                                >
                                  {note.text}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNotes(notes.filter(n => n.id !== note.id));
                                  }}
                                  className="text-red-500 hover:text-red-700 text-sm font-medium flex-shrink-0"
                                >
                                  Delete
                                </button>
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span>{new Date(note.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/')}</span>
                                <span>•</span>
                                <span className="uppercase">{note.createdBy}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm italic">No notes added yet. Click + to add a note.</p>
                      )}
                    </div>
                  </>
                )}

                {/* Show License Details when not viewing Submission Details */}
                {!showSubmissionDetails && (
                  <>
                  {/* General Info Section */}
                  <div className="bg-white rounded-xl border border-gray-200 mb-6 shadow-md">
                    <h3 className="text-base font-semibold text-slate-800 px-6 py-4 border-b border-gray-200 bg-gray-50">General Info</h3>
                    <div className="p-6">
                    <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-4' : 'grid-cols-2'}`}>
                      {/* License Name */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Licence Name</label>
                        <Input
                          className={`w-full border-slate-300 rounded-lg p-2.5 text-base ${licenseNameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                          value={form.watch('licenseName') || ''}
                          onChange={(e) => {
                            // Auto-capitalize each word
                            const capitalizedValue = e.target.value
                              .split(' ')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                              .join(' ');
                            form.setValue('licenseName', capitalizedValue);
                            // Validate uniqueness
                            validateLicenseName(capitalizedValue);
                          }}
                        />
                        {licenseNameError && (
                          <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {licenseNameError}
                          </p>
                        )}
                      </div>

                      {/* Responsible Person */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Responsible Person</label>
                        <Select
                          value={form.watch('responsiblePerson') || ''}
                          onValueChange={(value) => form.setValue('responsiblePerson', value)}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue placeholder="Select responsible person" />
                          </SelectTrigger>
                          <SelectContent>
                            {employeesRaw.length > 0 ? (
                              employeesRaw.map((emp: any) => {
                                // Check if there are duplicate names
                                const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                                const displayName = duplicateNames.length > 1 
                                  ? `${emp.name} (${emp.email})` 
                                  : emp.name;
                                
                                return (
                                  <SelectItem 
                                    key={emp._id || emp.id || emp.email} 
                                    value={emp.name}
                                  >
                                    {displayName}
                                  </SelectItem>
                                );
                              })
                            ) : (
                              <SelectItem value="no-employee" disabled>No employees found</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Start Date */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Start Date</label>
                        <Input 
                          type="date"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('startDate') || ''}
                          onChange={(e) => form.setValue('startDate', e.target.value)}
                        />
                      </div>

                      {/* End Date */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">End Date</label>
                        <Input 
                          type="date"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('endDate') || ''}
                          onChange={(e) => form.setValue('endDate', e.target.value)}
                        />
                      </div>

                      {/* Secondary Incharge */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Secondary Incharge</label>
                        <Select
                          value={form.watch('backupContact') || ''}
                          onValueChange={(value) => form.setValue('backupContact', value)}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue placeholder="Select secondary incharge" />
                          </SelectTrigger>
                          <SelectContent>
                            {employeesRaw.length > 0 ? (
                              employeesRaw.map((emp: any) => {
                                // Check if there are duplicate names
                                const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                                const displayName = duplicateNames.length > 1 
                                  ? `${emp.name} (${emp.email})` 
                                  : emp.name;
                                
                                return (
                                  <SelectItem 
                                    key={emp._id || emp.id || emp.email} 
                                    value={emp.name}
                                  >
                                    {displayName}
                                  </SelectItem>
                                );
                              })
                            ) : (
                              <SelectItem value="no-employee" disabled>No employees found</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Department */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Department</label>
                        <Select
                          open={departmentSelectOpen}
                          onOpenChange={setDepartmentSelectOpen}
                          value={selectedDepartments.length > 0 ? selectedDepartments.join(',') : ''}
                          onValueChange={() => {}}
                          disabled={departmentsLoading}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base min-h-[44px] flex items-start justify-start overflow-hidden">
                            <div className="w-full overflow-hidden">
                              {selectedDepartments.length > 0 ? (
                                <div className="flex flex-wrap gap-1 w-full">
                                  {selectedDepartments.map((dept) => (
                                    <Badge key={dept} variant="secondary" className="flex items-center gap-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 text-xs py-1 px-2 max-w-full">
                                      <span className="truncate max-w-[80px]">{dept}</span>
                                      <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); removeDepartment(dept); }}
                                        className="ml-1 rounded-full hover:bg-indigo-300 flex-shrink-0"
                                        tabIndex={-1}
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">Select departments</span>
                              )}
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {/* Company Level option - always first */}
                            <div className="flex items-center px-2 py-2 hover:bg-slate-100 rounded-md border-b border-gray-200 mb-1">
                              <Checkbox
                                id="dept-company-level"
                                checked={selectedDepartments.includes('Company Level')}
                                onCheckedChange={(checked: boolean) => handleDepartmentChange('Company Level', checked)}
                                disabled={departmentsLoading}
                              />
                              <label
                                htmlFor="dept-company-level"
                                className="text-sm font-bold cursor-pointer flex-1 ml-2 text-blue-600"
                              >
                                Company Level
                              </label>
                            </div>
                            {departments && departments.length > 0 ? (
                              departments.map(dept => (
                                <div key={dept.name} className="flex items-center px-2 py-2 hover:bg-slate-100 rounded-md">
                                  <Checkbox
                                    id={`dept-${dept.name}`}
                                    checked={selectedDepartments.includes(dept.name)}
                                    onCheckedChange={(checked: boolean) => handleDepartmentChange(dept.name, checked)}
                                    disabled={departmentsLoading || selectedDepartments.includes('Company Level')}
                                  />
                                  <label
                                    htmlFor={`dept-${dept.name}`}
                                    className="text-sm font-medium cursor-pointer flex-1 ml-2"
                                  >
                                    {dept.name}
                                  </label>
                                </div>
                              ))
                            ) : null}
                            {/* Add Department option */}
                            <div
                              className="font-medium border-t border-gray-200 mt-1 pt-2 text-black cursor-pointer px-2 py-2 hover:bg-slate-100 rounded-md"
                              onClick={() => {
                                setDepartmentSelectOpen(false);
                                setDepartmentModal({ show: true });
                              }}
                            >
                              + New
                            </div>
                            {departments && departments.length === 0 && (
                              <SelectItem value="no-department" disabled>No departments available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Renewal Cost */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Renewal Cost</label>
                        <Input 
                          type="number"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('renewalFee') || ''}
                          onChange={(e) => form.setValue('renewalFee', e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </div>

                      {/* Renewal Cycle Time */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Renewal Cycle Time</label>
                        <Select
                          value={form.watch('renewalCycleTime') || ''}
                          onValueChange={(value) => form.setValue('renewalCycleTime', value)}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue placeholder="Select cycle time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                            <SelectItem value="Semi-Annually">Semi-Annually</SelectItem>
                            <SelectItem value="Annually">Annually</SelectItem>
                            <SelectItem value="Bi-Annually">Bi-Annually</SelectItem>
                            <SelectItem value="One-Time">One-Time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Remarks */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Remarks</label>
                        <Input
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('details') || ''}
                          onChange={(e) => form.setValue('details', e.target.value)}
                        />
                      </div>
                    </div>
                    </div>
                  </div>

                  {/* Issuing Authority Section */}
                  <div className="bg-white rounded-xl border border-gray-200 mb-6 shadow-md">
                    <h3 className="text-base font-semibold text-slate-800 px-6 py-4 border-b border-gray-200 bg-gray-50">Issuing Authority</h3>
                    <div className="p-6">
                    <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-4' : 'grid-cols-2'}`}>
                      {/* Authority */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Authority</label>
                        <div className="relative issuing-authority-dropdown">
                          <Input
                            className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                            value={form.watch('issuingAuthorityName') || ''}
                            onChange={(e) => {
                              form.setValue('issuingAuthorityName', e.target.value);
                              if (e.target.value && !isIssuingAuthorityOpen) {
                                setIsIssuingAuthorityOpen(true);
                              }
                            }}
                            onFocus={() => {
                              if (form.watch('issuingAuthorityName')) {
                                setIsIssuingAuthorityOpen(true);
                              }
                            }}
                          />
                          {isIssuingAuthorityOpen && (() => {
                            const filteredAuthorities = ISSUING_AUTHORITIES.filter(authority =>
                              authority.toLowerCase().includes((form.watch('issuingAuthorityName') || "").toLowerCase())
                            );
                            
                            return (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                                {filteredAuthorities.length > 0 ? (
                                  filteredAuthorities.map(name => (
                                    <div
                                      key={name}
                                      className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                                      onClick={() => {
                                        form.setValue('issuingAuthorityName', name);
                                        setIsIssuingAuthorityOpen(false);
                                      }}
                                    >
                                      {name}
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-3 py-2 text-sm text-slate-500">
                                    No matching authorities found
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Contact Number */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Contact Number</label>
                        <Input
                          type="text"
                          pattern="[0-9+\-\s()]*"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('issuingAuthorityPhone') || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow numbers, +, -, spaces, and parentheses
                            if (/^[0-9+\-\s()]*$/.test(value)) {
                              form.setValue('issuingAuthorityPhone', value);
                            }
                          }}
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Email</label>
                        <Input 
                          type="email"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('issuingAuthorityEmail') || ''}
                          onChange={(e) => form.setValue('issuingAuthorityEmail', e.target.value)}
                        />
                      </div>

                      {/* Website */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Website</label>
                        <Input 
                          type="url"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                        />
                      </div>
                    </div>
                    </div>
                  </div>

                  {/* Reminder Settings Section */}
                  <div className="bg-white rounded-xl border border-gray-200 mb-6 shadow-md">
                    <h3 className="text-base font-semibold text-slate-800 px-6 py-4 border-b border-gray-200 bg-gray-50">Reminder Settings</h3>
                    <div className="p-6">
                    <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-4' : 'grid-cols-2'}`}>
                      {/* Reminder Days */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Reminder Days</label>
                        <Input 
                          type="number"
                          min="1"
                          max="365"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('reminderDays') || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || '';
                            form.setValue('reminderDays', value);
                            // If reminderDays is 1, automatically set policy to 'One time'
                            if (value === 1) {
                              form.setValue('reminderPolicy', 'One time');
                            }
                          }}
                        />
                      </div>

                      {/* Reminder Policy */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Reminder Policy</label>
                        <Select
                          value={form.watch('reminderPolicy') || ''}
                          onValueChange={(value) => form.setValue('reminderPolicy', value)}
                          disabled={form.watch('reminderDays') === 1}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue placeholder="Select policy" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="One time">One time</SelectItem>
                            <SelectItem value="Two times" disabled={form.watch('reminderDays') === 1}>Two times</SelectItem>
                            <SelectItem value="Until Renewal" disabled={form.watch('reminderDays') === 1}>Until Renewal</SelectItem>
                          </SelectContent>
                        </Select>
                        {form.watch('reminderDays') && (
                          <ul className="text-xs text-slate-600 mt-2 list-disc pl-4">
                            <li>One time: One reminder at {form.watch('reminderDays') || 7} days before renewal</li>
                            <li>Two times: Reminders at {form.watch('reminderDays') || 7} and {Math.floor((form.watch('reminderDays') as number || 7)/2)} days before</li>
                            <li>Until Renewal: Daily reminders from {form.watch('reminderDays') || 7} days until renewal</li>
                          </ul>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                  </>
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-gray-200 bg-gray-50/50 -mx-8 px-8 -mb-8 pb-8 rounded-b-2xl">
                  {/* Only show Cancel License button when editing an existing license */}
                  {editingLicense && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      className="font-semibold px-6 py-3 border-2 border-red-600 text-white bg-red-600 hover:bg-red-700 shadow-lg mr-auto rounded-lg transition-all duration-200 hover:shadow-red-500/25"
                      onClick={() => {
                        // Close modal and reset form
                        setIsModalOpen(false);
                        setShowSubmissionDetails(false);
                        toast({ title: 'License cancelled', description: 'The license creation was cancelled.' });
                      }}
                    >
                      Cancel License
                    </Button>
                  )}
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-6 py-3 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
                    onClick={() => {
                      setIsModalOpen(false);
                      setShowSubmissionDetails(false);
                    }}
                  >
                    Exit
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
                    onClick={() => handleSaveDraft()}
                    disabled={draftMutation.isPending}
                  >
                    {draftMutation.isPending ? 'Saving Draft...' : 'Save Draft'}
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-blue-700 rounded-lg transition-all duration-200 tracking-tight"
                    disabled={licenseMutation.isPending}
                  >
                    {licenseMutation.isPending ? 'Saving...' : (editingLicense ? 'Update License' : 'Save License')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        <input
          type="file"
          accept=".csv,text/csv"
          ref={fileInputRef}
          onChange={handleImport}
          className="hidden"
        />
        
        {/* Department Creation Modal */}
        <AlertDialog open={departmentModal.show} onOpenChange={(open) => !open && setDepartmentModal({ show: false })}>
          <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
            <AlertDialogHeader className="bg-indigo-600 text-white p-6 rounded-t-lg -m-6 mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 104 0 2 2 0 00-4 0zm6 0a2 2 0 104 0 2 2 0 00-4 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <AlertDialogTitle className="text-xl font-semibold text-white">
                  Add New Department
                </AlertDialogTitle>
              </div>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                <Input
                  placeholder=""
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddDepartment();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Head</label>
                <Input
                  placeholder=""
                  value={newDepartmentHead}
                  onChange={(e) => setNewDepartmentHead(e.target.value)}
                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddDepartment();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <Input
                  type="email"
                  placeholder=""
                  value={newDepartmentEmail}
                  onChange={(e) => setNewDepartmentEmail(e.target.value)}
                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddDepartment();
                    }
                  }}
                />
              </div>
            </div>
            <AlertDialogFooter className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setDepartmentModal({ show: false });
                  setNewDepartmentName('');
                  setNewDepartmentHead('');
                  setNewDepartmentEmail('');
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddDepartment}
                disabled={!newDepartmentName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-300"
              >
                Add Department
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Note Dialog */}
        <AlertDialog open={showAddNoteDialog} onOpenChange={(open) => !open && setShowAddNoteDialog(false)}>
          <AlertDialogContent className="sm:max-w-[900px] bg-white border border-gray-200 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-gray-900">Add a note</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="py-6">
              <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
                <label className="text-base font-medium text-gray-700 pt-3">
                  Note <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[120px] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Enter your note here..."
                />
              </div>
            </div>
            <AlertDialogFooter className="flex justify-end gap-3">
              <AlertDialogCancel
                onClick={() => {
                  setNewNoteText('');
                  setShowAddNoteDialog(false);
                }}
                className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-8 py-2 rounded-md"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (newNoteText.trim()) {
                    const newNote = {
                      id: Date.now().toString(),
                      text: newNoteText.trim(),
                      createdAt: new Date().toISOString(),
                      createdBy: currentUserName || 'User'
                    };
                    setNotes([...notes, newNote]);
                    setNewNoteText('');
                    setShowAddNoteDialog(false);
                  }
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-2 rounded-md"
                disabled={!newNoteText.trim()}
              >
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Note Dialog */}
        <AlertDialog open={showViewNoteDialog} onOpenChange={(open) => !open && setShowViewNoteDialog(false)}>
          <AlertDialogContent className="sm:max-w-[900px] bg-white border border-gray-200 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-gray-900">Notes</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="py-6 space-y-6">
              <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
                <label className="text-base font-medium text-gray-700 pt-3">Note</label>
                <Textarea
                  value={selectedNote?.text || ''}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[120px] bg-white text-gray-900 resize-none"
                />
              </div>
              
              <div className="grid grid-cols-[120px_1fr] gap-4 items-center">
                <label className="text-base font-medium text-gray-700">Created</label>
                <div className="w-full border border-gray-300 rounded-lg p-3 text-base bg-gray-100 text-gray-900">
                  {selectedNote?.createdAt ? new Date(selectedNote.createdAt).toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  }).replace(',', '') : ''}
                </div>
              </div>
              
              <div className="grid grid-cols-[120px_1fr] gap-4 items-center">
                <label className="text-base font-medium text-gray-700">User ID</label>
                <div className="w-full border border-gray-300 rounded-lg p-3 text-base bg-gray-100 text-gray-900">
                  {selectedNote?.createdBy}
                </div>
              </div>
            </div>
            <AlertDialogFooter className="flex justify-end gap-3">
              <AlertDialogAction
                onClick={() => {
                  setShowViewNoteDialog(false);
                  setSelectedNote(null);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-2 rounded-md"
              >
                OK
              </AlertDialogAction>
              <AlertDialogCancel
                onClick={() => {
                  setShowViewNoteDialog(false);
                  setSelectedNote(null);
                }}
                className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-8 py-2 rounded-md"
              >
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}