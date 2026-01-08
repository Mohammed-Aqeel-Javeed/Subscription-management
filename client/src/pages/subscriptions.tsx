import React, { useState } from "react";
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
import { Plus, Edit, Trash2, Search, Layers, AlertCircle, Calendar, XCircle, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Partial<SubscriptionWithExtras> | undefined>();
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
  
  // Handle URL parameter to open specific subscription modal (placed after subscriptions declaration)
  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const openSubscriptionId = searchParams.get('open');
    
    if (openSubscriptionId && subscriptions) {
      // Find the subscription by ID
      const subscription = subscriptions.find(sub => 
        sub.id === openSubscriptionId || sub._id === openSubscriptionId
      );
      
      if (subscription) {
        setEditingSubscription(subscription);
        setModalOpen(true);
        // Clean up URL parameter after opening modal
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.search, subscriptions, navigate, location.pathname]);
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

  const triggerImport = () => fileInputRef.current?.click();

  // IMPORT from CSV -> create subscriptions
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
              serviceName: row.ServiceName || row.serviceName || '',
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
            if (!payload.serviceName) { failed++; continue; }
            await apiRequest('POST', '/api/subscriptions', payload);
            success++;
          } catch (err) {
            failed++;
          }
        }
        queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
        toast({ title: 'Import finished', description: `Imported ${success} row(s). Failed: ${failed}` });
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
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
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
          <div className="bg-white rounded-2xl shadow-xl p-4 mb-6 border border-slate-200">
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
          <Card className="border-slate-200 shadow-lg rounded-2xl overflow-hidden">
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
                Add Subscription
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
              className="w-44 bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-indigo-200 hover:border-indigo-300 font-medium transition-all duration-200"
            >
              <Calendar className="h-4 w-4 mr-2" />
              History
            </Button>
            
            {/* Data Management Dropdown - third */}
            <Select onValueChange={(value) => {
              if (value === 'export') {
                handleExport();
              } else if (value === 'import') {
                triggerImport();
              }
            }}>
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
            
            {/* Cancelled button - fourth */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (location.pathname.includes('cancelled')) {
                  navigate('/subscriptions');
                } else {
                  navigate('/subscriptions/cancelled');
                }
              }}
              className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200 text-orange-700 hover:from-orange-100 hover:to-orange-200 hover:border-orange-300 font-medium transition-all duration-200"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {location.pathname.includes('cancelled') ? 'All Subscriptions' : 'Cancelled'}
            </Button>
          </div>
        </div>

        {/* Search + Filter By */}
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl shadow-sm p-4 shrink-0">
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
              className="h-10 border-gray-200 bg-white text-gray-900 text-sm font-normal"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </div>
        </div>

        {/* Professional Data Table */}
        <div className="min-w-0 flex-1 min-h-0">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden h-full flex flex-col min-h-0">
            <Table containerClassName="flex-1 min-h-0 overflow-auto">
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    <button 
                      onClick={() => handleSort("serviceName")}
                      className="flex items-center hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Service
                      {getSortIcon("serviceName")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    <button 
                      onClick={() => handleSort("vendor")}
                      className="flex items-center hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Vendor
                      {getSortIcon("vendor")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    <button 
                      onClick={() => handleSort("amount")}
                      className="flex items-center justify-end w-full hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Amount
                      {getSortIcon("amount")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    <button 
                      onClick={() => handleSort("billingCycle")}
                      className="flex items-center hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Billing
                      {getSortIcon("billingCycle")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">
                    <button 
                      onClick={() => handleSort("nextRenewal")}
                      className="flex items-center justify-center w-full hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Next Renewal
                      {getSortIcon("nextRenewal")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    <button 
                      onClick={() => handleSort("status")}
                      className="flex items-center hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Status
                      {getSortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Department
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Category
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Actions
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
                      <TableCell className="px-4 py-3">
                        <div>
                          <button
                            onClick={() => handleEdit(subscription)}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 underline hover:no-underline transition-all duration-200 cursor-pointer text-left"
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
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {subscription.vendor}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          ${parseFloat(String(subscription.amount)).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-sm text-gray-700 capitalize">
                          {subscription.billingCycle}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center text-sm text-gray-700">
                          <Calendar className="h-3 w-3 text-gray-400 mr-1" />
                          {formatDate(subscription.nextRenewal)}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          subscription.billingCycle === 'Trial'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : subscription.status === 'Active' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : subscription.status === 'Cancelled'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {subscription.billingCycle === 'Trial' ? 'Trial' : subscription.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {/* If Company Level is selected, only show Company Level badge */}
                          {(subscription.departments || []).includes('Company Level') ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                              Company Level
                            </span>
                          ) : (
                            <>
                              {(subscription.departments || []).map((dept, idx) => (
                                <span key={dept + idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {dept}
                                </span>
                              ))}
                              {(!subscription.departments || subscription.departments.length === 0) && (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {subscription.category || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Can I="update" a="Subscription">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(subscription)}
                              className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Can>
                          <Can I="delete" a="Subscription">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(subscription)}
                              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Can>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
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

      
      <SubscriptionModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        subscription={editingSubscription}
      />
      
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