import React, { useState, useEffect, Fragment } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash2, Search, Calendar, FileText, AlertCircle, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// Helper functions remain the same
const mapStatus = (status: string): string => {
  return "Pending";
};
const calculateEndDate = (start: string, freq: string): string => {
  if (!start) return "";
  const date = new Date(start);
  let endDate = new Date(date);
  if (freq === "Yearly") {
    endDate.setFullYear(date.getFullYear() + 1);
    endDate.setDate(endDate.getDate() - 1);
  } else if (freq === "Quarterly") {
    endDate.setMonth(date.getMonth() + 3);
    endDate.setDate(endDate.getDate() - 1);
  } else if (freq === "Monthly") {
    endDate.setMonth(date.getMonth() + 1);
    endDate.setDate(endDate.getDate() - 1);
  }
  const yyyy = endDate.getFullYear();
  const mm = String(endDate.getMonth() + 1).padStart(2, "0");
  const dd = String(endDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};
function getNextPeriodDates(startDate: string, endDate: string, frequency: string): { nextStartDate: string; nextEndDate: string } {
  const start = new Date(endDate);
  let nextStart = new Date(start);
  let nextEnd = new Date(start);
  
  nextStart.setDate(start.getDate() + 1);
  
  if (frequency === "Monthly") {
    nextEnd.setMonth(nextStart.getMonth() + 1);
    nextEnd.setDate(nextEnd.getDate() - 1);
  } else if (frequency === "Quarterly") {
    nextEnd.setMonth(nextStart.getMonth() + 3);
    nextEnd.setDate(nextEnd.getDate() - 1);
  } else if (frequency === "Yearly") {
    nextEnd.setFullYear(nextStart.getFullYear() + 1);
    nextEnd.setDate(nextEnd.getDate() - 1);
  }
  
  const format = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  
  return { nextStartDate: format(nextStart), nextEndDate: format(nextEnd) };
}
export default function Compliance() {
  // --- Dynamic Compliance Fields ---
  const [complianceFields, setComplianceFields] = useState<any[]>([]);
  const [isLoadingComplianceFields, setIsLoadingComplianceFields] = useState(true);
  
  // State for categories and governing authorities
  const [categories, setCategories] = useState<string[]>([]);
  const [governingAuthorities, setGoverningAuthorities] = useState<string[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  
  // Fullscreen toggle state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  useEffect(() => {
    const fetchComplianceFields = () => {
      setIsLoadingComplianceFields(true);
      fetch('/api/config/compliance-fields')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setComplianceFields(data);
          else setComplianceFields([]);
        })
        .catch(() => setComplianceFields([]))
        .finally(() => setIsLoadingComplianceFields(false));
    };
    
    const fetchDropdownData = () => {
      setIsLoadingDropdowns(true);
      Promise.all([
        fetch('/api/compliance/categories').then(res => res.json()),
        fetch('/api/compliance/authorities').then(res => res.json())
      ])
      .then(([categoriesData, authoritiesData]) => {
        if (Array.isArray(categoriesData)) setCategories(categoriesData);
        if (Array.isArray(authoritiesData)) setGoverningAuthorities(authoritiesData);
      })
      .catch(() => {
        setCategories([]);
        setGoverningAuthorities([]);
      })
      .finally(() => setIsLoadingDropdowns(false));
    };
    
    fetchComplianceFields();
    fetchDropdownData();
    
    // Add event listeners for account changes
    window.addEventListener("accountChanged", fetchComplianceFields);
    window.addEventListener("logout", fetchComplianceFields);
    window.addEventListener("login", fetchComplianceFields);
    window.addEventListener("accountChanged", fetchDropdownData);
    window.addEventListener("logout", fetchDropdownData);
    window.addEventListener("login", fetchDropdownData);
    
    return () => {
      window.removeEventListener("accountChanged", fetchComplianceFields);
      window.removeEventListener("logout", fetchComplianceFields);
      window.removeEventListener("login", fetchComplianceFields);
      window.removeEventListener("accountChanged", fetchDropdownData);
      window.removeEventListener("logout", fetchDropdownData);
      window.removeEventListener("login", fetchDropdownData);
    };
  }, []);
  
  // Store dynamic field values in form state
  const [dynamicFieldValues, setDynamicFieldValues] = useState<{ [key: string]: string }>({});
  
  type ComplianceItem = {
    _id?: string;
    id?: string | number;
    policy: string;
    category: string;
    status: string;
    lastAudit?: string;
    issues?: number;
    frequency?: string;
    governingAuthority?: string;
    endDate?: string;
    submissionDeadline?: string;
    recurringFrequency?: string;
    remarks?: string;
    filingSubmissionDate?: string;
    reminderDays?: string | number;
    reminderPolicy?: string;
    submittedBy?: string;
    amount?: string | number;
  };
  
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  
  const [form, setForm] = useState({
    filingName: "",
    filingFrequency: "Monthly",
    filingComplianceCategory: "",
    filingGoverningAuthority: "",
    filingStartDate: "",
    filingEndDate: "",
    filingSubmissionDeadline: "",
    filingSubmissionStatus: "Pending",
    filingRecurringFrequency: "",
    filingRemarks: "",
    filingSubmissionDate: "",
    reminderDays: "7",
    reminderPolicy: "One time",
    submittedBy: "",
    amount: "",
  });
  
  // Fetch employees for the submit by dropdown with auto-refresh
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const response = await fetch("/api/employees");
      if (!response.ok) throw new Error("Failed to fetch employees");
      return response.json();
    },
    refetchInterval: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => {
      const newState = { ...prev, [field]: value };
      if (field === "filingStartDate" || field === "filingFrequency") {
        const startDate = field === "filingStartDate" ? value : prev.filingStartDate;
        const frequency = field === "filingFrequency" ? value : prev.filingFrequency;
        const endDate = calculateEndDate(startDate, frequency);
        return {
          ...newState,
          filingStartDate: startDate,
          filingEndDate: endDate
        };
      }
      return newState;
    });
  };
  
  // For dynamic compliance fields
  const handleDynamicFieldChange = (fieldName: string, value: string) => {
    setDynamicFieldValues(prev => ({ ...prev, [fieldName]: value }));
  };
  
  const { data: complianceItems = [], isLoading } = useQuery({
    queryKey: ["compliance"],
    queryFn: async () => {
      const response = await fetch("/api/compliance/list");
      if (!response.ok) throw new Error("Failed to fetch compliance filings");
      return response.json();
    },
    refetchInterval: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0
  });
  
  useEffect(() => {
    const invalidateCompliance = () => {
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    };
    window.addEventListener("accountChanged", invalidateCompliance);
    window.addEventListener("logout", invalidateCompliance);
    window.addEventListener("login", invalidateCompliance);
    return () => {
      window.removeEventListener("accountChanged", invalidateCompliance);
      window.removeEventListener("logout", invalidateCompliance);
      window.removeEventListener("login", invalidateCompliance);
    };
  }, [queryClient]);
  
  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/compliance/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to save compliance");
      return response.json();
    },
    onSuccess: (newItem) => {
      queryClient.setQueryData(["compliance"], (oldData: ComplianceItem[]) =>
        oldData ? [...oldData, newItem] : [newItem]
      );
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (_id: string) => {
      const res = await fetch(`/api/compliance/${_id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete compliance item.");
      return _id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(["compliance"], (oldData: ComplianceItem[]) =>
        oldData ? oldData.filter(item => item._id !== deletedId) : []
      );
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    }
  });
  
  const editMutation = useMutation({
    mutationFn: async ({ _id, data }: { _id: string; data: any }) => {
      const res = await fetch(`/api/compliance/${_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update compliance item.");
      return { _id, data };
    },
    onSuccess: ({ _id, data }) => {
      queryClient.setQueryData(["compliance"], (oldData: ComplianceItem[]) =>
        oldData ? oldData.map(item =>
          item._id === _id ? { ...item, ...data } : item
        ) : []
      );
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
    }
  });
  
  const uniqueCategories = Array.from(new Set(complianceItems.map((item: ComplianceItem) => item.category))).filter(Boolean);
  const filteredItems = complianceItems.filter((item: ComplianceItem) => {
    const matchesSearch = item.policy?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || mapStatus(item.status) === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });
  
  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      "Pending": { 
        variant: "outline", 
        icon: <AlertCircle className="h-3 w-3 mr-1" />, 
        color: "bg-amber-50 text-amber-700 border-amber-200" 
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
  const total = complianceItems.length;
  const pending = complianceItems.filter((item: ComplianceItem) => mapStatus(item.status) === "Pending").length;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6 mb-6 border border-slate-200">
          {/* Title and Buttons Row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Compliance Management</h1>
                <p className="text-slate-600">Enterprise Compliance Tracking System</p>
              </div>
            </div>
            <div className="flex flex-row gap-3 items-center">
              <Button
                variant="outline"
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold shadow-sm hover:shadow-md transition-all duration-300 h-10"
                onClick={() => {
                  window.location.href = "/compliance-ledger";
                }}
              >
                <FileText className="h-4 w-4 mr-2" /> Compliance Ledger
              </Button>
              <Button
                variant="default"
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-md hover:scale-105 transition-transform h-10"
                onClick={() => {
                  setEditIndex(null);
                  setForm({
                    filingName: "",
                    filingFrequency: "Monthly",
                    filingComplianceCategory: "",
                    filingGoverningAuthority: "",
                    filingStartDate: "",
                    filingEndDate: "",
                    filingSubmissionDeadline: "",
                    filingSubmissionStatus: "Pending",
                    filingRecurringFrequency: "",
                    filingRemarks: "",
                    filingSubmissionDate: "",
                    reminderDays: "7",
                    reminderPolicy: "One time",
                    submittedBy: "",
                    amount: ""
                  });
                  setModalOpen(true);
                }}
                title="Add Compliance"
              >
                <Plus className="h-5 w-5 mr-2" /> Add Compliance
              </Button>
            </div>
          </div>
          
          {/* Stats and Search Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-3 flex items-center gap-3">
              <FileText className="h-6 w-6 text-white" />
              <div>
                <div className="text-xl font-bold text-white">{total}</div>
                <div className="text-white text-xs">Total Filings</div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl shadow-lg p-3 flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-white" />
              <div>
                <div className="text-xl font-bold text-white">{pending}</div>
                <div className="text-white text-xs">Pending</div>
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <div className="relative w-1/2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-300 bg-white text-slate-900 rounded-lg h-10"
                />
              </div>
              <div className="w-1/2">
                <Select value={categoryFilter} onValueChange={(value: string) => setCategoryFilter(value)}>
                  <SelectTrigger className="border-slate-300 bg-white text-slate-900 rounded-lg h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    <SelectItem value="all" className="text-slate-900 hover:bg-indigo-50">All Categories</SelectItem>
                    {uniqueCategories.map((cat, idx) => (
                      <SelectItem key={String(cat) + idx} value={String(cat)} className="text-slate-900 hover:bg-indigo-50">{String(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Table Section */}
        <Card className="border-slate-200 shadow-lg rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Table className="">
                <TableHeader className="bg-gradient-to-r from-indigo-100 to-indigo-50">
                  <TableRow>
                    <TableHead className="font-bold text-indigo-700 text-base py-3">Policy</TableHead>
                    <TableHead className="font-bold text-indigo-700 text-base py-3">Category</TableHead>
                    <TableHead className="font-bold text-indigo-700 text-base py-3">Status</TableHead>
                    <TableHead className="font-bold text-indigo-700 text-base py-3 text-center">Due Date</TableHead>
                    <TableHead className="font-bold text-indigo-700 text-base py-3 text-center">Submitted Date</TableHead>
                    <TableHead className="font-bold text-indigo-700 text-base py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-10 w-10 text-slate-300 mb-2" />
                          <p className="text-lg font-medium text-slate-600">No compliance records found</p>
                          <p className="text-slate-500 mt-1">Try adjusting your filters or add a new compliance record</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item: ComplianceItem) => (
                      <TableRow key={item._id || item.id} className="hover:bg-indigo-50/40 transition-colors">
                        <TableCell className="font-semibold text-slate-900 text-base py-3">{item.policy}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 font-medium">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={mapStatus(item.status)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2 text-slate-700 font-medium">
                            <Calendar className="h-4 w-4 text-indigo-400" />
                            {formatDate(item.submissionDeadline)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2 text-slate-700 font-medium">
                            <Calendar className="h-4 w-4 text-indigo-400" />
                            {formatDate(item.filingSubmissionDate)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const index = (complianceItems as ComplianceItem[]).findIndex(
                                  (ci: ComplianceItem) => (ci._id || ci.id) === (item._id || item.id)
                                );
                                setEditIndex(index);
                                setModalOpen(true);
                                const currentItem = complianceItems[index] as ComplianceItem;
                                setForm({
                                  filingName: currentItem.policy,
                                  filingFrequency: currentItem.frequency || "Monthly",
                                  filingComplianceCategory: currentItem.category,
                                  filingGoverningAuthority: currentItem.governingAuthority || "",
                                  filingStartDate: currentItem.lastAudit || "",
                                  filingEndDate: currentItem.endDate || "",
                                  filingSubmissionDeadline: currentItem.submissionDeadline || "",
                                  filingSubmissionStatus: mapStatus(currentItem.status),
                                  filingRecurringFrequency: currentItem.recurringFrequency || "",
                                  filingRemarks: currentItem.remarks || "",
                                  filingSubmissionDate: "",
                                  reminderDays: currentItem.reminderDays !== undefined && currentItem.reminderDays !== null ? String(currentItem.reminderDays) : "7",
                                  reminderPolicy: currentItem.reminderPolicy || "One time",
                                  submittedBy: currentItem.submittedBy || "",
                                  amount: currentItem.amount !== undefined && currentItem.amount !== null ? String(currentItem.amount) : ""
                                });
                              }}
                              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg p-2"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm("Do you want to delete this compliance item?")) {
                                  deleteMutation.mutate(item._id as string);
                                }
                              }}
                              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg p-2"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) setIsFullscreen(false); setModalOpen(v); }}>
        <DialogContent className={`${isFullscreen ? 'max-w-[95vw] w-[95vw] h-[92vh] max-h-[92vh]' : 'max-w-4xl min-w-[400px] max-h-[80vh]'} overflow-y-auto rounded-2xl border-slate-200 shadow-2xl p-0 bg-white transition-[width,height] duration-300`}>
          <DialogHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-xl font-bold flex items-center gap-3">
                <FileText className="h-6 w-6" />
                {editIndex !== null ? "Edit Compliance" : "Add New Compliance"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                  onClick={() => setIsFullscreen(f => !f)}
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
                {editIndex !== null && complianceItems[editIndex]?._id && (
                  <Button
                    type="button"
                    variant="default"
                    className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-4 py-2 flex items-center gap-2 shadow-md transition-all duration-300"
                    onClick={() => {
                      window.location.href = `/compliance-ledger?id=${complianceItems[editIndex]._id}`;
                    }}
                    title="View Ledger"
                  >
                    <ExternalLink size={16} />
                    View Ledger
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <form className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Filing Name</label>
                <Input 
                  className="w-full border-slate-300 rounded-lg p-2 text-base" 
                  value={form.filingName} 
                  onChange={e => handleFormChange("filingName", e.target.value)} 
                  
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Filing Frequency</label>
                <Select value={form.filingFrequency} onValueChange={(val: string) => handleFormChange("filingFrequency", val)}>
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    <SelectItem value="Monthly" className="text-slate-900 hover:bg-indigo-50">Monthly</SelectItem>
                    <SelectItem value="Quarterly" className="text-slate-900 hover:bg-indigo-50">Quarterly</SelectItem>
                    <SelectItem value="Yearly" className="text-slate-900 hover:bg-indigo-50">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Compliance Category</label>
                <Select value={form.filingComplianceCategory} onValueChange={(val: string) => handleFormChange("filingComplianceCategory", val)}>
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    <SelectItem value="Tax" className="text-slate-900 hover:bg-indigo-50">Tax</SelectItem>
                    <SelectItem value="Payroll" className="text-slate-900 hover:bg-indigo-50">Payroll</SelectItem>
                    <SelectItem value="Regulatory" className="text-slate-900 hover:bg-indigo-50">Regulatory</SelectItem>
                    <SelectItem value="Legal" className="text-slate-900 hover:bg-indigo-50">Legal</SelectItem>
                    
                    <SelectItem value="Other" className="text-slate-900 hover:bg-indigo-50">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Governing Authority</label>
                <Select 
                  value={form.filingGoverningAuthority} 
                  onValueChange={(val: string) => {
                    handleFormChange('filingGoverningAuthority', val);
                  }}
                >
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue placeholder="Select Authority" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md max-h-60 overflow-y-auto">
                    <SelectItem value="IRAS" className="text-slate-900 hover:bg-indigo-50">IRAS</SelectItem>
                    <SelectItem value="ACRA" className="text-slate-900 hover:bg-indigo-50">ACRA</SelectItem>
                    <SelectItem value="CPF" className="text-slate-900 hover:bg-indigo-50">CPF</SelectItem>
                    <SelectItem value="AGD" className="text-slate-900 hover:bg-indigo-50">AGD</SelectItem>
                    <SelectItem value="MOM" className="text-slate-900 hover:bg-indigo-50">MOM</SelectItem>
                    {form.filingGoverningAuthority && !['IRAS','ACRA','CPF','AGD','MOM'].includes(form.filingGoverningAuthority) && (
                      <SelectItem value={form.filingGoverningAuthority} className="text-slate-900 hover:bg-indigo-50">{form.filingGoverningAuthority}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Dynamic Compliance Fields - Now placed after default fields */}
              {isLoadingComplianceFields ? (
                <div className="col-span-2 text-center text-slate-500">Loading compliance fields...</div>
              ) : (
                complianceFields.filter(f => f.enabled).map(field => (
                  <div className="space-y-2" key={field._id || field.name}>
                    <label className="block text-sm font-medium text-slate-700">
                      {field.name}
                      {field.required ? <span className="text-red-500 ml-1">*</span> : null}
                      {field.description && <span className="block text-xs text-slate-500">{field.description}</span>}
                    </label>
                    <Input
                      className="w-full border-slate-300 rounded-lg p-2 text-base"
                      value={dynamicFieldValues[field.name] || ''}
                      onChange={e => handleDynamicFieldChange(field.name, e.target.value)}
                      
                      required={!!field.required}
                    />
                  </div>
                ))
              )}
            </div>
            
            <h2 className="text-lg font-semibold mt-6 mb-3">Date Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Start Date</label>
                <Input 
                  className="w-full border-slate-300 rounded-lg p-2 text-base" 
                  type="date" 
                  value={form.filingStartDate} 
                  onChange={e => handleFormChange("filingStartDate", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">End Date</label>
                <Input 
                  className="w-full border-slate-300 rounded-lg p-2 text-base" 
                  type="date" 
                  value={form.filingEndDate} 
                  onChange={e => handleFormChange("filingEndDate", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Submission Deadline</label>
                <Input 
                  className="w-full border-slate-300 rounded-lg p-2 text-base" 
                  type="date" 
                  value={form.filingSubmissionDeadline} 
                  onChange={e => handleFormChange("filingSubmissionDeadline", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Submission Date</label>
                <Input 
                  className="w-full border-slate-300 rounded-lg p-2 text-base" 
                  type="date" 
                  value={form.filingSubmissionDate} 
                  onChange={e => handleFormChange("filingSubmissionDate", e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                {/* Amount field removed as requested */}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Submission Status</label>
                <Select value={form.filingSubmissionStatus} onValueChange={(val: string) => handleFormChange("filingSubmissionStatus", val)}>
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    <SelectItem value="Pending" className="text-slate-900 hover:bg-indigo-50">Pending</SelectItem>
                    <SelectItem value="Completed" className="text-slate-900 hover:bg-indigo-50">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Submit By</label>
                <Select value={form.submittedBy || ''} onValueChange={(val: string) => handleFormChange("submittedBy", val)}>
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    {isLoadingEmployees ? (
                      <SelectItem value="loading" disabled className="text-slate-500">Loading employees...</SelectItem>
                    ) : employees.length > 0 ? (
                      employees.map((emp: any) => (
                        <SelectItem key={emp._id || emp.id} value={emp._id || emp.id} className="text-slate-900 hover:bg-indigo-50">
                          {emp.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-employees" disabled className="text-slate-500">No employees available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Reminder Days</label>
                <Input 
                  className="w-full border-slate-300 rounded-lg p-2 text-base" 
                  type="number" 
                  value={form.reminderDays} 
                  onChange={e => handleFormChange("reminderDays", e.target.value)} 
                  
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Reminder Policy</label>
                <Select value={form.reminderPolicy} onValueChange={(val: string) => handleFormChange("reminderPolicy", val)}>
                  <SelectTrigger className="w-full border-slate-300 rounded-lg p-2 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-lg shadow-md">
                    <SelectItem value="One time" className="text-slate-900 hover:bg-indigo-50">One time</SelectItem>
                    <SelectItem value="Two times" className="text-slate-900 hover:bg-indigo-50">Two times</SelectItem>
                    <SelectItem value="Until Renewal" className="text-slate-900 hover:bg-indigo-50">Until Renewal</SelectItem>
                  </SelectContent>
                </Select>
                <ul className="text-xs text-slate-600 mt-2 list-disc pl-4">
                  <li>One time: One reminder at {form.reminderDays} days before renewal</li>
                  <li>Two times: Reminders at {form.reminderDays} and 3 days before</li>
                  <li>Until Renewal: Daily reminders from {form.reminderDays} days until renewal</li>
                </ul>
              </div>
            </div>
            
            <h2 className="text-lg font-semibold mt-6 mb-3">Remarks</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Additional Notes</label>
                <textarea 
                  className="w-full border border-slate-400 rounded-lg p-2 text-base min-h-[80px] max-h-[120px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  value={form.filingRemarks} 
                  onChange={e => handleFormChange("filingRemarks", e.target.value)} 
                  
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-4 py-2"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium px-4 py-2 shadow-md hover:shadow-lg"
                onClick={async () => {
                  const isCompleted = form.filingSubmissionStatus === "Completed";
                  const hasSubmissionDate = !!form.filingSubmissionDate;
                  let newStartDate = form.filingStartDate;
                  let newEndDate = form.filingEndDate;
                  let newSubmissionDeadline = form.filingSubmissionDeadline;
                  const frequency = form.filingFrequency || form.filingRecurringFrequency || "Monthly";
                  // Merge dynamic field values into saveData
                  let saveData = {
                    policy: form.filingName,
                    category: form.filingComplianceCategory,
                    status: "Non-Compliant",
                    lastAudit: newStartDate,
                    issues: 0,
                    frequency: form.filingFrequency,
                    governingAuthority: form.filingGoverningAuthority,
                    endDate: newEndDate,
                    submissionDeadline: newSubmissionDeadline,
                    recurringFrequency: form.filingRecurringFrequency,
                    remarks: form.filingRemarks,
                    filingSubmissionDate: form.filingSubmissionDate,
                    reminderDays: form.reminderDays,
                    reminderPolicy: form.reminderPolicy,
                    submittedBy: form.submittedBy,
                    complianceFieldValues: dynamicFieldValues // <--- store dynamic field values
                  };
                  // Get complianceId for ledger entry if editing
                  let complianceId = null;
                  if (editIndex !== null && complianceItems[editIndex]?._id) {
                    complianceId = complianceItems[editIndex]._id;
                  }
                  if (isCompleted && hasSubmissionDate) {
                    const currentEndDate = new Date(form.filingEndDate);
                    if (!isNaN(currentEndDate.getTime())) {
                      const nextStartDateObj = new Date(currentEndDate);
                      nextStartDateObj.setDate(currentEndDate.getDate() + 1);
                      newStartDate = `${nextStartDateObj.getFullYear()}-${String(nextStartDateObj.getMonth() + 1).padStart(2, "0")}-${String(nextStartDateObj.getDate()).padStart(2, "0")}`;
                      newEndDate = calculateEndDate(newStartDate, frequency);
                      let prevDeadline = new Date(form.filingSubmissionDeadline);
                      if (!isNaN(prevDeadline.getTime())) {
                        let nextDeadline = new Date(prevDeadline);
                        if (frequency === "Monthly") {
                          nextDeadline.setMonth(prevDeadline.getMonth() + 1);
                        } else if (frequency === "Quarterly") {
                          nextDeadline.setMonth(prevDeadline.getMonth() + 3);
                        } else if (frequency === "Yearly") {
                          nextDeadline.setFullYear(prevDeadline.getFullYear() + 1);
                        }
                        const yyyy = nextDeadline.getFullYear();
                        const mm = String(nextDeadline.getMonth() + 1).padStart(2, "0");
                        const dd = String(nextDeadline.getDate()).padStart(2, "0");
                        newSubmissionDeadline = `${yyyy}-${mm}-${dd}`;
                      } else {
                        newSubmissionDeadline = newStartDate;
                      }
                    }
                    saveData = {
                      ...saveData,
                      lastAudit: newStartDate,
                      endDate: newEndDate,
                      submissionDeadline: newSubmissionDeadline
                    };
                  }
                  if (editIndex !== null) {
                    const itemToEdit = complianceItems[editIndex] as ComplianceItem;
                    if (itemToEdit._id) {
                      await editMutation.mutateAsync({ _id: itemToEdit._id, data: saveData });
                      queryClient.setQueryData(["compliance"], (oldData: ComplianceItem[]) =>
                        oldData ? oldData.map((item, idx) =>
                          idx === editIndex ? { ...item, ...saveData } : item
                        ) : []
                      );
                      complianceId = itemToEdit._id; // ensure we have id for ledger
                    }
                  } else {
                    // Capture returned new compliance to get its _id for ledger linkage
                    const newItem: any = await addMutation.mutateAsync(saveData);
                    if (newItem && (newItem._id || newItem.id)) {
                      complianceId = newItem._id || newItem.id;
                    }
                  }
                  if (isCompleted && hasSubmissionDate) {
                    try {
                      const ledgerData = {
                        ...form,
                        complianceId: complianceId
                      };
                      const res = await fetch('/api/ledger/insert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(ledgerData)
                      });
                      if (!res.ok) throw new Error('Failed to save ledger data');
                      toast({ title: 'Ledger entry created' });
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to create ledger',
                        variant: 'destructive'
                      });
                    }
                  }
                  setForm((prev) => ({
                    ...prev,
                    filingStartDate: isCompleted && hasSubmissionDate ? newStartDate : prev.filingStartDate,
                    filingEndDate: isCompleted && hasSubmissionDate ? newEndDate : prev.filingEndDate,
                    filingSubmissionDeadline: isCompleted && hasSubmissionDate ? newSubmissionDeadline : prev.filingSubmissionDeadline,
                    filingSubmissionStatus: "Pending",
                    filingSubmissionDate: "",
                    amount: ""
                  }));
                  setDynamicFieldValues({});
                  setModalOpen(false);
                  setEditIndex(null);
                }}
              >
                Save & Submit
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}