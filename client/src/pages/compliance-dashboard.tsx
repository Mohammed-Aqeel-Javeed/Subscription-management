import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Calendar } from "lucide-react";
import ComplianceTrendsChart from "@/components/charts/compliance-trends-chart";
import ComplianceCategoryChart from "@/components/charts/compliance-category-chart";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

// Error boundary wrapper
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  // No error boundary needed, just render children
  return <React.Fragment>{children}</React.Fragment>;
}

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const [activeIssuesModalOpen, setActiveIssuesModalOpen] = useState(false);
  const [upcomingDeadlinesModalOpen, setUpcomingDeadlinesModalOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Fetch all compliance filings (live data)
  const { data: complianceList, isLoading: complianceLoading } = useQuery({
    queryKey: ["/api/compliance/list"],
    queryFn: async () => {
      const res = await fetch("/api/compliance/list", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch compliance data");
      return res.json();
    },
  refetchInterval: false, // Disable auto-refresh
  });

  // Compute metrics, issues, deadlines from complianceList
  const now = useMemo(() => new Date(), []);
  
  // Compute trends data (submissions per month for last 6 months)
  const trendsData = useMemo(() => {
    if (!complianceList) return [];
    const months: { [key: string]: { submitted: number; total: number } } = {};
    const nowDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      months[key] = { submitted: 0, total: 0 };
    }
    complianceList.forEach((c: any) => {
      if (!c.createdAt) return;
      const created = new Date(c.createdAt);
      const key = `${created.getFullYear()}-${(created.getMonth() + 1).toString().padStart(2, "0")}`;
      if (months[key]) {
        months[key].total++;
        if (c.status === "Submitted") months[key].submitted++;
      }
    });
    return Object.entries(months).map(([date, v]) => ({ date, ...v }));
  }, [complianceList]);

  // Compute category breakdown (issues by category)
  const categoryData = useMemo(() => {
    if (!complianceList) return [];
    const map: { [cat: string]: number } = {};
    complianceList.forEach((c: any) => {
      if (!c.category) return;
      if (!map[c.category]) map[c.category] = 0;
      if (["Pending", "Overdue"].includes(c.status)) map[c.category]++;
    });
    return Object.entries(map).map(([category, count]) => ({ category, count }));
  }, [complianceList]);

  const metrics = useMemo(() => {
    if (!complianceList) return {};
    const total = complianceList.length;
    const completed = complianceList.filter((c: any) => c.status === "Submitted").length;
    const complianceScore = total ? Math.round((completed / total) * 100) : 100;
    const requiredActions = complianceList.filter((c: any) => ["Pending", "Overdue"].includes(c.status)).length;
    const activeIssues = complianceList.filter((c: any) => c.status === "Overdue").length;
    const upcomingDeadlines = complianceList.filter((c: any) => {
      if (!c.submissionDeadline || c.status === "Submitted") return false;
      const deadline = new Date(c.submissionDeadline);
      return deadline >= now && deadline <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }).length;
    return { complianceScore, requiredActions, activeIssues, upcomingDeadlines };
  }, [complianceList, now]);

  const activeIssues = useMemo(() => {
    if (!complianceList) return [];
    return complianceList.filter((c: any) => c.status === "Overdue");
  }, [complianceList]);

  const upcomingDeadlines = useMemo(() => {
    if (!complianceList) return [];
    return complianceList.filter((c: any) => {
      if (!c.submissionDeadline || c.status === "Submitted") return false;
      const deadline = new Date(c.submissionDeadline);
      return deadline >= now && deadline <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    });
  }, [complianceList, now]);

  // Helper to get cookie by name
  function getCookie(name: string) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  }

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const token = getCookie("token");
      if (token) {
        setAuthChecked(true);
      } else {
        navigate("/login");
      }
    }
  }, [navigate]);

  if (!authChecked) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>Checking authentication...</h2>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
    navigate("/login");
  };

  // Tab navigation handler
  const handleTabClick = (tab: 'subscription' | 'compliance') => {
    if (tab === 'subscription') {
      navigate('/dashboard');
    } else {
      navigate('/compliance-dashboard');
    }
  };

  if (complianceLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            style={{ 
              padding: '8px 16px', 
              background: '#f44336', 
              color: '#fff', 
              border: 0, 
              borderRadius: 4, 
              fontWeight: 600 
            }}
          >
            Logout
          </motion.button>
        </div>
        
        {/* Top tab buttons */}
        <div className="flex gap-4 mb-8">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant={window.location.pathname === '/dashboard' ? 'default' : 'outline'}
              onClick={() => handleTabClick('subscription')}
              className="transition-all duration-300"
            >
              Subscription
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant={window.location.pathname === '/compliance-dashboard' ? 'default' : 'outline'}
              onClick={() => handleTabClick('compliance')}
              className="transition-all duration-300"
            >
              Compliance
            </Button>
          </motion.div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h2>
          <p className="text-gray-600 mt-2">Overview of your compliance status and analytics</p>
        </motion.div>
        
        {/* Date Filter */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6 flex justify-between items-center"
        >
          <div className="flex space-x-4">
            <Select defaultValue="30days">
              <SelectTrigger className="w-48 transition-all duration-300 hover:border-blue-400 focus:border-blue-500">
                <SelectValue placeholder="Last 30 days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-48 transition-all duration-300 hover:border-blue-400 focus:border-blue-500">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="privacy">Privacy</SelectItem>
                <SelectItem value="regulatory">Regulatory</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>
        
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            whileHover={{ y: -5 }}
          >
            <Card className="h-full transition-all duration-300 hover:shadow-lg border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {metrics?.complianceScore != null ? `${metrics.complianceScore}%` : '0%'}
                    </p>
                    <p className="text-sm mt-1 flex items-center text-green-600">
                      <TrendingUp className="w-4 h-4 mr-1" /> 5% from last period
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            whileHover={{ y: -5 }}
          >
            <Card className="h-full transition-all duration-300 hover:shadow-lg border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Required Actions</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {metrics?.requiredActions || 0}
                    </p>
                    <p className="text-sm mt-1 flex items-center text-orange-600">
                      <Clock className="w-4 h-4 mr-1" /> Need attention
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            whileHover={{ y: -5 }}
            className="md:col-span-2 lg:col-span-2"
          >
            <Card className="h-full transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4 h-full">
                  <motion.div 
                    className="flex-1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      variant="outline" 
                      className="w-full h-full flex flex-col items-center justify-center p-6 transition-all duration-300 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50"
                      onClick={() => navigate("/calendar-monthly")}
                    >
                      <Calendar className="h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-lg font-medium">Monthly Calendar</span>
                    </Button>
                  </motion.div>
                  
                  <motion.div 
                    className="flex-1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      variant="outline" 
                      className="w-full h-full flex flex-col items-center justify-center p-6 transition-all duration-300 border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50"
                      onClick={() => navigate("/calendar-yearly")}
                    >
                      <Calendar className="h-8 w-8 text-purple-500 mb-2" />
                      <span className="text-lg font-medium">Yearly Calendar</span>
                    </Button>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            whileHover={{ y: -5 }}
          >
            <Card className="h-full transition-all duration-300 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                  Compliance Trends
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ComplianceTrendsChart data={trendsData} />
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            whileHover={{ y: -5 }}
          >
            <Card className="h-full transition-all duration-300 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                  Issue Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ComplianceCategoryChart data={categoryData} />
              </CardContent>
            </Card>
          </motion.div>
        </div>
        
        {/* Active Issues Modal */}
        <Dialog open={activeIssuesModalOpen} onOpenChange={setActiveIssuesModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto backdrop-blur-sm bg-white/95">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-red-500" />
                Active Compliance Issues ({activeIssues?.length || 0})
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeIssues?.map((issue: any) => {
                    const dueDate = issue.submissionDeadline ? new Date(issue.submissionDeadline) : null;
                    return (
                      <TableRow key={issue._id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">{issue.filingName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{issue.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              dueDate && (dueDate.getTime() - now.getTime())/(1000*60*60*24) <= 7 ? 'destructive' :
                              dueDate && (dueDate.getTime() - now.getTime())/(1000*60*60*24) <= 14 ? 'default' :
                              'secondary'
                            }
                          >
                            {dueDate && (dueDate.getTime() - now.getTime())/(1000*60*60*24) <= 7 ? 'High' :
                            dueDate && (dueDate.getTime() - now.getTime())/(1000*60*60*24) <= 14 ? 'Medium' :
                            'Low'}
                          </Badge>
                        </TableCell>
                        <TableCell>{issue.status}</TableCell>
                        <TableCell>{dueDate ? dueDate.toLocaleDateString() : ''}</TableCell>
                        <TableCell>{issue.assignedTo || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Upcoming Deadlines Modal */}
        <Dialog open={upcomingDeadlinesModalOpen} onOpenChange={setUpcomingDeadlinesModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto backdrop-blur-sm bg-white/95">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5 text-orange-500" />
                Upcoming Deadlines - Next 30 Days
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Until Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingDeadlines?.map((deadline: any) => {
                    const dueDate = deadline.submissionDeadline ? new Date(deadline.submissionDeadline) : null;
                    const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : '';
                    return (
                      <TableRow key={deadline._id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">{deadline.filingName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{deadline.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              daysUntil !== '' && daysUntil <= 7 ? 'destructive' :
                              daysUntil !== '' && daysUntil <= 14 ? 'default' :
                              'secondary'
                            }
                          >
                            {daysUntil !== '' && daysUntil <= 7 ? 'High' :
                            daysUntil !== '' && daysUntil <= 14 ? 'Medium' :
                            'Low'}
                          </Badge>
                        </TableCell>
                        <TableCell>{dueDate ? dueDate.toLocaleDateString() : ''}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              daysUntil !== '' && daysUntil <= 7 ? 'destructive' :
                              daysUntil !== '' && daysUntil <= 14 ? 'default' :
                              'secondary'
                            }
                          >
                            {daysUntil !== '' ? daysUntil + ' days' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>{deadline.status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}