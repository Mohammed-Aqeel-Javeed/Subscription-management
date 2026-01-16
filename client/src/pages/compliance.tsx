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
import { Plus, Edit, Trash2, Search, Calendar, FileText, AlertCircle, ExternalLink, Maximize2, Minimize2, ShieldCheck, Upload, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check } from "lucide-react";
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

const AMOUNT_MAX_10CR = 100000000;
const REMINDER_DAYS_MAX = 1000;

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
    'comn': 'com',
    'rog': 'org',
    'ogr': 'org',
    'nte': 'net',
    'ent': 'net'
  };
  
  if (typoTLDs[tld.toLowerCase()]) {
    return { valid: false, error: `Did you mean .${typoTLDs[tld.toLowerCase()]}? Please check the spelling` };
  }

  return { valid: true };
};

// Helper functions remain the same
const mapStatus = (status: string): string => {
  void status;
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
export default function Compliance() {
  // --- Dynamic Compliance Fields ---
  const [complianceFields, setComplianceFields] = useState<any[]>([]);
  const [isLoadingComplianceFields, setIsLoadingComplianceFields] = useState(true);
  
  // State for categories and governing authorities
  const [, setCategories] = useState<string[]>([]);
  const [governingAuthorities, setGoverningAuthorities] = useState<string[]>([]);
  const [, setIsLoadingDropdowns] = useState(true);
  
  // Fullscreen toggle state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [complianceToDelete, setComplianceToDelete] = useState<ComplianceItem | null>(null);
  
  // Exit confirmation dialog state
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  
  // Governing Authority dropdown (match other searchable dropdowns)
  const [governingAuthorityOpen, setGoverningAuthorityOpen] = useState(false);
  const [governingAuthoritySearch, setGoverningAuthoritySearch] = useState('');
  const governingAuthorityDropdownRef = useRef<HTMLDivElement>(null);
  
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
    owner?: string;
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
  const [statusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  const [submissionOpenedFromTable, setSubmissionOpenedFromTable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const [submissionDocuments, setSubmissionDocuments] = useState<Array<{ name: string; url: string }>>([]);
  const [showSubmissionDocumentDialog, setShowSubmissionDocumentDialog] = useState(false);

  const [submittedByOpen, setSubmittedByOpen] = useState(false);
  const [submittedBySearch, setSubmittedBySearch] = useState('');
  const submittedByDropdownRef = useRef<HTMLDivElement>(null);

  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const ownerDropdownRef = useRef<HTMLDivElement>(null);

  // Owner '+ New' employee creation modal (match Subscription modal)
  const [ownerModal, setOwnerModal] = useState<{ show: boolean }>({ show: false });
  const [newOwnerName, setNewOwnerName] = useState<string>('');
  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('');
  const [newOwnerEmailError, setNewOwnerEmailError] = useState<string>('');
  const [newOwnerRole, setNewOwnerRole] = useState<string>('');
  const [newOwnerStatus, setNewOwnerStatus] = useState<string>('active');
  const [newOwnerDepartment, setNewOwnerDepartment] = useState<string>('');

  const [ownerDeptOpen, setOwnerDeptOpen] = useState(false);
  const [ownerDeptSearch, setOwnerDeptSearch] = useState('');
  const ownerDeptDropdownRef = useRef<HTMLDivElement>(null);

  // Payment Method dropdown + modal (matching subscription modal logic)
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [paymentMethodSearch, setPaymentMethodSearch] = useState('');
  const paymentMethodDropdownRef = useRef<HTMLDivElement>(null);
  const [paymentMethodModal, setPaymentMethodModal] = useState<{ show: boolean }>({ show: false });
  const [newPaymentMethodName, setNewPaymentMethodName] = useState<string>('');
  const [newPaymentMethodType, setNewPaymentMethodType] = useState<string>('');
  const [newPaymentMethodOwner, setNewPaymentMethodOwner] = useState<string>('');
  const [newPaymentMethodManagedBy, setNewPaymentMethodManagedBy] = useState<string>('');
  const [pmOwnerOpen, setPmOwnerOpen] = useState(false);
  const [pmOwnerSearch, setPmOwnerSearch] = useState('');
  const pmOwnerDropdownRef = useRef<HTMLDivElement>(null);
  const [pmManagedOpen, setPmManagedOpen] = useState(false);
  const [pmManagedSearch, setPmManagedSearch] = useState('');
  const pmManagedDropdownRef = useRef<HTMLDivElement>(null);
  const [newPaymentMethodFinancialInstitution, setNewPaymentMethodFinancialInstitution] = useState<string>('');
  const [newPaymentMethodLast4Digits, setNewPaymentMethodLast4Digits] = useState<string>('');
  const [newPaymentMethodExpiresAt, setNewPaymentMethodExpiresAt] = useState<string>('');
  const [newPaymentMethodCardImage, setNewPaymentMethodCardImage] = useState<string>('visa');
  const [isCreatingPaymentMethod, setIsCreatingPaymentMethod] = useState<boolean>(false);

  // Validation error dialog (used by Payment Method modal like subscription modal)
  const [validationErrorOpen, setValidationErrorOpen] = useState(false);
  const [validationErrorMessage, setValidationErrorMessage] = useState("");
  
  const createEmptyForm = () => ({
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
    owner: "",
    amount: "",
    paymentDate: "",
    submissionAmount: "",
    paymentMethod: "",
    department: "",
    departments: [] as string[],
  });

  const [form, setForm] = useState(createEmptyForm);
  
  // Department management state
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [departmentModal, setDepartmentModal] = useState<{show: boolean}>({show: false});
  const [departmentSelectOpen, setDepartmentSelectOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState<string>('');
  const [newDepartmentHead, setNewDepartmentHead] = useState<string>('');
  const [deptHeadOpen, setDeptHeadOpen] = useState(false);
  const [deptHeadSearch, setDeptHeadSearch] = useState('');
  const deptHeadDropdownRef = useRef<HTMLDivElement>(null);
  const [newDepartmentEmail, setNewDepartmentEmail] = useState<string>('');
  const [newDepartmentEmailError, setNewDepartmentEmailError] = useState<string>('');
  const [isDepartmentEmailLocked, setIsDepartmentEmailLocked] = useState<boolean>(false);
  
  // Notes management state (card-based like subscription modal)
  const [notes, setNotes] = useState<Array<{id: string, text: string, createdAt: string, createdBy: string}>>([]);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showViewNoteDialog, setShowViewNoteDialog] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{id: string, text: string, createdAt: string, createdBy: string} | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  
  // Get current user name for notes (same logic as subscription modal)
  const [currentUserName, setCurrentUserName] = useState<string>('');

  const handleSubmissionDocumentUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    // Allowed file types: PDF (preferred), Word, Excel, and images
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0] as File | undefined;
      if (!file) return;

      const fileName = file.name.toLowerCase();
      const fileExt = fileName.substring(fileName.lastIndexOf('.'));

      const blockedExtensions = [
        '.exe', '.msi', '.bat', '.cmd', '.sh', '.apk',
        '.js', '.php', '.html', '.py', '.xml',
        '.zip', '.rar', '.7z', '.tar',
        '.env', '.sql', '.db', '.ini', '.csv'
      ];
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];

      if (blockedExtensions.includes(fileExt)) {
        toast({
          title: 'File Type Not Allowed',
          description: `${fileExt} files are not permitted for security reasons`,
          variant: 'destructive',
          duration: 3000,
        });
        return;
      }

      if (!allowedExtensions.includes(fileExt)) {
        toast({
          title: 'Invalid File Type',
          description: 'Only PDF, Word, Excel, and image files are allowed',
          variant: 'destructive',
          duration: 3000,
        });
        return;
      }

      const validateFileType = async (uploadFile: File): Promise<boolean> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = (ev) => {
            if (!ev.target?.result) {
              resolve(false);
              return;
            }

            const arr = new Uint8Array(ev.target.result as ArrayBuffer).subarray(0, 8);
            let header = '';
            for (let i = 0; i < arr.length; i++) {
              header += arr[i].toString(16).padStart(2, '0');
            }

            const signatures: { [key: string]: string[] } = {
              pdf: ['25504446'],
              jpg: ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
              png: ['89504e47'],
              doc: ['d0cf11e0'],
              docx: ['504b0304'],
              xlsx: ['504b0304'],
              xls: ['d0cf11e0'],
            };

            const isValid = Object.values(signatures).some((sigs) => sigs.some((sig) => header.startsWith(sig)));
            resolve(isValid);
          };
          reader.readAsArrayBuffer(uploadFile.slice(0, 8));
        });
      };

      const isValidFile = await validateFileType(file);
      if (!isValidFile) {
        toast({
          title: 'Invalid File',
          description: 'File content does not match the extension. Please upload a valid document.',
          variant: 'destructive',
          duration: 4000,
        });
        return;
      }

      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setSubmissionDocuments((prev) => [...(Array.isArray(prev) ? prev : []), { name: file.name, url: base64String }]);
          toast({
            title: 'Success',
            description: `${file.name} uploaded successfully`,
            duration: 2000,
            variant: 'success',
          });
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to process document',
          variant: 'destructive',
        });
      }
    };
    input.click();
  };
  
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
  const { data: employees = [], isLoading: isLoadingEmployees, refetch: refetchEmployees } = useQuery({
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

  // Keep naming aligned with subscription modal logic
  const employeesData = employees;

  const getEmployeeId = (emp: any) => String(emp?._id || emp?.id || emp?.email || emp?.name || '');
  const getEmployeeName = (emp: any) => String(emp?.name || '').trim();
  const getEmployeeEmail = (emp: any) => String(emp?.email || '').trim();

  const selectedSubmittedByEmployee = (Array.isArray(employeesData) ? employeesData : []).find(
    (emp: any) => getEmployeeId(emp) === String(form.submittedBy || '')
  );
  const submittedByDisplayValue = selectedSubmittedByEmployee ? getEmployeeName(selectedSubmittedByEmployee) : '';
  
  // Query for departments
  const { data: departments, isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/company/departments"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/company/departments`, { credentials: "include" });
      return res.json();
    }
  });

  // Fetch payment methods for dynamic dropdown (same source as subscription modal)
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading } = useQuery<any[]>({
    queryKey: ['/api/payment'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/payment`, { credentials: 'include' });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
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

    // Prevent duplicates (case-insensitive)
    const normalizedNewName = newDepartmentName.trim().toLowerCase();
    const exists = (Array.isArray(departments) ? departments : []).some(
      (d: any) => String(d?.name || '').trim().toLowerCase() === normalizedNewName
    );
    if (exists) {
      toast({
        title: "Department already exists",
        variant: "destructive",
      });
      return;
    }

    // Validate department head
    if (!newDepartmentHead.trim()) {
      toast({
        title: "Validation Error",
        description: "Department head is required",
        variant: "destructive",
      });
      return;
    }

    // Validate email
    const emailValidation = validateEmail(newDepartmentEmail);
    if (!emailValidation.valid) {
      setNewDepartmentEmailError(emailValidation.error || 'Invalid email');
      return;
    }
    
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
      setNewDepartmentEmailError('');
      setDeptHeadSearch('');
      setDeptHeadOpen(false);
      setIsDepartmentEmailLocked(false);
      setDepartmentModal({ show: false });
      toast({ title: "Department added successfully" });
    } catch (error) {
      console.error('Error adding department:', error);
      toast({ title: "Failed to add department", variant: "destructive" });
    }
  };

  // Owner modal Department dropdown: close on outside click
  useEffect(() => {
    if (!ownerDeptOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (ownerDeptDropdownRef.current && !ownerDeptDropdownRef.current.contains(event.target as Node)) {
        setOwnerDeptOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ownerDeptOpen]);

  // Keep Owner modal Department input text in sync when opening the modal
  useEffect(() => {
    if (ownerModal.show) {
      setOwnerDeptSearch(newOwnerDepartment || '');
    }
  }, [ownerModal.show, newOwnerDepartment]);

  // Handle adding new owner (employee)
  const handleAddOwner = async () => {
    if (!newOwnerName.trim() || !newOwnerEmail.trim()) return;

    const emailValidation = validateEmail(newOwnerEmail.trim());
    if (!emailValidation.valid) {
      setNewOwnerEmailError(emailValidation.error || 'Invalid email address');
      toast({
        title: 'Invalid Email',
        description: emailValidation.error || 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    if (!newOwnerDepartment) {
      toast({
        title: 'Department Required',
        description: 'Please select a department',
        variant: 'destructive',
      });
      return;
    }

    const nameExists = (Array.isArray(employeesData) ? employeesData : []).some((emp: any) =>
      getEmployeeName(emp).toLowerCase().trim() === newOwnerName.trim().toLowerCase()
    );
    if (nameExists) {
      toast({ title: 'Error', description: 'An employee with this name already exists', variant: 'destructive' });
      return;
    }

    const emailExists = (Array.isArray(employeesData) ? employeesData : []).some((emp: any) =>
      getEmployeeEmail(emp).toLowerCase() === newOwnerEmail.trim().toLowerCase()
    );
    if (emailExists) {
      toast({ title: 'Error', description: 'An employee with this email already exists', variant: 'destructive' });
      return;
    }

    try {
      await apiRequest('POST', '/api/employees', {
        name: newOwnerName.trim(),
        email: newOwnerEmail.trim(),
        role: newOwnerRole,
        status: newOwnerStatus,
        department: newOwnerDepartment,
      });

      await refetchEmployees();

      setForm((prev: any) => ({ ...prev, owner: newOwnerName.trim() }));
      setOwnerSearch('');
      setOwnerOpen(false);

      setNewOwnerName('');
      setNewOwnerEmail('');
      setNewOwnerEmailError('');
      setNewOwnerRole('');
      setNewOwnerStatus('active');
      setNewOwnerDepartment('');
      setOwnerModal({ show: false });

      toast({ title: 'Success', description: 'Employee added successfully', variant: 'success' });
    } catch (error) {
      console.error('Error adding owner:', error);
      toast({ title: 'Error', description: 'Failed to add employee. Please try again.', variant: 'destructive' });
    }
  };

  // Auto-fill and lock department email when head is selected (same as subscription modal)
  useEffect(() => {
    if (newDepartmentHead && employeesData && employeesData.length > 0) {
      const selectedEmp = employeesData.find((emp: any) => emp.name === newDepartmentHead);
      if (selectedEmp && selectedEmp.email) {
        setNewDepartmentEmail(selectedEmp.email);
        setIsDepartmentEmailLocked(true);
        setNewDepartmentEmailError('');
      } else {
        setIsDepartmentEmailLocked(false);
      }
    } else {
      setIsDepartmentEmailLocked(false);
    }
  }, [newDepartmentHead, employeesData]);

  // Department Head dropdown: close on outside click
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

  // Keep Department Head input text in sync when opening the modal
  useEffect(() => {
    if (departmentModal.show) {
      setDeptHeadSearch(newDepartmentHead || '');
    }
  }, [departmentModal.show]);

  // Close payment method dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paymentMethodDropdownRef.current && !paymentMethodDropdownRef.current.contains(event.target as Node)) {
        setPaymentMethodOpen(false);
        setPaymentMethodSearch('');
      }
    };

    if (paymentMethodOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [paymentMethodOpen]);

  // Close governing authority dropdown when clicking outside
  useEffect(() => {
    if (!governingAuthorityOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (governingAuthorityDropdownRef.current && !governingAuthorityDropdownRef.current.contains(event.target as Node)) {
        setGoverningAuthorityOpen(false);
        setGoverningAuthoritySearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [governingAuthorityOpen]);

  // Payment Method modal Owner/Managed-by dropdowns: close on outside click
  useEffect(() => {
    if (!pmOwnerOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (pmOwnerDropdownRef.current && !pmOwnerDropdownRef.current.contains(event.target as Node)) {
        setPmOwnerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pmOwnerOpen]);

  useEffect(() => {
    if (!pmManagedOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (pmManagedDropdownRef.current && !pmManagedDropdownRef.current.contains(event.target as Node)) {
        setPmManagedOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pmManagedOpen]);

  // Keep input text in sync when opening the payment method modal
  useEffect(() => {
    if (paymentMethodModal.show) {
      setPmOwnerSearch(newPaymentMethodOwner || '');
      setPmManagedSearch(newPaymentMethodManagedBy || '');
    }
  }, [paymentMethodModal.show, newPaymentMethodOwner, newPaymentMethodManagedBy]);

  // Handle adding new payment method (copied behaviour from subscription modal)
  const handleAddPaymentMethod = async () => {
    if (!newPaymentMethodName.trim()) return;
    if (isCreatingPaymentMethod) return;

    const duplicateName = (Array.isArray(paymentMethods) ? paymentMethods : []).find(
      (method: any) =>
        String(method?.name || '').toLowerCase().trim() === newPaymentMethodName.toLowerCase().trim() ||
        String(method?.title || '').toLowerCase().trim() === newPaymentMethodName.toLowerCase().trim()
    );

    if (duplicateName) {
      setValidationErrorMessage(`A payment method with the name "${newPaymentMethodName.trim()}" already exists. Please use a different name.`);
      setValidationErrorOpen(true);
      return;
    }

    if (newPaymentMethodExpiresAt) {
      const [year, month] = newPaymentMethodExpiresAt.split('-');
      const expiryDate = new Date(parseInt(year), parseInt(month) - 1);
      const today = new Date();
      today.setDate(1);
      today.setHours(0, 0, 0, 0);
      if (expiryDate < today) {
        setValidationErrorMessage('Card expiry date cannot be in the past');
        setValidationErrorOpen(true);
        return;
      }
    }

    setIsCreatingPaymentMethod(true);
    try {
      const paymentData = {
        name: newPaymentMethodName.trim(),
        title: newPaymentMethodName.trim(),
        type: newPaymentMethodType,
        owner: newPaymentMethodOwner.trim(),
        manager: newPaymentMethodManagedBy.trim(),
        financialInstitution: newPaymentMethodFinancialInstitution.trim(),
        lastFourDigits: newPaymentMethodLast4Digits.trim(),
        expiresAt: newPaymentMethodExpiresAt,
        icon: newPaymentMethodCardImage,
      };

      await apiRequest('POST', '/api/payment', paymentData);
      await queryClient.invalidateQueries({ queryKey: ['/api/payment'] });

      handleFormChange('paymentMethod', newPaymentMethodName.trim());
      setPaymentMethodModal({ show: false });

      setNewPaymentMethodName('');
      setNewPaymentMethodType('');
      setNewPaymentMethodOwner('');
      setNewPaymentMethodManagedBy('');
      setNewPaymentMethodFinancialInstitution('');
      setNewPaymentMethodLast4Digits('');
      setNewPaymentMethodExpiresAt('');
      setNewPaymentMethodCardImage('visa');
      setPmOwnerSearch('');
      setPmManagedSearch('');
      setPmOwnerOpen(false);
      setPmManagedOpen(false);
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      toast({
        title: 'Failed to create payment method',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingPaymentMethod(false);
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

  // Close Submitted By dropdown when clicking outside
  useEffect(() => {
    if (!submittedByOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (submittedByDropdownRef.current && !submittedByDropdownRef.current.contains(event.target as Node)) {
        setSubmittedByOpen(false);
        setSubmittedBySearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [submittedByOpen]);

  // Close Owner dropdown when clicking outside
  useEffect(() => {
    if (!ownerOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(event.target as Node)) {
        setOwnerOpen(false);
        setOwnerSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ownerOpen]);
  
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
      toast({
        title: "Success",
        description: "Compliance item deleted successfully",
        variant: "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete compliance item",
        variant: "destructive",
      });
    }
  });
  
  const confirmDelete = () => {
    if (complianceToDelete) {
      deleteMutation.mutate(complianceToDelete._id as string);
      setDeleteConfirmOpen(false);
      setComplianceToDelete(null);
    }
  };
  
  const hasMeaningfulFormData = () => {
    const hasText = (value: unknown) => String(value ?? '').trim().length > 0;

    const hasNonDefault =
      form.filingFrequency !== 'Monthly' ||
      form.filingSubmissionStatus !== 'Pending' ||
      String(form.reminderDays ?? '') !== '7' ||
      form.reminderPolicy !== 'One time';

    const hasAny =
      hasText(form.filingName) ||
      hasText(form.filingComplianceCategory) ||
      hasText(form.filingGoverningAuthority) ||
      hasText(form.filingStartDate) ||
      hasText(form.filingEndDate) ||
      hasText(form.filingSubmissionDeadline) ||
      hasText(form.filingRecurringFrequency) ||
      hasText(form.filingRemarks) ||
      hasText(form.submissionNotes) ||
      hasText(form.filingSubmissionDate) ||
      hasText(form.submittedBy) ||
      hasText(form.owner) ||
      hasText(form.amount) ||
      hasText(form.paymentDate) ||
      hasText(form.submissionAmount) ||
      hasText(form.paymentMethod) ||
      hasText(form.department) ||
      (Array.isArray(selectedDepartments) && selectedDepartments.length > 0) ||
      (Array.isArray(form.departments) && form.departments.length > 0) ||
      (Array.isArray(notes) && notes.length > 0) ||
      (Array.isArray(submissionDocuments) && submissionDocuments.length > 0) ||
      Object.values(dynamicFieldValues || {}).some(v => String(v ?? '').trim().length > 0);

    return hasNonDefault || hasAny;
  };

  const handleExitConfirm = () => {
    setModalOpen(false);
    setExitConfirmOpen(false);

    setTimeout(() => {
      setFilingNameError("");
      setEditIndex(null);
      setShowSubmissionDetails(false);
      setSubmissionOpenedFromTable(false);
      setForm(createEmptyForm());
      setSelectedDepartments([]);
      setDynamicFieldValues({});
      setNotes([]);
      setSubmissionDocuments([]);
      setPaymentMethodSearch('');
      setPaymentMethodOpen(false);
      setSubmittedBySearch('');
      setSubmittedByOpen(false);
      setOwnerSearch('');
      setOwnerOpen(false);
    }, 250);
  };
  
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
  const normalizedSearch = searchTerm.trim().toLowerCase();
  let filteredItems = complianceItems.filter((item: ComplianceItem) => {
    // Search only by Policy name
    const matchesSearch =
      !normalizedSearch ||
      String(item.policy ?? "")
        .toLowerCase()
        .includes(normalizedSearch);

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
  } else {
    if (normalizedSearch) {
      // When searching, rank by relevance: startsWith > contains, then earlier match position.
      filteredItems = [...filteredItems].sort((a: ComplianceItem, b: ComplianceItem) => {
        const aPolicy = String(a.policy ?? "").toLowerCase();
        const bPolicy = String(b.policy ?? "").toLowerCase();

        const aIdx = aPolicy.indexOf(normalizedSearch);
        const bIdx = bPolicy.indexOf(normalizedSearch);

        const aScore = aIdx === 0 ? 0 : aIdx > 0 ? 1 : 2;
        const bScore = bIdx === 0 ? 0 : bIdx > 0 ? 1 : 2;

        if (aScore !== bScore) return aScore - bScore;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return aPolicy.localeCompare(bPolicy);
      });
    } else {
      // Default: Show latest created/edited items first (reverse order)
      filteredItems = [...filteredItems].reverse();
    }
  }
  
  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      <div className="h-full w-full px-6 py-8 flex flex-col min-h-0">
        {/* Modern Professional Header */}
        <div className="mb-6 shrink-0">
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
                      owner: "",
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

        <div className="min-w-0 flex-1 min-h-0">
          {/* Professional Data Table with Frozen Headers */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden h-full flex flex-col min-h-0">
            <Table containerClassName="flex-1 min-h-0 overflow-auto" className="w-full">
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <TableHead
                    className="sticky top-0 z-20 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
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
                    className="sticky top-0 z-20 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
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
                    className="sticky top-0 z-20 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
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
                    className="sticky top-0 z-20 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
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
                    className="sticky top-0 z-20 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('filingSubmissionDate')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Submitted Date
                      {sortField === 'filingSubmissionDate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : <ArrowUpDown className="h-4 w-4 opacity-50" />}
                    </div>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">
                    Submission
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">
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
                              owner: currentItem.owner || "",
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
                              setSubmissionOpenedFromTable(true);
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
                                owner: currentItem.owner || "",
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
                              setSubmissionOpenedFromTable(false);
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
                                owner: currentItem.owner || "",
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
                              setComplianceToDelete(item);
                              setDeleteConfirmOpen(true);
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
        <DialogContent className={`${isFullscreen ? 'max-w-[95vw] w-[95vw] h-[92vh] max-h-[92vh]' : 'max-w-4xl min-w-[400px] max-h-[80vh]'} rounded-2xl border-slate-200 shadow-2xl p-0 bg-white transition-[width,height] duration-300 flex flex-col overflow-hidden`}>
          {/* Local keyframes for the sheen animation */}
          <style>{`@keyframes sheen { 0% { transform: translateX(-60%); } 100% { transform: translateX(180%); } }`}</style>
          <DialogHeader className={`sticky top-0 z-50 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white ${isFullscreen ? 'p-4 md:p-5' : 'p-5'} rounded-t-2xl`}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold flex items-center gap-3">
                  <FileText className="h-6 w-6" />
                  {showSubmissionDetails ? "Submission" : (editIndex !== null ? (form.filingName || 'Edit Compliance') : "Compliance")}
                </DialogTitle>
                {/* Dynamic Status Badge - hidden when in Submission view */}
                {!showSubmissionDetails && (() => {
                  // Check if it's a draft first
                  const isDraft = editIndex !== null && (complianceItems[editIndex]?.isDraft || complianceItems[editIndex]?.status === "Draft");
                  if (isDraft) {
                    return (
                      <span className="px-4 py-2 rounded-full text-sm font-medium text-amber-800 bg-amber-100 transition-all duration-300">
                        Draft
                      </span>
                    );
                  }
                  
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
                    onClick={() => {
                      setSubmissionOpenedFromTable(false);
                      setShowSubmissionDetails(!showSubmissionDetails);
                    }}
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
          <div className="flex-1 overflow-y-auto">
          <form className={`${isFullscreen ? 'p-4 md:p-6 lg:p-8' : 'p-6'}`}>
            {/* Show Submission Details when showSubmissionDetails is true */}
            {showSubmissionDetails && (
              <>
                {/* Submission Details heading removed as requested */}
                <div className={`grid gap-6 mb-8 grid-cols-1 md:grid-cols-2`}>
                  {/* Submission Date and Submitted By fields */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Submission Date</label>
                    <Input 
                      className={`w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 ${dateErrors.submissionDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                      type="date" 
                      value={form.filingSubmissionDate} 
                      onChange={e => handleFormChange("filingSubmissionDate", e.target.value)}
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
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <div className="relative flex-1" ref={submittedByDropdownRef}>
                        <div className="relative">
                          <Input
                            value={submittedByOpen ? submittedBySearch : submittedByDisplayValue}
                            placeholder="Select employee"
                            className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 pr-10"
                            onFocus={() => {
                              setSubmittedBySearch(submittedByDisplayValue);
                              setSubmittedByOpen(true);
                            }}
                            onClick={() => {
                              setSubmittedBySearch(submittedByDisplayValue);
                              setSubmittedByOpen(true);
                            }}
                            onChange={(e) => {
                              setSubmittedBySearch(e.target.value);
                              if (!submittedByOpen) setSubmittedByOpen(true);
                            }}
                            autoComplete="off"
                          />
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                            onClick={() => {
                              setSubmittedByOpen((v) => !v);
                              setSubmittedBySearch('');
                            }}
                          />
                        </div>

                        {submittedByOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                            {isLoadingEmployees ? (
                              <div className="px-3 py-2.5 text-sm text-slate-500">Loading employees...</div>
                            ) : (
                              (Array.isArray(employeesData) ? employeesData : [])
                                .filter((emp: any) => {
                                  const q = submittedBySearch.trim().toLowerCase();
                                  if (!q) return true;
                                  return (
                                    getEmployeeName(emp).toLowerCase().includes(q) ||
                                    getEmployeeEmail(emp).toLowerCase().includes(q)
                                  );
                                })
                                .map((emp: any) => {
                                  const id = getEmployeeId(emp);
                                  const selected = String(form.submittedBy || '') === id;
                                  return (
                                    <div
                                      key={id}
                                      className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                        selected ? 'bg-blue-50 text-blue-700' : ''
                                      }`}
                                      onClick={() => {
                                        handleFormChange('submittedBy', selected ? '' : id);
                                        setSubmittedByOpen(false);
                                        setSubmittedBySearch('');
                                      }}
                                    >
                                      <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                      <span className="font-normal">{getEmployeeName(emp) || getEmployeeEmail(emp) || 'Employee'}</span>
                                    </div>
                                  );
                                })
                            )}

                            {!isLoadingEmployees && (Array.isArray(employeesData) ? employeesData : []).length === 0 && (
                              <div className="px-3 py-2.5 text-sm text-slate-500">No employees found</div>
                            )}
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowSubmissionDocumentDialog(true)}
                        className="gap-2 border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-4 py-2 rounded-lg"
                      >
                        <Upload className="h-4 w-4" />
                        UploadDocument
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Payment Method and Amount below Submission Date and Submitted By */}
                <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-2">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Payment Method</label>
                    {(() => {
                      const allPaymentMethods = Array.isArray(paymentMethods)
                        ? paymentMethods.map((pm: any) => String(pm?.name || pm?.title || '')).filter(Boolean)
                        : [];
                      const normalizedSearch = paymentMethodSearch.trim().toLowerCase();
                      const filtered = normalizedSearch
                        ? allPaymentMethods.filter((pm: string) => pm.toLowerCase().includes(normalizedSearch))
                        : allPaymentMethods;
                      return (
                        <div className="relative" ref={paymentMethodDropdownRef}>
                          <div className="relative">
                            <Input
                              value={paymentMethodOpen ? paymentMethodSearch : (form.paymentMethod || '')}
                              className="w-full border-slate-300 rounded-lg p-3 pr-10 text-base focus:border-blue-500 focus:ring-blue-500 cursor-pointer"
                              disabled={paymentMethodsLoading}
                              onChange={(e) => {
                                setPaymentMethodSearch(e.target.value);
                                if (!paymentMethodOpen) setPaymentMethodOpen(true);
                              }}
                              onFocus={() => {
                                setPaymentMethodSearch(form.paymentMethod || '');
                                setPaymentMethodOpen(true);
                              }}
                              onClick={() => {
                                setPaymentMethodSearch(form.paymentMethod || '');
                                setPaymentMethodOpen(true);
                              }}
                            />
                            <ChevronDown
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                              onClick={() => {
                                if (!paymentMethodOpen) setPaymentMethodSearch(form.paymentMethod || '');
                                setPaymentMethodOpen(!paymentMethodOpen);
                                if (paymentMethodOpen) setPaymentMethodSearch('');
                              }}
                            />
                          </div>
                          {paymentMethodOpen && filtered.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto custom-scrollbar">
                              {filtered.map((pmName: string) => (
                                <div
                                  key={pmName}
                                  className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                  onClick={() => {
                                    if ((form.paymentMethod || '') === pmName) {
                                      handleFormChange('paymentMethod', '');
                                      setPaymentMethodOpen(false);
                                      setPaymentMethodSearch('');
                                      return;
                                    }
                                    handleFormChange('paymentMethod', pmName);
                                    setPaymentMethodOpen(false);
                                    setPaymentMethodSearch('');
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 text-blue-600 ${(form.paymentMethod || '') === pmName ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                  <span className="font-normal">{pmName}</span>
                                </div>
                              ))}
                              <div
                                className="font-medium border-t border-gray-200 mt-2 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
                                style={{ marginTop: '4px', minHeight: '40px', display: 'flex', alignItems: 'center' }}
                                onClick={() => {
                                  setPaymentMethodModal({ show: true });
                                  setPaymentMethodOpen(false);
                                  setPaymentMethodSearch('');
                                }}
                              >
                                + New
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Amount</label>
                    <Input
                      className="w-full border-slate-300 rounded-lg p-2 text-base"
                      type="number"
                      min="0"
                      step="0.01"
                      max={AMOUNT_MAX_10CR}
                      value={form.submissionAmount || ""}
                      onKeyDown={(e) => {
                        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                          e.preventDefault();
                        }
                      }}
                      onChange={e => {
                        let val = e.target.value;
                        if (val && val.includes('.')) {
                          const [intPart, decPart] = val.split('.');
                          val = intPart + '.' + decPart.slice(0, 2);
                        }
                        const numVal = parseFloat(val);
                        if (!isNaN(numVal) && numVal > AMOUNT_MAX_10CR) {
                          val = String(AMOUNT_MAX_10CR);
                        }
                        handleFormChange("submissionAmount", val);
                      }}
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
                {(() => {
                  const authorities = (Array.isArray(governingAuthorities) && governingAuthorities.length > 0)
                    ? governingAuthorities
                    : GOVERNING_AUTHORITIES;

                  const normalizedSearch = governingAuthoritySearch.trim().toLowerCase();
                  const filtered = normalizedSearch
                    ? authorities.filter(a => String(a || '').toLowerCase().includes(normalizedSearch))
                    : authorities;

                  return (
                    <div className="relative" ref={governingAuthorityDropdownRef}>
                      <div className="relative">
                        <Input
                          value={governingAuthorityOpen ? governingAuthoritySearch : (form.filingGoverningAuthority || '')}
                          placeholder="Select authority"
                          className="w-full border-slate-300 rounded-lg p-2 pr-10 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          onFocus={() => {
                            setGoverningAuthoritySearch(form.filingGoverningAuthority || '');
                            setGoverningAuthorityOpen(true);
                          }}
                          onClick={() => {
                            setGoverningAuthoritySearch(form.filingGoverningAuthority || '');
                            setGoverningAuthorityOpen(true);
                          }}
                          onChange={(e) => {
                            setGoverningAuthoritySearch(e.target.value);
                            handleFormChange('filingGoverningAuthority', e.target.value);
                            if (!governingAuthorityOpen) setGoverningAuthorityOpen(true);
                          }}
                          autoComplete="off"
                        />
                        <ChevronDown
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                          onClick={() => {
                            if (!governingAuthorityOpen) setGoverningAuthoritySearch(form.filingGoverningAuthority || '');
                            setGoverningAuthorityOpen(!governingAuthorityOpen);
                            if (governingAuthorityOpen) setGoverningAuthoritySearch('');
                          }}
                        />
                      </div>

                      {governingAuthorityOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                          {filtered.length > 0 ? (
                            filtered.map((authority) => {
                              const selected = (form.filingGoverningAuthority || '') === authority;
                              return (
                                <div
                                  key={authority}
                                  className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                    selected ? 'bg-blue-50 text-blue-700' : ''
                                  }`}
                                  onClick={() => {
                                    handleFormChange('filingGoverningAuthority', selected ? '' : authority);
                                    setGoverningAuthorityOpen(false);
                                    setGoverningAuthoritySearch('');
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                  <span className="font-normal">{authority}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-3 py-2.5 text-sm text-slate-500">No authorities found</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
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

              {/* Owner field after department - copy subscription modal dropdown style/logic */}
              <div className="space-y-2 relative" ref={ownerDropdownRef}>
                <label className="block text-sm font-medium text-slate-700">Owner</label>
                <div className="relative">
                  <Input
                    value={ownerOpen ? ownerSearch : (form.owner || '')}
                    placeholder="Select employee"
                    className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 pr-10"
                    onFocus={() => {
                      setOwnerSearch(form.owner || '');
                      setOwnerOpen(true);
                    }}
                    onClick={() => {
                      setOwnerSearch(form.owner || '');
                      setOwnerOpen(true);
                    }}
                    onChange={(e) => {
                      setOwnerSearch(e.target.value);
                      if (!ownerOpen) setOwnerOpen(true);
                    }}
                    autoComplete="off"
                  />
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                    onClick={() => {
                      setOwnerOpen((v) => !v);
                      setOwnerSearch('');
                    }}
                  />
                </div>

                {ownerOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                    {isLoadingEmployees ? (
                      <div className="px-3 py-2.5 text-sm text-slate-500">Loading employees...</div>
                    ) : (
                      (Array.isArray(employeesData) ? employeesData : [])
                        .filter((emp: any) => {
                          const q = ownerSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            getEmployeeName(emp).toLowerCase().includes(q) ||
                            getEmployeeEmail(emp).toLowerCase().includes(q)
                          );
                        })
                        .map((emp: any) => {
                          const name = getEmployeeName(emp);
                          const email = getEmployeeEmail(emp);
                          const selected = String(form.owner || '') === name;
                          return (
                            <div
                              key={getEmployeeId(emp)}
                              className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                selected ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                              onClick={() => {
                                handleFormChange('owner', selected ? '' : name);
                                setOwnerOpen(false);
                                setOwnerSearch('');
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="font-normal">{name || email || 'Employee'}</span>
                            </div>
                          );
                        })
                    )}

                    {!isLoadingEmployees && (Array.isArray(employeesData) ? employeesData : []).length === 0 && (
                      <div className="px-3 py-2.5 text-sm text-slate-500">No employees found</div>
                    )}

                    <div
                      className="font-medium border-t border-gray-200 mt-2 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
                      style={{ marginTop: '4px', minHeight: '40px', display: 'flex', alignItems: 'center' }}
                      onClick={() => {
                        setOwnerModal({ show: true });
                        setOwnerOpen(false);
                        setOwnerSearch('');
                      }}
                    >
                      + New
                    </div>
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
                  min={1}
                  max={REMINDER_DAYS_MAX}
                  value={form.reminderDays} 
                  onKeyDown={(e) => {
                    if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-' || e.key === '.') {
                      e.preventDefault();
                    }
                  }}
                  onChange={e => {
                    const value = e.target.value;
                    if (value === '') {
                      handleFormChange('reminderDays', '');
                      return;
                    }
                    const numValue = Number(value);
                    if (!Number.isNaN(numValue)) {
                      const clamped = Math.min(REMINDER_DAYS_MAX, Math.max(1, numValue));
                      handleFormChange('reminderDays', String(clamped));
                    }
                  }} 
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
                  if (showSubmissionDetails) {
                    if (submissionOpenedFromTable) {
                      handleExitConfirm();
                      return;
                    }
                    setShowSubmissionDetails(false);
                    return;
                  }
                  // Match SubscriptionModal logic: show exit confirmation only if any data is filled
                  if (hasMeaningfulFormData()) {
                    setExitConfirmOpen(true);
                  } else {
                    handleExitConfirm();
                  }
                }}
              >
                Exit
              </Button>
              {!showSubmissionDetails && (
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
                    owner: form.owner,
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
                      owner: "",
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
              )}
              <Button 
                type="button" 
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium px-6 py-2 shadow-md hover:shadow-lg"
                onClick={async () => {
                  if (showSubmissionDetails) {
                    if (!form.filingSubmissionDate) {
                      toast({
                        title: 'Validation Error',
                        description: 'Submission Date is required',
                        variant: 'destructive',
                      });
                      return;
                    }
                    if (!form.submittedBy) {
                      toast({
                        title: 'Validation Error',
                        description: 'Submitted By is required',
                        variant: 'destructive',
                      });
                      return;
                    }
                    if (submissionDocuments.length === 0) {
                      toast({
                        title: 'Validation Error',
                        description: 'Please upload a document before submitting',
                        variant: 'destructive',
                      });
                      return;
                    }
                  }

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
                    owner: form.owner,
                    department: form.department,
                    departments: selectedDepartments,
                    complianceFieldValues: dynamicFieldValues, // <--- store dynamic field values
                    isDraft: false // Explicitly mark as not draft when saving
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
                        complianceId: complianceId,
                        documents: submissionDocuments.length > 0 ? submissionDocuments : undefined,
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
                  setSubmissionDocuments([]);
                  if (showSubmissionDetails) {
                    setShowSubmissionDetails(false);
                    return;
                  }
                  setModalOpen(false);
                  setEditIndex(null);
                }}
              >
                {showSubmissionDetails ? 'Submit' : 'Save Compliance'}
              </Button>
            </div>
          </form>
          </div>
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
              <div className="relative" ref={deptHeadDropdownRef}>
                <div className="relative">
                  <Input
                    value={deptHeadSearch}
                    placeholder="Select employee"
                    className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10"
                    onFocus={() => setDeptHeadOpen(true)}
                    onClick={() => setDeptHeadOpen(true)}
                    onChange={(e) => {
                      setDeptHeadSearch(e.target.value);
                      setDeptHeadOpen(true);
                      setNewDepartmentHead('');
                      setNewDepartmentEmail('');
                      setNewDepartmentEmailError('');
                      setIsDepartmentEmailLocked(false);
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
                        const selected = newDepartmentHead === emp.name;
                        return (
                          <div
                            key={emp._id || emp.id || emp.email}
                            className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                              selected ? 'bg-blue-50 text-blue-700' : ''
                            }`}
                            onClick={() => {
                              setNewDepartmentHead(String(emp.name || '').trim());
                              setDeptHeadSearch(String(emp.name || '').trim());
                              setDeptHeadOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="font-normal">{emp.name}</span>
                          </div>
                        );
                      })}

                    {(Array.isArray(employeesData) ? employeesData : []).length === 0 && (
                      <div className="px-3 py-2.5 text-sm text-slate-500">No employees found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <Input
                type="email"
                placeholder=""
                value={newDepartmentEmail}
                onChange={(e) => {
                  if (!isDepartmentEmailLocked) {
                    setNewDepartmentEmail(e.target.value);
                    setNewDepartmentEmailError('');
                  }
                }}
                onBlur={() => {
                  if (!isDepartmentEmailLocked) {
                    const validation = validateEmail(newDepartmentEmail);
                    if (!validation.valid) {
                      setNewDepartmentEmailError(validation.error || 'Invalid email');
                    }
                  }
                }}
                className={`w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 ${
                  newDepartmentEmailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : ''
                } ${isDepartmentEmailLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddDepartment();
                  }
                }}
                readOnly={isDepartmentEmailLocked}
              />
              {newDepartmentEmailError && (
                <p className="text-red-600 text-sm mt-1">{newDepartmentEmailError}</p>
              )}
            </div>
          </div>
          <AlertDialogFooter className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDepartmentModal({ show: false });
                setNewDepartmentName('');
                setNewDepartmentHead('');
                setDeptHeadSearch('');
                setDeptHeadOpen(false);
                setNewDepartmentEmail('');
                setNewDepartmentEmailError('');
                setIsDepartmentEmailLocked(false);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddDepartment}
              disabled={!newDepartmentName.trim() || !newDepartmentHead.trim() || !newDepartmentEmail.trim() || !!newDepartmentEmailError}
              className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-300"
            >
              Add Department
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Method Creation Modal */}
      <AlertDialog open={paymentMethodModal.show} onOpenChange={(open) => !open && setPaymentMethodModal({ show: false })}>
        <AlertDialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl font-inter">
          <AlertDialogHeader className="bg-blue-600 text-white p-6 rounded-t-lg -m-6 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                  </svg>
                </div>
                <AlertDialogTitle className="text-xl font-semibold text-white">
                  Create Payment Method
                </AlertDialogTitle>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder=""
                  value={newPaymentMethodName}
                  onChange={(e) => setNewPaymentMethodName(e.target.value)}
                  onBlur={() => {
                    if (newPaymentMethodName.trim()) {
                      const duplicateName = (Array.isArray(paymentMethods) ? paymentMethods : []).find(
                        (method: any) =>
                          String(method?.name || '').toLowerCase().trim() === newPaymentMethodName.toLowerCase().trim() ||
                          String(method?.title || '').toLowerCase().trim() === newPaymentMethodName.toLowerCase().trim()
                      );

                      if (duplicateName) {
                        setValidationErrorMessage(`A payment method with the name "${newPaymentMethodName.trim()}" already exists. Please use a different name.`);
                        setValidationErrorOpen(true);
                      }
                    }
                  }}
                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddPaymentMethod();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <Select value={newPaymentMethodType} onValueChange={setNewPaymentMethodType}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 font-inter text-sm">
                    <SelectValue placeholder="Select payment type" className="font-inter text-sm" />
                  </SelectTrigger>
                  <SelectContent className="font-inter text-sm">
                    <SelectItem value="Credit" className="font-inter text-sm">Credit Card</SelectItem>
                    <SelectItem value="Debit" className="font-inter text-sm">Debit Card</SelectItem>
                    <SelectItem value="Cash" className="font-inter text-sm">Cash</SelectItem>
                    <SelectItem value="Bank Transfer" className="font-inter text-sm">Bank Transfer</SelectItem>
                    <SelectItem value="Digital Wallet" className="font-inter text-sm">Digital Wallet</SelectItem>
                    <SelectItem value="Other" className="font-inter text-sm">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                <div className="relative" ref={pmOwnerDropdownRef}>
                  <div className="relative">
                    <Input
                      value={pmOwnerSearch}
                      placeholder="Select employee"
                      className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10"
                      onFocus={() => setPmOwnerOpen(true)}
                      onClick={() => setPmOwnerOpen(true)}
                      onChange={(e) => {
                        setPmOwnerSearch(e.target.value);
                        setPmOwnerOpen(true);
                      }}
                      autoComplete="off"
                    />
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                      onClick={() => setPmOwnerOpen(!pmOwnerOpen)}
                    />
                  </div>

                  {pmOwnerOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                      {(Array.isArray(employeesData) ? employeesData : [])
                        .filter((emp: any) => {
                          const q = pmOwnerSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            String(emp?.name || '').toLowerCase().includes(q) ||
                            String(emp?.email || '').toLowerCase().includes(q)
                          );
                        })
                        .map((emp: any) => {
                          const duplicateNames = (Array.isArray(employeesData) ? employeesData : []).filter((e: any) => e.name === emp.name);
                          const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                          const selected = newPaymentMethodOwner === emp.name;
                          return (
                            <div
                              key={emp._id || emp.id || emp.email}
                              className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                selected ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                              onClick={() => {
                                if (newPaymentMethodOwner === emp.name) {
                                  setNewPaymentMethodOwner('');
                                  setPmOwnerSearch('');
                                  setPmOwnerOpen(false);
                                  return;
                                }
                                setNewPaymentMethodOwner(String(emp.name || '').trim());
                                setPmOwnerSearch(String(emp.name || '').trim());
                                setPmOwnerOpen(false);
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Managed by</label>
                <div className="relative" ref={pmManagedDropdownRef}>
                  <div className="relative">
                    <Input
                      value={pmManagedSearch}
                      placeholder="Select employee"
                      className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10"
                      onFocus={() => setPmManagedOpen(true)}
                      onClick={() => setPmManagedOpen(true)}
                      onChange={(e) => {
                        setPmManagedSearch(e.target.value);
                        setPmManagedOpen(true);
                      }}
                      autoComplete="off"
                    />
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                      onClick={() => setPmManagedOpen(!pmManagedOpen)}
                    />
                  </div>

                  {pmManagedOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                      {(Array.isArray(employeesData) ? employeesData : [])
                        .filter((emp: any) => {
                          const q = pmManagedSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            String(emp?.name || '').toLowerCase().includes(q) ||
                            String(emp?.email || '').toLowerCase().includes(q)
                          );
                        })
                        .map((emp: any) => {
                          const duplicateNames = (Array.isArray(employeesData) ? employeesData : []).filter((e: any) => e.name === emp.name);
                          const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                          const selected = newPaymentMethodManagedBy === emp.name;
                          return (
                            <div
                              key={emp._id || emp.id || emp.email}
                              className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                selected ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                              onClick={() => {
                                if (newPaymentMethodManagedBy === emp.name) {
                                  setNewPaymentMethodManagedBy('');
                                  setPmManagedSearch('');
                                  setPmManagedOpen(false);
                                  return;
                                }
                                setNewPaymentMethodManagedBy(String(emp.name || '').trim());
                                setPmManagedSearch(String(emp.name || '').trim());
                                setPmManagedOpen(false);
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
              </div>
            </div>

            {newPaymentMethodType !== 'Cash' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Financial Institution</label>
                  <Input
                    placeholder=""
                    value={newPaymentMethodFinancialInstitution}
                    onChange={(e) => setNewPaymentMethodFinancialInstitution(e.target.value)}
                    className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 Digits</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder=""
                    value={newPaymentMethodLast4Digits}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setNewPaymentMethodLast4Digits(value);
                    }}
                    maxLength={4}
                    className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  />
                </div>
              </div>
            )}

            {newPaymentMethodType !== 'Cash' && (
              <div className="w-1/2 pr-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Expires at</label>
                <div className="relative">
                  <Input
                    type="month"
                    placeholder="MM/YYYY"
                    value={newPaymentMethodExpiresAt}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setNewPaymentMethodExpiresAt(newValue);

                      if (newValue) {
                        const [year, month] = newValue.split('-');
                        const expiryDate = new Date(parseInt(year), parseInt(month) - 1);
                        const today = new Date();
                        today.setDate(1);
                        today.setHours(0, 0, 0, 0);

                        if (expiryDate < today) {
                          setValidationErrorMessage('Card expiry date cannot be in the past');
                          setValidationErrorOpen(true);
                          setNewPaymentMethodExpiresAt('');
                        }
                      }
                    }}
                    className="w-full pr-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
                    <button
                      type="button"
                      onClick={() => {
                        if (newPaymentMethodExpiresAt) {
                          const [year, month] = newPaymentMethodExpiresAt.split('-');
                          const newYear = parseInt(year) + 1;
                          setNewPaymentMethodExpiresAt(`${newYear}-${month}`);
                        } else {
                          const now = new Date();
                          setNewPaymentMethodExpiresAt(`${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                        }
                      }}
                      className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                      title="Next year"
                    >
                      <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (newPaymentMethodExpiresAt) {
                          const [year, month] = newPaymentMethodExpiresAt.split('-');
                          const newYear = parseInt(year) - 1;
                          setNewPaymentMethodExpiresAt(`${newYear}-${month}`);
                        } else {
                          const now = new Date();
                          setNewPaymentMethodExpiresAt(`${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                        }
                      }}
                      className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                      title="Previous year"
                    >
                      <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setPaymentMethodModal({ show: false });
                setNewPaymentMethodName('');
                setNewPaymentMethodType('');
                setNewPaymentMethodOwner('');
                setNewPaymentMethodManagedBy('');
                setNewPaymentMethodFinancialInstitution('');
                setNewPaymentMethodLast4Digits('');
                setNewPaymentMethodExpiresAt('');
                setNewPaymentMethodCardImage('visa');
                setPmOwnerSearch('');
                setPmManagedSearch('');
                setPmOwnerOpen(false);
                setPmManagedOpen(false);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPaymentMethod}
              disabled={!newPaymentMethodName.trim() || !newPaymentMethodType || isCreatingPaymentMethod}
              className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-300"
            >
              {isCreatingPaymentMethod ? 'Creating...' : 'Create Payment Method'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Owner Creation Modal (Add Employee) */}
      <AlertDialog open={ownerModal.show} onOpenChange={(open) => !open && setOwnerModal({ show: false })}>
        <AlertDialogContent className="sm:max-w-[500px] bg-white border border-gray-200 shadow-2xl font-inter">
          <AlertDialogHeader className="bg-indigo-600 text-white p-6 rounded-t-lg -m-6 mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-white">Add Employee</AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <Input
                  placeholder=""
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddOwner();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <Input
                  type="email"
                  placeholder=""
                  value={newOwnerEmail}
                  onChange={(e) => {
                    setNewOwnerEmail(e.target.value);
                    setNewOwnerEmailError('');
                  }}
                  onBlur={() => {
                    if (newOwnerEmail) {
                      const result = validateEmail(newOwnerEmail);
                      if (!result.valid) {
                        setNewOwnerEmailError(result.error || 'Invalid email address');
                      }
                    }
                  }}
                  className={`w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 ${
                    newOwnerEmailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : ''
                  }`}
                />
                {newOwnerEmailError && (
                  <p className="text-red-600 text-sm font-medium mt-1">{newOwnerEmailError}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <div className="relative" ref={ownerDeptDropdownRef}>
                  <div className="relative">
                    <Input
                      value={ownerDeptSearch}
                      placeholder="Select department"
                      className={`w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10 cursor-pointer ${
                        !newOwnerDepartment ? 'border-red-300' : ''
                      }`}
                      onFocus={() => setOwnerDeptOpen(true)}
                      onClick={() => setOwnerDeptOpen(true)}
                      onChange={(e) => {
                        setOwnerDeptSearch(e.target.value);
                        setOwnerDeptOpen(true);
                        setNewOwnerDepartment('');
                      }}
                      autoComplete="off"
                    />
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                      onClick={() => setOwnerDeptOpen(!ownerDeptOpen)}
                    />
                  </div>

                  {ownerDeptOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                      {(Array.isArray(departments) ? departments : [])
                        .filter((dept: any) => Boolean(dept?.visible))
                        .filter((dept: any) => {
                          const q = ownerDeptSearch.trim().toLowerCase();
                          if (!q) return true;
                          return String(dept?.name || '').toLowerCase().includes(q);
                        })
                        .map((dept: any) => {
                          const selected = newOwnerDepartment === dept.name;
                          return (
                            <div
                              key={dept.name}
                              className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                selected ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                              onClick={() => {
                                setNewOwnerDepartment(dept.name);
                                setOwnerDeptSearch(dept.name);
                                setOwnerDeptOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="font-normal">{dept.name}</span>
                            </div>
                          );
                        })}

                      {Array.isArray(departments) && departments.filter((d: any) => d?.visible).length === 0 && (
                        <div className="px-3 py-2.5 text-sm text-slate-500">No departments found</div>
                      )}

                      <div
                        className="font-medium border-t border-gray-200 mt-2 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
                        style={{ marginTop: '4px', minHeight: '40px', display: 'flex', alignItems: 'center' }}
                        onClick={() => {
                          setDepartmentModal({ show: true });
                          setOwnerDeptOpen(false);
                        }}
                      >
                        + New
                      </div>
                    </div>
                  )}
                </div>
                {!newOwnerDepartment && newOwnerName && (
                  <p className="text-red-600 text-sm font-medium mt-1">Department is required</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <Input
                  placeholder=""
                  value={newOwnerRole}
                  onChange={(e) => setNewOwnerRole(e.target.value)}
                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Select value={newOwnerStatus} onValueChange={setNewOwnerStatus}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <AlertDialogFooter className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setOwnerModal({ show: false });
                setNewOwnerName('');
                setNewOwnerEmail('');
                setNewOwnerRole('');
                setNewOwnerStatus('active');
                setNewOwnerDepartment('');
                setNewOwnerEmailError('');
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddOwner}
              disabled={!newOwnerName.trim() || !newOwnerEmail.trim() || !newOwnerDepartment || newOwnerEmailError !== ''}
              className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-300"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create User
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
                    Delete Compliance
                  </DialogTitle>
                  <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              Are you sure you want to delete the compliance item <span className="font-semibold text-gray-900">"{complianceToDelete?.policy}"</span>?
            </p>
            <p className="text-gray-600 text-xs leading-relaxed">
              This will permanently remove this compliance item and all its associated data from your system.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setDeleteConfirmOpen(false);
                setComplianceToDelete(null);
              }}
              className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Management Dialog (match SubscriptionModal upload UX) */}
      <Dialog open={showSubmissionDocumentDialog} onOpenChange={setShowSubmissionDocumentDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] bg-white shadow-2xl border-2 border-gray-200 overflow-hidden flex flex-col">
          <DialogHeader className="border-b border-gray-200 pb-3 pr-8 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">Documents</DialogTitle>
                <p className="text-sm text-gray-600 mt-1">Submission documents</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmissionDocumentUpload}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 bg-white">
            {Array.isArray(submissionDocuments) && submissionDocuments.length > 0 ? (
              <div className="space-y-2 pr-2">
                {submissionDocuments.map((doc, index) => (
                  <div
                    key={`${doc.name}-${index}`}
                    className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all duration-200"
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4 flex items-center gap-2">
                        <div className="h-9 w-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{doc.name}</p>
                        </div>
                      </div>

                      <div className="col-span-3 flex items-center gap-1.5">
                        <div className="h-5 w-5 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="h-3 w-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-500">Uploaded by</p>
                          <p className="text-xs font-medium text-gray-900 truncate">{currentUserName || 'User'}</p>
                        </div>
                      </div>

                      <div className="col-span-3 flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-500">Uploaded date</p>
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const newWindow = window.open('', '_blank');
                              if (newWindow) {
                                if (doc.url.startsWith('data:application/pdf')) {
                                  newWindow.document.write(`
                                  <html>
                                    <head><title>${doc.name}</title></head>
                                    <body style="margin:0">
                                      <iframe src="${doc.url}" style="width:100%;height:100vh;border:none;"></iframe>
                                    </body>
                                  </html>
                                `);
                                } else if (doc.url.startsWith('data:image')) {
                                  newWindow.document.write(`
                                  <html>
                                    <head><title>${doc.name}</title></head>
                                    <body style="margin:0;display:flex;justify-content:center;align-items:center;background:#000;">
                                      <img src="${doc.url}" style="max-width:100%;max-height:100vh;"/>
                                    </body>
                                  </html>
                                `);
                                }
                              }
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: 'Failed to view document',
                                variant: 'destructive',
                              });
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const link = document.createElement('a');
                              link.href = doc.url;
                              link.download = doc.name;
                              link.click();
                              toast({
                                title: 'Download Started',
                                description: `Downloading ${doc.name}`,
                                duration: 2000,
                                variant: 'success',
                              });
                            } catch (error) {
                              toast({
                                title: 'Error',
                                description: 'Failed to download document',
                                variant: 'destructive',
                              });
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubmissionDocuments((prev) => (Array.isArray(prev) ? prev.filter((_, i) => i !== index) : []));
                            toast({
                              title: 'Document Removed',
                              description: `${doc.name} has been removed`,
                              duration: 2000,
                              variant: 'destructive',
                            });
                          }}
                          className="px-2 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1"
                          title="Remove document"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No documents uploaded yet</p>
                <p className="text-gray-400 text-xs mt-1">Click the Upload button above to add documents</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-3 pt-3 border-t border-gray-200 bg-gray-50 -mx-6 px-6 -mb-6 pb-4 rounded-b-lg">
            <span className="text-xs text-gray-600">
              {(Array.isArray(submissionDocuments) ? submissionDocuments.length : 0)} document
              {(Array.isArray(submissionDocuments) && submissionDocuments.length !== 1) ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSubmissionDocumentDialog(false)}
                className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm px-4 py-1.5"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => setShowSubmissionDocumentDialog(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Exit Confirmation Dialog (match SubscriptionModal) */}
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
              onClick={() => setExitConfirmOpen(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setExitConfirmOpen(false);
                handleExitConfirm();
              }}
              className="bg-red-600 hover:bg-red-700 text-white shadow-md px-6 py-2"
            >
              Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validation Error Dialog */}
      <Dialog open={validationErrorOpen} onOpenChange={setValidationErrorOpen}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 bg-white font-inter">
          <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5 rounded-t-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-white">Validation Error</DialogTitle>
                  <p className="text-red-100 mt-0.5 text-sm font-medium">Please correct the error</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <p className="text-gray-700 text-sm leading-relaxed">{validationErrorMessage}</p>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
            <Button
              type="button"
              onClick={() => setValidationErrorOpen(false)}
              className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}