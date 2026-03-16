import React, { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Bell, DollarSign, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import TrendsChart from "@/components/charts/trends-chart";
import CategoryChart from "@/components/charts/category-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/context/UserContext";
import type { DashboardMetrics, SpendingTrend, CategoryBreakdown, Subscription } from "@shared/types";

// Error boundary wrapper
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error] = useState<Error | null>(null);
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
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const [activeSubscriptionsModalOpen, setActiveSubscriptionsModalOpen] = useState(false);
  const [upcomingRenewalsModalOpen, setUpcomingRenewalsModalOpen] = useState(false);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState("6months");

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Get user's first name
  const getFirstName = () => {
    if (!user?.fullName) return user?.email?.split('@')[0] || "User";
    return user.fullName.split(' ')[0];
  };
  
  // Use dashboard metrics query for auth check and data
  const { isLoading: metricsLoading, error: metricsError } = useQuery<DashboardMetrics>({
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

  // Category badge sizing: use the longest category label (clamped) so all category badges are the same width.
  const modalCategoryBadgeWidthCh = useMemo(() => {
    const list = Array.isArray(subscriptions) ? subscriptions : [];
    let maxLen = 0;
    for (const sub of list) {
      const val = String((sub as any)?.category ?? "").trim();
      if (val.length > maxLen) maxLen = val.length;
    }
    return Math.min(Math.max(maxLen, 6), 28);
  }, [subscriptions]);

  const trendsStats = useMemo(() => {
    const points = Array.isArray(trends) ? trends : [];
    if (points.length === 0) {
      return {
        percentChange: null as number | null,
        avgMonthly: 0,
        peakMonth: 0,
        ytdTotal: 0,
      };
    }

    const amounts = points.map((p) => Number(p.amount) || 0);
    const avgMonthly = amounts.reduce((a, b) => a + b, 0) / Math.max(amounts.length, 1);
    const peakMonth = Math.max(...amounts);

    const currentYear = new Date().getFullYear();
    const ytdTotal = points
      .filter((p) => String(p.month).startsWith(String(currentYear)))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    let percentChange: number | null = null;
    if (points.length >= 2) {
      const last = Number(points[points.length - 1]?.amount) || 0;
      const prev = Number(points[points.length - 2]?.amount) || 0;
      if (prev !== 0) percentChange = ((last - prev) / prev) * 100;
    }

    return { percentChange, avgMonthly, peakMonth, ytdTotal };
  }, [trends]);

  const formatCompactMoney = (value: number) => {
    const n = Number(value) || 0;
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(n);
    // Match screenshot style ($401k instead of $401K)
    return formatted.replace(/K/g, "k");
  };

  const renderCategoryBadge = (categoryInput: unknown) => {
    const raw = String(categoryInput ?? "").trim();
    if (!raw) {
      return <span className="text-gray-400 text-xs">-</span>;
    }

    const normalized = raw.toLowerCase();

    const categoryClassMap: Record<string, string> = {
      "productivity & collaboration": "bg-blue-100 text-blue-800 border-blue-300",
      "accounting & finance": "bg-emerald-100 text-emerald-800 border-emerald-300",
      "crm & sales": "bg-indigo-100 text-indigo-800 border-indigo-300",
      "development & hosting": "bg-purple-100 text-purple-800 border-purple-300",
      "design & creative tools": "bg-orange-100 text-orange-800 border-orange-300",
      "marketing & seo": "bg-amber-100 text-amber-800 border-amber-300",
      "communication tools": "bg-sky-100 text-sky-800 border-sky-300",
      "security & compliance": "bg-rose-100 text-rose-800 border-rose-300",
      "hr & admin": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
      "subscription infrastructure": "bg-cyan-100 text-cyan-800 border-cyan-300",
      "office infrastructure": "bg-teal-100 text-teal-800 border-teal-300",
      "games": "bg-violet-100 text-violet-800 border-violet-300",
    };

    const fallbackPalette: string[] = [
      "bg-blue-100 text-blue-800 border-blue-300",
      "bg-emerald-100 text-emerald-800 border-emerald-300",
      "bg-indigo-100 text-indigo-800 border-indigo-300",
      "bg-purple-100 text-purple-800 border-purple-300",
      "bg-orange-100 text-orange-800 border-orange-300",
      "bg-amber-100 text-amber-800 border-amber-300",
      "bg-sky-100 text-sky-800 border-sky-300",
      "bg-rose-100 text-rose-800 border-rose-300",
      "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
      "bg-cyan-100 text-cyan-800 border-cyan-300",
      "bg-teal-100 text-teal-800 border-teal-300",
      "bg-violet-100 text-violet-800 border-violet-300",
      "bg-slate-100 text-slate-800 border-slate-300",
      "bg-pink-100 text-pink-800 border-pink-300",
    ];

    const hashString = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
      }
      return hash;
    };

    const badgeClass =
      categoryClassMap[normalized] ?? fallbackPalette[Math.abs(hashString(normalized)) % fallbackPalette.length];

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none border max-w-full ${badgeClass}`}
        style={{ width: `${modalCategoryBadgeWidthCh}ch`, maxWidth: "100%" }}
        title={raw}
      >
        <span className="truncate w-full whitespace-nowrap">{raw}</span>
      </span>
    );
  };
  
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

  const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();

  // Never include Draft subscriptions in dashboard calculations
  const subscriptionsExcludingDraft = Array.isArray(subscriptions)
    ? subscriptions.filter((sub) => norm((sub as any)?.status) !== "draft")
    : [];

  // Filter active subscriptions (robust to case)
  const activeSubscriptions = subscriptionsExcludingDraft.filter((sub) => norm((sub as any)?.status) === "active");
  
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
    if (categoryFilter !== "all" && norm(sub.category) !== norm(categoryFilter)) {
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
      const cycle = norm(sub.billingCycle);
      switch(cycle) {
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
      const cycle = norm(sub.billingCycle);
      switch(cycle) {
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

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div
          className="max-w-[1400px] mx-auto px-8 py-8"
          style={{ zoom: 0.88 }}
        >
          {/* Modern Header with Greeting and Buttons */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {getGreeting()}, {getFirstName()}!
              </h1>
            </div>
            
            {/* Action Buttons on Right */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className={`${location.pathname === '/dashboard' ? 'bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-600 hover:text-white' : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'} px-6 py-2.5 rounded-lg font-medium`}
                onClick={() => navigate('/dashboard')}
              >
                Subscription
              </Button>
              <Button
                variant="outline"
                className={`${location.pathname === '/compliance-dashboard' ? 'bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-600 hover:text-white' : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'} px-6 py-2.5 rounded-lg font-medium`}
                onClick={() => navigate('/compliance-dashboard')}
              >
                Compliance
              </Button>
              <Button
                variant="outline"
                className={`${location.pathname === '/calendar' ? 'bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-600 hover:text-white' : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'} px-6 py-2.5 rounded-lg font-medium`}
                onClick={() => navigate('/calendar')}
              >
                Calendar
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 flex items-center gap-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48 bg-white border-gray-300 px-2">
                <SelectValue placeholder="Last 6 months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">Last 3 months</SelectItem>
                <SelectItem value="6months">Last 6 months</SelectItem>
                <SelectItem value="12months">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48 bg-white border-gray-300 px-2">
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

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Monthly Spend Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border-t-4 border-blue-500">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Monthly Spend</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${filteredMonthlySpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span className="text-green-600 font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                +12%
              </span>
              <span className="text-gray-500 ml-2">from last month</span>
            </div>
          </div>

          {/* Yearly Spend Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border-t-4 border-green-500">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Yearly Spend</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${filteredYearlySpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span className="text-green-600 font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                +8%
              </span>
              <span className="text-gray-500 ml-2">from last year</span>
            </div>
          </div>

          {/* Active Subscriptions Card */}
          <div 
            className="bg-white rounded-xl p-6 shadow-sm border-t-4 border-purple-500 cursor-pointer hover:shadow-md transition-shadow" 
            onClick={() => setActiveSubscriptionsModalOpen(true)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Active Subscriptions</p>
                <p className="text-3xl font-bold text-gray-900">
                  {filteredSubscriptions.length}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <RotateCcw className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span className="text-purple-600 font-medium">Click to view details</span>
            </div>
          </div>

          {/* Upcoming Renewals Card */}
          <div 
            className="bg-white rounded-xl p-6 shadow-sm border-t-4 border-orange-500 cursor-pointer hover:shadow-md transition-shadow" 
            onClick={() => setUpcomingRenewalsModalOpen(true)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Upcoming Renewals</p>
                <p className="text-3xl font-bold text-gray-900">
                  {upcomingRenewals.length}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span className="text-orange-600 font-medium">Next 30 days - Click to view</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Spending Analytics</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Spending Trends */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Spending Trend</h3>
              <span className="text-sm text-gray-500">
                {dateRange === "3months" ? "Last 3 months" : dateRange === "12months" ? "Last 12 months" : "Last 6 months"}
              </span>
            </div>
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

            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-500">Avg Monthly</div>
                <div className="text-base font-semibold text-gray-900">{formatCompactMoney(trendsStats.avgMonthly)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Peak Month</div>
                <div className="text-base font-semibold text-gray-900">{formatCompactMoney(trendsStats.peakMonth)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">YTD Total</div>
                <div className="text-base font-semibold text-gray-900">{formatCompactMoney(trendsStats.ytdTotal)}</div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Category Breakdown</h3>
              </div>
            </div>
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
          <DialogContent className="max-w-6xl w-[95vw] max-h-[85vh] bg-white border-2 border-blue-500 rounded-xl shadow-lg p-0 overflow-hidden">
            <DialogHeader>
              <div className="flex items-center justify-between px-6 pt-6">
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Active Subscriptions ({filteredSubscriptions.length})
                </DialogTitle>
              </div>
            </DialogHeader>
            <div className="px-6 pb-6 pt-4">
              <div className="h-[70vh] overflow-auto overscroll-contain custom-scrollbar rounded-lg border border-gray-200">
                <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="border-b-2 border-gray-300 bg-gray-200">
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[210px]">
                      SERVICE
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[210px]">
                      VENDOR
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide w-[120px]">
                      AMOUNT
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[110px]">
                      BILLING
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[140px]">
                      NEXT RENEWAL
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[240px]">
                      CATEGORY
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => (
                    <TableRow
                      key={subscription.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <TableCell className="px-4 py-3 font-medium text-gray-800 w-[210px] max-w-[210px] overflow-hidden">
                        <div className="truncate whitespace-nowrap" title={subscription.serviceName}>
                          {subscription.serviceName}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-700 w-[210px] max-w-[210px] overflow-hidden">
                        <div className="truncate whitespace-nowrap" title={subscription.vendor}>
                          {subscription.vendor}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right w-[120px]">
                        <span className="text-sm font-semibold text-gray-900">
                          ${parseFloat(String(subscription.amount)).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 w-[110px] capitalize text-gray-700">
                        {subscription.billingCycle}
                      </TableCell>
                      <TableCell className="px-4 py-3 w-[140px] text-gray-700">
                        {new Date(subscription.nextRenewal).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-4 py-3 w-[240px] max-w-[240px] overflow-hidden">
                        {renderCategoryBadge(subscription.category)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upcoming Renewals Modal */}
        <Dialog open={upcomingRenewalsModalOpen} onOpenChange={setUpcomingRenewalsModalOpen}>
          <DialogContent className="max-w-6xl w-[95vw] max-h-[85vh] bg-white border-2 border-blue-500 rounded-xl shadow-lg p-0 overflow-hidden">
            <DialogHeader>
              <div className="flex items-center justify-between px-6 pt-6">
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Upcoming Renewals - Next 30 Days ({upcomingRenewals.length})
                </DialogTitle>
              </div>
            </DialogHeader>
            <div className="px-6 pb-6 pt-4">
              <div className="h-[70vh] overflow-auto overscroll-contain custom-scrollbar rounded-lg border border-gray-200">
                <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="border-b-2 border-gray-300 bg-gray-200">
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[210px]">
                      SERVICE
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[210px]">
                      VENDOR
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide w-[120px]">
                      AMOUNT
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[140px]">
                      RENEWAL DATE
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[90px]">
                      DAYS
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[240px]">
                      CATEGORY
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingRenewals.map((subscription) => {
                    const daysUntil = Math.ceil((new Date(subscription.nextRenewal).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <TableRow
                        key={subscription.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="px-4 py-3 font-medium text-gray-800 w-[210px] max-w-[210px] overflow-hidden">
                          <div className="truncate whitespace-nowrap" title={subscription.serviceName}>
                            {subscription.serviceName}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-gray-700 w-[210px] max-w-[210px] overflow-hidden">
                          <div className="truncate whitespace-nowrap" title={subscription.vendor}>
                            {subscription.vendor}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right w-[120px]">
                          <span className="text-sm font-semibold text-gray-900">
                            ${parseFloat(String(subscription.amount)).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 w-[140px] text-gray-700">
                          {new Date(subscription.nextRenewal).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="px-4 py-3 w-[90px]">
                          <Badge
                            className="rounded-full"
                            variant={daysUntil <= 7 ? "destructive" : daysUntil <= 14 ? "default" : "secondary"}
                          >
                            {daysUntil}d
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 w-[240px] max-w-[240px] overflow-hidden">
                          {renderCategoryBadge(subscription.category)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </ErrorBoundary>
  );

}
