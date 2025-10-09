import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
// Removed unused Popover related imports
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
  currency?: string;
  department?: string;
  owner?: string;
  paymentMethod?: string;
  autoRenewal?: boolean;
};
import { z } from "zod";
import { CreditCard, X, History, RefreshCw, Maximize2, Minimize2, AlertCircle } from "lucide-react";
// Define the Category interface
interface Category {
  name: string;
  visible: boolean;
}
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
  vendor: z.string().optional(),
  currency: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  billingCycle: z.string().optional(),
  category: z.string().optional(),
  department: z.string().optional(),
  departments: z.array(z.string()).optional(),
  owner: z.string().optional(),
  status: z.string().optional(),
  paymentFrequency: z.string().optional(),
  reminderDays: z.number().optional(),
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
  const { data: employeesRaw = [] } = useQuery({
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
  const parseDepartments = (deptString?: string) => {
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
      vendor: subscription?.vendor || "",
      currency: subscription?.currency || "",
      amount: subscription?.amount !== undefined && subscription?.amount !== null ? String(subscription.amount) : "",
      billingCycle: subscription?.billingCycle && subscription?.billingCycle !== "" ? subscription.billingCycle : "monthly",
      category: subscription?.category || "",
      department: subscription?.department || "",
      departments: parseDepartments(subscription?.department),
      owner: subscription?.owner || "",
      paymentMethod: subscription?.paymentMethod || "",
      startDate: subscription?.startDate ? new Date(subscription.startDate ?? "").toISOString().split('T')[0] : "",
      nextRenewal: subscription?.nextRenewal ? new Date(subscription.nextRenewal ?? "").toISOString().split('T')[0] : "",
  status: subscription?.status && subscription?.status !== "" ? subscription.status : "Draft",
      reminderDays: subscription?.reminderDays || 7,
      reminderPolicy: subscription?.reminderPolicy && subscription?.reminderPolicy !== "" ? subscription.reminderPolicy : "One time",
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
  
  const [startDate, setStartDate] = useState(subscription?.startDate ? new Date(subscription.startDate ?? "").toISOString().split('T')[0] : "");
  const [billingCycle, setBillingCycle] = useState(subscription?.billingCycle || "monthly");
  const [endDate, setEndDate] = useState(subscription?.nextRenewal ? new Date(subscription.nextRenewal ?? "").toISOString().split('T')[0] : "");
  // Removed unused endDateManuallySet state
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(parseDepartments(subscription?.department));
  // Removed unused isPopoverOpen state
  const [isRenewing, setIsRenewing] = useState(false);
  const [lcyAmount, setLcyAmount] = useState<string>('');
  
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
      
      // Reset form
      form.reset({
        serviceName: "",
        vendor: "",
        currency: "",
        amount: "",
        billingCycle: "monthly",
        category: "",
        department: "",
        departments: [],
        owner: "",
        paymentMethod: "",
        startDate: "",
        nextRenewal: "",
        status: "Draft",
        reminderDays: 7,
        reminderPolicy: "One time",
        notes: "",
        isActive: true,
      });
    }
  }, [open, subscription, form]);
  
  useEffect(() => {
    if (subscription) {
      const start = subscription.startDate ? new Date(subscription.startDate ?? "").toISOString().split('T')[0] : "";
      const end = subscription.nextRenewal ? new Date(subscription.nextRenewal ?? "").toISOString().split('T')[0] : "";
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
      
      form.reset({
        serviceName: subscription.serviceName || "",
        vendor: subscription.vendor || "",
        currency: subscription.currency || "",
        amount: subscription.amount !== undefined && subscription.amount !== null ? String(subscription.amount) : "",
        billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "monthly",
        category: subscription.category || "",
        department: subscription.department || "",
        departments: depts,
        owner: subscription.owner || "",
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
        const amount = subscription.amount !== undefined && subscription.amount !== null ? String(subscription.amount) : "";
        const currency = subscription.currency || "";
        const localCurrency = companyInfo?.defaultCurrency;
        
        if (amount && currency && localCurrency && currency !== localCurrency) {
          const selectedCurrency = currencies.find((curr: any) => curr.code === currency);
          const exchangeRate = selectedCurrency?.exchangeRate ? parseFloat(selectedCurrency.exchangeRate) : null;
          
          if (exchangeRate && exchangeRate > 0) {
            const amountNum = parseFloat(amount);
            const convertedAmount = amountNum * exchangeRate;
            setLcyAmount(convertedAmount.toFixed(2));
          }
        } else if (currency === localCurrency && amount) {
          setLcyAmount(amount);
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
        vendor: "",
        currency: "",
        amount: "",
        billingCycle: "monthly",
        category: "",
        department: "",
        departments: [],
        owner: "",
        paymentMethod: "",
        startDate: "",
        nextRenewal: "",
  status: "Draft",
        reminderDays: 7,
        reminderPolicy: "One time",
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

  // Calculate LCY Amount based on amount, currency, and exchange rate
  useEffect(() => {
    const calculateLcyAmount = () => {
      const amount = form.watch('amount');
      const currency = form.watch('currency');
      const localCurrency = companyInfo?.defaultCurrency;
      
      if (!amount || !currency || !localCurrency || currency === localCurrency) {
        setLcyAmount(currency === localCurrency ? amount?.toString() || '' : '');
        return;
      }
      
      // Find the selected currency and its exchange rate
      const selectedCurrency = currencies.find((curr: any) => curr.code === currency);
      const exchangeRate = selectedCurrency?.exchangeRate ? parseFloat(selectedCurrency.exchangeRate) : null;
      
      if (exchangeRate && exchangeRate > 0) {
        const amountNum = parseFloat(amount?.toString() || '0');
        const convertedAmount = amountNum * exchangeRate;
        setLcyAmount(convertedAmount.toFixed(2));
      } else {
        setLcyAmount('');
      }
    };
    
    calculateLcyAmount();
  }, [form.watch('amount'), form.watch('currency'), companyInfo?.defaultCurrency, currencies, subscription]);

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
      }, 300);
    },
    onError: (error: any) => {
      if (isEditing) {
        toast({
          title: "Success",
          description: "Subscription updated successfully",
        });
        onOpenChange(false);
        setTimeout(() => {
          form.reset();
        }, 300);
        queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      } else {
        toast({
          title: "Error",
          description: error?.response?.data?.message || error.message || `Failed to create subscription`,
          variant: "destructive",
        });
      }
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
      // Get tenantId from context, state, or user info
  const tenantId = String((window as any).currentTenantId || (window as any).user?.tenantId || "");
      const payload = {
        ...data,
        status: 'Active', // Always save as active
        autoRenewal: autoRenewal, // Add auto renewal from state
        amount: isNaN(amountNum) ? 0 : amountNum,
        departments: selectedDepartments,
        department: JSON.stringify(selectedDepartments),
        startDate: new Date(data.startDate ?? ""),
        nextRenewal: data.nextRenewal ? new Date(data.nextRenewal) : new Date(),
        tenantId,
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
          
          // Prepare payload for API
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
            tenantId,
          };
          
          // Save to backend
          const subId = subscription?.id;
          if (subId) {
            // Ensure subId is a valid ObjectId string
            const validSubscriptionId = typeof subId === 'string' && /^[a-f\d]{24}$/i.test(subId)
              ? subId
              : (subId?.toString?.() || "");
            await apiRequest("PUT", `/api/subscriptions/${validSubscriptionId}`, payload);
            // Insert into history table
            await axios.post(`${API_BASE_URL}/api/history`, {
              subscriptionId: validSubscriptionId,
              data: payload,
              action: "renew"
            }, {
              withCredentials: true,
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
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
      
      // Prepare payload for API
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
        tenantId,
      };
      
      // Save to backend
      const subId = subscription?.id;
      if (subId) {
        // Ensure subId is a valid ObjectId string
        const validSubscriptionId = typeof subId === 'string' && /^[a-f\d]{24}$/i.test(subId)
          ? subId
          : (subId?.toString?.() || "");
        await apiRequest("PUT", `/api/subscriptions/${validSubscriptionId}`, payload);
        // Insert into history table
        await axios.post(`${API_BASE_URL}/api/history`, {
          subscriptionId: validSubscriptionId,
          data: payload,
          action: "renew"
        }, {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
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
                    status === 'Active' 
                      ? 'bg-emerald-500 text-white' 
                      : status === 'Cancelled' 
                        ? 'bg-rose-500 text-white' 
                        : 'bg-orange-500 text-white'
                  }`}
                >
                  {status}
                </span>
              </div>
            </div>
            <div className="flex gap-3 items-center ml-auto mr-6">
              <Button
                type="button"
                variant="outline"
                className="bg-white text-indigo-600 hover:bg-gray-50 font-medium px-4 py-2 rounded-lg transition-all duration-200 min-w-[80px] border-white shadow-sm"
                onClick={() => window.location.href = "/subscription-user"}
              >
                User
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-white text-indigo-600 hover:bg-gray-50 font-medium px-4 py-2 rounded-lg transition-all duration-200 min-w-[80px] flex items-center gap-2 border-white shadow-sm"
                onClick={handleRenew}
                disabled={isRenewing || !endDate || !billingCycle}
              >
                {isRenewing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Renew
              </Button>
              {/* Updated History Button - Always visible but disabled when adding new subscription */}
              <Button
                type="button"
                variant="outline"
                className={`bg-white text-indigo-600 hover:bg-gray-50 font-medium px-4 py-2 rounded-lg transition-all duration-200 min-w-[80px] flex items-center gap-2 border-white shadow-sm ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                View
              </Button>
              <Button
                type="button"
                variant="outline"
                title={isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                className="bg-white text-indigo-600 hover:bg-gray-50 font-medium px-3 py-2 rounded-lg transition-all duration-200 h-10 w-10 p-0 flex items-center justify-center border-white shadow-sm"
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
                            // Auto-capitalize each word
                            const capitalizedValue = e.target.value
                              .split(' ')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                              .join(' ');
                            field.onChange(capitalizedValue);
                            // Validate uniqueness
                            validateServiceName(capitalizedValue);
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Vendor</FormLabel>
                      <FormControl>
                        <Input 
                          className="w-full border-gray-300 rounded-lg p-3 text-base font-medium bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200" 
                          {...field} 
                          
                        />
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
                        <FormLabel className="block text-sm font-semibold text-gray-900 tracking-tight mb-2">Amount</FormLabel>
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
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />
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
                      placeholder={
                        !companyInfo?.defaultCurrency ? 'Set local currency in Company Details' :
                        !form.watch('currency') ? 'Select currency' :
                        form.watch('currency') === companyInfo?.defaultCurrency ? 'Same as amount' :
                        !currencies.find((c: any) => c.code === form.watch('currency'))?.exchangeRate ? 'Set exchange rate in Currency Settings' :
                        'Calculated automatically'
                      }
                    />
                    {form.watch('currency') && form.watch('currency') !== companyInfo?.defaultCurrency && lcyAmount && (
                      <div className="text-xs text-gray-500 mt-2 font-medium">
                        Exchange rate: {currencies.find((c: any) => c.code === form.watch('currency'))?.exchangeRate || 'Not set'}
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Category</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={(value) => {
                          if (value === "add-new-category") {
                            window.location.href = "/company-details?tab=subscription-category";
                          } else {
                            field.onChange(value);
                          }
                        }}
                        disabled={categoriesLoading}
                      >
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dropdown-content">
                          {Array.isArray(categories) && categories.length > 0 ? (
                            categories
                              .filter(cat => cat.visible)
                              .map(cat => (
                                <SelectItem key={cat.name} value={cat.name} className={`${field.value === cat.name ? 'selected' : ''} dropdown-item`}>{cat.name}</SelectItem>
                              ))
                          ) : null}
                            {/* Add Category option at the end */}
                            <SelectItem 
                              value="add-new-category" 
                              className="dropdown-item font-medium border-t border-gray-200 mt-1 pt-2 text-black"
                            >
                              + New
                            </SelectItem>
                          {Array.isArray(categories) && categories.filter(cat => cat.visible).length === 0 && (
                            <SelectItem value="no-category" disabled className="dropdown-item disabled">No categories found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
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
                            onClick={() => window.location.href = "/company-details?tab=department"}
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
                            window.location.href = "/reminders?tab=payment";
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
                            window.location.href = "/company-details?tab=employees";
                          } else {
                            field.onChange(value);
                          }
                        }}
                        disabled={employeesRaw.length === 0}
                      >
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dropdown-content">
                          {employeesRaw.length > 0 ? (
                            employeesRaw.map((emp: any) => (
                              <SelectItem key={emp._id || emp.id || emp.name} value={emp.name} className="dropdown-item">
                                {emp.name}
                              </SelectItem>
                            ))
                          ) : null}
                          <div className="border-t">
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center"
                              onClick={() => window.location.href = '/company-details?tab=employee'}
                            >
                              + New
                            </button>
                          </div>
                          {employeesRaw.length === 0 && (
                            <SelectItem value="no-owner" disabled className="dropdown-item disabled">No owners found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Dynamic Fields from Configuration - now rendered after all static fields */}
                {dynamicFields.length > 0 && (
                  <div className={`grid gap-6 mb-6 ${isFullscreen ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
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
                  </div>
                )}
              </div>
              {/* Professional Renewal Section Header */}
              <div className="mt-10 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-2">Renewal Information</h2>
                <div className="h-px bg-gradient-to-r from-indigo-500 to-blue-500 mt-4"></div>
              </div>
              <div className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
                            className="w-full border-slate-300 rounded-lg p-1 text-base" 
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
                            className="w-full border-slate-300 rounded-lg p-1 text-base" 
                            value={endDate || ''} 
                            onChange={e => {
                              // removed manual end date flag
                              setEndDate(e.target.value);
                              field.onChange(e);
                              // If auto renewal is enabled and new value is today, update both start and next renewal
                              if (autoRenewal) {
                                const todayStr = new Date().toISOString().split('T')[0];
                                if (e.target.value === todayStr) {
                                  setStartDate(todayStr);
                                  form.setValue("startDate", todayStr);
                                  const cycle = form.watch("billingCycle") || billingCycle;
                                  const nextDate = calculateEndDate(todayStr, cycle);
                                  setEndDate(nextDate);
                                  form.setValue("nextRenewal", nextDate);
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
                {/* Reminder Policy + Auto Renewal side by side */}
                <div className={`${isFullscreen ? 'col-span-2' : 'col-span-1 md:col-span-2'} flex flex-col md:flex-row items-start gap-4`}>
                  <div className="flex-1 w-full">
                    <FormField
                      control={form.control}
                      name="reminderPolicy"
                      render={({ field }) => {
                        const reminderDays = form.watch("reminderDays");
                        const isOnlyOneTimeAllowed = reminderDays === 1;
                        return (
                          <FormItem>
                            <FormLabel className="block text-sm font-medium text-slate-700">Reminder Policy</FormLabel>
                            <Select 
                              onValueChange={(val: string) => {
                                if (["One time", "Two times", "Until Renewal"].includes(val)) {
                                  field.onChange(val);
                                } else {
                                  field.onChange("One time");
                                }
                              }}
                              value={field.value && ["One time", "Two times", "Until Renewal"].includes(field.value) ? field.value : "One time"}
                              defaultValue={field.value && ["One time", "Two times", "Until Renewal"].includes(field.value) ? field.value : "One time"}
                              disabled={isOnlyOneTimeAllowed}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="dropdown-content">
                                <SelectItem value="One time" className={`${field.value === 'One time' ? 'selected' : ''} dropdown-item`}>One time</SelectItem>
                                <SelectItem value="Two times" disabled={isOnlyOneTimeAllowed} className={`${field.value === 'Two times' ? 'selected' : ''} dropdown-item ${isOnlyOneTimeAllowed ? 'disabled' : ''}`}>Two times</SelectItem>
                                <SelectItem value="Until Renewal" disabled={isOnlyOneTimeAllowed} className={`${field.value === 'Until Renewal' ? 'selected' : ''} dropdown-item ${isOnlyOneTimeAllowed ? 'disabled' : ''}`}>Until Renewal</SelectItem>
                              </SelectContent>
                            </Select>
                            <ul className="text-xs text-slate-600 mt-2 list-disc pl-4">
                              <li>One time: One reminder at {reminderDays} days before renewal</li>
                              <li>Two times: Reminders at {reminderDays ?? 7} and {Math.floor((reminderDays ?? 7)/2)} days before</li>
                              <li>Until Renewal: Daily reminders from {reminderDays} days until renewal</li>
                            </ul>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                  <div className="flex flex-col justify-start md:justify-end md:pt-1 w-full md:w-auto">
                    <label className="text-sm font-medium text-slate-700 mb-2">Auto Renewal</label>
                    <button
                      type="button"
                      className={`relative inline-flex h-6 w-12 items-center rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoRenewal ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                      }`}
                      onClick={() => {
                        const newAutoRenewal = !autoRenewal;
                        setAutoRenewal(newAutoRenewal);
                        // Auto-update next renewal date when enabled based on commitment cycle
                        if (newAutoRenewal) {
                          const cycle = form.watch("billingCycle") || billingCycle;
                          let s = form.watch("startDate") || startDate;
                          let n = form.watch("nextRenewal") || endDate;
                          const todayStr = new Date().toISOString().split('T')[0];
                          if (n === todayStr) {
                            s = todayStr;
                            n = calculateEndDate(todayStr, cycle);
                            form.setValue("startDate", s);
                            setStartDate(s);
                            form.setValue("nextRenewal", n);
                            setEndDate(n);
                          } else if (cycle && s) {
                            const nextDate = calculateEndDate(s, cycle);
                            form.setValue("nextRenewal", nextDate);
                            setEndDate(nextDate);
                          }
                        }
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
                >
                  Cancel Renewal
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-6 py-3 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
                  onClick={() => onOpenChange(false)}
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
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Saving...' : isEditing ? 'Update Subscription' : 'Save Subscription'}
                </Button>
              </div>
            </form>
          </Form>
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