import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useUser } from "@/context/UserContext";
import ComplianceCategoryChart from "@/components/charts/compliance-category-chart";
import { AlertTriangle, Calendar, CheckCircle2, FileText, TrendingUp, X } from "lucide-react";

type ModalKey = "total" | "dueToday" | "upcoming7Days" | "overdue" | "completedThisMonth";

// Error boundary wrapper
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error] = React.useState<Error | null>(null);
  return error ? (
    <div style={{ color: 'red', padding: 32 }}>
      <h2>Dashboard Error</h2>
      <pre>{error.message}</pre>
    </div>
  ) : (
    <React.Fragment>{children}</React.Fragment>
  );
}

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalKey>("total");
  
  // Fetch all compliance filings (live data)
  const { data: complianceList, isLoading: complianceLoading, error: complianceError } = useQuery<any[]>({
    queryKey: ["/api/compliance/list"],
    queryFn: async () => {
      const res = await fetch("/api/compliance/list", { credentials: "include" });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch compliance data");
      return res.json();
    },
  refetchInterval: false, // Disable auto-refresh
  });

  const isUnauthorized = complianceError instanceof Error && complianceError.message === "Unauthorized";

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

  const items = Array.isArray(complianceList) ? complianceList : [];

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startOfTomorrow = useMemo(() => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() + 1);
    return d;
  }, [startOfToday]);

  const startOfNext7Days = useMemo(() => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() + 7);
    return d;
  }, [startOfToday]);

  const startOfMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const parseDateSafe = (value: unknown) => {
    const d = new Date(String(value ?? ""));
    return Number.isFinite(d.getTime()) ? d : null;
  };

  const isSubmitted = (c: any) => String(c?.status ?? "").toLowerCase() === "submitted";

  const getFilingName = (c: any) =>
    String(c?.filingName ?? c?.policy ?? c?.complianceName ?? c?.name ?? "Compliance Filing");

  const getCategory = (c: any) => {
    const raw = String(c?.category ?? c?.complianceCategory ?? c?.filingComplianceCategory ?? "Other").trim();
    return raw || "Other";
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

  const getDueDate = (c: any) => parseDateSafe(c?.submissionDeadline);

  const formatDate = (value: Date | null) => {
    if (!value) return "-";
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = String(value.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const getStatusPill = (c: any) => {
    const raw = String(c?.status ?? "").toLowerCase();
    if (raw === "draft") {
      return { label: "Draft", classes: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    if (raw === "submitted") {
      return { label: "Submitted", classes: "bg-green-50 text-green-700 border-green-200" };
    }

    const deadline = getDueDate(c);
    if (deadline && deadline < startOfToday) {
      return { label: "Late", classes: "bg-rose-50 text-rose-700 border-rose-200" };
    }
    if (deadline) {
      return { label: "Due", classes: "bg-orange-50 text-orange-700 border-orange-200" };
    }
    return { label: "No Due", classes: "bg-slate-50 text-slate-700 border-slate-200" };
  };

  const openModal = (key: ModalKey) => {
    setActiveModal(key);
    setModalOpen(true);
  };

  const metrics = useMemo(() => {
    const total = items.length;

    const dueToday = items.filter((c: any) => {
      if (isSubmitted(c)) return false;
      const deadline = parseDateSafe(c?.submissionDeadline);
      if (!deadline) return false;
      return deadline >= startOfToday && deadline < startOfTomorrow;
    }).length;

    const upcoming7Days = items.filter((c: any) => {
      if (isSubmitted(c)) return false;
      const deadline = parseDateSafe(c?.submissionDeadline);
      if (!deadline) return false;
      return deadline >= startOfTomorrow && deadline <= startOfNext7Days;
    }).length;

    const overdue = items.filter((c: any) => {
      if (isSubmitted(c)) return false;
      const deadline = parseDateSafe(c?.submissionDeadline);
      if (!deadline) return false;
      return deadline < startOfToday;
    }).length;

    const completedThisMonth = items.filter((c: any) => {
      if (!isSubmitted(c)) return false;
      const dt =
        parseDateSafe((c as any)?.submissionDate) ||
        parseDateSafe((c as any)?.filingSubmissionDate) ||
        parseDateSafe((c as any)?.updatedAt) ||
        parseDateSafe((c as any)?.createdAt);
      if (!dt) return false;
      return dt >= startOfMonth;
    }).length;

    return { total, dueToday, upcoming7Days, overdue, completedThisMonth };
  }, [items, startOfMonth, startOfNext7Days, startOfToday, startOfTomorrow]);

  const statusBuckets = useMemo(() => {
    const colors = {
      "No Due": "hsl(var(--chart-3))",
      Draft: "hsl(var(--chart-4))",
      Due: "hsl(var(--chart-2))",
      Late: "hsl(var(--chart-1))",
    } as const;

    const counts: Record<keyof typeof colors, number> = {
      "No Due": 0,
      Draft: 0,
      Due: 0,
      Late: 0,
    };

    for (const c of items) {
      const statusRaw = String(c?.status ?? "").toLowerCase();
      const deadline = getDueDate(c);

      if (statusRaw === "draft") {
        counts.Draft += 1;
        continue;
      }

      if (isSubmitted(c) || !deadline) {
        counts["No Due"] += 1;
        continue;
      }

      if (statusRaw === "overdue" || deadline < startOfToday) {
        counts.Late += 1;
        continue;
      }

      counts.Due += 1;
    }

    const ordered: Array<keyof typeof colors> = ["No Due", "Draft", "Due", "Late"];
    return ordered.map((status) => ({ status, count: counts[status], color: colors[status] }));
  }, [items, startOfToday]);

  const statusTotal = useMemo(() => statusBuckets.reduce((sum, b) => sum + b.count, 0), [statusBuckets]);

  const statusDonutData = useMemo(() => {
    return statusBuckets
      .filter((s) => s.count > 0)
      .map((s) => ({ category: s.status, count: s.count, color: s.color }));
  }, [statusBuckets]);

  const renderDonutLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (typeof percent !== 'number' || percent < 0.08) return null;
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

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of items) {
      const category = getCategory(c);
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const rowsByModalKey = useMemo(() => {
    const list = items;

    const dueTodayRows = list.filter((c: any) => {
      if (isSubmitted(c)) return false;
      const deadline = getDueDate(c);
      return !!deadline && deadline >= startOfToday && deadline < startOfTomorrow;
    });

    const upcoming7DaysRows = list.filter((c: any) => {
      if (isSubmitted(c)) return false;
      const deadline = getDueDate(c);
      return !!deadline && deadline >= startOfTomorrow && deadline <= startOfNext7Days;
    });

    const overdueRows = list.filter((c: any) => {
      if (isSubmitted(c)) return false;
      const deadline = getDueDate(c);
      if (!deadline) return false;
      const statusRaw = String(c?.status ?? "").toLowerCase();
      return statusRaw === "overdue" || deadline < startOfToday;
    });

    const completedThisMonthRows = list.filter((c: any) => {
      if (!isSubmitted(c)) return false;
      const dt =
        parseDateSafe((c as any)?.submissionDate) ||
        parseDateSafe((c as any)?.filingSubmissionDate) ||
        parseDateSafe((c as any)?.updatedAt) ||
        parseDateSafe((c as any)?.createdAt);
      return !!dt && dt >= startOfMonth;
    });

    return {
      total: list,
      dueToday: dueTodayRows,
      upcoming7Days: upcoming7DaysRows,
      overdue: overdueRows,
      completedThisMonth: completedThisMonthRows,
    } satisfies Record<ModalKey, any[]>;
  }, [items, parseDateSafe, startOfMonth, startOfNext7Days, startOfToday, startOfTomorrow]);

  const modalTitle = useMemo(() => {
    switch (activeModal) {
      case "total":
        return "Total Filings";
      case "dueToday":
        return "Due Today";
      case "upcoming7Days":
        return "Upcoming (7 days)";
      case "overdue":
        return "Overdue / Late";
      case "completedThisMonth":
        return "Completed This Month";
      default:
        return "Filings";
    }
  }, [activeModal]);

  const activeRows = rowsByModalKey[activeModal] ?? [];

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

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-3 relative z-10 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className={`${location.pathname === "/dashboard"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 hover:text-white"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} whitespace-nowrap w-full sm:w-32 lg:w-36 px-4 md:px-6 py-2.5 rounded-lg font-medium`}
                  onClick={() => navigate("/dashboard")}
                >
                  Subscription
                </Button>
                <Button
                  variant="outline"
                  className={`${location.pathname === "/compliance-dashboard"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 hover:text-white"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} whitespace-nowrap w-full sm:w-32 lg:w-36 px-4 md:px-6 py-2.5 rounded-lg font-medium`}
                  onClick={() => navigate("/compliance-dashboard")}
                >
                  Compliance
                </Button>
                <Button
                  variant="outline"
                  className={`${location.pathname === "/renewal-dashboard"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 hover:text-white"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} whitespace-nowrap w-full sm:w-32 lg:w-36 px-4 md:px-6 py-2.5 rounded-lg font-medium`}
                  onClick={() => navigate("/renewal-dashboard")}
                >
                  Renewal
                </Button>
                <Button
                  variant="outline"
                  className={`${location.pathname === "/calendar"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 hover:text-white"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"} whitespace-nowrap w-full sm:w-32 lg:w-36 px-4 md:px-6 py-2.5 rounded-lg font-medium`}
                  onClick={() => navigate("/calendar")}
                >
                  Calendar
                </Button>
              </div>
            </div>
            {complianceLoading ? (
              <div className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                  {Array.from({ length: 5 }).map((_, i) => (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                  <div
                    className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-blue-500 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openModal("total")}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600 mb-1">Total Filings</p>
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
                    onClick={() => openModal("dueToday")}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600 mb-1">Due Today</p>
                        <p className="text-2xl font-bold text-gray-900">{metrics.dueToday}</p>
                      </div>
                      <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-5 w-5 text-green-500" />
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">Click to view details</div>
                  </div>

                  <div
                    className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-purple-500 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openModal("upcoming7Days")}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600 mb-1">Upcoming (7 days)</p>
                        <p className="text-2xl font-bold text-gray-900">{metrics.upcoming7Days}</p>
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
                        <p className="text-sm font-medium text-gray-600 mb-1">Overdue / Late</p>
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
                    onClick={() => openModal("completedThisMonth")}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600 mb-1">Completed This Month</p>
                        <p className="text-2xl font-bold text-gray-900">{metrics.completedThisMonth}</p>
                      </div>
                      <div className="h-10 w-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">Click to view details</div>
                  </div>
                </div>

                {/* Charts */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-gray-900">Status Distribution</h3>
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
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={2}
                                dataKey="count"
                                nameKey="category"
                                label={renderDonutLabel}
                                labelLine={false}
                              >
                                {statusDonutData.map((entry) => (
                                  <Cell key={entry.category} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => [`${Number(value).toLocaleString()} filings`, 'Filings']}
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                  padding: '12px',
                                }}
                                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 6 }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      <div className="h-[240px] w-56 flex flex-col items-start justify-center">
                        <div className="space-y-4">
                          {statusDonutData.map((s) => {
                            const percent = statusTotal ? Math.round((s.count / statusTotal) * 100) : 0;
                            return (
                              <div key={s.category} className="flex items-center gap-3">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                            <div className="text-sm text-gray-700 whitespace-nowrap">
                              {s.category}
                            </div>
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
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Category Breakdown</h3>
                </div>
                <div>
                  <ComplianceCategoryChart data={categoryData} />
                </div>
              </div>
            </div>

            {/* Metric Drilldown Modal (match Dashboard modal UI) */}
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
                            Filing
                          </TableHead>
                          <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[240px]">
                            Category
                          </TableHead>
                          <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[140px]">
                            Status
                          </TableHead>
                          <TableHead className="sticky top-0 z-20 bg-purple-100 h-12 px-4 text-left text-xs font-bold text-slate-900 uppercase tracking-wide w-[160px]">
                            Due Date
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeRows.map((row: any) => {
                          const filingName = getFilingName(row);
                          const category = getCategory(row);
                          const dueDate = getDueDate(row);
                          const status = getStatusPill(row);
                          return (
                            <TableRow
                              key={String(row?._id ?? row?.id ?? `${filingName}-${category}`)}
                              className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                              <TableCell className="px-4 py-3 font-medium text-gray-800 w-[320px] max-w-[320px] min-w-0 overflow-hidden">
                                <div className="min-w-0 truncate whitespace-nowrap" title={filingName}>
                                  {filingName}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 w-[240px] max-w-[240px] min-w-0 overflow-hidden">
                                <span
                                  className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border min-w-[110px] max-w-[200px] truncate whitespace-nowrap ${getCategoryPillClasses(
                                    category
                                  )}`}
                                  title={category}
                                >
                                  {category}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 w-[140px]">
                                <span
                                  className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border min-w-[120px] whitespace-nowrap ${status.classes}`}
                                  title={status.label}
                                >
                                  {status.label}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 w-[160px] text-gray-700">
                                {formatDate(dueDate)}
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