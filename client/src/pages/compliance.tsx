import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/Can";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Search, Calendar, FileText, AlertCircle, ExternalLink, Maximize2, Minimize2, ShieldCheck, Download, Upload, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Papa from 'papaparse';
import { API_BASE_URL } from "@/lib/config";
import { apiRequest } from "@/lib/queryClient";

// Predefined Governing Authorities
const GOVERNING_AUTHORITIES = [
  "IRAS",
  "ACRA", 
  "CPF",
  "AGD",
  "MOM"
];

// Define the Department interface
interface Department {
  name: string;
  visible: boolean;
}

// Helper functions remain the same
const mapStatus = (status: string): string => {
  return "Pending";
};
const calculateEndDate = (start: string, freq: string): string => {
  if (!start) return "";
  const date = new Date(start);
  let endDate = new Date(date);
  if (freq === "Yearly") {
    endDate.setFullYear(date.getFullYear() + 1);
    endDate.setDate(endDate.getDate() - 1);
  } else if (freq === "Quarterly") {
    endDate.setMonth(date.getMonth() + 3);
    endDate.setDate(endDate.getDate() - 1);
  } else if (freq === "Monthly") {
    endDate.setMonth(date.getMonth() + 1);
    endDate.setDate(endDate.getDate() - 1);
  }
  const yyyy = endDate.getFullYear();
  const mm = String(endDate.getMonth() + 1).padStart(2, "0");
  const dd = String(endDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Calculate compliance status based on dates
const getComplianceStatus = (endDate: string, submissionDeadline: string): { status: string, color: string, bgColor: string } => {
  // If no End Date, return No Due
  if (!endDate) {
    return { status: "No Due", color: "text-slate-700", bgColor: "bg-slate-100" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  // Calculate 2 days before end date
  const twoDaysBeforeEnd = new Date(end);
  twoDaysBeforeEnd.setDate(end.getDate() - 2);
  twoDaysBeforeEnd.setHours(0, 0, 0, 0);
  
  // Check for "Going to be Due" first (2 days before end date)
  if (today.getTime() === twoDaysBeforeEnd.getTime()) {
    return { status: "Going to be Due", color: "text-amber-800", bgColor: "bg-amber-100" };
  }
  
  // If we have a submission deadline, use it for Due/Late logic
  if (submissionDeadline) {
    const deadline = new Date(submissionDeadline);
    deadline.setHours(0, 0, 0, 0);
    
    if (today.getTime() >= end.getTime() && today.getTime() < deadline.getTime()) {
      return { status: "Due", color: "text-orange-800", bgColor: "bg-orange-100" };
    } else if (today.getTime() >= deadline.getTime()) {
      return { status: "Late", color: "text-white", bgColor: "bg-red-600 animate-pulse shadow-lg border-2 border-red-400" };
    }
  } else {
    // If no submission deadline but past end date, consider it Due
    if (today.getTime() >= end.getTime()) {
      return { status: "Due", color: "text-orange-800", bgColor: "bg-orange-100" };
    }
  }
  
  // Default case
  return { status: "No Due", color: "text-slate-700", bgColor: "bg-slate-100" };
};
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};
function getNextPeriodDates(startDate: string, endDate: string, frequency: string): { nextStartDate: string; nextEndDate: string } {
  const start = new Date(endDate);
  let nextStart = new Date(start);
  let nextEnd = new Date(start);
  
  nextStart.setDate(start.getDate() + 1);
  
  if (frequency === "Monthly") {
    nextEnd.setMonth(nextStart.getMonth() + 1);
    nextEnd.setDate(nextEnd.getDate() - 1);
  } else if (frequency === "Quarterly") {
    nextEnd.setMonth(nextStart.getMonth() + 3);
    nextEnd.setDate(nextEnd.getDate() - 1);
  } else if (frequency === "Yearly") {
    nextEnd.setFullYear(nextStart.getFullYear() + 1);
    nextEnd.setDate(nextEnd.getDate() - 1);
  }
  
  const format = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  
  return { nextStartDate: format(nextStart), nextEndDate: format(nextEnd) };
}
export default function Compliance() {
  // --- Dynamic Compliance Fields ---
  const [complianceFields, setComplianceFields] = useState<any[]>([]);
  const [isLoadingComplianceFields, setIsLoadingComplianceFields] = useState(true);
  
  // State for categories and governing authorities
  const [categories, setCategories] = useState<string[]>([]);
  const [governingAuthorities, setGoverningAuthorities] = useState<string[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  
  // Fullscreen toggle state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Dropdown open state for governing authority
  const [isGoverningAuthorityOpen, setIsGoverningAuthorityOpen] = useState(false);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isGoverningAuthorityOpen && !target.closest('.governing-authority-dropdown')) {
        setIsGoverningAuthorityOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGoverningAuthorityOpen]);
  
  useEffect(() => {
    const fetchComplianceFields = () => {
      setIsLoadingComplianceFields(true);
      fetch('/api/config/compliance-fields')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setComplianceFields(data);
          else setComplianceFields([]);
        })
        .catch(() => setComplianceFields([]))
        .finally(() => setIsLoadingComplianceFields(false));
    };
    
    const fetchDropdownData = () => {
      setIsLoadingDropdowns(true);
      Promise.all([
        fetch('/api/compliance/categories').then(res => res.json()),
        fetch('/api/compliance/authorities').then(res => res.json())
      ])
      .then(([categoriesData, authoritiesData]) => {
        if (Array.isArray(categoriesData)) setCategories(categoriesData);
        if (Array.isArray(authoritiesData)) setGoverningAuthorities(authoritiesData);
      })
      .catch(() => {
        setCategories([]);
        setGoverningAuthorities([]);
      })
      .finally(() => setIsLoadingDropdowns(false));
    };
    
    fetchComplianceFields();
    fetchDropdownData();
    
    // Add event listeners for account changes
    window.addEventListener("accountChanged", fetchComplianceFields);
    window.addEventListener("logout", fetchComplianceFields);
    window.addEventListener("login", fetchComplianceFields);
    window.addEventListener("accountChanged", fetchDropdownData);
    window.addEventListener("logout", fetchDropdownData);
    window.addEventListener("login", fetchDropdownData);
    
    return () => {
      window.removeEventListener("accountChanged", fetchComplianceFields);
      window.removeEventListener("logout", fetchComplianceFields);
      window.removeEventListener("login", fetchComplianceFields);
      window.removeEventListener("accountChanged", fetchDropdownData);
      window.removeEventListener("logout", fetchDropdownData);
      window.removeEventListener("login", fetchDropdownData);
    };
  }, []);
  
  // Store dynamic field values in form state
  const [dynamicFieldValues, setDynamicFieldValues] = useState<{ [key: string]: string }>({});
  
  type ComplianceItem = {
    _id?: string;
    id?: string | number;
    policy: string;
    category: string;
    status: string;
    lastAudit?: string;
    issues?: number;
    frequency?: string;
    governingAuthority?: string;
    endDate?: string;
    submissionDeadline?: string;
    recurringFrequency?: string;
    remarks?: string;
    filingSubmissionDate?: string;
    reminderDays?: string | number;
    reminderPolicy?: string;
    submittedBy?: string;
    amount?: string | number;
    isDraft?: boolean;
    paymentDate?: string;
    submissionAmount?: string | number;
    paymentMethod?: string;
    department?: string;
    departments?: string[];
  };
  
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  
  const [form, setForm] = useState({
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
    submissionNotes: "",
    filingSubmissionDate: "",
    reminderDays: "7",
    reminderPolicy: "One time",
    submittedBy: "",
    amount: "",
    paymentDate: "",
    submissionAmount: "",
    paymentMethod: "",
    department: "",
    departments: [] as string[],
  });
  
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
        // Get logged-in user information from window.user
        const loggedInUser = (window as any).user;
        
        // First try to get name directly from window.user (works for all roles: admin, super admin, etc.)
        if (loggedInUser?.name) {
          setCurrentUserName(loggedInUser.name);
          return;
        }
        
        // Try to fetch from /api/me or current user endpoint
        try {
          const meResponse = await fetch('/api/me', {
            method: 'GET',
            credentials: 'include',
          });
          if (meResponse.ok) {
            const meData = await meResponse.json();
            // Check for fullName (login collection) or name
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
        
        // If name not in window.user, fetch from employees/users API using email
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
          
          // Try users endpoint for login collection
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
          
          // Fallback to email username if name not found
          const fallbackName = userEmail.split('@')[0];
          // Capitalize first letter
          const capitalizedName = fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);
          setCurrentUserName(capitalizedName);
        } else {
          // Try one more fallback - get from window.user.email if available
          const lastResortEmail = loggedInUser?.email;
          if (lastResortEmail) {
            const lastResortName = lastResortEmail.split('@')[0];
            const capitalizedLastResort = lastResortName.charAt(0).toUpperCase() + lastResortName.slice(1);
            setCurrentUserName(capitalizedLastResort);
          } else {
            setCurrentUserName('User');
          }
        }
      } catch (error) {
        console.error('Failed to fetch current user:', error);
        // Use email as fallback
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
  
  // Fetch employees for the submit by dropdown with auto-refresh
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const response = await fetch("/api/employees");
      if (!response.ok) throw new Error("Failed to fetch employees");
      return response.json();
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Query for departments
  const { data: departments, isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/company/departments"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/company/departments`, { credentials: "include" });
      return res.json();
    }
  });
  
  // Parse departments from compliance if it exists
  const parseDepartments = (deptString?: string) => {
    if (!deptString) return [];
    try {
      return JSON.parse(deptString);
    } catch {
      // If parsing fails, treat as a single department
      return [deptString];
    }
  };
  
  // Handle department selection
  const handleDepartmentChange = (departmentName: string, checked: boolean) => {
    // If Company Level is selected, show only Company Level
    if (departmentName === 'Company Level' && checked) {
      setSelectedDepartments(['Company Level']);
      setForm(prev => ({
        ...prev,
        departments: ['Company Level'],
        department: JSON.stringify(['Company Level'])
      }));
      return;
    }
    
    // If unchecking Company Level, uncheck all
    if (departmentName === 'Company Level' && !checked) {
      setSelectedDepartments([]);
      setForm(prev => ({
        ...prev,
        departments: [],
        department: JSON.stringify([])
      }));
      return;
    }
    
    // When selecting other departments, remove Company Level if it exists
    if (checked && selectedDepartments.includes('Company Level')) {
      setSelectedDepartments([departmentName]);
      setForm(prev => ({
        ...prev,
        departments: [departmentName],
        department: JSON.stringify([departmentName])
      }));
      return;
    }
    
    const newSelectedDepartments = checked
      ? [...selectedDepartments, departmentName]
      : selectedDepartments.filter(dept => dept !== departmentName);
    
    setSelectedDepartments(newSelectedDepartments);
    setForm(prev => ({
      ...prev,
      departments: newSelectedDepartments,
      department: JSON.stringify(newSelectedDepartments)
    }));
  };
  
  // Remove department
  const removeDepartment = (departmentName: string) => {
    // If removing Company Level, remove all
    if (departmentName === 'Company Level') {
      setSelectedDepartments([]);
      setForm(prev => ({
        ...prev,
        departments: [],
        department: JSON.stringify([])
      }));
      return;
    }
    
    // Cannot remove individual departments when Company Level is selected
    if (selectedDepartments.includes('Company Level')) {
      return;
    }
    
    const newSelectedDepartments = selectedDepartments.filter(dept => dept !== departmentName);
    setSelectedDepartments(newSelectedDepartments);
    setForm(prev => ({
      ...prev,
      departments: newSelectedDepartments,
      department: JSON.stringify(newSelectedDepartments)
    }));
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
      setForm(prev => ({
        ...prev,
        departments: updatedDepartments,
        department: JSON.stringify(updatedDepartments)
      }));
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
  
  // State for filing name validation
  const [filingNameError, setFilingNameError] = useState<string>("");
  
  // State for sorting
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // State for date validation errors
  const [dateErrors, setDateErrors] = useState<{
    startDate?: string;
    endDate?: string;
    submissionDeadline?: string;
    submissionDate?: string;
    paymentDate?: string;
  }>({});

  // Date validation helper functions
  const validateDate = (dateValue: string, fieldName: string, allowFuture: boolean = false): string => {
    if (!dateValue) return "";
    
    const inputDate = new Date(dateValue);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    inputDate.setHours(0, 0, 0, 0);
    
    if (isNaN(inputDate.getTime())) {
      return "Invalid date format";
    }
    
    // Special handling for submission date - allow future dates within submission window
    if (fieldName === "Submission Date" && !allowFuture && inputDate > today) {
      // Check if we have end date and submission deadline to determine valid window
      const endDate = form.filingEndDate ? new Date(form.filingEndDate) : null;
      const submissionDeadline = form.filingSubmissionDeadline ? new Date(form.filingSubmissionDeadline) : null;
      
      if (endDate && submissionDeadline) {
        endDate.setHours(0, 0, 0, 0);
        submissionDeadline.setHours(0, 0, 0, 0);
        
        // Allow future submission dates if they're within the valid submission window
        if (inputDate >= endDate && inputDate <= submissionDeadline) {
          return ""; // Valid - within submission window
        }
      }
      
      return `${fieldName} cannot be in the future`;
    }
    
    // Check for future date restrictions for other fields
    if (!allowFuture && inputDate > today) {
      return `${fieldName} cannot be in the future`;
    }
    
    return "";
  };

  const validateDateLogic = (): boolean => {
    const errors: typeof dateErrors = {};
    let isValid = true;
    
    const startDate = form.filingStartDate ? new Date(form.filingStartDate) : null;
    const endDate = form.filingEndDate ? new Date(form.filingEndDate) : null;
    const submissionDeadline = form.filingSubmissionDeadline ? new Date(form.filingSubmissionDeadline) : null;
    const submissionDate = form.filingSubmissionDate ? new Date(form.filingSubmissionDate) : null;
    const paymentDate = form.paymentDate ? new Date(form.paymentDate) : null;
    
    // Validate individual dates
    const startDateError = validateDate(form.filingStartDate, "Start Date", true);
    if (startDateError) {
      errors.startDate = startDateError;
      isValid = false;
    }
    
    const submissionDateError = validateDate(form.filingSubmissionDate, "Submission Date", false);
    if (submissionDateError) {
      errors.submissionDate = submissionDateError;
      isValid = false;
    }
    
    const paymentDateError = validateDate(form.paymentDate, "Payment Date", false);
    if (paymentDateError) {
      errors.paymentDate = paymentDateError;
      isValid = false;
    }
    
    // Validate date relationships
    if (startDate && endDate && startDate >= endDate) {
      errors.endDate = "End Date must be after Start Date";
      isValid = false;
    }
    
    if (endDate && submissionDeadline && submissionDeadline <= endDate) {
      errors.submissionDeadline = "Submission Deadline must be after End Date";
      isValid = false;
    }
    
    // Fixed: Allow submission ON or BEFORE the deadline, only error if AFTER deadline
    if (submissionDate && submissionDeadline && submissionDate > submissionDeadline) {
      errors.submissionDate = "Submission Date cannot be after the Submission Deadline";
      isValid = false;
    }
    
    // Also check that submission date is not before end date (filing period must be complete)
    if (submissionDate && endDate && submissionDate < endDate) {
      errors.submissionDate = "Submission Date cannot be before End Date";
      isValid = false;
    }
    
    setDateErrors(errors);
    return isValid;
  };

  // Required field validation
  const validateRequiredFields = (): boolean => {
    const requiredFields = [
      { field: 'filingName', label: 'Filing Name' },
      { field: 'filingComplianceCategory', label: 'Compliance Category' },
      { field: 'filingStartDate', label: 'Start Date' },
      { field: 'filingEndDate', label: 'End Date' }
    ];
    
    const missingFields = requiredFields.filter(({ field }) => !form[field as keyof typeof form]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Required Fields Missing",
        description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };
  
  const handleFormChange = (field: string, value: string) => {
    // Capitalize first letter of each word for filingName (like subscription modal service name)
    if (field === "filingName" && value.length > 0) {
      // If user is typing all caps (2+ consecutive uppercase), keep as is
      const isTypingAllCaps = /[A-Z]{2,}/.test(value);
      if (!isTypingAllCaps) {
        value = value
          .split(' ')
          .map(word => word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
    }
    setForm((prev) => {
      const newState = { ...prev, [field]: value };
      if (field === "filingStartDate" || field === "filingFrequency") {
        const startDate = field === "filingStartDate" ? value : prev.filingStartDate;
        const frequency = field === "filingFrequency" ? value : prev.filingFrequency;
        const endDate = calculateEndDate(startDate, frequency);
        newState.filingEndDate = endDate;
      }
      return newState;
    });
    // Validate dates after form update
    setTimeout(() => validateDateLogic(), 0);
  };
  
  // For dynamic compliance fields
  const handleDynamicFieldChange = (fieldName: string, value: string) => {
    setDynamicFieldValues(prev => ({ ...prev, [fieldName]: value }));
  };
  
  const { data: complianceItems = [], isLoading } = useQuery({
    queryKey: ["compliance"],
    queryFn: async () => {
      const response = await fetch("/api/compliance/list");
      if (!response.ok) throw new Error("Failed to fetch compliance filings");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });
  
  useEffect(() => {
    const invalidateCompliance = () => {
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    };
    window.addEventListener("accountChanged", invalidateCompliance);
    window.addEventListener("logout", invalidateCompliance);
    window.addEventListener("login", invalidateCompliance);
    return () => {
      window.removeEventListener("accountChanged", invalidateCompliance);
      window.removeEventListener("logout", invalidateCompliance);
      window.removeEventListener("login", invalidateCompliance);
    };
  }, [queryClient]);

  // Close department dropdown when clicking outside
  useEffect(() => {
    if (!departmentSelectOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target as Node)) {
        setDepartmentSelectOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [departmentSelectOpen]);
  
  // Extract existing filing names for validation (excluding current item if editing)
  const existingFilingNames = complianceItems
    .filter((item: any) => editIndex !== null ? complianceItems.indexOf(item) !== editIndex : true)
    .map((item: any) => item.policy?.toLowerCase().trim())
    .filter(Boolean);
  
  // Function to validate filing name uniqueness
  const validateFilingName = (name: string) => {
    if (!name?.trim()) {
      setFilingNameError("");
      return true;
    }
    
    const normalizedName = name.toLowerCase().trim();
    const isDuplicate = existingFilingNames.includes(normalizedName);
    
    if (isDuplicate) {
      setFilingNameError("Filing name already exists");
      return false;
    }
    
    setFilingNameError("");
    return true;
  };
  
  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/compliance/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to save compliance");
      return response.json();
    },
    onSuccess: (newItem) => {
      queryClient.setQueryData(["compliance"], (oldData: ComplianceItem[]) =>
        oldData ? [...oldData, newItem] : [newItem]
      );
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (_id: string) => {
      const res = await fetch(`/api/compliance/${_id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete compliance item.");
      return _id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(["compliance"], (oldData: ComplianceItem[]) =>
        oldData ? oldData.filter(item => item._id !== deletedId) : []
      );
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    }
  });
  
  const editMutation = useMutation({
    mutationFn: async ({ _id, data }: { _id: string; data: any }) => {
      const res = await fetch(`/api/compliance/${_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update compliance item.");
      return { _id, data };
    },
    onSuccess: ({ _id, data }) => {
      queryClient.setQueryData(["compliance"], (oldData: ComplianceItem[]) =>
        oldData ? oldData.map(item =>
          item._id === _id ? { ...item, ...data } : item
        ) : []
      );
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    }
  });
  
  // EXPORT current (filtered) compliance items to CSV
  const handleExport = () => {
    if (!filteredItems.length) {
      toast({ title: 'No data', description: 'There are no compliance items to export', variant: 'destructive'});
      return;
    }
    const rows = filteredItems.map((item: ComplianceItem) => ({
      Policy: item.policy,
      Category: item.category,
      Status: item.status,
      GoverningAuthority: item.governingAuthority || '',
      StartDate: item.lastAudit ? new Date(item.lastAudit).toISOString().split('T')[0] : '',
      EndDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
      SubmissionDeadline: item.submissionDeadline ? new Date(item.submissionDeadline).toISOString().split('T')[0] : '',
      Frequency: item.frequency || '',
      SubmissionDate: item.filingSubmissionDate ? new Date(item.filingSubmissionDate).toISOString().split('T')[0] : '',
      SubmittedBy: item.submittedBy || '',
      Amount: item.amount || '',
      PaymentDate: item.paymentDate ? new Date(item.paymentDate).toISOString().split('T')[0] : '',
      ReminderDays: item.reminderDays || '',
      ReminderPolicy: item.reminderPolicy || '',
      Remarks: item.remarks || ''
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `compliance_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Compliance data exported to CSV' });
  };

  const triggerImport = () => fileInputRef.current?.click();

  // IMPORT from CSV -> create compliance items
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
              policy: row.Policy || row.policy || '',
              category: row.Category || row.category || '',
              status: row.Status || row.status || 'Pending',
              governingAuthority: row.GoverningAuthority || row.governingAuthority || '',
              lastAudit: row.StartDate || row.startDate || new Date().toISOString().split('T')[0],
              endDate: row.EndDate || row.endDate || '',
              submissionDeadline: row.SubmissionDeadline || row.submissionDeadline || '',
              frequency: row.Frequency || row.frequency || 'Monthly',
              filingSubmissionDate: row.SubmissionDate || row.submissionDate || '',
              submittedBy: row.SubmittedBy || row.submittedBy || '',
              amount: row.Amount || row.amount || '',
              paymentDate: row.PaymentDate || row.paymentDate || '',
              reminderDays: parseInt(row.ReminderDays) || 7,
              reminderPolicy: row.ReminderPolicy || row.reminderPolicy || 'One time',
              remarks: row.Remarks || row.remarks || '',
              issues: 0
            };
            // Basic validation
            if (!payload.policy || !payload.category) { failed++; continue; }
            await fetch('/api/compliance/insert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            success++;
          } catch (err) {
            failed++;
          }
        }
        queryClient.invalidateQueries({ queryKey: ['compliance'] });
        toast({ title: 'Import finished', description: `Imported ${success} row(s). Failed: ${failed}` });
        e.target.value = '';
      },
      error: () => {
        toast({ title: 'Import error', description: 'Failed to parse file', variant: 'destructive'});
      }
    });
  };

  const uniqueCategories = Array.from(new Set(complianceItems.map((item: ComplianceItem) => item.category))).filter(Boolean);
  
  // Sorting handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Filter and sort items
  let filteredItems = complianceItems.filter((item: ComplianceItem) => {
    const matchesSearch = item.policy?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || mapStatus(item.status) === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });
  
  // Apply sorting
  if (sortField) {
    filteredItems = [...filteredItems].sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle date fields
      if (sortField === 'endDate' || sortField === 'submissionDeadline' || sortField === 'filingSubmissionDate') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      
      // Handle string fields
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || '';
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      "Pending": { 
        variant: "outline", 
        icon: <AlertCircle className="h-3 w-3 mr-1" />, 
        color: "bg-amber-50 text-amber-700 border-amber-200" 
      },
      "default": { 
        variant: "outline", 
        icon: <AlertCircle className="h-3 w-3 mr-1" />, 
        color: "bg-gray-100 text-gray-700 border-gray-200" 
      }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.default;
    
    return (
      <Badge className={`${config.color} flex items-center font-medium`} variant={config.variant as any}>
        {config.icon}
        {status}
      </Badge>
    );
  };
  
  // --- Summary Stats Section ---
  const total = complianceItems.length;
  const pending = complianceItems.filter((item: ComplianceItem) => mapStatus(item.status) === "Pending").length;
  
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Modern Professional Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg border border-white/20">
                <ShieldCheck className="h-6 w-6 text-green-600 drop-shadow-glass" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Compliance Management</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = "/compliance-ledger";
                }}
                className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-indigo-200 hover:border-indigo-300 font-medium transition-all duration-200"
              >
                <FileText className="h-4 w-4 mr-2" />
                Compliance Ledger
              </Button>
              
              <Can I="create" a="Compliance">
                <Button
                  onClick={() => {
                    setEditIndex(null);
                    setShowSubmissionDetails(false);
                    setSelectedDepartments([]);
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
                      submissionNotes: "",
                      filingSubmissionDate: "",
                      reminderDays: "7",
                      reminderPolicy: "One time",
                      submittedBy: "",
                      amount: "",
                      paymentDate: "",
                      submissionAmount: "",
                      paymentMethod: "",
                      department: "",
                      departments: [],
                    });
                    setModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Compliance
                </Button>
              </Can>
            </div>
          </div>

          {/* Search and Filters Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search compliance filings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80 border-gray-200 bg-white text-gray-900 placeholder-gray-500 h-10 text-sm"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 border-gray-200 bg-white text-gray-900 h-10 text-sm">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category, idx) => (
                    <SelectItem key={String(category) + idx} value={String(category)}>
                      {String(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Professional Data Table with Frozen Headers */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <Table className="w-full">
              <TableHeader className="sticky top-0 z-20">
                <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <TableHead
                    className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('policy')}
                  >
                    <div className="flex items-center gap-2">
                      Policy
                      {sortField === 'policy' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-2">
                      Category
                      {sortField === 'category' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('endDate')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Due Date
                      {sortField === 'endDate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('filingSubmissionDate')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Submitted Date
                      {sortField === 'filingSubmissionDate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead className="h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">
                    Submission
                  </TableHead>
                  <TableHead className="h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-gray-100">
                      <TableCell colSpan={7} className="px-6 py-4">
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="h-10 w-10 text-gray-300 mb-2" />
                        <p className="text-lg font-medium text-gray-600">No compliance records found</p>
                        <p className="text-gray-500 mt-1">Try adjusting your filters or add a new compliance record</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item: ComplianceItem) => (
                    <TableRow key={item._id || item.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                      <TableCell className="px-4 py-4">
                        <button
                          onClick={() => {
                            const index = (complianceItems as ComplianceItem[]).findIndex(
                              (ci: ComplianceItem) => (ci._id || ci.id) === (item._id || item.id)
                            );
                            setEditIndex(index);
                            setShowSubmissionDetails(false);
                            setModalOpen(true);
                            const currentItem = complianceItems[index] as ComplianceItem;
                            const depts = parseDepartments(currentItem.department);
                            setSelectedDepartments(depts);
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
                              submissionNotes: "",
                              filingSubmissionDate: "",
                              reminderDays: currentItem.reminderDays !== undefined && currentItem.reminderDays !== null ? String(currentItem.reminderDays) : "7",
                              reminderPolicy: currentItem.reminderPolicy || "One time",
                              submittedBy: currentItem.submittedBy || "",
                              amount: currentItem.amount !== undefined && currentItem.amount !== null ? String(currentItem.amount) : "",
                              paymentDate: currentItem.paymentDate || "",
                              submissionAmount: currentItem.submissionAmount !== undefined && currentItem.submissionAmount !== null ? String(currentItem.submissionAmount) : "",
                              paymentMethod: currentItem.paymentMethod !== undefined && currentItem.paymentMethod !== null ? String(currentItem.paymentMethod) : "",
                              department: currentItem.department || "",
                              departments: depts,
                            });
                          }}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 underline hover:no-underline transition-all duration-200 cursor-pointer text-left whitespace-normal break-words"
                        >
                          {item.policy}
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-medium border-blue-200">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        {(() => {
                          // Check if item is a draft first
                          if (item.isDraft || item.status === "Draft") {
                            return (
                              <span className="px-3 py-1 rounded-full text-xs font-medium text-amber-800 bg-amber-100 transition-all duration-300">
                                Draft
                              </span>
                            );
                          }
                          
                          const statusInfo = getComplianceStatus(item.endDate || '', item.submissionDeadline || '');
                          const isLate = statusInfo.status === "Late";
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor} ${
                              isLate ? 'animate-pulse relative' : ''
                            } transition-all duration-300`}>
                              {isLate && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-ping"></span>
                              )}
                              {statusInfo.status}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-gray-700 font-medium">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          <span className="text-sm">{formatDate(item.submissionDeadline)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-gray-700 font-medium">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          <span className="text-sm">{formatDate(item.filingSubmissionDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            title="Submit now"
                            onClick={() => {
                              const index = (complianceItems as ComplianceItem[]).findIndex(
                                (ci: ComplianceItem) => (ci._id || ci.id) === (item._id || item.id)
                              );
                              setEditIndex(index);
                              setShowSubmissionDetails(true);
                              setModalOpen(true);
                              setFilingNameError(""); // Clear any previous errors
                              const currentItem = complianceItems[index] as ComplianceItem;
                              const depts = parseDepartments(currentItem.department);
                              setSelectedDepartments(depts);
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
                                submissionNotes: "",
                                filingSubmissionDate: "",
                                reminderDays: currentItem.reminderDays !== undefined && currentItem.reminderDays !== null ? String(currentItem.reminderDays) : "7",
                                reminderPolicy: currentItem.reminderPolicy || "One time",
                                submittedBy: currentItem.submittedBy || "",
                                amount: currentItem.amount !== undefined && currentItem.amount !== null ? String(currentItem.amount) : "",
                                paymentDate: currentItem.paymentDate || "",
                                submissionAmount: currentItem.submissionAmount !== undefined && currentItem.submissionAmount !== null ? String(currentItem.submissionAmount) : "",
                                paymentMethod: currentItem.paymentMethod !== undefined && currentItem.paymentMethod !== null ? String(currentItem.paymentMethod) : "",
                                department: currentItem.department || "",
                                departments: depts,
                              });
                            }}
                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 hover:text-green-800 font-medium text-sm px-3 py-1 transition-colors"
                          >
                            Submit now
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                        <Can I="update" a="Compliance">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const index = (complianceItems as ComplianceItem[]).findIndex(
                                (ci: ComplianceItem) => (ci._id || ci.id) === (item._id || item.id)
                              );
                              setEditIndex(index);
                              setShowSubmissionDetails(false);
                              setModalOpen(true);
                              const currentItem = complianceItems[index] as ComplianceItem;
                              const depts = parseDepartments(currentItem.department);
                              setSelectedDepartments(depts);
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
                                submissionNotes: "",
                                filingSubmissionDate: "",
                                reminderDays: currentItem.reminderDays !== undefined && currentItem.reminderDays !== null ? String(currentItem.reminderDays) : "7",
                                reminderPolicy: currentItem.reminderPolicy || "One time",
                                submittedBy: currentItem.submittedBy || "",
                                amount: currentItem.amount !== undefined && currentItem.amount !== null ? String(currentItem.amount) : "",
                                paymentDate: currentItem.paymentDate || "",
                                submissionAmount: currentItem.submissionAmount !== undefined && currentItem.submissionAmount !== null ? String(currentItem.submissionAmount) : "",
                                paymentMethod: currentItem.paymentMethod !== undefined && currentItem.paymentMethod !== null ? String(currentItem.paymentMethod) : "",
                                department: currentItem.department || "",
                                departments: depts,
                              });
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors p-2"
                          >
                            <Edit size={16} />
                          </Button>
                        </Can>
                        <Can I="delete" a="Compliance">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm("Do you want to delete this compliance item?")) {
                                deleteMutation.mutate(item._id as string);
                              }
                            }}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors p-2"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </Can>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      
      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) setIsFullscreen(false); setModalOpen(v); }}>
        <DialogContent className={`${isFullscreen ? 'max-w-[95vw] w-[95vw] h-[92vh] max-h-[92vh]' : 'max-w-4xl min-w-[400px] max-h-[80vh]'} overflow-y-auto rounded-2xl border-slate-200 shadow-2xl p-0 bg-white transition-[width,height] duration-300`}>
          {/* Local keyframes for the sheen animation */}
          <style>{`@keyframes sheen { 0% { transform: translateX(-60%); } 100% { transform: translateX(180%); } }`}</style>
          <DialogHeader className={`bg-gradient-to-r from-indigo-500 to-indigo-600 text-white ${isFullscreen ? 'p-4 md:p-5' : 'p-5'} rounded-t-2xl`}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold flex items-center gap-3">
                  <FileText className="h-6 w-6" />
                  {showSubmissionDetails ? "Submission" : (editIndex !== null ? (form.filingName || 'Edit Compliance') : "Compliance")}
                </DialogTitle>
                {/* Dynamic Status Badge - hidden when in Submission view */}
                {!showSubmissionDetails && (() => {
                  const statusInfo = getComplianceStatus(form.filingEndDate, form.filingSubmissionDeadline);
                  const isLate = statusInfo.status === "Late";
                  return (
                    <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusInfo.color} ${statusInfo.bgColor} ${
                      isLate ? 'animate-bounce relative' : ''
                    } transition-all duration-300`}>
                      {isLate && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                      )}
                      {statusInfo.status}
                    </span>
                  );
                })()}
              </div>
              {/* Right side controls: Submission button, fullscreen, View Ledger */}
              <div className="flex items-center gap-3 pr-1 mr-14">
                {/* Submission Toggle Button - highlighted in green theme, now on right */}
                {!showSubmissionDetails && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSubmissionDetails(!showSubmissionDetails)}
                    className={`relative overflow-hidden px-3 py-1 text-sm rounded-lg font-semibold transition-all duration-300
                      bg-gradient-to-r from-emerald-500/70 to-green-600/70 text-white border border-emerald-300/60 hover:from-emerald-500 hover:to-green-600 hover:shadow-[0_8px_16px_rgba(16,185,129,0.25)]
                    `}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Submission
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                  onClick={() => setIsFullscreen(f => !f)}
                  className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold rounded-xl shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 border-indigo-200 h-10 w-10 p-0 flex items-center justify-center"
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
                {editIndex !== null && complianceItems[editIndex]?._id && (
                  <Button
                    type="button"
                    variant="default"
                    className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-4 py-2 flex items-center gap-2 shadow-md transition-all duration-300 rounded-xl"
                    onClick={() => {
                      window.location.href = `/compliance-ledger?id=${complianceItems[editIndex]._id}`;
                    }}
                    title="View Ledger"
                  >
                    <ExternalLink size={16} />
                    View Ledger
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <form className={`${isFullscreen ? 'p-4 md:p-6 lg:p-8' : 'p-6'}`}>
            {/* Show Submission Details when showSubmissionDetails is true */}
            {showSubmissionDetails && (
              <>
                {/* Submission Details heading removed as requested */}
                <div className={`grid gap-6 mb-8 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {/* Submission Date and Submitted By fields */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Submission Date</label>
                    <Input 
                      className={`w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 ${dateErrors.submissionDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                      type="date" 
                      value={form.filingSubmissionDate} 
                      onChange={e => handleFormChange("filingSubmissionDate", e.target.value)} 
                      disabled={editIndex === null}
                    />
                    {dateErrors.submissionDate && (
                      <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {dateErrors.submissionDate}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Submitted By</label>
                    <Select 
                      value={form.submittedBy || ''} 
                      onValueChange={(val: string) => handleFormChange("submittedBy", val)}
                      disabled={editIndex === null}
                    >
                      <SelectTrigger className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                        {isLoadingEmployees ? (
                          <SelectItem value="loading" disabled className="text-slate-500">Loading employees...</SelectItem>
                        ) : employees.length > 0 ? (
                          employees.map((emp: any) => (
                            <SelectItem key={emp._id || emp.id} value={emp._id || emp.id} className="text-slate-900 hover:bg-indigo-50">
                              {emp.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-employees" disabled className="text-slate-500">No employees available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Payment Method and Amount below Submission Date and Submitted By */}
                <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-2">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Payment Method</label>
                    <Select
                      value={form.paymentMethod || ''}
                      onValueChange={(val: string) => handleFormChange("paymentMethod", val)}
                    >
                      <SelectTrigger className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                        {/* Add your payment method options here */}
                        <SelectItem value="Cash" className="text-slate-900 hover:bg-indigo-50">Cash</SelectItem>
                        <SelectItem value="Bank Transfer" className="text-slate-900 hover:bg-indigo-50">Bank Transfer</SelectItem>
                        <SelectItem value="Credit Card" className="text-slate-900 hover:bg-indigo-50">Credit Card</SelectItem>
                        <SelectItem value="Other" className="text-slate-900 hover:bg-indigo-50">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Amount</label>
                    <Input
                      className="w-full border-slate-300 rounded-lg p-2 text-base"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.submissionAmount || ""}
                      onChange={e => handleFormChange("submissionAmount", e.target.value)}
                    />
                  </div>
                </div>

                {/* Remarks under Submission Details for better usability in focused view */}
                <div className="mt-4 mb-8">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Submission Notes</label>
                  <Textarea
                    className="w-full border-slate-300 rounded-lg text-base min-h-[120px] md:min-h-[140px] resize-y focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 p-4"
                    value={form.submissionNotes}
                    onChange={(e) => handleFormChange("submissionNotes", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Show Compliance Details when not viewing Submission Details */}
            {!showSubmissionDetails && (
              <>
                {/* Compliance Details heading removed as requested */}
            {/* General Information Grid - expands to more columns in fullscreen */}
            <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-2'}`}>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Filing Name <span className="text-red-500">*</span>
                </label>
                <Input 
                  className={`w-full border-slate-300 rounded-lg p-2 text-base ${filingNameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  value={form.filingName}
                  onChange={e => handleFormChange("filingName", e.target.value)}
                  onBlur={() => validateFilingName(form.filingName)}
                />
                {filingNameError && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {filingNameError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Filing Frequency</label>
                <Select value={form.filingFrequency} onValueChange={(val: string) => handleFormChange("filingFrequency", val)}>
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    <SelectItem value="Monthly" className="text-slate-900 hover:bg-indigo-50">Monthly</SelectItem>
                    <SelectItem value="Quarterly" className="text-slate-900 hover:bg-indigo-50">Quarterly</SelectItem>
                    <SelectItem value="Yearly" className="text-slate-900 hover:bg-indigo-50">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Compliance Category <span className="text-red-500">*</span>
                </label>
                <Select value={form.filingComplianceCategory} onValueChange={(val: string) => handleFormChange("filingComplianceCategory", val)}>
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    <SelectItem value="Tax" className="text-slate-900 hover:bg-indigo-50">Tax</SelectItem>
                    <SelectItem value="Payroll" className="text-slate-900 hover:bg-indigo-50">Payroll</SelectItem>
                    <SelectItem value="Regulatory" className="text-slate-900 hover:bg-indigo-50">Regulatory</SelectItem>
                    <SelectItem value="Legal" className="text-slate-900 hover:bg-indigo-50">Legal</SelectItem>
                    
                    <SelectItem value="Other" className="text-slate-900 hover:bg-indigo-50">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Governing Authority</label>
                <div className="relative governing-authority-dropdown">
                  <div className="relative">
                    <Input
                      className="w-full border-slate-300 rounded-lg p-2 pr-10 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Enter or select authority"
                      value={form.filingGoverningAuthority || ''}
                      onChange={(e) => {
                        handleFormChange('filingGoverningAuthority', e.target.value);
                        // Show dropdown when user starts typing
                        if (e.target.value && !isGoverningAuthorityOpen) {
                          setIsGoverningAuthorityOpen(true);
                        }
                      }}
                      onFocus={() => {
                        // Show dropdown on focus if there's text
                        if (form.filingGoverningAuthority) {
                          setIsGoverningAuthorityOpen(true);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                      onClick={() => setIsGoverningAuthorityOpen(!isGoverningAuthorityOpen)}
                    >
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {isGoverningAuthorityOpen && (() => {
                    // Filter authorities based on input text
                    const filteredAuthorities = GOVERNING_AUTHORITIES.filter(authority =>
                      authority.toLowerCase().includes((form.filingGoverningAuthority || "").toLowerCase())
                    );
                    
                    return (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-[200px] overflow-hidden">
                        <div className="max-h-[180px] overflow-y-auto p-1">
                          <div className="text-xs font-semibold tracking-wide text-slate-500 px-2 py-1 uppercase">Authorities</div>
                          {filteredAuthorities.length > 0 ? (
                            filteredAuthorities.map(authority => (
                              <div
                                key={authority}
                                className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer rounded"
                                onClick={() => {
                                  handleFormChange('filingGoverningAuthority', authority);
                                  setIsGoverningAuthorityOpen(false);
                                }}
                              >
                                {authority}
                              </div>
                            ))
                          ) : form.filingGoverningAuthority ? (
                            <div className="px-3 py-2 text-sm text-slate-500">
                              No matching authorities found
                            </div>
                          ) : (
                            GOVERNING_AUTHORITIES.map(authority => (
                              <div
                                key={authority}
                                className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer rounded"
                                onClick={() => {
                                  handleFormChange('filingGoverningAuthority', authority);
                                  setIsGoverningAuthorityOpen(false);
                                }}
                              >
                                {authority}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              {/* Department field with dropdown - matching subscription modal exactly */}
              <div className="space-y-2 relative" ref={departmentDropdownRef}>
                <label className="block text-sm font-medium text-slate-700">Departments</label>
                <div className="relative">
                  <div
                    className="w-full border border-slate-300 rounded-lg p-2 text-base min-h-[44px] flex items-start justify-start overflow-hidden bg-gray-50 cursor-pointer focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-200"
                    onClick={() => setDepartmentSelectOpen(true)}
                    tabIndex={0}
                    onFocus={() => setDepartmentSelectOpen(true)}
                  >
                    {selectedDepartments.length > 0 ? (
                      <div className="flex flex-wrap gap-1 w-full">
                        {selectedDepartments.map((dept) => (
                          <Badge key={dept} variant="secondary" className="flex items-center gap-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 text-xs py-1 px-2 max-w-full">
                            <span className="truncate max-w-[80px]">{dept}</span>
                            <button
                              type="button"
                              data-remove-dept="true"
                              onClick={(e) => { 
                                e.preventDefault();
                                e.stopPropagation(); 
                                removeDepartment(dept); 
                              }}
                              className="ml-1 rounded-full hover:bg-indigo-300 flex-shrink-0"
                              tabIndex={-1}
                            >
                              <X className="h-3 w-3" data-remove-dept="true" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">Select departments</span>
                    )}
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setDepartmentSelectOpen(!departmentSelectOpen); }}
                    />
                  </div>
                </div>
                {selectedDepartments.includes('Company Level') && (
                  <p className="mt-1 text-xs text-slate-500">All departments are selected</p>
                )}
                {departmentSelectOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto custom-scrollbar">
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
                    {Array.isArray(departments) && departments.length > 0 ? (
                      departments
                        .filter(dept => dept.visible)
                        .map(dept => (
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
                    <div
                      className="font-medium border-t border-gray-200 mt-2 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
                      style={{ marginTop: '4px', minHeight: '40px', display: 'flex', alignItems: 'center' }}
                      onClick={() => setDepartmentModal({ show: true })}
                    >
                      + New
                    </div>
                    {Array.isArray(departments) && departments.filter(dept => dept.visible).length === 0 && (
                      <div className="dropdown-item disabled text-gray-400">No departments found</div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Added date range & deadline fields moved from previous Submission Details section */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <Input 
                  className={`w-full border-slate-300 rounded-lg p-2 text-base ${dateErrors.startDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  type="date" 
                  value={form.filingStartDate} 
                  onChange={e => handleFormChange("filingStartDate", e.target.value)} 
                />
                {dateErrors.startDate && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {dateErrors.startDate}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  End Date <span className="text-red-500">*</span>
                </label>
                <Input 
                  className={`w-full border-slate-300 rounded-lg p-2 text-base ${dateErrors.endDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  type="date" 
                  value={form.filingEndDate} 
                  onChange={e => handleFormChange("filingEndDate", e.target.value)} 
                />
                {dateErrors.endDate && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {dateErrors.endDate}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Submission Deadline</label>
                <Input 
                  className={`w-full border-slate-300 rounded-lg p-2 text-base ${dateErrors.submissionDeadline ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  type="date" 
                  value={form.filingSubmissionDeadline} 
                  onChange={e => handleFormChange("filingSubmissionDeadline", e.target.value)} 
                />
                {dateErrors.submissionDeadline && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {dateErrors.submissionDeadline}
                  </p>
                )}
              </div>
              {/* Moved Reminder Days and Reminder Policy into Compliance Details */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Reminder Days</label>
                <Input 
                  className="w-full border-slate-300 rounded-lg p-2 text-base" 
                  type="number" 
                  value={form.reminderDays} 
                  onChange={e => handleFormChange("reminderDays", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Reminder Policy</label>
                <Select value={form.reminderPolicy} onValueChange={(val: string) => handleFormChange("reminderPolicy", val)}>
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    <SelectItem value="One time" className="text-slate-900 hover:bg-indigo-50">One time</SelectItem>
                    <SelectItem value="Two times" className="text-slate-900 hover:bg-indigo-50">Two times</SelectItem>
                    <SelectItem value="Until Renewal" className="text-slate-900 hover:bg-indigo-50">Until Renewal</SelectItem>
                  </SelectContent>
                </Select>
                <ul className="text-xs text-slate-600 mt-2 list-disc pl-4">
                  <li>One time: One reminder at {form.reminderDays} days before renewal</li>
                  <li>Two times: Reminders at {form.reminderDays} and 3 days before</li>
                  <li>Until Renewal: Daily reminders from {form.reminderDays} days until renewal</li>
                </ul>
              </div>
              {/* Card-based Notes Section (like subscription modal) */}
              {!showSubmissionDetails && (
              <div className="col-span-full mb-6">
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
              )}
              
              {/* Dynamic Compliance Fields - Now placed after default fields */}
              {isLoadingComplianceFields ? (
                <div className="col-span-full text-center text-slate-500">Loading compliance fields...</div>
              ) : (
                complianceFields.filter(f => f.enabled).map(field => (
                  <div className="space-y-2" key={field._id || field.name}>
                    <label className="block text-sm font-medium text-slate-700">
                      {field.name}
                      {field.required ? <span className="text-red-500 ml-1">*</span> : null}
                      {field.description && <span className="block text-xs text-slate-500">{field.description}</span>}
                    </label>
                    <Input
                      className="w-full border-slate-300 rounded-lg p-2 text-base"
                      value={dynamicFieldValues[field.name] || ''}
                      onChange={e => handleDynamicFieldChange(field.name, e.target.value)}
                      
                      required={!!field.required}
                    />
                  </div>
                ))
              )}
            </div>
            </>
            )}
            
            {/* Removed duplicate Reminder and Remarks sections; these fields are now in Compliance Details */}

            {/* Always show action buttons (including in Submission view) */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-6 py-2"
                onClick={() => {
                  setModalOpen(false);
                  setFilingNameError("");
                  setEditIndex(null);
                }}
              >
                Exit
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-6 py-2"
                onClick={async () => {
                  // Check for filing name validation errors
                  if (filingNameError) {
                    toast({
                      title: "Validation Error",
                      description: "Please fix the filing name error before saving",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Validate filing name uniqueness one more time before saving
                  if (form.filingName && !validateFilingName(form.filingName)) {
                    return;
                  }
                  
                  // Validate required fields
                  if (!validateRequiredFields()) {
                    return;
                  }
                  
                  // Validate dates before saving draft
                  if (!validateDateLogic()) {
                    toast({
                      title: "Validation Error",
                      description: "Please fix the date validation errors before saving",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Save as draft logic - save the compliance item with current form data
                  let saveData = {
                    policy: form.filingName,
                    category: form.filingComplianceCategory,
                    status: "Draft", // Set status to "Draft" for draft items
                    lastAudit: form.filingStartDate,
                    issues: 0,
                    frequency: form.filingFrequency,
                    governingAuthority: form.filingGoverningAuthority,
                    endDate: form.filingEndDate,
                    submissionDeadline: form.filingSubmissionDeadline,
                    recurringFrequency: form.filingRecurringFrequency,
                    remarks: form.filingRemarks,
                    filingSubmissionDate: form.filingSubmissionDate,
                    reminderDays: form.reminderDays,
                    reminderPolicy: form.reminderPolicy,
                    submittedBy: form.submittedBy,
                    amount: form.amount,
                    paymentDate: form.paymentDate,
                    department: form.department,
                    departments: selectedDepartments,
                    complianceFieldValues: dynamicFieldValues,
                    isDraft: true // Mark as draft
                  };

                  try {
                    if (editIndex !== null) {
                      const itemToEdit = complianceItems[editIndex] as ComplianceItem;
                      if (itemToEdit._id) {
                        await editMutation.mutateAsync({ _id: itemToEdit._id, data: saveData });
                      }
                    } else {
                      await addMutation.mutateAsync(saveData);
                    }
                    toast({ title: 'Draft saved successfully' });
                    
                    // Close modal and reset form after saving draft
                    setModalOpen(false);
                    setEditIndex(null);
                    setShowSubmissionDetails(false);
                    setSelectedDepartments([]);
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
                      submissionNotes: "",
                      filingSubmissionDate: "",
                      reminderDays: "7",
                      reminderPolicy: "One time",
                      submittedBy: "",
                      amount: "",
                      paymentDate: "",
                      submissionAmount: "",
                      paymentMethod: "",
                      department: "",
                      departments: [],
                    });
                    setDynamicFieldValues({});
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'Failed to save draft',
                      variant: 'destructive'
                    });
                  }
                }}
              >
                Save Draft
              </Button>
              <Button 
                type="button" 
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium px-6 py-2 shadow-md hover:shadow-lg"
                onClick={async () => {
                  // Check for filing name validation errors
                  if (filingNameError) {
                    toast({
                      title: "Validation Error",
                      description: "Please fix the filing name error before saving",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Validate filing name uniqueness one more time before saving
                  if (form.filingName && !validateFilingName(form.filingName)) {
                    return;
                  }
                  
                  // Validate required fields
                  if (!validateRequiredFields()) {
                    return;
                  }
                  
                  // Validate dates before saving compliance
                  if (!validateDateLogic()) {
                    toast({
                      title: "Validation Error", 
                      description: "Please fix the date validation errors before saving",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  const hasSubmissionDate = !!form.filingSubmissionDate;
                  const hasSubmittedBy = !!form.submittedBy;
                  let newStartDate = form.filingStartDate;
                  let newEndDate = form.filingEndDate;
                  let newSubmissionDeadline = form.filingSubmissionDeadline;
                  const frequency = form.filingFrequency || form.filingRecurringFrequency || "Monthly";
                  
                  // Calculate the actual status to store in database
                  const calculatedStatus = getComplianceStatus(newEndDate, newSubmissionDeadline);
                  
                  // Merge dynamic field values into saveData
                  let saveData = {
                    policy: form.filingName,
                    category: form.filingComplianceCategory,
                    status: calculatedStatus.status, // Use calculated status instead of hardcoded "Non-Compliant"
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
                    department: form.department,
                    departments: selectedDepartments,
                    complianceFieldValues: dynamicFieldValues // <--- store dynamic field values
                  };
                  // Get complianceId for ledger entry if editing
                  let complianceId = null;
                  if (editIndex !== null && complianceItems[editIndex]?._id) {
                    complianceId = complianceItems[editIndex]._id;
                  }
                  if (hasSubmissionDate && hasSubmittedBy) {
                    const currentEndDate = new Date(form.filingEndDate);
                    if (!isNaN(currentEndDate.getTime())) {
                      const nextStartDateObj = new Date(currentEndDate);
                      nextStartDateObj.setDate(currentEndDate.getDate() + 1);
                      newStartDate = `${nextStartDateObj.getFullYear()}-${String(nextStartDateObj.getMonth() + 1).padStart(2, "0")}-${String(nextStartDateObj.getDate()).padStart(2, "0")}`;
                      newEndDate = calculateEndDate(newStartDate, frequency);
                      let prevDeadline = new Date(form.filingSubmissionDeadline);
                      if (!isNaN(prevDeadline.getTime())) {
                        let nextDeadline = new Date(prevDeadline);
                        if (frequency === "Monthly") {
                          nextDeadline.setMonth(prevDeadline.getMonth() + 1);
                        } else if (frequency === "Quarterly") {

                          nextDeadline.setMonth(prevDeadline.getMonth() + 3);
                        } else if (frequency === "Yearly") {
                          nextDeadline.setFullYear(prevDeadline.getFullYear() + 1);
                        }
                        const yyyy = nextDeadline.getFullYear();
                        const mm = String(nextDeadline.getMonth() + 1).padStart(2, "0");
                        const dd = String(nextDeadline.getDate()).padStart(2, "0");
                        newSubmissionDeadline = `${yyyy}-${mm}-${dd}`;
                      } else {
                        newSubmissionDeadline = newStartDate;
                      }
                    }
                    // Recalculate status for the new period dates
                    const newPeriodStatus = getComplianceStatus(newEndDate, newSubmissionDeadline);
                    
                    saveData = {
                      ...saveData,
                      lastAudit: newStartDate,
                      endDate: newEndDate,
                      submissionDeadline: newSubmissionDeadline,
                      status: newPeriodStatus.status // Update status for new period
                    };
                  }
                  if (editIndex !== null) {
                    const itemToEdit = complianceItems[editIndex] as ComplianceItem;
                    if (itemToEdit._id) {
                      await editMutation.mutateAsync({ _id: itemToEdit._id, data: saveData });
                      queryClient.setQueryData(["compliance"], (oldData: ComplianceItem[]) =>
                        oldData ? oldData.map((item, idx) =>
                          idx === editIndex ? { ...item, ...saveData } : item
                        ) : []
                      );
                      complianceId = itemToEdit._id; // ensure we have id for ledger
                    }
                  } else {
                    // Capture returned new compliance to get its _id for ledger linkage
                    const newItem: any = await addMutation.mutateAsync(saveData);
                    if (newItem && (newItem._id || newItem.id)) {
                      complianceId = newItem._id || newItem.id;
                    }
                  }
                  if (hasSubmissionDate && hasSubmittedBy) {
                    try {
                      const ledgerData = {
                        ...form,
                        // Use submissionNotes for ledger remarks
                        filingRemarks: form.submissionNotes,
                        complianceId: complianceId
                      };
                      const res = await fetch('/api/ledger/insert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(ledgerData)
                      });
                      if (!res.ok) throw new Error('Failed to save ledger data');
                      toast({ title: 'Ledger entry created' });
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to create ledger',
                        variant: 'destructive'
                      });
                    }
                  }
                  setForm((prev) => ({
                    ...prev,
                    filingStartDate: hasSubmissionDate && hasSubmittedBy ? newStartDate : prev.filingStartDate,
                    filingEndDate: hasSubmissionDate && hasSubmittedBy ? newEndDate : prev.filingEndDate,
                    filingSubmissionDeadline: hasSubmissionDate && hasSubmittedBy ? newSubmissionDeadline : prev.filingSubmissionDeadline,
                    filingSubmissionStatus: "Pending",
                    filingSubmissionDate: "",
                    submissionNotes: "",
                    amount: "",
                    paymentDate: ""
                  }));
                  setDynamicFieldValues({});
                  setModalOpen(false);
                  setEditIndex(null);
                }}
              >
                Save Compliance
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".csv"
        style={{ display: 'none' }}
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
  );
}