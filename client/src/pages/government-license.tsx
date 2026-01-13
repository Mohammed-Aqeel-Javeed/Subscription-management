import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Can } from "@/components/Can";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Edit, Trash2, Plus, Search, Shield, ShieldCheck, AlertCircle, Maximize2, Minimize2, Calendar, Download, Upload, Check, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../hooks/use-toast";
import { z } from "zod";
import { API_BASE_URL } from "@/lib/config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
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

// License interface
type RenewalAttachment = { name: string; url: string; uploadedBy?: string; uploadedAt?: string };

interface License {
  id: string;
  licenseName: string;
  licenseNo?: string;
  issuingAuthorityName: string;
  startDate: string;
  endDate: string;
  details: string;
  renewalFee: number;
  renewalCycleTime?: string;
  renewalLeadTimeEstimated?: string;
  responsiblePerson: string;
  status: 'Active' | 'Expired' | 'Cancelled';
  issuingAuthorityEmail: string;
  issuingAuthorityPhone: string;
  reminderDays?: number | string;
  reminderPolicy?: string;
  // New submission fields
  renewalStatus?: string;
  renewalSubmittedDate?: string;
  expectedCompletedDate?: string;
  applicationReferenceNo?: string;
  renewalInitiatedDate?: string;
  submittedBy?: string;
  paymentReferenceNo?: string;
  renewalAmount?: number;
  renewalStatusReason?: string;
  renewalAttachments?: RenewalAttachment[] | string[];
  createdAt?: string;
  updatedAt?: string;
}

// Form schema (all fields optional - no mandatory validation)
const licenseSchema = z
  .object({
  licenseName: z.string().optional(),
  licenseNo: z.string().optional(),
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
  renewalLeadTimeEstimated: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const s = String(val).trim();
    return s ? s : undefined;
  }, z.string().optional()),
  responsiblePerson: z.string().optional(),
  status: z.enum(['Active', 'Expired', 'Cancelled']).optional(),
  renewalStatus: z.enum(['Under Processing', 'Canceled', 'Rejected', 'Resubmitted', 'Approved']).optional(),
  issuingAuthorityEmail: z.string().optional(),
  issuingAuthorityPhone: z.string().optional(),
  renewalSubmittedDate: z.string().optional(),
  expectedCompletedDate: z.string().optional(),
  applicationReferenceNo: z.string().optional(),
  renewalInitiatedDate: z.string().optional(),
  submittedBy: z.string().optional(),
  paymentReferenceNo: z.string().optional(),
  renewalAmount: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(Number(num)) ? undefined : Number(num);
  }, z.number().optional()),
  renewalStatusReason: z.string().optional(),
  renewalAttachments: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  reminderDays: z.union([z.string(), z.number()]).optional(),
  reminderPolicy: z.string().optional(),
})
  .superRefine((data, ctx) => {
    const start = String(data.startDate || '').trim();
    const end = String(data.endDate || '').trim();
    if (!start || !end) return;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return;
    if (endTime <= startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Expiry date must be after issue date',
      });
    }
  });

type LicenseFormData = z.infer<typeof licenseSchema>;

function EmployeeSearchDropdown(props: {
  value: string;
  onChange: (value: string) => void;
  employees: Array<{ name?: string; email?: string }>;
}) {
  const { value, onChange, employees } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const options = employees.length > 0
    ? employees
        .filter((e) => e?.name)
        .map((emp) => {
          const duplicateNames = employees.filter((e: any) => e?.name && e.name === emp.name);
          const displayName = duplicateNames.length > 1
            ? `${emp.name} (${emp.email || 'no-email'})`
            : String(emp.name);
          const uniqueValue = duplicateNames.length > 1
            ? `${emp.name}|${emp.email || ''}`
            : String(emp.name);
          return { displayName, uniqueValue, name: String(emp.name || ''), email: String(emp.email || '') };
        })
    : [];

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? options.filter((opt) => (opt.displayName || '').toLowerCase().includes(normalizedSearch))
    : options;

  return (
    <div className="relative" ref={dropdownRef}>
      <Input
        value={open ? search : (value || '')}
        className="w-full border-slate-300 rounded-lg p-3 pr-10 text-base cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setSearch(value || '');
          setOpen(true);
        }}
        onClick={() => {
          setSearch(value || '');
          setOpen(true);
        }}
      />
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
        onClick={() => {
          if (!open) setSearch(value || '');
          setOpen(!open);
          if (open) setSearch('');
        }}
      />
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto custom-scrollbar">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <div
                key={opt.uniqueValue}
                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                onClick={() => {
                  const unique = opt.uniqueValue;
                  if (value === opt.name || value === unique) {
                    onChange('');
                    setOpen(false);
                    setSearch('');
                    return;
                  }

                  const emp = employees.find((e: any) => {
                    if (unique.includes('|')) {
                      const [n, em] = unique.split('|');
                      return e?.name === n && (e?.email || '') === em;
                    }
                    return e?.name === unique;
                  });

                  onChange(String(emp?.name || opt.name));
                  setOpen(false);
                  setSearch('');
                }}
              >
                <Check className={`mr-2 h-4 w-4 text-blue-600 ${value === opt.name ? 'opacity-100' : 'opacity-0'}`} />
                <span className="font-normal">{opt.displayName}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">No employees found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GovernmentLicense() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [licenseToDelete, setLicenseToDelete] = useState<License | null>(null);
  // Submission details view state
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);

  const [showRenewalDocumentsModal, setShowRenewalDocumentsModal] = useState(false);
  const [showRenewalStatusReasonModal, setShowRenewalStatusReasonModal] = useState(false);
  const [renewalStatusReasonDraft, setRenewalStatusReasonDraft] = useState('');
  const [pendingRenewalStatus, setPendingRenewalStatus] = useState<string>('');
  const [previousRenewalStatus, setPreviousRenewalStatus] = useState<string>('');
  const [reasonModalTitle, setReasonModalTitle] = useState<'Rejection Reason' | 'Cancellation Reason'>('Rejection Reason');
  const lastResubmittedClearRef = useRef(false);

  const [renewalFeeText, setRenewalFeeText] = useState('');

  // Responsible Person dropdown (match SubscriptionModal Owner searchable dropdown)
  // (inline within the field, matching SubscriptionModal Owner pattern)
  
  // Get current user name (used for default Submitted By)
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

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      licenseName: "",
      licenseNo: "",
      issuingAuthorityName: "",
      startDate: "",
      endDate: "",
      details: "",
      renewalFee: undefined, // Show empty by default
      renewalLeadTimeEstimated: undefined,
      responsiblePerson: "",
      status: "Active",
      issuingAuthorityEmail: "",
      issuingAuthorityPhone: "",
      renewalStatus: undefined,
      renewalSubmittedDate: "",
      expectedCompletedDate: "",
      applicationReferenceNo: "",
      renewalInitiatedDate: "",
      submittedBy: "",
      paymentReferenceNo: "",
      renewalAmount: undefined,
      renewalStatusReason: "",
      renewalAttachments: [],
    },
  });

  const renewalStatusValue = form.watch('renewalStatus');

  useEffect(() => {
    if (renewalStatusValue !== 'Resubmitted') {
      lastResubmittedClearRef.current = false;
      return;
    }
    if (lastResubmittedClearRef.current) return;
    lastResubmittedClearRef.current = true;

    form.setValue('applicationReferenceNo', '', { shouldDirty: true });
    form.setValue('renewalInitiatedDate', '', { shouldDirty: true });
    form.setValue('expectedCompletedDate', '', { shouldDirty: true });
    form.setValue('submittedBy', '', { shouldDirty: true });
    form.setValue('paymentReferenceNo', '', { shouldDirty: true });
    form.setValue('renewalAmount', undefined, { shouldDirty: true });
    form.setValue('renewalAttachments', [], { shouldDirty: true });
    form.setValue('renewalStatusReason', '', { shouldDirty: true });

    toast({
      title: 'Resubmitted',
      description: 'All submission fields cleared for resubmission.',
      duration: 2500,
    });
  }, [renewalStatusValue, form, toast]);

  useEffect(() => {
    if (renewalStatusValue !== 'Canceled' && renewalStatusValue !== 'Rejected') {
      if (String(form.getValues('renewalStatusReason') || '')) {
        form.setValue('renewalStatusReason', '', { shouldDirty: true });
      }
    }
  }, [renewalStatusValue, form]);

  const handleRenewalAttachmentUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
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

      const validateFileType = async (file: File): Promise<boolean> => {
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

            const isValid = Object.values(signatures).some((sigs) =>
              sigs.some((sig) => header.startsWith(sig))
            );

            resolve(isValid);
          };
          reader.readAsArrayBuffer(file.slice(0, 8));
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
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          const existing = (form.getValues('renewalAttachments') || []) as any[];
          const uploadedAt = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          form.setValue('renewalAttachments', [...existing, { 
            name: file.name, 
            url: base64String,
            uploadedBy: currentUserName || 'User',
            uploadedAt: uploadedAt
          }], { shouldDirty: true });
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
    if (!showSubmissionDetails) return;
    const current = String(form.getValues('submittedBy') || '').trim();
    if (!current && currentUserName) {
      form.setValue('submittedBy', currentUserName);
    }
  }, [showSubmissionDetails, currentUserName, form]);

  const issueDateValue = form.watch('startDate') || '';
  const expiryDateValue = form.watch('endDate') || '';
  const renewalFreqValue = form.watch('renewalCycleTime') || '';
  const statusValue = form.watch('status') || '';
  const endDateError = (form.formState.errors as any)?.endDate?.message as string | undefined;

  const isExpiryDisabled = renewalFreqValue === 'One-time';

  const parseLocalDate = (yyyyMmDd: string) => {
    const s = String(yyyyMmDd || '').trim();
    if (!s) return null;
    const d = new Date(`${s}T00:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  };

  const getDerivedStatus = (licenseOrDates: { endDate?: string; status?: string }) => {
    if (licenseOrDates.status === 'Cancelled') return 'Cancelled' as const;
    const end = parseLocalDate(String(licenseOrDates.endDate || ''));
    if (!end) return 'Active' as const;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end.getTime() <= today.getTime() ? ('Expired' as const) : ('Active' as const);
  };

  useEffect(() => {
    if (!isModalOpen) return;
    const fee = form.getValues('renewalFee');
    setRenewalFeeText(typeof fee === 'number' && Number.isFinite(fee) ? fee.toFixed(2) : '');
  }, [isModalOpen, editingLicense]);

  // Auto-calculate expiry date when renewal frequency changes (and issue date changes).
  // Keep expiry input editable by not running this on expiry input changes.
  useEffect(() => {
    if (!isModalOpen) return;

    if (renewalFreqValue === 'One-time') {
      if (form.getValues('endDate')) form.setValue('endDate', '');
      form.clearErrors('endDate');
      return;
    }

    const shouldAutoCalc =
      renewalFreqValue === 'Annual' || renewalFreqValue === 'Quarterly' || renewalFreqValue === 'Monthly';
    if (!shouldAutoCalc) return;

    const start = String(issueDateValue || '').trim();
    if (!start) {
      if (form.getValues('endDate')) form.setValue('endDate', '');
      form.clearErrors('endDate');
      return;
    }

    const base = new Date(start);
    if (!Number.isFinite(base.getTime())) return;

    const monthsToAdd = renewalFreqValue === 'Annual' ? 12 : renewalFreqValue === 'Quarterly' ? 3 : 1;
    const computed = new Date(base);
    computed.setMonth(computed.getMonth() + monthsToAdd);
    const yyyy = computed.getFullYear();
    const mm = String(computed.getMonth() + 1).padStart(2, '0');
    const dd = String(computed.getDate()).padStart(2, '0');
    const computedStr = `${yyyy}-${mm}-${dd}`;
    form.setValue('endDate', computedStr);
    form.clearErrors('endDate');
  }, [isModalOpen, renewalFreqValue, issueDateValue, form]);

  // Validate expiry date (for all manual edits too)
  useEffect(() => {
    if (!isModalOpen) return;

    if (renewalFreqValue === 'One-time') {
      form.clearErrors('endDate');
      return;
    }

    const start = String(issueDateValue || '').trim();
    const end = String(expiryDateValue || '').trim();
    if (start && end) {
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      if (Number.isFinite(startTime) && Number.isFinite(endTime)) {
        if (endTime <= startTime) {
          form.setError('endDate', { type: 'manual', message: 'Expiry date must be after issue date' });
        } else {
          form.clearErrors('endDate');
        }
      }
    } else {
      form.clearErrors('endDate');
    }
  }, [isModalOpen, renewalFreqValue, issueDateValue, expiryDateValue, form]);

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
        variant: "success",
      });
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
        variant: "destructive",
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
      LicenceType: license.licenseName,
      LicenceNo: String(license.licenseNo || ''),
      IssuingAuthority: license.issuingAuthorityName,
      StartDate: license.startDate ? new Date(license.startDate).toISOString().split('T')[0] : '',
      EndDate: license.endDate ? new Date(license.endDate).toISOString().split('T')[0] : '',
      RenewalFee: license.renewalFee || 0,
      RenewalLeadTimeEstimated: String(license.renewalLeadTimeEstimated || ''),
      ResponsiblePerson: license.responsiblePerson,
      Status: getDerivedStatus({ endDate: license.endDate, status: license.status }),
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
              licenseName: row.LicenceType || row.LicenseName || row.licenseName || '',
              licenseNo: row.LicenceNo || row.LicenseNo || row.licenseNo || '',
              issuingAuthorityName: row.IssuingAuthority || row.issuingAuthorityName || '',
              startDate: row.StartDate || row.startDate || new Date().toISOString().split('T')[0],
              endDate: row.EndDate || row.endDate || new Date().toISOString().split('T')[0],
              renewalFee: parseFloat(row.RenewalFee) || 0,
              renewalLeadTimeEstimated: (() => {
                const raw = row.RenewalLeadTimeEstimated || row.renewalLeadTimeEstimated;
                const s = raw === '' || raw === null || raw === undefined ? '' : String(raw).trim();
                return s ? s : undefined;
              })(),
              responsiblePerson: row.ResponsiblePerson || row.responsiblePerson || '',
              status: (() => {
                const raw = String(row.Status || row.status || '').trim();
                if (raw === 'Cancelled') return 'Cancelled';
                const endDate = String(row.EndDate || row.endDate || '').trim();
                return getDerivedStatus({ endDate });
              })(),
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
      (license.responsiblePerson || "").toLowerCase().includes(q);

    const derivedStatus = getDerivedStatus({ endDate: license.endDate, status: license.status });
    const matchesStatus = statusFilter === "all" || derivedStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Keep form status in sync with expiry date (unless user explicitly cancelled)
  useEffect(() => {
    if (!isModalOpen) return;
    const current = String(form.getValues('status') || '').trim();
    if (current === 'Cancelled') return;
    const next = getDerivedStatus({ endDate: String(form.getValues('endDate') || ''), status: current });
    if (current !== next) form.setValue('status', next);
  }, [isModalOpen, expiryDateValue, form]);

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
    
    // On normal Save/Update, status is based on expiry date (Active/Expired).
    // Cancelled is only set via the "Cancel License" action.
    const derivedStatus = getDerivedStatus({ endDate: String(data.endDate || ''), status: '' });
    const payload: LicenseFormData = {
      ...data,
      status: derivedStatus,
    };
    form.setValue('status', derivedStatus);
    licenseMutation.mutate(payload);
  };

  // Handle edit
  const handleEdit = (license: License) => {
    setEditingLicense(license);
    const normalizedStatus = getDerivedStatus({ endDate: license.endDate, status: license.status });
    form.reset({
      licenseName: license.licenseName || "",
      licenseNo: license.licenseNo || "",
      issuingAuthorityName: license.issuingAuthorityName || "",
      startDate: license.startDate || "",
      endDate: license.endDate || "",
      details: license.details || "",
      renewalFee: typeof license.renewalFee === 'number' ? license.renewalFee : undefined,
      renewalCycleTime: license.renewalCycleTime || "",
      renewalLeadTimeEstimated: typeof license.renewalLeadTimeEstimated === 'string' ? license.renewalLeadTimeEstimated : undefined,
      responsiblePerson: license.responsiblePerson || "",
      status: normalizedStatus,
      issuingAuthorityEmail: license.issuingAuthorityEmail || "",
      issuingAuthorityPhone: license.issuingAuthorityPhone || "",
      reminderDays: license.reminderDays || "",
      reminderPolicy: license.reminderPolicy || "",
      renewalStatus: (license.renewalStatus as "Under Processing" | "Canceled" | "Rejected" | "Resubmitted" | "Approved" | undefined) || undefined,
      renewalSubmittedDate: license.renewalSubmittedDate || "",
      expectedCompletedDate: license.expectedCompletedDate || "",
      applicationReferenceNo: license.applicationReferenceNo || "",
      renewalInitiatedDate: license.renewalInitiatedDate || "",
      submittedBy: license.submittedBy || "",
      paymentReferenceNo: license.paymentReferenceNo || "",
      renewalAmount: typeof license.renewalAmount === 'number' ? license.renewalAmount : undefined,
      renewalStatusReason: (license as any).renewalStatusReason || "",
      renewalAttachments: (() => {
        const raw: any = (license as any).renewalAttachments;
        if (!Array.isArray(raw)) return [];
        // Support legacy string[] by converting into {name,url:''}
        if (raw.length > 0 && typeof raw[0] === 'string') {
          return (raw as string[]).map((name) => ({ name, url: '' }));
        }
        return raw as RenewalAttachment[];
      })(),
    });
    setIsModalOpen(true);
  };

  // Handle add new
  const handleAddNew = () => {
  setEditingLicense(null);
  form.reset();
  setIsModalOpen(true);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    const license = licenses.find((l) => l.id === id) || null;
    setLicenseToDelete(license);
    setDeleteConfirmOpen(true);
  };

  // Status badge component - exactly matching Subscriptions page
  const getStatusClassName = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "Expired":
        return "bg-rose-100 text-rose-800 border border-rose-200";
      case "Cancelled":
        return "bg-gray-100 text-gray-800 border border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  // (date formatting handled inline where needed)

  // (summary cards removed)

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
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={triggerImport}
                className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
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
          {/* Key Metrics Cards removed as requested */}
        </div>

        {/* Filters Section */}
        <Card className="mb-6 border-slate-200 shadow-md rounded-xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg h-10"
                />
              </div>
              {/* Status Filter */}
              <div className="w-full sm:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
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
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">Licence Type</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Issuing Authority</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Issue Date</TableHead>
                        <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Expiry Date</TableHead>
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
                              <button
                                type="button"
                                onClick={() => handleEdit(license)}
                                className="text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
                              >
                                {license.licenseName}
                              </button>
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
                            <TableCell className="px-4 py-3 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                title="Renewel Submit"
                                onClick={() => {
                                  handleEdit(license);
                                  setShowSubmissionDetails(true);
                                }}
                                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 hover:text-green-800 font-medium text-sm px-3 py-1 transition-colors"
                              >
                                Renewel Submit
                              </Button>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right text-sm text-gray-700 font-semibold">
                              {typeof license.renewalFee === 'number' ? `$${Math.round(license.renewalFee).toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              {(() => {
                                const derived = getDerivedStatus({ endDate: license.endDate, status: license.status });
                                return (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusClassName(derived)}`}>
                                    {derived}
                                  </span>
                                );
                              })()}
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
            setEditingLicense(null);
          } 
          setIsModalOpen(v); 
        }}>
          <DialogContent className={`${isFullscreen ? 'max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh]' : 'max-w-4xl min-w-[400px] max-h-[80vh]'} overflow-y-auto overflow-x-hidden rounded-2xl border-slate-200 shadow-2xl p-0 bg-white transition-[width,height] duration-300`}>
            <DialogHeader className={`sticky top-0 z-20 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white ${isFullscreen ? 'px-4 py-3 md:px-5 md:py-3' : 'p-5'} rounded-t-2xl flex flex-row items-center justify-between`}>
              <div className="flex items-center gap-4">
                <ShieldCheck className="h-6 w-6" />
                <DialogTitle className="text-xl font-bold leading-none">
                  {showSubmissionDetails ? 'Renewel Submission' : editingLicense ? 'Edit License' : 'License'}
                </DialogTitle>
                {(() => {
                  const derived = getDerivedStatus({ endDate: expiryDateValue, status: statusValue });
                  const cls =
                    derived === 'Active'
                      ? 'bg-green-500 text-white'
                      : derived === 'Expired'
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-500 text-white';
                  return (
                    <span className={`ml-4 px-4 py-2 rounded-full text-sm font-semibold shadow-sm tracking-wide ${cls}`}>{derived}</span>
                  );
                })()}
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
                {showSubmissionDetails && (
                  <div className="hidden sm:flex items-center gap-2 text-sm text-white/90">
                    <span className="opacity-80">License No.</span>
                    <span className="font-semibold text-white">
                      {String(form.watch('licenseNo') || editingLicense?.licenseNo || editingLicense?.id || '').trim() || '-'}
                    </span>
                  </div>
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
                    <div className={`grid gap-6 mb-8 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                        <FormField
                          control={form.control}
                          name="applicationReferenceNo"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Application Reference no.:
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="renewalInitiatedDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Renewal Initiated date:
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="expectedCompletedDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Expected completion date:
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="submittedBy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Submitted by:
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <EmployeeSearchDropdown
                                  value={String(field.value || '')}
                                  onChange={field.onChange}
                                  employees={employeesRaw as any}
                                />
                              </FormControl>
                              <FormMessage className="text-red-500" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="paymentReferenceNo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Payment Reference no.:
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="renewalAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Renewal amount (if any):
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                                  inputMode="decimal"
                                  value={field.value === undefined ? '' : String(field.value)}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '') return field.onChange(undefined);
                                    const n = Number(v);
                                    field.onChange(Number.isFinite(n) ? n : undefined);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="renewalAttachments"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Attachments (if any):
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white"
                                      onClick={() => setShowRenewalDocumentsModal(true)}
                                    >
                                      Upload
                                    </Button>
                                    <div className="text-sm text-slate-500 truncate">
                                      {(field.value || []).length ? `${(field.value || []).length} file(s) attached` : 'No files attached'}
                                    </div>
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="renewalStatus"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Renewal Status:
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <Select
                                  value={field.value}
                                  onValueChange={(val) => {
                                    const prev = String(field.value || '');
                                    setPreviousRenewalStatus(prev);

                                    if (val === 'Canceled' || val === 'Rejected') {
                                      setPendingRenewalStatus(val);
                                      setReasonModalTitle(val === 'Canceled' ? 'Cancellation Reason' : 'Rejection Reason');
                                      setRenewalStatusReasonDraft(String(form.getValues('renewalStatusReason') || ''));
                                      setShowRenewalStatusReasonModal(true);
                                    }

                                    field.onChange(val);
                                  }}
                                >
                                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                                    <SelectItem value="Under Processing" className="text-slate-900 hover:bg-blue-50">Under Processing</SelectItem>
                                    <SelectItem value="Approved" className="text-slate-900 hover:bg-blue-50">Approved</SelectItem>
                                    <SelectItem value="Rejected" className="text-slate-900 hover:bg-blue-50">Rejected</SelectItem>
                                    <SelectItem value="Resubmitted" className="text-slate-900 hover:bg-blue-50">Resubmitted</SelectItem>
                                    <SelectItem value="Canceled" className="text-slate-900 hover:bg-blue-50">Canceled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="renewalSubmittedDate"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel className="block text-sm font-medium text-slate-700">Renewal Submitted date</FormLabel>
                              <FormControl>
                                <Input className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" type="date" {...field} />
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
                  {/* General Info Section */}
                  <div className="bg-white rounded-xl border border-gray-200 mb-6 shadow-md">
                    <h3 className="text-base font-semibold text-slate-800 px-6 py-4 border-b border-gray-200 bg-gray-50">General Info</h3>
                    <div className="p-6">
                    <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-4' : 'grid-cols-2'}`}>
                      {/* Licence Type */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Licence Title/Type</label>
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

                      {/* Licence No. */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Licence No.</label>
                        <Input
                          type="text"
                          inputMode="text"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('licenseNo') || ''}
                          onChange={(e) => form.setValue('licenseNo', e.target.value)}
                        />
                      </div>

                      {/* Responsible Person - exact dropdown pattern from SubscriptionModal Owner */}
                      <FormField
                        control={form.control}
                        name="responsiblePerson"
                        render={({ field }) => {
                          const [responsiblePersonOpen, setResponsiblePersonOpen] = useState(false);
                          const [responsiblePersonSearch, setResponsiblePersonSearch] = useState('');
                          const responsiblePersonDropdownRef = useRef<HTMLDivElement>(null);
                          useEffect(() => {
                            if (!responsiblePersonOpen) return;
                            function handleClickOutside(event: MouseEvent) {
                              if (
                                responsiblePersonDropdownRef.current &&
                                !responsiblePersonDropdownRef.current.contains(event.target as Node)
                              ) {
                                setResponsiblePersonOpen(false);
                                setResponsiblePersonSearch('');
                              }
                            }
                            document.addEventListener('mousedown', handleClickOutside);
                            return () => {
                              document.removeEventListener('mousedown', handleClickOutside);
                            };
                          }, [responsiblePersonOpen]);

                          const options = employeesRaw.length > 0
                            ? employeesRaw.map((emp: any) => {
                                const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                                const displayName = duplicateNames.length > 1
                                  ? `${emp.name} (${emp.email})`
                                  : emp.name;
                                const uniqueValue = duplicateNames.length > 1
                                  ? `${emp.name}|${emp.email}`
                                  : emp.name;
                                return { displayName, uniqueValue, name: emp.name, email: emp.email };
                              })
                            : [];

                          const normalizedSearch = responsiblePersonSearch.trim().toLowerCase();
                          const filtered = normalizedSearch
                            ? options.filter(opt => (opt.displayName || '').toLowerCase().includes(normalizedSearch))
                            : options;

                          return (
                            <FormItem className="relative" ref={responsiblePersonDropdownRef}>
                              <FormLabel className="block text-sm font-medium text-slate-700">Responsible Person</FormLabel>
                              <div className="relative">
                                <Input
                                  value={responsiblePersonOpen ? responsiblePersonSearch : (field.value || '')}

                                  className="w-full border-slate-300 rounded-lg p-2 pr-10 text-base cursor-pointer"
                                  onChange={(e) => {
                                    setResponsiblePersonSearch(e.target.value);
                                    if (!responsiblePersonOpen) setResponsiblePersonOpen(true);
                                  }}
                                  onFocus={() => {
                                    setResponsiblePersonSearch(field.value || '');
                                    setResponsiblePersonOpen(true);
                                  }}
                                  onClick={() => {
                                    setResponsiblePersonSearch(field.value || '');
                                    setResponsiblePersonOpen(true);
                                  }}
                                />
                                <ChevronDown
                                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                                  onClick={() => {
                                    if (!responsiblePersonOpen) setResponsiblePersonSearch(field.value || '');
                                    setResponsiblePersonOpen(!responsiblePersonOpen);
                                    if (responsiblePersonOpen) setResponsiblePersonSearch('');
                                  }}
                                />
                              </div>
                              {responsiblePersonOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto custom-scrollbar">
                                  {filtered.length > 0 ? (
                                    filtered.map(opt => (
                                      <div
                                        key={opt.uniqueValue}
                                        className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                        onClick={() => {
                                          const value = opt.uniqueValue;
                                          // If clicking on already selected item, clear it
                                          if (field.value === opt.uniqueValue || field.value === opt.name) {
                                            field.onChange('');
                                            setResponsiblePersonOpen(false);
                                            setResponsiblePersonSearch('');
                                            return;
                                          }

                                          const emp = employeesRaw.find((e: any) => {
                                            if (value.includes('|')) {
                                              const [name, email] = value.split('|');
                                              return e.name === name && e.email === email;
                                            }
                                            return e.name === value;
                                          });
                                          field.onChange(emp?.name || value);
                                          setResponsiblePersonOpen(false);
                                          setResponsiblePersonSearch('');
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 text-blue-600 ${field.value === opt.uniqueValue ? "opacity-100" : "opacity-0"}`}
                                        />
                                        <span className="font-normal">{opt.displayName}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="dropdown-item disabled text-gray-400">No employees found</div>
                                  )}
                                </div>
                              )}
                              <FormMessage className="text-red-500" />
                            </FormItem>
                          );
                        }}
                      />

                      {/* Issue Date */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Issue Date</label>
                        <Input 
                          type="date"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('startDate') || ''}
                          onChange={(e) => form.setValue('startDate', e.target.value)}
                        />
                      </div>

                       <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Renewel freq</label>
                        <Select
                          value={form.watch('renewalCycleTime') || ''}
                          onValueChange={(value) => form.setValue('renewalCycleTime', value)}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Annual">Annual</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="One-time">One-time</SelectItem>
                            <SelectItem value="Ad-hoc">Ad-hoc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Expiry Date */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Expiry Date</label>
                        <Input 
                          type="date"
                          disabled={isExpiryDisabled}
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                          value={expiryDateValue}
                          onChange={(e) => {
                            form.setValue('endDate', e.target.value);
                          }}
                        />
                        {endDateError && (
                          <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {endDateError}
                          </p>
                        )}
                      </div>

                      {/* Renewal Cost */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Renewal Cost</label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={renewalFeeText}
                          onChange={(e) => {
                            const raw = e.target.value;
                            let cleaned = raw.replace(/[^0-9.]/g, '');
                            // keep only first dot
                            const firstDot = cleaned.indexOf('.');
                            if (firstDot !== -1) {
                              cleaned =
                                cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
                            }
                            // normalize leading dot
                            if (cleaned.startsWith('.')) cleaned = `0${cleaned}`;

                            // limit to 2 decimals while typing
                            const parts = cleaned.split('.');
                            if (parts.length === 2) {
                              cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
                            }

                            setRenewalFeeText(cleaned);
                            if (cleaned === '' || cleaned === '0.' || cleaned === '.') {
                              form.setValue('renewalFee', undefined);
                              return;
                            }
                            const n = parseFloat(cleaned);
                            form.setValue('renewalFee', Number.isFinite(n) ? n : undefined);
                          }}
                          onBlur={() => {
                            const raw = renewalFeeText.trim();
                            if (!raw) {
                              form.setValue('renewalFee', undefined);
                              setRenewalFeeText('');
                              return;
                            }
                            const n = parseFloat(raw);
                            if (!Number.isFinite(n)) {
                              form.setValue('renewalFee', undefined);
                              setRenewalFeeText('');
                              return;
                            }
                            form.setValue('renewalFee', n);
                            setRenewalFeeText(n.toFixed(2));
                          }}
                        />
                      </div>

                      {/* Renewal Lead Time (Estimated) */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Renewal Lead Time (Estimated)</label>
                        <Input
                          type="text"
                          inputMode="text"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={String(form.watch('renewalLeadTimeEstimated') || '')}
                          onChange={(e) => {
                            const s = e.target.value;
                            form.setValue('renewalLeadTimeEstimated', s ? s : undefined);
                          }}
                        />
                      </div>

                      {/* Renewel freq */}
                     

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
                      <FormField
                        control={form.control}
                        name="issuingAuthorityName"
                        render={({ field }) => {
                          const [authorityOpen, setAuthorityOpen] = useState(false);
                          const [authoritySearch, setAuthoritySearch] = useState('');
                          const authorityDropdownRef = useRef<HTMLDivElement>(null);

                          useEffect(() => {
                            if (!authorityOpen) return;
                            function handleClickOutside(event: MouseEvent) {
                              if (
                                authorityDropdownRef.current &&
                                !authorityDropdownRef.current.contains(event.target as Node)
                              ) {
                                setAuthorityOpen(false);
                                setAuthoritySearch('');
                              }
                            }
                            document.addEventListener('mousedown', handleClickOutside);
                            return () => document.removeEventListener('mousedown', handleClickOutside);
                          }, [authorityOpen]);

                          const q = authoritySearch.trim().toLowerCase();
                          const filteredAuthorities = q
                            ? ISSUING_AUTHORITIES.filter(a => a.toLowerCase().includes(q))
                            : ISSUING_AUTHORITIES;

                          return (
                            <FormItem className="relative" ref={authorityDropdownRef}>
                              <FormLabel className="block text-sm font-medium text-slate-700">Authority</FormLabel>
                              <div className="relative">
                                <Input
                                  value={authorityOpen ? authoritySearch : (field.value || '')}
                                  className="w-full border-slate-300 rounded-lg p-2.5 pr-10 text-base cursor-pointer"
                                  onChange={(e) => {
                                    setAuthoritySearch(e.target.value);
                                    if (!authorityOpen) setAuthorityOpen(true);
                                  }}
                                  onFocus={() => {
                                    setAuthoritySearch(field.value || '');
                                    setAuthorityOpen(true);
                                  }}
                                  onClick={() => {
                                    setAuthoritySearch(field.value || '');
                                    setAuthorityOpen(true);
                                  }}
                                />
                                <ChevronDown
                                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                                  onClick={() => {
                                    if (!authorityOpen) setAuthoritySearch(field.value || '');
                                    setAuthorityOpen(!authorityOpen);
                                    if (authorityOpen) setAuthoritySearch('');
                                  }}
                                />
                              </div>
                              {authorityOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto custom-scrollbar">
                                  {filteredAuthorities.length > 0 ? (
                                    filteredAuthorities.map((name) => (
                                      <div
                                        key={name}
                                        className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                        onClick={() => {
                                          if (field.value === name) {
                                            field.onChange('');
                                            setAuthorityOpen(false);
                                            setAuthoritySearch('');
                                            return;
                                          }
                                          field.onChange(name);
                                          setAuthorityOpen(false);
                                          setAuthoritySearch('');
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 text-blue-600 ${field.value === name ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                        <span className="font-normal">{name}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-3 py-2 text-sm text-slate-500">No matching authorities found</div>
                                  )}
                                </div>
                              )}
                              <FormMessage className="text-red-500" />
                            </FormItem>
                          );
                        }}
                      />

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
                            <SelectValue />
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
                        form.setValue('status', 'Cancelled');
                        const current = form.getValues();
                        const payload: LicenseFormData = {
                          ...current,
                          status: 'Cancelled',
                        };
                        licenseMutation.mutate(payload);
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
                    type="submit" 
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-blue-700 rounded-lg transition-all duration-200 tracking-tight"
                    disabled={licenseMutation.isPending}
                  >
                    {licenseMutation.isPending ? 'Saving...' : (editingLicense ? 'Update License' : 'Save License')}
                  </Button>
                </div>
              </form>
            </Form>

            {/* Renewal Documents Modal (like Subscription Documents dialog) */}
            <Dialog open={showRenewalDocumentsModal} onOpenChange={setShowRenewalDocumentsModal}>
              <DialogContent className="max-w-5xl max-h-[85vh] bg-white shadow-2xl border-2 border-gray-200 overflow-hidden flex flex-col">
                <DialogHeader className="border-b border-gray-200 pb-3 pr-8 flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <DialogTitle className="text-lg font-semibold text-gray-900">Documents</DialogTitle>
                      <p className="text-sm text-gray-600 mt-1">Company-wide and employee documents</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast({
                            title: "Refreshed",
                            description: "Documents refreshed",
                            duration: 2000,
                            variant: "success",
                          });
                        }}
                        className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 border-gray-300"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleRenewalAttachmentUpload()}
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
                  {/* Document List */}
                  {((form.watch('renewalAttachments') || []) as any[]).length > 0 ? (
                    <div className="space-y-2 pr-2">
                      {((form.watch('renewalAttachments') || []) as RenewalAttachment[]).map((doc, index) => (
                        <div key={index} className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all duration-200">
                          {/* Table-like layout with columns */}
                          <div className="grid grid-cols-12 gap-4 items-center">
                            {/* Column 1: File Icon and Name */}
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
                            
                            {/* Column 2: Uploaded by */}
                            <div className="col-span-3 flex items-center gap-1.5">
                              <div className="h-5 w-5 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="h-3 w-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-gray-500">Uploaded by</p>
                                <p className="text-xs font-medium text-gray-900 truncate">{doc.uploadedBy || currentUserName}</p>
                              </div>
                            </div>
                            
                            {/* Column 3: Uploaded date */}
                            <div className="col-span-3 flex items-center gap-1.5">
                              <svg className="h-4 w-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-gray-500">Uploaded date</p>
                                <p className="text-xs font-medium text-gray-900 truncate">{doc.uploadedAt || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                              </div>
                            </div>
                            
                            {/* Column 4: Actions */}
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
                                      title: "Error",
                                      description: "Failed to view document",
                                      variant: "destructive",
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
                                      title: "Download Started",
                                      description: `Downloading ${doc.name}`,
                                      duration: 2000,
                                      variant: "success",
                                    });
                                  } catch (error) {
                                    toast({
                                      title: "Error",
                                      description: "Failed to download document",
                                      variant: "destructive",
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
                                  const updatedDocs = (form.getValues('renewalAttachments') || []) as RenewalAttachment[];
                                  form.setValue('renewalAttachments', updatedDocs.filter((_, i) => i !== index), { shouldDirty: true });
                                  toast({
                                    title: "Document Removed",
                                    description: `${doc.name} has been removed`,
                                    duration: 2000,
                                    variant: "destructive",
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
                    {((form.watch('renewalAttachments') || []) as any[]).length} document{((form.watch('renewalAttachments') || []) as any[]).length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRenewalDocumentsModal(false)}
                      className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm px-4 py-1.5"
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setShowRenewalDocumentsModal(false)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Renewal Status Reason Modal */}
            <Dialog
              open={showRenewalStatusReasonModal}
              onOpenChange={(open) => {
                if (!open) {
                  setShowRenewalStatusReasonModal(false);
                  setRenewalStatusReasonDraft('');
                  setPendingRenewalStatus('');
                  if (previousRenewalStatus) {
                    form.setValue('renewalStatus', previousRenewalStatus as any, { shouldDirty: true });
                  } else {
                    form.setValue('renewalStatus', undefined, { shouldDirty: true });
                  }
                }
              }}
            >
              <DialogContent className="sm:max-w-[520px] bg-white">
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-gray-900">{reasonModalTitle}</div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">
                      Please provide a reason for {pendingRenewalStatus === 'Canceled' ? 'cancellation' : 'rejection'}
                      <span className="text-red-500"> *</span>
                    </div>
                    <textarea
                      value={renewalStatusReasonDraft}
                      onChange={(e) => setRenewalStatusReasonDraft(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[120px] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Enter reason"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowRenewalStatusReasonModal(false);
                        setRenewalStatusReasonDraft('');
                        setPendingRenewalStatus('');
                        if (previousRenewalStatus) {
                          form.setValue('renewalStatus', previousRenewalStatus as any, { shouldDirty: true });
                        } else {
                          form.setValue('renewalStatus', undefined, { shouldDirty: true });
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => {
                        if (!renewalStatusReasonDraft.trim()) {
                          toast({
                            title: 'Reason required',
                            description: 'Please enter a reason before submitting.',
                            variant: 'destructive',
                            duration: 2500,
                          });
                          return;
                        }
                        form.setValue('renewalStatusReason', renewalStatusReasonDraft.trim(), { shouldDirty: true });
                        setShowRenewalStatusReasonModal(false);
                        setRenewalStatusReasonDraft('');
                        setPendingRenewalStatus('');
                      }}
                    >
                      Submit
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
        
        <input
          type="file"
          accept=".csv,text/csv"
          ref={fileInputRef}
          onChange={handleImport}
          className="hidden"
        />

        {/* Delete License Dialog */}
        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={(open) => {
            setDeleteConfirmOpen(open);
            if (!open) setLicenseToDelete(null);
          }}
        >
          <AlertDialogContent className="bg-white border border-gray-200 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-gray-900">Delete license?</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="text-sm text-gray-600">
              Are you sure you want to delete this license{licenseToDelete?.licenseName ? `: ${licenseToDelete.licenseName}` : ''}?
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setLicenseToDelete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (licenseToDelete?.id) deleteMutation.mutate(licenseToDelete.id);
                  setDeleteConfirmOpen(false);
                  setLicenseToDelete(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}