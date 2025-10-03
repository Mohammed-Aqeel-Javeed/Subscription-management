import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Search, FileText, Calendar, CheckCircle, XCircle, Clock, Filter } from "lucide-react";

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

export default function ComplianceLedger() {
  // Read all ledger records from MongoDB
  const [ledgerItems, setLedgerItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [categories, setCategories] = React.useState<string[]>([]);
  
  // Get compliance id from URL
  const getComplianceIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  };
  
  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ledger/list");
      if (!res.ok) throw new Error("Failed to fetch ledger data");
      const data = await res.json();
      const complianceId = getComplianceIdFromUrl();
      // Filter ledger items by compliance id if present
      let filteredData = data;
      if (complianceId) {
        filteredData = data.filter((item: any) => item.complianceId === complianceId || item._id === complianceId);
      }
      setLedgerItems(filteredData);
      
      // Extract unique categories with proper typing
      const categorySet = new Set<string>();
      filteredData.forEach((item: any) => {
        if (item.filingComplianceCategory && typeof item.filingComplianceCategory === 'string') {
          categorySet.add(item.filingComplianceCategory);
        }
      });
      setCategories(Array.from(categorySet));
    } catch {
      setLedgerItems([]);
    }
    setLoading(false);
  };
  
  React.useEffect(() => {
    fetchLedger();
    // Re-fetch if URL changes
    window.addEventListener('popstate', fetchLedger);
    return () => window.removeEventListener('popstate', fetchLedger);
  }, []);
  
  // Filter ledger items based on search term and category
  const filteredLedgerItems = React.useMemo(() => {
    let filtered = ledgerItems;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.filingName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.filingComplianceCategory?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.filingSubmissionStatus?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(item => item.filingComplianceCategory === selectedCategory);
    }
    
    return filtered;
  }, [ledgerItems, searchTerm, selectedCategory]);
  
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
  
  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Compliance General Ledger</h2>
              <p className="text-lg text-gray-600 mt-2 font-light">View all compliance records and their audit history</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search filings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-48 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={fetchLedger}
                  className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-md"
                >
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <Card className="shadow-lg border-0 overflow-hidden bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-indigo-100 to-blue-100 border-b border-gray-200">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-800">
              <FileText className="w-5 h-5 text-indigo-600" />
              Compliance Records
              <Badge className="ml-2 bg-indigo-100 text-indigo-800">
                {filteredLedgerItems.length} {filteredLedgerItems.length === 1 ? 'Record' : 'Records'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-700">Filing Name</TableHead>
                    <TableHead className="font-semibold text-gray-700">Category</TableHead>
                    <TableHead className="font-semibold text-gray-700">Start Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">End Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Submission Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3"></div>
                          <p className="text-gray-600">Loading compliance records...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLedgerItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <FileText className="w-12 h-12 text-gray-400 mb-3" />
                          <p className="text-lg font-medium text-gray-900">No records found</p>
                          <p className="text-gray-500 mt-1">Try adjusting your search or check back later</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLedgerItems.map((item: any) => {
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
                          <TableCell className="font-medium text-gray-900">{item.filingName}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {item.filingComplianceCategory}
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