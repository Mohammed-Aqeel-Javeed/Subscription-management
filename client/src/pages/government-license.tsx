import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Can } from "@/components/Can";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Edit, Trash2, Plus, Search, Shield, ShieldCheck, AlertCircle, Maximize2, Minimize2, Calendar, Download, Upload, Check, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "../hooks/use-toast";
import { z } from "zod";
import { API_BASE_URL } from "@/lib/config";
import { Badge } from "../components/ui/badge";
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

// License interface
type RenewalAttachment = { name: string; url: string; uploadedBy?: string; uploadedAt?: string };

interface Department {
  name: string;
  visible: boolean;
}

interface License {
  id: string;
  licenseName: string;
  entityOwner?: string;
  category?: string;
  beneficiaryType?: string;
  beneficiaryNameNo?: string;
  issuingAuthorityName: string;
  startDate: string;
  endDate: string;
  details: string;
  renewalFee: number;
  currency?: string;
  lcyAmount?: number;
  renewalCycleTime?: string;
  renewalLeadTimeEstimated?: string;
  responsiblePerson: string;
  secondaryPerson?: string;
  department?: string;
  departments?: string[];
  status: 'Active' | 'Expired' | 'Cancelled';
  issuingAuthorityEmail: string;
  issuingAuthorityPhone: string;
  reminderDays?: number | string;
  reminderPolicy?: string;
  renewalStatus?: string;
  expectedCompletedDate?: string;
  renewalInitiatedDate?: string;
  submittedBy?: string;
  renewalAmount?: number;
  renewalStatusReason?: string;
  renewalAttachments?: RenewalAttachment[] | string[];
  createdAt?: string;
  updatedAt?: string;
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

// Form schema (all fields optional - no mandatory validation)
const licenseSchema = z
  .object({
  licenseName: z.string().optional(),
  entityOwner: z.string().optional(),
  category: z.string().optional(),
  beneficiaryType: z.string().optional(),
  beneficiaryNameNo: z.string().optional(),
  // licenseNo removed
  issuingAuthorityName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  details: z.string().optional(),
  renewalFee: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(Number(num)) ? undefined : Number(num);
  }, z.number().optional()),
  currency: z.string().optional(),
  lcyAmount: z.preprocess((val) => {
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
  secondaryPerson: z.string().optional(),
  department: z.string().optional(),
  departments: z.array(z.string()).optional(),
  status: z.enum(['Active', 'Expired', 'Cancelled']).optional(),
  renewalStatus: z
    .enum([
      'Renewal Initiated',
      'Application Submitted',
      'Amendments/ Appeal Submitted',
      'Resubmitted',
      'Rejected',
      'Cancelled',
      'Approved',
    ])
    .optional(),
  issuingAuthorityEmail: z.string().optional(),
  issuingAuthorityPhone: z.string().optional(),
  // renewalSubmittedDate removed
  expectedCompletedDate: z.string().optional(),
  // applicationReferenceNo removed
  renewalInitiatedDate: z.string().optional(),
  submittedBy: z.string().optional(),
  // paymentReferenceNo removed
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
    if (start && end) {
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime <= startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'Expiry date must be after issue date',
        });
      }
    }

    const initiated = String(data.renewalInitiatedDate || '').trim();
    const expected = String(data.expectedCompletedDate || '').trim();
    if (initiated && expected) {
      const initiatedTime = new Date(initiated).getTime();
      const expectedTime = new Date(expected).getTime();
      if (Number.isFinite(initiatedTime) && Number.isFinite(expectedTime) && expectedTime < initiatedTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expectedCompletedDate'],
          message: 'Expected completion date must be on or after renewal initiated date',
        });
      }
    }
  });

type LicenseFormData = z.infer<typeof licenseSchema>;

function EmployeeSearchDropdown(props: {
  value: string;
  onChange: (value: string) => void;
  employees: Array<{ name?: string; email?: string }>;
  onAddNew?: () => void;
}) {
  const { value, onChange, employees, onAddNew } = props;
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

    const dialogEl = dropdownRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    function handleDialogScroll() {
      setOpen(false);
      setSearch('');
    }

    document.addEventListener('mousedown', handleClickOutside);
    dialogEl?.addEventListener('scroll', handleDialogScroll, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      dialogEl?.removeEventListener('scroll', handleDialogScroll);
    };
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
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-auto overscroll-contain custom-scrollbar"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
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

          {onAddNew && (
            <div
              className="font-medium border-t border-gray-200 mt-2 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
              style={{ marginTop: '4px', minHeight: '40px', display: 'flex', alignItems: 'center' }}
              onClick={() => {
                setOpen(false);
                setSearch('');
                onAddNew();
              }}
            >
              + New
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Generic searchable dropdown for string options
function SearchableStringDropdown(props: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  onAddNew?: () => void;
}) {
  const { value, onChange, options, placeholder, className, onAddNew } = props;
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

    const dialogEl = dropdownRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    function handleDialogScroll() {
      setOpen(false);
      setSearch('');
    }

    document.addEventListener('mousedown', handleClickOutside);
    dialogEl?.addEventListener('scroll', handleDialogScroll, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      dialogEl?.removeEventListener('scroll', handleDialogScroll);
    };
  }, [open]);

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? options.filter((opt) => opt.toLowerCase().includes(normalizedSearch))
    : options;

  return (
    <div className="relative" ref={dropdownRef}>
      <Input
        value={open ? search : (value || '')}
        placeholder={placeholder}
        className={className || "w-full border-slate-300 rounded-lg p-2.5 pr-10 text-base cursor-pointer"}
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
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-auto overscroll-contain custom-scrollbar"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <div
                key={opt}
                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                onClick={() => {
                  if (value === opt) {
                    onChange('');
                  } else {
                    onChange(opt);
                  }
                  setOpen(false);
                  setSearch('');
                }}
              >
                <Check className={`mr-2 h-4 w-4 text-blue-600 ${value === opt ? 'opacity-100' : 'opacity-0'}`} />
                <span className="font-normal">{opt}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">No options found</div>
          )}

          {onAddNew && (
            <div
              className="font-medium border-t border-gray-200 mt-2 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
              style={{ marginTop: '4px', minHeight: '40px', display: 'flex', alignItems: 'center' }}
              onClick={() => {
                setOpen(false);
                setSearch('');
                onAddNew();
              }}
            >
              + New
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Multi-select dropdown for departments
function MultiSelectDepartmentsDropdown(props: {
  selectedDepartments: string[];
  onDepartmentChange: (dept: string, checked: boolean) => void;
  onRemoveDepartment: (dept: string) => void;
  departments: Department[];
  departmentsLoading: boolean;
  onAddNew: () => void;
}) {
  const { selectedDepartments, onDepartmentChange, onRemoveDepartment, departments, departmentsLoading, onAddNew } = props;
  const [deptOpen, setDeptOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deptOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target as Node)) {
        setDeptOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [deptOpen]);

  return (
    <div className="relative" ref={deptDropdownRef}>
      <div
        className="w-full border border-slate-300 rounded-lg p-2 text-base min-h-[44px] flex items-start justify-start overflow-hidden bg-gray-50 cursor-pointer focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-200"
        onClick={() => setDeptOpen(true)}
        tabIndex={0}
        onFocus={() => setDeptOpen(true)}
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
                    onRemoveDepartment(dept);
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
          onClick={(e) => {
            e.stopPropagation();
            setDeptOpen(!deptOpen);
          }}
        />
      </div>
      {selectedDepartments.includes('Company Level') && (
        <p className="mt-1 text-xs text-slate-500">All departments are selected</p>
      )}
      {deptOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto custom-scrollbar">
          <div className="flex items-center px-2 py-2 hover:bg-slate-100 rounded-md border-b border-gray-200 mb-1">
            <Checkbox
              id="dept-company-level"
              checked={selectedDepartments.includes('Company Level')}
              onCheckedChange={(checked: boolean) => onDepartmentChange('Company Level', checked)}
              disabled={departmentsLoading}
            />
            <label
              htmlFor="dept-company-level"
              className="text-sm font-bold cursor-pointer flex-1 ml-2 text-blue-600"
            >
              Company Level
            </label>
          </div>
          {Array.isArray(departments) && departments.length > 0
            ? departments
                .filter(dept => dept.visible)
                .map(dept => (
                  <div key={dept.name} className="flex items-center px-2 py-2 hover:bg-slate-100 rounded-md">
                    <Checkbox
                      id={`dept-${dept.name}`}
                      checked={selectedDepartments.includes(dept.name)}
                      onCheckedChange={(checked: boolean) => onDepartmentChange(dept.name, checked)}
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
            : null}
          <div
            className="font-medium border-t border-gray-200 mt-2 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
            style={{ marginTop: '4px', minHeight: '40px', display: 'flex', alignItems: 'center' }}
            onClick={() => onAddNew()}
          >
            + New
          </div>
          {Array.isArray(departments) && departments.filter(dept => dept.visible).length === 0 && (
            <div className="dropdown-item disabled text-gray-400">No departments found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GovernmentLicense() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [licenseToDelete, setLicenseToDelete] = useState<License | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  // Submission details view state
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  const [submissionOpenedFromTable, setSubmissionOpenedFromTable] = useState(false);

  // Sorting state (match Subscriptions behavior)
  const [sortField, setSortField] = useState<"licenseName" | "issuingAuthorityName" | "startDate" | "endDate" | "renewalFee" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Snapshot of initial values when modal opens, used to decide whether to show exit confirmation
  const initialFormSnapshotRef = useRef<LicenseFormData | null>(null);
  const initialSelectedDepartmentsRef = useRef<string[]>([]);

  const cloneSnapshot = (v: LicenseFormData): LicenseFormData => ({
    ...v,
    departments: Array.isArray(v.departments) ? [...v.departments] : [],
    renewalAttachments: Array.isArray(v.renewalAttachments) ? [...v.renewalAttachments] : [],
  });

  const [showRenewalDocumentsModal, setShowRenewalDocumentsModal] = useState(false);
  const [showRenewalStatusReasonModal, setShowRenewalStatusReasonModal] = useState(false);
  const [renewalStatusReasonDraft, setRenewalStatusReasonDraft] = useState('');
  const [, setPendingRenewalStatus] = useState<string>('');
  const [previousRenewalStatus, setPreviousRenewalStatus] = useState<string>('');
  const [reasonModalTitle, setReasonModalTitle] = useState<'Rejection Reason' | 'Cancellation Reason' | 'Amendment/Appeal Reason'>('Rejection Reason');
  const lastResubmittedClearRef = useRef(false);

  const [showApprovedExpiryModal, setShowApprovedExpiryModal] = useState(false);
  const [approvedExpiryDraft, setApprovedExpiryDraft] = useState('');
  const [approvedIssueDraft, setApprovedIssueDraft] = useState('');
  const [previousRenewalStatusForExpiry, setPreviousRenewalStatusForExpiry] = useState<string>('');

  const [renewalFeeText, setRenewalFeeText] = useState('');
  const [currency, setCurrency] = useState('');
  const [lcyAmount, setLcyAmount] = useState('');

  const [endDateManuallySet, setEndDateManuallySet] = useState(false);
  const prevAutoCalcInputsRef = useRef<{ renewalFreq: string; issueDate: string } | null>(null);

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

  const EMPTY_LICENSE_FORM_VALUES: LicenseFormData = {
    licenseName: "",
    entityOwner: "",
    category: "",
    beneficiaryType: "",
    beneficiaryNameNo: "",
    // licenseNo removed
    issuingAuthorityName: "",
    startDate: "",
    endDate: "",
    details: "",
    renewalFee: undefined,
    currency: "",
    lcyAmount: undefined,
    renewalLeadTimeEstimated: undefined,
    responsiblePerson: "",
    secondaryPerson: "",
    department: "",
    departments: [],
    status: "Active",
    issuingAuthorityEmail: "",
    issuingAuthorityPhone: "",
    renewalStatus: undefined,
    // renewalSubmittedDate removed
    expectedCompletedDate: "",
    // applicationReferenceNo removed
    renewalInitiatedDate: "",
    submittedBy: "",
    // paymentReferenceNo removed
    renewalAmount: undefined,
    renewalStatusReason: "",
    renewalAttachments: [],
  };

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: EMPTY_LICENSE_FORM_VALUES,
  });

  const renewalStatusValue = form.watch('renewalStatus');

  useEffect(() => {
    if (renewalStatusValue !== 'Resubmitted') {
      lastResubmittedClearRef.current = false;
      return;
    }
    if (lastResubmittedClearRef.current) return;
    lastResubmittedClearRef.current = true;

    // applicationReferenceNo removed
    form.setValue('renewalInitiatedDate', '', { shouldDirty: true });
    form.setValue('expectedCompletedDate', '', { shouldDirty: true });
    form.setValue('submittedBy', '', { shouldDirty: true });
    // paymentReferenceNo removed
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
    if (renewalStatusValue !== 'Cancelled' && renewalStatusValue !== 'Rejected') {
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

  // Keep "Submitted by" empty by default; user must choose it explicitly.

  const issueDateValue = form.watch('startDate') || '';
  const expiryDateValue = form.watch('endDate') || '';
  const renewalFreqValue = form.watch('renewalCycleTime') || '';
  const statusValue = form.watch('status') || '';
  const endDateError = (form.formState.errors as any)?.endDate?.message as string | undefined;

  const isExpiryDisabled = renewalFreqValue === 'One-time';

  // One-time licenses do not need the renewal submission workflow.
  useEffect(() => {
    if (!isModalOpen) return;
    if (renewalFreqValue !== 'One-time') return;

    if (showSubmissionDetails) setShowSubmissionDetails(false);

    form.setValue('renewalStatus', undefined, { shouldDirty: true });
    form.setValue('expectedCompletedDate', '', { shouldDirty: true });
    form.setValue('renewalInitiatedDate', '', { shouldDirty: true });
    form.setValue('submittedBy', '', { shouldDirty: true });
    form.setValue('renewalAmount', undefined, { shouldDirty: true });
    form.setValue('renewalStatusReason', '', { shouldDirty: true });
    form.setValue('renewalAttachments', [], { shouldDirty: true });

    form.clearErrors([
      'renewalStatus',
      'expectedCompletedDate',
      'renewalInitiatedDate',
      'submittedBy',
      'renewalAmount',
      'renewalStatusReason',
      'renewalAttachments',
    ]);
  }, [isModalOpen, renewalFreqValue, showSubmissionDetails, form]);

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

  // Initialize auto-calc comparison values on open
  useEffect(() => {
    if (!isModalOpen) return;
    prevAutoCalcInputsRef.current = { renewalFreq: renewalFreqValue, issueDate: issueDateValue };
  }, [isModalOpen]);

  // Auto-calculate expiry date when renewal frequency changes (and issue date changes).
  // Keep expiry input editable by not running this on expiry input changes.
  useEffect(() => {
    if (!isModalOpen) return;

    const commitInputs = () => {
      prevAutoCalcInputsRef.current = { renewalFreq: renewalFreqValue, issueDate: issueDateValue };
    };

    const prev = prevAutoCalcInputsRef.current;
    const inputsChanged =
      !prev || prev.renewalFreq !== renewalFreqValue || prev.issueDate !== issueDateValue;

    // If nothing changed (common on edit/reopen), never overwrite an existing endDate.
    if (!inputsChanged && String(form.getValues('endDate') || '').trim()) {
      commitInputs();
      return;
    }

    // If user has manually set an expiry date, don't overwrite it unless they change inputs.
    if (!inputsChanged && endDateManuallySet && String(form.getValues('endDate') || '').trim()) {
      commitInputs();
      return;
    }

    if (renewalFreqValue === 'One-time') {
      if (form.getValues('endDate')) form.setValue('endDate', '');
      form.clearErrors('endDate');
      commitInputs();
      return;
    }

    const monthsToAdd =
      renewalFreqValue === 'Monthly'
        ? 1
        : renewalFreqValue === 'Quarterly'
          ? 3
          : renewalFreqValue === '6 months'
            ? 6
            : renewalFreqValue === 'Yearly' || renewalFreqValue === 'Annual'
              ? 12
              : renewalFreqValue === '2 years'
                ? 24
                : renewalFreqValue === '3 years'
                  ? 36
                  : null;

    if (!monthsToAdd) {
      commitInputs();
      return;
    }

    const start = String(issueDateValue || '').trim();
    if (!start) {
      if (form.getValues('endDate')) form.setValue('endDate', '');
      form.clearErrors('endDate');
      commitInputs();
      return;
    }

    const base = new Date(start);
    if (!Number.isFinite(base.getTime())) {
      commitInputs();
      return;
    }

    // Calculate the end date as the last day of the period (one day before the next period starts)
    const computed = new Date(base);
    computed.setMonth(computed.getMonth() + monthsToAdd);
    computed.setDate(computed.getDate() - 1); // Subtract 1 day to get the last day of the period
    
    const yyyy = computed.getFullYear();
    const mm = String(computed.getMonth() + 1).padStart(2, '0');
    const dd = String(computed.getDate()).padStart(2, '0');
    const computedStr = `${yyyy}-${mm}-${dd}`;
    form.setValue('endDate', computedStr);
    form.clearErrors('endDate');

    commitInputs();
  }, [isModalOpen, renewalFreqValue, issueDateValue, endDateManuallySet, form]);

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
  const { data: employeesRaw = [], refetch: refetchEmployees } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/employees`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // Employee creation modal (match Subscription modal Owner creation)
  const [employeeModal, setEmployeeModal] = useState<{ show: boolean; target?: 'responsiblePerson' | 'secondaryPerson' | 'submittedBy' | 'beneficiaryNameNo' }>({ show: false });
  const [newEmployeeName, setNewEmployeeName] = useState<string>('');
  const [newEmployeeEmail, setNewEmployeeEmail] = useState<string>('');
  const [newEmployeeEmailError, setNewEmployeeEmailError] = useState<string>('');
  const [newEmployeeRole, setNewEmployeeRole] = useState<string>('');
  const [newEmployeeStatus, setNewEmployeeStatus] = useState<string>('active');
  const [newEmployeeDepartment, setNewEmployeeDepartment] = useState<string>('');

  const [employeeDeptOpen, setEmployeeDeptOpen] = useState(false);
  const [employeeDeptSearch, setEmployeeDeptSearch] = useState('');
  const employeeDeptDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!employeeDeptOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (employeeDeptDropdownRef.current && !employeeDeptDropdownRef.current.contains(event.target as Node)) {
        setEmployeeDeptOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [employeeDeptOpen]);

  useEffect(() => {
    if (employeeModal.show) {
      setEmployeeDeptSearch(newEmployeeDepartment || '');
    }
  }, [employeeModal.show, newEmployeeDepartment]);

  const handleAddEmployee = async () => {
    if (!newEmployeeName.trim() || !newEmployeeEmail.trim()) return;

    const emailValidation = validateEmail(newEmployeeEmail.trim());
    if (!emailValidation.valid) {
      setNewEmployeeEmailError(emailValidation.error || 'Invalid email address');
      toast({
        title: 'Invalid Email',
        description: emailValidation.error || 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    if (!newEmployeeDepartment) {
      toast({
        title: 'Department Required',
        description: 'Please select a department',
        variant: 'destructive',
      });
      return;
    }

    const nameExists = (employeesRaw as any[]).some((emp: any) =>
      String(emp?.name || '').toLowerCase().trim() === newEmployeeName.trim().toLowerCase()
    );
    if (nameExists) {
      toast({ title: 'Error', description: 'An employee with this name already exists', variant: 'destructive' });
      return;
    }

    const emailExists = (employeesRaw as any[]).some((emp: any) =>
      String(emp?.email || '').toLowerCase() === newEmployeeEmail.trim().toLowerCase()
    );
    if (emailExists) {
      toast({ title: 'Error', description: 'An employee with this email already exists', variant: 'destructive' });
      return;
    }

    try {
      await apiRequest('POST', '/api/employees', {
        name: newEmployeeName.trim(),
        email: newEmployeeEmail.trim(),
        role: newEmployeeRole,
        status: newEmployeeStatus,
        department: newEmployeeDepartment,
      });

      await refetchEmployees();

      if (employeeModal.target === 'responsiblePerson') {
        form.setValue('responsiblePerson', newEmployeeName.trim(), { shouldDirty: true });
      }
      if (employeeModal.target === 'secondaryPerson') {
        form.setValue('secondaryPerson', newEmployeeName.trim(), { shouldDirty: true });
      }
      if (employeeModal.target === 'submittedBy') {
        form.setValue('submittedBy', newEmployeeName.trim(), { shouldDirty: true });
      }
      if (employeeModal.target === 'beneficiaryNameNo') {
        form.setValue('beneficiaryNameNo', newEmployeeName.trim(), { shouldDirty: true });
      }

      setNewEmployeeName('');
      setNewEmployeeEmail('');
      setNewEmployeeEmailError('');
      setNewEmployeeRole('');
      setNewEmployeeStatus('active');
      setNewEmployeeDepartment('');
      setEmployeeModal({ show: false });

      toast({ title: 'Success', description: 'Employee added successfully', variant: 'success' });
    } catch (error) {
      console.error('Error adding employee:', error);
      toast({ title: 'Error', description: 'Failed to add employee. Please try again.', variant: 'destructive' });
    }
  };

  // Query for company departments (same endpoint used by Subscription modal)
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/company/departments"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/company/departments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch departments");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // Query for currencies (for currency dropdown and exchange rate calculations)
  const { data: currencies = [] } = useQuery({
    queryKey: ["/api/currencies"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/currencies`, { credentials: "include" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // Refetch every 10 seconds to catch exchange rate updates
    staleTime: 0 // Consider data stale immediately to ensure fresh exchange rates
  });

  // Fetch company info for local currency and exchange rate calculations
  const { data: companyInfo = {} } = useQuery({
    queryKey: ["/api/company-info"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/company-info`, { credentials: "include" });
      if (res.ok) {
        return await res.json();
      }
      return {};
    }
  });

  // Calculate LCY Amount based on Renewal Cost and Currency (matching subscription modal logic)
  useEffect(() => {
    const calculateLcyAmount = () => {
      const renewalFee = form.watch('renewalFee');
      const selectedCurrency = currency;
      const localCurrency = (companyInfo as any)?.defaultCurrency;
      
      if (!renewalFee || !selectedCurrency || !localCurrency || selectedCurrency === localCurrency) {
        setLcyAmount(selectedCurrency === localCurrency ? renewalFee?.toString() || '' : '');
        return;
      }
      
      // Find the selected currency and its exchange rate
      const currencyData = currencies.find((curr: any) => curr.code === selectedCurrency);
      const exchangeRate = currencyData?.exchangeRate ? parseFloat(currencyData.exchangeRate) : null;
      
      if (exchangeRate && exchangeRate > 0) {
        const renewalFeeNum = parseFloat(renewalFee?.toString() || '0');
        // Invert the exchange rate: LCY Amount = Renewal Cost ÷ Exchange Rate
        const convertedAmount = renewalFeeNum / exchangeRate;
        setLcyAmount(convertedAmount.toFixed(2));
      } else {
        setLcyAmount('');
      }
    };
    
    calculateLcyAmount();
  }, [form.watch('renewalFee'), currency, (companyInfo as any)?.defaultCurrency, currencies]);

  // Parse departments from stored value (stringified array, array, or single string)
  const parseDepartments = (deptValue?: any) => {
    if (!deptValue) return [] as string[];
    if (Array.isArray(deptValue)) return deptValue.map(String).filter(Boolean);
    const s = String(deptValue);
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // not json
    }
    return s ? [s] : [];
  };

  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const handleDepartmentChange = (departmentName: string, checked: boolean) => {
    if (departmentName === 'Company Level' && checked) {
      setSelectedDepartments(['Company Level']);
      form.setValue('departments', ['Company Level'], { shouldDirty: true });
      return;
    }

    if (departmentName === 'Company Level' && !checked) {
      setSelectedDepartments([]);
      form.setValue('departments', [], { shouldDirty: true });
      return;
    }

    if (checked && selectedDepartments.includes('Company Level')) {
      setSelectedDepartments([departmentName]);
      form.setValue('departments', [departmentName], { shouldDirty: true });
      return;
    }

    const next = checked
      ? [...selectedDepartments, departmentName]
      : selectedDepartments.filter((d) => d !== departmentName);
    setSelectedDepartments(next);
    form.setValue('departments', next, { shouldDirty: true });
  };

  const removeDepartment = (departmentName: string) => {
    const next = selectedDepartments.filter((d) => d !== departmentName);
    setSelectedDepartments(next);
    form.setValue('departments', next, { shouldDirty: true });
  };

  // Department modal state (match Subscription modal)
  const [departmentModal, setDepartmentModal] = useState<{ show: boolean }>({ show: false });
  const [newDepartmentName, setNewDepartmentName] = useState<string>('');
  const [newDepartmentHead, setNewDepartmentHead] = useState<string>('');
  const [newDepartmentEmail, setNewDepartmentEmail] = useState<string>('');
  const [newDepartmentEmailError, setNewDepartmentEmailError] = useState<string>('');
  const [isDepartmentEmailLocked, setIsDepartmentEmailLocked] = useState<boolean>(false);

  const [deptHeadOpen, setDeptHeadOpen] = useState(false);
  const [deptHeadSearch, setDeptHeadSearch] = useState('');
  const deptHeadDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-fill department head email
  useEffect(() => {
    if (newDepartmentHead && employeesRaw && (employeesRaw as any[]).length > 0) {
      const selectedEmp = (employeesRaw as any[]).find((emp: any) => emp?.name === newDepartmentHead);
      const email = String(selectedEmp?.email || '').trim();
      if (email) {
        setNewDepartmentEmail(email);
        setNewDepartmentEmailError('');
        setIsDepartmentEmailLocked(true);
        return;
      }
    }
    setIsDepartmentEmailLocked(false);
  }, [newDepartmentHead, employeesRaw]);

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
  }, [departmentModal.show, newDepartmentHead]);

  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) {
      toast({ title: 'Required', description: 'Department name is required', variant: 'destructive' });
      return;
    }

    if (!newDepartmentHead.trim()) {
      toast({ title: 'Required', description: 'Department head is required', variant: 'destructive' });
      return;
    }

    if (!newDepartmentEmail.trim()) {
      toast({ title: 'Required', description: 'Email address is required', variant: 'destructive' });
      return;
    }

    const validation = validateEmail(newDepartmentEmail);
    if (!validation.valid) {
      setNewDepartmentEmailError(validation.error || 'Invalid email');
      return;
    }

    try {
      await apiRequest('POST', '/api/company/departments', {
        name: newDepartmentName.trim(),
        visible: true,
        departmentHead: newDepartmentHead.trim(),
        email: newDepartmentEmail.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/company/departments"] });

      // auto-select the newly created department
      if (!selectedDepartments.includes('Company Level')) {
        const next = selectedDepartments.includes(newDepartmentName.trim())
          ? selectedDepartments
          : [...selectedDepartments, newDepartmentName.trim()];
        setSelectedDepartments(next);
        form.setValue('departments', next, { shouldDirty: true });
      }

      setDepartmentModal({ show: false });
      setNewDepartmentName('');
      setNewDepartmentHead('');
      setDeptHeadSearch('');
      setDeptHeadOpen(false);
      setNewDepartmentEmail('');
      setNewDepartmentEmailError('');

      toast({ title: 'Added', description: 'Department added successfully', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to add department', variant: 'destructive' });
    }
  };

  // State for license name validation
  const [licenseNameError, setLicenseNameError] = useState<string>("");
  
  // State for renewal lead time validation
  const [renewalLeadTimeError, setRenewalLeadTimeError] = useState<string>("");
  const [renewalLeadTimeErrorOpen, setRenewalLeadTimeErrorOpen] = useState<boolean>(false);
  
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
      const result = await res.json();
      
      // Log the action with comprehensive details
      try {
        const action = editingLicense ? 'Updated' : 'Created';
        let changes = '';
        
        if (editingLicense) {
          // Track field-by-field changes
          const changesList: string[] = [];
          
          // Helper function to format field changes
          const formatChange = (fieldName: string, oldVal: any, newVal: any, alwaysShow = false) => {
            // Check if old value is empty
            const oldIsEmpty = oldVal === undefined || oldVal === null || oldVal === '';
            const newIsEmpty = newVal === undefined || newVal === null || newVal === '';
            
            // For special fields like Status Reason, always show if there's a new value
            if (alwaysShow && !newIsEmpty) {
              const oldDisplay = oldIsEmpty ? 'Not Set' : oldVal;
              return `${fieldName}: ${oldDisplay} → ${newVal}`;
            }
            
            // Skip if going from empty to a value (don't log initial fills)
            if (oldIsEmpty && !newIsEmpty) {
              return null;
            }
            
            // Skip if both are empty
            if (oldIsEmpty && newIsEmpty) {
              return null;
            }
            
            // Only log if both have values and they're different, or if clearing a value
            if (oldVal !== newVal) {
              const oldDisplay = oldIsEmpty ? 'Not Set' : oldVal;
              const newDisplay = newIsEmpty ? 'Not Set' : newVal;
              return `${fieldName}: ${oldDisplay} → ${newDisplay}`;
            }
            
            return null;
          };
          
          // Check all important fields for changes
          const fieldChecks = [
            { name: 'License Name', old: editingLicense.licenseName, new: data.licenseName },
            { name: 'Entity Owner', old: editingLicense.entityOwner, new: data.entityOwner },
            { name: 'Category', old: editingLicense.category, new: data.category },
            { name: 'Beneficiary Type', old: editingLicense.beneficiaryType, new: data.beneficiaryType },
            { name: 'Beneficiary Name/No', old: editingLicense.beneficiaryNameNo, new: data.beneficiaryNameNo },
            { name: 'Issuing Authority', old: editingLicense.issuingAuthorityName, new: data.issuingAuthorityName },
            { name: 'Issue Date', old: editingLicense.startDate, new: data.startDate },
            { name: 'Expiry Date', old: editingLicense.endDate, new: data.endDate },
            { name: 'Renewal Fee', old: editingLicense.renewalFee, new: data.renewalFee },
            { name: 'Currency', old: editingLicense.currency, new: data.currency },
            { name: 'LCY Amount', old: editingLicense.lcyAmount, new: data.lcyAmount },
            { name: 'Renewal Cycle', old: editingLicense.renewalCycleTime, new: data.renewalCycleTime },
            { name: 'Lead Time', old: editingLicense.renewalLeadTimeEstimated, new: data.renewalLeadTimeEstimated },
            { name: 'Responsible Person', old: editingLicense.responsiblePerson, new: data.responsiblePerson },
            { name: 'Secondary Person', old: editingLicense.secondaryPerson, new: data.secondaryPerson },
            { name: 'Department', old: editingLicense.department, new: data.department },
            { name: 'Status', old: editingLicense.status, new: data.status },
            { name: 'Renewal Status', old: editingLicense.renewalStatus, new: data.renewalStatus },
            { name: 'Authority Email', old: editingLicense.issuingAuthorityEmail, new: data.issuingAuthorityEmail },
            { name: 'Authority Phone', old: editingLicense.issuingAuthorityPhone, new: data.issuingAuthorityPhone },
            { name: 'Expected Completion', old: editingLicense.expectedCompletedDate, new: data.expectedCompletedDate },
            { name: 'Renewal Initiated', old: editingLicense.renewalInitiatedDate, new: data.renewalInitiatedDate },
            { name: 'Submitted By', old: editingLicense.submittedBy, new: data.submittedBy },
            { name: 'Renewal Amount', old: editingLicense.renewalAmount, new: data.renewalAmount },
            { name: 'Details/Notes', old: editingLicense.details, new: data.details },
            { name: 'Reminder Days', old: editingLicense.reminderDays, new: data.reminderDays },
            { name: 'Reminder Policy', old: editingLicense.reminderPolicy, new: data.reminderPolicy },
          ];
          
          // Check departments array separately
          const oldDepts = editingLicense.departments || [];
          const newDepts = data.departments || [];
          if (JSON.stringify(oldDepts.sort()) !== JSON.stringify(newDepts.sort())) {
            // Skip if going from empty to having departments
            if (oldDepts.length === 0 && newDepts.length > 0) {
              // Don't log initial department assignment
            } else {
              const oldDisplay = oldDepts.length > 0 ? oldDepts.join(', ') : 'Not Set';
              const newDisplay = newDepts.length > 0 ? newDepts.join(', ') : 'Not Set';
              changesList.push(`Departments: ${oldDisplay} → ${newDisplay}`);
            }
          }
          
          // Handle Status Reason separately with context-aware label
          if (data.renewalStatusReason && data.renewalStatusReason !== editingLicense.renewalStatusReason) {
            let reasonLabel = 'Status Reason';
            if (data.renewalStatus === 'Cancelled') {
              reasonLabel = 'Cancellation Reason';
            } else if (data.renewalStatus === 'Rejected') {
              reasonLabel = 'Rejection Reason';
            } else if (data.renewalStatus === 'Amendments/ Appeal Submitted') {
              reasonLabel = 'Amendment/Appeal Reason';
            }
            const change = formatChange(reasonLabel, editingLicense.renewalStatusReason, data.renewalStatusReason, true);
            if (change) changesList.push(change);
          }
          
          // Process all field checks
          fieldChecks.forEach(field => {
            const change = formatChange(field.name, field.old, field.new);
            if (change) changesList.push(change);
          });
          
          changes = changesList.length > 0 
            ? changesList.join('\n') 
            : `Updated license: ${data.licenseName || 'Unnamed'}`;
        } else {
          changes = `Created new license: ${data.licenseName || 'Unnamed'}`;
        }
        
        const logData: any = {
          licenseName: data.licenseName || 'Unnamed License',
          action,
          changes,
        };
        
        await fetch(`${API_BASE_URL}/api/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(logData),
        });
      } catch (logError) {
        console.error('Failed to log action:', logError);
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
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
      // Get the license name before deleting
      const license = licenses.find(l => l.id === id);
      const licenseName = license?.licenseName || 'Unknown License';
      
      const res = await fetch(`${API_BASE_URL}/api/licenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete license");
      const result = await res.json();
      
      // Log the deletion
      try {
        await fetch(`${API_BASE_URL}/api/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            licenseName,
            action: 'Deleted',
            changes: `Deleted license: ${licenseName}`,
          }),
        });
      } catch (logError) {
        console.error('Failed to log deletion:', logError);
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
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
      LicenseType: license.licenseName,
      // LicenseNo removed
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
              licenseName: row.LicenseType || row.LicenseName || row.licenseName || '',
              // licenseNo removed
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
      (license.responsiblePerson || "").toLowerCase().includes(q) ||
      (String((license as any).department || "").toLowerCase().includes(q)) ||
      (String((license as any).secondaryPerson || "").toLowerCase().includes(q));

    const derivedStatus = getDerivedStatus({ endDate: license.endDate, status: license.status });
    const matchesStatus = statusFilter === "all" || derivedStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedLicenses = (() => {
    const list = [...filteredLicenses];
    
    // Default sort: latest updated/created first (if no manual sort is applied)
    if (!sortField) {
      return list.sort((a, b) => {
        const aDate = a.updatedAt || a.createdAt;
        const bDate = b.updatedAt || b.createdAt;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(bDate).getTime() - new Date(aDate).getTime(); // Descending (newest first)
      });
    }
    
    const dir = sortDirection === 'asc' ? 1 : -1;
    const parseDate = (v?: string) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };

    return list.sort((a, b) => {
      if (sortField === 'licenseName') {
        return dir * String(a.licenseName || '').toLowerCase().localeCompare(String(b.licenseName || '').toLowerCase());
      }
      if (sortField === 'issuingAuthorityName') {
        return dir * String(a.issuingAuthorityName || '').toLowerCase().localeCompare(String(b.issuingAuthorityName || '').toLowerCase());
      }
      if (sortField === 'startDate') {
        const ad = parseDate(a.startDate);
        const bd = parseDate(b.startDate);
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;
        return dir * (ad.getTime() - bd.getTime());
      }
      if (sortField === 'endDate') {
        const ad = parseDate(a.endDate);
        const bd = parseDate(b.endDate);
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;
        return dir * (ad.getTime() - bd.getTime());
      }
      if (sortField === 'renewalFee') {
        const av = typeof a.renewalFee === 'number' ? a.renewalFee : Number.NaN;
        const bv = typeof b.renewalFee === 'number' ? b.renewalFee : Number.NaN;
        if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
        if (!Number.isFinite(av)) return 1;
        if (!Number.isFinite(bv)) return -1;
        return dir * (av - bv);
      }
      return 0;
    });
  })();

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
    
    // Calculate lcyAmount if not already set
    const lcyAmountValue = lcyAmount ? parseFloat(lcyAmount) : undefined;
    
    const payload: LicenseFormData = {
      ...data,
      status: derivedStatus,
      departments: selectedDepartments,
      department: JSON.stringify(selectedDepartments),
      currency: currency || undefined,
      lcyAmount: lcyAmountValue,
    };
    form.setValue('status', derivedStatus);
    licenseMutation.mutate(payload);
  };

  // Handle edit
  const handleEdit = (license: License) => {
    setEditingLicense(license);
    setSubmissionOpenedFromTable(false);
    const normalizedStatus = getDerivedStatus({ endDate: license.endDate, status: license.status });

    const depts = parseDepartments((license as any).department);
    setSelectedDepartments(depts);

    const normalizedRenewalCycleTime =
      String(license.renewalCycleTime || '').trim() === 'Annual' ? 'Yearly' : (license.renewalCycleTime || "");

    const resetValues: LicenseFormData = {
      licenseName: license.licenseName || "",
      entityOwner: (license as any).entityOwner || "",
      category: (license as any).category || "",
      beneficiaryType: (license as any).beneficiaryType || "",
      beneficiaryNameNo: (license as any).beneficiaryNameNo || "",
      issuingAuthorityName: license.issuingAuthorityName || "",
      startDate: license.startDate || "",
      endDate: license.endDate || "",
      details: license.details || "",
      renewalFee: typeof license.renewalFee === 'number' ? license.renewalFee : undefined,
      currency: (license as any).currency || "",
      lcyAmount: typeof (license as any).lcyAmount === 'number' ? (license as any).lcyAmount : undefined,
      renewalCycleTime: normalizedRenewalCycleTime,
      renewalLeadTimeEstimated: typeof license.renewalLeadTimeEstimated === 'string' ? license.renewalLeadTimeEstimated : undefined,
      responsiblePerson: license.responsiblePerson || "",
      secondaryPerson: (license as any).secondaryPerson || "",
      departments: depts,
      department: JSON.stringify(depts),
      status: normalizedStatus,
      issuingAuthorityEmail: license.issuingAuthorityEmail || "",
      issuingAuthorityPhone: license.issuingAuthorityPhone || "",
      reminderDays: license.reminderDays || "",
      reminderPolicy: license.reminderPolicy || "",
      renewalStatus:
        (license.renewalStatus as
          | 'Renewal Initiated'
          | 'Application Submitted'
          | 'Amendments/ Appeal Submitted'
          | 'Cancelled'
          | 'Rejected'
          | 'Resubmitted'
          | 'Approved'
          | undefined) || undefined,
      // renewalSubmittedDate removed
      expectedCompletedDate: license.expectedCompletedDate || "",
      renewalInitiatedDate: license.renewalInitiatedDate || "",
      submittedBy: license.submittedBy || "",
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
    };

    // Set currency state
    setCurrency((license as any).currency || "");

    // If the license already has Resubmitted status, prevent the clear effect from running
    if (resetValues.renewalStatus === 'Resubmitted') {
      lastResubmittedClearRef.current = true;
    }

    form.reset(resetValues);
    initialFormSnapshotRef.current = cloneSnapshot(resetValues);
    initialSelectedDepartmentsRef.current = [...depts];

    // Respect stored expiry date on edit (do not auto-overwrite on open)
    setEndDateManuallySet(true);
    setIsModalOpen(true);
  };

  // Handle add new
  const handleAddNew = () => {
  setEditingLicense(null);
  setIsFullscreen(false);
  setShowSubmissionDetails(false);
  setSubmissionOpenedFromTable(false);
  setSelectedDepartments([]);
  setRenewalFeeText('');
  setCurrency('');
  setLcyAmount('');
  setEndDateManuallySet(false);
  setShowRenewalDocumentsModal(false);
  setShowRenewalStatusReasonModal(false);
  setRenewalStatusReasonDraft('');
  setPendingRenewalStatus('');
  setPreviousRenewalStatus('');
  setShowApprovedExpiryModal(false);
  setApprovedExpiryDraft('');
  setApprovedIssueDraft('');
  setPreviousRenewalStatusForExpiry('');
  lastResubmittedClearRef.current = false; // Reset the ref for new license
  // Important: reset to explicit empty defaults (because form.reset(editValues) changes reset defaults)
  form.reset({ ...EMPTY_LICENSE_FORM_VALUES });
  initialFormSnapshotRef.current = cloneSnapshot({ ...EMPTY_LICENSE_FORM_VALUES });
  initialSelectedDepartmentsRef.current = [];
  setIsModalOpen(true);
  };

  const hasMeaningfulFormData = () => {
    const baseline = initialFormSnapshotRef.current;
    const current = form.getValues();
    if (!baseline) return false;

    const normalize = (v: any) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return v.trim();
      return v;
    };

    const arraysEqual = (a: any[], b: any[]) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
    const keys = Array.from(new Set([...Object.keys(baseline as any), ...Object.keys(current as any)]));

    for (const key of keys) {
      const a = normalize((baseline as any)[key]);
      const b = normalize((current as any)[key]);

      if (Array.isArray(a) || Array.isArray(b)) {
        if (!arraysEqual(Array.isArray(a) ? a : [], Array.isArray(b) ? b : [])) return true;
        continue;
      }

      // Numbers: only meaningful if they differ
      if (typeof a === 'number' || typeof b === 'number') {
        const an = typeof a === 'number' ? a : undefined;
        const bn = typeof b === 'number' ? b : undefined;
        if (an !== bn) return true;
        continue;
      }

      if (a !== b) return true;
    }

    // Compare selected departments (payload uses selectedDepartments)
    if (JSON.stringify(initialSelectedDepartmentsRef.current || []) !== JSON.stringify(selectedDepartments || [])) return true;

    // renewalFeeText is only meaningful when user typed something
    if (String(renewalFeeText || '').trim().length > 0) return true;

    return false;
  };

  const handleExitConfirm = () => {
    setIsModalOpen(false);
    setExitConfirmOpen(false);

    setTimeout(() => {
      setIsFullscreen(false);
      setShowSubmissionDetails(false);
      setEditingLicense(null);
      setSelectedDepartments([]);
      setRenewalFeeText('');
      setEndDateManuallySet(false);
      setShowRenewalDocumentsModal(false);
      setShowRenewalStatusReasonModal(false);
      setRenewalStatusReasonDraft('');
      setPendingRenewalStatus('');
      setPreviousRenewalStatus('');
      setShowApprovedExpiryModal(false);
      setApprovedExpiryDraft('');
      setApprovedIssueDraft('');
      setPreviousRenewalStatusForExpiry('');
      setLicenseNameError('');
      lastResubmittedClearRef.current = false; // Reset the ref when closing
      // Important: reset to explicit empty defaults
      form.reset({ ...EMPTY_LICENSE_FORM_VALUES });
    }, 150);
  };

  const requestExit = () => {
    // If user is in submission view, Exit depends on how submission was opened
    if (showSubmissionDetails) {
      // If submission view was opened from table, Exit should close and show the table
      if (submissionOpenedFromTable) {
        if (hasMeaningfulFormData()) {
          setExitConfirmOpen(true);
        } else {
          handleExitConfirm();
        }
        return;
      }

      // Otherwise, Exit returns to the main modal page
      setShowSubmissionDetails(false);
      return;
    }

    // Match Compliance behavior: ask confirmation only if anything is filled
    if (hasMeaningfulFormData()) {
      setExitConfirmOpen(true);
    } else {
      handleExitConfirm();
    }
  };

  const handleSort = (field: "licenseName" | "issuingAuthorityName" | "startDate" | "endDate" | "renewalFee") => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: "licenseName" | "issuingAuthorityName" | "startDate" | "endDate" | "renewalFee") => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline-block opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 inline-block" />
      : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
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

  const truncateText = (value: string | undefined | null, maxChars: number) => {
    const text = (value ?? '').toString();
    if (!text) return '';
    return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars)).trimEnd()}...` : text;
  };

  // (date formatting handled inline where needed)

  // (summary cards removed)

  return (
    <div className="h-full bg-white">
      <div className="h-full w-full px-6 py-8 flex flex-col min-h-0">
        {/* Modern Professional Header */}
        <div className="mb-8 shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Renewals Management</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                type="button"
                onClick={handleExport}
                className="relative backdrop-blur-md bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 text-emerald-700 hover:from-emerald-500/30 hover:to-teal-500/30 shadow-lg hover:shadow-xl transition-all duration-300 font-medium"
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                type="button"
                onClick={triggerImport}
                className="relative backdrop-blur-md bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 text-purple-700 hover:from-purple-500/30 hover:to-pink-500/30 shadow-lg hover:shadow-xl transition-all duration-300 font-medium"
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
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
                  Add Renewal
                </Button>
              </Can>
              <Button
                type="button"
                onClick={() => navigate('/renewal-log')}
                className="relative backdrop-blur-md bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-400/40 text-orange-700 hover:from-orange-500/30 hover:to-amber-500/30 shadow-lg hover:shadow-xl transition-all duration-300 font-medium"
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                <History className="h-4 w-4 mr-2" />
                Log
              </Button>
            </div>
          </div>
          {/* Key Metrics Cards removed as requested */}
        </div>

        {/* Filters Section */}
        <Card className="mb-6 border-slate-200 shadow-md rounded-xl shrink-0">
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
        <div className="min-w-0 flex-1 min-h-0">
          <Card className="border-slate-200 shadow-lg rounded-2xl overflow-hidden h-full flex flex-col min-h-0">
            <CardContent className="p-0 flex flex-col min-h-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Shield className="w-12 h-12 text-indigo-500" />
                  </motion.div>
                  <p className="text-slate-600 mt-4">Loading renewals...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-rose-50 rounded-full p-4 mb-4">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                  </div>
                  <p className="text-rose-500 font-medium text-lg">Failed to load licenses</p>
                  <p className="text-slate-500 mt-2">Please try again later</p>
                </div>
              ) : sortedLicenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-slate-100 rounded-full p-5 mb-5">
                    <Shield className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-medium text-slate-800 mb-2">
                    {searchTerm || statusFilter !== "all" ? "No matching renewals found" : "No renewals found"}
                  </h3>
                  <p className="text-slate-600 max-w-md text-center">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search or filter criteria" 
                      : "Get started by adding your first renewal"
                    }
                  </p>
                  {/* Add First License button removed as requested */}
                </div>
              ) : (
                <Table containerClassName="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar" className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                      <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[160px]">
                        <button
                          onClick={() => handleSort('licenseName')}
                          className="flex items-center font-bold hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          TITLE/NAME/NO.
                          {getSortIcon('licenseName')}
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[220px]">
                        <button
                          onClick={() => handleSort('issuingAuthorityName')}
                          className="flex items-center font-bold hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          ISSUING AUTHORITY
                          {getSortIcon('issuingAuthorityName')}
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[120px]">
                        <button
                          onClick={() => handleSort('startDate')}
                          className="flex items-center font-bold hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          ISSUE DATE
                          {getSortIcon('startDate')}
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[120px]">
                        <button
                          onClick={() => handleSort('endDate')}
                          className="flex items-center font-bold hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          EXPIRY DATE
                          {getSortIcon('endDate')}
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wide w-[150px]">Submission</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide w-[110px]">
                        <button
                          onClick={() => handleSort('renewalFee')}
                          className="flex items-center justify-end w-full font-bold hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          RENEWAL FEE
                          {getSortIcon('renewalFee')}
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[110px]">Status</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide w-[110px]">ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {sortedLicenses.map((license, index) => (
                          <motion.tr 
                            key={license.id}
                            className="hover:bg-slate-50 transition-colors"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: 0.05 * index }}
                          >
                            <TableCell className="px-3 py-3 font-medium text-gray-800 w-[160px] min-w-0 text-left">
                              <button
                                type="button"
                                onClick={() => handleEdit(license)}
                                title={license.licenseName}
                                className="text-indigo-700 hover:text-indigo-900 underline underline-offset-2 block w-full truncate whitespace-nowrap text-left"
                              >
                                {truncateText(license.licenseName, 18)}
                              </button>
                            </TableCell>
                            <TableCell className="px-3 py-3 text-sm text-gray-700 w-[220px] min-w-0">
                              <div>
                                <div className="font-medium block w-full truncate whitespace-nowrap" title={license.issuingAuthorityName}>
                                  {license.issuingAuthorityName}
                                </div>
                                {/* Removed email and phone display as per requirements */}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-3 text-sm text-gray-600 w-[120px]">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {license.startDate ? new Date(license.startDate).toLocaleDateString('en-GB') : ''}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-3 text-sm text-gray-600 w-[120px]">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {license.endDate ? new Date(license.endDate).toLocaleDateString('en-GB') : ''}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-3 text-center w-[150px]">
                              <Button
                                variant="outline"
                                size="sm"
                                title="Renewel Submit"
                                onClick={() => {
                                  handleEdit(license);
                                  setSubmissionOpenedFromTable(true);
                                  setShowSubmissionDetails(true);
                                }}
                                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 hover:text-green-800 font-medium text-sm px-3 py-1 transition-colors"
                              >
                                Renewel Submit
                              </Button>
                            </TableCell>
                            <TableCell className="px-3 py-3 text-right text-sm text-gray-700 font-semibold w-[110px]">
                              {typeof license.renewalFee === 'number' ? `$${Math.round(license.renewalFee).toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="px-3 py-3 w-[110px]">
                              {(() => {
                                const derived = getDerivedStatus({ endDate: license.endDate, status: license.status });
                                return (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusClassName(derived)}`}>
                                    {derived}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="px-3 py-3 text-right w-[110px]">
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add/Edit License Modal */}
        <Dialog
          open={isModalOpen}
          onOpenChange={(v) => {
            if (v) {
              setIsModalOpen(true);
              return;
            }
            // Treat X/overlay/Esc like clicking Exit
            requestExit();
          }}
        >
          <DialogContent className={`${isFullscreen ? 'max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh]' : 'max-w-4xl min-w-[400px] max-h-[80vh]'} overflow-y-auto overflow-x-hidden rounded-2xl border-slate-200 shadow-2xl p-0 bg-white transition-[width,height] duration-300`}>
            <DialogHeader className={`sticky top-0 z-20 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white ${isFullscreen ? 'px-4 py-3 md:px-5 md:py-3' : 'p-5'} rounded-t-2xl flex flex-row items-center justify-between`}>
              <div className="flex items-center gap-4">
                <ShieldCheck className="h-6 w-6" />
                <DialogTitle className="text-xl font-bold leading-none">
                  {showSubmissionDetails ? 'Renewal Submission' : editingLicense ? 'Edit Renewal' : 'Renewal'}
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
                {!showSubmissionDetails && renewalFreqValue !== 'One-time' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSubmissionOpenedFromTable(false);
                      setShowSubmissionDetails(!showSubmissionDetails);
                    }}
                    className="relative overflow-hidden px-3 py-1 text-sm rounded-lg font-semibold transition-all duration-300 bg-gradient-to-r from-emerald-500/70 to-green-600/70 text-white border border-emerald-300/60 hover:from-emerald-500 hover:to-green-600 hover:shadow-[0_8px_16px_rgba(16,185,129,0.25)]"
                  >
                    Submission
                  </Button>
                )}
                {/* License No. display removed */}
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
                    {/* Submission Details Section */}
                    <div className="bg-white border border-gray-200 mb-6 shadow-md">
                      <div className="p-6">
                        <div className={`grid gap-6 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                        {/* Application Reference no. field removed */}

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

                                    if (val === 'Approved') {
                                      setPreviousRenewalStatusForExpiry(prev);
                                      setApprovedIssueDraft(String(form.getValues('startDate') || ''));
                                      setApprovedExpiryDraft(String(form.getValues('endDate') || ''));
                                      setShowApprovedExpiryModal(true);
                                    }

                                    if (val === 'Cancelled' || val === 'Rejected' || val === 'Amendments/ Appeal Submitted') {
                                      setPendingRenewalStatus(val);
                                      let reasonTitle: 'Cancellation Reason' | 'Rejection Reason' | 'Amendment/Appeal Reason' = 'Cancellation Reason';
                                      if (val === 'Cancelled') reasonTitle = 'Cancellation Reason';
                                      else if (val === 'Rejected') reasonTitle = 'Rejection Reason';
                                      else if (val === 'Amendments/ Appeal Submitted') reasonTitle = 'Amendment/Appeal Reason';
                                      setReasonModalTitle(reasonTitle);
                                      setRenewalStatusReasonDraft(String(form.getValues('renewalStatusReason') || ''));
                                      setShowRenewalStatusReasonModal(true);
                                    }

                                    field.onChange(val);
                                  }}
                                >
                                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-3 text-sm font-inter focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md font-inter">
                                    <SelectItem value="Renewal Initiated" className="text-slate-900 hover:bg-blue-50 font-inter">Renewal Initiated</SelectItem>
                                    <SelectItem value="Application Submitted" className="text-slate-900 hover:bg-blue-50 font-inter">Application Submitted</SelectItem>
                                    <SelectItem value="Amendments/ Appeal Submitted" className="text-slate-900 hover:bg-blue-50 font-inter">Amendments/ Appeal Submitted</SelectItem>
                                    <SelectItem value="Approved" className="text-slate-900 hover:bg-blue-50 font-inter">Approved</SelectItem>
                                    <SelectItem value="Rejected" className="text-slate-900 hover:bg-blue-50 font-inter">Rejected</SelectItem>
                                    <SelectItem value="Resubmitted" className="text-slate-900 hover:bg-blue-50 font-inter">Resubmitted</SelectItem>
                                    <SelectItem value="Cancelled" className="text-slate-900 hover:bg-blue-50 font-inter">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
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
                                <Input
                                  className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                                  type="date"
                                  {...field}
                                  onBlur={() => {
                                    field.onBlur();
                                    form.trigger(['renewalInitiatedDate', 'expectedCompletedDate']);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="expectedCompletedDate"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel className="block text-sm font-medium text-slate-700">
                                Expected completion date:
                                <span className="text-red-500"> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                                  type="date"
                                  {...field}
                                  onBlur={() => {
                                    field.onBlur();
                                    form.trigger('expectedCompletedDate');
                                  }}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              {fieldState.error && (
                                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4" />
                                  {fieldState.error.message}
                                </p>
                              )}
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
                                  onAddNew={() => setEmployeeModal({ show: true, target: 'submittedBy' })}
                                />
                              </FormControl>
                              <FormMessage className="text-red-500" />
                            </FormItem>
                          )}
                        />

                        {/* Payment Reference no. field removed */}

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

                       

                        {/* Renewal Submitted date field removed */}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Show License Details when not viewing Submission Details */}
                {!showSubmissionDetails && (
                  <>
                  {/* General Info Section */}
                  <div className="bg-white border border-gray-200 mb-6 shadow-md">
                    <h3 className="text-base font-semibold text-slate-800 px-6 py-4 border-b border-gray-200 bg-gray-50">General Info</h3>
                    <div className="p-6">
                    <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-4' : 'grid-cols-2'}`}>
                      {/* Title/Name/No. */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Title/Name/No.</label>
                        <Input
                          className={`w-full border-slate-300 rounded-lg p-2.5 text-base ${licenseNameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                          value={form.watch('licenseName') || ''}
                          onChange={(e) => {
                            // Just set the value as-is, no auto-capitalization
                            form.setValue('licenseName', e.target.value);
                            // Clear uniqueness error while typing; validate on blur
                            if (licenseNameError) setLicenseNameError('');
                          }}
                          onBlur={(e) => {
                            // Validate uniqueness only when leaving the field
                            validateLicenseName(String(e.target.value || ''));
                          }}
                        />
                        {licenseNameError && (
                          <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {licenseNameError}
                          </p>
                        )}
                      </div>

                      {/* Category */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Category</label>
                        <Select
                          value={form.watch('category') || ''}
                          onValueChange={(value) => {
                            form.setValue('category', value);
                          }}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 overflow-y-auto custom-scrollbar">
                            <SelectItem value="Visa">Visa</SelectItem>
                            <SelectItem value="E-Pass">E-Pass</SelectItem>
                            <SelectItem value="Govt. License">Govt. License</SelectItem>
                            <SelectItem value="Insurance">Insurance</SelectItem>
                            <SelectItem value="Contract">Contract</SelectItem>
                            <SelectItem value="Agreement">Agreement</SelectItem>
                            <SelectItem value="Maintenance">Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Beneficiary Type */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Beneficiary Type</label>
                        <Select
                          value={form.watch('beneficiaryType') || ''}
                          onValueChange={(value) => {
                            form.setValue('beneficiaryType', value);
                            // Clear Beneficiary Name/No when type changes
                            form.setValue('beneficiaryNameNo', '');
                          }}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 overflow-y-auto custom-scrollbar">
                            <SelectItem value="Employee">Employee</SelectItem>
                            <SelectItem value="Company">Company</SelectItem>
                            <SelectItem value="Vehicle">Vehicle</SelectItem>
                            <SelectItem value="Customer">Customer</SelectItem>
                            <SelectItem value="Department">Department</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Beneficiary Name / No - Dynamic field based on Beneficiary Type */}
                      {form.watch('beneficiaryType') === 'Employee' ? (
                        <FormField
                          control={form.control}
                          name="beneficiaryNameNo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="block text-sm font-medium text-slate-700">Beneficiary Name / No</FormLabel>
                              <FormControl>
                                <EmployeeSearchDropdown
                                  value={String(field.value || '')}
                                  onChange={field.onChange}
                                  employees={employeesRaw as any}
                                  onAddNew={() => setEmployeeModal({ show: true, target: 'beneficiaryNameNo' })}
                                />
                              </FormControl>
                              <FormMessage className="text-red-500" />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700">Beneficiary Name / No</label>
                          <Input
                            type="text"
                            className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                            value={form.watch('beneficiaryNameNo') || ''}
                            onChange={(e) => {
                              form.setValue('beneficiaryNameNo', e.target.value);
                            }}
                          />
                        </div>
                      )}

                      {/* License No. field removed */}

                      {/* Secondary Person - match SubscriptionModal Owner dropdown (with + New) */}
                      <FormField
                        control={form.control}
                        name="secondaryPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Renewal Person In Charge 1</FormLabel>
                            <FormControl>
                              <EmployeeSearchDropdown
                                value={String(field.value || '')}
                                onChange={field.onChange}
                                employees={employeesRaw as any}
                                onAddNew={() => setEmployeeModal({ show: true, target: 'secondaryPerson' })}
                              />
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />

                      {/* Responsible Person - exact dropdown pattern from SubscriptionModal Owner (with + New) */}
                      <FormField
                        control={form.control}
                        name="responsiblePerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Renewal Person In Charge 2</FormLabel>
                            <FormControl>
                              <EmployeeSearchDropdown
                                value={String(field.value || '')}
                                onChange={field.onChange}
                                employees={employeesRaw as any}
                                onAddNew={() => setEmployeeModal({ show: true, target: 'responsiblePerson' })}
                              />
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="departments"
                        render={() => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Departments</FormLabel>
                            <FormControl>
                              <MultiSelectDepartmentsDropdown
                                selectedDepartments={selectedDepartments}
                                onDepartmentChange={handleDepartmentChange}
                                onRemoveDepartment={removeDepartment}
                                departments={departments}
                                departmentsLoading={departmentsLoading}
                                onAddNew={() => setDepartmentModal({ show: true })}
                              />
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />

                      

                      {/* Issue Date */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Issue Date</label>
                        <Input 
                          type="date"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                          value={form.watch('startDate') || ''}
                          onChange={(e) => {
                            setEndDateManuallySet(false);
                            form.setValue('startDate', e.target.value);
                          }}
                        />
                      </div>

                       <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Renewel freq</label>
                        <Select
                          value={form.watch('renewalCycleTime') || ''}
                          onValueChange={(value) => {
                            setEndDateManuallySet(false);
                            form.setValue('renewalCycleTime', value);
                          }}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 overflow-y-auto custom-scrollbar">
                            <SelectItem value="One-time">One-time</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                            <SelectItem value="6 months">6 months</SelectItem>
                            <SelectItem value="Yearly">Yearly</SelectItem>
                            <SelectItem value="2 years">2 years</SelectItem>
                            <SelectItem value="3 years">3 years</SelectItem>
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
                            setEndDateManuallySet(true);
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

                      {/* Currency */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Currency</label>
                        <Select
                          value={currency || ''}
                          onValueChange={(value) => {
                            setCurrency(value);
                            form.setValue('currency', value);
                          }}
                        >
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2.5 text-base">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 overflow-y-auto custom-scrollbar">
                            {currencies.map((curr: any) => (
                              <SelectItem key={curr.code} value={curr.code}>
                                {curr.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

                      {/* Renewal Cost LCY - Read-only calculated field */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Renewal Cost LCY</label>
                        <Input
                          type="text"
                          value={lcyAmount}
                          readOnly
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base bg-slate-50 text-slate-600"
                          placeholder=""
                        />
                        {currency && currency !== (companyInfo as any)?.defaultCurrency && lcyAmount && (
                          <div className="text-xs text-slate-500 mt-1">
                            1 {(companyInfo as any)?.defaultCurrency || 'LCY'} = {currencies.find((c: any) => c.code === currency)?.exchangeRate || 'Not set'} {currency}
                          </div>
                        )}
                      </div>

                      {/* Renewal Lead Time (Estimated) */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Renewal Lead Time (Estimated)</label>
                        <Input
                          type="text"
                          inputMode="text"
                          placeholder="e.g., 1D, 2W, 3M, 1Y"
                          className="w-full border-slate-300 rounded-lg p-2.5 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 placeholder:text-gray-400"
                          value={String(form.watch('renewalLeadTimeEstimated') || '')}
                          onChange={(e) => {
                            // Just update the value, don't validate while typing
                            const s = e.target.value.toUpperCase();
                            form.setValue('renewalLeadTimeEstimated', s ? s : undefined);
                          }}
                          onBlur={(e) => {
                            const s = e.target.value.trim().toUpperCase();
                            if (s) {
                              // Pattern: number followed by D, WD, W, M, Q, or Y
                              // D = Day, WD = Working Day, W = Week, M = Month, Q = Quarter, Y = Year
                              const pattern = /^(\d+)(D|WD|W|M|Q|Y)$/;
                              if (!pattern.test(s)) {
                                setRenewalLeadTimeError(
                                  `Your entry of '${s}' is not an acceptable value for 'Renewal Lead Time'. The format should include a time unit. Time units can be: D, WD, W, M, Q, or Y. Examples: 1D (1 day), 2W (2 weeks), 3M (3 months), 1Y (1 year).`
                                );
                                setRenewalLeadTimeErrorOpen(true);
                                // Clear invalid value
                                form.setValue('renewalLeadTimeEstimated', undefined);
                              }
                            }
                          }}
                        />
                      </div>

                      {/* Renewel freq */}
                     

                      {/* Remarks field removed */}
                    </div>
                    </div>
                  </div>

                  {/* Issuing Authority Section */}
                  <div className="bg-white border border-gray-200 mb-6 shadow-md">
                    <h3 className="text-base font-semibold text-slate-800 px-6 py-4 border-b border-gray-200 bg-gray-50">Issuing Authority</h3>
                    <div className="p-6">
                    <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-4' : 'grid-cols-2'}`}>
                      {/* Authority */}
                      <FormField
                        control={form.control}
                        name="issuingAuthorityName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Authority</FormLabel>
                            <FormControl>
                              <SearchableStringDropdown
                                value={String(field.value || '')}
                                onChange={field.onChange}
                                options={ISSUING_AUTHORITIES}
                                className="w-full border-slate-300 rounded-lg p-2.5 pr-10 text-base cursor-pointer"
                              />
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
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
                  <div className="bg-white border border-gray-200 mb-6 shadow-md">
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
                    onClick={requestExit}
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
          </DialogContent>
        </Dialog>

        {/* All modals moved outside main Dialog to prevent nesting issues */}
        
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

            {/* Approved - New Issue & Expiry Date Modal */}
            <Dialog
              open={showApprovedExpiryModal}
              onOpenChange={(open) => {
                if (!open) {
                  setShowApprovedExpiryModal(false);
                  setApprovedExpiryDraft('');
                  setApprovedIssueDraft('');
                  if (previousRenewalStatusForExpiry) {
                    form.setValue('renewalStatus', previousRenewalStatusForExpiry as any, { shouldDirty: true });
                  } else {
                    form.setValue('renewalStatus', undefined, { shouldDirty: true });
                  }
                  setPreviousRenewalStatusForExpiry('');
                }
              }}
            >
              <DialogContent className="sm:max-w-[520px] bg-white">
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-gray-900">Approved Renewal Details</div>
                  <div className="text-sm text-gray-600">
                    Renewal is marked as <span className="font-semibold">Approved</span>. Please enter the new issue date and expiry date.
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      New Issue Date <span className="text-red-500"> *</span>
                    </div>
                    <Input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                      value={approvedIssueDraft}
                      onChange={(e) => setApprovedIssueDraft(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      New Expiry Date <span className="text-red-500"> *</span>
                    </div>
                    <Input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                      value={approvedExpiryDraft}
                      onChange={(e) => setApprovedExpiryDraft(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowApprovedExpiryModal(false);
                        setApprovedExpiryDraft('');
                        setApprovedIssueDraft('');
                        if (previousRenewalStatusForExpiry) {
                          form.setValue('renewalStatus', previousRenewalStatusForExpiry as any, { shouldDirty: true });
                        } else {
                          form.setValue('renewalStatus', undefined, { shouldDirty: true });
                        }
                        setPreviousRenewalStatusForExpiry('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        const nextStart = String(approvedIssueDraft || '').trim();
                        const nextEnd = String(approvedExpiryDraft || '').trim();
                        if (!nextStart || !nextEnd) {
                          toast({
                            title: 'Dates required',
                            description: 'Please select the new issue date and expiry date.',
                            variant: 'destructive',
                            duration: 2500,
                          });
                          return;
                        }

                        const startTime = new Date(nextStart).getTime();
                        const endTime = new Date(nextEnd).getTime();
                        if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime <= startTime) {
                          toast({
                            title: 'Invalid dates',
                            description: 'Expiry date must be after issue date.',
                            variant: 'destructive',
                            duration: 3000,
                          });
                          return;
                        }

                        // Prevent auto-calc from overwriting the approved expiry.
                        prevAutoCalcInputsRef.current = {
                          renewalFreq: String(form.getValues('renewalCycleTime') || ''),
                          issueDate: nextStart,
                        };

                        setEndDateManuallySet(true);
                        form.setValue('startDate', nextStart, { shouldDirty: true });
                        form.setValue('endDate', nextEnd, { shouldDirty: true });
                        form.clearErrors('startDate');
                        form.clearErrors('endDate');

                        toast({
                          title: 'Dates updated',
                          description: 'New issue/expiry dates have been applied to the license.',
                          duration: 2000,
                          variant: 'success',
                        });

                        setShowApprovedExpiryModal(false);
                        setApprovedExpiryDraft('');
                        setApprovedIssueDraft('');
                        setPreviousRenewalStatusForExpiry('');

                        // Show the updated expiry date immediately in the main form.
                        setShowSubmissionDetails(false);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Department Creation Modal (match Subscription modal) */}
            <AlertDialog open={departmentModal.show} onOpenChange={(open) => !open && setDepartmentModal({ show: false })}>
              <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl font-inter">
                <AlertDialogHeader className="bg-indigo-600 text-white p-6 rounded-t-lg -m-6 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 104 0 2 2 0 00-4 0zm6 0a2 2 0 104 0 2 2 0 00-4 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <AlertDialogTitle className="text-xl font-semibold text-white">Add New Department</AlertDialogTitle>
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
                          {(Array.isArray(employeesRaw) ? (employeesRaw as any[]) : [])
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

                          {(Array.isArray(employeesRaw) ? (employeesRaw as any[]) : []).length === 0 && (
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

            {/* Employee Creation Modal (match Subscription modal Owner Creation) */}
            <AlertDialog open={employeeModal.show} onOpenChange={(open) => !open && setEmployeeModal({ show: false })}>
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
                        value={newEmployeeName}
                        onChange={(e) => setNewEmployeeName(e.target.value)}
                        className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddEmployee();
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <Input
                        type="email"
                        placeholder=""
                        value={newEmployeeEmail}
                        onChange={(e) => {
                          setNewEmployeeEmail(e.target.value);
                          setNewEmployeeEmailError('');
                        }}
                        onBlur={() => {
                          if (newEmployeeEmail) {
                            const result = validateEmail(newEmployeeEmail);
                            if (!result.valid) {
                              setNewEmployeeEmailError(result.error || 'Invalid email address');
                            }
                          }
                        }}
                        className={`w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 ${
                          newEmployeeEmailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' : ''
                        }`}
                      />
                      {newEmployeeEmailError && (
                        <p className="text-red-600 text-sm font-medium mt-1">{newEmployeeEmailError}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <div className="relative" ref={employeeDeptDropdownRef}>
                        <div className="relative">
                          <Input
                            value={employeeDeptSearch}
                            placeholder="Select department"
                            className={`w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 pr-10 cursor-pointer ${
                              !newEmployeeDepartment ? 'border-red-300' : ''
                            }`}
                            onFocus={() => setEmployeeDeptOpen(true)}
                            onClick={() => setEmployeeDeptOpen(true)}
                            onChange={(e) => {
                              setEmployeeDeptSearch(e.target.value);
                              setEmployeeDeptOpen(true);
                              setNewEmployeeDepartment('');
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
                            {(Array.isArray(departments) ? departments : [])
                              .filter((dept) => Boolean((dept as any)?.visible))
                              .filter((dept) => {
                                const q = employeeDeptSearch.trim().toLowerCase();
                                if (!q) return true;
                                return String((dept as any)?.name || '').toLowerCase().includes(q);
                              })
                              .map((dept) => {
                                const selected = newEmployeeDepartment === (dept as any).name;
                                return (
                                  <div
                                    key={(dept as any).name}
                                    className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                      selected ? 'bg-blue-50 text-blue-700' : ''
                                    }`}
                                    onClick={() => {
                                      setNewEmployeeDepartment(String((dept as any).name || '').trim());
                                      setEmployeeDeptSearch(String((dept as any).name || '').trim());
                                      setEmployeeDeptOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                    <span className="font-normal">{(dept as any).name}</span>
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
                                setEmployeeDeptOpen(false);
                              }}
                            >
                              + New
                            </div>
                          </div>
                        )}
                      </div>
                      {!newEmployeeDepartment && newEmployeeName && (
                        <p className="text-red-600 text-sm font-medium mt-1">Department is required</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <Input
                        placeholder=""
                        value={newEmployeeRole}
                        onChange={(e) => setNewEmployeeRole(e.target.value)}
                        className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <Select value={newEmployeeStatus} onValueChange={setNewEmployeeStatus}>
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
                      setEmployeeModal({ show: false });
                      setNewEmployeeName('');
                      setNewEmployeeEmail('');
                      setNewEmployeeRole('');
                      setNewEmployeeStatus('active');
                      setNewEmployeeDepartment('');
                      setNewEmployeeEmailError('');
                      setEmployeeDeptSearch('');
                      setEmployeeDeptOpen(false);
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddEmployee}
                    disabled={!newEmployeeName.trim() || !newEmployeeEmail.trim() || !newEmployeeDepartment || newEmployeeEmailError !== ''}
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
        
        <input
          type="file"
          accept=".csv,text/csv"
          ref={fileInputRef}
          onChange={handleImport}
          className="hidden"
        />

        {/* Renewal Lead Time Validation Error Dialog */}
        <Dialog open={renewalLeadTimeErrorOpen} onOpenChange={setRenewalLeadTimeErrorOpen}>
          <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white font-inter overflow-hidden">
            {/* Header with Red Gradient Background */}
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-white">
                      Invalid Format
                    </DialogTitle>
                  </div>
                </div>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <p className="text-gray-700 text-sm leading-relaxed">
                {renewalLeadTimeError}
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
              <Button
                onClick={() => setRenewalLeadTimeErrorOpen(false)}
                className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
              >
                OK
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Exit Confirmation Dialog (match Compliance) */}
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