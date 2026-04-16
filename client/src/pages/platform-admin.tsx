import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  Bell,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  Receipt,
  TrendingUp,
  Users as UsersIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PlatformStats = {
  totalCompanies: number;
  totalUsers: number;
  mrr: number;
  arr: number;
  totalRevenue: number;
  monthlyCollected: number;
  paidInvoices: number;
  failedInvoices: number;
  activeStripeSubscriptions: number;
  billingConfigured: boolean;
  revenueSource: "stripe" | "subscriptions";
};

type PlatformCompany = {
  tenantId: string;
  companyName: string;
  plan?: string | null;
  users: number;
  status: string;
  createdAt?: string | Date | null;
  subscriptionCurrentPeriodEnd?: string | Date | null;
};

type PlatformActivityItem = {
  _id?: string;
  id?: string;
  tenantId?: string;
  companyName?: string | null;
  action?: string;
  type?: string;
  description?: string;
  subscriptionName?: string;
  serviceName?: string;
  message?: string;
  timestamp?: string | Date;
  createdAt?: string | Date;
};

type BillingRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  companyName?: string | null;
  status: string;
  amount: number;
  currency: string;
  createdAt: string | Date | null;
};

type BillingSummary = {
  paidInvoices: number;
  failedInvoices: number;
  monthlyCollected: number;
  mrr: number;
  activeStripeSubscriptions: number;
};

type BillingResponse = {
  configured: boolean;
  summary: BillingSummary;
  payments: BillingRow[];
};

const formatMoney = (value: unknown, currency = "USD") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (raw: unknown) => {
  if (!raw) return "—";
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "—";
};

const formatDateTime = (raw: unknown) => {
  if (!raw) return "—";
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
};

function isAllCaps(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function formatCompanyName(raw: unknown) {
  const name = String(raw ?? "").trim();
  if (!name) return "Unnamed Company";
  return isAllCaps(name) ? toTitleCase(name) : name;
}

const formatPlanLabel = (plan: unknown) => {
  const normalized = String(plan ?? "").trim().toLowerCase();
  if (!normalized) return "Free Plan";
  if (normalized === "professional" || normalized === "pro") return "Professional";
  if (normalized === "starter") return "Starter";
  if (normalized === "trial") return "Trial";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

function isPaidPlan(plan: unknown) {
  const lower = String(plan ?? "").trim().toLowerCase();
  return ["starter", "professional", "pro", "business", "enterprise"].includes(lower);
}

function formatRenewalDate(company: PlatformCompany) {
  const paid = isPaidPlan(company.plan) || Boolean(company.subscriptionCurrentPeriodEnd);
  if (!paid) return "";
  return formatDate(company.subscriptionCurrentPeriodEnd);
}

const formatMonthLabel = (date: Date) => date.toLocaleDateString(undefined, { month: "short" });
const formatDayLabel = (date: Date) => date.toLocaleDateString(undefined, { weekday: "short" });

function parseToDate(raw: unknown): Date | null {
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isFinite(date.getTime()) ? date : null;
}

function activityText(item: PlatformActivityItem) {
  return item.description || item.message || item.action || item.type || item.subscriptionName || item.serviceName || "Platform activity";
}

function statusBadgeClass(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "active", "success", "trialing"].includes(normalized)) {
    return "bg-green-100 text-green-700 border-green-200";
  }
  if (["failed", "expired", "uncollectible", "void"].includes(normalized)) {
    return "bg-red-100 text-red-700 border-red-200";
  }
  return "bg-orange-100 text-orange-700 border-orange-200";
}

function companyStatusLabel(status: unknown) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized === "active") return "Active";
  if (normalized === "suspended" || normalized === "inactive" || normalized === "disabled") return "Suspended";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function companyStatusClass(status: unknown) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "active") return "bg-green-100 text-green-700 border-green-200";
  if (["suspended", "inactive", "disabled"].includes(normalized)) return "bg-red-100 text-red-700 border-red-200";
  return "bg-orange-100 text-orange-700 border-orange-200";
}

function StatCard({
  title,
  value,
  note,
  icon: Icon,
  borderColor,
  iconClassName,
}: {
  title: string;
  value: string;
  note: string;
  icon: typeof Building2;
  borderColor: string;
  iconClassName: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border-t-4 ${borderColor} hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3 gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 break-words">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="text-sm text-gray-500 leading-6">{note}</div>
    </div>
  );
}

export default function PlatformAdminPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<PlatformStats>({
    queryKey: ["/api/platform/stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/stats");
      if (!res.ok) throw new Error("Failed to fetch platform stats");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: companies = [], isLoading: companiesLoading, error: companiesError } = useQuery<PlatformCompany[]>({
    queryKey: ["/api/platform/companies"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: activity = [], isLoading: activityLoading, error: activityError } = useQuery<PlatformActivityItem[]>({
    queryKey: ["/api/platform/activity"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/activity");
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: billing, error: billingError } = useQuery<BillingResponse>({
    queryKey: ["/api/platform/billing"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/billing");
      if (!res.ok) throw new Error("Failed to fetch billing");
      return res.json();
    },
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const anyError = statsError || companiesError || activityError || billingError;
  // Keep "Organizations" + "Users" consistent with Tenants pages by using the same source:
  // the (deduped) platform companies list.
  const companyCount = companies.length;
  const userCount = companies.reduce((total, company) => total + Number(company.users || 0), 0);
  const mrrValue = stats?.mrr ?? billing?.summary?.mrr ?? 0;
  const monthlyCollectedValue = stats?.monthlyCollected ?? billing?.summary?.monthlyCollected ?? 0;
  const arrValue = stats?.arr ?? mrrValue * 12;
  const paidInvoicesValue = stats?.paidInvoices ?? billing?.summary?.paidInvoices ?? 0;
  const failedInvoicesValue = stats?.failedInvoices ?? billing?.summary?.failedInvoices ?? 0;

  const companiesGrowth = useMemo(() => {
    const now = new Date();
    const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();
    const end = monthIndex(now);
    const start = end - 5;
    const counts = new Map<number, number>();

    for (const company of companies) {
      const created = parseToDate(company.createdAt);
      if (!created) continue;
      const index = monthIndex(created);
      if (index < start || index > end) continue;
      counts.set(index, (counts.get(index) || 0) + 1);
    }

    const series: Array<{ label: string; companies: number }> = [];
    for (let index = start; index <= end; index++) {
      const year = Math.floor(index / 12);
      const month = index % 12;
      const date = new Date(year, month, 1);
      series.push({ label: formatMonthLabel(date), companies: counts.get(index) || 0 });
    }
    return series;
  }, [companies]);

  const activityVolume = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(now.getTime() - 6 * dayMs);
    start.setHours(0, 0, 0, 0);
    const counts = new Map<number, number>();

    for (const entry of activity) {
      const eventDate = parseToDate(entry.timestamp ?? entry.createdAt);
      if (!eventDate) continue;
      const day = new Date(eventDate);
      day.setHours(0, 0, 0, 0);
      if (day < start) continue;
      counts.set(day.getTime(), (counts.get(day.getTime()) || 0) + 1);
    }

    const series: Array<{ label: string; events: number }> = [];
    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(start.getTime() + offset * dayMs);
      series.push({ label: formatDayLabel(day), events: counts.get(day.getTime()) || 0 });
    }
    return series;
  }, [activity]);

  const topCompanies = useMemo(
    () => [...companies].sort((a, b) => Number(b.users || 0) - Number(a.users || 0)).slice(0, 5),
    [companies]
  );

  const paymentHighlights = billing?.payments?.slice(0, 4) || [];

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  })();


  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 bg-[#f8fafc] min-h-screen">
      <div className="max-w-7xl mx-auto">
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
          </div>

          <div className="relative z-10 max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {greeting}, Platform Owner!
            </h1>
          </div>
        </div>

        {anyError ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load one or more platform data sources.
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            title="Organizations"
            value={companiesLoading ? "—" : String(companyCount)}
            note="Tenant organizations currently visible in the platform catalog."
            icon={Building2}
            borderColor="border-blue-500"
            iconClassName="bg-blue-50 text-blue-500"
          />
          <StatCard
            title="Tenant Users"
            value={companiesLoading ? "—" : String(userCount)}
            note="Total active users across tenant organizations."
            icon={UsersIcon}
            borderColor="border-green-500"
            iconClassName="bg-green-50 text-green-500"
          />
          <StatCard
            title="Stripe MRR"
            value={statsLoading && !billing ? "—" : formatMoney(mrrValue)}
            note="Monthly recurring revenue from live Stripe subscriptions."
            icon={DollarSign}
            borderColor="border-purple-500"
            iconClassName="bg-purple-50 text-purple-500"
          />
          <StatCard
            title="Month Collected"
            value={statsLoading && !billing ? "—" : formatMoney(monthlyCollectedValue)}
            note="Paid Stripe invoices created during the current month."
            icon={Receipt}
            borderColor="border-orange-500"
            iconClassName="bg-orange-50 text-orange-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <StatCard
            title="ARR"
            value={statsLoading && !billing ? "—" : formatMoney(arrValue)}
            note="Annualized recurring revenue based on current MRR."
            icon={TrendingUp}
            borderColor="border-indigo-500"
            iconClassName="bg-indigo-50 text-indigo-500"
          />
          <StatCard
            title="Paid Invoices"
            value={statsLoading && !billing ? "—" : String(paidInvoicesValue)}
            note="Successful Stripe invoice payments returned by the API."
            icon={Calendar}
            borderColor="border-teal-500"
            iconClassName="bg-teal-50 text-teal-500"
          />
          <StatCard
            title="Failed Payments"
            value={statsLoading && !billing ? "—" : String(failedInvoicesValue)}
            note="Invoices with final failed payment status."
            icon={Bell}
            borderColor="border-red-500"
            iconClassName="bg-red-50 text-red-500"
          />
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Platform Analytics</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900">Company Growth</h3>
              <p className="text-sm text-gray-500 mt-1">New companies created during the last six months.</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companiesGrowth} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(79, 70, 229, 0.06)" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 10px 25px rgba(15,23,42,0.10)" }}
                  />
                  <Bar dataKey="companies" radius={[8, 8, 0, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900">Activity Volume</h3>
              <p className="text-sm text-gray-500 mt-1">Platform-wide audit events across the last seven days.</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityVolume} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="platformActivityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ stroke: "rgba(139, 92, 246, 0.25)", strokeWidth: 2 }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 10px 25px rgba(15,23,42,0.10)" }}
                  />
                  <Area type="monotone" dataKey="events" stroke="#8b5cf6" fill="url(#platformActivityFill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Top Organizations</h3>
                <p className="text-sm text-gray-500 mt-1">Largest tenant accounts by user count and renewal signal.</p>
              </div>
              <Badge variant="outline" className="border-gray-200 text-gray-600 bg-gray-50">
                {companies.length} tenants
              </Badge>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companiesLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-sm text-gray-500">Loading organizations…</TableCell>
                    </TableRow>
                  ) : topCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-sm text-gray-500">No companies found.</TableCell>
                    </TableRow>
                  ) : (
                    topCompanies.map((company) => (
                      <TableRow key={company.tenantId}>
                        <TableCell>
                          <div className="font-medium text-gray-900">{formatCompanyName(company.companyName)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={companyStatusClass(company.status)}>
                            {companyStatusLabel(company.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-700">{formatPlanLabel(company.plan)}</TableCell>
                        <TableCell className="text-right text-gray-700">{company.users}</TableCell>
                        <TableCell className="text-gray-700">{formatRenewalDate(company)}</TableCell>
                        <TableCell className="text-gray-700">{formatDate(company.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Recent Payments</h3>
                <p className="text-sm text-gray-500 mt-1">Latest Stripe-side payment outcomes with account context.</p>
              </div>
              <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div className="space-y-3">
              {paymentHighlights.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500">
                  No recent Stripe payments are available yet.
                </div>
              ) : (
                paymentHighlights.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">{payment.customerName}</div>
                        <div className="truncate text-xs text-gray-500">
                          {(payment.companyName ? formatCompanyName(payment.companyName) : "") || payment.customerEmail}
                        </div>
                      </div>
                      <Badge variant="secondary" className={statusBadgeClass(payment.status)}>
                        {payment.status}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-4">
                      <div className="text-lg font-semibold text-gray-900">{formatMoney(payment.amount, payment.currency)}</div>
                      <div className="text-xs text-gray-500">{formatDateTime(payment.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {activityLoading || activity.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Latest Platform Activity</h3>
                <p className="text-sm text-gray-500 mt-1">Cross-tenant audit activity and operational movement.</p>
              </div>
              <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <ActivityIcon className="h-5 w-5 text-purple-500" />
              </div>
            </div>

            {activityLoading ? (
              <div className="text-sm text-gray-500">Loading activity…</div>
            ) : (
              <div className="space-y-0">
                {activity.slice(0, 6).map((entry, index) => {
                  const key = entry._id || entry.id || `${entry.tenantId}-${String(entry.timestamp || entry.createdAt || "")}-${index}`;
                  return (
                    <div key={key} className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="mt-2 h-2.5 w-2.5 rounded-full bg-purple-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{activityText(entry)}</div>
                              <div className="mt-1 text-xs text-gray-500">
                                {(entry.companyName ? formatCompanyName(entry.companyName) : "") || "Platform"}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(entry.timestamp || entry.createdAt)}</div>
                          </div>
                        </div>
                      </div>
                      {index < 5 ? <div className="mt-4 h-px w-full bg-gray-100" /> : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}