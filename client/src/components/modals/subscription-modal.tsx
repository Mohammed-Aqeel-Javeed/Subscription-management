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
import { cardImages } from "@/assets/card-icons/cardImages";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import axios from "axios";
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
import { CreditCard, X, History, RefreshCw, Maximize2, Minimize2, AlertCircle, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ownerEmail: z.string().email('Please enter a valid email').optional(),
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
  
  // Get tenant ID for API calls
  const tenantId = (window as any).currentTenantId || (window as any).user?.tenantId || null;
  
  // Fullscreen toggle state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Status state (Active/Cancel)
  const [status, setStatus] = useState<'Active' | 'Cancelled' | 'Draft'>('Draft');
  
  // Auto Renewal toggle state
  const [autoRenewal, setAutoRenewal] = useState<boolean>(false);
  
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
      const subId = sub._id || sub.id;
      const subscriptionId = (subscription as any)._id || (subscription as any).id;
      return subId !== subscriptionId;
    })
    .map((sub: any) => sub.serviceName?.toLowerCase().trim())
    .filter(Boolean);
  
  // Fetch payment methods for dynamic dropdown
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading, refetch: refetchPaymentMethods } = useQuery({
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
      billingCycle: subscription?.billingCycle && subscription?.billingCycle !== "" ? subscription.billingCycle : "monthly",
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
    if (currentServiceName && open) {
      validateServiceName(currentServiceName);
    }
  }, [existingSubscriptions, open]);
  
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  
  const [startDate, setStartDate] = useState(subscription?.startDate ? toISODateOnly(subscription.startDate) : "");
  const [billingCycle, setBillingCycle] = useState(subscription?.billingCycle || "monthly");
  const [endDate, setEndDate] = useState(subscription?.nextRenewal ? toISODateOnly(subscription.nextRenewal) : "");
  // Removed unused endDateManuallySet state
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(parseDepartments(subscription?.department));
  // Removed unused isPopoverOpen state
  const [isRenewing, setIsRenewing] = useState(false);
  const [lcyAmount, setLcyAmount] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [errorDialog, setErrorDialog] = useState<{show: boolean, message: string}>({show: false, message: ''});
  const [confirmDialog, setConfirmDialog] = useState<{show: boolean}>({show: false});
  const [exitConfirmDialog, setExitConfirmDialog] = useState<{show: boolean}>({show: false});
  const [cancelRenewalConfirmDialog, setCancelRenewalConfirmDialog] = useState<{show: boolean}>({show: false});
  const [subscriptionCreated, setSubscriptionCreated] = useState<boolean>(false);
  const [departmentModal, setDepartmentModal] = useState<{show: boolean}>({show: false});
  const [newDepartmentName, setNewDepartmentName] = useState<string>('');
  const [newDepartmentHead, setNewDepartmentHead] = useState<string>('');
  const [newDepartmentEmail, setNewDepartmentEmail] = useState<string>('');
  const [categoryModal, setCategoryModal] = useState<{show: boolean}>({show: false});
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [paymentMethodModal, setPaymentMethodModal] = useState<{show: boolean}>({show: false});
  const [newPaymentMethodName, setNewPaymentMethodName] = useState<string>('');
  const [newPaymentMethodType, setNewPaymentMethodType] = useState<string>('');
  const [newPaymentMethodDescription, setNewPaymentMethodDescription] = useState<string>('');
  const [newPaymentMethodManagedBy, setNewPaymentMethodManagedBy] = useState<string>('');
  const [newPaymentMethodExpiresAt, setNewPaymentMethodExpiresAt] = useState<string>('');
  const [newPaymentMethodCardImage, setNewPaymentMethodCardImage] = useState<string>('visa');
  const [ownerModal, setOwnerModal] = useState<{show: boolean}>({show: false});
  const [newOwnerName, setNewOwnerName] = useState<string>('');
  const [newOwnerEmail, setNewOwnerEmail] = useState<string>('');
  const [newOwnerRole, setNewOwnerRole] = useState<string>('');
  const [newOwnerStatus, setNewOwnerStatus] = useState<string>('Active');
  const [newOwnerDepartment, setNewOwnerDepartment] = useState<string>('');
  const [documents, setDocuments] = useState<Array<{name: string, url: string}>>([]);
  const [showDocumentDialog, setShowDocumentDialog] = useState<boolean>(false);
  
  // Vendor autocomplete state
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  
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
      }
    };

    if (categoryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [categoryOpen]);
  
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
      setBillingCycle("monthly");
      setEndDate("");
      setSelectedDepartments([]);
      setStatus('Draft');
      setAutoRenewal(false);
      setServiceNameError("");
      setLcyAmount('');
      setTotalAmount('');
      setDocuments([]);
      
      // Reset form
      form.reset({
        serviceName: "",
        website: "",
        vendor: "",
        currency: "",
        qty: "",
        amount: "",
        totalAmount: "",
        billingCycle: "monthly",
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
      
      form.reset({
        serviceName: subscription.serviceName || "",
        website: (subscription as any)?.website || "",
        vendor: subscription.vendor || "",
        currency: subscription.currency || "",
        qty: subscription.qty !== undefined && subscription.qty !== null ? Number(subscription.qty) : 1,
        amount: subscription.amount !== undefined && subscription.amount !== null ? Number(subscription.amount).toFixed(2) : "",
        totalAmount: subscription.totalAmount !== undefined && subscription.totalAmount !== null ? Number(subscription.totalAmount).toFixed(2) : "",
        billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "monthly",
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
      setBillingCycle("monthly");
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
        billingCycle: "monthly",
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
    }
  }, [subscription, form, companyInfo?.defaultCurrency, currencies]);
  
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

  // Auto-update dates if Auto Renewal is ON and Next Renewal Date matches today
  useEffect(() => {
    if (!autoRenewal || !open) return;
    
    const nextRenewalValue = form.watch('nextRenewal');
    if (!nextRenewalValue) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const nextRenewalStr = new Date(nextRenewalValue).toISOString().split('T')[0];
    
    // If next renewal date matches today, update both dates
    if (nextRenewalStr === todayStr) {
      const cycle = form.watch("billingCycle") || billingCycle;
      const newStartDate = todayStr;
      const newEndDate = calculateEndDate(newStartDate, cycle);
      
      setStartDate(newStartDate);
      form.setValue("startDate", newStartDate);
      setEndDate(newEndDate);
      form.setValue("nextRenewal", newEndDate);
    }
  }, [autoRenewal, open, form.watch('nextRenewal'), billingCycle, form]);
  
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { id, createdAt, ...rest } = data as any;
      
      // Convert departments array to JSON string for storage
      const subscriptionData: InsertSubscription = {
        ...rest,
        department: JSON.stringify(data.departments || []),
        startDate: new Date(data.startDate ?? "").toISOString(),
        nextRenewal: new Date(data.nextRenewal ?? "").toISOString(),
      };
      
      let res;
      const subId = subscription?.id;
      // Remove tenantId from update payload
      if (isEditing && subId) {
  delete (subscriptionData as any).tenantId;
        res = await apiRequest("PUT", `/api/subscriptions/${subId}`, subscriptionData);
      } else {
        res = await apiRequest("POST", "/api/subscriptions", subscriptionData);
      }
      return res.json();
    },
  onSuccess: async () => {
      // Use only the subscription's id
      if (subscription?.id) {
  // removed currentSubscriptionId usage
      }
      
      // Mark subscription as created to disable draft button
      if (!isEditing) {
        setSubscriptionCreated(true);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/categories"] });
      
      toast({
        title: "Success",
        description: `Subscription ${isEditing ? 'updated' : 'created'} successfully`,
      });
      onOpenChange(false);
      setTimeout(() => {
        form.reset();
        setSubscriptionCreated(false);
      }, 300);
    },
    onError: (error: any) => {
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
      
      // Convert departments array to JSON string for storage
      const draftData: InsertSubscription = {
        ...rest,
        department: JSON.stringify(data.departments || []),
        startDate: new Date(data.startDate ?? "").toISOString(),
        nextRenewal: new Date(data.nextRenewal ?? "").toISOString(),
      };
      
      // If editing an existing subscription, use PUT to update, otherwise POST to create
      if (isEditing && subscription?.id) {
        const res = await apiRequest("PUT", `/api/subscriptions/${subscription.id}`, draftData);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/subscriptions/draft", draftData);
        return res.json();
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/drafts"] });
      
      toast({
        title: "Draft Saved",
        description: "Subscription saved as draft successfully",
      });
      onOpenChange(false);
      setTimeout(() => {
        form.reset();
      }, 300);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.message || error.message || `Failed to save draft`,
        variant: "destructive",
      });
    },
  });

  // Handle save draft function
  const handleSaveDraft = async () => {
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

    try {
      const amountNum = typeof currentValues.amount === 'string' ? parseFloat(currentValues.amount) : currentValues.amount ?? 0;
      const tenantId = String((window as any).currentTenantId || (window as any).user?.tenantId || "");
      
      const payload = {
        ...currentValues,
        status: 'Draft', // Always save as draft
        autoRenewal: autoRenewal, // Add auto renewal from state
        amount: amountNum,
        tenantId,
        departments: currentValues.departments || [],
        startDate: currentValues.startDate || new Date().toISOString().split('T')[0],
        nextRenewal: currentValues.nextRenewal || new Date().toISOString().split('T')[0],
      };

      draftMutation.mutate(payload as FormData);
    } catch (error) {
      console.error("Draft save error:", error);
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive",
      });
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
    
    setStatus('Active'); // Set status to Active when saving
    try {
      // Always include department as JSON string for backend
      // Ensure amount is a number
      const amountNum = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount ?? 0;
      const totalAmountNum = typeof data.totalAmount === 'string' ? parseFloat(data.totalAmount) : data.totalAmount ?? 0;
      const qtyNum = typeof data.qty === 'string' ? parseFloat(data.qty) : data.qty ?? 0;
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
        departments: selectedDepartments,
        department: JSON.stringify(selectedDepartments),
        startDate: new Date(data.startDate ?? ""),
        nextRenewal: data.nextRenewal ? new Date(data.nextRenewal) : new Date(),
        tenantId,
        documents: documents.length > 0 ? documents : undefined, // Include documents if uploaded
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
        mutation.mutate({
          ...payload,
          startDate: payload.startDate instanceof Date ? payload.startDate.toISOString() : String(payload.startDate),
          nextRenewal: payload.nextRenewal instanceof Date ? payload.nextRenewal.toISOString() : String(payload.nextRenewal),
        });
      } else {
        // Create new subscription using apiRequest helper for consistent headers
        const res = await apiRequest("POST", "/api/subscriptions", payload);
        const result = await res.json();
        
        if (res.ok && result) {
          const subscriptionId = result._id || result.subscription?._id;
          
          // Dispatch subscription creation event
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('subscription-created', { 
              detail: { ...payload, _id: subscriptionId }
            }));
          }
          
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/history"] });
          queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
          
          toast({
            title: "Success",
            description: "Subscription created successfully",
          });
          onOpenChange(false);
        } else {
          throw new Error("Failed to create subscription");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save subscription",
        variant: "destructive",
      });
    }
  };
  
  // Handle department selection
  const handleDepartmentChange = (departmentName: string, checked: boolean) => {
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
    
    // If next renewal date is greater than today, show error
    if (nextRenewalDate > today) {
      setErrorDialog({
        show: true,
        message: `Subscription can only be renewed on or after ${formatDate(endDate)}. Current renewal date is in the future.`
      });
      return;
    }

    // Show confirmation dialog
    setConfirmDialog({show: true});
  };

  const handleConfirmRenewal = async () => {
    setConfirmDialog({show: false});
    setIsRenewing(true);
    
    try {
      // Always recalculate dates based on current endDate and billingCycle
      const { newStartDate, newEndDate } = calculateRenewalDates(endDate, billingCycle);
      
      // Update local state
      setStartDate(newStartDate);
      setEndDate(newEndDate);
  // removed manual end date flag
      
      // Update form values
      form.setValue('startDate', newStartDate);
      form.setValue('nextRenewal', newEndDate);
      
      // Prepare payload for API - include all fields including lcyAmount
      const formValues = form.getValues();
      // Always get tenantId from context or user info
      const tenantId = String((window as any).currentTenantId || (window as any).user?.tenantId || "");
      const payload = {
        ...formValues,
        startDate: newStartDate,
        nextRenewal: newEndDate,
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
          className: "bg-white border border-green-500 text-green-700 font-semibold shadow-lg",
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
        // Close the modal after successful renewal
        onOpenChange(false);
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
      setDepartmentModal({ show: false });
    } catch (error) {
      console.error('Error adding department:', error);
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
    
    try {
      await apiRequest(
        "POST",
        "/api/payment",
        { 
          name: newPaymentMethodName.trim(),
          title: newPaymentMethodName.trim(),
          type: newPaymentMethodType,
          description: newPaymentMethodDescription.trim(),
          manager: newPaymentMethodManagedBy.trim(),
          expiresAt: newPaymentMethodExpiresAt,
          icon: newPaymentMethodCardImage
        }
      );
      
      // If no error thrown, consider success
      await refetchPaymentMethods();
      // Select the new payment method
      form.setValue('paymentMethod', newPaymentMethodName.trim());
      setNewPaymentMethodName('');
      setNewPaymentMethodType('');
      setNewPaymentMethodDescription('');
      setNewPaymentMethodManagedBy('');
      setNewPaymentMethodExpiresAt('');
      setNewPaymentMethodCardImage('visa');
      setPaymentMethodModal({ show: false });
    } catch (error) {
      console.error('Error adding payment method:', error);
    }
  };

  // Handle adding new owner
  const handleAddOwner = async () => {
    if (!newOwnerName.trim() || !newOwnerEmail.trim()) return;
    
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
  setNewOwnerRole('');
      setNewOwnerStatus('Active');
      setNewOwnerDepartment('');
      setOwnerModal({ show: false });
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
      overflow: hidden;
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
        <DialogContent className={`${isFullscreen ? 'max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh]' : 'max-w-5xl min-w-[400px] max-h-[85vh]'} overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter`}> 
          <DialogHeader className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white p-6 rounded-t-2xl flex flex-row items-center shadow-sm">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="h-10 w-10 bg-white/15 rounded-xl flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
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
                  window.location.href = `/subscription-user?id=${subscriptionId}&name=${encodeURIComponent(serviceName)}`;
                }}
              >
                User
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 hover:!text-indigo-700 font-medium px-4 py-2 rounded-lg transition-all duration-200 min-w-[80px] flex items-center gap-2 border-indigo-200 shadow-sm"
                    disabled={isRenewing}
                  >
                    {isRenewing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    )}
                    Action
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px] bg-white border border-gray-200 shadow-lg rounded-lg">
                  <DropdownMenuItem
                    onClick={handleRenew}
                    disabled={isRenewing || !endDate || !billingCycle || autoRenewal}
                    className="cursor-pointer flex items-center gap-2 hover:bg-indigo-50 focus:bg-indigo-50 px-3 py-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Renew
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Trigger form submission for update
                      form.handleSubmit(onSubmit)();
                    }}
                    disabled={!isEditing}
                    className="cursor-pointer flex items-center gap-2 hover:bg-indigo-50 focus:bg-indigo-50 px-3 py-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Update
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDocumentDialog(true)}
                    className="cursor-pointer flex items-center gap-2 hover:bg-indigo-50 focus:bg-indigo-50 px-3 py-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {documents.length > 0 ? `Manage Documents (${documents.length})` : 'Upload Document'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 bg-gradient-to-br from-gray-50 to-white">
              {/* Professional Section Header */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-2">Subscription Details</h2>
                <div className="h-px bg-gradient-to-r from-indigo-500 to-blue-500 mt-4"></div>
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
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Website</FormLabel>
                      <FormControl>
                          {field.value ? (
                            <div className="w-full">
                              <a
                                href={field.value.startsWith('http') ? field.value : `https://${field.value}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm font-normal bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 text-indigo-600 hover:text-indigo-800 hover:underline block"
                                style={{ textAlign: 'left', minHeight: '40px', display: 'flex', alignItems: 'center' }}
                              >
                                {field.value}
                              </a>
                            </div>
                          ) : (
                            <Input 
                              type="url"
                              className="w-full border-gray-300 rounded-lg p-2 text-sm font-normal bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                              {...field}
                            />
                          )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Vendor</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            className="w-full border-gray-300 rounded-lg p-3 text-base font-medium bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200" 
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value);
                              
                              // Filter vendor suggestions based on input
                              if (value.trim()) {
                                const filtered = VENDOR_LIST.filter(vendor => 
                                  vendor.toLowerCase().includes(value.toLowerCase())
                                );
                                setVendorSuggestions(filtered);
                                setShowVendorSuggestions(filtered.length > 0);
                              } else {
                                setVendorSuggestions([]);
                                setShowVendorSuggestions(false);
                              }
                            }}
                            onFocus={(e) => {
                              const value = e.target.value;
                              if (value.trim()) {
                                const filtered = VENDOR_LIST.filter(vendor => 
                                  vendor.toLowerCase().includes(value.toLowerCase())
                                );
                                setVendorSuggestions(filtered);
                                setShowVendorSuggestions(filtered.length > 0);
                              }
                            }}
                            onBlur={() => {
                              // Delay hiding to allow click on suggestion
                              setTimeout(() => setShowVendorSuggestions(false), 200);
                            }}
                            autoComplete="off"
                          />
                          {showVendorSuggestions && vendorSuggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {vendorSuggestions.map((vendor, index) => (
                                <div
                                  key={index}
                                  className="px-4 py-2 hover:bg-indigo-50 cursor-pointer transition-colors text-sm"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    field.onChange(vendor);
                                    setShowVendorSuggestions(false);
                                  }}
                                >
                                  {vendor}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Currency</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full bg-white border-gray-300 rounded-lg shadow-sm p-3 text-base font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dropdown-content">
                          {currencies && currencies.length > 0 ? (
                            currencies.map((curr: any) => (
                              <SelectItem key={curr.code} value={curr.code} className="dropdown-item">
                                {curr.code}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-currency" disabled className="dropdown-item disabled">
                              No currencies configured
                            </SelectItem>
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
                      <FormMessage />
                    </FormItem>
                  )}
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
                            className="w-full border-gray-300 rounded-lg p-3 text-base text-right font-semibold bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200" 
                            value={field.value}
                            onChange={e => {
                              // Limit to 2 decimal places
                              let val = e.target.value;
                              if (val && val.includes('.')) {
                                const [intPart, decPart] = val.split('.');
                                val = intPart + '.' + decPart.slice(0,2);
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
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value)) {
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
                        <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Qty</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="1" 
                            min="1"
                            placeholder=""
                            className="w-full border-gray-300 rounded-lg p-3 text-base text-right font-semibold bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200" 
                            value={field.value || ""}
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
                {/* Total Amount Field - Read-only calculated field */}
                <div className="form-item">
                  <label className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">
                    Total Amount
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
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">Commitment cycle</FormLabel>
                        <Select value={billingCycle} onValueChange={(val: string) => { 
                          setBillingCycle(val); 
                          field.onChange(val);
                          // When auto renewal is enabled, recompute next renewal as start + cycle (minus 1 day logic handled in calculateEndDate)
                          if (autoRenewal) {
                            const s = form.watch("startDate");
                            if (s) {
                              const nextDate = calculateEndDate(s, val);
                              form.setValue("nextRenewal", nextDate);
                              setEndDate(nextDate);
                            }
                          }
                        }}>
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dropdown-content">
                            <SelectItem value="monthly" className={`${billingCycle === 'monthly' ? 'selected' : ''} dropdown-item`}>Monthly</SelectItem>
                            <SelectItem value="yearly" className={`${billingCycle === 'yearly' ? 'selected' : ''} dropdown-item`}>Yearly</SelectItem>
                            <SelectItem value="quarterly" className={`${billingCycle === 'quarterly' ? 'selected' : ''} dropdown-item`}>Quarterly</SelectItem>
                            <SelectItem value="weekly" className={`${billingCycle === 'weekly' ? 'selected' : ''} dropdown-item`}>Weekly</SelectItem>
                            <SelectItem value="trial" className={`${billingCycle === 'trial' ? 'selected' : ''} dropdown-item`}>Trial</SelectItem>
                            <SelectItem value="pay-as-you-go" className={`${billingCycle === 'pay-as-you-go' ? 'selected' : ''} dropdown-item`}>Pay-as-you-go</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                />
                {/* Payment frequency dropdown */}
                <FormField
                  control={form.control}
                  name="paymentFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Payment frequency</FormLabel>
                      <Select value={field.value || "monthly"} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dropdown-content">
                          <SelectItem value="monthly" className="dropdown-item">Monthly</SelectItem>
                          <SelectItem value="weekly" className="dropdown-item">Weekly</SelectItem>
                          <SelectItem value="quarterly" className="dropdown-item">Quarterly</SelectItem>
                          <SelectItem value="yearly" className="dropdown-item">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
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
                    const allCategories = [...new Set([...dbCategories, ...DEFAULT_CATEGORY_SUGGESTIONS])];
                    
                    // Filter based on current input - only show if user has typed something
                    const filtered = field.value 
                      ? allCategories.filter(cat => 
                          cat.toLowerCase().includes(field.value?.toLowerCase() || '')
                        )
                      : [];
                    
                    const shouldShowDropdown = categoryOpen && field.value && filtered.length > 0;

                    return (
                      <FormItem className="relative" ref={categoryDropdownRef}>
                        <FormLabel className="block text-sm font-medium text-slate-700">Category</FormLabel>
                        <div className="relative">
                          <Input
                            {...field}
                            className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-blue-500 focus:ring-blue-500"
                            disabled={categoriesLoading}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              setCategoryOpen(e.target.value.length > 0);
                            }}
                            onFocus={(e) => {
                              // Don't show dropdown on focus if field already has a value
                              if (!field.value) {
                                setCategoryOpen(false);
                              }
                            }}
                          />
                        </div>
                        {shouldShowDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {filtered.map(catName => (
                              <div
                                key={catName}
                                className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors"
                                onClick={() => {
                                  field.onChange(catName);
                                  setCategoryOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 text-blue-600 ${field.value === catName ? "opacity-100" : "opacity-0"}`}
                                />
                                <span className="font-normal">{catName}</span>
                              </div>
                            ))}
                            <div
                              className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer font-medium border-t border-slate-200 text-sm text-slate-900 transition-colors"
                              onClick={() => {
                                setCategoryModal({ show: true });
                                setCategoryOpen(false);
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
                  render={() => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Departments</FormLabel>
                      <Select
                        value={selectedDepartments.length > 0 ? selectedDepartments.join(',') : ''}
                        onValueChange={() => {}}
                        disabled={departmentsLoading}
                      >
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base min-h-[44px] flex items-start justify-start overflow-hidden">
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
                          ) : null}
                          {/* Add Department option at the end */}
                          <div
                            className="dropdown-item font-medium border-t border-gray-200 mt-1 pt-2 text-black cursor-pointer px-2 py-2"
                            onClick={() => setDepartmentModal({ show: true })}
                          >
                            + New
                          </div>
                          {Array.isArray(departments) && departments.filter(dept => dept.visible).length === 0 && (
                            <SelectItem value="no-department" disabled className="dropdown-item disabled">No departments found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Payment Method field - now dynamic and mandatory */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">
                        Payment Method <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={(value) => {
                          if (value === "add-new-payment-method") {
                            setPaymentMethodModal({ show: true });
                          } else {
                            field.onChange(value);
                          }
                        }}
                        disabled={paymentMethodsLoading}
                      >
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dropdown-content">
                          {Array.isArray(paymentMethods) && paymentMethods.length > 0 ? (
                            paymentMethods.map((pm: any) => (
                              <SelectItem 
                                key={pm._id || pm.id || pm.name} 
                                value={pm.name}
                                className={`${field.value === pm.name ? 'selected' : ''} dropdown-item`}
                              >
                                {pm.name}
                              </SelectItem>
                            ))
                          ) : null}
                            {/* Add Payment Method option at the end */}
                            <SelectItem 
                              value="add-new-payment-method" 
                              className="dropdown-item font-medium border-t border-gray-200 mt-1 pt-2 text-black"
                            >
                              + New
                            </SelectItem>
                          {Array.isArray(paymentMethods) && paymentMethods.length === 0 && (
                            <SelectItem value="no-method" disabled className="dropdown-item disabled">No payment methods found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-500" />
                    </FormItem>
                  )}
                />

                {/* Owner field - dropdown of employees */}
                <FormField
                  control={form.control}
                  name="owner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Owner</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={(value) => {
                          if (value === "add-new-owner") {
                            setOwnerModal({ show: true });
                          } else {
                            // Find employee by unique ID (stored as "name|email" or just name)
                            const empId = value.includes('|') ? value.split('|')[0] : value;
                            const emp = employeesRaw.find((e: any) => {
                              if (value.includes('|')) {
                                const [name, email] = value.split('|');
                                return e.name === name && e.email === email;
                              }
                              return e.name === value;
                            });
                            
                            field.onChange(emp?.name || value);
                            // Auto-fill ownerEmail if employee exists
                            if (emp?.email) {
                              form.setValue('ownerEmail', emp.email);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dropdown-content">
                          {employeesRaw.length > 0
                            ? employeesRaw.map((emp: any) => {
                                // Check if there are duplicate names
                                const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                                const displayName = duplicateNames.length > 1 
                                  ? `${emp.name} (${emp.email})` 
                                  : emp.name;
                                const uniqueValue = duplicateNames.length > 1
                                  ? `${emp.name}|${emp.email}`
                                  : emp.name;
                                return (
                                  <SelectItem 
                                    key={emp._id || emp.id || emp.email} 
                                    value={uniqueValue} 
                                    className="dropdown-item"
                                  >
                                    {displayName}
                                  </SelectItem>
                                );
                              })
                            : <SelectItem value="no-owner" disabled className="dropdown-item disabled">No owners found</SelectItem>}
                          {/* Add Owner option at the end */}
                          <SelectItem 
                            value="add-new-owner" 
                            className="dropdown-item font-medium border-t border-gray-200 mt-1 pt-2 text-black"
                          >
                            + New
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
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
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-2">Renewal Information</h2>
                <div className="h-px bg-gradient-to-r from-indigo-500 to-blue-500 mt-4"></div>
              </div>
              <div className="grid gap-4 mb-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {/* Auto Renewal - First */}
                <div className="flex flex-col justify-start">
                  <label className="text-sm font-medium text-slate-700 mb-2">Auto Renewal</label>
                  <div className="flex items-center h-10">
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
                {/* Start Date */}
                <div className="w-full flex flex-col">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">
                          Start Date <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            className={`w-full border-slate-300 rounded-lg p-1 text-base ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            value={startDate || ''} 
                            onChange={e => { 
                              setStartDate(e.target.value); 
                              field.onChange(e);
                              // Auto-update next renewal date if Auto Renewal is enabled
                              if (autoRenewal && e.target.value) {
                                const cycle = form.watch("billingCycle") || billingCycle;
                                if (cycle) {
                                  const nextDate = calculateEndDate(e.target.value, cycle);
                                  form.setValue("nextRenewal", nextDate);
                                  setEndDate(nextDate);
                                }
                              }
                            }} 
                            disabled={isEditing}
                            readOnly={isEditing}
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
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-slate-700">
                          Next Renewal Date <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            className={`w-full border-slate-300 rounded-lg p-1 text-base ${isEditing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            value={endDate || ''} 
                            onChange={e => {
                              setEndDate(e.target.value);
                              field.onChange(e);
                              // If nextRenewal matches today's date, update both start and next renewal
                              const todayStr = new Date().toISOString().split('T')[0];
                              if (e.target.value === todayStr) {
                                setStartDate(todayStr);
                                form.setValue("startDate", todayStr);
                                const cycle = form.watch("billingCycle") || billingCycle;
                                const nextDate = calculateEndDate(todayStr, cycle);
                                setEndDate(nextDate);
                                form.setValue("nextRenewal", nextDate);
                              }
                            }} 
                            disabled={isEditing}
                            readOnly={isEditing}
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
                        <FormLabel className="block text-sm font-medium text-slate-700">Reminder Days</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            max="365"
                            disabled={autoRenewal}
                            className="w-full border-slate-300 rounded-lg p-1 text-base" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
              <div className={`grid gap-4 mb-6 ${isFullscreen ? 'grid-cols-1' : 'grid-cols-1'}`}>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          className="w-full border border-slate-400 rounded-lg p-2 text-base min-h-[80px] max-h-[120px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                          
                          rows={3}
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-gray-200 bg-gray-50/50 -mx-8 px-8 -mb-8 pb-8 rounded-b-2xl">
                <Button 
                  type="button" 
                  variant="destructive" 
                  className="font-semibold px-6 py-3 border-2 border-red-600 text-white bg-red-600 hover:bg-red-700 shadow-lg mr-auto rounded-lg transition-all duration-200 hover:shadow-red-500/25"
                  onClick={() => {
                    setCancelRenewalConfirmDialog({ show: true });
                  }}
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
                  disabled={draftMutation.isPending || subscriptionCreated || form.watch('status') === 'Active'}
                  title={
                    subscriptionCreated ? "Draft is not available after subscription is created" : 
                    form.watch('status') === 'Active' ? "Draft is not available for active subscriptions" : 
                    undefined
                  }
                >
                  {draftMutation.isPending ? 'Saving Draft...' : 'Save Draft'}
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
                onOpenChange(false);
                toast({ title: 'Subscription cancelled', description: 'The subscription was marked as Cancelled.' });
                // Update cache immediately for instant table refresh
                if (isEditing && subscription?.id) {
                  queryClient.setQueryData(["/api/subscriptions"], (oldData: any) => {
                    if (!oldData) return oldData;
                    return oldData.map((sub: any) => 
                      sub.id === subscription.id ? { ...sub, status: 'Cancelled' } : sub
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
                    apiRequest("PUT", `/api/subscriptions/${validId}`, { status: 'Cancelled' })
                      .catch((e: any) => {
                        // Revert cache on error and show error
                        queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
                        toast({ title: 'Update failed', description: e?.message || 'Failed to update subscription status', variant: 'destructive' });
                      });
                  }
                } else {
                  queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white shadow-md px-6 py-2"
            >
              Yes, Cancel Renewal
            </AlertDialogAction>
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

      {/* Category Creation Modal */}
      <AlertDialog open={categoryModal.show} onOpenChange={(open) => !open && setCategoryModal({ show: false })}>
        <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl font-inter">
          <AlertDialogHeader className="bg-indigo-600 text-white p-6 rounded-t-lg -m-6 mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 13a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-white">
                Add New Category
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <div className="space-y-4">
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
          <AlertDialogFooter className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setCategoryModal({ show: false });
                setNewCategoryName('');
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-300"
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
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder=""
                  value={newPaymentMethodName}
                  onChange={(e) => setNewPaymentMethodName(e.target.value)}
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
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Credit">Credit Card</SelectItem>
                    <SelectItem value="Debit">Debit Card</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Digital Wallet">Digital Wallet</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Input
                  placeholder=""
                  value={newPaymentMethodDescription}
                  onChange={(e) => setNewPaymentMethodDescription(e.target.value)}
                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Managed by</label>
                <Select value={newPaymentMethodManagedBy} onValueChange={setNewPaymentMethodManagedBy}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent className="dropdown-content">
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
                            className="dropdown-item"
                          >
                            {displayName}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="no-employee" disabled className="dropdown-item disabled">No employees found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="w-1/2 pr-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires at</label>
              <Input
                type="date"
                placeholder="dd-mm-yyyy"
                value={newPaymentMethodExpiresAt}
                onChange={(e) => setNewPaymentMethodExpiresAt(e.target.value)}
                className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Card Image</label>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { value: 'visa', label: 'Visa', img: cardImages.visa },
                  { value: 'mastercard', label: 'MasterCard', img: cardImages.mastercard },
                  { value: 'paypal', label: 'PayPal', img: cardImages.paypal },
                  { value: 'amex', label: 'Amex', img: cardImages.amex },
                  { value: 'apple_pay', label: 'Apple Pay', img: cardImages.apple_pay },
                  { value: 'google_pay', label: 'Google Pay', img: cardImages.google_pay },
                  { value: 'bank', label: 'Bank', img: cardImages.bank },
                  { value: 'cash', label: 'Cash', img: cardImages.cash },
                  { value: 'other', label: 'Other', img: cardImages.other },
                ].map((card) => (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => setNewPaymentMethodCardImage(card.value)}
                    className={`relative p-3 border-2 rounded-lg bg-white hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 ${
                      newPaymentMethodCardImage === card.value 
                        ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-500 ring-opacity-20' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    title={card.label}
                  >
                    <img src={card.img} alt={card.label} className="w-12 h-8 object-contain mx-auto" />
                    {newPaymentMethodCardImage === card.value && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <AlertDialogFooter className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setPaymentMethodModal({ show: false });
                setNewPaymentMethodName('');
                setNewPaymentMethodType('');
                setNewPaymentMethodDescription('');
                setNewPaymentMethodManagedBy('');
                setNewPaymentMethodExpiresAt('');
                setNewPaymentMethodCardImage('visa');
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddPaymentMethod}
              disabled={!newPaymentMethodName.trim() || !newPaymentMethodType}
              className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-300"
            >
              Create Payment Method
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
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <Select value={newOwnerDepartment} onValueChange={setNewOwnerDepartment}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(departments) && departments.length > 0 ? (
                      departments
                        .filter((dept) => dept.visible)
                        .map((dept) => (
                          <SelectItem key={dept.name} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value="no-department" disabled>
                        No departments found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
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
                setNewOwnerStatus('Active');
                setNewOwnerDepartment('');
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddOwner}
              disabled={!newOwnerName.trim() || !newOwnerEmail.trim()}
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
        <DialogContent className="max-w-2xl bg-white shadow-2xl border-2 border-gray-200">
          <DialogHeader className="border-b border-gray-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-gray-900">Manage Documents</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 bg-white">
            {/* Document List */}
            {documents.length > 0 && (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2">
                {documents.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-600 truncate">
                          {doc.url.startsWith('data:application/pdf') ? 'PDF Document' : 
                           doc.url.startsWith('data:image') ? 'Image File' : 'Document'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
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
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDocuments(documents.filter((_, i) => i !== index));
                          toast({
                            title: "Document Removed",
                            description: `${doc.name} has been removed`,
                            duration: 2000,
                          });
                        }}
                        className="p-1.5 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <button
              type="button"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
                input.onchange = async (e: any) => {
                  const file = e.target?.files?.[0];
                  if (file) {
                    try {
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64String = reader.result as string;
                        const newDocName = `File ${documents.length + 1}`;
                        setDocuments([...documents, {name: newDocName, url: base64String}]);
                        toast({
                          title: "Success",
                          description: `${newDocName} uploaded successfully`,
                          duration: 2000,
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
              className="w-full py-6 border-2 border-dashed border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg hover:border-blue-600 hover:bg-gradient-to-br hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 flex flex-col items-center justify-center gap-2 text-blue-700 hover:text-blue-900"
            >
              <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Click to Upload Document</span>
              <span className="text-xs text-gray-600">PDF, DOC, DOCX, JPG, JPEG, PNG (up to 50MB)</span>
            </button>
          </div>
          <div className="flex justify-between items-center gap-3 pt-3 border-t border-gray-200 bg-gray-50 -mx-6 px-6 -mb-6 pb-4 rounded-b-lg">
            <span className="text-xs text-gray-600">
              {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
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
    </>
  );
}

// Helper to get valid ObjectId for subscription
function getValidObjectId(id: any) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
    ? id
    : (id?.toString?.() || "");
}