import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/config";
// Type for dynamic subscription fields
interface SubscriptionField {
  name: string;
  enabled: boolean;
  type?: string;
}
// ...existing code...
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertSubscriptionSchema } from "@shared/schema";
import type { InsertSubscription, Subscription } from "@shared/schema";
// Extend Subscription for modal usage to include extra fields
type SubscriptionModalData = Partial<Subscription> & {
  currency?: string;
  department?: string;
  owner?: string;
  paymentMethod?: string;
};
import { z } from "zod";
import { CreditCard, X, ChevronDown, Check, History, RefreshCw } from "lucide-react";
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
// Update the form schema to handle multiple departments
const formSchema = z.object({
  startDate: z.string().optional(),
  nextRenewal: z.string().optional(),
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
  
  // Track the current subscription ObjectId for History button
  const [currentSubscriptionId, setCurrentSubscriptionId] = useState<string | undefined>();
  
  useEffect(() => {
    if (open) {
      if (subscription?.id) {
        setCurrentSubscriptionId(subscription.id);
      } else {
        setCurrentSubscriptionId(undefined);
      }
    } else {
      setTimeout(() => {
        setCurrentSubscriptionId(undefined);
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
    }
  });
  
  // Dynamic subscription fields from config
  const [dynamicFields, setDynamicFields] = useState<SubscriptionField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  
  // Employee list for Owner dropdown (from /api/employee)
  // Fetch employees from /api/employees (plural) to match company-details.tsx
  const { data: employeesRaw = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/employees`, { credentials: 'include' });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  
  // Map _id to id for frontend usage (like company-details)
  const employees = employeesRaw.map((emp: any) => ({ ...emp, id: emp._id }));
  
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
    setFieldsLoading(true);
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
      .finally(() => setFieldsLoading(false));
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
      status: subscription?.status && subscription?.status !== "" ? subscription.status : "Active",
      reminderDays: subscription?.reminderDays || 7,
      reminderPolicy: subscription?.reminderPolicy && subscription?.reminderPolicy !== "" ? subscription.reminderPolicy : "One time",
      notes: subscription?.notes || "",
      isActive: subscription?.isActive ?? true,
    },
  });
  
  const [startDate, setStartDate] = useState(subscription?.startDate ? new Date(subscription.startDate ?? "").toISOString().split('T')[0] : "");
  const [billingCycle, setBillingCycle] = useState(subscription?.billingCycle || "monthly");
  const [endDate, setEndDate] = useState(subscription?.nextRenewal ? new Date(subscription.nextRenewal ?? "").toISOString().split('T')[0] : "");
  const [endDateManuallySet, setEndDateManuallySet] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(parseDepartments(subscription?.department));
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  
  // Refetch data when modal opens
  useEffect(() => {
    if (open) {
      refetchCategories();
      refetchDepartments();
    }
  }, [open, refetchCategories, refetchDepartments]);
  
  useEffect(() => {
    if (subscription) {
      const start = subscription.startDate ? new Date(subscription.startDate ?? "").toISOString().split('T')[0] : "";
      const end = subscription.nextRenewal ? new Date(subscription.nextRenewal ?? "").toISOString().split('T')[0] : "";
      const depts = parseDepartments(subscription.department);
      
      setStartDate(start);
      setBillingCycle(subscription.billingCycle || "monthly");
      setEndDate(end);
      setEndDateManuallySet(!!end);
      setSelectedDepartments(depts);
      
      form.reset({
        serviceName: subscription.serviceName || "",
        vendor: subscription.vendor || "",
        amount: subscription.amount !== undefined && subscription.amount !== null ? String(subscription.amount) : "",
        billingCycle: subscription.billingCycle && subscription.billingCycle !== "" ? subscription.billingCycle : "monthly",
        category: subscription.category || "",
        department: subscription.department || "",
        departments: depts,
        owner: subscription.owner || "",
        startDate: start,
        nextRenewal: end,
        status: subscription.status && subscription.status !== "" ? subscription.status : "Active",
        reminderDays: subscription.reminderDays || 7,
        reminderPolicy: subscription.reminderPolicy && subscription.reminderPolicy !== "" ? subscription.reminderPolicy : "One time",
        notes: subscription.notes || "",
        isActive: subscription.isActive ?? true,
      });
    } else {
      setStartDate("");
      setBillingCycle("monthly");
      setEndDate("");
      setEndDateManuallySet(false);
      setSelectedDepartments([]);
      
      form.reset({
        serviceName: "",
        vendor: "",
        amount: "",
        billingCycle: "monthly",
        category: "",
        department: "",
        departments: [],
        owner: "",
        startDate: "",
        nextRenewal: "",
        status: "Active",
        reminderDays: 7,
        reminderPolicy: "One time",
        notes: "",
        isActive: true,
      });
    }
  }, [subscription, form]);
  
  useEffect(() => {
    if (startDate && billingCycle) {
      if (!endDateManuallySet || (subscription && startDate !== (subscription.startDate ? new Date(subscription.startDate).toISOString().split('T')[0] : ""))) {
        const calculatedEndDate = calculateEndDate(startDate, billingCycle);
        setEndDate(calculatedEndDate);
        form.setValue('nextRenewal', calculatedEndDate);
        setEndDateManuallySet(false);
      }
    }
  }, [startDate, billingCycle, endDateManuallySet, form]);
  
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
      if (isEditing && subId) {
        res = await apiRequest("PUT", `/api/subscriptions/${subId}`, subscriptionData);
      } else {
        res = await apiRequest("POST", "/api/subscriptions", subscriptionData);
      }
      return res.json();
    },
    onSuccess: async (data, variables) => {
      // Use only the subscription's id
      if (subscription?.id) {
        setCurrentSubscriptionId(subscription.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/categories"] });
      // Insert into history table
      try {
        const subId = subscription?.id || data.insertedId;
        // Only create history record if we have a subscription ID
        if (subId) {
          await axios.post("/api/history", {
            subscriptionId: subId.toString(),
            data: {
              ...variables,
              serviceName: variables.serviceName,
              owner: variables.owner,
              startDate: variables.startDate,
              nextRenewal: variables.nextRenewal,
              status: variables.status,
            },
            timestamp: new Date().toISOString(),
            action: isEditing ? "update" : "create"
          });
        }
      } catch (e) {
        // Optionally show a toast if history fails
        console.error("Failed to save history:", e);
      }
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
  
  const onSubmit = async (data: FormData) => {
    try {
      // Always include department as JSON string for backend
      // Ensure amount is a number
      const amountNum = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount ?? 0;
      // Get tenantId from context, state, or user info
  const tenantId = String((window as any).currentTenantId || (window as any).user?.tenantId || "");
      const payload = {
        ...data,
        amount: isNaN(amountNum) ? 0 : amountNum,
        departments: selectedDepartments,
        department: JSON.stringify(selectedDepartments),
        startDate: new Date(data.startDate ?? ""),
        nextRenewal: data.nextRenewal ? new Date(data.nextRenewal) : new Date(),
        tenantId,
      };
      if (isEditing) {
        // Update existing subscription
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
          
          if (subscriptionId) {
            // Create history record using the same payload that created the subscription
            try {
              await apiRequest("POST", "/api/history", {
                subscriptionId: subscriptionId,
                data: payload,
                action: "create",
                timestamp: new Date().toISOString()
              });
              
              // Dispatch subscription creation event
              if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('subscription-created', { 
                  detail: { ...payload, _id: subscriptionId }
                }));
              }
            } catch (historyError) {
              console.error("Failed to create history record:", historyError);
              toast({
                title: "Warning",
                description: "Subscription saved, but failed to create history.",
                variant: "destructive",
              });
            }
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
  
  // Handle popover open/close
  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);
    if (open) {
      refetchDepartments();
    }
  };
  
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
    setTimeout(async () => {
      const { newStartDate, newEndDate } = calculateRenewalDates(endDate, billingCycle);
      setStartDate(newStartDate);
      setEndDate(newEndDate);
      form.setValue('startDate', newStartDate);
      form.setValue('nextRenewal', newEndDate);
      setEndDateManuallySet(true);
      // Save to main table
      const payload = {
        ...form.getValues(),
        startDate: newStartDate,
        nextRenewal: newEndDate,
      };
      try {
        const subId = subscription?.id;
        if (subId) {
          await apiRequest("PUT", `/api/subscriptions/${subId}`, payload);
        }
        // Insert into history table
        await axios.post("/api/history", {
          subscriptionId: subId,
          data: payload,
          action: "renew"
        });
      } catch (e) {}
      setIsRenewing(false);
      toast({
        title: "Subscription Renewed",
        description: `Subscription renewed from ${formatDate(newStartDate)} to ${formatDate(newEndDate)}`,
      });
      onOpenChange(false);
    }, 500);
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
  `;
  
  return (
    <>
      <style>{animationStyles}</style>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl min-w-[400px] max-h-[80vh] overflow-y-auto rounded-2xl border-slate-200 shadow-2xl p-0 bg-white">
          <DialogHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6 rounded-t-2xl flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6" />
              <DialogTitle className="text-xl font-bold">
                {isEditing ? 'Edit Subscription' : 'Add New Subscription'}
              </DialogTitle>
            </div>
            <div className="flex gap-3 items-center ml-auto mr-6">
              <Button
                type="button"
                variant="outline"
                className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-5 py-2 rounded-lg shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 min-w-[90px] border-indigo-200"
                onClick={() => window.location.href = "/subscription-user"}
              >
                User
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-5 py-2 rounded-lg shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 min-w-[90px] border-indigo-200 flex items-center gap-2"
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
                className={`bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-5 py-2 rounded-lg shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 min-w-[90px] border-indigo-200 flex items-center gap-2 ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            </div>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Static Fields */}
                <FormField
                  control={form.control}
                  name="serviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Service Name</FormLabel>
                      <FormControl>
                        <Input 
                          className="w-full border-slate-300 rounded-lg p-2 text-base" 
                          {...field} 
                          placeholder="Enter service name" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Vendor</FormLabel>
                      <FormControl>
                        <Input 
                          className="w-full border-slate-300 rounded-lg p-2 text-base" 
                          {...field} 
                          placeholder="Enter vendor name" 
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
                      <FormLabel className="block text-sm font-medium text-slate-700">Currency</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full bg-white border border-blue-300 rounded-lg shadow-sm p-2 text-base focus:ring-2 focus:ring-blue-500">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-blue-200 shadow-xl rounded-lg">
                          {currencies && currencies.length > 0 ? (
                            currencies.map((curr: any) => (
                              <SelectItem key={curr.code} value={curr.code}>
                                {curr.symbol} {curr.code} - {curr.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-currency" disabled>
                              No currencies configured
                            </SelectItem>
                          )}
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
                      <FormLabel className="block text-sm font-medium text-slate-700">Amount</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          className="w-full border-slate-300 rounded-lg p-2 text-base text-right font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                          {...field} 
                          placeholder="0.00" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingCycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Billing Cycle</FormLabel>
                      <Select value={billingCycle} onValueChange={(val: string) => { setBillingCycle(val); field.onChange(val); }}>
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue placeholder="Select cycle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
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
                      <FormLabel className="block text-sm font-medium text-slate-700">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
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
                        onValueChange={field.onChange}
                        disabled={categoriesLoading}
                      >
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select category"} />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(categories) && categories.length > 0 ? (
                            categories
                              .filter(cat => cat.visible)
                              .map(cat => (
                                <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                              ))
                          ) : (
                            <SelectItem value="no-category" disabled>No categories found</SelectItem>
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
                      <div className="space-y-2">
                        <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isPopoverOpen}
                              className="w-full justify-between border-slate-300 rounded-lg p-2 text-base h-10"
                            >
                              {selectedDepartments.length > 0 
                                ? `${selectedDepartments.length} department${selectedDepartments.length > 1 ? 's' : ''} selected`
                                : "Select departments"}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <div className="max-h-60 overflow-auto p-2">
                              {Array.isArray(departments) && departments.length > 0 ? (
                                departments
                                  .filter(dept => dept.visible)
                                  .map(dept => (
                                    <div key={dept.name} className="flex items-center space-x-2 px-2 py-2 hover:bg-slate-100 rounded-md">
                                      <Checkbox
                                        id={`dept-${dept.name}`}
                                        checked={selectedDepartments.includes(dept.name)}
                                        onCheckedChange={(checked: boolean) => handleDepartmentChange(dept.name, checked)}
                                        disabled={departmentsLoading}
                                      />
                                      <label
                                        htmlFor={`dept-${dept.name}`}
                                        className="text-sm font-medium cursor-pointer flex-1"
                                      >
                                        {dept.name}
                                      </label>
                                      {selectedDepartments.includes(dept.name) && (
                                        <Check className="h-4 w-4 text-indigo-600" />
                                      )}
                                    </div>
                                  ))
                              ) : (
                                <div className="px-2 py-2 text-sm text-gray-500">No departments found</div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        
                        {/* Display selected departments as badges */}
                        {selectedDepartments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedDepartments.map((dept) => (
                              <Badge key={dept} variant="secondary" className="flex items-center gap-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-200">
                                {dept}
                                <button
                                  type="button"
                                  onClick={() => removeDepartment(dept)}
                                  className="ml-1 rounded-full hover:bg-indigo-300"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Owner field as dynamic dropdown */}
                <FormField
                  control={form.control}
                  name="owner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Owner</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        disabled={employeesLoading}
                      >
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue placeholder={employeesLoading ? 'Loading employees...' : 'Select owner'} />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(employees) && employees.length > 0 ? (
                            employees.map(emp => (
                              <SelectItem key={emp.id || emp._id || emp.name} value={emp.name}>
                                {emp.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-employee" disabled>No employees found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Payment Method field - now dynamic */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Payment Method</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        disabled={paymentMethodsLoading}
                      >
                        <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                          <SelectValue placeholder={paymentMethodsLoading ? 'Loading...' : 'Select payment method'} />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(paymentMethods) && paymentMethods.length > 0 ? (
                            paymentMethods.map((pm: any) => (
                              <SelectItem key={pm._id || pm.id || pm.name} value={pm.name}>{pm.name}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-method" disabled>No payment methods found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Dynamic Fields from Configuration - now rendered after all static fields */}
                {fieldsLoading ? (
                  <div className="col-span-full flex justify-center py-4">
                    <span className="text-gray-500 text-sm">Loading fields...</span>
                  </div>
                ) : dynamicFields.length > 0 && (
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
                                  placeholder={`Enter ${field.name}`}
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
                                  placeholder={`Enter ${field.name}`}
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
              <h2 className="text-lg font-semibold mt-6 mb-3">Date Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          className="w-full border-slate-300 rounded-lg p-2 text-base" 
                          value={startDate} 
                          onChange={e => { setStartDate(e.target.value); field.onChange(e); }} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nextRenewal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">End Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          className="w-full border-slate-300 rounded-lg p-2 text-base" 
                          value={endDate} 
                          onChange={e => {
                            setEndDateManuallySet(true);
                            setEndDate(e.target.value);
                            field.onChange(e);
                          }} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                          className="w-full border-slate-300 rounded-lg p-2 text-base" 
                          placeholder="7"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                              <SelectValue placeholder="Select policy" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="One time" className="bg-white text-black px-3 py-2 hover:bg-blue-50">One time</SelectItem>
                            <SelectItem value="Two times" disabled={isOnlyOneTimeAllowed} className="bg-white text-black px-3 py-2 hover:bg-blue-50">Two times</SelectItem>
                            <SelectItem value="Until Renewal" disabled={isOnlyOneTimeAllowed} className="bg-white text-black px-3 py-2 hover:bg-blue-50">Until Renewal</SelectItem>
                          </SelectContent>
                        </Select>
                        {isOnlyOneTimeAllowed && (
                          <p className="text-sm text-red-500 font-medium">
                            When reminder days = 1, only "One time" policy is allowed
                          </p>
                        )}
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
              <h2 className="text-lg font-semibold mt-6 mb-3">Notes</h2>
              <div className="grid grid-cols-1 gap-4 mb-6">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-slate-700">Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          className="w-full border border-slate-400 rounded-lg p-2 text-base min-h-[80px] max-h-[120px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                          placeholder="Enter any additional notes about this subscription..." 
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
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium px-4 py-2 shadow-md hover:shadow-lg"
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