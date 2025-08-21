import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, TrendingUp, RefreshCw, Bell, Users, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TrendsChart from "@/components/charts/trends-chart";
import CategoryChart from "@/components/charts/category-chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardMetrics, SpendingTrend, CategoryBreakdown, Subscription } from "@shared/types";


// Error boundary wrapper
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  // No error boundary needed, just render children
  return <React.Fragment>{children}</React.Fragment>;
}

export default function Dashboard() {
  const location = window.location.pathname;
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  console.log("[Dashboard] Component mounted");
  const [activeSubscriptionsModalOpen, setActiveSubscriptionsModalOpen] = useState(false);
  const [upcomingRenewalsModalOpen, setUpcomingRenewalsModalOpen] = useState(false);
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/analytics/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard", { credentials: "include" });
      return res.json();
    }
  });
  const { data: trends, isLoading: trendsLoading } = useQuery<SpendingTrend[]>({
    queryKey: ["/api/analytics/trends"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/trends", { credentials: "include" });
      return res.json();
    }
  });
  const { data: categories, isLoading: categoriesLoading } = useQuery<CategoryBreakdown[]>({
    queryKey: ["/api/analytics/categories"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/categories", { credentials: "include" });
      return res.json();
    }
  });
  // Activity query removed as it's not currently used in the dashboard
  // const { data: activity, isLoading: activityLoading } = useQuery<RecentActivity[]>({
  //   queryKey: ["/api/analytics/activity"],
  //   queryFn: async () => {
  //     const res = await fetch("/api/analytics/activity", { credentials: "include" });
  //     return res.json();
  //   }
  // });
  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions", { credentials: "include" });
      return res.json();
    }
  });

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
      console.log("[Dashboard] Cookie token:", token);
      if (token) {
        setAuthChecked(true);
        console.log("[Dashboard] Authenticated, rendering dashboard.");
      } else {
        console.log("[Dashboard] No token found, redirecting to login.");
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

  // Filter active subscriptions
  const activeSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter(sub => sub.status === "Active") : [];
  
  // Filter upcoming renewals (next 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRenewals = activeSubscriptions.filter(sub => {
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
      <div className="p-8">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', background: '#f44336', color: '#fff', border: 0, borderRadius: 4, fontWeight: 600 }}
          >
            Logout
          </button>
        </div>
        {/* Top tab buttons */}
        <div className="flex gap-4 mb-8">
          <Button
            variant={location === '/dashboard' ? 'default' : 'outline'}
            onClick={() => handleTabClick('subscription')}
          >
            Subscription
          </Button>
          <Button
            variant={location === '/compliance-dashboard' ? 'default' : 'outline'}
            onClick={() => handleTabClick('compliance')}
          >
            Compliance
          </Button>
        </div>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-2">Overview of your subscription spending and analytics</p>
        </div>

        {/* Date Filter */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex space-x-4">
            <Select defaultValue="6months">
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Last 6 months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6months">Last 6 months</SelectItem>
                <SelectItem value="12months">Last 12 months</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="software">Software</SelectItem>
                <SelectItem value="entertainment">Entertainment</SelectItem>
                <SelectItem value="business">Business Tools</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Spend</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ${metrics?.monthlySpend.toLocaleString() || '0'}
                  </p>
                  <p className={`text-sm mt-1 flex items-center ${getGrowthColor(-12)}`}>
                    {getGrowthIcon(-12)} 12% from last month
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CalendarDays className="text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Yearly Spend</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ${metrics?.yearlySpend.toLocaleString() || '0'}
                  </p>
                  <p className={`text-sm mt-1 flex items-center ${getGrowthColor(8)}`}>
                    {getGrowthIcon(8)} 8% from last year
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSubscriptionsModalOpen(true)}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
                  <p className="text-3xl font-bold text-blue-600 hover:text-blue-700">
                    {metrics?.activeSubscriptions || 0}
                  </p>
                  <p className="text-sm text-blue-600 mt-1 flex items-center">
                    <Users className="w-4 h-4 mr-1" /> Click to view details
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <RefreshCw className="text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setUpcomingRenewalsModalOpen(true)}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Upcoming Renewals</p>
                  <p className="text-3xl font-bold text-orange-600 hover:text-orange-700">
                    {metrics?.upcomingRenewals || 0}
                  </p>
                  <p className="text-sm text-orange-600 mt-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1" /> Next 30 days - Click to view
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Bell className="text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Spending Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : trends ? (
                <TrendsChart data={trends} />
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : categories ? (
                <CategoryChart data={categories} />
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  No category data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Subscriptions Modal */}
        <Dialog open={activeSubscriptionsModalOpen} onOpenChange={setActiveSubscriptionsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Active Subscriptions ({activeSubscriptions.length})</DialogTitle>
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
                  {activeSubscriptions.map((subscription) => (
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
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
    </ErrorBoundary>
  );

}
