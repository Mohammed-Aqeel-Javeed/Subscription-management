import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download } from "lucide-react";

import type { Subscription } from "@shared/schema";

type HistoryRecord = {
  _id?: string;
  action?: string;
  subscriptionId?: string | { toString(): string };
  timestamp?: string;
  loggedAt?: string;
  data?: Record<string, any>;
  updatedFields?: Record<string, any>;
};

type RangePreset = "last12" | "last6" | "last3";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
// Average month length in days (365.25 / 12)
const MS_PER_MONTH = MS_PER_DAY * 30.4375;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function parseDateLike(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function getActivityTimeMsFromHistory(record: HistoryRecord): number {
  const primary = parseDateLike(record?.loggedAt ?? record?.timestamp);
  if (primary) return primary.getTime();
  const fallback = parseDateLike(record?.timestamp);
  return fallback ? fallback.getTime() : 0;
}

function getSubscriptionFallbackActivityMs(sub: Subscription): number {
  const candidates = [
    parseDateLike((sub as any)?.updatedAt),
    parseDateLike((sub as any)?.createdAt),
    parseDateLike((sub as any)?.initialDate),
    parseDateLike((sub as any)?.startDate),
  ].filter(Boolean) as Date[];

  let max = 0;
  for (const d of candidates) {
    if (d.getTime() > max) max = d.getTime();
  }
  return max;
}

function getEarliestDateFromHistoryEvents(events: HistoryRecord[]): Date | null {
  let earliestMs = 0;
  const consider = (value: unknown) => {
    const d = parseDateLike(value);
    if (!d) return;
    const ms = d.getTime();
    if (!Number.isFinite(ms)) return;
    if (!earliestMs || ms < earliestMs) earliestMs = ms;
  };

  for (const ev of events) {
    const d1 = (ev as any)?.data;
    const d2 = (ev as any)?.updatedFields;
    // Try both old/new snapshots for key date fields
    consider(d1?.initialDate);
    consider(d2?.initialDate);
    consider(d1?.firstPurchaseDate);
    consider(d2?.firstPurchaseDate);
    consider(d1?.currentCycleStart);
    consider(d2?.currentCycleStart);
    consider(d1?.startDate);
    consider(d2?.startDate);
  }

  return earliestMs ? new Date(earliestMs) : null;
}

function parseMoneyLike(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  const num = Number(s.replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function getActiveStartDate(sub: Subscription): Date | null {
  const initial = parseDateLike((sub as any)?.initialDate);
  if (initial) return initial;

  const firstPurchase = parseDateLike((sub as any)?.firstPurchaseDate);
  if (firstPurchase) return firstPurchase;

  return parseDateLike((sub as any)?.startDate);
}

function normalizeId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    // ObjectId-like
    return (value as any).toString?.() ? String((value as any).toString()) : String(value);
  } catch {
    return String(value);
  }
}

function normalizeDepartmentTokens(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((v) => normalizeDepartmentTokens(v));
  }

  if (typeof value !== "string") {
    const str = String(value).trim();
    return str ? [str] : [];
  }

  let s = value.trim();
  if (!s) return [];
  if (s === "[]") return [];

  // Aggressive JSON parsing - try multiple times to unwrap nested encoding
  for (let attempts = 0; attempts < 3; attempts++) {
    // Handle bracketed arrays: ["IT","Finance"] or ['IT','Finance']
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        // First try standard JSON
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return normalizeDepartmentTokens(parsed);
        }
        if (typeof parsed === "string") {
          s = parsed.trim();
          continue;
        }
        return [String(parsed).trim()].filter(Boolean);
      } catch {
        // Try replacing single quotes with double quotes
        const withDoubleQuotes = s.replace(/'/g, '"');
        try {
          const parsed = JSON.parse(withDoubleQuotes);
          if (Array.isArray(parsed)) {
            return normalizeDepartmentTokens(parsed);
          }
        } catch {
          // Manual extraction as fallback for malformed JSON like ["IT","Finance"]
          const inner = s.slice(1, -1); // Remove [ and ]
          if (inner.includes(",")) {
            const parts = inner
              .split(",")
              .map((p) => {
                let clean = p.trim();
                // Remove quotes
                if ((clean.startsWith('"') && clean.endsWith('"')) || 
                    (clean.startsWith("'") && clean.endsWith("'"))) {
                  clean = clean.slice(1, -1);
                }
                return clean.trim();
              })
              .filter(Boolean);
            if (parts.length > 0) return parts;
          }
        }
      }
      break;
    }

    // Handle quoted strings
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      try {
        const parsed = JSON.parse(s);
        if (typeof parsed === "string") {
          s = parsed.trim();
          continue;
        }
      } catch {
        s = s.slice(1, -1).trim();
        if (!s) return [];
        continue;
      }
    }

    break;
  }

  // Handle pipe-separated departments (CSV import format)
  if (s.includes("|")) {
    return s.split("|").map((p) => p.trim()).filter(Boolean);
  }

  // Final check: if it still looks like JSON, skip it
  if (s.startsWith("[") || s.startsWith("{")) {
    return [];
  }

  return [s];
}

function getNormalizedDepartments(sub: Subscription): string[] {
  const raw = (sub as any)?.departments;
  const out: string[] = normalizeDepartmentTokens(raw);

  const legacy = String((sub as any)?.department ?? "").trim();
  if (legacy) out.push(legacy);

  return Array.from(new Set(out.map((d) => d.trim()).filter(Boolean)));
}

function formatMoney(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNextRenewalLabel(sub: Subscription) {
  const cycle = String((sub as any).billingCycle ?? "").toLowerCase();
  if (cycle === "monthly") return "Monthly";
  if (cycle === "weekly") return "Weekly";

  const nr = (sub as any)?.nextRenewal;
  const date = nr ? new Date(nr) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function SpendingAnalysisReport() {
  const navigate = useNavigate();
  const [rangePreset, setRangePreset] = React.useState<RangePreset>("last12");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("all");

  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: history = [] } = useQuery<HistoryRecord[]>({
    queryKey: ["/api/history/list"],
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async () => {
      try {
        const { apiRequest } = await import("@/lib/queryClient");
        const res = await apiRequest("GET", `/api/history/list?limit=2000`);
        const json = await res.json().catch(() => []);
        return Array.isArray(json) ? (json as HistoryRecord[]) : [];
      } catch {
        return [];
      }
    },
  });

  const monthsInRange = React.useMemo(() => {
    if (rangePreset === "last3") return 3;
    if (rangePreset === "last6") return 6;
    return 12;
  }, [rangePreset]);

  const { periodStart, periodEnd } = React.useMemo(() => {
    const end = startOfDay(new Date());
    const start = startOfDay(addMonths(end, -monthsInRange));
    return { periodStart: start, periodEnd: end };
  }, [monthsInRange]);

  const historyBySubscriptionId = React.useMemo(() => {
    const map = new Map<string, HistoryRecord[]>();
    for (const item of Array.isArray(history) ? history : []) {
      const sid = normalizeId(item?.subscriptionId);
      if (!sid) continue;
      const arr = map.get(sid) ?? [];
      arr.push(item);
      map.set(sid, arr);
    }

    map.forEach((arr) => {
      arr.sort((a: HistoryRecord, b: HistoryRecord) => {
        const at = a?.timestamp ? new Date(String(a.timestamp)).getTime() : 0;
        const bt = b?.timestamp ? new Date(String(b.timestamp)).getTime() : 0;
        return at - bt;
      });
    });
    return map;
  }, [history]);

  const lastActivityMsBySubscriptionId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of Array.isArray(history) ? history : []) {
      const sid = normalizeId(item?.subscriptionId);
      if (!sid) continue;
      const t = getActivityTimeMsFromHistory(item);
      const prev = map.get(sid) ?? 0;
      if (t > prev) map.set(sid, t);
    }
    return map;
  }, [history]);

  const firstActivityMsBySubscriptionId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of Array.isArray(history) ? history : []) {
      const sid = normalizeId(item?.subscriptionId);
      if (!sid) continue;
      const t = getActivityTimeMsFromHistory(item);
      if (!t) continue;
      const prev = map.get(sid);
      if (!prev || t < prev) map.set(sid, t);
    }
    return map;
  }, [history]);

  const getBestActiveStartDate = React.useCallback(
    (sub: Subscription) => {
      const base = getActiveStartDate(sub);
      const subscriptionId = normalizeId((sub as any)?.id ?? (sub as any)?._id);
      const events = subscriptionId ? historyBySubscriptionId.get(subscriptionId) ?? [] : [];

      // Prefer the earliest cycle-related date found in history snapshots.
      const earliestFromHistory = getEarliestDateFromHistoryEvents(events);
      if (!base) return earliestFromHistory;

      if (earliestFromHistory && base.getTime() - earliestFromHistory.getTime() > MS_PER_DAY) {
        return earliestFromHistory;
      }

      // Fallback: if we have a first history activity time earlier than base (rare), use it.
      const firstActivityMs = subscriptionId ? firstActivityMsBySubscriptionId.get(subscriptionId) ?? 0 : 0;
      if (firstActivityMs) {
        const firstActivity = new Date(firstActivityMs);
        if (base.getTime() - firstActivity.getTime() > MS_PER_DAY) return firstActivity;
      }

      return base;
    },
    [firstActivityMsBySubscriptionId, historyBySubscriptionId]
  );

  const computePeriodSpend = React.useCallback(
    (sub: Subscription) => {
      const baseStart = getBestActiveStartDate(sub);
      const activeFrom = baseStart
        ? new Date(Math.max(periodStart.getTime(), startOfDay(baseStart).getTime()))
        : periodStart;

      // If there is a true endDate and it's before the report end, cap it.
      const endDate = parseDateLike((sub as any)?.endDate);
      const activeTo = endDate && endDate.getTime() < periodEnd.getTime() ? endDate : periodEnd;

      const fromMs = activeFrom.getTime();
      const toMs = activeTo.getTime();
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 0;

      const subscriptionId = normalizeId((sub as any)?.id ?? (sub as any)?._id);
      const events = subscriptionId ? historyBySubscriptionId.get(subscriptionId) ?? [] : [];

      const cycle = String((sub as any).billingCycle ?? "").toLowerCase();
      const toMonthly = (amount: number) => {
        if (!Number.isFinite(amount)) return 0;
        if (cycle === "monthly") return amount;
        if (cycle === "yearly") return amount / 12;
        if (cycle === "quarterly") return amount / 3;
        if (cycle === "weekly") return (amount * 52) / 12;
        return amount;
      };

      const baseAmount = parseMoneyLike((sub as any)?.amount) ?? 0;

      // Build a list of (time, amountAfterChange) from history.
      const changes: Array<{ t: number; before: number | null; after: number }> = [];
      for (const ev of events) {
        const ts = ev?.timestamp ? new Date(String(ev.timestamp)).getTime() : NaN;
        if (!Number.isFinite(ts)) continue;

        const after = parseMoneyLike(ev?.updatedFields?.amount);
        const before = parseMoneyLike(ev?.data?.amount);

        // Only treat as a price-change point when amount actually changes.
        if (after === null) continue;
        if (before !== null && Math.round(before * 100) === Math.round(after * 100)) continue;

        changes.push({ t: ts, before, after });
      }
      changes.sort((a, b) => a.t - b.t);

      // Determine amount at activeFrom.
      // If there was a change before activeFrom, use the latest "after".
      // Otherwise, prefer the "before" of the first change after activeFrom (so we don't
      // incorrectly apply the current amount to earlier months).
      let currentAmount = baseAmount;
      const lastAtOrBefore = [...changes].reverse().find((c) => c.t <= fromMs);
      if (lastAtOrBefore) {
        currentAmount = lastAtOrBefore.after;
      } else {
        const firstAfterFrom = changes.find((c) => c.t > fromMs);
        if (firstAfterFrom && firstAfterFrom.before !== null) {
          currentAmount = firstAfterFrom.before;
        }
      }

      let spend = 0;
      let cursor = fromMs;
      for (const ch of changes) {
        if (ch.t <= cursor) continue;
        if (ch.t >= toMs) break;

        const segMs = ch.t - cursor;
        if (segMs > 0) {
          spend += toMonthly(currentAmount) * (segMs / MS_PER_MONTH);
        }
        currentAmount = ch.after;
        cursor = ch.t;
      }

      const tailMs = toMs - cursor;
      if (tailMs > 0) {
        spend += toMonthly(currentAmount) * (tailMs / MS_PER_MONTH);
      }

      return Math.max(0, spend);
    },
    [getBestActiveStartDate, historyBySubscriptionId, monthsInRange, periodEnd, periodStart]
  );

  const computeActiveMonthsInPeriod = React.useCallback(
    (sub: Subscription) => {
      const baseStart = getBestActiveStartDate(sub);
      const activeFrom = baseStart
        ? new Date(Math.max(periodStart.getTime(), startOfDay(baseStart).getTime()))
        : periodStart;

      const endDate = parseDateLike((sub as any)?.endDate);
      const activeTo = endDate && endDate.getTime() < periodEnd.getTime() ? endDate : periodEnd;

      const fromMs = activeFrom.getTime();
      const toMs = activeTo.getTime();
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 0;
      return (toMs - fromMs) / MS_PER_MONTH;
    },
    [getBestActiveStartDate, periodEnd, periodStart]
  );

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    subscriptions.forEach((sub) => {
      getNormalizedDepartments(sub).forEach((d) => {
        // Extra safety: never add a value that looks like stringified JSON
        if (d && !d.startsWith("[") && !d.startsWith("{")) {
          set.add(d);
        }
      });
    });
    return Array.from(set).sort((a, b) => (a === "Company Level" ? -1 : b === "Company Level" ? 1 : a.localeCompare(b)));
  }, [subscriptions]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    subscriptions.forEach((sub) => {
      const cat = String((sub as any)?.category ?? "").trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [subscriptions]);

  const filtered = React.useMemo(() => {
    return subscriptions
      .filter((sub) => String((sub as any)?.status ?? "").toLowerCase() !== "cancelled")
      .filter((sub) => {
        if (selectedCategory === "all") return true;
        return String((sub as any)?.category ?? "") === selectedCategory;
      })
      .filter((sub) => {
        if (selectedDepartment === "all") return true;
        return getNormalizedDepartments(sub).includes(selectedDepartment);
      })
      .map((sub) => {
        const periodSpend = computePeriodSpend(sub);
        // Run-rate monthly average across the time the subscription was active in the selected period.
        const activeMonths = computeActiveMonthsInPeriod(sub);
        const monthlyAvg = activeMonths > 0 ? periodSpend / activeMonths : 0;

        const subscriptionId = normalizeId((sub as any)?.id ?? (sub as any)?._id);
        const lastActivity = subscriptionId
          ? lastActivityMsBySubscriptionId.get(subscriptionId) ?? 0
          : 0;
        const fallbackActivity = getSubscriptionFallbackActivityMs(sub);
        const activityMs = Math.max(lastActivity, fallbackActivity);

        return { sub, monthlyAvg, periodSpend, activityMs };
      })
      .sort((a, b) => {
        if (b.activityMs !== a.activityMs) return b.activityMs - a.activityMs;
        return b.periodSpend - a.periodSpend;
      });
  }, [subscriptions, selectedCategory, selectedDepartment, computePeriodSpend, computeActiveMonthsInPeriod, lastActivityMsBySubscriptionId]);

  // Category badge sizing: use the longest category label (clamped) so badges are consistent.
  const categoryBadgeWidthCh = React.useMemo(() => {
    let maxLen = 0;
    for (const row of filtered) {
      const val = String((row.sub as any)?.category ?? "").trim();
      if (val.length > maxLen) maxLen = val.length;
    }
    return Math.min(Math.max(maxLen, 6), 28);
  }, [filtered]);

  const totals = React.useMemo(() => {
    const totalPeriodSpend = filtered.reduce((sum, row) => sum + row.periodSpend, 0);
    const totalMonthlyAvg = filtered.reduce((sum, row) => sum + row.monthlyAvg, 0);
    return { totalPeriodSpend, totalMonthlyAvg };
  }, [filtered]);

  const handleExportCsv = () => {
    const rows = filtered.map(({ sub, monthlyAvg, periodSpend }) => {
      const department = getNormalizedDepartments(sub)[0] ?? "";

      return {
        Service: (sub as any)?.serviceName ?? "",
        Category: (sub as any)?.category ?? "",
        Department: department ?? "",
        PeriodSpend: periodSpend.toFixed(2),
        MonthlyAvg: monthlyAvg.toFixed(2),
        NextRenewal: formatNextRenewalLabel(sub),
      };
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spending-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold text-gray-900">Spending Analysis</h2>
        </div>

        <Button
          type="button"
          onClick={() => navigate("/reports")}
          className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Select value={rangePreset} onValueChange={(v) => setRangePreset(v as RangePreset)}>
                <SelectTrigger className="w-full lg:w-[280px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last12">Last 12 months</SelectItem>
                  <SelectItem value="last6">Last 6 months</SelectItem>
                  <SelectItem value="last3">Last 3 months</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full lg:w-[280px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="block max-w-full truncate">{c}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-full lg:w-[280px]">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      <span className="block max-w-full truncate">{d}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExportCsv}
              className="w-full lg:w-auto bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
              type="button"
            >
              <Download />
              Export to CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-md overflow-hidden">
            <Table containerClassName="max-h-[70vh] overflow-auto" className="table-fixed">
              <TableHeader>
                <TableRow className="border-b-2 border-gray-400 bg-gray-200">
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[220px]">
                    SERVICE
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[220px]">
                    CATEGORY
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[140px]">
                    DEPARTMENT
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide w-[140px]">
                    PERIOD SPEND
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-3 text-right text-xs font-bold text-gray-800 uppercase tracking-wide w-[140px]">
                    MONTHLY AVG
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[170px]">
                    NEXT RENEWAL
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No subscriptions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filtered.map(({ sub, monthlyAvg, periodSpend }, index) => {
                      const department = getNormalizedDepartments(sub)[0] ?? "";
                      const categoryValue = String((sub as any)?.category ?? "").trim();
                      const normalized = categoryValue.toLowerCase();

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
                        categoryClassMap[normalized] ??
                        fallbackPalette[Math.abs(hashString(normalized)) % fallbackPalette.length];

                      return (
                        <TableRow
                          key={(sub as any)?.id ?? (sub as any)?.serviceName}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                          }`}
                        >
                          <TableCell className="px-3 py-3 font-medium text-gray-800 w-[220px] max-w-[220px] overflow-hidden text-left">
                            <span
                              title={String((sub as any)?.serviceName ?? "")}
                              className="block w-full truncate whitespace-nowrap text-left"
                            >
                              {(sub as any)?.serviceName ?? ""}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-3 w-[220px] max-w-[220px] overflow-hidden text-center">
                            {categoryValue ? (
                              <span
                                className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold leading-none border max-w-full ${badgeClass}`}
                                style={{ width: `${categoryBadgeWidthCh}ch`, maxWidth: "100%" }}
                              >
                                <span className="truncate whitespace-nowrap" title={categoryValue}>
                                  {categoryValue}
                                </span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center justify-center text-gray-400 text-xs"
                                style={{ width: `${categoryBadgeWidthCh}ch`, maxWidth: "100%" }}
                              >
                                -
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-800 w-[140px] max-w-[140px] overflow-hidden text-left">
                            <span className="block w-full truncate whitespace-nowrap" title={department}>
                              {department && department !== "[]" ? department : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm font-semibold text-gray-900 text-right w-[140px]">
                            {formatMoney(periodSpend)}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm font-semibold text-gray-900 text-right w-[140px]">
                            {formatMoney(monthlyAvg)}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-800 w-[170px] max-w-[170px] overflow-hidden text-left">
                            {formatNextRenewalLabel(sub)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    <TableRow className="bg-gray-100">
                      <TableCell className="px-3 py-3 text-base font-bold text-gray-900">Grand Total</TableCell>
                      <TableCell className="px-3 py-3" />
                      <TableCell className="px-3 py-3" />
                      <TableCell className="px-3 py-3 text-base font-bold text-gray-900 text-right">
                        {formatMoney(totals.totalPeriodSpend)}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-base font-bold text-gray-900 text-right">
                        {formatMoney(totals.totalMonthlyAvg)}
                      </TableCell>
                      <TableCell className="px-3 py-3" />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
