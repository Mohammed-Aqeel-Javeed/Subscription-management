import React, { useState } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash2, Search, CreditCard, AlertCircle, Calendar, XCircle, Download, Upload } from "lucide-react";
import Papa from 'papaparse';
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Subscription } from "@shared/schema";

// Helper component to display departments
// Extend Subscription type locally to include department and _id for frontend use
type SubscriptionWithExtras = Subscription & { 
  departments?: string[]; 
  _id?: string; 
};
  const DepartmentDisplay = ({ departments }: { departments?: string[] }) => {
    if (!departments || !departments.length) return <span>-</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {departments.map((dept, idx) => (
          <span key={dept + idx} className="inline-block bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {dept}
          </span>
        ))}
      </div>
    );
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
    refetchInterval: 10000, // auto refresh every 10s
    refetchIntervalInBackground: true,
    staleTime: 5000,
    gcTime: 0,
  });
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
  
  const handleDelete = (id: string | number) => {
    if (confirm("Are you sure you want to delete this subscription?")) {
      deleteMutation.mutate(id);
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
    const matchesSearch = sub.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sub.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || sub.category === categoryFilter;
    const matchesVendor = vendorFilter === "all" || sub.vendor === vendorFilter;
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    return matchesSearch && matchesCategory && matchesVendor && matchesStatus;
  }) : [];
  
  const uniqueCategories = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => sub.category) : []));
  const uniqueVendors = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => sub.vendor) : []));
  
  // Category color helper removed (unused)

  // Helper to display department(s) from JSON string or array
  // (Removed duplicate DepartmentDisplay definition. Use the one at the top of the file.)
  
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
  
  // Status badge component - exactly matching Compliance page
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      "Active": { 
        variant: "outline", 
        icon: <AlertCircle className="h-3 w-3 mr-1" />, 
        color: "bg-emerald-50 text-emerald-700 border-emerald-200" 
      },
      "Cancelled": { 
        variant: "outline", 
        icon: <AlertCircle className="h-3 w-3 mr-1" />, 
        color: "bg-rose-50 text-rose-700 border-rose-200" 
      },
      "default": { 
        variant: "outline", 
        icon: <AlertCircle className="h-3 w-3 mr-1" />, 
        color: "bg-gray-100 text-gray-700 border-gray-200" 
      }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.default;
    
    return (
      <Badge className={`${config.color} flex items-center font-medium`} variant={config.variant as any}>
        {config.icon}
        {status}
      </Badge>
    );
  };
  
  // --- Summary Stats Section ---
  const total = Array.isArray(subscriptions) ? subscriptions.length : 0;
  const active = Array.isArray(subscriptions) ? subscriptions.filter(sub => sub.status === "Active").length : 0;
  // const cancelled = Array.isArray(subscriptions) ? subscriptions.filter(sub => sub.status === "Cancelled").length : 0; // not shown currently
  
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
                    <CreditCard className="h-7 w-7 text-white" />
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
                  <CreditCard className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Subscription Management</h1>
                  <p className="text-slate-600 text-lg mt-1">Manage all your active subscriptions</p>
                </div>
              </div>
            </div>
            <div className="flex flex-row gap-4 items-center">
              <Button
                variant="default"
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-md hover:scale-105 transition-transform"
                onClick={handleAddNew}
                title="Add Subscription"
              >
                <Plus className="h-5 w-5 mr-2" /> Add New Subscription
              </Button>
              <Button
                variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm"
                onClick={() => window.location.href = '/subscription-history'}
              >
                <Calendar className="h-5 w-5 mr-2" /> History
              </Button>

              <Button
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50 shadow-sm"
                onClick={() => {
                  if (location.pathname.includes('cancelled')) {
                    navigate('/subscriptions');
                  } else {
                    navigate('/subscriptions/cancelled');
                  }
                }}
              >
                <XCircle className="h-5 w-5 mr-2" />
                {location.pathname.includes('cancelled') ? 'Show All' : 'Cancelled'}
              </Button>
            </div>
          </div>
          {/* --- Summary Stats --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-sm rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{total}</div>
                <div className="text-white/90 text-sm">Total Subscriptions</div>
              </div>
            </Card>
            <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{active}</div>
                  <div className="text-white/90 text-sm">Active</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  className="text-white hover:bg-white/20 p-2 h-8 w-8"
                  title="Export to CSV"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={triggerImport}
                  className="text-white hover:bg-white/20 p-2 h-8 w-8"
                  title="Import from CSV"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
        
        {/* Filters Section */}
        <Card className="mb-6 border-slate-200 shadow-md rounded-xl">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="Search subscriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg h-10"
                />
              </div>
              
              {/* Filter Dropdowns */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-48">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.filter(category => category && category !== "").map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-full sm:w-48">
                  <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger className="border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full">
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
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Table Section */}
        <Card className="border-slate-200 shadow-lg rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4">Service Name</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4">Vendor</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4">Amount</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4">Billing Cycle</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4 text-center">Next Renewal</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4">Department</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4">Category</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4">Reminder Policy</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-sm py-3 px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions && filteredSubscriptions.length > 0 ? (
                    filteredSubscriptions.map((subscription) => {
                      // DEBUG: Log subscription object to verify departments field
                      console.log('Subscription row:', subscription);
                      console.log('Subscription ID fields:', { id: subscription.id, _id: subscription._id });
                      return (
                        <TableRow key={subscription._id || subscription.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="py-3 px-4">
                          <div>
                            <div className="font-medium text-slate-900">{subscription.serviceName}</div>
                            {subscription.notes && (
                              <div className="text-sm text-slate-500 mt-1">{subscription.notes}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700 py-3 px-4">{subscription.vendor}</TableCell>
                        <TableCell className="font-medium text-slate-900 py-3 px-4">
                          {parseFloat(String(subscription.amount)).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-slate-700 capitalize py-3 px-4">{subscription.billingCycle}</TableCell>
                        <TableCell className="text-center py-3 px-4">
                          <div className="flex items-center justify-center gap-2 text-slate-700">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            {formatDate(subscription.nextRenewal)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <StatusBadge status={subscription.status} />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <DepartmentDisplay departments={subscription.departments ?? []} />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            {subscription.category || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 py-3 px-4">
                          {subscription.reminderPolicy} ({subscription.reminderDays}d)
                        </TableCell>
                        <TableCell className="text-right py-3 px-4">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(subscription)}
                              className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg p-2 h-8 w-8"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(subscription._id || subscription.id)}
                              className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-2 h-8 w-8"
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-12 w-12 text-slate-300 mb-3" />
                          <p className="text-lg font-medium text-slate-600">No subscription records found</p>
                          <p className="text-slate-500 mt-1">Try adjusting your filters or add a new subscription</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <SubscriptionModal
        open={modalOpen}
        onOpenChange={handleCloseModal}
  subscription={editingSubscription}
      />
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