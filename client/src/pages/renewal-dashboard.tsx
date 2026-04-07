import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/context/UserContext";
import { API_BASE_URL } from "@/lib/config";
import { AlertTriangle, Calendar, CheckCircle2, FileText, ShieldCheck, TrendingUp, X } from "lucide-react";

type ModalKey = "total" | "dueThisMonth" | "upcoming30d" | "overdue" | "active" | "completedThisYear";

type License = {
  id: string;
  licenseName: string;
  issuingAuthorityName: string;
  endDate: string;
  status?: string;
  renewalStatus?: string;
  department?: string;
};

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error] = React.useState<Error | null>(null);
  return error ? (
    <div style={{ color: "red", padding: 32 }}>
      <h2>Dashboard Error</h2>
      <pre>{error.message}</pre>
    </div>
  ) : (
    <React.Fragment>{children}</React.Fragment>
  );
}

export default function RenewalDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const [modalOpen, setModalOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalKey>("total");

  const { data: licenses, isLoading, error } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/licenses`, { credentials: "include" });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isUnauthorized = error instanceof Error && error.message === "Unauthorized";

  React.useEffect(() => {
    if (isUnauthorized) navigate("/login");
  }, [isUnauthorized, navigate]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const getFirstName = () => {
    if (!user?.fullName) return user?.email?.split("@")[0] || "User";
    return user.fullName.split(" ")[0];
  };

  const items = Array.isArray(licenses) ? licenses : [];

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startOfThisMonth = useMemo(() => {
    const d = new Date(startOfToday);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [startOfToday]);

  const startOfNextMonth = useMemo(() => {
    const d = new Date(startOfThisMonth);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [startOfThisMonth]);

  const startOfThisYear = useMemo(() => {
    const d = new Date(startOfToday);
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [startOfToday]);

  const startOfNextYear = useMemo(() => {
    const d = new Date(startOfThisYear);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [startOfThisYear]);

  const startOfTomorrow = useMemo(() => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() + 1);
    return d;
  }, [startOfToday]);

  const startOfNext30Days = useMemo(() => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() + 30);
    return d;
  }, [startOfToday]);

  const parseLocalDate = (rawValue: string) => {
    const s = String(rawValue || "").trim();
    if (!s) return null;

    // Common formats we see in this app / imports:
    // - YYYY-MM-DD
    // - ISO datetime (YYYY-MM-DDTHH:mm:ss...)
    // - DD/MM/YYYY
    const ymd = s.match(/^\d{4}-\d{2}-\d{2}$/);
    if (ymd) {
      const [y, m, d] = s.split("-").map((v) => Number(v));
      const dt = new Date(y, m - 1, d);
      return Number.isFinite(dt.getTime()) ? dt : null;
    }

    const dmy = s.match(/^\d{2}\/\d{2}\/\d{4}$/);
    if (dmy) {
      const [dd, mm, yyyy] = s.split("/").map((v) => Number(v));
      const dt = new Date(yyyy, mm - 1, dd);
      return Number.isFinite(dt.getTime()) ? dt : null;
    }

    const dt = new Date(s);
    if (!Number.isFinite(dt.getTime())) return null;
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  };

  const getDerivedStatus = (lic: Pick<License, "endDate" | "status">) => {
    if (String(lic.status || "").trim() === "Cancelled") return "Cancelled" as const;
    const end = parseLocalDate(String(lic.endDate || ""));
    if (!end) return "Active" as const;
    return end.getTime() <= startOfToday.getTime() ? ("Expired" as const) : ("Active" as const);
  };

  const getStatusPillClasses = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "Expired":
        return "bg-rose-100 text-rose-800 border border-rose-200";
      case "Cancelled":
        return "bg-rose-100 text-rose-800 border border-rose-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  const getRenewalStatusPillClasses = (renewalStatus: string) => {
    switch (renewalStatus) {
      case "Approved":
        return "bg-green-600 text-white";
      case "Cancelled":
      case "Rejected":
        return "bg-red-600 text-white";
      case "Renewal Initiated":
        return "bg-blue-600 text-white";
      case "Application Submitted":
        return "bg-indigo-600 text-white";
      case "Amendments/ Appeal Submitted":
        return "bg-orange-600 text-white";
      case "Resubmitted":
        return "bg-purple-600 text-white";
      default:
        return "bg-blue-600 text-white";
    }
  };

  const getRenewalStatusLabel = (renewalStatus: string) => {
    switch (renewalStatus) {
      case "Renewal Initiated":
        return "Initiated";
      case "Application Submitted":
        return "Submitted";
      case "Amendments/ Appeal Submitted":
        return "Amendment/Appeal";
      default:
        return renewalStatus;
    }
  };

  const formatDate = (value: Date | null) => {
    if (!value) return "-";
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = String(value.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const isExpiringSoon = (lic: License) => {
    const derived = getDerivedStatus(lic);
    if (derived !== "Active") return false;
    const end = parseLocalDate(String(lic.endDate || ""));
    if (!end) return false;
    return end >= startOfTomorrow && end <= startOfNext30Days;
  };

  const isDueThisMonth = (lic: License) => {
    const derived = getDerivedStatus(lic);
    if (derived === "Cancelled") return false;
    const end = parseLocalDate(String(lic.endDate || ""));
    if (!end) return false;
    return end >= startOfThisMonth && end < startOfNextMonth;
  };

  const isCompletedThisYear = (lic: License) => {
    const renewalStatus = String(lic.renewalStatus || "").trim();
    if (renewalStatus !== "Approved") return false;
    const end = parseLocalDate(String(lic.endDate || ""));
    if (!end) return false;
    return end >= startOfThisYear && end < startOfNextYear;
  };

  const openModal = (key: ModalKey) => {
    setActiveModal(key);
    setModalOpen(true);
  };

  const metrics = useMemo(() => {
    const total = items.length;
    let dueThisMonth = 0;
    let upcoming30d = 0;
    let overdue = 0;
    let active = 0;
    let completedThisYear = 0;

    for (const lic of items) {
      const derived = getDerivedStatus(lic);
      if (isDueThisMonth(lic)) dueThisMonth += 1;
      if (isExpiringSoon(lic)) upcoming30d += 1;
      if (derived === "Expired") overdue += 1;
      if (derived === "Active") active += 1;
      if (isCompletedThisYear(lic)) completedThisYear += 1;
    }

    return { total, dueThisMonth, upcoming30d, overdue, active, completedThisYear };
  }, [items, isDueThisMonth, isExpiringSoon, isCompletedThisYear]);

  const activeRows = useMemo(() => {
    switch (activeModal) {
      case "dueThisMonth":
        return items.filter((l) => isDueThisMonth(l));
      case "upcoming30d":
        return items.filter((l) => isExpiringSoon(l));
      case "overdue":
        return items.filter((l) => getDerivedStatus(l) === "Expired");
      case "active":
        return items.filter((l) => getDerivedStatus(l) === "Active");
      case "completedThisYear":
        return items.filter((l) => isCompletedThisYear(l));
      case "total":
      default:
        return items;
    }
  }, [activeModal, isCompletedThisYear, isDueThisMonth, items]);

  const modalTitle = useMemo(() => {
    switch (activeModal) {
      case "dueThisMonth":
        return "Due This Month";
      case "upcoming30d":
        return "Upcoming (Next 30 Days)";
      case "overdue":
        return "Overdue";
      case "active":
        return "Active Licenses";
      case "completedThisYear":
        return "Completed This Year";
      case "total":
      default:
        return "All Renewals";
    }
  }, [activeModal]);

  const statusBuckets = useMemo(() => {
    const colors = {
      Active: "var(--chart-3)",
      "Expiring Soon": "var(--chart-4)",
      Expired: "var(--chart-5)",
      Pending: "var(--chart-2)",
    } as const;

    const counts: Record<keyof typeof colors, number> = {
      Active: 0,
      "Expiring Soon": 0,
      Expired: 0,
      Pending: 0,
    };

    const isPending = (lic: License) => {
      const derived = getDerivedStatus(lic);
      if (derived !== "Active") return false;
      const renewalStatus = String(lic.renewalStatus || "").trim();
      if (!renewalStatus) return false;
      if (renewalStatus === "Approved" || renewalStatus === "Rejected" || renewalStatus === "Cancelled") return false;
      return true;
    };

    for (const lic of items) {
      const derived = getDerivedStatus(lic);

      // 1) Expired
      if (derived === "Expired") {
        counts.Expired += 1;
        continue;
      }

      // 2) Pending (renewal workflow in progress)
      if (isPending(lic)) {
        counts.Pending += 1;
        continue;
      }

      // 3) Expiring soon (next 30 days)
      if (isExpiringSoon(lic)) {
        counts["Expiring Soon"] += 1;
        continue;
      }

      // 4) Otherwise active
      counts.Active += 1;
    }

    const ordered: Array<keyof typeof colors> = ["Active", "Expiring Soon", "Expired", "Pending"];
    return ordered.map((status) => ({ status, count: counts[status], color: colors[status] }));
  }, [isExpiringSoon, items]);

  const statusTotal = useMemo(() => statusBuckets.reduce((sum, b) => sum + b.count, 0), [statusBuckets]);

  const statusDonutData = useMemo(() => {
    return statusBuckets
      .filter((s) => s.count > 0)
      .map((s) => ({ category: s.status, count: s.count, color: s.color }));
  }, [statusBuckets]);

  const renderDonutLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (typeof percent !== "number" || percent < 0.08) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  const monthlyRenewalsData = useMemo(() => {
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
    const counts = new Array(12).fill(0);

    for (const lic of items) {
      const derived = getDerivedStatus(lic);
      if (derived === "Cancelled") continue;
      const end = parseLocalDate(String(lic.endDate || ""));
      if (!end) continue;
      if (end < startOfThisYear || end >= startOfNextYear) continue;
      counts[end.getMonth()] += 1;
    }

    return monthLabels.map((m, idx) => ({ month: m, count: counts[idx] }));
  }, [items, startOfNextYear, startOfThisYear]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            {/* Greeting Card (match Dashboard header) */}
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

            {isLoading ? (
              <div className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Skeleton className="h-80" />
                  <Skeleton className="h-80" />
                </div>
              </div>
            ) : (
              <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
              <div
                className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-blue-500 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openModal("total")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Renewals</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.total}</p>
                  </div>
                  <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
                <div className="text-sm text-gray-400">Click to view details</div>
              </div>

              <div
                className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-green-500 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openModal("dueThisMonth")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Due This Month</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.dueThisMonth}</p>
                  </div>
                  <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-green-500" />
                  </div>
                </div>
                <div className="text-sm text-gray-400">Click to view details</div>
              </div>

              <div
                className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-purple-500 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openModal("upcoming30d")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Upcoming (30d)</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.upcoming30d}</p>
                  </div>
                  <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                  </div>
                </div>
                <div className="text-sm text-gray-400">Click to view details</div>
              </div>

              <div
                className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-orange-500 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openModal("overdue")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Overdue</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.overdue}</p>
                  </div>
                  <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  </div>
                </div>
                <div className="text-sm text-gray-400">Click to view details</div>
              </div>

              <div
                className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-emerald-500 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openModal("active")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Active Licenses</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.active}</p>
                  </div>
                  <div className="h-10 w-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <div className="text-sm text-gray-400">Click to view details</div>
              </div>

              <div
                className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-cyan-500 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openModal("completedThisYear")}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Completed This Year</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.completedThisYear}</p>
                  </div>
                  <div className="h-10 w-10 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-cyan-600" />
                  </div>
                </div>
                <div className="text-sm text-gray-400">Click to view details</div>
              </div>
            </div>

            {/* Charts */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-gray-900">Renewal Status</h3>
                </div>

                <div className="h-[320px] w-full flex flex-col sm:flex-row items-start gap-6">
                  <div className="h-[320px] w-full sm:flex-1 min-w-0 flex items-center justify-center">
                    {statusDonutData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-gray-500">No status data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={statusDonutData}
                            dataKey="count"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={2}
                            labelLine={false}
                            label={renderDonutLabel}
                          >
                            {statusDonutData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => [`${value}`, "Count"]}
                            cursor={false}
                            contentStyle={{
                              backgroundColor: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="w-full sm:w-[220px] flex flex-col justify-end">
                    <div className="flex flex-col gap-4 mt-8 sm:mt-16">
                      {statusBuckets.map((s) => {
                        const percent = statusTotal > 0 ? Math.round((s.count / statusTotal) * 100) : 0;
                        return (
                          <div key={s.status} className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                            <div className="text-sm text-gray-700 whitespace-nowrap">{s.status}</div>
                            <div className="text-sm text-gray-500 tabular-nums whitespace-nowrap">
                              {s.count.toLocaleString()} ({percent}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="mb-1">
                  <h3 className="text-lg font-bold text-gray-900">Monthly Renewals</h3>
                </div>

                <div className="h-[320px] w-full">
                  {monthlyRenewalsData.every((d) => d.count === 0) ? (
                    <div className="h-full flex items-center justify-center text-sm text-gray-500">No renewal data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={monthlyRenewalsData} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                        <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          formatter={(value: any) => [`${value}`, "Count"]}
                          cursor={false}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                          }}
                        />
                        <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 6, 6]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Metric Drilldown Modal (match Compliance modal UI) */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent className="max-w-6xl w-[95vw] max-h-[85vh] bg-white border-2 border-blue-500 rounded-xl shadow-lg p-0 overflow-hidden">
                <DialogHeader>
                  <div className="flex items-center justify-between px-6 pt-6">
                    <DialogTitle className="text-xl font-bold text-gray-900">
                      {modalTitle} ({activeRows.length})
                    </DialogTitle>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
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
                          <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[320px]">
                            Renewal
                          </TableHead>
                          <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[260px]">
                            Authority
                          </TableHead>
                          <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[140px]">
                            Status
                          </TableHead>
                          <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[160px]">
                            Expiry
                          </TableHead>
                          <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[170px]">
                            Renewal Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeRows.map((row) => {
                          const name = String(row.licenseName || "Renewal").trim() || "Renewal";
                          const authority = String(row.issuingAuthorityName || "-").trim() || "-";
                          const derivedStatus = getDerivedStatus(row);
                          const expiry = parseLocalDate(String(row.endDate || ""));
                          const renewalStatus = String(row.renewalStatus || "").trim();

                          return (
                            <TableRow
                              key={String((row as any)?._id ?? row.id ?? `${name}-${authority}`)}
                              className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                              <TableCell className="px-4 py-3 font-medium text-gray-800 w-[320px] max-w-[320px] min-w-0 overflow-hidden">
                                <div className="min-w-0 truncate whitespace-nowrap" title={name}>
                                  {name}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 w-[260px] max-w-[260px] min-w-0 overflow-hidden">
                                <div className="min-w-0 truncate whitespace-nowrap" title={authority}>
                                  {authority}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 w-[140px]">
                                <span
                                  className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none min-w-[120px] whitespace-nowrap ${getStatusPillClasses(
                                    derivedStatus
                                  )}`}
                                  title={derivedStatus}
                                >
                                  {derivedStatus}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 w-[160px] text-gray-700">{formatDate(expiry)}</TableCell>
                              <TableCell className="px-4 py-3 w-[170px]">
                                {renewalStatus ? (
                                  <span
                                    className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none min-w-[140px] ${getRenewalStatusPillClasses(
                                      renewalStatus
                                    )}`}
                                    title={renewalStatus}
                                  >
                                    {getRenewalStatusLabel(renewalStatus)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-500">-</span>
                                )}
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
