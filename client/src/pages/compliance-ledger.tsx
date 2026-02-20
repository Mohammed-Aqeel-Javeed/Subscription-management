import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FileText, Calendar, CheckCircle, XCircle, Clock, ArrowLeft, History } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

// Helper to format date as dd/mm/yyyy
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};

// Dynamic status calculation - same as in compliance.tsx
const getComplianceStatus = (endDate?: string, submissionDeadline?: string): string => {
  // If no dates provided, default to Pending
  if (!endDate && !submissionDeadline) return "Pending";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today for accurate comparison
  
  // Use submission deadline if available, otherwise use end date
  const targetDate = new Date(submissionDeadline || endDate || "");
  if (isNaN(targetDate.getTime())) return "Pending";
  
  targetDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
  
  // If today is past the target date, it's overdue
  if (today > targetDate) {
    return "Overdue";
  }
  
  // If today equals the target date, it's due today
  if (today.getTime() === targetDate.getTime()) {
    return "Due Today";
  }
  
  // If target date is in the future, it's pending
  return "Pending";
};

// Function to map status values and get appropriate icon
const getStatusInfo = (status: string) => {
  if (status === "Completed") {
    return { 
      text: "Completed", 
      variant: "default" as const, 
      icon: <CheckCircle className="w-4 h-4" />,
      color: "bg-green-100 text-green-800"
    };
  } else if (status === "Overdue") {
    return { 
      text: "Overdue", 
      variant: "destructive" as const, 
      icon: <XCircle className="w-4 h-4" />,
      color: "bg-red-100 text-red-800"
    };
  } else if (status === "Due Today") {
    return { 
      text: "Due Today", 
      variant: "secondary" as const, 
      icon: <Clock className="w-4 h-4" />,
      color: "bg-orange-100 text-orange-800"
    };
  } else if (status === "Pending") {
    return { 
      text: "Pending", 
      variant: "secondary" as const, 
      icon: <Clock className="w-4 h-4" />,
      color: "bg-yellow-100 text-yellow-800"
    };
  } else {
    return { 
      text: status, 
      variant: "destructive" as const, 
      icon: <XCircle className="w-4 h-4" />,
      color: "bg-red-100 text-red-800"
    };
  }
};

const getCategoryPillClasses = (category?: string) => {
  const value = String(category || "").trim();
  if (!value) return "bg-slate-100 text-slate-700 border-slate-200";

  const palette = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-amber-50 text-amber-800 border-amber-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
  ];

  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash + value.charCodeAt(i)) % 100000;
  return palette[hash % palette.length];
};

export default function ComplianceLedger() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read all ledger records from MongoDB
  const [ledgerItems, setLedgerItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const complianceId = searchParams.get("id");
  const complianceNameParam = searchParams.get("name");

  const isFilteredById = Boolean(complianceId);
  const tableColumnCount = isFilteredById ? 6 : 7;
  
  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ledger/list");
      if (!res.ok) throw new Error("Failed to fetch ledger data");
      const data = await res.json();
      // Filter ledger items by compliance id if present
      let filteredData = data;
      if (complianceId) {
        filteredData = data.filter((item: any) => item.complianceId === complianceId || item._id === complianceId);
      }
      setLedgerItems(filteredData);
    } catch {
      setLedgerItems([]);
    }
    setLoading(false);
  };
  
  React.useEffect(() => {
    fetchLedger();
  }, [complianceId]);
  
  const displayedLedgerItems = ledgerItems;
  
  // Delete handler
  const handleDelete = async (id: string) => {
    if (window.confirm('Do you want to delete this ledger record?')) {
      try {
        const res = await fetch(`/api/ledger/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete record");
        await fetchLedger();
      } catch {
        // Optionally show error
      }
    }
  };
  
  const derivedName = displayedLedgerItems?.[0]?.filingName || displayedLedgerItems?.[0]?.policy;
  const headerName = complianceNameParam ? decodeURIComponent(complianceNameParam) : derivedName;
  const headerTitle = isFilteredById && headerName ? `${headerName} History Log` : "Compliance History Log";

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-['Inter']">
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center shadow-lg">
                <History className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{headerTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate("/compliance")}
                variant="outline"
                className="flex items-center gap-2 bg-gradient-to-br from-indigo-500/90 to-blue-600/90 hover:from-indigo-600/90 hover:to-blue-700/90 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Compliance
              </Button>
            </div>
          </div>
        </div>

        <Card className="shadow-lg border-0 overflow-hidden bg-white/80 backdrop-blur-sm flex-1 min-h-0">
          <CardContent className="p-0 h-full">
            <div className="overflow-auto h-full">
              <Table>
                <TableHeader className="bg-gray-200">
                  <TableRow className="border-b border-gray-300">
                    {!isFilteredById && (
                      <TableHead className="sticky top-0 z-20 font-semibold text-gray-800 bg-gray-200">Filing Name</TableHead>
                    )}
                    <TableHead className="sticky top-0 z-20 font-semibold text-gray-800 bg-gray-200 text-left">Category</TableHead>
                    <TableHead className="sticky top-0 z-20 font-semibold text-gray-800 bg-gray-200 text-left">Start Date</TableHead>
                    <TableHead className="sticky top-0 z-20 font-semibold text-gray-800 bg-gray-200 text-left">End Date</TableHead>
                    <TableHead className="sticky top-0 z-20 font-semibold text-gray-800 bg-gray-200 text-left">Submission Date</TableHead>
                    <TableHead className="sticky top-0 z-20 font-semibold text-gray-800 bg-gray-200 text-left">Status</TableHead>
                    <TableHead className="sticky top-0 z-20 font-semibold text-gray-800 bg-gray-200 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={tableColumnCount} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3"></div>
                          <p className="text-gray-600">Loading compliance records...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : displayedLedgerItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableColumnCount} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <FileText className="w-12 h-12 text-gray-400 mb-3" />
                          <p className="text-lg font-medium text-gray-900">No records found</p>
                          <p className="text-gray-500 mt-1">Check back later</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedLedgerItems.map((item: any) => {
                      // Calculate dynamic status based on submission date and deadline
                      let displayStatus = item.filingSubmissionStatus;
                      
                      // If there's a submission date, it's completed
                      if (item.filingSubmissionDate) {
                        displayStatus = "Completed";
                      } else {
                        // Otherwise calculate based on dates
                        displayStatus = getComplianceStatus(item.filingEndDate, item.filingSubmissionDeadline);
                      }
                      
                      const statusInfo = getStatusInfo(displayStatus);
                      return (
                        <TableRow key={item._id} className="hover:bg-gray-50 transition-colors">
                          {!isFilteredById && (
                            <TableCell className="font-medium text-gray-900">{item.filingName}</TableCell>
                          )}
                          <TableCell className="text-left">
                            <div className="flex items-center justify-start">
                              <span
                                className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border min-w-[110px] ${getCategoryPillClasses(
                                  item.filingComplianceCategory
                                )}`}
                              >
                                {item.filingComplianceCategory || "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-gray-700">
                              <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                              {formatDate(item.filingStartDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-gray-700">
                              <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                              {formatDate(item.filingEndDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-gray-700">
                              <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                              {formatDate(item.filingSubmissionDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusInfo.color} flex items-center gap-1`}>
                              {statusInfo.icon}
                              {statusInfo.text}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                onClick={() => handleDelete(item._id)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}