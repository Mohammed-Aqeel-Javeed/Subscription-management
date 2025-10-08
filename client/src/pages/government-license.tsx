import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
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
import { toast } from "../hooks/use-toast";
import { z } from "zod";
import { apiRequest } from "../lib/api";
import { useToast } from "../hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";
import { Checkbox } from "../components/ui/checkbox";

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
  responsiblePerson: string;
  department: string;
  backupContact: string;
  status: 'Active' | 'Pending' | 'Expired' | 'Under Renewal' | 'Draft';
  issuingAuthorityEmail: string;
  issuingAuthorityPhone: string;
  // New submission fields
  renewalStatus?: string;
  renewalSubmittedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Form schema (all fields optional per request to remove mandatory validation)
// NOTE: Backend may still enforce required fields; this only relaxes frontend validation.
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
  }, z.number().min(0).optional()),
  responsiblePerson: z.string().optional(),
  department: z.string().optional(),
  departments: z.array(z.string()).optional(),
  backupContact: z.string().optional(),
  status: z.enum(['Active', 'Pending', 'Expired', 'Under Renewal', 'Draft']).optional(),
  renewalStatus: z.enum(['not_started', 'in_progress', 'submitted', 'approved', 'rejected']).optional(),
  issuingAuthorityEmail: z.string().email("Invalid email").optional(),
  issuingAuthorityPhone: z.string().optional(),
  renewalSubmittedDate: z.string().optional(),
  submissionNotes: z.string().optional(),
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
    const newSelectedDepartments = checked
      ? [...selectedDepartments, departmentName]
      : selectedDepartments.filter(dept => dept !== departmentName);
    
    setSelectedDepartments(newSelectedDepartments);
    form.setValue("departments", newSelectedDepartments);
    form.setValue("department", JSON.stringify(newSelectedDepartments));
  };

  // Remove department
  const removeDepartment = (departmentName: string) => {
    const newSelectedDepartments = selectedDepartments.filter(dept => dept !== departmentName);
    setSelectedDepartments(newSelectedDepartments);
    form.setValue("departments", newSelectedDepartments);
    form.setValue("department", JSON.stringify(newSelectedDepartments));
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
    setSelectedDepartments(depts);
    form.reset({
      licenseName: license.licenseName || "",
      issuingAuthorityName: license.issuingAuthorityName || "",
      startDate: license.startDate || "",
      endDate: license.endDate || "",
      details: license.details || "",
      renewalFee: typeof license.renewalFee === 'number' ? license.renewalFee : undefined,
      responsiblePerson: license.responsiblePerson || "",
      department: license.department || "",
      departments: depts,
      backupContact: license.backupContact || "",
      status: (license.status as any) || 'Active',
      issuingAuthorityEmail: license.issuingAuthorityEmail || "",
      issuingAuthorityPhone: license.issuingAuthorityPhone || "",
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
              <Button
                onClick={handleAddNew}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add License
              </Button>
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
                      onClick={() => {/* TODO export */}}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-medium text-xs px-3 py-1 h-7"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
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
                  {!searchTerm && statusFilter === "all" && (
                    <Button 
                      onClick={handleAddNew}
                      className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First License
                    </Button>
                  )}
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(license)}
                                  className="hover:bg-indigo-50 hover:border-indigo-300"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(license.id)}
                                  className="hover:bg-red-50 hover:border-red-300 text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
                      {/* Issuing Authority Email */}
                      <FormField
                        control={form.control}
                        name="issuingAuthorityEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Issuing Authority Email</FormLabel>
                            <FormControl>
                              <Input 
                                className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40" 
                                type="email" 
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {/* Issuing Authority Phone */}
                      <FormField
                        control={form.control}
                        name="issuingAuthorityPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Issuing Authority Phone</FormLabel>
                            <FormControl>
                              <Input 
                                className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40" 
                                type="tel" 
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Submission Notes */}
                    <div className="mt-4 mb-8">
                      <FormField
                        control={form.control}
                        name="submissionNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700 mb-3">Submission Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                className="w-full border-slate-300 rounded-lg text-base min-h-[120px] md:min-h-[140px] resize-y focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 p-4"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                {/* Show License Details when not viewing Submission Details */}
                {!showSubmissionDetails && (
                  <>
                  <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-2 md:grid-cols-3'}`}>
                  {/* License Name */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">License Name</label>
                    <Input 
                      className={`w-full border-slate-300 rounded-lg p-2 text-base ${licenseNameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
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

                  {/* Issuing Authority Name (Dropdown with Autocomplete) */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Issuing Authority Name</label>
                    <div className="relative issuing-authority-dropdown">
                      <div className="relative">
                        <Input
                          className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          placeholder="Type or select issuing authority"
                          value={form.watch('issuingAuthorityName') || ''}
                          onChange={(e) => {
                            form.setValue('issuingAuthorityName', e.target.value);
                            // Show dropdown when user starts typing
                            if (e.target.value && !isIssuingAuthorityOpen) {
                              setIsIssuingAuthorityOpen(true);
                            }
                          }}
                          onFocus={() => {
                            // Show dropdown on focus if there's text
                            if (form.watch('issuingAuthorityName')) {
                              setIsIssuingAuthorityOpen(true);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3"
                          onClick={() => setIsIssuingAuthorityOpen(!isIssuingAuthorityOpen)}
                        >
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      {isIssuingAuthorityOpen && (() => {
                        // Filter authorities based on input text
                        const filteredAuthorities = ISSUING_AUTHORITIES.filter(authority =>
                          authority.toLowerCase().includes((form.watch('issuingAuthorityName') || "").toLowerCase())
                        );
                        
                        return (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-[260px] overflow-hidden">
                            <div className="max-h-[240px] overflow-y-auto p-1">
                              <div className="text-xs font-semibold tracking-wide text-slate-500 px-2 py-1 uppercase">Portal / System</div>
                              {filteredAuthorities.length > 0 ? (
                                filteredAuthorities.map(name => (
                                  <div
                                    key={name}
                                    className="pl-8 pr-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                                    onClick={() => {
                                      form.setValue('issuingAuthorityName', name);
                                      setIsIssuingAuthorityOpen(false);
                                    }}
                                  >
                                    <span className="border-b border-dotted border-slate-300 pb-0.5 leading-snug inline-block w-full">{name}</span>
                                  </div>
                                ))
                              ) : form.watch('issuingAuthorityName') ? (
                                <div className="pl-8 pr-3 py-2 text-sm text-slate-500">
                                  No matching authorities found
                                </div>
                              ) : (
                                ISSUING_AUTHORITIES.map(name => (
                                  <div
                                    key={name}
                                    className="pl-8 pr-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                                    onClick={() => {
                                      form.setValue('issuingAuthorityName', name);
                                      setIsIssuingAuthorityOpen(false);
                                    }}
                                  >
                                    <span className="border-b border-dotted border-slate-300 pb-0.5 leading-snug inline-block w-full">{name}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Start Date */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Start Date</label>
                    <Input 
                      type="date" 
                      className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                      value={form.watch('startDate') || ''}
                      onChange={(e) => form.setValue('startDate', e.target.value)}
                    />
                  </div>

                  {/* End Date */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">End Date</label>
                    <Input 
                      type="date" 
                      className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                      value={form.watch('endDate') || ''}
                      onChange={(e) => form.setValue('endDate', e.target.value)}
                    />
                  </div>

                  {/* Renewal Fee */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Renewal Fee</label>
                    <Input 
                      type="number" 
                      min="0" 
                      step="0.01"
                      className="w-full border-slate-300 rounded-lg p-2 text-base text-right focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                      value={form.watch('renewalFee') || ''}
                      onChange={(e) => form.setValue('renewalFee', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Status</label>
                    <Select value={form.watch('status') || 'Active'} onValueChange={(value) => form.setValue('status', value as "Active" | "Pending" | "Draft" | "Expired" | "Under Renewal")}> 
                      <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 rounded-md shadow-lg p-0 overflow-hidden">
                        <div className="py-1">
                          <SelectItem value="Active" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Active</SelectItem>
                          <SelectItem value="Pending" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Pending</SelectItem>
                          <SelectItem value="Draft" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Draft</SelectItem>
                          <SelectItem value="Expired" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Expired</SelectItem>
                          <SelectItem value="Under Renewal" className="pl-8 pr-3 py-2 text-sm data-[state=checked]:bg-indigo-50 data-[state=checked]:text-indigo-700">Under Renewal</SelectItem>
                        </div>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Responsible Person */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Responsible Person</label>
                    <Input 
                      className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                      value={form.watch('responsiblePerson') || ''}
                      onChange={(e) => form.setValue('responsiblePerson', e.target.value)}
                    />
                  </div>

                  {/* Department */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Departments</label>
                    <Select
                      value={selectedDepartments.length > 0 ? selectedDepartments.join(',') : ''}
                      onValueChange={() => {}}
                      disabled={departmentsLoading}
                    >
                      <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base min-h-[44px] flex items-start justify-start overflow-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
                        <div className="w-full overflow-hidden">
                          {/* Render selected departments as badges inside the input box */}
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
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">Select departments</span>
                          )}
                        </div>
                      </SelectTrigger>
                      <SelectContent className="dropdown-content">
                        {Array.isArray(departments) && departments.length > 0 ? (
                          departments
                            .filter(dept => dept.visible)
                            .map(dept => (
                              <div key={dept.name} className="flex items-center px-2 py-2 hover:bg-slate-100 rounded-md">
                                <Checkbox
                                  id={`dept-${dept.name}`}
                                  checked={selectedDepartments.includes(dept.name)}
                                  onCheckedChange={(checked: boolean) => handleDepartmentChange(dept.name, checked)}
                                  disabled={departmentsLoading}
                                />
                                <label
                                  htmlFor={`dept-${dept.name}`}
                                  className="text-sm font-medium cursor-pointer flex-1 ml-2"
                                >
                                  {dept.name}
                                </label>
                              </div>
                            ))
                        ) : departmentsLoading ? (
                          <div className="px-2 py-2 text-sm text-gray-500">Loading departments...</div>
                        ) : (
                          <div className="px-2 py-2 text-sm text-gray-500">No departments found</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Backup Contact */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Backup Contact</label>
                    <Input 
                      className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                      value={form.watch('backupContact') || ''}
                      onChange={(e) => form.setValue('backupContact', e.target.value)}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 mb-8">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Details</label>
                  <Textarea 
                    className="w-full border-slate-300 rounded-lg text-base min-h-[120px] md:min-h-[140px] resize-y focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 p-4"
                    value={form.watch('details') || ''}
                    onChange={(e) => form.setValue('details', e.target.value)}
                  />
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
      </div>
    </div>
  );
}