import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { findPlatformItem, findPlatformSection } from "@/lib/platform-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Clock3, CreditCard, Receipt, ShieldCheck } from "lucide-react";

type PlatformStats = {
  totalCompanies: number;
  totalUsers: number;
  mrr: number;
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

type PlatformUser = {
  userId?: string;
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  tenantId?: string | null;
  role?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
  lastLogin?: string | Date | null;

  // Data hygiene signals (server-side de-duplication by normalized email)
  tenantIds?: string[];
  companyNames?: string[];
  multipleCompanies?: boolean;
};

type PlatformActivityItem = {
  _id?: string;
  tenantId?: string;
  companyName?: string | null;
  action?: string;
  type?: string;
  description?: string;
  message?: string;
  subscriptionName?: string;
  serviceName?: string;
  timestamp?: string | Date;
  createdAt?: string | Date;
};

type BillingRow = {
  id: string;
  invoiceNumber?: string | null;
  invoiceReference?: string | null;
  customerName: string;
  customerEmail: string;
  companyName?: string | null;
  plan?: string | null;
  status: string;
  amount: number;
  currency: string;
  createdAt: string | Date | null;
  paidAt?: string | Date | null;
  dueDate?: string | Date | null;
  invoiceUrl?: string | null;
  subscriptionId?: string | null;
};

type BillingSubscription = {
  id: string;
  customerName: string;
  customerEmail: string;
  companyName?: string | null;
  tenantId?: string | null;
  planName: string;
  status: string;
  currentPeriodEnd: string | Date | null;
};

type BillingSummary = {
  linkedAccounts: number;
  activePlans: number;
  expiredPlans: number;
  paidInvoices: number;
  failedInvoices: number;
  totalRevenue: number;
  monthlyCollected?: number;
  mrr?: number;
  arr?: number;
  activeStripeSubscriptions: number;
};

type BillingResponse = {
  configured: boolean;
  summary: BillingSummary;
  linkedAccounts: PlatformUser[];
  invoices: BillingRow[];
  payments: BillingRow[];
  subscriptions: BillingSubscription[];
};

type PlatformMonitoring = {
  stripeConnected: boolean;
  mongo: {
    status: "connected" | "slow" | "down";
    latencyMs: number | null;
    windowMinutes?: number;
    samples?: number;
    failureCount?: number;
    failureRatePct?: number | null;
    p95LatencyMs?: number | null;
    lastFailureAt?: string | Date | null;
  };
  api: {
    windowMinutes: number;
    samples: number;
    avgResponseMs: number | null;
    p95ResponseMs: number | null;
    errorRatePct: number | null;
  };
  audit: {
    eventsLast24h: number;
    lastEventAt: string | Date | null;
  };
  tenantActivity: {
    eventsLast24h: number;
    lastEventAt: string | Date | null;
  };
  jobs: {
    failedLast24h: number;
    lastFailureAt: string | Date | null;
  };
  alerts?: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    service: "stripe" | "mongodb" | "api" | "jobs" | "audit" | "tenant-activity";
    title: string;
    detail: string;
    suggestedAction: string;
    detectedAt: string;
  }>;
  notifications?: {
    webhookConfigured: boolean;
  };
};

type PlatformSettings = {
  billing: {
    stripeEnabled: boolean;
    stripeMode: "test" | "live";
    defaultCurrency: "USD" | "INR";
    trialDays: number;
  };
  tenantOnboarding: {
    defaultPlan: "free" | "pro";
    autoCreateCompanyOnSignup: boolean;
    requireEmailVerification: boolean;
    allowMultipleCompaniesPerUser: boolean;
  };
  notifications: {
    emailNotificationsEnabled: boolean;
    reminderDays: number[];
    schedulerJobsEnabled: boolean;
  };
  security: {
    forceStrongPasswords: boolean;
    enable2FA: boolean;
    sessionTimeoutMinutes: number;
    allowImpersonation: boolean;

    jwtExpiryEnabled: boolean;
    jwtExpiryMinutes: number;
    refreshTokensEnabled: boolean;
    maxLoginAttempts: number;
    accountLockMinutes: number;
    ipTrackingEnabled: boolean;
  };
  support: {
    globalAdminTenantDataAccess: boolean;
    auditLoggingEnabled: boolean;
    debugMode: boolean;
  };
  updatedBy?: { userId?: string; email?: string } | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type AuthSessionItem = {
  id: string;
  userId: string;
  email: string;
  role: string;
  tenantId: string | null;
  actingTenantId: string | null;
  createdAt?: string | Date | null;
  lastSeenAt?: string | Date | null;
  revokedAt?: string | Date | null;
  revokedReason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  isActive: boolean;
};

type AuthSessionsResponse = {
  timeoutMinutes: number;
  items: AuthSessionItem[];
};

type StripeWebhookEventItem = {
  id: string;
  type: string | null;
  status: string | null;
  livemode: boolean | null;
  eventCreatedAt?: string | Date | null;
  receivedAt?: string | Date | null;
  lastReceivedAt?: string | Date | null;
  processedAt?: string | Date | null;
  errorAt?: string | Date | null;
  errorMessage?: string | null;
  requestId?: string | null;
  stripeAccount?: string | null;
  summary?: Record<string, any>;
};

type StripeWebhookEventsResponse = {
  items: StripeWebhookEventItem[];
};

type SecurityAuditEventItem = {
  id: string;
  tenantId?: string | null;
  action?: string | null;
  description?: string | null;
  email?: string | null;
  severity?: string | null;
  meta?: Record<string, any> | null;
  timestamp?: string | Date | null;
};

type SecurityAuditEventsResponse = {
  items: SecurityAuditEventItem[];
};

type ErrorLogItem = {
  id: string;
  kind?: string | null;
  message?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  createdAt?: string | Date | null;
  meta?: Record<string, any> | null;
};

type ErrorLogsResponse = {
  items: ErrorLogItem[];
};

type JobRunItem = {
  id: string;
  taskName?: string | null;
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
  durationMs?: number | null;
  success?: boolean | null;
  errorMessage?: string | null;
};

type JobRunsResponse = {
  items: JobRunItem[];
};

const schedulerJobs = [
  { name: "Monthly Reminder", cadence: "Monthly", module: "Reminders", status: "Active" },
  { name: "Daily Renewal Reminder Email", cadence: "Daily", module: "Reminders", status: "Active" },
  { name: "Yearly Reminder", cadence: "Daily (checks yearly events)", module: "Reminders", status: "Active" },
  { name: "Compliance Reminder", cadence: "Daily", module: "Compliance", status: "Active" },
  { name: "Auto-Renewal", cadence: "Daily", module: "Billing", status: "Active" },
  { name: "Payment Method Expiry", cadence: "Daily", module: "Payments", status: "Active" },
  { name: "License Expiry Reminder", cadence: "Daily", module: "Licenses", status: "Active" },
  { name: "Department Head Notification", cadence: "Monthly", module: "Departments", status: "Active" },
];

const securityControls = [
  "Strict transport and browser security headers are enabled in the server middleware.",
  "JWT-based auth protects platform routes and restricts global admin access.",
  "Profile security settings remain available under the user profile page.",
  "Stripe access is server-side only when billing is configured.",
];

function formatDate(raw: unknown) {
  if (!raw) return "—";
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "—";
}

function formatDateTime(raw: unknown) {
  if (!raw) return "—";
  const date = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
}

function formatMoney(value: unknown, currency = "USD") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function isAllCaps(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // If there are letters, and all of them are uppercase (ignoring non-letters), treat as all-caps.
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

  const letters = name.replace(/[^a-zA-Z]/g, "");
  const allUpper = Boolean(letters) && letters === letters.toUpperCase();
  const allLower = Boolean(letters) && letters === letters.toLowerCase();

  return allUpper || allLower ? toTitleCase(name) : name;
}

function formatPlanLabel(plan: unknown) {
  const normalized = String(plan ?? "").trim();
  if (!normalized) return "Free Plan";
  const lower = normalized.toLowerCase();
  if (lower === "pro") return "Professional";
  return lower
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isPaidPlan(plan: unknown) {
  const lower = String(plan ?? "").trim().toLowerCase();
  return ["starter", "professional", "pro", "business", "enterprise"].includes(lower);
}

function formatRenewalDate(company: PlatformCompany) {
  // Free users should show blank renewal; paid users show the date when available.
  const paid = isPaidPlan(company.plan) || Boolean(company.subscriptionCurrentPeriodEnd);
  if (!paid) return "";
  return formatDate(company.subscriptionCurrentPeriodEnd);
}

function billingCompanyLabel(row: {
  companyName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
}) {
  const companyName = String(row.companyName || "").trim();
  if (companyName) return formatCompanyName(companyName);

  const customerName = String(row.customerName || "").trim();
  if (customerName && customerName.toLowerCase() !== "stripe customer") {
    return formatCompanyName(customerName);
  }

  const email = String(row.customerEmail || "").trim();
  if (email) return "Unlinked";
  return "—";
}

function billingDateLabel(row: { paidAt?: unknown; createdAt?: unknown }) {
  return formatDateTime(row.paidAt || row.createdAt);
}

function invoiceDisplayLabel(row: { invoiceNumber?: string | null; invoiceReference?: string | null }) {
  const raw = String(row.invoiceNumber || row.invoiceReference || "").trim();
  if (!raw) return "Invoice";
  return raw;
}

function formatStripeIdShort(raw: unknown) {
  const id = String(raw || "").trim();
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function activityLabel(item: PlatformActivityItem) {
  return item.description || item.message || item.action || item.type || item.subscriptionName || item.serviceName || "Activity";
}

function statusBadgeClass(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "active", "trialing", "success"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["failed", "expired", "uncollectible", "past_due", "canceled", "void"].includes(normalized)) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function MetricCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-gray-900">
      <CardHeader className="pb-2">
        <CardDescription className="text-gray-600">{title}</CardDescription>
        <CardTitle className="text-2xl text-gray-900">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-gray-500 leading-6">{detail}</CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="rounded-xl border-dashed border-gray-300 bg-gray-50 shadow-none">
      <CardContent className="pt-6">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="mt-1 text-sm text-gray-500 leading-6">{description}</div>
      </CardContent>
    </Card>
  );
}

export default function PlatformSectionPage() {
  const location = useLocation();
  const section = findPlatformSection(location.pathname);
  const item = findPlatformItem(location.pathname);

  const isUsersSection = section?.id === "users";
  const isBillingSection = section?.id === "billing" || section?.id === "plans" || section?.id === "settings" || item?.id === "system-health";
  const isPlatformSettingsSection = item?.id === "platform-settings";
  const isSecurityControlPanel = item?.id === "security";
  const needsPlatformSettings = Boolean(isPlatformSettingsSection || isSecurityControlPanel);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ["/api/platform/stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/stats");
      if (!res.ok) throw new Error("Failed to fetch platform stats");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: companies = [] } = useQuery<PlatformCompany[]>({
    queryKey: ["/api/platform/companies"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: activity = [] } = useQuery<PlatformActivityItem[]>({
    queryKey: ["/api/platform/activity"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/activity");
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: monitoring } = useQuery<PlatformMonitoring>({
    queryKey: ["/api/platform/monitoring"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/monitoring");
      if (!res.ok) throw new Error("Failed to fetch monitoring");
      return res.json();
    },
    enabled: item?.id === "system-health",
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: platformSettings, isLoading: platformSettingsLoading } = useQuery<PlatformSettings>({
    queryKey: ["/api/platform/settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/settings");
      if (!res.ok) throw new Error("Failed to fetch platform settings");
      return res.json();
    },
    enabled: needsPlatformSettings,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: platformSessions } = useQuery<AuthSessionsResponse>({
    queryKey: ["/api/platform/security/sessions"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/security/sessions?limit=200");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: isSecurityControlPanel,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: webhookEvents } = useQuery<StripeWebhookEventsResponse>({
    queryKey: ["/api/platform/stripe/webhook-events"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/stripe/webhook-events?limit=200");
      if (!res.ok) throw new Error("Failed to fetch webhook events");
      return res.json();
    },
    enabled: isSecurityControlPanel,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: auditEvents } = useQuery<SecurityAuditEventsResponse>({
    queryKey: ["/api/platform/security/audit-events"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/security/audit-events?limit=200");
      if (!res.ok) throw new Error("Failed to fetch audit events");
      return res.json();
    },
    enabled: isSecurityControlPanel,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: errorLogs } = useQuery<ErrorLogsResponse>({
    queryKey: ["/api/platform/error-logs"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/error-logs?limit=200");
      if (!res.ok) throw new Error("Failed to fetch error logs");
      return res.json();
    },
    enabled: isSecurityControlPanel,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: jobRuns } = useQuery<JobRunsResponse>({
    queryKey: ["/api/platform/job-runs"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/job-runs?limit=100");
      if (!res.ok) throw new Error("Failed to fetch job runs");
      return res.json();
    },
    enabled: isSecurityControlPanel,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const revokeUserSessionsMutation = useMutation({
    mutationFn: async (payload: { userId?: string; email?: string }) => {
      const res = await apiFetch("/api/platform/security/sessions/logout-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to revoke sessions");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/security/sessions"] });
      toast({
        title: "Sessions revoked",
        description: "All sessions for the selected user were revoked.",
        duration: 1200,
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to revoke sessions",
        variant: "destructive",
        duration: 1500,
      });
    },
  });

  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    if (!needsPlatformSettings) return;
    if (!platformSettings) return;
    setSettingsDraft(platformSettings);
  }, [platformSettings, needsPlatformSettings]);

  const savePlatformSettingsMutation = useMutation({
    mutationFn: async (payload: {
      billing: PlatformSettings["billing"];
      tenantOnboarding: PlatformSettings["tenantOnboarding"];
      notifications: PlatformSettings["notifications"];
      security: PlatformSettings["security"];
      support: PlatformSettings["support"];
    }) => {
      const res = await apiFetch("/api/platform/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const contentType = String(res.headers.get("content-type") || "");
        if (contentType.includes("application/json")) {
          const data = await res.json().catch(() => null);
          const msg = String((data as any)?.message || "").trim();
          const details = String((data as any)?.details || "").trim();
          throw new Error(details || msg || "Failed to save platform settings");
        }

        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to save platform settings");
      }
      return res.json();
    },
    onSuccess: (next: PlatformSettings) => {
      queryClient.setQueryData(["/api/platform/settings"], next);
      setSettingsDraft(next);
      toast({
        title: "Saved",
        description: "Platform settings updated.",
        duration: 1200,
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to save platform settings",
        variant: "destructive",
        duration: 1500,
      });
    },
  });

  const { data: users = [] } = useQuery<PlatformUser[]>({
    queryKey: ["/api/platform/users"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: isUsersSection,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();

    return users.filter((user) => {
      const status = String(user.status || "").trim().toLowerCase();
      if (userStatusFilter !== "all") {
        if (userStatusFilter === "active" && status !== "active") return false;
        if (userStatusFilter === "inactive" && status !== "inactive") return false;
      }

      if (!query) return true;

      const email = String(user.email || "").toLowerCase();
      const name = String(user.fullName || "").toLowerCase();
      const company = String(user.companyName || "").toLowerCase();
      const companies = (user.companyNames || []).join(" ").toLowerCase();

      return email.includes(query) || name.includes(query) || company.includes(query) || companies.includes(query);
    });
  }, [users, userSearch, userStatusFilter]);

  const {
    data: billing,
    isLoading: billingLoading,
    error: billingError,
  } = useQuery<BillingResponse>({
    queryKey: ["/api/platform/billing"],
    queryFn: async () => {
      const res = await apiFetch("/api/platform/billing");
      if (!res.ok) throw new Error("Failed to fetch billing");
      return res.json();
    },
    enabled: Boolean(isBillingSection),
    retry: 2,
    refetchOnWindowFocus: false,
  });

  if (!section || !item) {
    return <Navigate to="/platform-admin" replace />;
  }

  const tenantUsage = companies.reduce((total, company) => total + Number(company.users || 0), 0);
  const averageUsersPerTenant = companies.length ? (tenantUsage / companies.length).toFixed(1) : "0.0";
  const planCounts = (billing?.linkedAccounts || []).reduce<Record<string, number>>((acc, row) => {
    const key = String(row.plan || "unknown").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const renderTableShell = (title: string, description: string, content: React.ReactNode) => (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 text-lg">{title}</CardTitle>
        <CardDescription className="text-gray-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">{content}</CardContent>
    </Card>
  );

  const renderContent = () => {
    switch (item.id) {
      case "dashboard":
      case "analytics":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Companies" value={String(companies.length)} detail="Tenant organizations currently visible to the platform admin." />
              <MetricCard title="Users" value={String(tenantUsage)} detail="Total users across tenant organizations." />
              <MetricCard title="Estimated MRR" value={formatMoney(stats?.mrr ?? 0)} detail="Derived from active tenant subscription records." />
            </div>
            {renderTableShell(
              "Top Tenant Usage",
              "Largest organizations by active user count.",
              <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.slice(0, 8).map((company) => (
                      <TableRow key={company.tenantId}>
                        <TableCell className="font-medium text-indigo-900">{formatCompanyName(company.companyName)}</TableCell>
                        <TableCell className="text-indigo-800">{formatPlanLabel(company.plan)}</TableCell>
                        <TableCell className="text-right text-indigo-800">{company.users}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusBadgeClass(company.status || "active")}>
                            {String(company.status || "active").toLowerCase() === "active" ? "Active" : String(company.status || "").replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      case "system-health": {
        const mongoStatus = monitoring?.mongo?.status;
        const mongoLabel = mongoStatus === "connected" ? "Connected" : mongoStatus === "slow" ? "Slow" : mongoStatus === "down" ? "Down" : "—";
        const mongoDetail = monitoring?.mongo
          ? `Last ${monitoring.mongo.windowMinutes ?? 5}m: ping ${monitoring.mongo.latencyMs ?? "—"}ms · p95 ${monitoring.mongo.p95LatencyMs ?? "—"}ms · failures ${monitoring.mongo.failureCount ?? 0}/${monitoring.mongo.samples ?? 0} (${monitoring.mongo.failureRatePct ?? "—"}%).`
          : "MongoDB health telemetry is not available yet.";

        const apiAvg = monitoring?.api?.avgResponseMs;
        const apiP95 = monitoring?.api?.p95ResponseMs;
        const apiError = monitoring?.api?.errorRatePct;
        const apiSamples = monitoring?.api?.samples;

        const apiLabel = typeof apiAvg === "number" ? `${apiAvg}ms avg` : "—";
        const apiDetail = monitoring?.api
          ? `Last ${monitoring.api.windowMinutes}m: p95 ${apiP95 ?? "—"}ms · error rate ${apiError ?? "—"}% · samples ${apiSamples ?? 0}.`
          : "API performance telemetry is not available yet.";

        const jobsFailed = monitoring?.jobs?.failedLast24h;
        const jobsLabel = typeof jobsFailed === "number" ? String(jobsFailed) : "—";

        const audit24h = monitoring?.audit?.eventsLast24h;
        const auditLabel = typeof audit24h === "number" ? String(audit24h) : String(activity.length);

        const tenantAudit24h = monitoring?.tenantActivity?.eventsLast24h;

        const lastTenantRaw = monitoring?.tenantActivity?.lastEventAt ?? null;
        const lastTenant = lastTenantRaw ? new Date(String(lastTenantRaw)) : null;
        const lastTenantOk = lastTenant && Number.isFinite(lastTenant.getTime()) ? lastTenant : null;

        const hoursSinceLastTenant = lastTenantOk ? (Date.now() - lastTenantOk.getTime()) / (60 * 60 * 1000) : null;
        const tenantActivityOk = typeof hoursSinceLastTenant === "number" ? hoursSinceLastTenant < 24 : activity.length > 0;

        const daysSinceLastTenant = typeof hoursSinceLastTenant === "number" ? Math.floor(hoursSinceLastTenant / 24) : null;
        const staleLabel = typeof daysSinceLastTenant === "number" && daysSinceLastTenant >= 1
          ? `No tenant activity in last ${daysSinceLastTenant} day(s).`
          : `No tenant activity in last ${typeof hoursSinceLastTenant === "number" ? Math.floor(hoursSinceLastTenant) : "—"}h.`;

        const tenantActivityReason = typeof hoursSinceLastTenant === "number"
          ? (tenantActivityOk ? `Last tenant activity ${hoursSinceLastTenant.toFixed(1)}h ago.` : staleLabel)
          : (activity.length > 0 ? "Tenant activity events are present." : "No tenant activity events were returned in the last 7 days.");

        const apiOk = typeof apiError === "number" ? apiError <= 1 : true;
        const apiReason = typeof apiError === "number" ? `Error rate ${apiError}%.` : "API error-rate telemetry not available.";

        const dbOk = mongoStatus ? mongoStatus === "connected" : true;
        const dbReason = mongoStatus === "slow" ? "MongoDB is responding slowly." : mongoStatus === "down" ? "MongoDB ping failed." : "MongoDB reachable.";

        const jobsOk = typeof jobsFailed === "number" ? jobsFailed === 0 : true;
        const jobsReason = typeof jobsFailed === "number"
          ? (jobsFailed === 0 ? "No failed jobs in last 24h." : `${jobsFailed} failed job(s) in last 24h.`)
          : "Job telemetry not available.";

        const auditOk = typeof audit24h === "number" ? audit24h > 0 : activity.length > 0;
        const auditReason = typeof audit24h === "number"
          ? (audit24h > 0 ? `${audit24h} audit event(s) in last 24h.` : "No audit events in last 24h.")
          : (activity.length > 0 ? "Audit activity events are present." : "No audit events were returned in the last 7 days.");

        const tenantActivityLabel =
          typeof hoursSinceLastTenant === "number"
            ? (hoursSinceLastTenant >= 48
              ? `${Math.floor(hoursSinceLastTenant / 24)}d ago`
              : `${hoursSinceLastTenant.toFixed(1)}h ago`)
            : "—";
        const tenantActivityDetail = typeof tenantAudit24h === "number"
          ? `${tenantAudit24h} tenant event(s) in last 24h.`
          : "Tenant activity telemetry not available.";

        type AlertRow = {
          id?: string;
          title: string;
          severity: "critical" | "warning" | "info";
          detail: string;
          service?: string;
          suggestedAction?: string;
          detectedAt?: string | Date;
        };

        const computedAlerts: AlertRow[] = [];

        if (!billing?.configured) {
          computedAlerts.push({
            title: "Stripe is not configured",
            severity: "warning",
            detail: "Billing APIs are enabled, but Stripe credentials are missing.",
            service: "stripe",
            suggestedAction: "Set STRIPE_SECRET_KEY in the server environment.",
            detectedAt: new Date(),
          });
        }

        if (mongoStatus === "down") {
          computedAlerts.push({
            title: "MongoDB is down",
            severity: "critical",
            detail: "Database ping failed. Platform data may be stale or unavailable.",
            service: "mongodb",
            suggestedAction: "Check MongoDB connectivity and MONGODB_URI configuration.",
            detectedAt: new Date(),
          });
        } else if (mongoStatus === "slow") {
          computedAlerts.push({
            title: "MongoDB is slow",
            severity: "warning",
            detail: `Ping latency is ${monitoring?.mongo?.latencyMs ?? "—"}ms.`,
            service: "mongodb",
            suggestedAction: "Investigate DB load, indexes, and slow queries.",
            detectedAt: new Date(),
          });
        }

        if (typeof apiP95 === "number" && apiP95 > 1500) {
          computedAlerts.push({
            title: "API p95 latency is high",
            severity: "warning",
            detail: `p95 is ${apiP95}ms over the last ${monitoring?.api?.windowMinutes ?? 5} minutes.`,
            service: "api",
            suggestedAction: "Identify slow endpoints and optimize queries/caching.",
            detectedAt: new Date(),
          });
        }

        if (typeof apiError === "number" && apiError > 1) {
          computedAlerts.push({
            title: "API error rate elevated",
            severity: apiError > 5 ? "critical" : "warning",
            detail: `Error rate is ${apiError}% over the last ${monitoring?.api?.windowMinutes ?? 5} minutes.`,
            service: "api",
            suggestedAction: "Inspect server logs for 5xx errors and fix the failing route(s).",
            detectedAt: new Date(),
          });
        }

        if (typeof jobsFailed === "number" && jobsFailed > 0) {
          computedAlerts.push({
            title: "Scheduled jobs are failing",
            severity: "critical",
            detail: `${jobsFailed} failed job(s) recorded in the last 24 hours.`,
            service: "jobs",
            suggestedAction: "Review scheduler logs and job failure stack traces.",
            detectedAt: new Date(),
          });
        }

        if (typeof audit24h === "number" && audit24h === 0) {
          computedAlerts.push({
            title: "Audit stream is empty",
            severity: "warning",
            detail: "No audit events were recorded in the last 24 hours.",
            service: "audit",
            suggestedAction: "Verify audit writes are working and confirm DB connectivity.",
            detectedAt: new Date(),
          });
        }

        if (typeof hoursSinceLastTenant === "number" && hoursSinceLastTenant > 24) {
          const days = Math.floor(hoursSinceLastTenant / 24);
          computedAlerts.push({
            title: "Tenant activity is stale",
            severity: hoursSinceLastTenant > 168 ? "critical" : "warning",
            detail: days >= 1 ? `No tenant activity in last ${days} day(s).` : `No tenant activity in last ${Math.floor(hoursSinceLastTenant)}h.`,
            service: "tenant-activity",
            suggestedAction: "Check user adoption, auth flows, and activity/audit logging.",
            detectedAt: new Date(),
          });
        }

        const alerts: AlertRow[] = Array.isArray(monitoring?.alerts) && monitoring.alerts.length
          ? (monitoring.alerts as any)
          : computedAlerts;

        const signals = [
          { label: "Stripe Billing", ok: Boolean(billing?.configured), reason: billing?.configured ? "Stripe is configured." : "Stripe billing is not configured." },
          { label: "Database Health", ok: dbOk, reason: dbReason },
          { label: "API Health", ok: apiOk, reason: apiReason },
          { label: "Failed Jobs", ok: jobsOk, reason: jobsReason },
          { label: "Audit Stream", ok: auditOk, reason: auditReason },
          { label: "Tenant Activity Feed", ok: tenantActivityOk, reason: tenantActivityReason },
          { label: "Company Catalog", ok: companies.length > 0, reason: companies.length > 0 ? "Company directory is available." : "No companies are visible to the platform admin." },
          { label: "Scheduler Definitions", ok: schedulerJobs.length > 0, reason: schedulerJobs.length > 0 ? "Scheduler list is defined." : "No scheduler definitions found." },
        ];

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Stripe" value={billing?.configured ? "Connected" : "Not Configured"} detail="Billing data is sourced from the configured Stripe account." />
              <MetricCard title="MongoDB" value={mongoLabel} detail={mongoDetail} />
              <MetricCard title="API" value={apiLabel} detail={apiDetail} />
              <MetricCard title="Failed Jobs (24h)" value={jobsLabel} detail="Scheduled job failures recorded during the last 24 hours." />
              <MetricCard title="Audit Events (24h)" value={auditLabel} detail="Audit/log entries created during the last 24 hours." />
              <MetricCard title="Tenant Activity" value={tenantActivityLabel} detail={tenantActivityDetail} />
              <MetricCard title="Schedulers" value={String(schedulerJobs.length)} detail="Background jobs currently expected in the server runtime." />
            </div>

            {renderTableShell(
              "Alerts",
              "Auto-generated alerts based on telemetry and activity gaps.",
              alerts.length ? (
                <div className="space-y-3">
                  {alerts.map((alert) => {
                    const detected = alert.detectedAt ? new Date(String(alert.detectedAt)) : null;
                    const detectedOk = detected && Number.isFinite(detected.getTime()) ? detected : null;
                    const detectedLabel = detectedOk ? detectedOk.toLocaleString() : "—";
                    const serviceLabel = alert.service ? String(alert.service).replace(/-/g, " ") : "—";

                    return (
                      <div key={`${alert.id ?? "alert"}:${alert.severity}:${alert.title}`} className="rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-indigo-900">{alert.title}</div>
                            <div className="mt-1 text-xs text-indigo-700/80">{alert.detail}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-indigo-700/70">
                              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">{serviceLabel}</Badge>
                              <span>Detected: {detectedLabel}</span>
                            </div>
                            {alert.suggestedAction ? (
                              <div className="mt-2 text-xs text-indigo-700/80">
                                <span className="font-medium">Suggested action:</span> {alert.suggestedAction}
                              </div>
                            ) : null}
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              alert.severity === "critical"
                                ? "bg-rose-100 text-rose-700 border-rose-200"
                                : alert.severity === "warning"
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-indigo-100 text-indigo-700 border-indigo-200"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-3 text-sm text-indigo-700">No active alerts.</div>
              )
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {renderTableShell(
                "Service Checklist",
                "Operational signals worth checking during admin reviews.",
                <div className="space-y-3">
                  {signals.map((signal) => (
                    <div key={signal.label} className="rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-indigo-900">{signal.label}</div>
                          {!signal.ok ? <div className="mt-1 text-xs text-rose-700/90">{signal.reason}</div> : <div className="mt-1 text-xs text-indigo-700/70">{signal.reason}</div>}
                        </div>
                        <span className="flex items-center gap-2 text-sm text-indigo-700 whitespace-nowrap">
                          {signal.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                          {signal.ok ? "Healthy" : "Attention"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {renderTableShell(
                "Scheduler Coverage",
                "Jobs that support reminders, renewals, licenses, and billing checks.",
                <div className="space-y-3">
                  {schedulerJobs.map((job) => (
                    <div key={job.name} className="rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-indigo-900">{job.name}</span>
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">{job.cadence}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-indigo-700/80">{job.module}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }
      case "organizations":
      case "tenant-usage":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Organizations" value={String(companies.length)} detail="Tenant companies currently visible to the platform admin." />
              <MetricCard title="Tenant Users" value={String(tenantUsage)} detail="Total users across all listed tenant accounts." />
              <MetricCard title="Average Usage" value={averageUsersPerTenant} detail="Average user count per tenant company." />
            </div>
            {renderTableShell(
              item.id === "organizations" ? "Organizations" : "Tenant Usage",
              item.id === "organizations"
                ? "Manage and review all tenant companies."
                : "Read user counts, plans, and renewal windows by tenant.",
              <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Renewal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.tenantId}>
                        <TableCell className="font-medium text-indigo-900">{formatCompanyName(company.companyName)}</TableCell>
                        <TableCell className="text-indigo-800">{formatDate(company.createdAt)}</TableCell>
                        <TableCell className="text-indigo-800">{formatPlanLabel(company.plan)}</TableCell>
                        <TableCell className="text-right text-indigo-800">{company.users}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusBadgeClass(company.status || "active")}>
                            {String(company.status || "active").toLowerCase() === "active" ? "Active" : String(company.status || "").replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-indigo-800">{formatRenewalDate(company)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      case "plans-overview":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard title="Linked Accounts" value={String(billing?.summary.linkedAccounts ?? 0)} detail="Users with Stripe-linked billing metadata." />
              <MetricCard title="Active Plans" value={String(billing?.summary.activePlans ?? 0)} detail="Accounts on active paid plans." />
              <MetricCard title="Expired Plans" value={String(billing?.summary.expiredPlans ?? 0)} detail="Accounts that require billing attention." />
              <MetricCard title="Stripe Subscriptions" value={String(billing?.summary.activeStripeSubscriptions ?? 0)} detail="Live subscriptions returned by Stripe." />
            </div>
            {Object.keys(planCounts).length === 0 ? (
              <EmptyState title="No plan data yet" description="Once tenant accounts are linked to Stripe-backed plans, this section will show plan distribution and subscription coverage." />
            ) : (
              renderTableShell(
                "Plan Mix",
                "Current billing plan distribution across linked accounts.",
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(planCounts).map(([plan, count]) => (
                    <div key={plan} className="rounded-lg border border-indigo-200/50 bg-white/70 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-medium capitalize text-indigo-900">{plan.replace(/_/g, " ")}</span>
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">{count}</Badge>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        );
      case "stripe-subscriptions":
        if (billingError) {
          return (
            <EmptyState
              title="Billing data unavailable"
              description={`The billing API call failed. ${String((billingError as any)?.message || billingError)}`}
            />
          );
        }
        return renderTableShell(
          "Stripe Subscriptions",
          "Core SaaS plan and subscription mapping for global admin review.",
          billing?.subscriptions?.length ? (
            <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current Period End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.subscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium text-indigo-900">{billingCompanyLabel(subscription)}</TableCell>
                      <TableCell className="text-indigo-800">{subscription.customerEmail || "—"}</TableCell>
                      <TableCell className="text-indigo-800">{subscription.planName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusBadgeClass(subscription.status)}>{subscription.status}</Badge>
                      </TableCell>
                      <TableCell className="text-indigo-800">{formatDate(subscription.currentPeriodEnd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No Stripe subscriptions returned" description="This page will populate once the configured Stripe account has active subscriptions available to list." />
          )
        );
      case "billing-overview":
        return (
          <div className="space-y-6">
            {billingError ? (
              <EmptyState
                title="Billing data unavailable"
                description={`The billing API call failed. ${String((billingError as any)?.message || billingError)}`}
              />
            ) : null}

            {billingLoading && !billing ? (
              <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-800">
                Loading Stripe billing data… first load can take a few seconds.
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard
                title="Stripe Subscriptions"
                value={billingLoading && !billing ? "—" : String(billing?.summary.activeStripeSubscriptions ?? 0)}
                detail="Live subscriptions returned by Stripe."
              />
              <MetricCard
                title="Stripe MRR"
                value={billingLoading && !billing ? "—" : formatMoney(billing?.summary.mrr ?? 0)}
                detail="Monthly recurring revenue from active subscriptions."
              />
              <MetricCard
                title="Month Collected"
                value={billingLoading && !billing ? "—" : formatMoney(billing?.summary.monthlyCollected ?? 0)}
                detail="Paid invoices created during the current month."
              />
              <MetricCard
                title="Total Revenue"
                value={billingLoading && !billing ? "—" : formatMoney(billing?.summary.totalRevenue ?? 0)}
                detail="Total revenue represented by paid Stripe invoices."
              />
            </div>
            {renderTableShell(
              "Recent Payments",
              "Latest successful/failed charges coming from Stripe.",
              billing?.payments?.length ? (
                <div className="space-y-3">
                  {(() => {
                    const seen = new Set<string>();
                    const items: typeof billing.payments = [];
                    for (const payment of billing.payments) {
                      const key = payment.companyName
                        ? `company:${payment.companyName}`
                        : payment.customerEmail
                          ? `email:${payment.customerEmail}`
                          : `id:${payment.id}`;
                      if (seen.has(key)) continue;
                      seen.add(key);
                      items.push(payment);
                      if (items.length >= 6) break;
                    }

                    return items.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-lg border border-indigo-200/50 bg-white/70 px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-indigo-900 truncate">{billingCompanyLabel(payment)}</div>
                          <div className="text-xs text-indigo-700/70 truncate">{payment.customerEmail || "—"}</div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-indigo-700/60">
                            <span title={payment.invoiceNumber || payment.invoiceReference || payment.id}>
                              {payment.invoiceUrl ? (
                                <a
                                  className="text-indigo-700 underline"
                                  href={payment.invoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {invoiceDisplayLabel(payment)}
                                </a>
                              ) : (
                                <span>{invoiceDisplayLabel(payment)}</span>
                              )}
                            </span>
                            <span>Charged: {billingDateLabel(payment)}</span>
                            <span>{String(payment.currency || "").toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="text-sm text-indigo-800 whitespace-nowrap tabular-nums">
                          {formatMoney(payment.amount, payment.currency)}
                        </div>
                        <Badge variant="secondary" className={statusBadgeClass(payment.status)}>{payment.status}</Badge>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <EmptyState title="No payments yet" description="Once Stripe creates and finalizes invoices, recent charge outcomes will appear here." />
              )
            )}
          </div>
        );
      case "payments":
        if (billingError) {
          return (
            <EmptyState
              title="Billing data unavailable"
              description={`The billing API call failed. ${String((billingError as any)?.message || billingError)}`}
            />
          );
        }
        return renderTableShell(
          "Payments",
          "Subscription charges and payment outcomes sourced from Stripe invoices.",
          billing?.payments?.length ? (
            <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium text-indigo-900">{billingCompanyLabel(payment)}</TableCell>
                      <TableCell className="text-indigo-800">{payment.customerEmail || "—"}</TableCell>
                      <TableCell className="text-indigo-800">{formatMoney(payment.amount, payment.currency)}</TableCell>
                      <TableCell className="text-indigo-800">{String(payment.currency || "").toUpperCase()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusBadgeClass(payment.status)}>{payment.status}</Badge>
                      </TableCell>
                      <TableCell className="text-indigo-800">{billingDateLabel(payment)}</TableCell>
                      <TableCell className="text-indigo-800" title={payment.invoiceNumber || payment.invoiceReference || payment.id}>
                        {payment.invoiceUrl ? (
                          <a
                            className="text-indigo-700 underline"
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={payment.invoiceNumber || payment.invoiceReference || payment.id}
                          >
                            {invoiceDisplayLabel(payment)}
                          </a>
                        ) : (
                          <span title={payment.invoiceNumber || payment.invoiceReference || payment.id}>
                            {invoiceDisplayLabel(payment)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No payments available" description="Stripe payment history will appear here after the first successful or failed charge events are available." />
          )
        );
      case "invoices":
        if (billingError) {
          return (
            <EmptyState
              title="Billing data unavailable"
              description={`The billing API call failed. ${String((billingError as any)?.message || billingError)}`}
            />
          );
        }
        return renderTableShell(
          "Invoices",
          "Invoice list with payment status for the Stripe billing layer.",
          billing?.invoices?.length ? (
            <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="text-indigo-800" title={invoice.invoiceNumber || invoice.invoiceReference || invoice.id}>
                        {invoice.invoiceUrl ? (
                          <a
                            className="text-indigo-700 underline"
                            href={invoice.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={invoice.invoiceNumber || invoice.invoiceReference || invoice.id}
                          >
                            {invoiceDisplayLabel(invoice)}
                          </a>
                        ) : (
                          <span title={invoice.invoiceNumber || invoice.invoiceReference || invoice.id}>
                            {invoiceDisplayLabel(invoice)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-indigo-900">{billingCompanyLabel(invoice)}</TableCell>
                      <TableCell className="text-indigo-800">{invoice.customerEmail || "—"}</TableCell>
                      <TableCell className="text-indigo-800">{formatMoney(invoice.amount, invoice.currency)}</TableCell>
                      <TableCell className="text-indigo-800">{String(invoice.currency || "").toUpperCase()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusBadgeClass(invoice.status)}>{invoice.status}</Badge>
                      </TableCell>
                      <TableCell className="text-indigo-800">{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell className="text-indigo-800">{formatDateTime(invoice.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No invoices available" description="Invoices will populate once the connected Stripe account has billing activity to display." />
          )
        );
      case "all-users": {
        const roleBadge = (raw: unknown) => {
          const role = String(raw || "viewer").trim().toLowerCase();
          const base = "border";
          if (role === "super_admin") return <Badge variant="secondary" className={`${base} bg-red-50 text-red-700 border-red-200`}>Super Admin</Badge>;
          if (role === "admin") return <Badge variant="secondary" className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>Admin</Badge>;
          if (role === "viewer") return <Badge variant="secondary" className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Viewer</Badge>;
          if (role === "contributor") return <Badge variant="secondary" className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>Contributor</Badge>;
          if (role === "department_editor") return <Badge variant="secondary" className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>Department Editor</Badge>;
          if (role === "department_viewer") return <Badge variant="secondary" className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>Department Viewer</Badge>;
          return <Badge variant="secondary" className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>{role.replace(/_/g, " ")}</Badge>;
        };

        return renderTableShell(
          "All Users",
          "Authenticated tenant users across all companies.",
          users.length ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by email, user, or company"
                    className="w-full rounded-lg border border-indigo-200/50 bg-white px-3 py-2 text-sm text-indigo-900 placeholder:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value as any)}
                    className="rounded-lg border border-indigo-200/50 bg-white px-3 py-2 text-sm text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <div className="text-xs text-indigo-700/70 whitespace-nowrap">
                    {filteredUsers.length} / {users.length}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const isUnlinked = !user.tenantId;
                      const primaryCompanyNameRaw = user.companyName ? formatCompanyName(user.companyName) : "";
                      const primaryCompanyName = primaryCompanyNameRaw === "Unnamed Company" ? "" : primaryCompanyNameRaw;

                      const companies = Array.from(new Set((user.companyNames || [])
                        .map((c) => String(c || "").trim())
                        .filter((c) => Boolean(c) && c !== "Unnamed Company")))
                        .map(formatCompanyName);
                      const hasCompanyConflict = companies.length > 1;
                      const companyTitle = companies.join("\n");

                      return (
                        <TableRow key={user.userId || user.email}>
                          <TableCell>
                            <div className="font-medium text-indigo-900">{user.fullName || user.email}</div>
                            <div className="text-xs text-indigo-700/70">{user.email}</div>
                          </TableCell>
                          <TableCell className="text-indigo-800" title={companyTitle}>
                            {isUnlinked ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">No Company Assigned</Badge>
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <div className="font-medium text-indigo-900">{primaryCompanyName || "No Company Assigned"}</div>
                                {hasCompanyConflict ? (
                                  <div className="text-xs text-amber-700/80 truncate">
                                    Also appears in: {companies.join(", ")}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-indigo-800">{roleBadge(user.role)}</TableCell>
                          <TableCell className="text-indigo-800 capitalize">{user.status || "—"}</TableCell>
                          <TableCell className="text-indigo-800">
                            {user.lastLogin ? formatDateTime(user.lastLogin) : <span className="text-indigo-700/70">Never Logged In</span>}
                          </TableCell>
                          <TableCell className="text-indigo-800">{formatDate(user.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <EmptyState title="No users returned" description="This view will list tenant-authenticated users once the platform user endpoint returns data." />
          )
        );
      }
      case "notification-logs":
      case "audit-logs":
        return renderTableShell(
          item.id === "notification-logs" ? "Notification Logs" : "Audit Logs",
          item.id === "notification-logs"
            ? "Recent activity events that help support reminder and notification reviews."
            : "Latest platform-wide audit history entries.",
          activity.length ? (
            <div className="space-y-3">
              {activity.map((entry, index) => (
                <div key={entry._id || `${entry.tenantId}-${index}`} className="rounded-lg border border-indigo-200/50 bg-white/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-indigo-900 truncate">{activityLabel(entry)}</div>
                      <div className="text-xs text-indigo-700/70 mt-1">{entry.companyName || "Platform"}</div>
                    </div>
                    <div className="text-xs text-indigo-700/70 flex-shrink-0">{formatDateTime(entry.timestamp || entry.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No recent activity" description="Platform audit and notification logs will appear here when history records are available." />
          )
        );
      case "reminder-rules":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schedulerJobs.slice(0, 4).map((job) => (
              <Card key={job.name} className="border-indigo-200/60 bg-white/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-indigo-900">{job.name}</CardTitle>
                  <CardDescription className="text-indigo-700/80">{job.module}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-indigo-800">
                  Runs on a {job.cadence.toLowerCase()} cadence and supports reminder delivery in the current platform workflow.
                </CardContent>
              </Card>
            ))}
          </div>
        );
      case "scheduler-jobs":
        return renderTableShell(
          "Scheduler Jobs",
          "Server-side jobs currently expected to power reminders, renewals, billing checks, and license alerts.",
          <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulerJobs.map((job) => (
                  <TableRow key={job.name}>
                    <TableCell className="font-medium text-indigo-900">{job.name}</TableCell>
                    <TableCell className="text-indigo-800">{job.module}</TableCell>
                    <TableCell className="text-indigo-800">{job.cadence}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">{job.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      case "system-logs":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-indigo-200/60 bg-white/80">
              <CardHeader>
                <CardTitle className="text-lg text-indigo-900">Operational Signals</CardTitle>
                <CardDescription className="text-indigo-700/80">Read-only checks derived from current platform capabilities.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {[
                  { label: "Platform stats endpoint", ok: typeof stats?.totalCompanies === "number" },
                  { label: "Company directory", ok: companies.length > 0 },
                  { label: "Activity feed", ok: Array.isArray(activity) },
                  { label: "Stripe billing endpoint", ok: typeof billing?.configured === "boolean" },
                ].map((signal) => (
                  <div key={signal.label} className="flex items-center justify-between rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <span className="text-sm text-indigo-900">{signal.label}</span>
                    {signal.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-amber-600" />}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-indigo-200/60 bg-white/80">
              <CardHeader>
                <CardTitle className="text-lg text-indigo-900">Platform Notes</CardTitle>
                <CardDescription className="text-indigo-700/80">Current runtime visibility available to the global admin UI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm text-indigo-800">
                <div>System logs are not centralized into a dedicated collection yet, so this page surfaces operational checks instead of raw server output.</div>
                <div>Scheduler coverage, billing configuration, and audit activity are available now and give the admin a practical monitoring baseline.</div>
              </CardContent>
            </Card>
          </div>
        );
      case "error-logs":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-indigo-200/60 bg-white/80">
              <CardHeader>
                <CardTitle className="text-lg text-indigo-900">Error Monitoring</CardTitle>
                <CardDescription className="text-indigo-700/80">Current error visibility posture for the platform.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-sm text-indigo-800">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">No centralized error log stream is exposed to the admin UI yet.</div>
                <div>Recommended next additions: Stripe webhook event logs, failed payment tracking, and a server error collection or external sink.</div>
              </CardContent>
            </Card>
            {renderTableShell(
              "Recent Activity Context",
              "Use the latest activity stream as a temporary operational cross-check.",
              activity.length ? (
                <div className="space-y-3">
                  {activity.slice(0, 5).map((entry, index) => (
                    <div key={entry._id || `${entry.tenantId}-${index}`} className="rounded-lg border border-indigo-200/50 bg-white/70 px-4 py-3 text-sm text-indigo-900">
                      {activityLabel(entry)}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No context available" description="Once activity is present, it can help narrow operational issues while a dedicated error sink is added." />
              )
            )}
          </div>
        );
      case "support-subscriptions":
      case "support-licenses":
      case "support-compliance":
      case "support-documents":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-indigo-200/60 bg-white/80">
              <CardHeader>
                <CardTitle className="text-lg text-indigo-900">Read-Only Support View</CardTitle>
                <CardDescription className="text-indigo-700/80">Global admin support access should remain observational and non-destructive.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-indigo-800">
                This section is positioned for support workflows so admins can inspect tenant data patterns without mixing billing, operational, and tenant-side controls.
              </CardContent>
            </Card>
            <Card className="border-indigo-200/60 bg-white/80">
              <CardHeader>
                <CardTitle className="text-lg text-indigo-900">Current Coverage</CardTitle>
                <CardDescription className="text-indigo-700/80">Signals already available in the project.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                  <span className="text-sm text-indigo-900">Companies</span>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">{companies.length}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                  <span className="text-sm text-indigo-900">Recent Activity</span>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">{activity.length}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                  <span className="text-sm text-indigo-900">Stripe Billing Linked</span>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">{billing?.configured ? "Yes" : "No"}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case "platform-settings": {
        const draft = settingsDraft;
        const baseline = platformSettings;

        const comparable = (s: PlatformSettings | null | undefined) =>
          s
            ? JSON.stringify({
                billing: s.billing,
                tenantOnboarding: s.tenantOnboarding,
                notifications: s.notifications,
                security: s.security,
                support: s.support,
              })
            : "";

        const isDirty = Boolean(draft && baseline && comparable(draft) !== comparable(baseline));

        const normalizeReminderDays = (days: number[]) => {
          const unique = Array.from(
            new Set(
              (Array.isArray(days) ? days : [])
                .map((d) => Number(d))
                .filter((d) => Number.isFinite(d) && d >= 1 && d <= 365)
            )
          );
          unique.sort((a, b) => b - a);
          return unique.slice(0, 12);
        };

        const updateDraft = (updater: (s: PlatformSettings) => PlatformSettings) => {
          setSettingsDraft((prev) => (prev ? updater(prev) : prev));
        };

        const reminderDaysText = draft?.notifications?.reminderDays?.length
          ? draft.notifications.reminderDays.join(",")
          : "";

        if (platformSettingsLoading && !draft) {
          return <EmptyState title="Loading settings" description="Fetching platform configuration controls." />;
        }

        if (!draft) {
          return <EmptyState title="No settings available" description="Platform settings could not be loaded." />;
        }

        return (
          <div className="space-y-4">
            <Card className="border-indigo-200/60 bg-white/80">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-lg text-indigo-900">Platform Settings</CardTitle>
                    <CardDescription className="text-indigo-700/80">
                      Control panel for billing, onboarding, notifications, security, and admin policies.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-indigo-200"
                      disabled={!isDirty || savePlatformSettingsMutation.isPending}
                      onClick={() => setSettingsDraft(baseline || draft)}
                    >
                      Reset
                    </Button>
                    <Button
                      className="w-44 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
                      disabled={!isDirty || savePlatformSettingsMutation.isPending}
                      onClick={() =>
                        savePlatformSettingsMutation.mutate({
                          billing: draft.billing,
                          tenantOnboarding: draft.tenantOnboarding,
                          notifications: draft.notifications,
                          security: draft.security,
                          support: draft.support,
                        })
                      }
                    >
                      {savePlatformSettingsMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-indigo-800">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">
                    Companies: {companies.length}
                  </Badge>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">
                    Users: {tenantUsage}
                  </Badge>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">
                    Stripe configured: {billing?.configured ? "Yes" : "No"}
                  </Badge>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">
                    Updated: {draft.updatedAt ? formatDateTime(draft.updatedAt) : "—"}
                  </Badge>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200">
                    Updated by: {draft.updatedBy?.email || "—"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-indigo-200/60 bg-white/80">
                <CardHeader>
                  <CardTitle className="text-base text-indigo-900">Billing</CardTitle>
                  <CardDescription className="text-indigo-700/80">Stripe controls and default trial/currency.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Stripe</div>
                      <div className="text-xs text-indigo-700/80">Enable / disable Stripe-backed billing views.</div>
                    </div>
                    <Switch
                      checked={draft.billing.stripeEnabled}
                      onCheckedChange={(checked) => {
                        if (import.meta.env.PROD && draft.billing.stripeMode === "live" && checked === false) {
                          toast({
                            title: "Locked in production",
                            description: "Stripe cannot be disabled while billing mode is set to live.",
                            variant: "destructive",
                          });
                          return;
                        }

                        updateDraft((s) => ({ ...s, billing: { ...s.billing, stripeEnabled: checked } }));
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-indigo-900">Mode</Label>
                      <select
                        className="h-10 w-full rounded-md border border-indigo-200 bg-white px-3 text-sm text-indigo-900"
                        value={draft.billing.stripeMode}
                        onChange={(e) =>
                          updateDraft((s) => ({
                            ...s,
                            billing: { ...s.billing, stripeMode: (e.target.value as any) || "test" },
                          }))
                        }
                      >
                        <option value="test">Test</option>
                        <option value="live">Live</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-indigo-900">Default currency</Label>
                      <select
                        className="h-10 w-full rounded-md border border-indigo-200 bg-white px-3 text-sm text-indigo-900"
                        value={draft.billing.defaultCurrency}
                        onChange={(e) =>
                          updateDraft((s) => ({
                            ...s,
                            billing: { ...s.billing, defaultCurrency: (e.target.value as any) || "USD" },
                          }))
                        }
                      >
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-indigo-900">Trial period (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={String(draft.billing.trialDays ?? 0)}
                      onChange={(e) => {
                        const next = Math.max(0, Math.min(365, Number(e.target.value || 0)));
                        updateDraft((s) => ({ ...s, billing: { ...s.billing, trialDays: next } }));
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-200/60 bg-white/80">
                <CardHeader>
                  <CardTitle className="text-base text-indigo-900">Tenant Defaults</CardTitle>
                  <CardDescription className="text-indigo-700/80">Onboarding and plan defaults.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1">
                    <Label className="text-indigo-900">Default plan</Label>
                    <select
                      className="h-10 w-full rounded-md border border-indigo-200 bg-white px-3 text-sm text-indigo-900"
                      value={draft.tenantOnboarding.defaultPlan}
                      onChange={(e) =>
                        updateDraft((s) => ({
                          ...s,
                          tenantOnboarding: { ...s.tenantOnboarding, defaultPlan: (e.target.value as any) || "free" },
                        }))
                      }
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Auto-create company on signup</div>
                      <div className="text-xs text-indigo-700/80">Generate a tenant/company if the client does not supply one.</div>
                    </div>
                    <Switch
                      checked={draft.tenantOnboarding.autoCreateCompanyOnSignup}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          tenantOnboarding: { ...s.tenantOnboarding, autoCreateCompanyOnSignup: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Require email verification</div>
                      <div className="text-xs text-indigo-700/80">OTP must be verified before signup completes.</div>
                    </div>
                    <Switch
                      checked={draft.tenantOnboarding.requireEmailVerification}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          tenantOnboarding: { ...s.tenantOnboarding, requireEmailVerification: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Allow multiple companies per user</div>
                      <div className="text-xs text-indigo-700/80">Feature flag (data model dependent).</div>
                    </div>
                    <Switch
                      checked={draft.tenantOnboarding.allowMultipleCompaniesPerUser}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          tenantOnboarding: { ...s.tenantOnboarding, allowMultipleCompaniesPerUser: checked },
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-200/60 bg-white/80">
                <CardHeader>
                  <CardTitle className="text-base text-indigo-900">Notifications</CardTitle>
                  <CardDescription className="text-indigo-700/80">Email toggle, reminder cadence, scheduler control.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Email notifications</div>
                      <div className="text-xs text-indigo-700/80">Master switch for outbound email delivery.</div>
                    </div>
                    <Switch
                      checked={draft.notifications.emailNotificationsEnabled}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          notifications: { ...s.notifications, emailNotificationsEnabled: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Scheduler jobs</div>
                      <div className="text-xs text-indigo-700/80">Enable / disable background scheduler jobs.</div>
                    </div>
                    <Switch
                      checked={draft.notifications.schedulerJobsEnabled}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          notifications: { ...s.notifications, schedulerJobsEnabled: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-indigo-900">Reminder days (comma separated)</Label>
                    <Input
                      placeholder="30,7,1"
                      value={reminderDaysText}
                      onChange={(e) => {
                        const parsed = String(e.target.value || "")
                          .split(/[,\s]+/)
                          .map((v) => Number(v))
                          .filter((n) => Number.isFinite(n));
                        updateDraft((s) => ({
                          ...s,
                          notifications: {
                            ...s.notifications,
                            reminderDays: normalizeReminderDays(parsed),
                          },
                        }));
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-200/60 bg-white/80">
                <CardHeader>
                  <CardTitle className="text-base text-indigo-900">Security</CardTitle>
                  <CardDescription className="text-indigo-700/80">Policy flags affecting auth and access.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Force strong passwords</div>
                      <div className="text-xs text-indigo-700/80">Enforce uppercase/lowercase/number/special policy on signup.</div>
                    </div>
                    <Switch
                      checked={draft.security.forceStrongPasswords}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, forceStrongPasswords: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">2FA</div>
                      <div className="text-xs text-gray-600">Feature flag for multi-factor authentication.</div>
                    </div>
                    <Switch
                      checked={draft.security.enable2FA}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, enable2FA: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-gray-900">Session timeout (minutes)</Label>
                    <Input
                      type="number"
                      min={5}
                      max={1440}
                      value={String(draft.security.sessionTimeoutMinutes ?? 30)}
                      onChange={(e) => {
                        const next = Math.max(5, Math.min(1440, Number(e.target.value || 30)));
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, sessionTimeoutMinutes: next },
                        }));
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Allow impersonation</div>
                      <div className="text-xs text-gray-600">Allow global admins to switch tenant context.</div>
                    </div>
                    <Switch
                      checked={draft.security.allowImpersonation}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, allowImpersonation: checked },
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-indigo-200/60 bg-white/80">
                <CardHeader>
                  <CardTitle className="text-base text-gray-900">Support / Admin Controls</CardTitle>
                  <CardDescription className="text-gray-600">Global admin access policy, audit, debug.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Global admin tenant data access</div>
                      <div className="text-xs text-indigo-700/80">Controls whether global admin can view tenant-level data.</div>
                    </div>
                    <Switch
                      checked={draft.support.globalAdminTenantDataAccess}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          support: { ...s.support, globalAdminTenantDataAccess: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Audit logging</div>
                      <div className="text-xs text-indigo-700/80">Enable / disable platform audit event persistence.</div>
                    </div>
                    <Switch
                      checked={draft.support.auditLoggingEnabled}
                      onCheckedChange={(checked) => {
                        if (import.meta.env.PROD && checked === false) {
                          toast({
                            title: "Locked in production",
                            description: "Audit logging cannot be disabled in production.",
                            variant: "destructive",
                          });
                          return;
                        }

                        updateDraft((s) => ({
                          ...s,
                          support: { ...s.support, auditLoggingEnabled: checked },
                        }));
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200/50 bg-white/70 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-indigo-900">Debug mode</div>
                      <div className="text-xs text-indigo-700/80">Feature flag to surface extra diagnostics to admins.</div>
                    </div>
                    <Switch
                      checked={draft.support.debugMode}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          support: { ...s.support, debugMode: checked },
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }
      case "feature-flags":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { name: "Stripe Billing", enabled: Boolean(billing?.configured), icon: CreditCard },
              { name: "Invoice Visibility", enabled: Boolean(billing?.invoices?.length || billing?.configured), icon: Receipt },
              { name: "Reminder Schedulers", enabled: true, icon: Clock3 },
              { name: "Security Middleware", enabled: true, icon: ShieldCheck },
            ].map((flag) => {
              const Icon = flag.icon;
              return (
                <Card key={flag.name} className="border-indigo-200/60 bg-white/80">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center">
                          <Icon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-base text-indigo-900">{flag.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className={flag.enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                        {flag.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        );
      case "security": {
        const draft = settingsDraft;
        const baseline = platformSettings;

        const isDirty = Boolean(
          draft &&
            baseline &&
            JSON.stringify(draft.security || {}) !== JSON.stringify(baseline.security || {})
        );

        const updateDraft = (updater: (s: PlatformSettings) => PlatformSettings) => {
          setSettingsDraft((prev) => (prev ? updater(prev) : prev));
        };

        const sessions = platformSessions?.items || [];
        const webhookItems = webhookEvents?.items || [];
        const auditItems = auditEvents?.items || [];
        const errorItems = errorLogs?.items || [];
        const jobItems = jobRuns?.items || [];

        if (platformSettingsLoading && !draft) {
          return <EmptyState title="Loading security controls" description="Fetching platform security configuration." />;
        }

        if (!draft) {
          return <EmptyState title="Security controls unavailable" description="Platform settings could not be loaded." />;
        }

        return (
          <div className="space-y-4 font-inter">
            <Card className="border-gray-200 bg-white/90">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-lg text-gray-900">Security Control Panel</CardTitle>
                    <CardDescription className="text-gray-600">
                      Configure auth posture and monitor sessions, audits, Stripe webhooks, and failures.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-gray-200"
                      disabled={!isDirty || savePlatformSettingsMutation.isPending}
                      onClick={() => setSettingsDraft(baseline || draft)}
                    >
                      Reset
                    </Button>
                    <Button
                      className="w-28 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
                      disabled={!isDirty || savePlatformSettingsMutation.isPending}
                      onClick={() =>
                        savePlatformSettingsMutation.mutate({
                          billing: draft.billing,
                          tenantOnboarding: draft.tenantOnboarding,
                          notifications: draft.notifications,
                          security: draft.security,
                          support: draft.support,
                        })
                      }
                    >
                      {savePlatformSettingsMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                    Updated: {draft.updatedAt ? formatDateTime(draft.updatedAt) : "—"}
                  </Badge>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                    Updated by: {draft.updatedBy?.email || "—"}
                  </Badge>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                    Active sessions: {sessions.filter((s) => s.isActive).length}
                  </Badge>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                    Webhook events: {webhookItems.length}
                  </Badge>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                    Audit events: {auditItems.length}
                  </Badge>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                    Errors: {errorItems.length}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-gray-200 bg-white/90">
                <CardHeader>
                  <CardTitle className="text-base text-gray-900">Authentication & Login Protection</CardTitle>
                  <CardDescription className="text-gray-600">JWT expiry, lockout, session timeout, and optional IP tracking.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">JWT expiry enabled</div>
                      <div className="text-xs text-gray-600">When disabled, tokens are issued without expiration.</div>
                    </div>
                    <Switch
                      checked={draft.security.jwtExpiryEnabled}
                      onCheckedChange={(checked) => {
                        if (import.meta.env.PROD && checked === false) {
                          toast({
                            title: "Locked in production",
                            description: "JWT expiry cannot be disabled in production.",
                            variant: "destructive",
                          });
                          return;
                        }

                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, jwtExpiryEnabled: checked },
                        }));
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-gray-900">JWT expiry (minutes)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={10080}
                        disabled={!draft.security.jwtExpiryEnabled}
                        value={draft.security.jwtExpiryMinutes}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next)) return;
                          updateDraft((s) => ({
                            ...s,
                            security: {
                              ...s.security,
                              jwtExpiryMinutes: Math.max(5, Math.min(10080, Math.trunc(next))),
                            },
                          }));
                        }}
                      />
                      <div className="text-xs text-gray-500">Min 5, max 10080 (7 days).</div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-gray-900">Session idle timeout (minutes)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={draft.security.sessionTimeoutMinutes}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next)) return;
                          updateDraft((s) => ({
                            ...s,
                            security: {
                              ...s.security,
                              sessionTimeoutMinutes: Math.max(1, Math.min(1440, Math.trunc(next))),
                            },
                          }));
                        }}
                      />
                      <div className="text-xs text-gray-500">Min 1, max 1440 (24 hours).</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-gray-900">Max login attempts</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={draft.security.maxLoginAttempts}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next)) return;
                          updateDraft((s) => ({
                            ...s,
                            security: {
                              ...s.security,
                              maxLoginAttempts: Math.max(1, Math.min(50, Math.trunc(next))),
                            },
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-gray-900">Account lock duration (minutes)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10080}
                        value={draft.security.accountLockMinutes}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next)) return;
                          updateDraft((s) => ({
                            ...s,
                            security: {
                              ...s.security,
                              accountLockMinutes: Math.max(1, Math.min(10080, Math.trunc(next))),
                            },
                          }));
                        }}
                      />
                      <div className="text-xs text-gray-500">Max 10080 (7 days).</div>
                    </div>
                  </div>

                  <Separator className="bg-gray-200" />

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">IP tracking</div>
                      <div className="text-xs text-gray-600">Store last login IP/user-agent and session IP info.</div>
                    </div>
                    <Switch
                      checked={draft.security.ipTrackingEnabled}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, ipTrackingEnabled: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Refresh tokens</div>
                      <div className="text-xs text-gray-600">Enables rotating refresh tokens for seamless session continuation.</div>
                    </div>
                    <Switch
                      checked={draft.security.refreshTokensEnabled}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, refreshTokensEnabled: checked },
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200 bg-white/90">
                <CardHeader>
                  <CardTitle className="text-base text-gray-900">Policy Toggles</CardTitle>
                  <CardDescription className="text-gray-600">Password strength, 2FA, and impersonation governance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Force strong passwords</div>
                      <div className="text-xs text-gray-600">Require length and complexity checks on signup/reset.</div>
                    </div>
                    <Switch
                      checked={draft.security.forceStrongPasswords}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, forceStrongPasswords: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Enable 2FA (flag)</div>
                      <div className="text-xs text-gray-600">Feature flag for second factor enforcement (flow pending).</div>
                    </div>
                    <Switch
                      checked={draft.security.enable2FA}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, enable2FA: checked },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Allow impersonation</div>
                      <div className="text-xs text-gray-600">Allow global admins to switch tenant context.</div>
                    </div>
                    <Switch
                      checked={draft.security.allowImpersonation}
                      onCheckedChange={(checked) =>
                        updateDraft((s) => ({
                          ...s,
                          security: { ...s.security, allowImpersonation: checked },
                        }))
                      }
                    />
                  </div>

                  <Separator className="bg-gray-200" />

                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-4 w-4 text-gray-700 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <div className="font-medium">Baseline protections</div>
                        <div className="text-xs text-gray-600">{securityControls.slice(0, 2).join(" ")}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {renderTableShell(
                "Active Sessions",
                `Sessions are considered active if lastSeen is within the configured ${platformSessions?.timeoutMinutes ?? draft.security.sessionTimeoutMinutes} minute idle window.`,
                <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.length ? (
                        sessions.slice(0, 200).map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium text-gray-900">{s.email}</TableCell>
                            <TableCell className="text-gray-700">{s.role || "—"}</TableCell>
                            <TableCell className="text-gray-700">{s.actingTenantId || s.tenantId || "—"}</TableCell>
                            <TableCell className="text-gray-700">{formatDateTime(s.lastSeenAt)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={s.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"}
                              >
                                {s.isActive ? "Active" : s.revokedAt ? "Revoked" : "Idle"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-gray-200"
                                disabled={revokeUserSessionsMutation.isPending}
                                onClick={() =>
                                  revokeUserSessionsMutation.mutate({
                                    userId: s.userId,
                                    email: s.email,
                                  })
                                }
                              >
                                Logout all
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-600 py-6">
                            No sessions recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {renderTableShell(
                "Stripe Webhook Events",
                "Latest Stripe webhook receipts and processing outcomes.",
                <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhookItems.length ? (
                        webhookItems.slice(0, 200).map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium text-indigo-900">{e.type || "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  e.status === "processed"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : e.status === "error"
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                }
                              >
                                {e.status || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-indigo-800">{formatDateTime(e.receivedAt)}</TableCell>
                            <TableCell className="text-indigo-800">
                              {e.summary?.plan ? String(e.summary.plan) : e.summary?.stripeCustomerId ? "customer" : "—"}
                            </TableCell>
                            <TableCell className="text-indigo-800">{e.errorMessage || "—"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-indigo-700 py-6">
                            No webhook events logged yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {renderTableShell(
                "Security Audit Events",
                "Login successes/failures, session revocations, and platform settings updates.",
                <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditItems.length ? (
                        auditItems.slice(0, 200).map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium text-indigo-900">{e.action || "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  e.severity === "error"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : e.severity === "warning"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }
                              >
                                {e.severity || "info"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-indigo-800">{e.email || "—"}</TableCell>
                            <TableCell className="text-indigo-800">{e.description || "—"}</TableCell>
                            <TableCell className="text-indigo-800">{formatDateTime(e.timestamp)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-indigo-700 py-6">
                            No audit events found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {renderTableShell(
                "Error Logs",
                "Latest API/process errors persisted for platform diagnostics.",
                <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Kind</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorItems.length ? (
                        errorItems.slice(0, 200).map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-indigo-800">{formatDateTime(e.createdAt)}</TableCell>
                            <TableCell className="text-indigo-800">{e.kind || "—"}</TableCell>
                            <TableCell className="text-indigo-800">
                              {e.method ? `${e.method} ` : ""}
                              {e.path || "—"}
                            </TableCell>
                            <TableCell className="text-indigo-800">{e.statusCode ?? "—"}</TableCell>
                            <TableCell className="text-indigo-900">{e.message || "—"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-indigo-700 py-6">
                            No error logs recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {renderTableShell(
                "Scheduler Job Runs",
                "Background job execution history and failures.",
                <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobItems.length ? (
                        jobItems.slice(0, 100).map((j) => (
                          <TableRow key={j.id}>
                            <TableCell className="font-medium text-indigo-900">{j.taskName || "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={j.success ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}
                              >
                                {j.success ? "Success" : "Failed"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-indigo-800">{typeof j.durationMs === "number" ? `${j.durationMs}ms` : "—"}</TableCell>
                            <TableCell className="text-indigo-800">{formatDateTime(j.startedAt)}</TableCell>
                            <TableCell className="text-indigo-800">{j.errorMessage || "—"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-indigo-700 py-6">
                            No job runs recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        );
      }
      default:
        return <EmptyState title="Section pending" description={item.description} />;
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 bg-[#f8fafc] min-h-screen font-inter text-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">
        <div
          className="relative overflow-hidden rounded-2xl border border-gray-200 px-5 sm:px-8 py-6 shadow-sm"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.96) 50%, rgba(255, 255, 255, 0.96) 100%)",
          }}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <svg className="absolute -right-12 -top-12 w-72 h-72 opacity-[0.10]" viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="100" fill="#94a3b8" />
            </svg>
          </div>
          <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-600">{section.label}</div>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">{item.label}</h1>
              <p className="mt-2 text-sm text-gray-600 leading-6 max-w-2xl">{item.description}</p>
            </div>
            {item.readOnly ? (
              <Badge variant="secondary" className="bg-white text-gray-700 border-gray-200">
                Read Only
              </Badge>
            ) : null}
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}