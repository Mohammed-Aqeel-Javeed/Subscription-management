import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/card";
import { API_BASE_URL } from "@/lib/config";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Loader2, 
  AlertCircle, 
  Search, 
  Download, 
  Calendar,
  X,
  FileText,
  BarChart3,
  CheckCircle,
  Clock
} from "lucide-react";
import { format, subMonths } from "date-fns";

interface HistoryData {
  serviceName: string;
  owner: string;
  startDate: string;
  nextRenewal: string;
  status: string;
  _id?: string | { toString(): string };
  [key: string]: any;
}

interface HistoryRecord {
  _id?: string;
  action: string;
  subscriptionId?: string | { toString(): string };
  data: HistoryData & { _id?: string | { toString(): string } };
  updatedFields?: HistoryData & { _id?: string | { toString(): string } };
  timestamp: string;
}

function formatDate(date: string | Date) {
  return format(new Date(date), "MMM dd, yyyy");
}


export default function SubscriptionHistory() {
  // Get serviceName from query params if present
  const location = useLocation();
  // More robust extraction of id from URL
  let idParam = null;
  try {
    const urlParams = new URLSearchParams(location.search || "");
    idParam = urlParams.get("id");
  } catch (e) {
    idParam = null;
  }
  const serviceNameParam = null; // Not used
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredHistory, setFilteredHistory] = useState<HistoryRecord[]>([]);
  const queryClient = useQueryClient();

  // Listen for subscription changes and refresh history
  React.useEffect(() => {
    function handleSubscriptionChange() {
      queryClient.invalidateQueries({ queryKey: ["history"] });
    }
    window.addEventListener('subscription-created', handleSubscriptionChange);
    window.addEventListener('subscription-updated', handleSubscriptionChange);
    window.addEventListener('account-changed', handleSubscriptionChange);
    window.addEventListener('login', handleSubscriptionChange);
    window.addEventListener('logout', handleSubscriptionChange);
    return () => {
      window.removeEventListener('subscription-created', handleSubscriptionChange);
      window.removeEventListener('subscription-updated', handleSubscriptionChange);
      window.removeEventListener('account-changed', handleSubscriptionChange);
      window.removeEventListener('login', handleSubscriptionChange);
      window.removeEventListener('logout', handleSubscriptionChange);
    };
  }, [queryClient]);

  const { data, isLoading, error } = useQuery<HistoryRecord[]>({
    queryKey: ["history", idParam],
    queryFn: async () => {
      // Build URL based on whether we're looking at specific subscription or all
      const url = idParam ? `${API_BASE_URL}/api/history/${idParam}` : `${API_BASE_URL}/api/history/list`;

      console.log(`Fetching history data from: ${url}`);

      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        console.error(`API returned status: ${res.status}`);
        const errorText = await res.text();
        console.error(`Error details: ${errorText}`);
        
        // Handle 401 specifically for better user experience
        if (res.status === 401) {
          // Redirect to login or show auth error
          window.location.href = '/login';
          return [];
        }
        
        throw new Error(`API error: ${res.status}`);
      }

      const result = await res.json();
      if (!Array.isArray(result)) {
        console.error('Unexpected API response format:', result);
        return [];
      }

      console.log(`Received ${result.length} history records from API`);
      return result;
    },
    retry: 1,  // Retry once if request fails
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0
  });

  const history: HistoryRecord[] = Array.isArray(data) ? data : [];

  // Filter based on search term only - the API already filters by subscriptionId
  useEffect(() => {
    if (!history) return;

    console.log(`Starting filter with ${history.length} history records`);

    // Log all returned subscription IDs for debugging
    if (history && history.length > 0) {
      console.log('Returned history records:');
      history.forEach((item, idx) => {
        const itemSubId = item.subscriptionId?.toString();
        const dataId = item.data?._id?.toString();
        const updatedFieldsId = item.updatedFields?._id?.toString();
        console.log(`Record #${idx}: subscriptionId=${itemSubId}, data._id=${dataId}, updatedFields._id=${updatedFieldsId}`);
      });
      console.log(`Selected subscription ID: ${idParam}`);
    }

    // Create a copy of the array and ensure it's properly typed
    let filtered = [...history];

    // Log the initial history length
    console.log(`Initial history records: ${filtered.length}`);

    // We don't need to filter by subscription ID here since the API already does that

    // Apply search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const record = item.data || item.updatedFields || {};
        return (
          record.serviceName?.toLowerCase().includes(searchLower) ||
          record.owner?.toLowerCase().includes(searchLower) ||
          record.ownerName?.toLowerCase().includes(searchLower) ||
          record.status?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by timestamp descending (newest first)
    filtered = filtered.sort((a, b) => {
      const timeA = new Date(b.timestamp || '').getTime();
      const timeB = new Date(a.timestamp || '').getTime();
      if (timeA === timeB) {
        // If timestamps are equal, use _id for consistent ordering
        return (b._id || '').localeCompare(a._id || '');
      }
      return timeA - timeB;
    });

    setFilteredHistory(filtered);
  }, [history, searchTerm, idParam]); // Include idParam in dependencies
  
  const exportData = () => {
    // Implementation for exporting data
    console.log("Exporting data...");
  };
  
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
      case "inactive":
        return "bg-rose-100 text-rose-800 hover:bg-rose-200";
      case "pending":
        return "bg-amber-100 text-amber-800 hover:bg-amber-200";
      default:
        return "bg-slate-100 text-slate-800 hover:bg-slate-200";
    }
  };

  return (
    <motion.div 
      className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-indigo-50 via-white to-cyan-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-700 to-cyan-600 bg-clip-text text-transparent">
                Subscription History
              </h1>
              <p className="text-slate-600 mt-2">Track all changes made to your subscriptions</p>
            </div>
            
            <div className="flex gap-3 mt-4 md:mt-0">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportData}
                className="flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                type="text"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 placeholder-slate-400 shadow-sm"
                placeholder="Search subscriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </motion.div>
        
        {/* Main Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="shadow-xl border border-slate-100 rounded-2xl bg-white overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-12 h-12 text-indigo-500" />
                  </motion.div>
                  <p className="text-slate-600 mt-4">Loading subscription history...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-rose-50 rounded-full p-4 mb-4">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                  </div>
                  <p className="text-rose-500 font-medium text-lg">Failed to load history</p>
                  <p className="text-slate-500 mt-2">Please try again later</p>
                  <Button 
                    variant="outline" 
                    className="mt-4 border-rose-300 text-rose-700 hover:bg-rose-50"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-slate-100 rounded-full p-5 mb-5">
                    <AlertCircle className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-medium text-slate-800 mb-2">
                    No history records found
                  </h3>
                  <p className="text-slate-600 max-w-md text-center">
                    {idParam 
                      ? "No changes have been made to this subscription yet" 
                      : "No subscription changes have been recorded yet"
                    }
                  </p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="bg-slate-100 rounded-full p-5 mb-5">
                    <AlertCircle className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-medium text-slate-800 mb-2">
                    {searchTerm 
                      ? "No matching records found" 
                      : "No filtered records"
                    }
                  </h3>
                  <p className="text-slate-600 max-w-md text-center">
                    {searchTerm 
                      ? "Try adjusting your search terms" 
                      : `${history.length} total records loaded but none match current filters`
                    }
                  </p>
                  {searchTerm && (
                    <Button 
                      variant="outline" 
                      className="mt-4 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      onClick={() => setSearchTerm("")}
                    >
                      Clear Search
                    </Button>
                  )}
                  {!searchTerm && history.length > 0 && (
                    <Badge variant="secondary" className="mt-4">
                      {history.length} records available
                    </Badge>
                  )}
                </div>
              ) : (
                <motion.div 
                  className="w-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Table className="w-full divide-y divide-slate-100">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Subscription</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Owner</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Service</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Start Date</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">End Date</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Amount</TableHead>
                        <TableHead className="font-semibold text-slate-800 py-4 px-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      <AnimatePresence>
                        {filteredHistory.map((item, index) => {
                          const record = item.data || item.updatedFields || {};
                          return (
                            <motion.tr 
                              key={item._id || index}
                              className="hover:bg-slate-50 transition-colors cursor-pointer"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ delay: 0.05 * index }}
                              whileHover={{ scale: 1.01, backgroundColor: "#f8fafc" }}
                            >
                              <TableCell className="py-4 px-6 font-medium text-slate-800">
                                {record.serviceName || "-"}
                              </TableCell>
                              <TableCell className="py-4 px-6 text-slate-700">
                                {record.owner || "-"}
                              </TableCell>
                              <TableCell className="py-4 px-6 text-slate-700">
                                {record.serviceName || "-"}
                              </TableCell>
                              <TableCell className="py-4 px-6 text-slate-600">
                                {record.startDate ? formatDate(record.startDate) : "-"}
                              </TableCell>
                              <TableCell className="py-4 px-6 text-slate-600">
                                {record.nextRenewal ? formatDate(record.nextRenewal) : "-"}
                              </TableCell>
                              <TableCell className="py-4 px-6 text-slate-700">
                                {record.amount !== undefined ? `$${record.amount}` : "-"}
                              </TableCell>
                              <TableCell className="py-4 px-6">
                                <Badge className={getStatusColor(record.status || '')}>
                                  {record.status || "-"}
                                </Badge>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
