import { useUser } from "@/context/UserContext";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const formatMoney = (value: any) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const anyError = statsError || companiesError || activityError;

  return (
    <div className="p-8">
      <div className="rounded-2xl border border-indigo-200/60 bg-white/70 p-6 text-indigo-900">
        <div className="text-2xl font-bold">Platform Admin Dashboard</div>
        <div className="text-sm text-indigo-700/80 mt-1">Logged in as {user?.email || "global admin"}</div>
      </div>

      {anyError ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-white/70 p-4 text-sm text-red-700">
          Failed to load platform data.
        </div>
      ) : null}

      {/* Top Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-indigo-200/60 bg-white/70 p-5">
          <div className="text-sm text-indigo-700/80">Companies</div>
          <div className="text-3xl font-bold text-indigo-900 mt-1">
            {statsLoading ? "—" : (stats?.totalCompanies ?? 0)}
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-200/60 bg-white/70 p-5">
          <div className="text-sm text-indigo-700/80">Users</div>
          <div className="text-3xl font-bold text-indigo-900 mt-1">
            {statsLoading ? "—" : (stats?.totalUsers ?? 0)}
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-200/60 bg-white/70 p-5">
          <div className="text-sm text-indigo-700/80">Revenue (MRR)</div>
          <div className="text-3xl font-bold text-indigo-900 mt-1">
            {statsLoading ? "—" : formatMoney(stats?.mrr)}
          </div>
        </div>
      </div>

      {/* Companies List */}
      <div className="mt-6 rounded-2xl border border-indigo-200/60 bg-white/70 p-6">
        <div className="text-lg font-bold text-indigo-900">Companies</div>
        <div className="text-sm text-indigo-700/80 mt-1">Latest tenants in the platform</div>

        <div className="mt-4">
          {companiesLoading ? (
            <div className="text-sm text-indigo-700/80">Loading companies…</div>
          ) : (
            <div className="rounded-xl border border-indigo-200/50 bg-white/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Users</TableHead>
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
                        <TableCell className="text-indigo-800">{Number(c.users || 0)}</TableCell>
                        <TableCell className="text-indigo-800">{c.status || "active"}</TableCell>
                        <TableCell className="text-indigo-800">{formatDate(c.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 rounded-2xl border border-indigo-200/60 bg-white/70 p-6">
        <div className="text-lg font-bold text-indigo-900">Recent Activity</div>
        <div className="text-sm text-indigo-700/80 mt-1">Latest changes across the platform</div>

        <div className="mt-4">
          {activityLoading ? (
            <div className="text-sm text-indigo-700/80">Loading activity…</div>
          ) : activity.length === 0 ? (
            <div className="text-sm text-indigo-700/80">No activity yet.</div>
          ) : (
            <div className="space-y-2">
              {activity.slice(0, 10).map((a) => {
                const key = a._id || a.id || `${a.tenantId}-${String(a.timestamp || a.createdAt || "")}`;
                const when = formatDate(a.timestamp || a.createdAt);
                const company = a.companyName ? `${a.companyName}: ` : "";
                const text = a.description || a.action || a.type || "Activity";
                return (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-indigo-200/50 bg-white/60 px-4 py-3">
                    <div className="text-sm text-indigo-900 truncate">
                      {company}{text}
                    </div>
                    <div className="text-xs text-indigo-700/70 flex-shrink-0 ml-3">{when}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
