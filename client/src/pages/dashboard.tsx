import React, { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Bell, RotateCcw, Calendar, X } from "lucide-react";
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
  const queryClient = useQueryClient();
  const isGlobalAdminNoTenant = user?.role === "global_admin" && !user?.tenantId;
  const [tenantSwitchNonce, setTenantSwitchNonce] = useState(0);
  const [activeSubscriptionsModalOpen, setActiveSubscriptionsModalOpen] = useState(false);
  const [upcomingRenewalsModalOpen, setUpcomingRenewalsModalOpen] = useState(false);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState("6months");

  const dateRangeMonths = useMemo(() => {
    switch (dateRange) {
      case "3months":
        return 3;
      case "6months":
        return 6;
      case "12months":
        return 12;
      default:
        return 6;
    }
  }, [dateRange]);

  const analyticsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("months", String(dateRangeMonths));
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    return params.toString();
  }, [dateRangeMonths, categoryFilter]);

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

  // Ensure the dashboard always refreshes correctly when switching companies.
  // We can't rely only on tenantId from context because some switch flows reload/clear caches.
  const tenantKey = String(user?.tenantId ?? 'unknown');
  const dashboardScopeKey = `${tenantKey}:${tenantSwitchNonce}`;

  React.useEffect(() => {
    const onAccountChanged = () => {
      setTenantSwitchNonce((n) => n + 1);

      // Close modals and reset filters so UI isn't stuck.
      setActiveSubscriptionsModalOpen(false);
      setUpcomingRenewalsModalOpen(false);
      setCategoryFilter('all');
      setDateRange('6months');

      // Best-effort: ensure fresh data fetch even if keys don't change elsewhere.
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/me'], exact: false });
    };

    window.addEventListener('account-changed', onAccountChanged);
    return () => window.removeEventListener('account-changed', onAccountChanged);
  }, [queryClient]);
  
  // Use dashboard metrics query for auth check and data
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery<DashboardMetrics>({
    queryKey: ["/api/analytics/dashboard", dashboardScopeKey],
    enabled: !isGlobalAdminNoTenant,
    queryFn: async () => {
      const res = await apiFetch("/api/analytics/dashboard");
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) {
        const text = (await res.text().catch(() => '')) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
  });

  const isUnauthorized = metricsError instanceof Error && metricsError.message === "Unauthorized";

  React.useEffect(() => {
    if (isUnauthorized && !isGlobalAdminNoTenant) {
      navigate("/login");
    }
  }, [isUnauthorized, isGlobalAdminNoTenant, navigate, location.pathname]);
  const { data: trends, isLoading: trendsLoading } = useQuery<SpendingTrend[]>({
    queryKey: ["/api/analytics/trends", dashboardScopeKey, dateRangeMonths, categoryFilter],
    enabled: !isGlobalAdminNoTenant,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await apiFetch(`/api/analytics/trends?${analyticsQueryString}`);
      if (!res.ok) {
        const text = (await res.text().catch(() => '')) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: categories, isLoading: categoriesLoading } = useQuery<CategoryBreakdown[]>({
    queryKey: ["/api/analytics/categories", dashboardScopeKey, dateRangeMonths, categoryFilter],
    enabled: !isGlobalAdminNoTenant,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await apiFetch(`/api/analytics/categories?${analyticsQueryString}`);
      if (!res.ok) {
        const text = (await res.text().catch(() => '')) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions", dashboardScopeKey],
    enabled: !isGlobalAdminNoTenant,
    queryFn: async () => {
      const res = await apiFetch("/api/subscriptions");
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) {
        const text = (await res.text().catch(() => '')) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000,
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
  if (isUnauthorized) {
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

  // Only show a full-page skeleton during the initial load of core data.
  // Trends/categories refetch on filter changes should not blank the whole dashboard.
  const isInitialCoreLoading = (metricsLoading && !metrics) || (subscriptionsLoading && !subscriptions);

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
    
    const parseDateSafe = (raw: unknown): Date | null => {
      if (!raw) return null;
      const d = raw instanceof Date ? raw : new Date(String(raw));
      return Number.isFinite(d.getTime()) ? d : null;
    };

    const nextRenewal = parseDateSafe((sub as any)?.nextRenewal);
    const subscriptionStartDate = parseDateSafe((sub as any)?.startDate);

    // If dates are missing/invalid, don't exclude the record.
    if (!nextRenewal && !subscriptionStartDate) return true;

    // Include subscription if it renewed or will renew within the date range
    return (nextRenewal ? nextRenewal >= rangeStartDate : false)
      || (subscriptionStartDate ? subscriptionStartDate >= rangeStartDate : false);
  });

  // Calculate filtered metrics
  const calculateMonthlySpend = () => {
    return filteredSubscriptions.reduce((total, sub) => {
      const amount = parseFloat(String((sub as any)?.lcyAmount ?? sub.amount)) || 0;
      const cycle = norm(sub.billingCycle);
      switch(cycle) {
        case "monthly": return total + amount;
        case "yearly": return total + (amount / 12);
        case "quarterly": return total + (amount / 3);
        case "weekly": return total + (amount * 4);
        default: return total;
      }
    }, 0);
  };

  const calculateYearlySpend = () => {
    return filteredSubscriptions.reduce((total, sub) => {
      const amount = parseFloat(String((sub as any)?.lcyAmount ?? sub.amount)) || 0;
      const cycle = norm(sub.billingCycle);
      switch(cycle) {
        case "monthly": return total + (amount * 12);
        case "yearly": return total + amount;
        case "quarterly": return total + (amount * 4);
        case "weekly": return total + (amount * 52);
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
    if (!Number.isFinite(renewalDate.getTime())) return false;
    // Reset time portions to compare only dates
    renewalDate.setHours(0, 0, 0, 0);
    const nowDate = new Date(now);
    nowDate.setHours(0, 0, 0, 0);
    const thirtyDaysDate = new Date(thirtyDaysFromNow);
    thirtyDaysDate.setHours(23, 59, 59, 999);
    return renewalDate <= thirtyDaysDate && renewalDate >= nowDate;
  });

  const hasSubscriptionsData = Array.isArray(subscriptions);
  const cardMonthlySpend = hasSubscriptionsData ? filteredMonthlySpend : (Number(metrics?.monthlySpend) || 0);
  const cardYearlySpend = hasSubscriptionsData ? filteredYearlySpend : (Number(metrics?.yearlySpend) || 0);
  const cardActiveSubscriptions = hasSubscriptionsData ? filteredSubscriptions.length : (Number(metrics?.activeSubscriptions) || 0);
  const cardUpcomingRenewals = hasSubscriptionsData ? upcomingRenewals.length : (Number(metrics?.upcomingRenewals) || 0);

  if (isGlobalAdminNoTenant) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-indigo-200/60 bg-white/70 p-6 text-indigo-900">
          <div className="text-lg font-semibold">Platform admin dashboard</div>
          <div className="text-sm text-indigo-700/80 mt-1">Company data is hidden for global admin accounts.</div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            {/* Greeting Card */}
            <div
              className="mb-6 relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between rounded-2xl px-4 sm:px-8 py-6 shadow-sm border border-purple-200 overflow-hidden backdrop-blur-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(245, 243, 255, 0.95) 0%, rgba(237, 233, 254, 0.95) 40%, rgba(232, 224, 255, 0.95) 70%, rgba(240, 236, 255, 0.95) 100%)",
              }}
            >
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <svg className="absolute -right-12 -top-12 w-72 h-72 opacity-[0.18]" viewBox="0 0 200 200" fill="none">
                  <circle cx="100" cy="100" r="100" fill="#a78bfa" />
                </svg>
                <svg className="absolute right-16 -bottom-20 w-56 h-56 opacity-[0.12]" viewBox="0 0 200 200" fill="none">
                  <circle cx="100" cy="100" r="100" fill="#8b5cf6" />
                </svg>
                <svg className="absolute right-1/3 -top-10 w-36 h-36 opacity-[0.08]" viewBox="0 0 200 200" fill="none">
                  <circle cx="100" cy="100" r="100" fill="#7c3aed" />
                </svg>
                <svg className="absolute left-1/4 bottom-0 w-28 h-28 opacity-[0.06]" viewBox="0 0 200 200" fill="none">
                  <circle cx="100" cy="100" r="100" fill="#c4b5fd" />
                </svg>
              </div>

              <div className="relative z-10">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {getGreeting()}, {getFirstName()}!
                </h1>
              </div>

              <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 relative z-10 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className={`${location.pathname === "/dashboard"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 hover:text-white"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} w-full sm:w-36 px-6 py-2.5 rounded-lg font-medium`}
                  onClick={() => navigate("/dashboard")}
                >
                  Subscription
                </Button>
                <Button
                  variant="outline"
                  className={`${location.pathname === "/compliance-dashboard"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 hover:text-white"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} w-full sm:w-36 px-6 py-2.5 rounded-lg font-medium`}
                  onClick={() => navigate("/compliance-dashboard")}
                >
                  Compliance
                </Button>
                <Button
                  variant="outline"
                  className={`${location.pathname === "/renewal-dashboard"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 hover:text-white"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} w-full sm:w-36 px-6 py-2.5 rounded-lg font-medium`}
                  onClick={() => navigate("/renewal-dashboard")}
                >
                  Renewal
                </Button>
                <Button
                  variant="outline"
                  className={`${location.pathname === "/calendar"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 hover:text-white"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} w-full sm:w-36 px-6 py-2.5 rounded-lg font-medium`}
                  onClick={() => navigate("/calendar")}
                >
                  Calendar
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full sm:w-44 bg-white border-gray-300 rounded-lg text-sm shadow-sm">
                  <SelectValue placeholder="Last 6 months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">Last 3 months</SelectItem>
                  <SelectItem value="6months">Last 6 months</SelectItem>
                  <SelectItem value="12months">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-44 bg-white border-gray-300 rounded-lg text-sm shadow-sm">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isInitialCoreLoading ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <Skeleton className="h-80 w-full" />
                  <Skeleton className="h-80 w-full" />
                </div>
              </div>
            ) : (
              <>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {/* Monthly Spend Card */}
              <div className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-blue-500 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Monthly Spend</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${cardMonthlySpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
              </div>
                  <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-blue-500" />
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
              <div className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-green-500 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Yearly Spend</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${cardYearlySpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
              </div>
                  <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-green-500" />
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
                className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-purple-500 cursor-pointer hover:shadow-md transition-shadow" 
                onClick={() => setActiveSubscriptionsModalOpen(true)}
              >
                <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Active Subscriptions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cardActiveSubscriptions}
                </p>
              </div>
                  <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <RotateCcw className="h-5 w-5 text-purple-500" />
                  </div>
                </div>
                <div className="text-sm text-gray-400">Click to view details</div>
              </div>

              {/* Upcoming Renewals Card */}
              <div 
                className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-orange-500 cursor-pointer hover:shadow-md transition-shadow" 
                onClick={() => setUpcomingRenewalsModalOpen(true)}
              >
                <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Upcoming Renewals</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cardUpcomingRenewals}
                </p>
              </div>
                  <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bell className="h-5 w-5 text-orange-500" />
                  </div>
                </div>
                <div className="text-sm text-gray-400">Next 30 days · Click to view</div>
              </div>
            </div>

        {/* Charts Section */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Spending Analytics</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Spending Trends */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div>
              {trendsLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : Array.isArray(trends) && trends.length > 0 ? (
                <TrendsChart data={trends} />
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  No trend data for selected filters
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
              ) : Array.isArray(categories) && categories.length > 0 ? (
                <CategoryChart data={categories} />
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  No category data for selected filters
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
                <button
                  type="button"
                  onClick={() => setActiveSubscriptionsModalOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </DialogHeader>
            <div className="px-6 pb-6 pt-4">
              <div className="h-[70vh] overflow-auto overscroll-contain custom-scrollbar rounded-lg border border-gray-200">
                <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="border-b-2 border-purple-300 bg-purple-100">
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[210px]">
                      SERVICE
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[210px]">
                      VENDOR
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-3 text-right text-xs font-bold text-slate-900 uppercase tracking-wide w-[120px]">
                      AMOUNT(Lcy)
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[110px]">
                      BILLING
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[140px]">
                      NEXT RENEWAL
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[240px]">
                      CATEGORY
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => (
                    <TableRow
                      key={subscription.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
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
                          {(() => {
                            const raw = (subscription as any)?.lcyAmount ?? subscription.amount;
                            const n = Number.parseFloat(String(raw));
                            return Number.isFinite(n) ? n.toFixed(2) : '—';
                          })()}
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
                <button
                  type="button"
                  onClick={() => setUpcomingRenewalsModalOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </DialogHeader>
            <div className="px-6 pb-6 pt-4">
              <div className="h-[70vh] overflow-auto overscroll-contain custom-scrollbar rounded-lg border border-gray-200">
                <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="border-b-2 border-purple-300 bg-purple-100">
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[210px]">
                      SERVICE
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[210px]">
                      VENDOR
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-3 text-right text-xs font-bold text-slate-900 uppercase tracking-wide w-[120px]">
                      AMOUNT(Lcy)
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[140px]">
                      RENEWAL DATE
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[90px]">
                      DAYS
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[240px]">
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
                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
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
                            {(() => {
                              const raw = (subscription as any)?.lcyAmount ?? subscription.amount;
                              const n = Number.parseFloat(String(raw));
                              return Number.isFinite(n) ? n.toFixed(2) : '—';
                            })()}
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

              </>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );

}
