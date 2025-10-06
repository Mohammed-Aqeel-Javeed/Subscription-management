import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

// Calculate compliance status based on dates
const getComplianceStatus = (endDate: string, submissionDeadline: string): { status: string, color: string, bgColor: string } => {
  // If no End Date, return No Due
  if (!endDate) {
    return { status: "No Due", color: "text-slate-700", bgColor: "bg-slate-100" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  // Calculate 2 days before end date
  const twoDaysBeforeEnd = new Date(end);
  twoDaysBeforeEnd.setDate(end.getDate() - 2);
  twoDaysBeforeEnd.setHours(0, 0, 0, 0);
  
  console.log('Status Debug:', {
    today: today.toDateString(),
    endDate: end.toDateString(),
    submissionDeadline: submissionDeadline || 'Not set',
    twoDaysBeforeEnd: twoDaysBeforeEnd.toDateString(),
    todayTime: today.getTime(),
    twoDaysBeforeTime: twoDaysBeforeEnd.getTime(),
    endTime: end.getTime(),
    isGoingToBeDue: today.getTime() === twoDaysBeforeEnd.getTime(),
    isDue: today.getTime() >= end.getTime()
  });
  
  // Check for "Going to be Due" first (2 days before end date)
  if (today.getTime() === twoDaysBeforeEnd.getTime()) {
    return { status: "Going to be Due", color: "text-amber-800", bgColor: "bg-amber-100" };
  }
  
  // If we have a submission deadline, use it for Due/Late logic
  if (submissionDeadline) {
    const deadline = new Date(submissionDeadline);
    deadline.setHours(0, 0, 0, 0);
    
    if (today.getTime() >= end.getTime() && today.getTime() < deadline.getTime()) {
      return { status: "Due", color: "text-orange-800", bgColor: "bg-orange-100" };
    } else if (today.getTime() >= deadline.getTime()) {
      return { status: "Late", color: "text-white", bgColor: "bg-red-600 animate-pulse shadow-lg border-2 border-red-400" };
    }
  } else {
    // If no submission deadline but past end date, consider it Due
    if (today.getTime() >= end.getTime()) {
      return { status: "Due", color: "text-orange-800", bgColor: "bg-orange-100" };
    }
  }
  
  // Default case
  return { status: "No Due", color: "text-slate-700", bgColor: "bg-slate-100" };
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
  
  // Dropdown open state for governing authority
  const [isGoverningAuthorityOpen, setIsGoverningAuthorityOpen] = useState(false);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isGoverningAuthorityOpen && !target.closest('.governing-authority-dropdown')) {
        setIsGoverningAuthorityOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGoverningAuthorityOpen]);
  
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
    isDraft?: boolean;
    paymentDate?: string;
  };
  
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  
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
    submissionNotes: "",
    filingSubmissionDate: "",
    reminderDays: "7",
    reminderPolicy: "One time",
    submittedBy: "",
    amount: "",
    paymentDate: "",
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
    <div className="min-h-screen bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Modern Professional Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Compliance Management</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = "/compliance-ledger";
                }}
                className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-indigo-200 hover:border-indigo-300 font-medium transition-all duration-200"
              >
                <FileText className="h-4 w-4 mr-2" />
                Compliance Ledger
              </Button>
              
              <Button
                onClick={() => {
                  setEditIndex(null);
                  setShowSubmissionDetails(false);
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
                    submissionNotes: "",
                    filingSubmissionDate: "",
                    reminderDays: "7",
                    reminderPolicy: "One time",
                    submittedBy: "",
                    amount: "",
                    paymentDate: ""
                  });
                  setModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Compliance
              </Button>
            </div>
          </div>

          {/* Key Metrics Cards with Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-100">Total Filings</p>
                  <p className="text-2xl font-bold text-white mt-1">{total}</p>
                </div>
                <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-100">Pending</p>
                  <p className="text-2xl font-bold text-white mt-1">{pending}</p>
                </div>
                <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search compliance filings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border-gray-200 bg-white text-gray-900 placeholder-gray-500 h-10 text-sm"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 border-gray-200 bg-white text-gray-900 h-10 text-sm">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category, idx) => (
                    <SelectItem key={String(category) + idx} value={String(category)}>
                      {String(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Professional Data Table */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide bg-gray-50">
                    Policy
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Category
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Due Date
                  </TableHead>
                  <TableHead className="h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Submitted Date
                  </TableHead>
                  <TableHead className="h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Submission
                  </TableHead>
                  <TableHead className="h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <div className="space-y-2 p-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="h-10 w-10 text-gray-300 mb-2" />
                        <p className="text-lg font-medium text-gray-600">No compliance records found</p>
                        <p className="text-gray-500 mt-1">Try adjusting your filters or add a new compliance record</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item: ComplianceItem) => (
                    <TableRow key={item._id || item.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                      <TableCell className="px-4 py-4 font-medium text-gray-900">
                        {item.policy}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-medium border-blue-200">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        {(() => {
                          // Check if item is a draft first
                          if (item.isDraft || item.status === "Draft") {
                            return (
                              <span className="px-3 py-1 rounded-full text-xs font-medium text-amber-800 bg-amber-100 transition-all duration-300">
                                Draft
                              </span>
                            );
                          }
                          
                          const statusInfo = getComplianceStatus(item.endDate || '', item.submissionDeadline || '');
                          const isLate = statusInfo.status === "Late";
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor} ${
                              isLate ? 'animate-pulse relative' : ''
                            } transition-all duration-300`}>
                              {isLate && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full animate-ping"></span>
                              )}
                              {statusInfo.status}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-gray-700 font-medium">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          <span className="text-sm">{formatDate(item.submissionDeadline)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-gray-700 font-medium">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          <span className="text-sm">{formatDate(item.filingSubmissionDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          title="Submit now"
                          onClick={() => {
                            const index = (complianceItems as ComplianceItem[]).findIndex(
                              (ci: ComplianceItem) => (ci._id || ci.id) === (item._id || item.id)
                            );
                            setEditIndex(index);
                            setShowSubmissionDetails(true);
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
                              submissionNotes: "",
                              filingSubmissionDate: "",
                              reminderDays: currentItem.reminderDays !== undefined && currentItem.reminderDays !== null ? String(currentItem.reminderDays) : "7",
                              reminderPolicy: currentItem.reminderPolicy || "One time",
                              submittedBy: currentItem.submittedBy || "",
                              amount: currentItem.amount !== undefined && currentItem.amount !== null ? String(currentItem.amount) : "",
                              paymentDate: currentItem.paymentDate || ""
                            });
                          }}
                          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 hover:text-green-800 font-medium text-sm px-3 py-1 transition-colors"
                        >
                          Submit now
                        </Button>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const index = (complianceItems as ComplianceItem[]).findIndex(
                                (ci: ComplianceItem) => (ci._id || ci.id) === (item._id || item.id)
                              );
                              setEditIndex(index);
                              setShowSubmissionDetails(false);
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
                                submissionNotes: "",
                                filingSubmissionDate: "",
                                reminderDays: currentItem.reminderDays !== undefined && currentItem.reminderDays !== null ? String(currentItem.reminderDays) : "7",
                                reminderPolicy: currentItem.reminderPolicy || "One time",
                                submittedBy: currentItem.submittedBy || "",
                                amount: currentItem.amount !== undefined && currentItem.amount !== null ? String(currentItem.amount) : "",
                                paymentDate: currentItem.paymentDate || ""
                              });
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors p-2"
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
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors p-2"
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
          </div>
        </div>
      </div>
      
      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) setIsFullscreen(false); setModalOpen(v); }}>
        <DialogContent className={`${isFullscreen ? 'max-w-[95vw] w-[95vw] h-[92vh] max-h-[92vh]' : 'max-w-4xl min-w-[400px] max-h-[80vh]'} overflow-y-auto rounded-2xl border-slate-200 shadow-2xl p-0 bg-white transition-[width,height] duration-300`}>
          {/* Local keyframes for the sheen animation */}
          <style>{`@keyframes sheen { 0% { transform: translateX(-60%); } 100% { transform: translateX(180%); } }`}</style>
          <DialogHeader className={`bg-gradient-to-r from-indigo-500 to-indigo-600 text-white ${isFullscreen ? 'p-4 md:p-5' : 'p-5'} rounded-t-2xl`}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold flex items-center gap-3">
                  <FileText className="h-6 w-6" />
                  {showSubmissionDetails ? "Submission" : (editIndex !== null ? (form.filingName || 'Edit Compliance') : "Compliance")}
                </DialogTitle>
                {/* Dynamic Status Badge - hidden when in Submission view */}
                {!showSubmissionDetails && (() => {
                  const statusInfo = getComplianceStatus(form.filingEndDate, form.filingSubmissionDeadline);
                  const isLate = statusInfo.status === "Late";
                  return (
                    <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusInfo.color} ${statusInfo.bgColor} ${
                      isLate ? 'animate-bounce relative' : ''
                    } transition-all duration-300`}>
                      {isLate && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                      )}
                      {statusInfo.status}
                    </span>
                  );
                })()}
              </div>
              {/* Right side controls: Submission button, fullscreen, View Ledger */}
              <div className="flex items-center gap-3 pr-1 mr-14">
                {/* Submission Toggle Button - highlighted in green theme, now on right */}
                {!showSubmissionDetails && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSubmissionDetails(!showSubmissionDetails)}
                    className={`relative overflow-hidden px-3 py-1 text-sm rounded-lg font-semibold transition-all duration-300
                      bg-gradient-to-r from-emerald-500/70 to-green-600/70 text-white border border-emerald-300/60 hover:from-emerald-500 hover:to-green-600 hover:shadow-[0_8px_16px_rgba(16,185,129,0.25)]
                    `}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Submission
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                  onClick={() => setIsFullscreen(f => !f)}
                  className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold rounded-xl shadow-md transition-all duration-300 hover:scale-105 focus:ring-2 focus:ring-white/50 border-indigo-200 h-10 w-10 p-0 flex items-center justify-center"
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
                {editIndex !== null && complianceItems[editIndex]?._id && (
                  <Button
                    type="button"
                    variant="default"
                    className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-4 py-2 flex items-center gap-2 shadow-md transition-all duration-300 rounded-xl"
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
          <form className={`${isFullscreen ? 'p-4 md:p-6 lg:p-8' : 'p-6'}`}>
            {/* Show Submission Details when showSubmissionDetails is true */}
            {showSubmissionDetails && (
              <>
                {/* Submission Details heading removed as requested */}
                <div className={`grid gap-6 mb-8 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {/* Submission Date and Submitted By fields */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Submission Date</label>
                    <Input 
                      className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40" 
                      type="date" 
                      value={form.filingSubmissionDate} 
                      onChange={e => handleFormChange("filingSubmissionDate", e.target.value)} 
                      disabled={editIndex === null}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Submitted By</label>
                    <Select 
                      value={form.submittedBy || ''} 
                      onValueChange={(val: string) => handleFormChange("submittedBy", val)}
                      disabled={editIndex === null}
                    >
                      <SelectTrigger className="w-full border-slate-300 rounded-lg p-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
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

                {/* Remarks under Submission Details for better usability in focused view */}
                <div className="mt-4 mb-8">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Submission Notes</label>
                  <Textarea
                    className="w-full border-slate-300 rounded-lg text-base min-h-[120px] md:min-h-[140px] resize-y focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 p-4"
                    value={form.submissionNotes}
                    onChange={(e) => handleFormChange("submissionNotes", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Show Compliance Details when not viewing Submission Details */}
            {!showSubmissionDetails && (
              <>
                {/* Compliance Details heading removed as requested */}
            {/* General Information Grid - expands to more columns in fullscreen */}
            <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-2'}`}>
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
                <div className="relative governing-authority-dropdown">
                  <div className="relative">
                    <Input
                      className="w-full border-slate-300 rounded-lg p-2 pr-10 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Enter or select authority"
                      value={form.filingGoverningAuthority || ''}
                      onChange={(e) => handleFormChange('filingGoverningAuthority', e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                      onClick={() => setIsGoverningAuthorityOpen(!isGoverningAuthorityOpen)}
                    >
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {isGoverningAuthorityOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-[200px] overflow-hidden">
                      <div className="max-h-[180px] overflow-y-auto p-1">
                        <div className="text-xs font-semibold tracking-wide text-slate-500 px-2 py-1 uppercase">Authorities</div>
                        {['IRAS', 'ACRA', 'CPF', 'AGD', 'MOM'].map(authority => (
                          <div
                            key={authority}
                            className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer rounded"
                            onClick={() => {
                              handleFormChange('filingGoverningAuthority', authority);
                              setIsGoverningAuthorityOpen(false);
                            }}
                          >
                            {authority}
                          </div>
                        ))}
                        {!['IRAS', 'ACRA', 'CPF', 'AGD', 'MOM'].includes(form.filingGoverningAuthority || "") && form.filingGoverningAuthority && (
                          <div className="px-3 py-2 text-sm italic text-slate-600 bg-amber-50 rounded">
                            {form.filingGoverningAuthority} (custom)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Added date range & deadline fields moved from previous Submission Details section */}
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
              {/* Moved Reminder Days and Reminder Policy into Compliance Details */}
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
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Payment Date</label>
                <Input 
                  className="w-full border-slate-300 rounded-lg p-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40" 
                  type="date" 
                  value={form.paymentDate} 
                  onChange={e => handleFormChange("paymentDate", e.target.value)} 
                />
              </div>
              {/* Moved Remarks (Additional Notes) into Compliance Details; hidden when Submission view is active */}
              {!showSubmissionDetails && (
              <div className="space-y-2 col-span-full">
                <label className="block text-sm font-medium text-slate-700">Compliance Notes</label>
                <textarea 
                  className="w-full border border-slate-400 rounded-lg p-2 text-base min-h-[80px] max-h-[120px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  value={form.filingRemarks} 
                  onChange={e => handleFormChange("filingRemarks", e.target.value)} 
                />
              </div>
              )}
              
              {/* Dynamic Compliance Fields - Now placed after default fields */}
              {isLoadingComplianceFields ? (
                <div className="col-span-full text-center text-slate-500">Loading compliance fields...</div>
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
            </>
            )}
            
            {/* Removed duplicate Reminder and Remarks sections; these fields are now in Compliance Details */}

            {/* Always show action buttons (including in Submission view) */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-6 py-2"
                onClick={() => setModalOpen(false)}
              >
                Exit
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-6 py-2"
                onClick={async () => {
                  // Save as draft logic - save the compliance item with current form data
                  const calculatedStatus = getComplianceStatus(form.filingEndDate, form.filingSubmissionDeadline);
                  
                  let saveData = {
                    policy: form.filingName,
                    category: form.filingComplianceCategory,
                    status: "Draft", // Set status to "Draft" for draft items
                    lastAudit: form.filingStartDate,
                    issues: 0,
                    frequency: form.filingFrequency,
                    governingAuthority: form.filingGoverningAuthority,
                    endDate: form.filingEndDate,
                    submissionDeadline: form.filingSubmissionDeadline,
                    recurringFrequency: form.filingRecurringFrequency,
                    remarks: form.filingRemarks,
                    filingSubmissionDate: form.filingSubmissionDate,
                    reminderDays: form.reminderDays,
                    reminderPolicy: form.reminderPolicy,
                    submittedBy: form.submittedBy,
                    amount: form.amount,
                    paymentDate: form.paymentDate,
                    complianceFieldValues: dynamicFieldValues,
                    isDraft: true // Mark as draft
                  };

                  try {
                    if (editIndex !== null) {
                      const itemToEdit = complianceItems[editIndex] as ComplianceItem;
                      if (itemToEdit._id) {
                        await editMutation.mutateAsync({ _id: itemToEdit._id, data: saveData });
                      }
                    } else {
                      await addMutation.mutateAsync(saveData);
                    }
                    toast({ title: 'Draft saved successfully' });
                    
                    // Close modal and reset form after saving draft
                    setModalOpen(false);
                    setEditIndex(null);
                    setShowSubmissionDetails(false);
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
                      submissionNotes: "",
                      filingSubmissionDate: "",
                      reminderDays: "7",
                      reminderPolicy: "One time",
                      submittedBy: "",
                      amount: "",
                      paymentDate: ""
                    });
                    setDynamicFieldValues({});
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'Failed to save draft',
                      variant: 'destructive'
                    });
                  }
                }}
              >
                Save Draft
              </Button>
              <Button 
                type="button" 
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium px-6 py-2 shadow-md hover:shadow-lg"
                onClick={async () => {
                  const hasSubmissionDate = !!form.filingSubmissionDate;
                  const hasSubmittedBy = !!form.submittedBy;
                  let newStartDate = form.filingStartDate;
                  let newEndDate = form.filingEndDate;
                  let newSubmissionDeadline = form.filingSubmissionDeadline;
                  const frequency = form.filingFrequency || form.filingRecurringFrequency || "Monthly";
                  
                  // Calculate the actual status to store in database
                  const calculatedStatus = getComplianceStatus(newEndDate, newSubmissionDeadline);
                  
                  // Merge dynamic field values into saveData
                  let saveData = {
                    policy: form.filingName,
                    category: form.filingComplianceCategory,
                    status: calculatedStatus.status, // Use calculated status instead of hardcoded "Non-Compliant"
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
                  if (hasSubmissionDate && hasSubmittedBy) {
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
                    // Recalculate status for the new period dates
                    const newPeriodStatus = getComplianceStatus(newEndDate, newSubmissionDeadline);
                    
                    saveData = {
                      ...saveData,
                      lastAudit: newStartDate,
                      endDate: newEndDate,
                      submissionDeadline: newSubmissionDeadline,
                      status: newPeriodStatus.status // Update status for new period
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
                  if (hasSubmissionDate && hasSubmittedBy) {
                    try {
                      const ledgerData = {
                        ...form,
                        // Use submissionNotes for ledger remarks
                        filingRemarks: form.submissionNotes,
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
                    filingStartDate: hasSubmissionDate && hasSubmittedBy ? newStartDate : prev.filingStartDate,
                    filingEndDate: hasSubmissionDate && hasSubmittedBy ? newEndDate : prev.filingEndDate,
                    filingSubmissionDeadline: hasSubmissionDate && hasSubmittedBy ? newSubmissionDeadline : prev.filingSubmissionDeadline,
                    filingSubmissionStatus: "Pending",
                    filingSubmissionDate: "",
                    submissionNotes: "",
                    amount: "",
                    paymentDate: ""
                  }));
                  setDynamicFieldValues({});
                  setModalOpen(false);
                  setEditIndex(null);
                }}
              >
                Save Compliance
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}