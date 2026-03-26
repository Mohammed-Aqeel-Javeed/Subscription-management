import { useUser } from "@/context/UserContext";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Users as UsersIcon, DollarSign, Activity as ActivityIcon } from "lucide-react";
import { useMemo } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

type PlatformStats = {
  totalCompanies: number;
  totalUsers: number;
  mrr: number;
};

type PlatformCompany = {
  tenantId: string;
  companyName: string;
  plan: string;
  users: number;
  status: string;
  createdAt?: string | Date | null;
};

type PlatformActivityItem = {
  _id?: string;
  id?: string;
  tenantId?: string;
  companyName?: string | null;
  action?: string;
  type?: string;
  description?: string;
  entityType?: string;
  subscriptionName?: string;
  serviceName?: string;
  message?: string;
  timestamp?: string | Date;
  createdAt?: string | Date;
};

const formatDate = (raw: any) => {
  if (!raw) return "—";
  const d = raw instanceof Date ? raw : new Date(String(raw));
  const t = d.getTime();
  if (!Number.isFinite(t)) return "—";
  return d.toLocaleDateString();
};

const formatDateTime = (raw: any) => {
  if (!raw) return "—";
  const d = raw instanceof Date ? raw : new Date(String(raw));
  const t = d.getTime();
  if (!Number.isFinite(t)) return "—";
  return d.toLocaleString();
};

const formatMoney = (value: any) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatMonthLabel = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
const formatDayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short" });

function parseToDate(raw: any): Date | null {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isFinite(d.getTime()) ? d : null;
}

const activityText = (a: PlatformActivityItem) => {
  const pick = (...vals: Array<any>) => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  };

  const action = pick(a.action, a.type);
  const subject = pick(a.subscriptionName, a.serviceName, (a as any)?.data?.serviceName);
  const desc = pick(a.description, a.message);

  if (desc) return desc;
  if (action && subject) return `${action}: ${subject}`;
  if (action) return action;
  if (subject) return subject;
  return "Activity";
};

export default function PlatformAdminPage() {
  const { user } = useUser();

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

  const companiesGrowth = useMemo(() => {
    const now = new Date();
    const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const end = monthIndex(now);
    const start = end - 5;

    const counts = new Map<number, number>();
    for (const c of companies) {
      const d = parseToDate((c as any).createdAt);
      if (!d) continue;
      const idx = monthIndex(d);
      if (idx < start || idx > end) continue;
      counts.set(idx, (counts.get(idx) || 0) + 1);
    }

    const series: Array<{ key: string; label: string; companies: number }> = [];
    for (let idx = start; idx <= end; idx++) {
      const y = Math.floor(idx / 12);
      const m = idx % 12;
      const d = new Date(y, m, 1);
      series.push({
        key: `${y}-${String(m + 1).padStart(2, "0")}`,
        label: formatMonthLabel(d),
        companies: counts.get(idx) || 0,
      });
    }
    return series;
  }, [companies]);

  const activityVolume = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(now.getTime() - 6 * dayMs);
    start.setHours(0, 0, 0, 0);

    const counts = new Map<number, number>();
    for (const a of activity) {
      const d = parseToDate((a as any).timestamp ?? (a as any).createdAt);
      if (!d) continue;
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      if (day < start) continue;
      const key = day.getTime();
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const series: Array<{ key: string; label: string; events: number }> = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start.getTime() + i * dayMs);
      const key = day.getTime();
      series.push({
        key: String(key),
        label: formatDayLabel(day),
        events: counts.get(key) || 0,
      });
    }
    return series;
  }, [activity]);

  const companiesChartConfig: ChartConfig = {
    companies: { label: "Companies", color: "hsl(var(--chart-1))" },
  };
  const activityChartConfig: ChartConfig = {
    events: { label: "Events", color: "hsl(var(--chart-2))" },
  };

  const anyError = statsError || companiesError || activityError;

  return (
    <div className="p-6 md:p-8 bg-gradient-to-b from-indigo-50/60 via-white to-white min-h-screen">
      <Card className="border-indigo-200/60 bg-white/70">
        <CardHeader className="pb-4">
          <CardTitle className="text-indigo-900">Platform Admin Dashboard</CardTitle>
          <CardDescription className="text-indigo-700/80">
            Logged in as {user?.email || "global admin"}
          </CardDescription>
        </CardHeader>
      </Card>

      {anyError ? (
        <Card className="mt-6 border-red-200 bg-white/70">
          <CardContent className="pt-6 text-sm text-red-700">Failed to load platform data.</CardContent>
        </Card>
      ) : null}

      {/* Top Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-indigo-200/60 bg-white/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-indigo-700/80">Companies</CardDescription>
              <div className="h-9 w-9 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-3xl text-indigo-900">
              {statsLoading ? "—" : (stats?.totalCompanies ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-indigo-200/60 bg-white/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-indigo-700/80">Users</CardDescription>
              <div className="h-9 w-9 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center">
                <UsersIcon className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-3xl text-indigo-900">
              {statsLoading ? "—" : (stats?.totalUsers ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-indigo-200/60 bg-white/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-indigo-700/80">Revenue (MRR)</CardDescription>
              <div className="h-9 w-9 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-3xl text-indigo-900">
              {statsLoading ? "—" : formatMoney(stats?.mrr)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Insights */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-indigo-200/60 bg-white/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-indigo-900 text-lg">Company Growth</CardTitle>
            <CardDescription className="text-indigo-700/80">New companies created (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={companiesChartConfig} className="h-[260px] w-full">
              <BarChart data={companiesGrowth} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="companies" radius={[6, 6, 0, 0]} fill="var(--color-companies)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-indigo-200/60 bg-white/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-indigo-900 text-lg">Activity Volume</CardTitle>
            <CardDescription className="text-indigo-700/80">Audit activity events (last 7 days)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={activityChartConfig} className="h-[260px] w-full">
              <AreaChart data={activityVolume} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="events"
                  stroke="var(--color-events)"
                  fill="var(--color-events)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Companies List */}
      <Card className="mt-6 border-indigo-200/60 bg-white/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-indigo-900 text-lg">Companies</CardTitle>
          <CardDescription className="text-indigo-700/80">Latest tenants in the platform</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {companiesLoading ? (
            <div className="text-sm text-indigo-700/80">Loading companies…</div>
          ) : (
            <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-indigo-700/80">
                        No companies found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    companies.map((c) => (
                      <TableRow key={c.tenantId}>
                        <TableCell className="font-medium text-indigo-900">{c.companyName}</TableCell>
                        <TableCell className="text-indigo-800">{c.plan || "—"}</TableCell>
                        <TableCell className="text-right text-indigo-800">{Number(c.users || 0)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-indigo-600/10 text-indigo-800 border-indigo-200">
                            {c.status || "active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-indigo-800">{formatDate(c.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="mt-6 border-indigo-200/60 bg-white/80">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-600/10 text-indigo-700 flex items-center justify-center">
              <ActivityIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-indigo-900 text-lg">Recent Activity</CardTitle>
              <CardDescription className="text-indigo-700/80">Latest changes across the platform</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {activityLoading ? (
            <div className="text-sm text-indigo-700/80">Loading activity…</div>
          ) : activity.length === 0 ? (
            <div className="text-sm text-indigo-700/80">No activity yet.</div>
          ) : (
            <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
              {activity.slice(0, 10).map((a, idx) => {
                const key = a._id || a.id || `${a.tenantId}-${String(a.timestamp || a.createdAt || "")}-${idx}`;
                const when = formatDateTime(a.timestamp || a.createdAt);
                const title = activityText(a);
                return (
                  <div key={key} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-indigo-900 truncate">{title}</div>
                        <div className="text-xs text-indigo-700/70 mt-0.5">
                          {a.companyName ? a.companyName : "Platform"}
                        </div>
                      </div>
                      <div className="text-xs text-indigo-700/70 flex-shrink-0">{when}</div>
                    </div>
                    {idx < 9 ? <Separator className="mt-3 bg-indigo-200/50" /> : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
