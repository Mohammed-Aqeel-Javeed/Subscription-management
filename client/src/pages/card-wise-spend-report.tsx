import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    return (value as any).toString?.() ? String((value as any).toString()) : String(value);
  } catch {
    return String(value);
  }
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

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function getCategoryBadgeClass(categoryValue: string) {
  const raw = String(categoryValue ?? "").trim();
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

  return categoryClassMap[normalized] ?? fallbackPalette[Math.abs(hashString(normalized)) % fallbackPalette.length];
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

function getCardLabel(sub: Subscription): string {
  const raw = String((sub as any)?.paymentMethod ?? (sub as any)?.card ?? "").trim();
  return raw;
}

function getHistoryPaymentMethodValue(container: any): string | null {
  if (!container) return null;
  const v = container.paymentMethod ?? container.payment_method;
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

type CardWiseRow = {
  sub: Subscription;
  card: string;
  periodSpend: number;
  monthlyAvg: number;
  activityMs: number;
};

export default function CardWiseSpendReport() {
  const navigate = useNavigate();
  const [rangePreset, setRangePreset] = React.useState<RangePreset>("last12");
  const [selectedCard, setSelectedCard] = React.useState<string>("all");

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
      arr.sort((a, b) => {
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

  const getBestActiveStartDate = React.useCallback(
    (sub: Subscription) => {
      const base = getActiveStartDate(sub);
      const subscriptionId = normalizeId((sub as any)?.id ?? (sub as any)?._id);
      const events = subscriptionId ? historyBySubscriptionId.get(subscriptionId) ?? [] : [];

      const earliestFromHistory = getEarliestDateFromHistoryEvents(events);
      if (!base) return earliestFromHistory;

      if (earliestFromHistory && base.getTime() - earliestFromHistory.getTime() > MS_PER_DAY) {
        return earliestFromHistory;
      }

      return base;
    },
    [historyBySubscriptionId]
  );

  const computeSpendByCardInPeriod = React.useCallback(
    (sub: Subscription): Array<{ card: string; periodSpend: number; monthlyAvg: number }> => {
      const baseStart = getBestActiveStartDate(sub);
      const activeFrom = baseStart
        ? new Date(Math.max(periodStart.getTime(), startOfDay(baseStart).getTime()))
        : periodStart;

      const endDate = parseDateLike((sub as any)?.endDate);
      const activeTo = endDate && endDate.getTime() < periodEnd.getTime() ? endDate : periodEnd;

      const fromMs = activeFrom.getTime();
      const toMs = activeTo.getTime();
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];

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

      // Amount change points
      const baseAmount = parseMoneyLike((sub as any)?.amount) ?? 0;
      const amountChanges: Array<{ t: number; before: number | null; after: number }> = [];

      // Payment method change points
      const baseCard = getCardLabel(sub);
      const cardChanges: Array<{ t: number; before: string | null; after: string | null }> = [];

      for (const ev of events) {
        const ts = ev?.timestamp ? new Date(String(ev.timestamp)).getTime() : NaN;
        if (!Number.isFinite(ts)) continue;

        const afterAmount = parseMoneyLike(ev?.updatedFields?.amount);
        const beforeAmount = parseMoneyLike(ev?.data?.amount);
        if (afterAmount !== null) {
          if (!(beforeAmount !== null && Math.round(beforeAmount * 100) === Math.round(afterAmount * 100))) {
            amountChanges.push({ t: ts, before: beforeAmount, after: afterAmount });
          }
        }

        const afterCard = getHistoryPaymentMethodValue(ev?.updatedFields);
        const beforeCard = getHistoryPaymentMethodValue(ev?.data);

        // Treat empty/undefined as "no signal". We only record transitions *to a real value*
        // so a partial history payload can't blank out a mandatory field.
        const afterNorm = afterCard ? afterCard.trim() : "";
        const beforeNorm = beforeCard ? beforeCard.trim() : "";

        if (afterNorm && afterNorm !== beforeNorm) {
          cardChanges.push({ t: ts, before: beforeNorm || null, after: afterNorm });
        }
      }

      amountChanges.sort((a, b) => a.t - b.t);
      cardChanges.sort((a, b) => a.t - b.t);

      // Determine starting amount at activeFrom
      let currentAmount = baseAmount;
      const lastAmountAtOrBefore = [...amountChanges].reverse().find((c) => c.t <= fromMs);
      if (lastAmountAtOrBefore) {
        currentAmount = lastAmountAtOrBefore.after;
      } else {
        const firstAfterFrom = amountChanges.find((c) => c.t > fromMs);
        if (firstAfterFrom && firstAfterFrom.before !== null) currentAmount = firstAfterFrom.before;
      }

      // Determine starting card at activeFrom
      let currentCard = baseCard;
      const lastCardAtOrBefore = [...cardChanges].reverse().find((c) => c.t <= fromMs);
      if (lastCardAtOrBefore) {
        currentCard = lastCardAtOrBefore.after || currentCard;
      } else {
        const firstAfterFrom = cardChanges.find((c) => c.t > fromMs);
        if (firstAfterFrom && firstAfterFrom.before !== null) currentCard = firstAfterFrom.before;
      }

      const amountAfterByTime = new Map<number, number>();
      for (const ch of amountChanges) {
        if (ch.t > fromMs && ch.t < toMs) amountAfterByTime.set(ch.t, ch.after);
      }

      const cardAfterByTime = new Map<number, string>();
      for (const ch of cardChanges) {
        if (ch.t > fromMs && ch.t < toMs) cardAfterByTime.set(ch.t, ch.after || "");
      }

      const changeTimes = Array.from(
        new Set([
          ...Array.from(amountAfterByTime.keys()),
          ...Array.from(cardAfterByTime.keys()),
        ])
      ).sort((a, b) => a - b);

      const byCard = new Map<string, { spend: number; months: number }>();

      const addSegment = (segMs: number) => {
        if (!Number.isFinite(segMs) || segMs <= 0) return;
        const months = segMs / MS_PER_MONTH;
        const spend = toMonthly(currentAmount) * months;
        const cardKey = currentCard?.trim() ? currentCard.trim() : "Unknown";
        const prev = byCard.get(cardKey) ?? { spend: 0, months: 0 };
        byCard.set(cardKey, { spend: prev.spend + spend, months: prev.months + months });
      };

      let cursor = fromMs;
      for (const t of changeTimes) {
        addSegment(t - cursor);
        if (amountAfterByTime.has(t)) currentAmount = amountAfterByTime.get(t) ?? currentAmount;
        if (cardAfterByTime.has(t)) {
          const next = cardAfterByTime.get(t);
          if (next && next.trim()) currentCard = next;
        }
        cursor = t;
      }
      addSegment(toMs - cursor);

      return Array.from(byCard.entries())
        .map(([card, v]) => {
          const spend = Math.max(0, v.spend);
          const months = Math.max(0, v.months);
          return {
            card,
            periodSpend: spend,
            monthlyAvg: months > 0 ? spend / months : 0,
          };
        })
        .filter((r) => r.periodSpend > 0 || r.monthlyAvg > 0);
    },
    [getBestActiveStartDate, historyBySubscriptionId, periodEnd, periodStart]
  );

  const allRows = React.useMemo(() => {
    const rows: CardWiseRow[] = [];

    for (const sub of subscriptions) {
      const rawStatus = String((sub as any)?.status ?? "").trim().toLowerCase();
      if (Boolean((sub as any)?.isDraft) || rawStatus === "draft") continue;
      if (String((sub as any)?.status ?? "").toLowerCase() === "cancelled") continue;

      const subscriptionId = normalizeId((sub as any)?.id ?? (sub as any)?._id);
      const lastActivity = subscriptionId ? lastActivityMsBySubscriptionId.get(subscriptionId) ?? 0 : 0;
      const fallbackActivity = getSubscriptionFallbackActivityMs(sub);
      const activityMs = Math.max(lastActivity, fallbackActivity);

      const cardRows = computeSpendByCardInPeriod(sub);
      for (const cr of cardRows) {
        rows.push({ sub, card: cr.card, periodSpend: cr.periodSpend, monthlyAvg: cr.monthlyAvg, activityMs });
      }
    }

    return rows;
  }, [subscriptions, computeSpendByCardInPeriod, lastActivityMsBySubscriptionId]);

  const cards = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of allRows) {
      if (row.card) set.add(row.card);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const categoryBadgeWidthCh = React.useMemo(() => {
    let maxLen = 0;
    for (const row of allRows) {
      const val = String((row.sub as any)?.category ?? "").trim();
      if (val.length > maxLen) maxLen = val.length;
    }
    return Math.min(Math.max(maxLen, 6), 28);
  }, [allRows]);

  const filtered = React.useMemo(() => {
    return allRows
      .filter((row) => {
        if (selectedCard === "all") return true;
        return row.card === selectedCard;
      })
      .sort((a, b) => {
        if (b.activityMs !== a.activityMs) return b.activityMs - a.activityMs;
        return b.periodSpend - a.periodSpend;
      });
  }, [allRows, selectedCard]);

  const totals = React.useMemo(() => {
    const totalPeriodSpend = filtered.reduce((sum, row) => sum + row.periodSpend, 0);
    const totalMonthlyAvg = filtered.reduce((sum, row) => sum + row.monthlyAvg, 0);
    return { totalPeriodSpend, totalMonthlyAvg };
  }, [filtered]);

  const handleExportCsv = () => {
    const rows = filtered.map(({ sub, card, periodSpend, monthlyAvg }) => {
      return {
        Subscription: (sub as any)?.serviceName ?? "",
        Card: card,
        Category: String((sub as any)?.category ?? "").trim(),
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
    a.download = "card-wise-spend.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold text-gray-900">Card Wise Spend Report</h2>
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

              <Select value={selectedCard} onValueChange={setSelectedCard}>
                <SelectTrigger className="w-full lg:w-[280px]">
                  <SelectValue placeholder="All Cards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cards</SelectItem>
                  {cards.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="block max-w-full truncate">{c}</span>
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
                    SUBSCRIPTION
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[200px]">
                    CARD
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[160px]">
                    CATEGORY
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
                    {filtered.map(({ sub, card, periodSpend, monthlyAvg }, index) => {
                      const serviceName = String((sub as any)?.serviceName ?? "");
                      const category = String((sub as any)?.category ?? "").trim();

                      return (
                        <TableRow
                          key={String((sub as any)?.id ?? (sub as any)?._id ?? serviceName)}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                          }`}
                        >
                          <TableCell className="px-3 py-3 font-medium text-gray-800 w-[220px] max-w-[220px] overflow-hidden text-left">
                            <span title={serviceName} className="block w-full truncate whitespace-nowrap">
                              {serviceName}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-700 w-[200px] max-w-[200px] overflow-hidden text-left">
                            <span title={card} className="block w-full truncate whitespace-nowrap">
                              {card || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-700 w-[160px] max-w-[160px] overflow-hidden text-left">
                            {category ? (
                              <span
                                className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border max-w-full text-left ${getCategoryBadgeClass(
                                  category
                                )}`}
                                style={{ width: `${categoryBadgeWidthCh}ch`, maxWidth: "100%" }}
                              >
                                <span className="truncate whitespace-nowrap" title={category}>
                                  {category}
                                </span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center justify-start text-gray-400 text-xs"
                                style={{ width: `${categoryBadgeWidthCh}ch`, maxWidth: "100%" }}
                              >
                                -
                              </span>
                            )}
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
