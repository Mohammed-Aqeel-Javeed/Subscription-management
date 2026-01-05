import React, { useState } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// Extend Subscription type locally to include department and _id for frontend use
type SubscriptionWithExtras = Subscription & { 
  departments?: string[]; 
  _id?: string; 
};

export default function Subscriptions() {
  const location = useLocation();
  const navigate = useNavigate();
  // ...existing code...
  // Removed duplicate declaration of subscriptions, isLoading, and refetch

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Partial<SubscriptionWithExtras> | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const initialIsCancelledView = location.pathname.includes('cancelled');
  const [statusFilter, setStatusFilter] = useState(initialIsCancelledView ? "Cancelled" : "all");
  const [metricsFilter, setMetricsFilter] = useState<"all" | "active" | "Trial" | "draft" | "cancelled">("all");
  
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<SubscriptionWithExtras | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<"serviceName" | "amount" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  React.useEffect(() => {
    if (location.pathname.includes('cancelled')) {
      setStatusFilter('Cancelled');
    }
  }, [location.pathname]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  
  const tenantId = (window as any).currentTenantId || (window as any).user?.tenantId || null;
  const { data: subscriptions, isLoading, refetch } = useQuery<SubscriptionWithExtras[]>({
    queryKey: ["/api/subscriptions", tenantId],
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: false, // Disable auto-refresh, rely on invalidation
    staleTime: 5000,
    gcTime: 0,
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
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      refetch();
    }
      // Listen for subscription-renewed event and refetch subscriptions
    function handleSubscriptionRenewed() { triggerImmediateRefresh(); }

    // Add event listeners
    const events = ['account-changed','login','logout','subscription-created','subscription-updated','subscription-deleted'];
    events.forEach(ev => window.addEventListener(ev, triggerImmediateRefresh));
    window.addEventListener('subscription-renewed', handleSubscriptionRenewed);

    // Trigger initial fetch
  triggerImmediateRefresh();

    return () => {
      // Remove event listeners
      events.forEach(ev => window.removeEventListener(ev, triggerImmediateRefresh));
      window.removeEventListener('subscription-renewed', handleSubscriptionRenewed);
    };
  }, [queryClient, refetch]);
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
  
  const filteredSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter(sub => {
    // Only show subscriptions for current tenant
    if (tenantId && sub.tenantId !== tenantId) return false;
    const matchesSearch = (sub.serviceName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (sub.vendor || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || sub.category === categoryFilter;
    const matchesVendor = vendorFilter === "all" || sub.vendor === vendorFilter;
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    
    // Apply metrics filter
    let matchesMetrics = true;
    if (metricsFilter === "active") {
      matchesMetrics = sub.status === "Active" && sub.billingCycle !== "Trial";
    } else if (metricsFilter === "Trial") {
      matchesMetrics = sub.billingCycle === "Trial";
    } else if (metricsFilter === "draft") {
      matchesMetrics = sub.status === "Draft";
    } else if (metricsFilter === "cancelled") {
      matchesMetrics = sub.status === "Cancelled";
    }
    
    return matchesSearch && matchesCategory && matchesVendor && matchesStatus && matchesMetrics;
  }).sort((a, b) => {
    // Apply sorting if a field is selected
    if (!sortField) return 0;
    
    if (sortField === "serviceName") {
      const aVal = (a.serviceName || "").toLowerCase();
      const bVal = (b.serviceName || "").toLowerCase();
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
    
    return 0;
  }) : [];
  
  // Toggle sort function
  const handleSort = (field: "serviceName" | "amount") => {
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
  const getSortIcon = (field: "serviceName" | "amount") => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline-block opacity-40" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1 inline-block" />
      : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
  };
  
  const uniqueCategories = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => sub.category) : []));
  const uniqueVendors = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => sub.vendor) : []));
  
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
  
  // --- Summary Stats Section ---
  const active = Array.isArray(subscriptions) ? subscriptions.filter(sub => sub.status === "Active" && sub.billingCycle !== "Trial").length : 0;
  const Trial = Array.isArray(subscriptions) ? subscriptions.filter(sub => sub.billingCycle === "Trial").length : 0;
  const draft = Array.isArray(subscriptions) ? subscriptions.filter(sub => sub.status === "Draft").length : 0;
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative">
        <div className="max-w-7xl mx-auto">
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
            {/* --- Summary Stats --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-100 to-gray-100">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
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

        {/* Key Metrics - Icon boxes with text */}
        <div className="flex items-center justify-between w-full mb-10 gap-4">
          <div 
            className="flex items-center gap-3 flex-1"
          >
            <div className="transition-all duration-200">
              <img src="/assets/Active.png" alt="Active Services" className="h-24 w-24" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Active Services
              </p>
              <p className="text-3xl font-bold text-gray-900">{active}</p>
              <a 
                href="#active-details" 
                onClick={(e) => {
                  e.preventDefault();
                  setMetricsFilter(metricsFilter === "active" ? "all" : "active");
                }}
                className="text-xs text-blue-500 hover:underline cursor-pointer"
              >
                Click to view details
              </a>
            </div>
          </div>

          <div 
            className="flex items-center gap-3 flex-1"
          >
            <div className="transition-all duration-200">
              <img src="/assets/Free Trial.png" alt="Trial Subscriptions" className="h-24 w-24" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Trial Subscriptions
              </p>
              <p className="text-3xl font-bold text-gray-900">{Trial}</p>
              <a 
                href="#trial-details" 
                onClick={(e) => {
                  e.preventDefault();
                  setMetricsFilter(metricsFilter === "Trial" ? "all" : "Trial");
                }}
                className="text-xs text-blue-500 hover:underline cursor-pointer"
              >
                Click to view details
              </a>
            </div>
          </div>

          <div 
            className="flex items-center gap-3 flex-1"
          >
            <div className="transition-all duration-200">
              <img src="/assets/Drafts.png" alt="Draft Subscriptions" className="h-24 w-24" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">
                Draft Subscriptions
              </p>
              <p className="text-3xl font-bold text-gray-900">{draft}</p>
              <a 
                href="#draft-details" 
                onClick={(e) => {
                  e.preventDefault();
                  setMetricsFilter(metricsFilter === "draft" ? "all" : "draft");
                }}
                className="text-xs text-blue-500 hover:underline cursor-pointer"
              >
                Click to view details
              </a>
            </div>
          </div>
        </div>

        {/* Search and Filters Row */}
        <div className="mb-6 flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search subscriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80 border-gray-200 bg-white text-gray-900 placeholder-gray-500 h-10 text-sm rounded-lg"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 border-gray-200 bg-white text-gray-900 h-10 text-sm">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.filter(category => category && category !== "").map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-44 border-gray-200 bg-white text-gray-900 h-10 text-sm">
              <SelectValue placeholder="All Vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {uniqueVendors.filter(vendor => vendor && vendor !== "").map(vendor => (
                <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Professional Data Table */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">
                    <button 
                      onClick={() => handleSort("serviceName")}
                      className="flex items-center hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Service
                      {getSortIcon("serviceName")}
                    </button>
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Vendor
                  </TableHead>
                  <TableHead className="h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    <button 
                      onClick={() => handleSort("amount")}
                      className="flex items-center justify-end w-full hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      Amount
                      {getSortIcon("amount")}
                    </button>
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Billing
                  </TableHead>
                  <TableHead className="h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Next Renewal
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Department
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Category
                  </TableHead>
                  <TableHead className="h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
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
      </div>
      
      <SubscriptionModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
        subscription={editingSubscription}
      />
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 bg-white font-inter">
          {/* Header with Red Gradient Background */}
          <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5 rounded-t-2xl">
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
          <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
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
  );
}