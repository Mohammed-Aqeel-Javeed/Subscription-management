import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/config";
// Type for dynamic subscription fields
interface SubscriptionField {
  name: string;
  enabled: boolean;
  type?: string;
}
// NOTE: Removed previous calculateNextRenewalDate which advanced until > today.
// New behaviour: When Auto Renewal is enabled we still derive the next renewal
// from the selected start date + one commitment cycle (minus 1 day to represent
// the end of the current period) so the logic is consistent no matter when the
// start date is (even if it is in the past). This prevents the off-by-one month
// difference users saw (e.g. 19 vs 18) when toggling Auto Renewal.
// ...existing code...
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
// Removed unused insertSubscriptionSchema import
import type { InsertSubscription, Subscription } from "@shared/schema";
// Extend Subscription for modal usage to include extra fields
type SubscriptionModalData = Partial<Subscription> & {
  currency?: string | null;
  qty?: number | null;
  totalAmount?: number | null;
  department?: string | null;
  owner?: string | null;
  paymentMethod?: string | null;
  autoRenewal?: boolean | null;
  // Tolerate backend objects that use Mongo-style _id and optional name
  _id?: string;
  name?: string;
};
import { z } from "zod";
import { X, History, RefreshCw, Maximize2, Minimize2, AlertCircle, ChevronDown } from "lucide-react";
// Define the Category interface
interface Category {
  name: string;
  visible: boolean;
}

// Default category suggestions
const DEFAULT_CATEGORY_SUGGESTIONS = [
  'Productivity & Collaboration',
  'Accounting & Finance',
  'CRM & Sales',
  'Development & Hosting',
  'Design & Creative Tools',
  'Marketing & SEO',
  'Communication Tools',
  'Security & Compliance',
  'HR & Admin',
  'Subscription Infrastructure',
  'Office Infrastructure'
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

// Comprehensive URL Validation Function
const validateURL = (url: string): { valid: boolean; error?: string } => {
  // Rule 1: Required - Not empty
  if (!url || url.trim() === '') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmedURL = url.trim();

  // Rule 2: Max length ≤ 2048 characters (browser standard)
  if (trimmedURL.length > 2048) {
    return { valid: false, error: 'URL must be 2048 characters or less' };
  }

  // Rule 3: No spaces
  if (/\s/.test(trimmedURL)) {
    return { valid: false, error: 'URL cannot contain spaces' };
  }

  // Rule 4: Must start with http:// or https:// or www.
  const hasProtocol = /^https?:\/\//i.test(trimmedURL);
  const startsWithWWW = /^www\./i.test(trimmedURL);
  
  let urlToValidate = trimmedURL;
  if (!hasProtocol && !startsWithWWW) {
    return { valid: false, error: 'URL must start with http://, https://, or www.' };
  }
  
  // Add protocol if missing but has www
  if (startsWithWWW && !hasProtocol) {
    urlToValidate = 'https://' + trimmedURL;
  }

  // Rule 5: Try to parse as URL
  let parsedURL;
  try {
    parsedURL = new URL(urlToValidate);
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Rule 6: Must have a valid hostname
  if (!parsedURL.hostname || parsedURL.hostname.length < 3) {
    return { valid: false, error: 'URL must have a valid domain name' };
  }

  // Rule 7: Hostname must contain at least one dot
  if (!parsedURL.hostname.includes('.')) {
    return { valid: false, error: 'URL must have a valid domain with extension (e.g., .com, .org)' };
  }

  // Rule 8: Check for valid TLD
  const hostParts = parsedURL.hostname.split('.');
  const tld = hostParts[hostParts.length - 1].toLowerCase();
  
  if (tld.length < 2 || tld.length > 6) {
    return { valid: false, error: 'URL domain extension must be between 2-6 characters' };
  }

  // Rule 9: TLD should only contain letters
  if (!/^[a-zA-Z]+$/.test(tld)) {
    return { valid: false, error: 'URL domain extension must contain only letters' };
  }

  // Rule 10: Check for common TLDs
  const commonTLDs = [
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
    'co', 'uk', 'us', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'in', 'br', 'ru',
    'io', 'ai', 'app', 'dev', 'tech', 'info', 'biz', 'name', 'pro',
    'email', 'online', 'site', 'store', 'cloud', 'digital', 'global',
    'xyz', 'top', 'vip', 'club', 'shop', 'live', 'today', 'world'
  ];
  
  if (!commonTLDs.includes(tld)) {
    return { valid: false, error: 'Please enter a valid domain extension (e.g., .com, .org, .net)' };
  }

  // Rule 11: No consecutive dots in hostname
  if (/\.\./.test(parsedURL.hostname)) {
    return { valid: false, error: 'URL cannot contain consecutive dots' };
  }

  return { valid: true };
};

// Update the form schema to handle multiple departments and make required fields
const formSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  nextRenewal: z.string().min(1, "End date is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  // All other fields are optional
  serviceName: z.string().optional(),
  website: z.string().optional(),
  vendor: z.string().optional(),
  currency: z.string().optional(),
  qty: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  totalAmount: z.union([z.string(), z.number()]).optional(),
  billingCycle: z.string().optional(),
  category: z.string().optional(),
  department: z.string().optional(),
  departments: z.array(z.string()).optional(),
  owner: z.string().optional(),
  ownerEmail: z.string().optional().refine((email) => {
    if (!email || email.trim() === '') return true; // Optional field
    const result = validateEmail(email);
    return result.valid;
  }, (email) => {
    if (!email || email.trim() === '') return { message: '' };
    const result = validateEmail(email || '');
    return { message: result.error || "Invalid email address" };
  }),
  status: z.string().optional(),
  paymentFrequency: z.string().optional(),
  reminderDays: z.union([z.string(), z.number()]).optional(),
  reminderPolicy: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  // If reminderDays is present and = 1, only allow 'One time' policy
  if (data.reminderDays === 1 && data.reminderPolicy && data.reminderPolicy !== "One time") {
    return false;
  }
  return true;
}, {
  message: "When reminder days = 1, only 'One time' policy is allowed",
  path: ["reminderPolicy"],
});
function parseInputDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split('-');
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  return new Date(dateStr);
}
// Safely convert value to YYYY-MM-DD string or empty if invalid
function toISODateOnly(val: any): string {
  if (!val) return "";
  const d = parseInputDate(String(val));
  if (isNaN(d.getTime())) return "";
  try {
    return d.toISOString().split('T')[0];
  } catch {
    return "";
  }
}
function calculateEndDate(startDate: string, billingCycle: string): string {
  if (!startDate || !billingCycle) return "";
  const date = parseInputDate(startDate);
  let endDate = new Date(date);
  switch (billingCycle) {
    case "monthly":
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(endDate.getDate() - 1);
      break;
    case "quarterly":
      endDate.setMonth(endDate.getMonth() + 3);
      endDate.setDate(endDate.getDate() - 1);
      break;
    case "yearly":
      endDate.setFullYear(endDate.getFullYear() + 1);
      endDate.setDate(endDate.getDate() - 1);
      break;
    case "weekly":
      endDate.setDate(endDate.getDate() + 6);
      break;
    case "trial":
      endDate.setDate(endDate.getDate() + 30); // 30 days for trial period
      break;
  }
  const yyyy = endDate.getFullYear();
  const mm = String(endDate.getMonth() + 1).padStart(2, '0');
  const dd = String(endDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function calculateRenewalDates(currentEndDate: string, billingCycle: string): { newStartDate: string; newEndDate: string } {
  if (!currentEndDate || !billingCycle) {
    return { newStartDate: "", newEndDate: "" };
  }
  
  // Calculate new start date (day after current end date)
  const currentEnd = parseInputDate(currentEndDate);
  const newStart = new Date(currentEnd);
  newStart.setDate(newStart.getDate() + 1);
  
  // Format new start date
  const newStartDate = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, '0')}-${String(newStart.getDate()).padStart(2, '0')}`;
  
  // Calculate new end date based on new start date and billing cycle
  const newEndDate = calculateEndDate(newStartDate, billingCycle);
  
  return { newStartDate, newEndDate };
}
type FormData = z.infer<typeof formSchema>;
interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: SubscriptionModalData;
}
export default function SubscriptionModal({ open, onOpenChange, subscription }: SubscriptionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!subscription;

  // Prevent duplicate draft creation on slow networks by using a per-modal draft session id
  // and a synchronous single-flight guard.
  const draftSessionIdRef = useRef<string | null>(null);
  const draftSaveInFlightRef = useRef(false);
  
  // Get tenant ID for API calls
  const tenantId = (window as any).currentTenantId || (window as any).user?.tenantId || null;

  useEffect(() => {
    if (!open) {
      draftSessionIdRef.current = null;
      draftSaveInFlightRef.current = false;
      return;
    }

    // Only apply draft session id for "new subscription" drafts (not editing existing)
    if (!isEditing && !draftSessionIdRef.current) {
      const uuid = (globalThis as any)?.crypto?.randomUUID?.();
      draftSessionIdRef.current = uuid || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }, [open, isEditing]);
  
  // Fetch employees for department head dropdown
  const { data: employeesData = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });
  
  // Get current user name from User Management based on login email
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
    if (open) {
      fetchCurrentUser();
    }
  }, [open]);
  
  // Fullscreen toggle state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Status state (Active/Cancel)
  const [status, setStatus] = useState<'Active' | 'Cancelled' | 'Draft'>('Draft');
  
  // Auto Renewal toggle state
  const [autoRenewal, setAutoRenewal] = useState<boolean>(false);
  
  // Initial Date state
  const [initialDate, setInitialDate] = useState<string>('');
  
  // Track the current subscription ObjectId for History button
  // removed currentSubscriptionId (unused)

  useEffect(() => {
    if (open) {
      if (subscription?.id) {
  // removed validId extraction (unused)
  // removed currentSubscriptionId usage
      } else {
  // removed currentSubscriptionId usage
      }
    } else {
      setTimeout(() => {
  // removed currentSubscriptionId usage
      }, 100);
    }
  }, [subscription, open]);
  
  // Query for categories
  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useQuery<Category[]>({
    queryKey: ["/api/company/categories"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/company/categories`, { credentials: "include" });
      return res.json();
    }
  });
  
  // Query for departments
  const { data: departments, isLoading: departmentsLoading, refetch: refetchDepartments } = useQuery<Department[]>({
    queryKey: ["/api/company/departments"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/company/departments`, { credentials: "include" });
      return res.json();
    }
  });
  
  // Query for currencies
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
  
  // Dynamic subscription fields from config
  const [dynamicFields, setDynamicFields] = useState<SubscriptionField[]>([]);
  // Removed unused fieldsLoading state
  
  // Employee list for Owner dropdown (from /api/employee)
  // Fetch employees from /api/employees (plural) to match company-details.tsx
  const { data: employeesRaw = [], refetch: refetchEmployees } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/employees`, { credentials: 'include' });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  
  // Map _id to id for frontend usage (like company-details)
  // removed employees mapping (unused)
  
  // Query for existing service names to validate uniqueness
  const { data: existingSubscriptions = [] } = useQuery({
    queryKey: ["/api/subscriptions", tenantId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/subscriptions`, { credentials: "include" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  
  // Extract existing service names for validation (excluding current subscription if editing)
  const existingServiceNames = existingSubscriptions
    .filter((sub: any) => {
      if (!subscription) return true;
      // Get both possible ID formats and compare
      const subId = (sub._id?.toString() || sub.id?.toString() || '').trim();
      const subscriptionId = ((subscription as any)._id?.toString() || (subscription as any).id?.toString() || '').trim();
      // Exclude the current subscription being edited
      return subId !== subscriptionId;
    })
    .map((sub: any) => sub.serviceName?.toLowerCase().trim())
    .filter(Boolean);
  
  // Fetch payment methods for dynamic dropdown
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['/api/payment'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/payment`, { credentials: 'include' });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  
  // Fetch enabled fields from backend
  useEffect(() => {
  // removed fieldsLoading logic
    fetch(`${API_BASE_URL}/api/config/fields`)
      .then(res => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDynamicFields(data.filter(f => f.enabled));
        } else {
          setDynamicFields([]);
        }
      })
      .catch(() => setDynamicFields([]))
  .finally(() => {/* removed fieldsLoading logic */});
  }, [open]);
  
  // Parse departments from subscription if it exists
  const parseDepartments = (deptString?: string | null) => {
    if (!deptString) return [];
    try {
      // If it's already an array (from editing), return it
      if (Array.isArray(deptString)) return deptString;
      // If it's a string, try to parse it as JSON
      const parsed = JSON.parse(deptString);
      return Array.isArray(parsed) ? parsed : [deptString];
    } catch {
      // If parsing fails, treat as a single department
      return deptString ? [deptString] : [];
    }
  };
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serviceName: subscription?.serviceName || "",
      website: (subscription as any)?.website || "",
      vendor: subscription?.vendor || "",
      currency: subscription?.currency || "",
      qty: subscription?.qty !== undefined && subscription?.qty !== null ? Number(subscription.qty) : "",
      amount: subscription?.amount !== undefined && subscription?.amount !== null ? Number(subscription.amount).toFixed(2) : "",
      totalAmount: subscription?.totalAmount !== undefined && subscription?.totalAmount !== null ? Number(subscription.totalAmount).toFixed(2) : "",
      billingCycle: subscription?.billingCycle && subscription?.billingCycle !== "" ? subscription.billingCycle : "",
      paymentFrequency: (subscription as any)?.paymentFrequency || "",
      category: subscription?.category || "",
      department: subscription?.department || "",
      departments: parseDepartments(subscription?.department),
      owner: subscription?.owner || "",
      ownerEmail: (subscription as any)?.ownerEmail || "",
      paymentMethod: subscription?.paymentMethod || "",
      startDate: subscription?.startDate ? new Date(subscription.startDate ?? "").toISOString().split('T')[0] : "",
      nextRenewal: subscription?.nextRenewal ? new Date(subscription.nextRenewal ?? "").toISOString().split('T')[0] : "",
  status: subscription?.status && subscription?.status !== "" ? subscription.status : "Draft",
      reminderDays: subscription?.reminderDays || "",
      reminderPolicy: subscription?.reminderPolicy && subscription?.reminderPolicy !== "" ? subscription.reminderPolicy : "",
      notes: subscription?.notes || "",
      isActive: subscription?.isActive ?? true,
    },
  });
  
  // State for service name validation
  const [serviceNameError, setServiceNameError] = useState<string>("");
  
  // Function to validate service name uniqueness
  const validateServiceName = (name: string) => {
    if (!name?.trim()) {
      setServiceNameError("");
      return true;
    }
    
    const normalizedName = name.toLowerCase().trim();
    
    // If editing, check if the name is the same as the original subscription name
    if (subscription?.serviceName) {
      const originalName = subscription.serviceName.toLowerCase().trim();
      if (normalizedName === originalName) {
        // Same as original, no error
        setServiceNameError("");
        return true;
      }
    }
    
    const isDuplicate = existingServiceNames.includes(normalizedName);
    
    if (isDuplicate) {
      setServiceNameError("Service name already exists");
      return false;
    }
    
    setServiceNameError("");
    return true;
  };
  
  // Re-validate service name when existing subscriptions change or modal opens
  useEffect(() => {
    const currentServiceName = form.getValues("serviceName");
    // Only validate if we have a service name and the modal is open
    if (currentServiceName && open) {
      validateServiceName(currentServiceName);
    } else if (!open) {
      // Clear error when modal closes
      setServiceNameError("");
    }
  }, [existingSubscriptions, open]);
  
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [categorySearch, setCategorySearch] = useState('');

  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const paymentMethodDropdownRef = useRef<HTMLDivElement>(null);
  const [paymentMethodSearch, setPaymentMethodSearch] = useState('');
  
  // Validation error dialog state
  const [validationErrorOpen, setValidationErrorOpen] = useState(false);
  const [validationErrorMessage, setValidationErrorMessage] = useState("");
  
  const [startDate, setStartDate] = useState(subscription?.startDate ? toISODateOnly(subscription.startDate) : "");
  const [billingCycle, setBillingCycle] = useState(subscription?.billingCycle || "");
  const [endDate, setEndDate] = useState(subscription?.nextRenewal ? toISODateOnly(subscription.nextRenewal) : "");
  // Removed unused endDateManuallySet state
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(parseDepartments(subscription?.department));
  
  // Store the subscription ID to track when we're working with a different subscription
  const lastSubscriptionIdRef = useRef<string>('');
  // Store the saved initial date value to prevent it from changing
  const savedInitialDateRef = useRef<string>('');
  
  // Initialize initialDate from subscription startDate when modal first opens only
  useEffect(() => {
    const currentSubId = subscription?.id || subscription?._id || '';
    
    if (open) {
      // If this is a new subscription (different ID) or first time opening
      if (currentSubId !== lastSubscriptionIdRef.current) {
        // Prefer initialDate if it exists, otherwise use startDate
        const initialDateValue = (subscription as any)?.initialDate || subscription?.startDate;
        if (initialDateValue) {
          const dateValue = toISODateOnly(initialDateValue);
          setInitialDate(dateValue);
          savedInitialDateRef.current = dateValue;
        } else {
          setInitialDate('');
          savedInitialDateRef.current = '';
        }
        lastSubscriptionIdRef.current = currentSubId;
      }
      // Don't restore from savedInitialDateRef here - it causes issues
      // The ref is only used to persist user's manual input
    } else {
      // Reset when modal closes
      lastSubscriptionIdRef.current = '';
      savedInitialDateRef.current = '';
    }
  }, [open, subscription?.id, subscription?._id]);
  
  // Initialize original total amount when editing
  useEffect(() => {
    if (isEditing && subscription?.totalAmount) {
      setOriginalTotalAmount(Number(subscription.totalAmount));
    }
  }, [subscription?.totalAmount, isEditing, open]);
  // Removed unused isPopoverOpen state
  const [isRenewing, setIsRenewing] = useState(false);
  const [lcyAmount, setLcyAmount] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>(''); // excl tax
  const [taxAmount, setTaxAmount] = useState<string>('');
  const [totalAmountInclTax, setTotalAmountInclTax] = useState<string>('');
  const [originalTotalAmount, setOriginalTotalAmount] = useState<number>(0);
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [effectiveDateDialog, setEffectiveDateDialog] = useState<{show: boolean}>({show: false});
  const [renewalConfirmDialog, setRenewalConfirmDialog] = useState<{show: boolean}>({show: false});
  const [errorDialog, setErrorDialog] = useState<{show: boolean, message: string}>({show: false, message: ''});
  const [confirmDialog, setConfirmDialog] = useState<{show: boolean}>({show: false});
  const [exitConfirmDialog, setExitConfirmDialog] = useState<{show: boolean}>({show: false});
  const [cancelRenewalConfirmDialog, setCancelRenewalConfirmDialog] = useState<{show: boolean}>({show: false});
  const [saveDraftRequiredDialog, setSaveDraftRequiredDialog] = useState<{show: boolean}>({show: false});
  const [subscriptionCreated, setSubscriptionCreated] = useState<boolean>(false);
  const [departmentModal, setDepartmentModal] = useState<{show: boolean}>({show: false});
  const [newDepartmentName, setNewDepartmentName] = useState<string>('');
  const [newDepartmentHead, setNewDepartmentHead] = useState<string>('');
  const [deptHeadOpen, setDeptHeadOpen] = useState(false);
  const [deptHeadSearch, setDeptHeadSearch] = useState('');
  const deptHeadDropdownRef = useRef<HTMLDivElement>(null);
  const [newDepartmentEmail, setNewDepartmentEmail] = useState<string>('');
  const [newDepartmentEmailError, setNewDepartmentEmailError] = useState<string>('');
  const [isDepartmentEmailLocked, setIsDepartmentEmailLocked] = useState<boolean>(false);
    // Auto-fill and lock department email when head is selected
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
  const [categoryModal, setCategoryModal] = useState<{show: boolean}>({show: false});
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [paymentMethodModal, setPaymentMethodModal] = useState<{show: boolean}>({show: false});
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
  const [ownerModal, setOwnerModal] = useState<{show: boolean}>({show: false});
  const [ownerDeptOpen, setOwnerDeptOpen] = useState(false);
  const [ownerDeptSearch, setOwnerDeptSearch] = useState('');
  const ownerDeptDropdownRef = useRef<HTMLDivElement>(null);
  const [newOwnerName, setNewOwnerName] = useState<string>('');
  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('');
  const [newOwnerEmailError, setNewOwnerEmailError] = useState<string>('');
  const [newOwnerRole, setNewOwnerRole] = useState<string>('');
  const [newOwnerStatus, setNewOwnerStatus] = useState<string>('active');
  const [newOwnerDepartment, setNewOwnerDepartment] = useState<string>('');
  const [documents, setDocuments] = useState<Array<{name: string, url: string}>>([]);
  const [showDocumentDialog, setShowDocumentDialog] = useState<boolean>(false);
  
  // Logo state
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [, setLogoLoading] = useState<boolean>(false);
  
  // Website editing state
  const [isEditingWebsite, setIsEditingWebsite] = useState<boolean>(false);
  const [websiteURLError, setWebsiteURLError] = useState<string>("");

  // Owner modal Department dropdown: close on outside click
  useEffect(() => {
    if (!ownerDeptOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (ownerDeptDropdownRef.current && !ownerDeptDropdownRef.current.contains(event.target as Node)) {
        setOwnerDeptOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ownerDeptOpen]);

  // Keep Owner modal Department input text in sync when opening the modal
  useEffect(() => {
    if (ownerModal.show) {
      setOwnerDeptSearch(newOwnerDepartment || '');
      setOwnerDeptOpen(false);
    }
  }, [ownerModal.show]);
  
  // Notes management state
  const [notes, setNotes] = useState<Array<{id: string, text: string, createdAt: string, createdBy: string}>>([]);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showViewNoteDialog, setShowViewNoteDialog] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{id: string, text: string, createdAt: string, createdBy: string} | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  
  // Predefined vendor list
  const VENDOR_LIST = [
    "Microsoft Corporation", "Amazon Web Services, Inc.", "Google LLC", "Salesforce, Inc.", "Adobe Inc.",
    "Oracle Corporation", "SAP SE", "International Business Machines Corporation (IBM)", "ServiceNow, Inc.",
    "Atlassian Corporation", "Zoom Video Communications, Inc.", "Slack Technologies, LLC (Salesforce)",
    "Dropbox, Inc.", "Box, Inc.", "DocuSign, Inc.", "HubSpot, Inc.", "Canva Pty Ltd", "Shopify Inc.",
    "Snowflake Inc.", "Twilio Inc.", "VMware, Inc. (Broadcom)", "Cisco Systems, Inc.", "Dell Technologies Inc.",
    "Hewlett Packard Enterprise Company", "Citrix Systems, Inc.", "Palo Alto Networks, Inc.",
    "CrowdStrike Holdings, Inc.", "Fortinet, Inc.", "Zscaler, Inc.", "Cloudflare, Inc.", "Okta, Inc.",
    "Tenable Holdings, Inc.", "Rapid7, Inc.", "Splunk Inc.", "Proofpoint, Inc.", "CyberArk Software Ltd.",
    "Trend Micro Incorporated", "McAfee, LLC", "Sophos Ltd.", "SentinelOne, Inc.",
    "Check Point Software Technologies Ltd.", "Mandiant (Google)", "Rubrik, Inc.", "Veeam Software",
    "Commvault Systems, Inc.", "Intuit Inc.", "Stripe, Inc.", "PayPal Holdings, Inc.", "Block, Inc. (Square)",
    "Xero Limited", "The Sage Group plc", "Fiserv, Inc.", "Fidelity National Information Services, Inc. (FIS)",
    "Bill.com Holdings, Inc.", "Expensify, Inc.", "Coupa Software Inc.", "Brex Inc.", "Ramp Business Corporation",
    "Adyen N.V.", "Plaid Inc.", "Automatic Data Processing, Inc. (ADP)", "Workday, Inc.", "Paychex, Inc.",
    "Paycom Software, Inc.", "Ceridian HCM Holding Inc. (Dayforce)", "UKG Inc. (Ultimate Kronos Group)",
    "BambooHR LLC", "Rippling People Center Inc.", "Gusto, Inc.", "Deel, Inc.", "Robert Half International Inc.",
    "Cornerstone OnDemand, Inc.", "Leidos Holdings, Inc.", "Northrop Grumman Corporation",
    "General Dynamics Corporation", "Raytheon Technologies Corporation (RTX)", "Booz Allen Hamilton Holding Corporation",
    "Science Applications International Corporation (SAIC)", "CACI International Inc", "Palantir Technologies Inc.",
    "Tyler Technologies, Inc.", "Carahsoft Technology Corp.", "Crayon Group Holding ASA (Acquirer of Rhipe)",
    "Ingram Micro Inc.", "Pax8, Inc.", "TD SYNNEX Corporation", "Arrow Electronics, Inc. (Arrow ECS)",
    "Dicker Data Limited", "Sherweb Inc.", "AppDirect, Inc.", "Insight Enterprises, Inc.", "SoftwareOne AG",
    "CDW Corporation", "SHI International Corp.", "Zendesk, Inc.", "Freshworks Inc.", "Intercom, Inc.",
    "Qualtrics, LLC", "SurveyMonkey (Momentive Global Inc.)", "Hootsuite Inc.", "Sprout Social, Inc.",
    "Semrush Holdings, Inc.", "Ahrefs Pte. Ltd.", "Moz, Inc.", "Braze, Inc.", "Klaviyo, Inc.",
    "ActiveCampaign, LLC", "Constant Contact, Inc.", "Mailchimp (Intuit Inc.)", "Typeform SL",
    "Drift.com, Inc.", "Pipedrive Inc.", "Zoho Corporation Pvt. Ltd.", "Yotpo Ltd.", "Trustpilot Group plc",
    "G2.com, Inc.", "Cision Ltd.", "Meltwater B.V.", "Sprinklr, Inc.", "Datadog, Inc.", "New Relic, Inc.",
    "Dynatrace, Inc.", "PagerDuty, Inc.", "HashiCorp, Inc.", "JFrog Ltd.", "DigitalOcean Holdings, Inc.",
    "Akamai Technologies, Inc.", "F5, Inc.", "Juniper Networks, Inc.", "Arista Networks, Inc.", "NetApp, Inc.",
    "Pure Storage, Inc.", "Red Hat, Inc. (IBM)", "SUSE S.A.", "Canonical Ltd. (Ubuntu)", "Docker, Inc.",
    "Elastic N.V.", "MongoDB, Inc.", "Redis, Inc.", "Couchbase, Inc.", "GitHub, Inc. (Microsoft)",
    "GitLab Inc.", "JetBrains s.r.o.", "Postman, Inc.", "OpenAI, L.L.C.", "Anthropic, PBC",
    "Databricks, Inc.", "Glean Technologies, Inc.", "Harvey AI, Inc.", "Hebbia, Inc.", "Waabi Innovation Inc.",
    "Weaviate B.V.", "Writer, Inc.", "NVIDIA Corporation", "Siemens AG", "Sift Science, Inc.",
    "Scale AI, Inc.", "Hugging Face, Inc.", "Jasper AI, Inc.", "Netflix, Inc.", "Disney+",
    "Amazon Prime Video", "Apple TV+", "Spotify Technology S.A.", "YouTube Premium", "Singtel",
    "StarHub Ltd", "M1 Limited", "Grab Holdings Ltd", "Sea Limited", "Tableau Software, LLC (Salesforce)",
    "QlikTech International AB", "MicroStrategy Incorporated", "Asana, Inc.", "Monday.com Ltd",
    "Smartsheet Inc.", "Notion Labs, Inc.", "Trello (Atlassian)", "Basecamp, LLC", "Figma, Inc.",
    "Sketch B.V.", "InVisionApp Inc.", "Miro (RealtimeBoard Inc.)", "Lucid Software Inc.", "Shutterstock, Inc.",
    "Getty Images Holdings, Inc.", "Envato Pty Ltd", "Webflow, Inc.", "Squarespace, Inc.", "Wix.com Ltd.",
    "GoDaddy Inc.", "Namecheap, Inc.", "Bluehost Inc. (Newfold Digital)", "SiteGround Hosting Ltd.",
    "WP Engine, Inc.", "1Password", "LastPass", "Dashlane", "NordVPN", "ExpressVPN"
  ];
  
  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryOpen(false);
        setCategorySearch('');
      }
    };

    if (categoryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [categoryOpen]);

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

  // Keep input text in sync when opening the modal
  useEffect(() => {
    if (paymentMethodModal.show) {
      setPmOwnerSearch(newPaymentMethodOwner || '');
      setPmManagedSearch(newPaymentMethodManagedBy || '');
    }
  }, [paymentMethodModal.show]);
  
  // Refetch data when modal opens
  useEffect(() => {
    if (open) {
      refetchCategories();
      refetchDepartments();
    }
  }, [open, refetchCategories, refetchDepartments]);

  // Reset form when modal opens for new subscription (no subscription prop)
  useEffect(() => {
    if (open && !subscription) {
      // Reset all state variables
      setStartDate("");
      setBillingCycle("");
      setEndDate("");
      setSelectedDepartments([]);
      setStatus('Draft');
      setAutoRenewal(false);
      setServiceNameError("");
      setLcyAmount('');
      setTotalAmount('');
      setTaxAmount('');
      setTotalAmountInclTax('');
      setDocuments([]);
      setIsEditingWebsite(false);
      setNotes([]);
      setSubscriptionCreated(false); // Reset subscription created flag
      setInitialDate(''); // Reset First Purchase Date
      savedInitialDateRef.current = ''; // Reset saved initial date ref
      
      // Reset form
      form.reset({
        serviceName: "",
        website: "",
        vendor: "",
        currency: "",
        qty: "",
        amount: "",
        totalAmount: "",
        billingCycle: "",
        category: "",
        department: "",
        departments: [],
        owner: "",
        ownerEmail: "",
        paymentMethod: "",
        startDate: "",
        nextRenewal: "",
        status: "Draft",
        reminderDays: "",
        reminderPolicy: "",
        notes: "",
        isActive: true,
      });
    }
  }, [open, subscription, form]);
  
  useEffect(() => {
    if (subscription) {
      const start = subscription.startDate ? toISODateOnly(subscription.startDate) : "";
      const end = subscription.nextRenewal ? toISODateOnly(subscription.nextRenewal) : "";
      const depts = parseDepartments(subscription.department);
      
      setStartDate(start);
      setBillingCycle(subscription.billingCycle || "monthly");
      setEndDate(end);
  // removed manual end date flag
      setSelectedDepartments(depts);
      
      // Set status state from subscription data
  setStatus((subscription.status && subscription.status !== "" ? subscription.status : "Active") as 'Active' | 'Cancelled' | 'Draft');
      
      // Set auto renewal state from subscription data
      setAutoRenewal(subscription.autoRenewal ?? true);
      
      // Check if subscription has documents
      if ((subscription as any)?.documents && Array.isArray((subscription as any).documents)) {
        setDocuments((subscription as any).documents);
      } else if ((subscription as any)?.document) {
        // Legacy support for single document
        setDocuments([{name: 'Document 1', url: (subscription as any).document}]);
      } else {
        setDocuments([]);
      }
      
      // Load notes from subscription
      if ((subscription as any)?.notes) {
        try {
          const parsedNotes = typeof (subscription as any).notes === 'string' 
            ? JSON.parse((subscription as any).notes) 
            : (subscription as any).notes;
          setNotes(Array.isArray(parsedNotes) ? parsedNotes : []);
        } catch {
          setNotes([]);
        }
      } else {
        setNotes([]);
      }
      
      // Set totalAmount state for display
      const totalAmtValue = subscription.totalAmount !== undefined && subscription.totalAmount !== null ? Number(subscription.totalAmount).toFixed(2) : "";
      setTotalAmount(totalAmtValue);
      
      // Set taxAmount and totalAmountInclTax state
      const taxAmtValue = (subscription as any)?.taxAmount !== undefined && (subscription as any)?.taxAmount !== null ? Number((subscription as any).taxAmount).toFixed(2) : "";
      const totalInclTaxValue = (subscription as any)?.totalAmountInclTax !== undefined && (subscription as any)?.totalAmountInclTax !== null ? Number((subscription as any).totalAmountInclTax).toFixed(2) : "";
      setTaxAmount(taxAmtValue);
      setTotalAmountInclTax(totalInclTaxValue);
      
      form.reset({
        serviceName: subscription.serviceName || "",
        website: (subscription as any)?.website || "",
        vendor: subscription.vendor || "",
        currency: subscription.currency || "",
        qty: subscription.qty !== undefined && subscription.qty !== null ? Number(subscription.qty) : 1,
        amount: subscription.amount !== undefined && subscription.amount !== null ? Number(subscription.amount).toFixed(2) : "",
        totalAmount: totalAmtValue,
        billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "",
        paymentFrequency: (subscription as any)?.paymentFrequency || "",
        category: subscription.category || "",
        department: subscription.department || "",
        departments: depts,
        owner: subscription.owner || "",
        ownerEmail: (subscription as any)?.ownerEmail || "",
        paymentMethod: subscription.paymentMethod || "",
        startDate: start,
        nextRenewal: end,
        status: subscription.status && subscription.status !== "" ? subscription.status : "Active",
        reminderDays: subscription.reminderDays || 7,
        reminderPolicy: subscription.reminderPolicy && subscription.reminderPolicy !== "" ? subscription.reminderPolicy : "One time",
        notes: subscription.notes || "",
        isActive: subscription.isActive ?? true,
      });

      // Force LCY calculation after form reset with a small delay
      setTimeout(() => {
        const totalAmount = subscription.totalAmount !== undefined && subscription.totalAmount !== null ? Number(subscription.totalAmount).toFixed(2) : "";
        const currency = subscription.currency || "";
        const localCurrency = companyInfo?.defaultCurrency;
        
        if (totalAmount && currency && localCurrency && currency !== localCurrency) {
          const selectedCurrency = currencies.find((curr: any) => curr.code === currency);
          const exchangeRate = selectedCurrency?.exchangeRate ? parseFloat(selectedCurrency.exchangeRate) : null;
          
          if (exchangeRate && exchangeRate > 0) {
            const totalAmountNum = parseFloat(totalAmount);
            // Invert the exchange rate: LCY Amount = Total Amount ÷ Exchange Rate
            const convertedAmount = totalAmountNum / exchangeRate;
            setLcyAmount(convertedAmount.toFixed(2));
          }
        } else if (currency === localCurrency && totalAmount) {
          setLcyAmount(totalAmount);
        }
      }, 100);
    } else {
      setStartDate("");
      setBillingCycle("");
      setEndDate("");
  // removed manual end date flag
      setSelectedDepartments([]);
      
  // Reset status to Draft for new subscriptions
  setStatus('Draft');
      
      // Reset auto renewal to false for new subscriptions
      setAutoRenewal(false);
      
      form.reset({
        serviceName: "",
        website: "",
        vendor: "",
        currency: "",
        qty: "",
        amount: "",
        totalAmount: "",
        billingCycle: "",
        paymentFrequency: "",
        category: "",
        department: "",
        departments: [],
        owner: "",
        ownerEmail: "",
        paymentMethod: "",
        startDate: "",
        nextRenewal: "",
  status: "Draft",
        reminderDays: "",
        reminderPolicy: "",
        notes: "",
        isActive: true,
      });

      // Reset LCY amount for new subscriptions
      setLcyAmount('');
      setTaxAmount('');
      setTotalAmountInclTax('');
    }
  }, [subscription, form, companyInfo?.defaultCurrency, currencies]);
  
  // Update Total Amount Incl Tax when totalAmount or taxAmount changes
  useEffect(() => {
    const excl = parseFloat(totalAmount) || 0;
    const tax = parseFloat(taxAmount) || 0;
    const incl = excl + tax;
    setTotalAmountInclTax(incl > 0 ? incl.toFixed(2) : '');
  }, [totalAmount, taxAmount]);

  useEffect(() => {
    if (startDate && billingCycle) {
      const calculatedEndDate = calculateEndDate(startDate, billingCycle);
      setEndDate(calculatedEndDate);
      form.setValue('nextRenewal', calculatedEndDate);
    }
  }, [startDate, billingCycle, form]);

  // Calculate LCY Amount based on totalAmount, currency, and exchange rate (inverted)
  useEffect(() => {
    const calculateLcyAmount = () => {
      const totalAmount = form.watch('totalAmount');
      const currency = form.watch('currency');
      const localCurrency = companyInfo?.defaultCurrency;
      
      if (!totalAmount || !currency || !localCurrency || currency === localCurrency) {
        setLcyAmount(currency === localCurrency ? totalAmount?.toString() || '' : '');
        return;
      }
      
      // Find the selected currency and its exchange rate
      const selectedCurrency = currencies.find((curr: any) => curr.code === currency);
      const exchangeRate = selectedCurrency?.exchangeRate ? parseFloat(selectedCurrency.exchangeRate) : null;
      
      if (exchangeRate && exchangeRate > 0) {
        const totalAmountNum = parseFloat(totalAmount?.toString() || '0');
        // Invert the exchange rate: LCY Amount = Total Amount ÷ Exchange Rate
        const convertedAmount = totalAmountNum / exchangeRate;
        setLcyAmount(convertedAmount.toFixed(2));
      } else {
        setLcyAmount('');
      }
    };
    
    calculateLcyAmount();
  }, [form.watch('totalAmount'), form.watch('currency'), companyInfo?.defaultCurrency, currencies, subscription]);

  // Force recalculation when window regains focus (in case exchange rates were updated in another tab)
  useEffect(() => {
    const handleFocus = () => {
      // Small delay to ensure any data refresh has completed
      setTimeout(() => {
        const amount = form.watch('amount');
        const currency = form.watch('currency');
        if (amount && currency) {
          // Trigger a recalculation by slightly changing and restoring a dependency
          const currentCurrency = form.getValues('currency');
          form.setValue('currency', currentCurrency);
        }
      }, 100);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [form]);

  // Watch serviceName and set qty to 1 when service name is entered
  useEffect(() => {
    const serviceName = form.watch('serviceName');
    const currentQty = form.watch('qty');
    
    // Only set qty to 1 if serviceName is not empty and qty is currently empty
    if (serviceName && serviceName.trim() !== '' && (!currentQty || currentQty === '')) {
      form.setValue('qty', 1);
    }
  }, [form.watch('serviceName'), form]);

  // Note: Auto-renewal is now handled by the server-side scheduled job
  // The server checks daily for subscriptions where Next Payment Date = Today and auto-renewal is enabled
  // This ensures renewals happen automatically even when the modal is not open

  // Fetch company logo when website URL changes
  useEffect(() => {
    const website = form.watch('website');
    
    if (!website || !open) {
      setCompanyLogo('');
      return;
    }
    
    const fetchLogo = async () => {
      try {
        setLogoLoading(true);
        
        // Extract domain from URL
        let domain = website;
        try {
          const url = new URL(website.startsWith('http') ? website : `https://${website}`);
          domain = url.hostname.replace('www.', '');
        } catch {
          // If URL parsing fails, try to clean the domain
          domain = website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        }
        
        // Try multiple logo services in order of preference
        const logoSources = [
          `https://logo.clearbit.com/${domain}`, // Clearbit - high quality
          `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, // Google favicon - reliable fallback
        ];
        
        // Test first source
        const img = new Image();
        img.onload = () => {
          setCompanyLogo(logoSources[0]);
          setLogoLoading(false);
        };
        img.onerror = () => {
          // Fallback to Google favicon
          setCompanyLogo(logoSources[1]);
          setLogoLoading(false);
        };
        img.src = logoSources[0];
        
      } catch (error) {
        console.error('Error fetching logo:', error);
        setCompanyLogo('');
        setLogoLoading(false);
      }
    };
    
    // Debounce the logo fetch
    const timeoutId = setTimeout(fetchLogo, 500);
    return () => clearTimeout(timeoutId);
  }, [form.watch('website'), open]);
  
  const mutation = useMutation({
    mutationFn: async (data: FormData & { id?: string }) => {
      const { id, createdAt, ...rest } = data as any;
      
      // Convert departments array to JSON string for storage
      const subscriptionData: InsertSubscription = {
        ...rest,
        department: JSON.stringify(data.departments || []),
        startDate: new Date(data.startDate ?? "").toISOString(),
        nextRenewal: new Date(data.nextRenewal ?? "").toISOString(),
      };
      
      let res;
      const subId = subscription?.id || subscription?._id;
      // Remove tenantId from update payload
      if (isEditing && subId) {
        delete (subscriptionData as any).tenantId;
        res = await apiRequest("PUT", `/api/subscriptions/${subId}`, subscriptionData);
      } else {
        res = await apiRequest("POST", "/api/subscriptions", subscriptionData);
      }
      return res.json();
    },
  onMutate: async (newData) => {
      const tenantId = (window as any).currentTenantId || (window as any).user?.tenantId || null;
      
      // Cancel any outgoing refetches for this tenant
      await queryClient.cancelQueries({ queryKey: ["/api/subscriptions", tenantId] });
      
      // Snapshot the previous value
      const previousSubscriptions = queryClient.getQueryData(["/api/subscriptions", tenantId]);
      
      // Optimistically update to the new value
      if (isEditing && (newData as any).id) {
        // Update existing subscription
        queryClient.setQueryData(["/api/subscriptions", tenantId], (old: any) => {
          if (!old) return old;
          return old.map((sub: any) => 
            (sub.id === (newData as any).id || sub._id === (newData as any).id) 
              ? { ...sub, ...newData }
              : sub
          );
        });
      } else if (!isEditing) {
        // Create new subscription
        queryClient.setQueryData(["/api/subscriptions", tenantId], (old: any) => {
          const optimisticSub = {
            ...newData,
            _id: 'temp-' + Date.now(),
            id: 'temp-' + Date.now(),
            createdAt: new Date().toISOString(),
            tenantId: tenantId,
          };
          return old ? [...old, optimisticSub] : [optimisticSub];
        });
      }
      
      // Return a context object with the snapshotted value
      return { previousSubscriptions, tenantId };
    },
    onSuccess: (result, variables, context) => {
      void variables;
      const tenantId = context?.tenantId || (window as any).currentTenantId || (window as any).user?.tenantId || null;
      
      // Mark subscription as created to disable draft button
      if (!isEditing) {
        setSubscriptionCreated(true);
        
        // Dispatch subscription creation event
        const subscriptionId = result?._id || result?.subscription?._id;
        if (typeof window !== 'undefined' && window.dispatchEvent && subscriptionId) {
          window.dispatchEvent(new CustomEvent('subscription-created', { 
            detail: { ...result, _id: subscriptionId }
          }));
        }
      } else {
        // For updates, dispatch update event
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('subscription-updated', { 
            detail: result
          }));
        }
      }
      
      // Show success message immediately
      toast({
        title: "Success",
        description: `Subscription ${isEditing ? 'updated' : 'created'} successfully`,
        variant: "success",
      });
      
      // Close modal immediately
      onOpenChange(false);
      
      // Immediately refetch without tenantId to force fresh data
      queryClient.refetchQueries({ 
        queryKey: ["/api/subscriptions"],
        exact: false
      });
      
      // Also invalidate and refetch with tenant key
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions", tenantId] });
      queryClient.refetchQueries({ 
        queryKey: ["/api/subscriptions", tenantId],
        type: 'active'
      });
      
      // Invalidate other queries in background
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/categories"] });
    },
    onError: (error: any, newData, context: any) => {
      void newData;
      const tenantId = context?.tenantId || (window as any).currentTenantId || (window as any).user?.tenantId || null;
      
      // Rollback to the previous value on error
      if (context?.previousSubscriptions) {
        queryClient.setQueryData(["/api/subscriptions", tenantId], context.previousSubscriptions);
      }
      
      console.error("Mutation error:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.message || error.message || `Failed to ${isEditing ? 'update' : 'create'} subscription`,
        variant: "destructive",
      });
    },
  });

  // Draft mutation for saving drafts
  const draftMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { id, createdAt, ...rest } = data as any;
      
      // Safely convert dates - use null if invalid
      const startDateValue = data.startDate ? new Date(data.startDate) : null;
      const nextRenewalValue = data.nextRenewal ? new Date(data.nextRenewal) : null;
      
      // Validate dates before sending
      const startDateISO = startDateValue && !isNaN(startDateValue.getTime()) ? startDateValue.toISOString() : new Date().toISOString();
      const nextRenewalISO = nextRenewalValue && !isNaN(nextRenewalValue.getTime()) ? nextRenewalValue.toISOString() : new Date().toISOString();
      
      // Convert departments array to JSON string for storage
      const draftData: any = {
        ...rest,
        department: JSON.stringify(data.departments || []),
        startDate: startDateISO,
        nextRenewal: nextRenewalISO,
        draftSessionId: draftSessionIdRef.current, // Include session ID for idempotent saves
      };
      
      // If editing an existing subscription, use PUT to update, otherwise POST to create
      if (isEditing && subscription?.id) {
        const res = await apiRequest("PUT", `/api/subscriptions/${subscription.id}`, draftData);
        if (!res.ok) {
          const error = await res.json().catch(() => ({ message: 'Failed to save draft' }));
          throw new Error(error.message || 'Failed to save draft');
        }
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/subscriptions/draft", draftData);
        if (!res.ok) {
          const error = await res.json().catch(() => ({ message: 'Failed to save draft' }));
          throw new Error(error.message || 'Failed to save draft');
        }
        return res.json();
      }
    },
    onMutate: async (newData) => {
      const tenantId = (window as any).currentTenantId || (window as any).user?.tenantId || null;
      
      // Cancel any outgoing refetches for this tenant
      await queryClient.cancelQueries({ queryKey: ["/api/subscriptions", tenantId] });
      
      // Snapshot the previous value
      const previousSubscriptions = queryClient.getQueryData(["/api/subscriptions", tenantId]);
      
      // Optimistically update the cache
      if (isEditing && subscription?.id) {
        // Update existing draft subscription
        queryClient.setQueryData(["/api/subscriptions", tenantId], (old: any) => {
          if (!old) return old;
          return old.map((sub: any) => 
            (sub.id === subscription.id || sub._id === subscription.id) 
              ? { ...sub, ...newData, updatedAt: new Date().toISOString() }
              : sub
          );
        });
      } else {
        // Add new draft subscription
        queryClient.setQueryData(["/api/subscriptions", tenantId], (old: any) => {
          const optimisticDraft = {
            ...newData,
            _id: 'temp-draft-' + Date.now(),
            id: 'temp-draft-' + Date.now(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tenantId: tenantId,
            status: 'Draft',
          };
          return old ? [optimisticDraft, ...old] : [optimisticDraft];
        });
      }
      
      // Return a context object with the snapshotted value
      return { previousSubscriptions, tenantId };
    },
    onSuccess: async (result, variables, context) => {
      void result;
      void variables;
      const tenantId = context?.tenantId || (window as any).currentTenantId || (window as any).user?.tenantId || null;
      
      // Show success message based on whether editing or creating
      toast({
        title: isEditing ? "Draft Updated" : "Draft Saved",
        description: isEditing ? "Draft subscription updated successfully" : "Subscription saved as draft successfully",
        variant: "success",
      });
      
      // Close modal
      onOpenChange(false);
      
      // Invalidate and refetch to replace optimistic data with real data
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/drafts"] });
      
      // Reset form after a short delay
      setTimeout(() => {
        form.reset();
      }, 300);
    },
    onError: (error: any, newData, context: any) => {
      void newData;
      const tenantId = context?.tenantId || (window as any).currentTenantId || (window as any).user?.tenantId || null;
      
      // Rollback to the previous value on error
      if (context?.previousSubscriptions) {
        queryClient.setQueryData(["/api/subscriptions", tenantId], context.previousSubscriptions);
      }
      
      console.error("Draft save error:", error);
      toast({
        title: "Error",
        description: error?.message || `Failed to save draft`,
        variant: "destructive",
      });
    },
  });

  // Handle save draft function
  const handleSaveDraft = async (options?: { returnResult?: boolean }) => {
    if (draftSaveInFlightRef.current || draftMutation.isPending) {
      return;
    }

    const currentValues = form.getValues();
    
    // Basic validation for required fields
    if (!currentValues.serviceName?.trim()) {
      toast({
        title: "Validation Error",
        description: "Service name is required to save as draft",
        variant: "destructive",
      });
      return;
    }

    draftSaveInFlightRef.current = true;
    try {
      const amountNum = typeof currentValues.amount === 'string' ? parseFloat(currentValues.amount) : currentValues.amount ?? 0;
      const taxAmountNum = taxAmount !== "" ? parseFloat(taxAmount) : 0;
      const totalAmountInclTaxNum = totalAmountInclTax !== "" ? parseFloat(totalAmountInclTax) : 0;
      const tenantId = String((window as any).currentTenantId || (window as any).user?.tenantId || "");
      
      const payload = {
        ...currentValues,
        status: 'Draft', // Always save as draft
        autoRenewal: autoRenewal, // Add auto renewal from state
        amount: amountNum,
        taxAmount: isNaN(taxAmountNum) ? 0 : taxAmountNum,
        totalAmountInclTax: isNaN(totalAmountInclTaxNum) ? 0 : totalAmountInclTaxNum,
        initialDate: new Date(currentValues.startDate ?? ""), // Set initialDate to startDate
        tenantId,
        departments: currentValues.departments || [],
        startDate: currentValues.startDate || new Date().toISOString().split('T')[0],
        nextRenewal: currentValues.nextRenewal || new Date().toISOString().split('T')[0],
        ...(isEditing ? {} : { draftSessionId: draftSessionIdRef.current }),
      };

      // Always use mutateAsync so we can reliably reset the single-flight guard in finally.
      const result = await draftMutation.mutateAsync(payload as FormData);
      if (options?.returnResult) return result;
    } finally {
      draftSaveInFlightRef.current = false;
    }
  };
  
  const onSubmit = async (data: FormData) => {
    // Check for service name validation errors
    if (serviceNameError) {
      toast({
        title: "Validation Error",
        description: "Please fix the service name error before submitting",
        variant: "destructive",
      });
      return;
    }
    
    // Validate service name uniqueness one more time before submission
    if (data.serviceName && !validateServiceName(data.serviceName)) {
      return;
    }
    
    // Validate Current Cycle Start >= First Purchase Date
    if (initialDate && startDate && new Date(startDate) < new Date(initialDate)) {
      toast({
        title: "Validation Error",
        description: "Current Cycle Start must be on or after First Purchase Date",
        variant: "destructive",
      });
      return;
    }
    
    setStatus('Active'); // Set status to Active when saving
    try {
      // Always include department as JSON string for backend
      // Ensure amount is a number
      const amountNum = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount ?? 0;
      const totalAmountNum = typeof data.totalAmount === 'string' ? parseFloat(data.totalAmount) : data.totalAmount ?? 0;
      const qtyNum = typeof data.qty === 'string' ? parseFloat(data.qty) : data.qty ?? 0;
      const taxAmountNum = taxAmount !== "" ? parseFloat(taxAmount) : 0;
      const totalAmountInclTaxNum = totalAmountInclTax !== "" ? parseFloat(totalAmountInclTax) : 0;
      // Get tenantId from context, state, or user info
  const tenantId = String((window as any).currentTenantId || (window as any).user?.tenantId || "");
      const payload = {
        ...data,
        status: 'Active', // Always save as active
        autoRenewal: autoRenewal, // Add auto renewal from state
        amount: isNaN(amountNum) ? 0 : amountNum,
        totalAmount: isNaN(totalAmountNum) ? 0 : totalAmountNum,
        qty: isNaN(qtyNum) ? 0 : qtyNum,
        lcyAmount: lcyAmount !== "" ? Number(lcyAmount) : undefined,
        taxAmount: isNaN(taxAmountNum) ? 0 : taxAmountNum,
        totalAmountInclTax: isNaN(totalAmountInclTaxNum) ? 0 : totalAmountInclTaxNum,
        departments: selectedDepartments,
        department: JSON.stringify(selectedDepartments),
        startDate: new Date(data.startDate ?? ""),
        initialDate: new Date(data.startDate ?? ""), // Set initialDate to startDate for new subscriptions
        nextRenewal: data.nextRenewal ? new Date(data.nextRenewal) : new Date(),
        tenantId,
        documents: documents.length > 0 ? documents : undefined, // Include documents if uploaded
        notes: notes.length > 0 ? JSON.stringify(notes) : undefined, // Include notes as JSON string
      };
      if (isEditing) {
        // Update existing subscription
        const validId = getValidObjectId(subscription?.id);
        if (!validId) {
          toast({
            title: "Error",
            description: "Invalid subscription ID. Cannot update history.",
            variant: "destructive",
          });
          return;
        }
        
        // Check if total amount has changed
        const currentTotalAmount = Number(data.totalAmount || 0);
        if (originalTotalAmount !== currentTotalAmount && originalTotalAmount > 0) {
          // Show effective date dialog
          setEffectiveDateDialog({show: true});
          return;
        }
        
        mutation.mutate({
          ...payload,
          id: subscription?.id || subscription?._id, // Include the subscription id
          startDate: payload.startDate instanceof Date ? payload.startDate.toISOString() : String(payload.startDate),
          nextRenewal: payload.nextRenewal instanceof Date ? payload.nextRenewal.toISOString() : String(payload.nextRenewal),
        });
      } else {
        // Create new subscription - use mutation for consistent state management
        mutation.mutate({
          ...payload,
          startDate: payload.startDate instanceof Date ? payload.startDate.toISOString() : String(payload.startDate),
          nextRenewal: payload.nextRenewal instanceof Date ? payload.nextRenewal.toISOString() : String(payload.nextRenewal),
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save subscription",
        variant: "destructive",
      });
    }
  };
  
  // Handle update with effective date
  const handleUpdateWithEffectiveDate = async () => {
    if (!effectiveDate) {
      toast({
        title: "Required",
        description: "Please enter an effective date",
        variant: "destructive",
      });
      return;
    }
    
    setEffectiveDateDialog({show: false});
    
    const data = form.getValues();
    const amountNum = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount ?? 0;
    const totalAmountNum = typeof data.totalAmount === 'string' ? parseFloat(data.totalAmount) : data.totalAmount ?? 0;
    const qtyNum = typeof data.qty === 'string' ? parseFloat(data.qty) : data.qty ?? 0;
    const taxAmountNum = taxAmount !== "" ? parseFloat(taxAmount) : 0;
    const totalAmountInclTaxNum = totalAmountInclTax !== "" ? parseFloat(totalAmountInclTax) : 0;
    const tenantId = String((window as any).currentTenantId || (window as any).user?.tenantId || "");
    
    const payload = {
      ...data,
      status: 'Active',
      autoRenewal: autoRenewal,
      amount: isNaN(amountNum) ? 0 : amountNum,
      totalAmount: isNaN(totalAmountNum) ? 0 : totalAmountNum,
      qty: isNaN(qtyNum) ? 0 : qtyNum,
      lcyAmount: lcyAmount !== "" ? Number(lcyAmount) : undefined,
      taxAmount: isNaN(taxAmountNum) ? 0 : taxAmountNum,
      totalAmountInclTax: isNaN(totalAmountInclTaxNum) ? 0 : totalAmountInclTaxNum,
      departments: selectedDepartments,
      department: JSON.stringify(selectedDepartments),
      startDate: new Date(data.startDate ?? ""),
      initialDate: savedInitialDateRef.current || initialDate || new Date(data.startDate ?? ""), // Preserve initialDate
      nextRenewal: data.nextRenewal ? new Date(data.nextRenewal) : new Date(),
      tenantId,
      documents: documents.length > 0 ? documents : undefined,
      notes: notes.length > 0 ? JSON.stringify(notes) : undefined,
    };
    
    mutation.mutate({
      ...payload,
      id: subscription?.id || subscription?._id, // Include the subscription id
      startDate: payload.startDate instanceof Date ? payload.startDate.toISOString() : String(payload.startDate),
      nextRenewal: payload.nextRenewal instanceof Date ? payload.nextRenewal.toISOString() : String(payload.nextRenewal),
      effectiveDate: effectiveDate, // Add effective date as ISO string
    } as any);
  };
  
  // Handle department selection
  const handleDepartmentChange = (departmentName: string, checked: boolean) => {
    // If Company Level is selected, show only Company Level
    if (departmentName === 'Company Level' && checked) {
      setSelectedDepartments(['Company Level']);
      form.setValue("departments", ['Company Level']);
      return;
    }
    
    // If unchecking Company Level, uncheck all
    if (departmentName === 'Company Level' && !checked) {
      setSelectedDepartments([]);
      form.setValue("departments", []);
      return;
    }
    
    // When selecting other departments, remove Company Level if it exists
    if (checked && selectedDepartments.includes('Company Level')) {
      setSelectedDepartments([departmentName]);
      form.setValue("departments", [departmentName]);
      return;
    }
    
    const newSelectedDepartments = checked
      ? [...selectedDepartments, departmentName]
      : selectedDepartments.filter(dept => dept !== departmentName);
    
    setSelectedDepartments(newSelectedDepartments);
    form.setValue("departments", newSelectedDepartments);
  };
  
  // Remove a department from the selected list
  const removeDepartment = (departmentName: string) => {
    const newSelectedDepartments = selectedDepartments.filter(dept => dept !== departmentName);
    setSelectedDepartments(newSelectedDepartments);
    form.setValue("departments", newSelectedDepartments);
  };
  
  // Removed popover open/close handler
  
  // Handle renewal logic
  const handleRenew = async () => {
    if (!endDate || !billingCycle) {
      toast({
        title: "Cannot Renew",
        description: "Please ensure both end date and billing cycle are set",
        variant: "destructive",
      });
      return;
    }

    // Check if renewal is allowed based on dates
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    
    const nextRenewalDate = new Date(endDate);
    nextRenewalDate.setHours(0, 0, 0, 0);
    
    // Calculate days until renewal
    const daysUntilRenewal = Math.ceil((nextRenewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get commitment cycle to determine early renewal window
    const commitmentCycle = (billingCycle || '').toLowerCase();
    let maxDaysBeforeRenewal = 0;
    let cycleLabel = '';
    
    if (commitmentCycle === 'yearly') {
      maxDaysBeforeRenewal = 90; // 3 months for yearly
      cycleLabel = '3 months (90 days)';
    } else if (commitmentCycle === 'monthly') {
      maxDaysBeforeRenewal = 10; // 10 days for monthly
      cycleLabel = '10 days';
    } else if (commitmentCycle === 'quarterly') {
      maxDaysBeforeRenewal = 30; // 1 month for quarterly
      cycleLabel = '30 days';
    } else if (commitmentCycle === 'weekly') {
      maxDaysBeforeRenewal = 2; // 2 days for weekly
      cycleLabel = '2 days';
    } else {
      maxDaysBeforeRenewal = 30; // Default 30 days for other cycles
      cycleLabel = '30 days';
    }
    
    // If next renewal date is in the future and beyond the allowed early renewal window
    if (daysUntilRenewal > maxDaysBeforeRenewal) {
      const earliestRenewalDate = new Date(nextRenewalDate);
      earliestRenewalDate.setDate(earliestRenewalDate.getDate() - maxDaysBeforeRenewal);
      
      setErrorDialog({
        show: true,
        message: `Subscription can only be renewed within ${cycleLabel} before the renewal date. Next renewal is on ${formatDate(endDate)}. You can renew starting from ${formatDate(earliestRenewalDate.toISOString().split('T')[0])}.`
      });
      return;
    }
    
    // If we reach here, we're within the allowed early renewal window, so allow the renewal
    // (No need to check if nextRenewalDate > today because we're within the allowed window)

    // Skip effective date dialog and proceed directly with renewal
    setIsRenewing(true);
    setRenewalConfirmDialog({show: true});
  };

  const handleConfirmRenewal = async () => {
    setRenewalConfirmDialog({show: false});
    setIsRenewing(true);
    
    try {
      // Always recalculate dates based on current endDate and billingCycle
      const { newStartDate, newEndDate } = calculateRenewalDates(endDate, billingCycle);
      
      // Update local state
      setStartDate(newStartDate);
      setEndDate(newEndDate);
      // IMPORTANT: Do NOT update initialDate - it should remain as the original start date
      // initialDate represents when the subscription was first created, not when it was renewed
      
      // Update form values
      form.setValue('startDate', newStartDate);
      form.setValue('nextRenewal', newEndDate);
      
      // Prepare payload for API - include all fields including lcyAmount and effectiveDate
      const formValues = form.getValues();
      // Preserve original initial date (never update on renew)
      const originalInitialDate = savedInitialDateRef.current || initialDate;
      // Always get tenantId from context or user info
      const tenantId = String((window as any).currentTenantId || (window as any).user?.tenantId || "");
      const taxAmountNum = taxAmount !== "" ? parseFloat(taxAmount) : 0;
      const totalAmountInclTaxNum = totalAmountInclTax !== "" ? parseFloat(totalAmountInclTax) : 0;
      const payload = {
        ...formValues,
        initialDate: originalInitialDate,
        startDate: newStartDate,
        nextRenewal: newEndDate,
        effectiveDate: effectiveDate, // Add effective date for renewal
        amount:
          formValues.amount !== undefined && formValues.amount !== ""
            ? Number(formValues.amount)
            : undefined,
        totalAmount: formValues.totalAmount !== undefined && formValues.totalAmount !== ""
            ? Number(formValues.totalAmount)
            : undefined,
        qty: formValues.qty !== undefined && formValues.qty !== ""
            ? Number(formValues.qty)
            : undefined,
        lcyAmount: lcyAmount !== "" ? Number(lcyAmount) : undefined,
        taxAmount: isNaN(taxAmountNum) ? 0 : taxAmountNum,
        totalAmountInclTax: isNaN(totalAmountInclTaxNum) ? 0 : totalAmountInclTaxNum,
        tenantId,
      };
      
      // Save to backend - the backend will create the history record
      const subId = subscription?.id;
      if (subId) {
        // Ensure subId is a valid ObjectId string
        const validSubscriptionId = typeof subId === 'string' && /^[a-f\d]{24}$/i.test(subId)
          ? subId
          : (subId?.toString?.() || "");
        await apiRequest("PUT", `/api/subscriptions/${validSubscriptionId}`, payload);
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/history"] });
        
        toast({
          title: "Subscription Renewed",
          description: `Subscription renewed from ${formatDate(newStartDate)} to ${formatDate(newEndDate)}`,
          variant: "success",
        });
        // Notify parent/card page to update dates
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('subscription-renewed', {
            detail: {
              id: subId,
              startDate: newStartDate,
              nextRenewal: newEndDate
            }
          }));
        }
        // Keep modal open - stay on card page after renewal
      }
    } catch (error) {
      console.error("Renewal error:", error);
      toast({
        title: "Renewal Failed",
        description: "Failed to renew subscription. Please try again.",
        className: "bg-white border border-red-500 text-red-700 font-semibold shadow-lg",
      });
    } finally {
      setIsRenewing(false);
    }
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
        title: "Error",
        description: "Department already exists",
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
      // If no error thrown, consider success
      await refetchDepartments();
      // Add the new department to selected departments
      const updatedDepartments = [...selectedDepartments, newDepartmentName.trim()];
      setSelectedDepartments(updatedDepartments);
      form.setValue('departments', updatedDepartments);
      form.setValue('department', JSON.stringify(updatedDepartments));
      setNewDepartmentName('');
      setNewDepartmentHead('');
      setNewDepartmentEmail('');
      setNewDepartmentEmailError('');
      setDepartmentModal({ show: false });
      
      toast({
        title: "Success",
        description: "Department added successfully",
        variant: "success",
      });
    } catch (error) {
      console.error('Error adding department:', error);
      toast({
        title: "Error",
        description: "Failed to add department",
        variant: "destructive",
      });
    }
  };

  // Handle adding new category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      await apiRequest(
        "POST",
        "/api/company/categories",
        { name: newCategoryName.trim() }
      );
      
      // If no error thrown, consider success
      await refetchCategories();
      // Select the new category
      form.setValue('category', newCategoryName.trim());
      setNewCategoryName('');
      setCategoryModal({ show: false });
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  // Handle adding new payment method
  const handleAddPaymentMethod = async () => {
    if (!newPaymentMethodName.trim()) return;
    
    // Prevent multiple submissions
    if (isCreatingPaymentMethod) return;
    
    // Check for duplicate payment method name
    const duplicateName = paymentMethods.find(
      method => method.name?.toLowerCase().trim() === newPaymentMethodName.toLowerCase().trim() ||
                method.title?.toLowerCase().trim() === newPaymentMethodName.toLowerCase().trim()
    );
    
    if (duplicateName) {
      setValidationErrorMessage(`A payment method with the name "${newPaymentMethodName.trim()}" already exists. Please use a different name.`);
      setValidationErrorOpen(true);
      return;
    }
    
    // Validate expiry date is not in the past
    if (newPaymentMethodExpiresAt) {
      const [year, month] = newPaymentMethodExpiresAt.split('-');
      const expiryDate = new Date(parseInt(year), parseInt(month) - 1); // month is 0-indexed
      const today = new Date();
      today.setDate(1); // Set to first day of current month for comparison
      today.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        setValidationErrorMessage("Card expiry date cannot be in the past");
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
        icon: newPaymentMethodCardImage
      };
      
      console.log('Creating payment method with data:', paymentData);
      console.log('Owner being saved:', `"${paymentData.owner}"`);
      console.log('Manager being saved:', `"${paymentData.manager}"`);
      console.log('Owner length:', paymentData.owner.length);
      console.log('Manager length:', paymentData.manager.length);
      
      await apiRequest(
        "POST",
        "/api/payment",
        paymentData
      );
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/payment'] });
      
      // Select the new payment method and close modal immediately
      form.setValue('paymentMethod', newPaymentMethodName.trim());
      setPaymentMethodModal({ show: false });
      
      // Clear form fields
      setNewPaymentMethodName('');
      setNewPaymentMethodType('');
      setNewPaymentMethodOwner('');
      setNewPaymentMethodManagedBy('');
      setNewPaymentMethodFinancialInstitution('');
      setNewPaymentMethodLast4Digits('');
      setNewPaymentMethodExpiresAt('');
      setNewPaymentMethodCardImage('visa');
    } catch (error) {
      console.error('Error adding payment method:', error);
    } finally {
      setIsCreatingPaymentMethod(false);
    }
  };

  // Handle adding new owner
  const handleAddOwner = async () => {
    if (!newOwnerName.trim() || !newOwnerEmail.trim()) return;
    
    // Validate email
    const emailValidation = validateEmail(newOwnerEmail.trim());
    if (!emailValidation.valid) {
      setNewOwnerEmailError(emailValidation.error || 'Invalid email address');
      toast({
        title: "Invalid Email",
        description: emailValidation.error || 'Please enter a valid email address',
        variant: "destructive",
      });
      return;
    }
    
    // Validate department is selected
    if (!newOwnerDepartment) {
      toast({
        title: "Department Required",
        description: "Please select a department",
        variant: "destructive",
      });
      return;
    }
    
    // Check for duplicate name
    const nameExists = employeesRaw.some((emp: any) => 
      emp.name?.toLowerCase().trim() === newOwnerName.trim().toLowerCase()
    );
    
    if (nameExists) {
      toast({
        title: "Error",
        description: "An employee with this name already exists",
        variant: "destructive",
      });
      return;
    }
    
    // Check for duplicate email
    const emailExists = employeesRaw.some((emp: any) => 
      emp.email?.toLowerCase() === newOwnerEmail.trim().toLowerCase()
    );
    
    if (emailExists) {
      toast({
        title: "Error",
        description: "An employee with this email already exists",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await apiRequest(
        "POST",
        "/api/employees",
        { 
          name: newOwnerName.trim(),
          email: newOwnerEmail.trim(),
          role: newOwnerRole,
          status: newOwnerStatus,
          department: newOwnerDepartment
        }
      );
      
      // If no error thrown, consider success
      await refetchEmployees();
      // Select the new owner
      form.setValue('owner', newOwnerName.trim());
      form.setValue('ownerEmail', newOwnerEmail.trim());
      setNewOwnerName('');
      setNewOwnerEmail('');
      setNewOwnerEmailError('');
      setNewOwnerRole('');
      setNewOwnerStatus('active'); // Reset to active for next time
      setNewOwnerDepartment('');
      setOwnerModal({ show: false });
      
      toast({
        title: "Success",
        description: "Employee added successfully",
        variant: "success",
      });
    } catch (error) {
      console.error('Error adding owner:', error);
      toast({
        title: "Error",
        description: "Failed to add employee. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // CSS for animations
  const animationStyles = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin {
      animation: spin 1s linear infinite;
    }
    
    /* Improved dropdown styles */
    .dropdown-content {
      background-color: white;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      z-index: 50;
      max-height: 300px;
      overflow-y: auto;
      overflow-x: hidden;

    .dropdown-content::-webkit-scrollbar {
      width: 8px;
      background: #f1f5f9;
      border-radius: 8px;
    }
    .dropdown-content::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 8px;
    }
    .dropdown-content::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    
    .dropdown-item {
      padding: 10px 16px 10px 36px;
      font-size: 14px;
      color: #334155;
      cursor: pointer;
      transition: all 0.15s ease;
      border-bottom: 1px solid #f1f5f9;
      position: relative;
    }
    
    .dropdown-item:last-child {
      border-bottom: none;
    }
    
    .dropdown-item:hover {
      background-color: #f1f5f9;
      color: #1e40af;
    }
    
    .dropdown-item.selected {
      background-color: #eff6ff;
      color: #1d4ed8;
      font-weight: 500;
    }
    
    .dropdown-item.disabled {
      color: #94a3b8;
      cursor: not-allowed;
    }
    
    .dropdown-item.disabled:hover {
      background-color: transparent;
    }
    
    /* Fix checkmark positioning */
    .dropdown-item > span.absolute.left-2 {
      left: 12px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
    }
    
    /* Custom checkmark for selected items */
    .dropdown-item.selected::before {
      content: "✓";
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #1d4ed8;
      font-weight: bold;
    }
    
    /* Hide default checkmark when using custom one */
    .dropdown-item.selected > span.absolute.left-2 {
      display: none;
    }
  `;
  
  return (
    <>
      <style>{animationStyles}</style>
      <Dialog open={open} onOpenChange={(v) => { if (!v) setIsFullscreen(false); onOpenChange(v); }}>
        <DialogContent className={`${isFullscreen ? 'max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh]' : 'max-w-5xl min-w-[400px] max-h-[85vh]'} rounded-2xl border-0 shadow-2xl p-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 transition-[width,height] duration-300 font-inter flex flex-col overflow-hidden`}> 
          <DialogHeader className="sticky top-0 z-50 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white p-6 rounded-t-2xl flex flex-row items-center shadow-sm">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {companyLogo && (
                <img 
                  src={companyLogo} 
                  alt="Company logo" 
                  className="w-12 h-12 object-contain rounded-lg"
                  onError={(e) => {
                    // Hide if logo fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="flex items-center gap-4 flex-wrap">
                <DialogTitle className="text-xl font-bold tracking-tight text-white">
                  {isEditing ? (subscription?.serviceName || 'Edit Subscription') : 'Subscription'}
                </DialogTitle>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold tracking-wide ${
                    subscription?.billingCycle === 'trial' 
                      ? 'bg-purple-500 text-white' 
                      : status === 'Active' 
                        ? 'bg-emerald-500 text-white' 
                        : status === 'Cancelled' 
                          ? 'bg-rose-500 text-white' 
                          : 'bg-orange-500 text-white'
                  }`}
                >
                  {subscription?.billingCycle === 'trial' ? 'Trial' : status}
                </span>
              </div>
            </div>
            <div className="flex gap-3 items-center ml-auto mr-6">
              <Button
                type="button"
                variant="outline"
                className="bg-white text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 hover:!text-indigo-700 font-medium px-4 py-2 rounded-lg transition-all duration-200 min-w-[80px] border-indigo-200 shadow-sm"
                onClick={() => {
                  const subscriptionId = subscription?._id || subscription?.id;
                  const serviceName = subscription?.serviceName || subscription?.name || 'Subscription';
                  
                  // Check if subscription has been saved
                  if (!subscriptionId) {
                    setSaveDraftRequiredDialog({show: true});
                    return;
                  }
                  
                  window.location.href = `/subscription-user?id=${subscriptionId}&name=${encodeURIComponent(serviceName)}`;
                }}
              >
                User
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-white text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 hover:!text-indigo-700 font-medium px-4 py-2 rounded-lg transition-all duration-200 min-w-[80px] flex items-center gap-2 border-indigo-200 shadow-sm"
                onClick={() => setShowDocumentDialog(true)}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload
              </Button>
              {/* Updated History Button - Always visible but disabled when adding new subscription */}
              <Button
                type="button"
                variant="outline"
                className={`bg-white text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 hover:!text-indigo-700 font-medium px-4 py-2 rounded-lg transition-all duration-200 min-w-[80px] flex items-center gap-2 border-indigo-200 shadow-sm ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (isEditing && subscription?.id) {
                    // Only pass the ID, removing serviceName to simplify filtering
                    window.location.href = `/subscription-history?id=${subscription.id}`;
                  }
                }}
                disabled={!isEditing}
                title={!isEditing ? "History is available only for existing subscriptions" : undefined}
              >
                <History className="h-4 w-4" />
                Audit Log
              </Button>
              <Button
                type="button"
                variant="outline"
                title={isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                className="bg-white text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 hover:!text-indigo-700 font-medium px-3 py-2 rounded-lg transition-all duration-200 h-10 w-10 p-0 flex items-center justify-center border-indigo-200 shadow-sm"
                onClick={() => setIsFullscreen(f => !f)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 bg-white/60 backdrop-blur-sm">
              {/* Professional Section Header */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent tracking-tight mb-2">Subscription Details</h2>
                <div className="h-px bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 mt-4"></div>
              </div>
              
              <div className={`grid gap-6 mb-8 ${isFullscreen ? 'grid-cols-1 md:grid-cols-5 lg:grid-cols-7' : 'grid-cols-1 md:grid-cols-4'}`}>
                {/* Static Fields */}
                <FormField
                  control={form.control}
                  name="serviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Service Name</FormLabel>
                      <FormControl>
                        <Input 
                          className={`w-full border-gray-300 rounded-lg p-3 text-base font-medium bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 ${serviceNameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                          {...field}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            
                            // Check if user is typing in all caps (2+ consecutive uppercase letters)
                            const isTypingAllCaps = /[A-Z]{2,}/.test(inputValue);
                            
                            // If typing all caps, keep it as is. Otherwise, capitalize first letter of each word
                            let finalValue;
                            if (isTypingAllCaps) {
                              // User is intentionally typing in caps, keep it
                              finalValue = inputValue;
                            } else {
                              // Auto-capitalize first letter of each word
                              finalValue = inputValue
                                .split(' ')
                                .map(word => {
                                  if (word.length === 0) return word;
                                  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                                })
                                .join(' ');
                            }
                            
                            field.onChange(finalValue);
                            // Clear any existing error when typing
                            if (serviceNameError) {
                              setServiceNameError("");
                            }
                          }}
                          onBlur={(e) => {
                            // Validate uniqueness only when leaving the field
                            validateServiceName(e.target.value);
                          }}
                        />
                      </FormControl>
                      {serviceNameError && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {serviceNameError}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => {
                    const [vendorOpen, setVendorOpen] = useState(false);
                    const [vendorSearch, setVendorSearch] = useState('');
                    const vendorDropdownRef = useRef<HTMLDivElement>(null);
                    useEffect(() => {
                      if (!vendorOpen) return;
                      function handleClickOutside(event: MouseEvent) {
                        if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(event.target as Node)) {
                          setVendorOpen(false);
                          setVendorSearch('');
                        }
                      }
                      document.addEventListener('mousedown', handleClickOutside);
                      return () => {
                        document.removeEventListener('mousedown', handleClickOutside);
                      };
                    }, [vendorOpen]);

                    const normalizedVendorSearch = vendorSearch.trim().toLowerCase();
                    const filteredVendors = normalizedVendorSearch
                      ? VENDOR_LIST.filter(v => v.toLowerCase().includes(normalizedVendorSearch))
                      : VENDOR_LIST;
                    
                    return (
                      <FormItem className="relative" ref={vendorDropdownRef}>
                        <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Vendor</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              className="w-full border-gray-300 rounded-lg p-3 pr-10 text-base font-medium bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 cursor-pointer" 
                              value={vendorOpen ? vendorSearch : (field.value || '')}
                              onChange={(e) => {
                                const v = e.target.value;
                                setVendorSearch(v);
                                // Allow custom vendor names not in the predefined list
                                field.onChange(v);
                                if (!vendorOpen) setVendorOpen(true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  setVendorOpen(false);
                                  setVendorSearch('');
                                  (e.currentTarget as HTMLInputElement).blur();
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setVendorOpen(false);
                                  setVendorSearch('');
                                  (e.currentTarget as HTMLInputElement).blur();
                                }
                              }}
                              onFocus={() => {
                                setVendorSearch(field.value || '');
                                setVendorOpen(true);
                              }}
                              onClick={() => {
                                setVendorSearch(field.value || '');
                                setVendorOpen(true);
                              }}
                            />
                            <ChevronDown
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                              onClick={() => {
                                if (!vendorOpen) setVendorSearch(field.value || '');
                                setVendorOpen(!vendorOpen);
                                if (vendorOpen) setVendorSearch('');
                              }}
                            />
                            {vendorOpen && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                                {filteredVendors.map((vendor, index) => (
                                  <div
                                    key={index}
                                    className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                    onClick={() => {
                                      // If already selected, clear it
                                      if (field.value === vendor) {
                                        field.onChange('');
                                        setVendorOpen(false);
                                        setVendorSearch('');
                                        return;
                                      }
                                      field.onChange(vendor);
                                      setVendorOpen(false);
                                      setVendorSearch('');
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 text-blue-600 ${field.value === vendor ? "opacity-100" : "opacity-0"}`}
                                    />
                                    <span className="font-normal">{vendor}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => {
                    const [currencyOpen, setCurrencyOpen] = useState(false);
                    const [currencySearch, setCurrencySearch] = useState('');
                    const currencyDropdownRef = useRef<HTMLDivElement>(null);
                    useEffect(() => {
                      if (!currencyOpen) return;
                      function handleClickOutside(event: MouseEvent) {
                        if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(event.target as Node)) {
                          setCurrencyOpen(false);
                          setCurrencySearch('');
                        }
                      }
                      document.addEventListener('mousedown', handleClickOutside);
                      return () => {
                        document.removeEventListener('mousedown', handleClickOutside);
                      };
                    }, [currencyOpen]);
                    const allCurrencies = currencies && currencies.length > 0 ? currencies : [];

                    const normalizedCurrencySearch = currencySearch.trim().toLowerCase();
                    const filtered = normalizedCurrencySearch
                      ? allCurrencies.filter((curr: any) => curr.code?.toLowerCase().includes(normalizedCurrencySearch))
                      : allCurrencies;
                    return (
                      <FormItem className="relative" ref={currencyDropdownRef}>
                        <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Currency</FormLabel>
                        <div className="relative">
                          <Input
                            value={currencyOpen ? currencySearch : (field.value || '')}
                            className="w-full border-gray-300 rounded-lg p-3 pr-10 text-base font-medium bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 cursor-pointer"
                            onChange={(e) => {
                              setCurrencySearch(e.target.value);
                              if (!currencyOpen) setCurrencyOpen(true);
                            }}
                            onFocus={() => {
                              setCurrencySearch(field.value || '');
                              setCurrencyOpen(true);
                            }}
                            onClick={() => {
                              setCurrencySearch(field.value || '');
                              setCurrencyOpen(true);
                            }}
                          />
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                            onClick={() => {
                              if (!currencyOpen) setCurrencySearch(field.value || '');
                              setCurrencyOpen(!currencyOpen);
                              if (currencyOpen) setCurrencySearch('');
                            }}
                          />
                        </div>
                        {currencyOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            <div className="max-h-60 overflow-auto custom-scrollbar">
                              {filtered.length > 0 ? (
                                filtered.map((curr: any) => (
                                  <div
                                    key={curr.code}
                                    className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                    onClick={() => {
                                      // If already selected, clear it
                                      if (field.value === curr.code) {
                                        field.onChange('');
                                        setCurrencyOpen(false);
                                        setCurrencySearch('');
                                        return;
                                      }
                                      field.onChange(curr.code);
                                      setCurrencyOpen(false);
                                      setCurrencySearch('');
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 text-blue-600 ${field.value === curr.code ? "opacity-100" : "opacity-0"}`}
                                    />
                                    <span className="font-normal">{curr.code}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="dropdown-item disabled text-gray-400">No currencies configured</div>
                              )}
                            </div>
                            <div className="sticky bottom-0 bg-white border-t">
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center"
                                onClick={() => window.location.href = '/configuration?tab=currency'}
                              >
                                + New
                              </button>
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                          <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Amount per unit</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            max="100000000"
                            className="w-full border-gray-300 rounded-lg p-3 text-base text-right font-semibold bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200" 
                            value={field.value}
                            onKeyDown={(e) => {
                              // Prevent 'e', 'E', '+', '-' keys
                              if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                                e.preventDefault();
                              }
                            }}
                            onChange={e => {
                              // Limit to 2 decimal places
                              let val = e.target.value;
                              if (val && val.includes('.')) {
                                const [intPart, decPart] = val.split('.');
                                val = intPart + '.' + decPart.slice(0,2);
                              }

                              // Clamp to max 10Cr
                              const numVal = parseFloat(val);
                              if (!isNaN(numVal) && numVal > 100000000) {
                                val = String(100000000);
                              }
                              field.onChange(val);
                              
                              // Calculate total amount = qty * amount
                              const qtyValue = form.getValues('qty');
                              const qty = qtyValue ? (typeof qtyValue === 'number' ? qtyValue : parseInt(qtyValue.toString())) : 0;
                              const amount = parseFloat(val) || 0;
                              const total = qty * amount;
                              form.setValue('totalAmount', total > 0 ? total.toFixed(2) : "");
                              setTotalAmount(total > 0 ? total.toFixed(2) : "");
                            }}
                            onBlur={e => {
                              // Format to 2 decimal places on blur
                              let value = parseFloat(e.target.value);
                              if (!isNaN(value)) {
                                // Clamp to max 10Cr
                                value = Math.min(100000000, Math.max(0, value));
                                field.onChange(value.toFixed(2));
                                
                                // Recalculate total amount
                                const qtyValue = form.getValues('qty');
                                const qty = qtyValue ? (typeof qtyValue === 'number' ? qtyValue : parseInt(qtyValue.toString())) : 0;
                                const total = qty * value;
                                form.setValue('totalAmount', total > 0 ? total.toFixed(2) : "");
                                setTotalAmount(total > 0 ? total.toFixed(2) : "");
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="qty"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="1" 
                            min="1"
                            placeholder=""
                            className="w-full border-gray-300 rounded-lg p-3 text-base text-right font-semibold bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200" 
                            value={field.value || ""}
                            onKeyDown={(e) => {
                              // Prevent 'e', 'E', '+', '-', '.' keys (quantity should be whole numbers only)
                              if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-' || e.key === '.') {
                                e.preventDefault();
                              }
                            }}
                            onChange={e => {
                              const qtyValue = e.target.value ? parseInt(e.target.value) : "";
                              field.onChange(qtyValue);
                              
                              // Calculate total amount = qty * amount
                              const qty = typeof qtyValue === 'number' ? qtyValue : 0;
                              const amount = parseFloat(form.getValues('amount') as string) || 0;
                              const total = qty * amount;
                              form.setValue('totalAmount', total > 0 ? total.toFixed(2) : "");
                              setTotalAmount(total > 0 ? total.toFixed(2) : "");
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Total Amount excl Tax */}
                <div className="form-item">
                  <label className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">
                    Total Amount excl Tax
                  </label>
                  <div className="relative">
                    <Input 
                      type="text"
                      value={totalAmount}
                      readOnly
                      className="w-full border-gray-300 rounded-lg p-3 text-base text-right font-semibold bg-gray-50 text-gray-600 shadow-sm"
                      placeholder=""
                    />
                  </div>
                </div>
                {/* Tax Amount */}
                <div className="form-item">
                  <label className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">
                    Tax Amount
                  </label>
                  <div className="relative">
                    <Input 
                      type="number"
                      min="0"
                      step="1"
                      value={taxAmount}
                      onKeyDown={e => {
                        // Prevent 'e', 'E', '+', '-', '.' keys
                        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-' || e.key === '.') {
                          e.preventDefault();
                        }
                      }}
                      onChange={e => {
                        // Only allow integer values
                        let val = e.target.value.replace(/[^0-9]/g, '');
                        setTaxAmount(val);
                      }}
                      className="w-full border-gray-300 rounded-lg p-3 text-base text-right font-semibold bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                      placeholder=""
                    />
                  </div>
                </div>
                {/* Total Amount Incl Tax */}
                <div className="form-item">
                  <label className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">
                    Total Amount Incl Tax
                  </label>
                  <div className="relative">
                    <Input 
                      type="text"
                      value={totalAmountInclTax}
                      readOnly
                      className="w-full border-gray-300 rounded-lg p-3 text-base text-right font-semibold bg-gray-50 text-gray-600 shadow-sm"
                      placeholder=""
                    />
                  </div>
                </div>
                {/* LCY Amount Field - Read-only calculated field */}
                <div className="form-item">
                  <label className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">
                    LCY Amount ({companyInfo?.defaultCurrency || 'Local Currency'})
                  </label>
                  <div className="relative">
                    <Input 
                      type="text"
                      value={lcyAmount}
                      readOnly
                      className="w-full border-gray-300 rounded-lg p-3 text-base text-right font-semibold bg-gray-50 text-gray-600 shadow-sm"
                      placeholder=""
                    />
                    {form.watch('currency') && form.watch('currency') !== companyInfo?.defaultCurrency && lcyAmount && (
                      <div className="text-xs text-gray-500 mt-2 font-medium">
                        1 {companyInfo?.defaultCurrency || 'LCY'} = {currencies.find((c: any) => c.code === form.watch('currency'))?.exchangeRate || 'Not set'} {form.watch('currency')}
                      </div>
                    )}
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="billingCycle"
                  render={({ field }) => {
                    const [cycleOpen, setCycleOpen] = useState(false);
                    const [cycleSearch, setCycleSearch] = useState('');
                    const cycleDropdownRef = useRef<HTMLDivElement>(null);
                    useEffect(() => {
                      if (!cycleOpen) return;
                      function handleClickOutside(event: MouseEvent) {
                        if (cycleDropdownRef.current && !cycleDropdownRef.current.contains(event.target as Node)) {
                          setCycleOpen(false);
                          setCycleSearch('');
                        }
                      }
                      document.addEventListener('mousedown', handleClickOutside);
                      return () => {
                        document.removeEventListener('mousedown', handleClickOutside);
                      };
                    }, [cycleOpen]);
                    const options = [
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'yearly', label: 'Yearly' },
                      { value: 'quarterly', label: 'Quarterly' },
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'trial', label: 'Trial' },
                      { value: 'pay-as-you-go', label: 'Pay-as-you-go' },
                    ];

                    const normalizedCycleSearch = cycleSearch.trim().toLowerCase();
                    const filteredOptions = normalizedCycleSearch
                      ? options.filter(opt => opt.label.toLowerCase().includes(normalizedCycleSearch) || opt.value.toLowerCase().includes(normalizedCycleSearch))
                      : options;
                    return (
                      <FormItem className="relative" ref={cycleDropdownRef}>
                        <FormLabel className="block text-sm font-medium text-slate-700">Commitment cycle</FormLabel>
                        <div className="relative">
                          <Input
                            value={cycleOpen ? cycleSearch : (field.value || '')}
                            className="w-full border-slate-300 rounded-lg p-2 text-base cursor-pointer"
                            onChange={(e) => {
                              setCycleSearch(e.target.value);
                              if (!cycleOpen) setCycleOpen(true);
                            }}
                            onFocus={() => {
                              setCycleSearch(field.value || '');
                              setCycleOpen(true);
                            }}
                            onClick={() => {
                              setCycleSearch(field.value || '');
                              setCycleOpen(true);
                            }}
                          />
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                            onClick={() => {
                              if (!cycleOpen) setCycleSearch(field.value || '');
                              setCycleOpen(!cycleOpen);
                              if (cycleOpen) setCycleSearch('');
                            }}
                          />
                        </div>
                        {cycleOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto custom-scrollbar">
                            {filteredOptions.map(opt => (
                              <div
                                key={opt.value}
                                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                onClick={() => {
                                  setBillingCycle(opt.value);
                                  field.onChange(opt.value);
                                  setCycleOpen(false);
                                  setCycleSearch('');
                                  if (autoRenewal) {
                                    const s = form.watch("startDate");
                                    if (s) {
                                      const nextDate = calculateEndDate(s, opt.value);
                                      form.setValue("nextRenewal", nextDate);
                                      setEndDate(nextDate);
                                    }
                                  }
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 text-blue-600 ${field.value === opt.value ? "opacity-100" : "opacity-0"}`}
                                />
                                <span className="font-normal">{opt.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {/* Payment frequency dropdown */}
                <FormField
                  control={form.control}
                  name="paymentFrequency"
                  render={({ field }) => {
                    // Define cycle hierarchy (lower index = shorter period)
                    const cycleHierarchy = ['weekly', 'monthly', 'quarterly', 'yearly'];
                    const commitmentCycle = (billingCycle || '').toLowerCase();
                    
                    // For Trial and Pay-as-you-go, don't show any payment frequency options
                    const isTrialOrPayAsYouGo = commitmentCycle === 'trial' || commitmentCycle === 'pay-as-you-go';
                    
                    // Get the index of the commitment cycle
                    const commitmentIndex = cycleHierarchy.indexOf(commitmentCycle);
                    
                    // Filter frequencies: only show options <= commitment cycle
                    const availableFrequencies = commitmentIndex >= 0 
                      ? cycleHierarchy.slice(0, commitmentIndex + 1)
                      : []; // Empty for trial and pay-as-you-go
                    
                    return (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">Payment Frequency</FormLabel>
                        <Select 
                          value={field.value || ""} 
                          onValueChange={field.onChange}
                          disabled={isTrialOrPayAsYouGo}
                        >
                          <SelectTrigger className={`w-full border-slate-300 rounded-lg p-2 text-base ${isTrialOrPayAsYouGo ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
                            <SelectValue placeholder={isTrialOrPayAsYouGo ? "N/A" : "Select"} />
                          </SelectTrigger>
                          <SelectContent className="dropdown-content">
                            {!isTrialOrPayAsYouGo && availableFrequencies.includes('weekly') && (
                              <SelectItem value="weekly" className="dropdown-item">Weekly</SelectItem>
                            )}
                            {!isTrialOrPayAsYouGo && availableFrequencies.includes('monthly') && (
                              <SelectItem value="monthly" className="dropdown-item">Monthly</SelectItem>
                            )}
                            {!isTrialOrPayAsYouGo && availableFrequencies.includes('quarterly') && (
                              <SelectItem value="quarterly" className="dropdown-item">Quarterly</SelectItem>
                            )}
                            {!isTrialOrPayAsYouGo && availableFrequencies.includes('yearly') && (
                              <SelectItem value="yearly" className="dropdown-item">Yearly</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => {
                    // Merge database categories with default suggestions
                    const dbCategories = Array.isArray(categories) 
                      ? categories.filter(cat => cat.visible).map(cat => cat.name)
                      : [];
                    
                    // Combine and deduplicate
                    const allCategories = Array.from(new Set([...dbCategories, ...DEFAULT_CATEGORY_SUGGESTIONS]));

                    const normalizedSearch = categorySearch.trim().toLowerCase();
                    const filtered = normalizedSearch
                      ? allCategories.filter(cat => cat.toLowerCase().includes(normalizedSearch))
                      : allCategories;
                    
                    const shouldShowDropdown = categoryOpen && filtered.length > 0;

                    // Unified dropdown UI for Category field
                    return (
                      <FormItem className="relative" ref={categoryDropdownRef}>
                        <FormLabel className="block text-sm font-medium text-slate-700">Category</FormLabel>
                        <div className="relative">
                          <Input
                            value={categoryOpen ? categorySearch : (field.value || '')}
                            className="w-full border-slate-300 rounded-lg p-2 pr-10 text-base focus:border-blue-500 focus:ring-blue-500 cursor-pointer"
                            disabled={categoriesLoading}
                            onChange={(e) => {
                              setCategorySearch(e.target.value);
                              if (!categoryOpen) setCategoryOpen(true);
                            }}
                            onFocus={() => {
                              setCategorySearch(field.value || '');
                              setCategoryOpen(true);
                            }}
                            onClick={() => {
                              setCategorySearch(field.value || '');
                              setCategoryOpen(true);
                            }}
                            autoComplete="off"
                          />
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                            onClick={() => {
                              if (!categoryOpen) setCategorySearch(field.value || '');
                              setCategoryOpen(!categoryOpen);
                              if (categoryOpen) setCategorySearch('');
                            }}
                          />
                        </div>
                        {shouldShowDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            <div className="max-h-40 overflow-y-scroll custom-scrollbar">
                              {filtered.map(catName => (
                                <div
                                  key={catName}
                                  className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${field.value === catName ? 'bg-blue-50 text-blue-700' : ''}`}
                                  onClick={() => {
                                    // If already selected, clear it
                                    if (field.value === catName) {
                                      field.onChange('');
                                      setCategoryOpen(false);
                                      setCategorySearch('');
                                      return;
                                    }
                                    field.onChange(catName);
                                    setCategoryOpen(false);
                                    setCategorySearch('');
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 text-blue-600 ${field.value === catName ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                  <span className="font-normal">{catName}</span>
                                </div>
                              ))}
                            </div>
                            <div
                              className="sticky bottom-0 bg-white font-medium border-t border-gray-200 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
                              style={{ minHeight: '40px', display: 'flex', alignItems: 'center' }}
                              onClick={() => {
                                setCategoryModal({ show: true });
                                setCategoryOpen(false);
                                setCategorySearch('');
                              }}
                            >
                              + New
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="departments"
                  render={() => {
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
                      <FormItem className="relative" ref={deptDropdownRef}>
                        <FormLabel className="block text-sm font-medium text-slate-700">Departments</FormLabel>
                        <div className="relative">
                          <div
                            className="w-full border border-slate-300 rounded-lg p-2 text-base h-[44px] flex items-center justify-start overflow-x-auto overflow-y-hidden bg-gray-50 cursor-pointer focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-200 scrollbar-hide"
                            onClick={() => setDeptOpen(true)}
                            tabIndex={0}
                            onFocus={() => setDeptOpen(true)}
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                          >
                            {selectedDepartments.length > 0 ? (
                              <div className="flex gap-1 flex-nowrap">
                                {selectedDepartments.map((dept) => (
                                  <Badge key={dept} variant="secondary" className="flex items-center gap-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 text-xs py-1 px-2 whitespace-nowrap flex-shrink-0">
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
                              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer flex-shrink-0"
                              onClick={(e) => { e.stopPropagation(); setDeptOpen(!deptOpen); }}
                            />
                          </div>
                        </div>
                        {selectedDepartments.includes('Company Level') && (
                          <p className="mt-1 text-xs text-slate-500">All departments are selected</p>
                        )}
                        {deptOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            <div className="max-h-60 overflow-auto custom-scrollbar">
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
                              {Array.isArray(departments) && departments.filter(dept => dept.visible).length === 0 && (
                                <div className="dropdown-item disabled text-gray-400">No departments found</div>
                              )}
                            </div>
                            <div
                              className="sticky bottom-0 bg-white font-medium border-t border-gray-200 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
                              style={{ minHeight: '40px', display: 'flex', alignItems: 'center' }}
                              onClick={() => setDepartmentModal({ show: true })}
                            >
                              + New
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {/* Payment Method field - now dynamic and mandatory */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => {
                    const allPaymentMethods = Array.isArray(paymentMethods)
                      ? paymentMethods.map(pm => pm.name)
                      : [];

                    const normalizedSearch = paymentMethodSearch.trim().toLowerCase();
                    const filtered = normalizedSearch
                      ? allPaymentMethods.filter(pm => pm.toLowerCase().includes(normalizedSearch))
                      : allPaymentMethods;
                    return (
                      <FormItem className="relative" ref={paymentMethodDropdownRef}>
                        <FormLabel className="block text-sm font-medium text-slate-700">
                          Payment Method <span className="text-red-500">*</span>
                        </FormLabel>
                        <div className="relative">
                          <Input
                            value={paymentMethodOpen ? paymentMethodSearch : (field.value || '')}
                            className="w-full border-slate-300 rounded-lg p-2 pr-10 text-base focus:border-blue-500 focus:ring-blue-500 cursor-pointer"
                            disabled={paymentMethodsLoading}
                            onChange={(e) => {
                              setPaymentMethodSearch(e.target.value);
                              if (!paymentMethodOpen) setPaymentMethodOpen(true);
                            }}
                            onFocus={() => {
                              setPaymentMethodSearch(field.value || '');
                              setPaymentMethodOpen(true);
                            }}
                            onClick={() => {
                              setPaymentMethodSearch(field.value || '');
                              setPaymentMethodOpen(true);
                            }}
                          />
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                            onClick={() => {
                              if (!paymentMethodOpen) setPaymentMethodSearch(field.value || '');
                              setPaymentMethodOpen(!paymentMethodOpen);
                              if (paymentMethodOpen) setPaymentMethodSearch('');
                            }}
                          />
                        </div>
                        {paymentMethodOpen && filtered.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto custom-scrollbar">
                            {filtered.map(pmName => (
                              <div
                                key={pmName}
                                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                onClick={() => {
                                  // If already selected, clear it
                                  if (field.value === pmName) {
                                    field.onChange('');
                                    setPaymentMethodOpen(false);
                                    setPaymentMethodSearch('');
                                    return;
                                  }
                                  field.onChange(pmName);
                                  setPaymentMethodOpen(false);
                                  setPaymentMethodSearch('');
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 text-blue-600 ${field.value === pmName ? "opacity-100" : "opacity-0"}`}
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
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    );
                  }}
                />

                {/* Owner field - dropdown of employees */}
                <FormField
                  control={form.control}
                  name="owner"
                  render={({ field }) => {
                    const [ownerOpen, setOwnerOpen] = useState(false);
                    const [ownerSearch, setOwnerSearch] = useState('');
                    const ownerDropdownRef = useRef<HTMLDivElement>(null);
                    useEffect(() => {
                      if (!ownerOpen) return;
                      function handleClickOutside(event: MouseEvent) {
                        if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(event.target as Node)) {
                          setOwnerOpen(false);
                          setOwnerSearch('');
                        }
                      }
                      document.addEventListener('mousedown', handleClickOutside);
                      return () => {
                        document.removeEventListener('mousedown', handleClickOutside);
                      };
                    }, [ownerOpen]);
                    const ownerOptions = employeesRaw.length > 0
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

                    const normalizedOwnerSearch = ownerSearch.trim().toLowerCase();
                    const filtered = normalizedOwnerSearch
                      ? ownerOptions.filter(opt => (opt.displayName || '').toLowerCase().includes(normalizedOwnerSearch))
                      : ownerOptions;
                    return (
                      <FormItem className="relative" ref={ownerDropdownRef}>
                        <FormLabel className="block text-sm font-medium text-slate-700">Owner</FormLabel>
                        <div className="relative">
                          <Input
                            value={ownerOpen ? ownerSearch : (field.value || '')}
                            className="w-full border-slate-300 rounded-lg p-2 pr-10 text-base cursor-pointer"
                            onChange={(e) => {
                              setOwnerSearch(e.target.value);
                              if (!ownerOpen) setOwnerOpen(true);
                            }}
                            onFocus={() => {
                              setOwnerSearch(field.value || '');
                              setOwnerOpen(true);
                            }}
                            onClick={() => {
                              setOwnerSearch(field.value || '');
                              setOwnerOpen(true);
                            }}
                          />
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                            onClick={() => {
                              if (!ownerOpen) setOwnerSearch(field.value || '');
                              setOwnerOpen(!ownerOpen);
                              if (ownerOpen) setOwnerSearch('');
                            }}
                          />
                        </div>
                        {ownerOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            <div className="max-h-60 overflow-auto custom-scrollbar">
                              {filtered.length > 0 ? (
                                filtered.map(opt => (
                                  <div
                                    key={opt.uniqueValue}
                                    className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                    onClick={() => {
                                      const value = opt.uniqueValue;
                                      if (value === "add-new-owner") {
                                        setOwnerModal({ show: true });
                                      } else {
                                        // If clicking on already selected item, clear it
                                        if (field.value === opt.uniqueValue || field.value === opt.name) {
                                          field.onChange('');
                                          form.setValue('ownerEmail', '');
                                          setOwnerOpen(false);
                                          setOwnerSearch('');
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
                                        if (emp?.email) {
                                          form.setValue('ownerEmail', emp.email);
                                        }
                                      }
                                      setOwnerOpen(false);
                                      setOwnerSearch('');
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 text-blue-600 ${field.value === opt.uniqueValue ? "opacity-100" : "opacity-0"}`}
                                    />
                                    <span className="font-normal">{opt.displayName}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="dropdown-item disabled text-gray-400">No owners found</div>
                              )}
                            </div>
                            <div
                              className="sticky bottom-0 bg-white font-medium border-t border-gray-200 pt-3 pb-2 text-blue-600 cursor-pointer px-3 hover:bg-blue-50 text-sm leading-5"
                              style={{ minHeight: '40px', display: 'flex', alignItems: 'center' }}
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
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {/* Owner Email field - free text to bypass lookup */}
                <FormField
                  control={form.control}
                  name="ownerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Owner Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          className="w-full border-slate-300 rounded-lg p-2 text-base bg-gray-100 cursor-not-allowed"
                          {...field}
                          readOnly
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Website field - moved beside Owner Email - expands based on URL length */}
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => {
                    // Calculate column span based on URL length
                    const urlLength = field.value?.length || 0;
                    const colSpan = urlLength > 40 ? 'md:col-span-2' : '';
                    
                    return (
                      <FormItem className={colSpan}>
                        <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Website</FormLabel>
                        <FormControl>
                          <div className="relative">
                            {field.value && !isEditingWebsite ? (
                              <>
                                <a
                                  href={field.value.startsWith('http') ? field.value : `https://${field.value}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full border border-gray-300 rounded-lg p-2 pr-10 text-sm font-normal bg-white shadow-sm hover:bg-gray-50 transition-all duration-200 text-indigo-600 hover:text-indigo-800 hover:underline block truncate"
                                  style={{ textAlign: 'left', minHeight: '40px', display: 'flex', alignItems: 'center' }}
                                  title={field.value}
                                >
                                  {field.value}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setIsEditingWebsite(true)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                                  title="Edit website"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                                    <path d="m15 5 4 4"></path>
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <Input 
                                type="url"
                                maxLength={200}
                                placeholder="https://example.com"
                                className={`w-full border-gray-300 rounded-lg p-2 text-sm font-normal bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 ${
                                  websiteURLError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50' : ''
                                }`}
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  // Clear error on change
                                  if (websiteURLError) {
                                    setWebsiteURLError('');
                                  }
                                }}
                                onBlur={() => {
                                  const url = field.value;
                                  if (url && url.trim()) {
                                    const validation = validateURL(url.trim());
                                    if (!validation.valid) {
                                      setWebsiteURLError(validation.error || 'Invalid URL');
                                    } else {
                                      setIsEditingWebsite(false);
                                    }
                                  } else {
                                    setIsEditingWebsite(false);
                                  }
                                }}
                                autoFocus={isEditingWebsite}
                              />
                            )}
                          </div>
                          {websiteURLError && (
                            <p className="text-sm text-red-600 mt-1">
                              {websiteURLError}
                            </p>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                
                {/* Dynamic Fields from Configuration - now rendered after all static fields */}
                {dynamicFields.length > 0 && (
                  <>
                    {dynamicFields.map((field) => (
                      <FormField
                        key={field.name}
                        control={form.control}
                        name={field.name as keyof FormData}
                        render={({ field: formField }) => (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">{field.name}</FormLabel>
                            <FormControl>
                              {field.type === 'number' ? (
                                <Input
                                  type="number"
                                  className="w-full border-slate-300 rounded-lg p-2 text-base"
                                  {...formField}
                                  value={
                                    typeof formField.value === "boolean"
                                      ? ""
                                      : formField.value === undefined
                                      ? ""
                                      : formField.value
                                  }
                                  
                                />
                              ) : (
                                <Input
                                  type="text"
                                  className="w-full border-slate-300 rounded-lg p-2 text-base"
                                  {...formField}
                                  value={
                                    typeof formField.value === "boolean" || Array.isArray(formField.value)
                                      ? ""
                                      : formField.value === undefined
                                      ? ""
                                      : formField.value
                                  }
                                  
                                />
                              )}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </>
                )}
              </div>
              {/* Professional Renewal Section Header */}
              <div className="mt-10 mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent tracking-tight">Renewal Information</h2>
                  <button
                    type="button"
                    onClick={handleRenew}
                    disabled={isRenewing || !endDate || !billingCycle || autoRenewal}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRenewing ? 'animate-spin' : ''}`} />
                    Renew
                  </button>
                </div>
                <div className="h-px bg-gradient-to-r from-indigo-500 to-blue-500 mt-4"></div>
              </div>
              <div className="grid gap-4 mb-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 items-end">
                {/* Auto Renewal - First */}
                <div className="w-full flex flex-col">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Auto Renewal</label>
                  <div className="flex items-center h-10 border border-transparent">
                    <button
                      type="button"
                      className={`relative inline-flex h-6 w-12 items-center rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoRenewal ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-200 border-slate-300'
                      }`}
                      onClick={() => {
                        const newAutoRenewal = !autoRenewal;
                        setAutoRenewal(newAutoRenewal);
                        // Always clear reminderDays and reminderPolicy when toggling
                        form.setValue("reminderDays", "");
                        form.setValue("reminderPolicy", "");
                      }}
                      aria-pressed={autoRenewal}
                      aria-label="Toggle auto renewal"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                          autoRenewal ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                {/* Initial Date */}
                <div className="w-full flex flex-col">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    First Purchase Date
                  </label>
                  <Input 
                    type="date" 
                    className="w-full border-slate-300 rounded-lg p-1 text-base"
                    value={initialDate}
                    onChange={e => { 
                      const newInitialDate = e.target.value;
                      // Validate that First Purchase Date is not in the future
                      if (newInitialDate && new Date(newInitialDate) > new Date()) {
                        setValidationErrorMessage("First Purchase Date cannot be in the future");
                        setValidationErrorOpen(true);
                        return; // Don't change the date
                      }
                      // Validate before changing
                      if (startDate && newInitialDate && new Date(startDate) < new Date(newInitialDate)) {
                        setValidationErrorMessage("Current Cycle Start must be on or after First Purchase Date");
                        setValidationErrorOpen(true);
                        return; // Don't change the date
                      }
                      setInitialDate(newInitialDate);
                      savedInitialDateRef.current = newInitialDate; // Save to ref to persist across renewals
                      // Do NOT auto-populate Start Date here; wait for blur
                    }}
                    onBlur={e => {
                      const blurDate = e.target.value;
                      // Only update Current Cycle Start if a valid date is entered
                      if (blurDate) {
                        setStartDate(blurDate);
                        form.setValue("startDate", blurDate);
                      }
                    }}
                  />
                </div>
                {/* Start Date */}
                <div className="w-full flex flex-col">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={() => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">
                          Current Cycle Start <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            className="w-full border-slate-300 rounded-lg p-1 text-base"
                            value={startDate || ''} 
                            disabled={!initialDate}
                            onChange={(e) => {
                              const newStartDate = e.target.value;
                              
                              // Validate before changing
                              if (initialDate && newStartDate && new Date(newStartDate) < new Date(initialDate)) {
                                setValidationErrorMessage("Current Cycle Start must be on or after First Purchase Date");
                                setValidationErrorOpen(true);
                                return; // Don't change the date
                              }
                              
                              setStartDate(newStartDate);
                              form.setValue("startDate", newStartDate);
                              
                              // Update next renewal if auto-renewal is on
                              if (autoRenewal) {
                                const cycle = form.watch("billingCycle") || billingCycle;
                                if (cycle) {
                                  const nextDate = calculateEndDate(newStartDate, cycle);
                                  form.setValue("nextRenewal", nextDate);
                                  setEndDate(nextDate);
                                }
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Next Renewal Date */}
                <div className="w-full flex flex-col">
                  <FormField
                    control={form.control}
                    name="nextRenewal"
                    render={() => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">
                          Next Payment Date <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            className="w-full border-slate-300 rounded-lg p-1 text-base bg-gray-100 cursor-not-allowed"
                            value={endDate || ''} 
                            readOnly
                            disabled
                          />
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Reminder Days */}
                <div className="w-full flex flex-col">
                  <FormField
                    control={form.control}
                    name="reminderDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">Remind Before (Days)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            max="1000"
                            disabled={autoRenewal}
                            className="w-full border-slate-300 rounded-lg p-1 text-base" 
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              // If empty, set to empty string
                              if (value === "") {
                                field.onChange("");
                                return;
                              }
                              // Convert to number and validate
                              const numValue = Number(value);
                              if (!isNaN(numValue) && numValue >= 1 && numValue <= 1000) {
                                field.onChange(numValue);
                              }
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Reminder Policy */}
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="reminderPolicy"
                    render={({ field }) => {
                      const reminderDays = form.watch("reminderDays");
                      const reminderDaysNum = typeof reminderDays === 'number' ? reminderDays : (typeof reminderDays === 'string' && reminderDays !== '' ? parseInt(reminderDays) : 7);
                      const isOnlyOneTimeAllowed = reminderDaysNum === 1;
                      return (
                        <FormItem>
                          <FormLabel className="block text-sm font-medium text-slate-700">Reminder Policy</FormLabel>
                          <Select 
                            onValueChange={(val: string) => {
                              field.onChange(val);
                            }}
                            value={field.value || ""}
                            disabled={isOnlyOneTimeAllowed || autoRenewal}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                                <SelectValue placeholder="Select policy" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="dropdown-content">
                              <SelectItem value="One time" className={`${field.value === 'One time' ? 'selected' : ''} dropdown-item`}>One time</SelectItem>
                              <SelectItem value="Two times" disabled={isOnlyOneTimeAllowed} className={`${field.value === 'Two times' ? 'selected' : ''} dropdown-item ${isOnlyOneTimeAllowed ? 'disabled' : ''}`}>Two times</SelectItem>
                              <SelectItem value="Until Renewal" disabled={isOnlyOneTimeAllowed} className={`${field.value === 'Until Renewal' ? 'selected' : ''} dropdown-item ${isOnlyOneTimeAllowed ? 'disabled' : ''}`}>Until Renewal</SelectItem>
                            </SelectContent>
                          </Select>
                          <ul className="text-xs text-slate-600 mt-2 list-disc pl-4">
                            <li>One time: One reminder at {reminderDaysNum} days before renewal</li>
                            <li>Two times: Reminders at {reminderDaysNum} and {Math.floor(reminderDaysNum/2)} days before</li>
                            <li>Until Renewal: Daily reminders from {reminderDaysNum} days until renewal</li>
                          </ul>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </div>
              
              {/* Notes Section with Card-based UI */}
              <div className="mb-6">
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
                          <span>{note.createdBy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm italic">No notes added yet. Click + to add a note.</p>
                )}
              </div>
              
              <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-gray-200 bg-gray-50/50 -mx-8 px-8 -mb-8 pb-8 rounded-b-2xl">
                <Button 
                  type="button" 
                  variant="destructive" 
                  className="font-semibold px-6 py-3 border-2 border-red-600 text-white bg-red-600 hover:bg-red-700 shadow-lg mr-auto rounded-lg transition-all duration-200 hover:shadow-red-500/25"
                  onClick={() => {
                    setCancelRenewalConfirmDialog({ show: true });
                  }}
                  disabled={!subscription?.id}
                >
                  Cancel Renewal
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold px-6 py-3 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
                  onClick={() => {
                    // Check if form has any data filled
                    const formValues = form.getValues();
                    const hasData = formValues.serviceName || formValues.vendor || formValues.amount || 
                                   formValues.category || formValues.owner || formValues.notes;
                    
                    if (hasData && !subscriptionCreated) {
                      setExitConfirmDialog({ show: true });
                    } else {
                      onOpenChange(false);
                    }
                  }}
                >
                  Exit
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleSaveDraft()}
                  disabled={
                    draftMutation.isPending || 
                    subscriptionCreated || 
                    form.watch('status') === 'Active' || 
                    (isEditing && form.watch('status') !== 'Draft')
                  }
                  title={
                    (isEditing && form.watch('status') !== 'Draft') ? "Draft is only available for draft subscriptions" :
                    subscriptionCreated ? "Draft is not available after subscription is created" : 
                    form.watch('status') === 'Active' ? "Draft is not available for active subscriptions" : 
                    undefined
                  }
                >
                  {draftMutation.isPending ? (isEditing && form.watch('status') === 'Draft' ? 'Updating Draft...' : 'Saving Draft...') : (isEditing && form.watch('status') === 'Draft' ? 'Update Draft' : 'Save Draft')}
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-blue-700 rounded-lg transition-all duration-200 tracking-tight"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Saving...' : isEditing ? 'Update Subscription' : 'Save Subscription'}
                </Button>
              </div>
            </form>
          </Form>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Error Dialog (portal-based for reliable interactions) */}
      <AlertDialog open={errorDialog.show} onOpenChange={(open) => !open && setErrorDialog({ show: false, message: "" })}>
        <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Cannot Renew Yet
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-900 font-medium">
              {errorDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setErrorDialog({ show: false, message: "" })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={exitConfirmDialog.show} onOpenChange={(open) => !open && setExitConfirmDialog({ show: false })}>
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
              onClick={() => setExitConfirmDialog({ show: false })}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setExitConfirmDialog({ show: false });
                onOpenChange(false);
                setTimeout(() => {
                  form.reset();
                  setSubscriptionCreated(false);
                }, 300);
              }}
              className="bg-red-600 hover:bg-red-700 text-white shadow-md px-6 py-2"
            >
              Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.show} onOpenChange={(open) => !open && setConfirmDialog({ show: false })}>
        <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">
              Confirm Renewal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700">
              Are you sure you want to renew this subscription?
              <br /><br />
              This will extend the subscription period and update the renewal dates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ show: false })}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Cancel
            </Button>
            <AlertDialogAction 
              onClick={handleConfirmRenewal}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Effective Date Dialog */}
      <AlertDialog open={effectiveDateDialog.show} onOpenChange={(open) => !open && setEffectiveDateDialog({ show: false })}>
        <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              {isRenewing ? "Confirm Renewal" : "Confirm Update"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700 font-medium">
              {isRenewing ? "Please enter effective date for renewal" : "Please enter effective date and update subscription"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Effective Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full border-gray-300 rounded-lg"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setEffectiveDateDialog({ show: false });
                setIsRenewing(false);
              }}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={isRenewing ? handleConfirmRenewal : handleUpdateWithEffectiveDate}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isRenewing ? "Renew Subscription" : "Update Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Renewal Confirmation Dialog */}
      <AlertDialog open={cancelRenewalConfirmDialog.show} onOpenChange={(open) => !open && setCancelRenewalConfirmDialog({ show: false })}>
        <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Cancel Renewal Confirmation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700 font-medium">
              Are you sure you want to cancel this subscription renewal? This action will mark the subscription as cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setCancelRenewalConfirmDialog({ show: false })}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              No, Keep It
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setCancelRenewalConfirmDialog({ show: false });
                // Close modal immediately for fast UX
                setStatus('Cancelled');
                // Clear Current Cycle Start and Next Payment Date
                setStartDate('');
                setEndDate('');
                form.setValue('startDate', '');
                form.setValue('nextRenewal', '');
                onOpenChange(false);
                toast({ title: 'Subscription cancelled', description: 'The subscription was marked as Cancelled.', variant: 'destructive' });
                // Update cache immediately for instant table refresh
                if (isEditing && subscription?.id) {
                  queryClient.setQueryData(["/api/subscriptions"], (oldData: any) => {
                    if (!oldData) return oldData;
                    return oldData.map((sub: any) => 
                      sub.id === subscription.id ? { ...sub, status: 'Cancelled', startDate: null, nextRenewal: null } : sub
                    );
                  });
                  // Update analytics cache immediately
                  queryClient.setQueryData(["/api/analytics/dashboard"], (oldData: any) => {
                    if (!oldData) return oldData;
                    return {
                      ...oldData,
                      activeSubscriptions: Math.max(0, (oldData.activeSubscriptions || 0) - 1)
                    };
                  });
                  // Update backend asynchronously
                  const validId = getValidObjectId(subscription.id);
                  if (validId) {
                    apiRequest("PUT", `/api/subscriptions/${validId}`, { 
                      status: 'Cancelled',
                      startDate: null,
                      nextRenewal: null
                    })
                      .then(() => {
                        // Refetch immediately after successful update
                        queryClient.refetchQueries({ queryKey: ["/api/subscriptions"] });
                        queryClient.refetchQueries({ queryKey: ["/api/analytics/dashboard"] });
                      })
                      .catch((e: any) => {
                        // Revert cache on error and show error
                        queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
                        toast({ title: 'Update failed', description: e?.message || 'Failed to update subscription status', variant: 'destructive' });
                      });
                  }
                } else {
                  queryClient.refetchQueries({ queryKey: ["/api/subscriptions"] });
                  queryClient.refetchQueries({ queryKey: ["/api/analytics/dashboard"] });
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white shadow-md px-6 py-2"
            >
              Yes, Cancel Renewal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renewal Confirmation Dialog (for renewals without amount change) */}
      <AlertDialog open={renewalConfirmDialog.show} onOpenChange={(open) => !open && setRenewalConfirmDialog({ show: false })}>
        <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <RefreshCw className="h-5 w-5 text-indigo-600" />
              Confirm Renewal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700 font-medium">
              Are you sure you want to renew this subscription? The renewal will extend the subscription period based on the current billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setRenewalConfirmDialog({ show: false });
                setIsRenewing(false);
              }}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setRenewalConfirmDialog({ show: false });
                handleConfirmRenewal();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md px-6 py-2"
            >
              Confirm Renewal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Draft Required Dialog */}
      <AlertDialog open={saveDraftRequiredDialog.show} onOpenChange={(open) => !open && setSaveDraftRequiredDialog({ show: false })}>
        <AlertDialogContent className="sm:max-w-[500px] bg-white border border-gray-200 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Save Required
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700 font-medium">
              You need to save the subscription as draft before managing users. Otherwise, your data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setSaveDraftRequiredDialog({ show: false })}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                setSaveDraftRequiredDialog({ show: false });
                await handleSaveDraft({ returnResult: true });
              }}
              disabled={draftMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md px-6 py-2"
            >
              Save Draft
            </AlertDialogAction>
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
            {/* Note field - label on left, input on right */}
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
            {/* Note field - label on left, value on right */}
            <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
              <label className="text-base font-medium text-gray-700 pt-3">Note</label>
              <Textarea
                value={selectedNote?.text || ''}
                readOnly
                className="w-full border border-gray-300 rounded-lg p-3 text-base min-h-[120px] bg-white text-gray-900 resize-none"
              />
            </div>
            
            {/* Created field - combined date and time */}
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
            
            {/* User ID field */}
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

      {/* Department Creation Modal */}
  <AlertDialog open={departmentModal.show} onOpenChange={(open) => !open && setDepartmentModal({ show: false })}>
        <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl font-inter">
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

      {/* Category Creation Modal */}
      <AlertDialog open={categoryModal.show} onOpenChange={(open) => !open && setCategoryModal({ show: false })}>
        <AlertDialogContent className="sm:max-w-[460px] rounded-2xl border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 13a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <AlertDialogTitle className="text-xl font-bold tracking-tight text-white">
                  Add New Category
                </AlertDialogTitle>
              </div>
            </AlertDialogHeader>
          </div>

          <div className="px-6 py-5 bg-white">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
              <Input
                placeholder=""
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory();
                  }
                }}
              />
            </div>
          </div>

          <AlertDialogFooter className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => {
                setCategoryModal({ show: false });
                setNewCategoryName('');
              }}
              className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim()}
              className="h-9 px-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200 disabled:opacity-60 disabled:hover:from-indigo-600 disabled:hover:to-blue-600"
            >
              Add Category
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
                    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
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
                    // Check for duplicate name when user leaves the field
                    if (newPaymentMethodName.trim()) {
                      const duplicateName = paymentMethods.find(
                        method => method.name?.toLowerCase().trim() === newPaymentMethodName.toLowerCase().trim() ||
                                  method.title?.toLowerCase().trim() === newPaymentMethodName.toLowerCase().trim()
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
                      {(Array.isArray(employeesRaw) ? employeesRaw : [])
                        .filter((emp: any) => {
                          const q = pmOwnerSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            String(emp?.name || '').toLowerCase().includes(q) ||
                            String(emp?.email || '').toLowerCase().includes(q)
                          );
                        })
                        .map((emp: any) => {
                          const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                          const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                          const selected = newPaymentMethodOwner === emp.name;
                          return (
                            <div
                              key={emp._id || emp.id || emp.email}
                              className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                selected ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                              onClick={() => {
                                // If already selected, clear it
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
                      {(Array.isArray(employeesRaw) ? employeesRaw : []).length === 0 && (
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
                      {(Array.isArray(employeesRaw) ? employeesRaw : [])
                        .filter((emp: any) => {
                          const q = pmManagedSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            String(emp?.name || '').toLowerCase().includes(q) ||
                            String(emp?.email || '').toLowerCase().includes(q)
                          );
                        })
                        .map((emp: any) => {
                          const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                          const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                          const selected = newPaymentMethodManagedBy === emp.name;
                          return (
                            <div
                              key={emp._id || emp.id || emp.email}
                              className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                selected ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                              onClick={() => {
                                // If already selected, clear it
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
                      {(Array.isArray(employeesRaw) ? employeesRaw : []).length === 0 && (
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
                    // Only allow numbers
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
                    
                    // Validate immediately when date is selected
                    if (newValue) {
                      const [year, month] = newValue.split('-');
                      const expiryDate = new Date(parseInt(year), parseInt(month) - 1);
                      const today = new Date();
                      today.setDate(1);
                      today.setHours(0, 0, 0, 0);
                      
                      if (expiryDate < today) {
                        setValidationErrorMessage("Card expiry date cannot be in the past");
                        setValidationErrorOpen(true);
                        // Clear the invalid date
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

      {/* Owner Creation Modal */}
      <AlertDialog open={ownerModal.show} onOpenChange={(open) => !open && setOwnerModal({ show: false })}>
  <AlertDialogContent className="sm:max-w-[500px] bg-white border border-gray-200 shadow-2xl font-inter">
          <AlertDialogHeader className="bg-indigo-600 text-white p-6 rounded-t-lg -m-6 mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-white">
                Add Employee
              </AlertDialogTitle>
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
                    setNewOwnerEmailError(''); // Clear error on change
                  }}
                  onBlur={() => {
                    // Validate email on blur
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
                        .filter((dept) => Boolean(dept?.visible))
                        .filter((dept) => {
                          const q = ownerDeptSearch.trim().toLowerCase();
                          if (!q) return true;
                          return String(dept?.name || '').toLowerCase().includes(q);
                        })
                        .map((dept) => {
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

                      {Array.isArray(departments) && departments.filter((d) => d?.visible).length === 0 && (
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

      {/* Document Management Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
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
                    // Refresh logic if needed
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
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    // Allowed file types: PDF (preferred), Word, Excel, and images
                    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';
                    input.onchange = async (e: any) => {
                      const file = e.target?.files?.[0];
                      if (file) {
                        // Get file extension
                        const fileName = file.name.toLowerCase();
                        const fileExt = fileName.substring(fileName.lastIndexOf('.'));
                        
                        // Blocked file types (security risk)
                        const blockedExtensions = [
                          '.exe', '.msi', '.bat', '.cmd', '.sh', '.apk', // Executables & scripts
                          '.js', '.php', '.html', '.py', '.xml', // Web & code files
                          '.zip', '.rar', '.7z', '.tar', // Archives
                          '.env', '.sql', '.db', '.ini', '.csv' // Config / DB files
                        ];
                        
                        // Allowed file types
                        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
                        
                        // Check if file type is blocked
                        if (blockedExtensions.includes(fileExt)) {
                          toast({
                            title: "File Type Not Allowed",
                            description: `${fileExt} files are not permitted for security reasons`,
                            variant: "destructive",
                            duration: 3000,
                          });
                          return;
                        }
                        
                        // Check if file type is allowed
                        if (!allowedExtensions.includes(fileExt)) {
                          toast({
                            title: "Invalid File Type",
                            description: "Only PDF, Word, Excel, and image files are allowed",
                            variant: "destructive",
                            duration: 3000,
                          });
                          return;
                        }
                        
                        // Validate actual file content (magic bytes) to prevent file extension spoofing
                        const validateFileType = async (file: File): Promise<boolean> => {
                          return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = (e) => {
                              if (!e.target?.result) {
                                resolve(false);
                                return;
                              }
                              
                              const arr = new Uint8Array(e.target.result as ArrayBuffer).subarray(0, 8);
                              let header = '';
                              for (let i = 0; i < arr.length; i++) {
                                header += arr[i].toString(16).padStart(2, '0');
                              }
                              
                              // File signatures (magic bytes) for allowed types
                              const signatures: { [key: string]: string[] } = {
                                pdf: ['25504446'], // %PDF
                                jpg: ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
                                png: ['89504e47'],
                                doc: ['d0cf11e0'], // Old Word format
                                docx: ['504b0304'], // ZIP-based (Office Open XML)
                                xlsx: ['504b0304'], // ZIP-based (Office Open XML)
                                xls: ['d0cf11e0'], // Old Excel format
                              };
                              
                              // Check if file header matches any allowed signature
                              const isValid = Object.values(signatures).some(sigs => 
                                sigs.some(sig => header.startsWith(sig))
                              );
                              
                              resolve(isValid);
                            };
                            reader.readAsArrayBuffer(file.slice(0, 8));
                          });
                        };
                        
                        // Validate file content
                        const isValidFile = await validateFileType(file);
                        if (!isValidFile) {
                          toast({
                            title: "Invalid File",
                            description: "File content does not match the extension. Please upload a valid document.",
                            variant: "destructive",
                            duration: 4000,
                          });
                          return;
                        }
                        
                        try {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const base64String = reader.result as string;
                            // Use the actual file name instead of generic "File 1", "File 2"
                            setDocuments([...documents, {name: file.name, url: base64String}]);
                            toast({
                              title: "Success",
                              description: `${file.name} uploaded successfully`,
                              duration: 2000,
                              variant: "success",
                            });
                          };
                          reader.readAsDataURL(file);
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to process document",
                            variant: "destructive",
                          });
                        }
                      }
                    };
                    input.click();
                  }}
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
            {documents.length > 0 ? (
              <div className="space-y-2 pr-2">
                {documents.map((doc, index) => (
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
                          <p className="text-xs font-medium text-gray-900 truncate">{currentUserName}</p>
                        </div>
                      </div>
                      
                      {/* Column 3: Uploaded date */}
                      <div className="col-span-3 flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-500">Uploaded date</p>
                          <p className="text-xs font-medium text-gray-900 truncate">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
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
                            const updatedDocs = documents.filter((_, i) => i !== index);
                            setDocuments(updatedDocs);
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
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDocumentDialog(false)}
                className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm px-4 py-1.5"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => setShowDocumentDialog(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Validation Error Dialog */}
      <Dialog open={validationErrorOpen} onOpenChange={setValidationErrorOpen}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 bg-white font-inter">
          {/* Header with Red Gradient Background */}
          <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5 rounded-t-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-white">
                    Validation Error
                  </DialogTitle>
                  <p className="text-red-100 mt-0.5 text-sm font-medium">Please correct the error</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-gray-700 text-sm leading-relaxed">
              {validationErrorMessage}
            </p>
          </div>

          {/* Action Button */}
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
    </>
  );
}

// Helper to get valid ObjectId for subscription
function getValidObjectId(id: any) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
    ? id
    : (id?.toString?.() || "");
}