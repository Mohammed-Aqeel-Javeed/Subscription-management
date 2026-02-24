import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Plus, Edit, Trash2, Search, Layers, AlertCircle, Calendar, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Papa from 'papaparse';
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Subscription } from "@shared/schema";
import { Can } from "@/components/Can";
import { useSidebarSlot } from "@/context/SidebarSlotContext";

// Extend Subscription type locally to include department and _id for frontend use
type SubscriptionWithExtras = Subscription & { 
  departments?: string[]; 
  _id?: string; 
  owner?: string | null;
  ownerEmail?: string | null;
};

export default function Subscriptions() {
  const location = useLocation();
  const navigate = useNavigate();
  // ...existing code...
  // Removed duplicate declaration of subscriptions, isLoading, and refetch

  // Check if we should open modal immediately based on URL parameter
  const searchParams = new URLSearchParams(location.search);
  const shouldOpenModal = !!searchParams.get('open');
  
  const [modalOpen, setModalOpen] = useState(shouldOpenModal);
  const [editingSubscription, setEditingSubscription] = useState<Partial<SubscriptionWithExtras> | undefined>();
  const [pendingOpenSubscriptionId, setPendingOpenSubscriptionId] = useState<string | null>(null);
  const [openActionsMenuForId, setOpenActionsMenuForId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const initialIsCancelledView = location.pathname.includes('cancelled');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialIsCancelledView ? ["Cancelled"] : []);
  const [selectedBillingCycles, setSelectedBillingCycles] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [selectedReminderPolicies, setSelectedReminderPolicies] = useState<string[]>([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const { setActive: setSidebarSlotActive, setReplaceNav: setSidebarReplaceNav } = useSidebarSlot();
  const [sidebarSlotEl, setSidebarSlotEl] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = document.getElementById("page-sidebar-slot") as HTMLElement | null;
    setSidebarSlotEl(el);
  }, []);

  React.useEffect(() => {
    setSidebarSlotActive(filtersOpen);
    setSidebarReplaceNav(filtersOpen);

    return () => {
      setSidebarSlotActive(false);
      setSidebarReplaceNav(false);
    };
  }, [filtersOpen, setSidebarSlotActive, setSidebarReplaceNav]);

  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");
  const [startDateFrom, setStartDateFrom] = useState<string>("");
  const [startDateTo, setStartDateTo] = useState<string>("");
  const [nextRenewalFrom, setNextRenewalFrom] = useState<string>("");
  const [nextRenewalTo, setNextRenewalTo] = useState<string>("");
  
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<SubscriptionWithExtras | null>(null);

  // Import confirmation dialog state
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [dataManagementSelectKey, setDataManagementSelectKey] = useState(0);
  
  // Sorting state
  const [sortField, setSortField] = useState<"serviceName" | "vendor" | "amount" | "billingCycle" | "nextRenewal" | "status" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  React.useEffect(() => {
    if (location.pathname.includes('cancelled')) {
      setSelectedStatuses(['Cancelled']);
    } else {
      setSelectedStatuses([]);
    }
  }, [location.pathname]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  
  const { data: subscriptions, isLoading } = useQuery<SubscriptionWithExtras[]>({
    queryKey: ["/api/subscriptions"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: openedSubscription, isLoading: isOpenedSubscriptionLoading } = useQuery<SubscriptionWithExtras | null>({
    queryKey: ["/api/subscriptions", pendingOpenSubscriptionId],
    enabled: !!pendingOpenSubscriptionId,
    queryFn: async () => {
      if (!pendingOpenSubscriptionId) return null;
      const res = await fetch(`/api/subscriptions/${pendingOpenSubscriptionId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });
  
  // Handle URL parameter to open specific subscription modal (placed after subscriptions declaration)
  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const openSubscriptionId = searchParams.get('open');

    if (!openSubscriptionId) return;

    // Open immediately (avoid showing the table while data loads)
    setModalOpen(true);

    // If we already have it in the list, use it right away.
    const fromList = subscriptions?.find(sub => sub.id === openSubscriptionId || sub._id === openSubscriptionId);
    if (fromList) {
      setPendingOpenSubscriptionId(null);
      setEditingSubscription(fromList);
      navigate(location.pathname, { replace: true });
      return;
    }

    // Otherwise fetch the single subscription by id.
    setEditingSubscription(undefined);
    setPendingOpenSubscriptionId(openSubscriptionId);
  }, [location.search, subscriptions, navigate, location.pathname]);

  useEffect(() => {
    if (!pendingOpenSubscriptionId) return;
    if (!openedSubscription) return;

    setEditingSubscription(openedSubscription);
    setPendingOpenSubscriptionId(null);
    navigate(location.pathname, { replace: true });
  }, [openedSubscription, pendingOpenSubscriptionId, navigate, location.pathname]);
  // Listen for login/logout/account change events and trigger immediate refetch
  React.useEffect(() => {
    function triggerImmediateRefresh() {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"], exact: false });
    }
      // Listen for subscription-renewed event and refetch subscriptions
    function handleSubscriptionRenewed() { triggerImmediateRefresh(); }

    // Add event listeners
    const events = ['account-changed','login','logout','subscription-created','subscription-updated','subscription-deleted'];
    events.forEach(ev => window.addEventListener(ev, triggerImmediateRefresh));
    window.addEventListener('subscription-renewed', handleSubscriptionRenewed);

    return () => {
      // Remove event listeners
      events.forEach(ev => window.removeEventListener(ev, triggerImmediateRefresh));
      window.removeEventListener('subscription-renewed', handleSubscriptionRenewed);
    };
  }, [queryClient]);
  // Listen for new subscription created from modal
  React.useEffect(() => {
    function handleCreated(e: any) {
      if (e.detail) {
        setEditingSubscription(e.detail);
      }
    }
    window.addEventListener('subscription-created', handleCreated);
    return () => window.removeEventListener('subscription-created', handleCreated);
  }, []);
  // Fetch recent activities
  // (Removed unused recent activities query to improve performance)

  // Watch for tenantId changes and trigger refetch
  // Removed manual polling logic in favor of react-query interval + events
  
  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => apiRequest("DELETE", `/api/subscriptions/${id}`)
      .then(async (res) => {
        // If backend returns a success message, treat as success
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.message && data.message.includes("deleted")) {
            return data;
          }
        }
        // If not ok, throw error to trigger onError
        throw new Error(await res.text());
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({
        title: "Success",
        description: "Subscription deleted successfully",
        variant: "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subscription",
        variant: "destructive",
      });
    },
  });
  
  const handleEdit = (subscription: SubscriptionWithExtras) => {
    // Always use id for editing, fallback to _id if present
    const subscriptionId = subscription.id?.toString() || subscription._id?.toString();
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "Invalid subscription ID",
        variant: "destructive",
      });
      return;
    }
    setEditingSubscription({
      ...subscription,
      id: subscriptionId,
      amount: subscription.amount !== undefined ? String(subscription.amount) : "",
      // department: removed, only use departments array
    });
    setModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSubscription(undefined);
  };
  
  const handleDelete = (subscription: SubscriptionWithExtras) => {
    setSubscriptionToDelete(subscription);
    setDeleteConfirmOpen(true);
  };
  
  const confirmDelete = () => {
    if (subscriptionToDelete) {
      deleteMutation.mutate(subscriptionToDelete._id || subscriptionToDelete.id);
      setDeleteConfirmOpen(false);
      setSubscriptionToDelete(null);
    }
  };
  
  const handleAddNew = () => {
    setEditingSubscription(undefined);
    setModalOpen(true);
  };

  // EXPORT current (filtered) subscriptions to CSV
  const handleExport = () => {
    if (!filteredSubscriptions.length) {
      toast({ title: 'No data', description: 'There are no subscriptions to export', variant: 'destructive'});
      return;
    }
    const rows = filteredSubscriptions.map(sub => ({
      ServiceName: sub.serviceName,
      Vendor: sub.vendor,
      Amount: sub.amount,
      BillingCycle: sub.billingCycle,
      StartDate: sub.startDate ? new Date(sub.startDate).toISOString().split('T')[0] : '',
      NextRenewal: sub.nextRenewal ? new Date(sub.nextRenewal).toISOString().split('T')[0] : '',
      Status: sub.status,
      Category: sub.category,
      Departments: (sub.departments || []).join('|'),
      ReminderPolicy: sub.reminderPolicy,
      ReminderDays: sub.reminderDays,
      Notes: sub.notes || ''
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `subscriptions_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Subscriptions exported to CSV' });
  };

  const downloadSubscriptionsImportTemplate = () => {
    const template = [
      {
        ServiceName: '',
        Vendor: '',
        Amount: '',
        BillingCycle: 'monthly',
        StartDate: 'YYYY-MM-DD',
        NextRenewal: 'YYYY-MM-DD',
        Status: 'Draft',
        Category: '',
        Departments: 'IT|Finance',
        ReminderPolicy: 'One time',
        ReminderDays: '7',
        Notes: '',
      },
    ];
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'subscriptions_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Template Downloaded', description: 'Use this template to import subscriptions' });
  };

  const triggerImport = () => fileInputRef.current?.click();

  // IMPORT from CSV -> create subscriptions
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normalizeServiceName = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
    const existingServiceNames = new Set(
      (Array.isArray(subscriptions) ? subscriptions : [])
        .map((s) => normalizeServiceName((s as any)?.serviceName))
        .filter(Boolean)
        .map((s) => s.toLowerCase())
    );

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
        const seenInFile = new Set<string>();
        const errorSamples: string[] = [];
        for (const row of rows) {
          try {
            const normalizedName = normalizeServiceName(row.ServiceName || row.serviceName || '');
            const key = normalizedName.toLowerCase();
            if (!normalizedName) {
              failed++;
              if (errorSamples.length < 5) errorSamples.push('Missing ServiceName');
              continue;
            }

            if (existingServiceNames.has(key)) {
              failed++;
              if (errorSamples.length < 5) errorSamples.push(`Duplicate service name already exists: ${normalizedName}`);
              continue;
            }

            if (seenInFile.has(key)) {
              failed++;
              if (errorSamples.length < 5) errorSamples.push(`Duplicate service name in file: ${normalizedName}`);
              continue;
            }

            const payload: any = {
              serviceName: normalizedName,
              vendor: row.Vendor || row.vendor || '',
              amount: parseFloat(row.Amount) || 0,
              billingCycle: (row.BillingCycle || row.billingCycle || 'monthly').toLowerCase(),
              startDate: row.StartDate || row.startDate || new Date().toISOString().split('T')[0],
              nextRenewal: row.NextRenewal || row.nextRenewal || new Date().toISOString().split('T')[0],
              status: row.Status || row.status || 'Draft',
              category: row.Category || row.category || '',
              department: '',
              departments: (row.Departments || '').split('|').filter((d: string) => d),
              reminderPolicy: row.ReminderPolicy || 'One time',
              reminderDays: parseInt(row.ReminderDays) || 7,
              notes: row.Notes || ''
            };
            // Basic validation
            if (!payload.serviceName) {
              failed++;
              if (errorSamples.length < 5) errorSamples.push('Missing ServiceName');
              continue;
            }
            await apiRequest('POST', '/api/subscriptions', payload);
            seenInFile.add(key);
            existingServiceNames.add(key);
            success++;
          } catch (err) {
            failed++;
            if (errorSamples.length < 5) errorSamples.push('Failed to import a row');
          }
        }
        queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
        if (failed > 0 && errorSamples.length) {
          toast({
            title: 'Import finished with errors',
            description: `Imported ${success} row(s). Failed: ${failed}. ${errorSamples.join(' | ')}`,
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Import finished', description: `Imported ${success} row(s). Failed: ${failed}` });
        }
        e.target.value = '';
      },
      error: () => {
        toast({ title: 'Import error', description: 'Failed to parse file', variant: 'destructive'});
      }
    });
  };
  
  const parseDate = (val: unknown): Date | null => {
    if (!val) return null;
    const d = val instanceof Date ? val : new Date(String(val));
    return isNaN(d.getTime()) ? null : d;
  };

  const endOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const filteredSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter(sub => {
    const q = searchTerm.trim().toLowerCase();
    const ownerVal = String((sub as any)?.owner || (sub as any)?.ownerEmail || '').trim();
    const effectiveStatus = (String(sub.billingCycle || '').toLowerCase() === 'trial')
      ? 'Trial'
      : String(sub.status || '');

    const matchesSearch = !q ||
      (sub.serviceName || '').toLowerCase().includes(q) ||
      (sub.vendor || '').toLowerCase().includes(q) ||
      (sub.category || '').toLowerCase().includes(q) ||
      effectiveStatus.toLowerCase().includes(q) ||
      ownerVal.toLowerCase().includes(q);

    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(String(sub.category || ''));
    const matchesVendor = selectedVendors.length === 0 || selectedVendors.includes(String(sub.vendor || ''));
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(effectiveStatus);
    const matchesBilling = selectedBillingCycles.length === 0 || selectedBillingCycles.includes(String(sub.billingCycle || ''));
    const matchesDepartment = selectedDepartments.length === 0 || selectedDepartments.some(d => (sub.departments || []).includes(d));
    const matchesOwner = selectedOwners.length === 0 || selectedOwners.includes(ownerVal);
    const matchesPaymentMethod = selectedPaymentMethods.length === 0 || selectedPaymentMethods.includes(String((sub as any)?.paymentMethod || ''));
    const matchesReminderPolicy = selectedReminderPolicies.length === 0 || selectedReminderPolicies.includes(String((sub as any)?.reminderPolicy || ''));

    const amountVal = parseFloat(String(sub.amount)) || 0;
    const min = amountMin.trim() ? parseFloat(amountMin) : null;
    const max = amountMax.trim() ? parseFloat(amountMax) : null;
    const matchesAmount = (min === null || amountVal >= min) && (max === null || amountVal <= max);

    const startVal = parseDate((sub as any)?.startDate);
    const startFromVal = startDateFrom ? parseDate(startDateFrom) : null;
    const startToVal = startDateTo ? endOfDay(parseDate(startDateTo) || new Date('invalid')) : null;
    const matchesStartDate = (!startFromVal || (startVal && startVal >= startFromVal)) && (!startToVal || (startVal && startVal <= startToVal));

    const renewVal = parseDate((sub as any)?.nextRenewal);
    const renewFromVal = nextRenewalFrom ? parseDate(nextRenewalFrom) : null;
    const renewToVal = nextRenewalTo ? endOfDay(parseDate(nextRenewalTo) || new Date('invalid')) : null;
    const matchesNextRenewal = (!renewFromVal || (renewVal && renewVal >= renewFromVal)) && (!renewToVal || (renewVal && renewVal <= renewToVal));

    // If date filters are active but the record has invalid date, exclude it.
    const startDateFiltersActive = !!startFromVal || !!startToVal;
    const nextRenewalFiltersActive = !!renewFromVal || !!renewToVal;
    if (startDateFiltersActive && !startVal) return false;
    if (nextRenewalFiltersActive && !renewVal) return false;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesVendor &&
      matchesStatus &&
      matchesBilling &&
      matchesDepartment &&
      matchesOwner &&
      matchesPaymentMethod &&
      matchesReminderPolicy &&
      matchesAmount &&
      matchesStartDate &&
      matchesNextRenewal
    );
  }).sort((a, b) => {
    // Apply sorting if a field is selected
    if (!sortField) {
      // Default: Sort by latest saved first (using createdAt or updatedAt if available)
      const aTime = new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime();
      const bTime = new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime();
      return bTime - aTime; // Descending (newest first)
    }
    
    if (sortField === "serviceName") {
      const aVal = (a.serviceName || "").toLowerCase();
      const bVal = (b.serviceName || "").toLowerCase();
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (sortField === "vendor") {
      const aVal = (a.vendor || "").toLowerCase();
      const bVal = (b.vendor || "").toLowerCase();
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (sortField === "amount") {
      const aVal = parseFloat(String(a.amount)) || 0;
      const bVal = parseFloat(String(b.amount)) || 0;
      return sortDirection === "asc" 
        ? aVal - bVal
        : bVal - aVal;
    }
    
    if (sortField === "billingCycle") {
      const aVal = (a.billingCycle || "").toLowerCase();
      const bVal = (b.billingCycle || "").toLowerCase();
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (sortField === "nextRenewal") {
      const aVal = new Date(a.nextRenewal || 0).getTime();
      const bVal = new Date(b.nextRenewal || 0).getTime();
      return sortDirection === "asc" 
        ? aVal - bVal
        : bVal - aVal;
    }
    
    if (sortField === "status") {
      const aVal = (a.status || "").toLowerCase();
      const bVal = (b.status || "").toLowerCase();
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return 0;
  }) : [];

  // Category badge sizing: use the longest category label (clamped) so all category badges are the same width.
  // Use `width` (not `minWidth`) so it can shrink to fit the column and won't get clipped.
  const categoryBadgeWidthCh = (() => {
    let maxLen = 0;
    for (const sub of filteredSubscriptions) {
      const val = String((sub as any)?.category ?? "").trim();
      if (val.length > maxLen) maxLen = val.length;
    }

    // Clamp so badges don't get too tiny or too wide.
    return Math.min(Math.max(maxLen, 6), 28);
  })();
  
  // Toggle sort function
  const handleSort = (field: "serviceName" | "vendor" | "amount" | "billingCycle" | "nextRenewal" | "status") => {
    if (sortField === field) {
      // Toggle direction or clear sort
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  // Get sort icon
  const getSortIcon = (field: "serviceName" | "vendor" | "amount" | "billingCycle" | "nextRenewal" | "status") => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline-block opacity-40" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1 inline-block" />
      : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
  };
  
  const uniqueCategories = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => String(sub.category || '')).filter(Boolean) : [])).sort();
  const uniqueVendors = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => String(sub.vendor || '')).filter(Boolean) : [])).sort();
  const uniqueBillingCycles = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => String(sub.billingCycle || '')).filter(Boolean) : [])).sort();
  const uniqueDepartments = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions.flatMap(sub => (sub.departments || []).map(d => String(d || '')).filter(Boolean))
      : []
  )).sort((a, b) => (a === 'Company Level' ? -1 : b === 'Company Level' ? 1 : a.localeCompare(b)));
  const uniqueOwners = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions
          .map(sub => String((sub as any)?.owner || (sub as any)?.ownerEmail || '').trim())
          .filter(Boolean)
      : []
  )).sort();
  const uniquePaymentMethods = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions.map(sub => String((sub as any)?.paymentMethod || '').trim()).filter(Boolean)
      : []
  )).sort();
  const uniqueReminderPolicies = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions.map(sub => String((sub as any)?.reminderPolicy || '').trim()).filter(Boolean)
      : []
  )).sort();

  const uniqueStatuses = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions
          .map(sub => (String(sub.billingCycle || '').toLowerCase() === 'trial') ? 'Trial' : String(sub.status || '').trim())
          .filter(Boolean)
      : []
  )).sort();
  
  // Category color helper removed (unused)

  // Helper to display department(s) from JSON string or array
  
  // Helper to format date as dd/mm/yyyy
  const formatDate = (dateVal?: string | Date) => {
    if (!dateVal) return "";
    let d: Date;
    if (typeof dateVal === "string") {
      d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
    } else {
      d = dateVal;
    }
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };
  
  const toggleSelected = (current: string[], value: string) => {
    return current.includes(value) ? current.filter(v => v !== value) : [...current, value];
  };

  const CheckboxList = ({
    sectionId,
    options,
    selected,
    onChange,
  }: {
    sectionId: string;
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
  }) => {
    if (options.length === 0) {
      return <div className="px-2 py-1 text-sm text-gray-500">No options</div>;
    }
    return (
      <div className="max-h-56 overflow-auto pr-1">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          const id = `${sectionId}-${opt}`.replace(/\s+/g, '-').toLowerCase();
          return (
            <div key={opt} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-100 rounded-md">
              <Checkbox id={id} checked={checked} onCheckedChange={() => onChange(toggleSelected(selected, opt))} />
              <label htmlFor={id} className="text-sm cursor-pointer select-none flex-1 truncate">
                {opt}
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});
  const [filterShowAll, setFilterShowAll] = useState<Record<string, boolean>>({});

  const FilterSection = ({
    sectionId,
    title,
    options,
    selected,
    onChange,
  }: {
    sectionId: string;
    title: string;
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
  }) => {
    const query = (filterSearch[sectionId] || '').trim().toLowerCase();
    const showAll = !!filterShowAll[sectionId];
    const filtered = query
      ? options.filter((opt) => opt.toLowerCase().includes(query))
      : options;

    const MAX_VISIBLE = 50;
    const visible = showAll ? filtered : filtered.slice(0, MAX_VISIBLE);
    const remaining = Math.max(0, filtered.length - visible.length);

    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            value={filterSearch[sectionId] || ''}
            onChange={(e) => {
              const next = e.target.value;
              setFilterSearch((prev) => ({ ...prev, [sectionId]: next }));
              setFilterShowAll((prev) => ({ ...prev, [sectionId]: false }));
            }}
            placeholder={`Search ${title}`}
            className="pl-10 h-9 text-sm"
          />
        </div>

        <CheckboxList sectionId={sectionId} options={visible} selected={selected} onChange={onChange} />

        {remaining > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-blue-600 hover:text-blue-700 justify-start"
            onClick={() => setFilterShowAll((prev) => ({ ...prev, [sectionId]: true }))}
          >
            {remaining} more
          </Button>
        )}
      </div>
    );
  };

  const activeFilterCount =
    selectedCategories.length +
    selectedVendors.length +
    selectedStatuses.length +
    selectedBillingCycles.length +
    selectedDepartments.length +
    selectedOwners.length +
    selectedPaymentMethods.length +
    selectedReminderPolicies.length +
    (amountMin.trim() ? 1 : 0) +
    (amountMax.trim() ? 1 : 0) +
    (startDateFrom ? 1 : 0) +
    (startDateTo ? 1 : 0) +
    (nextRenewalFrom ? 1 : 0) +
    (nextRenewalTo ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedVendors([]);
    setSelectedStatuses(initialIsCancelledView ? ['Cancelled'] : []);
    setSelectedBillingCycles([]);
    setSelectedDepartments([]);
    setSelectedOwners([]);
    setSelectedPaymentMethods([]);
    setSelectedReminderPolicies([]);
    setAmountMin('');
    setAmountMax('');
    setStartDateFrom('');
    setStartDateTo('');
    setNextRenewalFrom('');
    setNextRenewalTo('');
  };

  const FiltersSidebarPanel = () => (
    <div className="bg-white border border-gray-200  shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-gray-900">Filters</div>
          <div className="text-xs text-gray-500 mt-0.5">Refine subscriptions</div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={clearAllFilters}>
            Clear all
          </Button>
          <Button type="button" variant="ghost" className="h-9" onClick={() => setFiltersOpen(false)}>
            Close
          </Button>
        </div>
      </div>

      <div className="p-5 max-h-[calc(100vh-260px)] overflow-auto">
        <Accordion type="multiple" defaultValue={["categories", "price", "vendor"]}>
          <AccordionItem value="categories">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Categories
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="categories"
                title="Category"
                options={uniqueCategories}
                selected={selectedCategories}
                onChange={setSelectedCategories}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="vendor">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Vendor
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="vendor"
                title="Vendor"
                options={uniqueVendors}
                selected={selectedVendors}
                onChange={setSelectedVendors}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="status">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Status
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="status"
                title="Status"
                options={uniqueStatuses}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="billing">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Billing
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="billing"
                title="Billing"
                options={uniqueBillingCycles}
                selected={selectedBillingCycles}
                onChange={setSelectedBillingCycles}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="department">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Department
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="department"
                title="Department"
                options={uniqueDepartments}
                selected={selectedDepartments}
                onChange={setSelectedDepartments}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="owner">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Owner
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="owner"
                title="Owner"
                options={uniqueOwners}
                selected={selectedOwners}
                onChange={setSelectedOwners}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payment">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Payment
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="payment"
                title="Payment"
                options={uniquePaymentMethods}
                selected={selectedPaymentMethods}
                onChange={setSelectedPaymentMethods}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reminder">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Reminder
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="reminder"
                title="Reminder"
                options={uniqueReminderPolicies}
                selected={selectedReminderPolicies}
                onChange={setSelectedReminderPolicies}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="price">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Price
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center gap-2 px-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Min"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  className="h-9"
                />
                <span className="text-sm text-gray-500">to</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Max"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  className="h-9"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dates">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Dates
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Start date</div>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={startDateFrom} onChange={(e) => setStartDateFrom(e.target.value)} className="h-9" />
                    <span className="text-sm text-gray-500">to</span>
                    <Input type="date" value={startDateTo} onChange={(e) => setStartDateTo(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Next renewal</div>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={nextRenewalFrom} onChange={(e) => setNextRenewalFrom(e.target.value)} className="h-9" />
                    <span className="text-sm text-gray-500">to</span>
                    <Input type="date" value={nextRenewalTo} onChange={(e) => setNextRenewalTo(e.target.value)} className="h-9" />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
  
  if (isLoading) {
    return (
      <div className="h-full bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative">
        <div className="h-full w-full flex flex-col min-h-0">
          {/* Header Section */}
          <div className="bg-white  shadow-xl p-4 mb-6 border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
                    <Layers className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <Skeleton className="h-10 w-64 mb-2" />
                    <Skeleton className="h-6 w-96" />
                  </div>
                </div>
              </div>
              <div className="flex flex-row gap-4 items-center">
                <Skeleton className="h-12 w-48 rounded-xl" />
              </div>
            </div>
          </div>
          
          {/* Filters Section */}
          <Card className="mb-6 border-slate-200 shadow-md rounded-xl">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-48 rounded-lg" />
                  <Skeleton className="h-10 w-48 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Table Section */}
          <Card className="border-slate-200 shadow-lg  overflow-hidden">
            <CardContent className="p-0">
              <div className="space-y-2 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full bg-gradient-to-br from-gray-50 via-slate-100 to-gray-100">
      <div className="h-full w-full px-6 py-8 flex flex-col min-h-0">
        <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
          <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
            <AlertDialogHeader>
              <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
              <AlertDialogDescription>
                Select Yes to choose a file. Select No to download the template.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                onClick={() => {
                  // "No" -> download template
                  downloadSubscriptionsImportTemplate();
                  setImportConfirmOpen(false);
                }}
              >
                No
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => {
                  // "Yes" -> open file picker
                  setImportConfirmOpen(false);
                  // allow dialog close animation to finish
                  setTimeout(() => triggerImport(), 0);
                }}
              >
                Yes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {filtersOpen && sidebarSlotEl ? createPortal(<FiltersSidebarPanel />, sidebarSlotEl) : null}
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-md border border-gray-200">
              <Layers className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Subscription Management</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Add Subscription button - first */}
            <Can I="create" a="Subscription">
              <Button
                onClick={handleAddNew}
                className="w-44 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Subscription
              </Button>
            </Can>
            
            {/* History button - second */}
            <Button
              variant="outline"
              onMouseEnter={() => {
                queryClient.prefetchQuery({
                  queryKey: ["history", "list", 200],
                  queryFn: async () => {
                    const res = await fetch(`/api/history/list?limit=200`, {
                      method: "GET",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                    });
                    if (!res.ok) return [];
                    const json = await res.json();
                    return Array.isArray(json) ? json : [];
                  },
                  staleTime: 5 * 60 * 1000,
                });
              }}
              onFocus={() => {
                queryClient.prefetchQuery({
                  queryKey: ["history", "list", 200],
                  queryFn: async () => {
                    const res = await fetch(`/api/history/list?limit=200`, {
                      method: "GET",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                    });
                    if (!res.ok) return [];
                    const json = await res.json();
                    return Array.isArray(json) ? json : [];
                  },
                  staleTime: 5 * 60 * 1000,
                });
              }}
              onClick={() => navigate('/subscription-history')}
              className="w-44 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 font-medium transition-all duration-200"
            >
              <Calendar className="h-4 w-4 mr-2" />
              History
            </Button>
            
            {/* Data Management Dropdown - third */}
            <Select
              key={dataManagementSelectKey}
              onValueChange={(value) => {
                if (value === 'export') {
                  handleExport();
                } else if (value === 'import') {
                  setImportConfirmOpen(true);
                }

                // Important: Radix Select won't call onValueChange if the same value is selected again.
                // Remounting clears its internal selection so Import works every time.
                setDataManagementSelectKey((k) => k + 1);
              }}
            >
              <SelectTrigger className="w-44 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 font-medium transition-all duration-200">
                <SelectValue placeholder="Data Management" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="export" className="cursor-pointer">
                  <div className="flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </div>
                </SelectItem>
                <SelectItem value="import" className="cursor-pointer">
                  <div className="flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search + Filter - hidden when modal is open */}
        {!modalOpen && (
          <>
        {/* Search + Filter By */}
        <div className="mb-6 bg-white border border-gray-200  shadow-sm p-4 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search subscriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-80 border-gray-200 bg-white text-gray-900 placeholder-gray-500 h-10 text-sm rounded-lg"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white text-sm font-semibold shadow-lg border border-white/20 ring-1 ring-black/5 hover:from-indigo-600 hover:to-blue-700 hover:shadow-xl transition-all"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </div>
        </div>

        {/* Professional Data Table */}
        <div className="min-w-0 flex-1 min-h-0">
          <div className="bg-white border border-gray-200  shadow-md overflow-hidden h-full flex flex-col min-h-0">
            <Table containerClassName="flex-1 min-h-0 overflow-auto" className="table-fixed">
              <TableHeader>
                <TableRow className="border-b-2 border-gray-400 bg-gray-200">
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[220px]">
                    <button 
                      onClick={() => handleSort("serviceName")}
                      className="flex items-center font-bold hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      SERVICE
                      {getSortIcon("serviceName")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[220px]">
                    CATEGORY
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[140px]">
                    <button 
                      onClick={() => handleSort("billingCycle")}
                      className="flex items-center font-bold hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      BILLING
                      {getSortIcon("billingCycle")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide w-[90px]">
                    QTY
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide w-[140px]">
                    <button 
                      onClick={() => handleSort("amount")}
                      className="flex items-center justify-end w-full font-bold hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      AMOUNT
                      {getSortIcon("amount")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[170px]">
                    <button 
                      onClick={() => handleSort("nextRenewal")}
                      className="flex items-center font-bold hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      NEXT RENEWAL
                      {getSortIcon("nextRenewal")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[140px]">
                    <button 
                      onClick={() => handleSort("status")}
                      className="flex items-center font-bold hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      STATUS
                      {getSortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    ACTIONS
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions && filteredSubscriptions.length > 0 ? (
                  filteredSubscriptions.map((subscription, index) => (
                    <TableRow
                      key={subscription._id || subscription.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                    >
                      <TableCell className="px-3 py-3 font-medium text-gray-800 w-[220px] max-w-[220px] overflow-hidden text-left">
                        <div>
                          <button
                            onClick={() => handleEdit(subscription)}
                            title={subscription.serviceName}
                            className="text-indigo-700 hover:text-indigo-900 underline underline-offset-2 block w-full truncate whitespace-nowrap text-left"
                          >
                            {subscription.serviceName}
                          </button>
                          {subscription.notes && (() => {
                            try {
                              const notesArray = typeof subscription.notes === 'string' ? JSON.parse(subscription.notes) : subscription.notes;
                              if (Array.isArray(notesArray) && notesArray.length > 0) {
                                // Show the first note's text
                                const firstNote = notesArray[0];
                                return (
                                  <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                                    {firstNote.text}
                                  </div>
                                );
                              }
                            } catch {
                              // If it's old format (plain text), show it
                              if (typeof subscription.notes === 'string' && !subscription.notes.startsWith('[')) {
                                return <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{subscription.notes}</div>;
                              }
                            }
                            return null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3 w-[220px] max-w-[220px] overflow-hidden text-left">
                        {(() => {
                          const categoryValue = String((subscription as any)?.category ?? "").trim();
                          if (!categoryValue) {
                            return (
                              <span
                                className="inline-flex items-center justify-start text-gray-400 text-xs"
                                style={{ width: `${categoryBadgeWidthCh}ch`, maxWidth: "100%" }}
                              >
                                -
                              </span>
                            );
                          }

                          const raw = categoryValue;
                          const normalized = raw.toLowerCase();

                          // Distinct pastel colors per category (softer tones), plus deterministic fallback.
                          const categoryClassMap: Record<string, string> = {
                            "productivity & collaboration": "bg-blue-100 text-blue-800 border-blue-300",
                            "accounting & finance": "bg-emerald-100 text-emerald-800 border-emerald-300",
                            "crm & sales": "bg-indigo-100 text-indigo-800 border-indigo-300",
                            "development & hosting": "bg-purple-100 text-purple-800 border-purple-300",
                            "design & creative tools": "bg-orange-100 text-orange-800 border-orange-300",
                            "marketing & seo": "bg-amber-100 text-amber-800 border-amber-300",
                            "communication tools": "bg-sky-100 text-sky-800 border-sky-300",
                            "security & compliance": "bg-rose-100 text-rose-800 border-rose-300",
                            "hr & admin": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
                            "subscription infrastructure": "bg-cyan-100 text-cyan-800 border-cyan-300",
                            "office infrastructure": "bg-teal-100 text-teal-800 border-teal-300",
                            "games": "bg-violet-100 text-violet-800 border-violet-300",
                          };

                          const fallbackPalette: string[] = [
                            "bg-blue-100 text-blue-800 border-blue-300",
                            "bg-emerald-100 text-emerald-800 border-emerald-300",
                            "bg-indigo-100 text-indigo-800 border-indigo-300",
                            "bg-purple-100 text-purple-800 border-purple-300",
                            "bg-orange-100 text-orange-800 border-orange-300",
                            "bg-amber-100 text-amber-800 border-amber-300",
                            "bg-sky-100 text-sky-800 border-sky-300",
                            "bg-rose-100 text-rose-800 border-rose-300",
                            "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
                            "bg-cyan-100 text-cyan-800 border-cyan-300",
                            "bg-teal-100 text-teal-800 border-teal-300",
                            "bg-violet-100 text-violet-800 border-violet-300",
                            "bg-slate-100 text-slate-800 border-slate-300",
                            "bg-pink-100 text-pink-800 border-pink-300",
                          ];

                          const hashString = (value: string) => {
                            let hash = 0;
                            for (let i = 0; i < value.length; i++) {
                              hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
                            }
                            return hash;
                          };

                          const badgeClass =
                            categoryClassMap[normalized] ??
                            fallbackPalette[Math.abs(hashString(normalized)) % fallbackPalette.length];

                          return (
                            <span
                              className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border max-w-full text-left ${badgeClass}`}
                              style={{ width: `${categoryBadgeWidthCh}ch`, maxWidth: "100%" }}
                            >
                              <span className="truncate whitespace-nowrap" title={raw}>
                                {raw}
                              </span>
                            </span>
                          );
                        })()}
                      </TableCell>

                      <TableCell className="px-3 py-3 text-sm text-gray-600 w-[140px] capitalize">
                        {subscription.billingCycle}
                      </TableCell>

                      <TableCell className="px-4 py-3 text-center w-[90px]">
                        <span className="text-sm font-medium text-gray-900">
                          {Number((subscription as any)?.qty ?? 1) || 1}
                        </span>
                      </TableCell>

                      <TableCell className="px-3 py-3 text-right w-[140px]">
                        <span className="text-sm font-medium text-gray-900">
                          ${parseFloat(String(subscription.amount)).toFixed(2)}
                        </span>
                      </TableCell>

                      <TableCell className="px-4 py-3 text-left w-[170px]">
                        <div className="flex items-center justify-start text-sm text-gray-700">
                          <Calendar className="h-3 w-3 text-gray-400 mr-1" />
                          {formatDate(subscription.nextRenewal)}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 w-[140px] text-left">
                        <span
                          className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border min-w-[100px] ${
                            subscription.billingCycle === 'Trial'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : subscription.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : subscription.status === 'Cancelled'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {subscription.billingCycle === 'Trial' ? 'Trial' : subscription.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        {(() => {
                          const rowId = String(subscription._id || subscription.id || "");
                          const isOpen = !!rowId && openActionsMenuForId === rowId;
                          const isAnotherRowOpen = !!openActionsMenuForId && openActionsMenuForId !== rowId;
                          return (
                            <DropdownMenu
                              open={isOpen}
                              onOpenChange={(open) => {
                                if (!rowId) return;
                                setOpenActionsMenuForId(open ? rowId : null);
                              }}
                            >
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${
                                isAnotherRowOpen ? "invisible" : ""
                              }`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="z-[1000] bg-white text-gray-900 border border-gray-200 shadow-lg"
                          >
                            <Can I="update" a="Subscription">
                              <DropdownMenuItem
                                onClick={() => handleEdit(subscription)}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            </Can>
                            <Can I="delete" a="Subscription">
                              <DropdownMenuItem
                                onClick={() => handleDelete(subscription)}
                                className="cursor-pointer text-red-600 focus:text-red-600"
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </Can>
                          </DropdownMenuContent>
                        </DropdownMenu>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                        <p className="text-sm font-medium text-gray-900">No subscriptions found</p>
                        <p className="text-xs text-gray-500 mt-1">Try adjusting your search filters or add a new subscription</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
          </>
        )}

      
      <SubscriptionModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        subscription={editingSubscription}
      />

      <Dialog
        open={modalOpen && !editingSubscription && (isLoading || isOpenedSubscriptionLoading)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingOpenSubscriptionId(null);
            handleCloseModal();
          }
        }}
      >
        <DialogContent className="max-w-md ">
          <DialogHeader>
            <DialogTitle>Loading subscription...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-600" />
            Please wait
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md  border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
          {/* Header with Red Gradient Background */}
          <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-white">
                    Delete Subscription
                  </DialogTitle>
                  <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-gray-700 text-sm leading-relaxed mb-4">
              Are you sure you want to delete the subscription <span className="font-semibold text-gray-900">"{subscriptionToDelete?.serviceName}"</span>?
            </p>
            <p className="text-gray-600 text-xs leading-relaxed">
              This will permanently remove this subscription and all its associated data from your system.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setDeleteConfirmOpen(false);
                setSubscriptionToDelete(null);
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
      
      <input
        type="file"
        accept=".csv,text/csv"
        ref={fileInputRef}
        onChange={handleImport}
        className="hidden"
      />
      </div>
    </div>
  );
}
