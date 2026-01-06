import React, { useState } from "react";
import { apiFetch } from "../lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, TrendingUp, RefreshCw, Bell, Plus, Edit, BellRing, Users, Clock, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TrendsChart from "@/components/charts/trends-chart";
import CategoryChart from "@/components/charts/category-chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardMetrics, SpendingTrend, CategoryBreakdown, RecentActivity, Subscription } from "@shared/types";

// Error boundary wrapper
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  return error ? (
    <div style={{ color: 'red', padding: 32 }}>
      <h2>Dashboard Error</h2>
      <pre>{error.message}</pre>
    </div>
  ) : (
    <React.Fragment>{children}</React.Fragment>
  );
}

export default function Dashboard() {
  const location = window.location.pathname;
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeSubscriptionsModalOpen, setActiveSubscriptionsModalOpen] = useState(false);
  const [upcomingRenewalsModalOpen, setUpcomingRenewalsModalOpen] = useState(false);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState("6months");
  
  // Use dashboard metrics query for auth check and data
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery<DashboardMetrics>({
    queryKey: ["/api/analytics/dashboard"],
    queryFn: async () => {
      const res = await apiFetch("/api/analytics/dashboard");
      if (res.status === 401) throw new Error("Unauthorized");
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: trends, isLoading: trendsLoading } = useQuery<SpendingTrend[]>({
    queryKey: ["/api/analytics/trends"],
    queryFn: async () => {
      const res = await apiFetch("/api/analytics/trends");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: categories, isLoading: categoriesLoading } = useQuery<CategoryBreakdown[]>({
    queryKey: ["/api/analytics/categories"],
    queryFn: async () => {
      const res = await apiFetch("/api/analytics/categories");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    queryFn: async () => {
      const res = await apiFetch("/api/subscriptions");
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  // Get unique categories from actual subscriptions (like subscriptions page does)
  const uniqueCategories = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => sub.category) : [])).filter(Boolean);
  
  // Activity query removed as it's not currently used in the dashboard

  // ...existing code...
  if (metricsError && metricsError.message === "Unauthorized") {
    navigate("/login");
    return null;
  }
  // Show skeletons while loading any data
  if (metricsLoading || trendsLoading || categoriesLoading || subscriptionsLoading) {
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

  // Filter active subscriptions
  const activeSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter(sub => sub.status === "Active") : [];
  
  // Apply filters to subscriptions
  const getDateRangeMonths = () => {
    switch(dateRange) {
      case "3months": return 3;
      case "6months": return 6;
      case "12months": return 12;
      default: return 6;
    }
  };

  const filteredSubscriptions = activeSubscriptions.filter(sub => {
    // Category filter
    if (categoryFilter !== "all" && sub.category !== categoryFilter) {
      return false;
    }
    
    // Date range filter - check if subscription has renewed or will renew in the selected date range
    const months = getDateRangeMonths();
    const rangeStartDate = new Date();
    rangeStartDate.setMonth(rangeStartDate.getMonth() - months);
    
    const nextRenewal = new Date(sub.nextRenewal);
    const subscriptionStartDate = new Date(sub.startDate);
    
    // Include subscription if it renewed or will renew within the date range
    return nextRenewal >= rangeStartDate || subscriptionStartDate >= rangeStartDate;
  });

  // Calculate filtered metrics
  const calculateMonthlySpend = () => {
    return filteredSubscriptions.reduce((total, sub) => {
      const amount = parseFloat(String(sub.amount)) || 0;
      switch(sub.billingCycle) {
        case "monthly": return total + amount;
        case "yearly": return total + (amount / 12);
        case "quarterly": return total + (amount / 3);
        default: return total;
      }
    }, 0);
  };

  const calculateYearlySpend = () => {
    return filteredSubscriptions.reduce((total, sub) => {
      const amount = parseFloat(String(sub.amount)) || 0;
      switch(sub.billingCycle) {
        case "monthly": return total + (amount * 12);
        case "yearly": return total + amount;
        case "quarterly": return total + (amount * 4);
        default: return total;
      }
    }, 0);
  };

  const filteredMonthlySpend = calculateMonthlySpend();
  const filteredYearlySpend = calculateYearlySpend();
  
  // Filter upcoming renewals (next 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRenewals = filteredSubscriptions.filter(sub => {
    const renewalDate = new Date(sub.nextRenewal);
    // Reset time portions to compare only dates
    renewalDate.setHours(0, 0, 0, 0);
    const nowDate = new Date(now);
    nowDate.setHours(0, 0, 0, 0);
    const thirtyDaysDate = new Date(thirtyDaysFromNow);
    thirtyDaysDate.setHours(23, 59, 59, 999);
    return renewalDate <= thirtyDaysDate && renewalDate >= nowDate;
  });

  if (metricsLoading) {
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

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="w-4 h-4" />;
    return <TrendingUp className="w-4 h-4 rotate-180" />;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return "text-red-600";
    if (growth < 0) return "text-green-600";
    return "text-gray-600";
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white">
        <div className="max-w-[1400px] mx-auto px-6 py-8">          
          {/* Modern Professional Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Dashboard</h1>
                  <p className="text-gray-600 text-sm">Overview of your subscription spending and analytics</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  className={location === '/dashboard' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-blue-600 border-blue-600'}
                  variant="outline"
                  onClick={() => handleTabClick('subscription')}
                >
                  Subscription
                </Button>
                <Button
                  className={location === '/compliance-dashboard' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-blue-600 border-blue-600'}
                  variant="outline"
                  onClick={() => handleTabClick('compliance')}
                >
                  Compliance
                </Button>
              </div>
            </div>
          </div>

        {/* Date Filter */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex space-x-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Last 6 months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">Last 3 months</SelectItem>
                <SelectItem value="6months">Last 6 months</SelectItem>
                <SelectItem value="12months">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-100">Monthly Spend</p>
                <p className="text-2xl font-bold text-white mt-1">
                  ${filteredMonthlySpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
                <p className={`text-sm mt-1 flex items-center text-blue-200`}>
                  {getGrowthIcon(-12)} 12% from last month
                </p>
              </div>
              <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-100">Yearly Spend</p>
                <p className="text-2xl font-bold text-white mt-1">
                  ${filteredYearlySpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
                <p className={`text-sm mt-1 flex items-center text-green-200`}>
                  {getGrowthIcon(8)} 8% from last year
                </p>
              </div>
              <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div 
            className={`cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-4 shadow-sm ${activeSubscriptionsModalOpen ? 'ring-2 ring-purple-300' : ''}`} 
            onClick={() => setActiveSubscriptionsModalOpen(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-100">Active Subscriptions</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {filteredSubscriptions.length}
                </p>
                <p className="text-sm text-purple-200 mt-1 flex items-center">
                  <Users className="w-4 h-4 mr-1" /> Click to view details
                </p>
              </div>
              <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div 
            className={`cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 shadow-sm ${upcomingRenewalsModalOpen ? 'ring-2 ring-orange-300' : ''}`} 
            onClick={() => setUpcomingRenewalsModalOpen(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-100">Upcoming Renewals</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {upcomingRenewals.length}
                </p>
                <p className="text-sm text-orange-200 mt-1 flex items-center">
                  <Clock className="w-4 h-4 mr-1" /> Next 30 days - Click to view
                </p>
              </div>
              <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Bell className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending Trends</h3>
            <div>
              {trendsLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : trends ? (
                <TrendsChart data={trends} />
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  No trend data available
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
            <div>
              {categoriesLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : categories ? (
                <CategoryChart data={categories} />
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  No category data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Subscriptions Modal */}
        <Dialog open={activeSubscriptionsModalOpen} onOpenChange={setActiveSubscriptionsModalOpen}>
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white border-2 border-blue-500 rounded-xl shadow-lg">
            <DialogHeader>
              <DialogTitle>Active Subscriptions ({filteredSubscriptions.length})</DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Billing Cycle</TableHead>
                    <TableHead>Next Renewal</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Reminder Policy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium">{subscription.serviceName}</TableCell>
                      <TableCell>{subscription.vendor}</TableCell>
                      <TableCell>${parseFloat(String(subscription.amount)).toFixed(2)}</TableCell>
                      <TableCell className="capitalize">{subscription.billingCycle}</TableCell>
                      <TableCell>{new Date(subscription.nextRenewal).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscription.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {subscription.reminderPolicy} ({subscription.reminderDays}d)
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upcoming Renewals Modal */}
        <Dialog open={upcomingRenewalsModalOpen} onOpenChange={setUpcomingRenewalsModalOpen}>
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white border-2 border-blue-500 rounded-xl shadow-lg">
            <DialogHeader>
              <DialogTitle>Upcoming Renewals - Next 30 Days ({upcomingRenewals.length})</DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Renewal Date</TableHead>
                    <TableHead>Days Until</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Reminder Policy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingRenewals.map((subscription) => {
                    const daysUntil = Math.ceil((new Date(subscription.nextRenewal).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <TableRow key={subscription.id}>
                        <TableCell className="font-medium">{subscription.serviceName}</TableCell>
                        <TableCell>{subscription.vendor}</TableCell>
                        <TableCell>${parseFloat(String(subscription.amount)).toFixed(2)}</TableCell>
                        <TableCell>{new Date(subscription.nextRenewal).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={daysUntil <= 7 ? "destructive" : daysUntil <= 14 ? "default" : "secondary"}>
                            {daysUntil} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{subscription.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {subscription.reminderPolicy} ({subscription.reminderDays}d)
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </ErrorBoundary>
  );

}
