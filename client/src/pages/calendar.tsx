import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowLeft,
  BarChart3,
  Clock,
  CheckCircle2,
  CalendarClock,
  Pencil,
  ExternalLink,
  Layers,
  Award,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CategoryKey = "all" | "subscriptions" | "compliance" | "renewals";

type TaskItem = {
  id: string;
  title: string;
  date: Date;
  category: Exclude<CategoryKey, "all">;
  statusText?: string;
  description?: string;
  sourceId?: string;
};

type CacheEnvelope<T> = {
  ts: number;
  data: T;
};

function readCache<T>(key: string): CacheEnvelope<T> | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return undefined;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    const env: CacheEnvelope<T> = { ts: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(env));
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isValidDate(d: Date) {
  return !Number.isNaN(d.getTime());
}

function formatShortMonthDay(date: Date) {
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatLongDate(date: Date) {
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(a: Date, b: Date) {
  const aa = startOfDay(a).getTime();
  const bb = startOfDay(b).getTime();
  return Math.round((aa - bb) / (1000 * 60 * 60 * 24));
}

function getCategoryButtonClass(active: boolean) {
  return active
    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-600 hover:text-white"
    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
}

function getViewButtonClass(active: boolean) {
  return active
    ? "bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-600"
    : "bg-transparent text-slate-600 border-transparent hover:bg-white";
}

function getTaskPillClass(category: TaskItem["category"]) {
  switch (category) {
    case "subscriptions":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "compliance":
      return "bg-orange-50 text-orange-700 border border-orange-200";
    case "renewals":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    default:
      return "bg-slate-50 text-slate-700 border border-slate-200";
  }
}

function getUpcomingAccentClass(category: TaskItem["category"]) {
  switch (category) {
    case "subscriptions":
      return "bg-blue-500";
    case "compliance":
      return "bg-orange-500";
    case "renewals":
      return "bg-emerald-500";
    default:
      return "bg-slate-500";
  }
}

function getCategoryLabel(category: TaskItem["category"]) {
  return category === "subscriptions" ? "Subscription" : category === "compliance" ? "Compliance" : "Renewal";
}

function getCategoryIcon(category: TaskItem["category"]) {
  return category === "subscriptions" ? Layers : category === "compliance" ? Award : ShieldCheck;
}

function getRiskInfo(targetDate: Date) {
  const today = startOfDay(new Date());
  const diff = daysBetween(targetDate, today);

  if (diff < 0) {
    return {
      label: "Overdue",
      pillClass: "bg-red-50 text-red-700 border border-red-200",
      daysText: `${Math.abs(diff)} days overdue`,
    };
  }
  if (diff <= 2) {
    return {
      label: "Critical",
      pillClass: "bg-red-50 text-red-700 border border-red-200",
      daysText: diff === 0 ? "Due today" : `${diff} days remaining`,
    };
  }
  if (diff <= 7) {
    return {
      label: "Due Soon",
      pillClass: "bg-amber-50 text-amber-700 border border-amber-200",
      daysText: `${diff} days remaining`,
    };
  }
  if (diff <= 14) {
    return {
      label: "Upcoming",
      pillClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      daysText: `${diff} days remaining`,
    };
  }
  return {
    label: "Safe",
    pillClass: "bg-slate-50 text-slate-700 border border-slate-200",
    daysText: `${diff} days remaining`,
  };
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = React.useState<CategoryKey>("all");
  const [view, setView] = React.useState<"month" | "year">("month");
  const [cursor, setCursor] = React.useState<Date>(() => startOfMonth(new Date()));

  const [dayListOpen, setDayListOpen] = React.useState(false);
  const [dayListDate, setDayListDate] = React.useState<Date | null>(null);
  const [dayListTasks, setDayListTasks] = React.useState<TaskItem[]>([]);
  const [taskListTitle, setTaskListTitle] = React.useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<TaskItem | null>(null);

  const mintDeeplinkToken = React.useCallback(async (entityType: 'subscription' | 'compliance' | 'license', id: string) => {
    const res = await fetch('/api/deeplink/token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, id }),
    });
    if (!res.ok) throw new Error('Failed to create deeplink token');
    const data = (await res.json()) as { token?: string };
    if (!data?.token) throw new Error('Invalid deeplink token response');
    return String(data.token);
  }, []);

  const openRecordModal = React.useCallback(
    (task: TaskItem) => {
      const id = String(task.sourceId ?? "").trim();
      if (!id) return;

      const entityType: 'subscription' | 'compliance' | 'license' =
        task.category === 'subscriptions' ? 'subscription' : task.category === 'compliance' ? 'compliance' : 'license';

      const route = task.category === 'subscriptions' ? '/subscriptions' : task.category === 'compliance' ? '/compliance' : '/government-license';

      void (async () => {
        try {
          const token = await mintDeeplinkToken(entityType, id);
          const search = new URLSearchParams({ openToken: token }).toString();
          navigate(`${route}?${search}`, { state: { returnTo: '/calendar' } });
        } catch {
          navigate(route, { state: { returnTo: '/calendar' } });
        }
      })();
    },
    [navigate, mintDeeplinkToken]
  );

  const openDayList = React.useCallback((date: Date, tasks: TaskItem[]) => {
    setTaskListTitle(null);
    setDayListDate(date);
    setDayListTasks(tasks);
    setDayListOpen(true);
  }, []);

  const openMonthList = React.useCallback((date: Date, tasks: TaskItem[]) => {
    setTaskListTitle(date.toLocaleString("en-US", { month: "long", year: "numeric" }));
    setDayListDate(null);
    setDayListTasks(tasks);
    setDayListOpen(true);
  }, []);

  const openDetails = React.useCallback((task: TaskItem) => {
    setSelectedTask(task);
    setDetailsOpen(true);
  }, []);

  const subscriptionsCacheKey = "calendar-cache:/api/subscriptions";
  const complianceCacheKey = "calendar-cache:/api/compliance/list";
  const licensesCacheKey = "calendar-cache:/api/licenses";

  const subsCache = readCache<any[]>(subscriptionsCacheKey);
  const compCache = readCache<any[]>(complianceCacheKey);
  const licCache = readCache<any[]>(licensesCacheKey);

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery<any[]>({
    queryKey: ["/api/subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      const data = await res.json();
      writeCache(subscriptionsCacheKey, data);
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: subsCache?.data,
    initialDataUpdatedAt: subsCache?.ts,
  });

  const { data: complianceList = [], isLoading: complianceLoading } = useQuery<any[]>({
    queryKey: ["/api/compliance/list"],
    queryFn: async () => {
      const res = await fetch("/api/compliance/list", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch compliance data");
      const data = await res.json();
      writeCache(complianceCacheKey, data);
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: compCache?.data,
    initialDataUpdatedAt: compCache?.ts,
  });

  const { data: licenses = [], isLoading: licensesLoading } = useQuery<any[]>({
    queryKey: ["/api/licenses"],
    queryFn: async () => {
      const res = await fetch("/api/licenses", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch renewals");
      const data = await res.json();
      writeCache(licensesCacheKey, data);
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: licCache?.data,
    initialDataUpdatedAt: licCache?.ts,
  });

  const isLoading = subscriptionsLoading || complianceLoading || licensesLoading;

  const tasks = React.useMemo<TaskItem[]>(() => {
    const out: TaskItem[] = [];

    (Array.isArray(subscriptions) ? subscriptions : []).forEach((sub) => {
      const status = String(sub?.status ?? "").toLowerCase();
      if (status === "cancelled") return;

      const raw = sub?.nextRenewal ?? sub?.renewalDate ?? sub?.endDate;
      if (!raw) return;
      const date = new Date(String(raw));
      if (!isValidDate(date)) return;

      const title = String(sub?.serviceName ?? sub?.name ?? "Subscription").trim() || "Subscription";
      out.push({
        id: `sub-${String(sub?.id ?? sub?._id ?? title)}`,
        title,
        date,
        category: "subscriptions",
        statusText: String(sub?.status ?? "").trim() || undefined,
        description: String(sub?.description ?? sub?.notes ?? "").trim() || undefined,
        sourceId: String(sub?.id ?? sub?._id ?? "").trim() || undefined,
      });
    });

    (Array.isArray(complianceList) ? complianceList : []).forEach((c) => {
      const raw = c?.submissionDeadline;
      if (!raw) return;
      const date = new Date(String(raw));
      if (!isValidDate(date)) return;

      const title = String(c?.filingName ?? c?.policy ?? "Compliance Task").trim() || "Compliance Task";
      out.push({
        id: `comp-${String(c?._id ?? c?.id ?? title)}`,
        title,
        date,
        category: "compliance",
        statusText: String(c?.status ?? "").trim() || undefined,
        description: String(c?.description ?? c?.notes ?? "").trim() || undefined,
        sourceId: String(c?._id ?? c?.id ?? "").trim() || undefined,
      });
    });

    (Array.isArray(licenses) ? licenses : []).forEach((lic) => {
      const status = String(lic?.status ?? "").toLowerCase();
      if (status === "cancelled") return;

      const raw = lic?.endDate;
      if (!raw) return;
      const date = new Date(String(raw));
      if (!isValidDate(date)) return;

      const title = String(lic?.licenseName ?? lic?.name ?? "Renewal").trim() || "Renewal";
      out.push({
        id: `ren-${String(lic?.id ?? lic?._id ?? title)}`,
        title,
        date,
        category: "renewals",
        statusText: String(lic?.status ?? "").trim() || undefined,
        description: String(lic?.description ?? lic?.notes ?? "").trim() || undefined,
        sourceId: String(lic?.id ?? lic?._id ?? "").trim() || undefined,
      });
    });

    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [subscriptions, complianceList, licenses]);

  const filteredTasks = React.useMemo(() => {
    if (activeCategory === "all") return tasks;
    return tasks.filter((t) => t.category === activeCategory);
  }, [tasks, activeCategory]);

  const monthStart = React.useMemo(() => startOfDay(startOfMonth(cursor)), [cursor]);
  const monthEnd = React.useMemo(() => endOfDay(endOfMonth(cursor)), [cursor]);

  const monthTasks = React.useMemo(() => {
    return filteredTasks.filter((t) => t.date >= monthStart && t.date <= monthEnd);
  }, [filteredTasks, monthStart, monthEnd]);

  const monthSummary = React.useMemo(() => {
    const today = startOfDay(new Date());
    const total = monthTasks.length;

    let safe = 0;
    let dueSoon = 0;
    let critical = 0;
    let overdue = 0;

    monthTasks.forEach((t) => {
      const diff = daysBetween(t.date, today);
      if (diff < 0) overdue += 1;
      else if (diff <= 2) critical += 1;
      else if (diff <= 7) dueSoon += 1;
      else safe += 1;
    });

    return { total, safe, dueSoon, critical, overdue };
  }, [monthTasks]);

  const upcoming = React.useMemo(() => {
    const today = startOfDay(new Date());
    const horizon = endOfDay(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000));
    return filteredTasks
      .filter((t) => t.date >= today && t.date <= horizon)
      .slice(0, 6);
  }, [filteredTasks]);

  const monthOnlyOptions = React.useMemo(() => {
    const selectedMonth = cursor.getMonth();
    const all = Array.from({ length: 12 }).map((_, m) => {
      const label = new Date(2000, m, 1).toLocaleString("en-US", { month: "long" });
      return { value: String(m), label, month: m };
    });
    const selected = all.find((o) => o.month === selectedMonth);
    return selected ? [selected, ...all.filter((o) => o.month !== selectedMonth)] : all;
  }, [cursor]);

  const yearBounds = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const taskYears = tasks.map((t) => t.date.getFullYear()).filter((y) => Number.isFinite(y));
    const maxTaskYear = taskYears.length ? Math.max(...taskYears) : currentYear;
    return {
      min: 2000,
      max: Math.max(maxTaskYear, currentYear + 100),
    };
  }, [tasks]);

  const yearOptions = React.useMemo(() => {
    const out: Array<{ value: string; label: string; year: number }> = [];
    for (let y = yearBounds.min; y <= yearBounds.max; y += 1) {
      out.push({ value: String(y), label: String(y), year: y });
    }
    return out;
  }, [yearBounds.max, yearBounds.min]);

  const cursorYearValue = React.useMemo(() => String(cursor.getFullYear()), [cursor]);

  const cursorMonthValue = React.useMemo(() => String(cursor.getMonth()), [cursor]);

  const goPrev = () =>
    setCursor((prev) =>
      view === "year"
        ? new Date(Math.max(yearBounds.min, prev.getFullYear() - 1), 0, 1)
        : new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );

  const goNext = () =>
    setCursor((prev) =>
      view === "year"
        ? new Date(Math.min(yearBounds.max, prev.getFullYear() + 1), 0, 1)
        : new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );

  const calendarGrid = React.useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);

    const firstWeekday = first.getDay(); // 0 Sun
    const daysInMonth = last.getDate();

    const cells: Array<{ inMonth: boolean; day: number; date: Date }> = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ inMonth: false, day: 0, date: new Date(first.getFullYear(), first.getMonth(), 1 - (firstWeekday - i)) });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ inMonth: true, day: d, date: new Date(first.getFullYear(), first.getMonth(), d) });
    }

    while (cells.length % 7 !== 0) {
      const nextDay = cells.length - (firstWeekday + daysInMonth) + 1;
      cells.push({ inMonth: false, day: 0, date: new Date(first.getFullYear(), first.getMonth() + 1, nextDay) });
    }

    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const byDay = new Map<string, TaskItem[]>();
    monthTasks.forEach((t) => {
      const key = `${t.date.getFullYear()}-${t.date.getMonth()}-${t.date.getDate()}`;
      const arr = byDay.get(key) ?? [];
      arr.push(t);
      byDay.set(key, arr);
    });

    return { weeks, byDay };
  }, [cursor, monthTasks]);

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        {/* Day list modal (opened by '+N more') */}
        <Dialog open={dayListOpen} onOpenChange={setDayListOpen}>
          <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden bg-white text-slate-900 border-slate-200 shadow-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {taskListTitle ?? (dayListDate ? formatLongDate(dayListDate) : "")}
              </DialogTitle>
            </DialogHeader>

            {dayListTasks.length === 0 ? (
              <div className="text-sm text-slate-500">No tasks for this day.</div>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-2 max-h-[60vh]">
                {dayListTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                    onClick={() => {
                      setDayListOpen(false);
                      openDetails(t);
                    }}
                  >
                    <div className={`h-2 w-2 rounded-full ${getUpcomingAccentClass(t.category)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="min-w-0 max-w-full text-sm font-semibold text-slate-900 truncate" title={t.title}>
                        {t.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getTaskPillClass(t.category)}`}>
                          {getCategoryLabel(t.category)}
                        </span>
                        {t.statusText ? <span className="text-xs text-slate-500">{t.statusText}</span> : null}
                      </div>
                    </div>
                    {dayListDate ? null : (
                      <div className="text-xs text-slate-600 whitespace-nowrap">{formatShortMonthDay(t.date)}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Event details modal (opened by clicking a task) */}
        <Dialog
          open={detailsOpen}
          onOpenChange={(open) => {
            setDetailsOpen(open);
            if (!open) setSelectedTask(null);
          }}
        >
          <DialogContent className="max-w-2xl bg-white text-slate-900 border-slate-200 shadow-2xl rounded-2xl">
            {selectedTask ? (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-semibold text-slate-900">{selectedTask.title}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(() => {
                        const Icon = getCategoryIcon(selectedTask.category);
                        return (
                          <span className="inline-flex items-center gap-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-sm font-medium">
                            <Icon className="h-4 w-4" />
                            {getCategoryLabel(selectedTask.category)}
                          </span>
                        );
                      })()}

                      {(() => {
                        const risk = getRiskInfo(selectedTask.date);
                        return (
                          <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-medium ${risk.pillClass}`}>
                            <CalendarDays className="h-4 w-4" />
                            {risk.label} — {risk.daysText}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-slate-500">DUE DATE</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{formatLongDate(selectedTask.date)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-slate-500">STATUS</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{selectedTask.statusText || "Active"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-slate-500">CATEGORY</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{getCategoryLabel(selectedTask.category)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-slate-500">RISK LEVEL</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{getRiskInfo(selectedTask.date).label}</div>
                  </div>
                </div>

                <div className="mt-5 text-slate-700">
                  {selectedTask.description ? (
                    <div className="text-sm">{selectedTask.description}</div>
                  ) : (
                    <div className="text-sm text-slate-500">No description available.</div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    className="h-11 justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setDetailsOpen(false)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Completed
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 justify-center gap-2"
                    onClick={() => {
                      setDetailsOpen(false);
                      openRecordModal(selectedTask);
                    }}
                  >
                    <CalendarClock className="h-4 w-4" />
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 justify-center gap-2"
                    onClick={() => {
                      setDetailsOpen(false);
                      openRecordModal(selectedTask);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Event
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 justify-center gap-2 text-blue-700 border-blue-200 hover:bg-blue-50"
                    onClick={() => {
                      setDetailsOpen(false);
                      openRecordModal(selectedTask);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Record
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <div className="flex items-start justify-between gap-6 mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-10 w-10 p-0 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                  return;
                }
                navigate("/dashboard");
              }}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="h-10 w-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
            </div>
          </div>

          <div className="w-full max-w-[560px]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                variant="outline"
                className={`h-9 rounded-full px-4 ${getCategoryButtonClass(activeCategory === "all")}`}
                onClick={() => setActiveCategory("all")}
              >
                All Categories
              </Button>
              <Button
                variant="outline"
                className={`h-9 rounded-full px-4 ${getCategoryButtonClass(activeCategory === "subscriptions")}`}
                onClick={() => setActiveCategory("subscriptions")}
              >
                Subscriptions
              </Button>
              <Button
                variant="outline"
                className={`h-9 rounded-full px-4 ${getCategoryButtonClass(activeCategory === "compliance")}`}
                onClick={() => setActiveCategory("compliance")}
              >
                Compliance
              </Button>
              <Button
                variant="outline"
                className={`h-9 rounded-full px-4 ${getCategoryButtonClass(activeCategory === "renewals")}`}
                onClick={() => setActiveCategory("renewals")}
              >
                Renewals
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  className={`h-9 px-4 rounded-lg text-sm font-medium border ${getViewButtonClass(view === "month")}`}
                  onClick={() => {
                    setView("month");
                    setCursor(startOfMonth(new Date()));
                  }}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={`h-9 px-4 rounded-lg text-sm font-medium border ${getViewButtonClass(view === "year")}`}
                  onClick={() => {
                    setView("year");
                    setCursor(new Date(new Date().getFullYear(), 0, 1));
                  }}
                >
                  Year
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-10 w-10 p-0 bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                  onClick={goPrev}
                  aria-label={view === "year" ? "Previous year" : "Previous month"}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="min-w-[200px]">
                  <Select
                    value={view === "year" ? cursorYearValue : cursorMonthValue}
                    onValueChange={(v) => {
                      if (view === "year") {
                        const y = Number(v);
                        if (!Number.isNaN(y)) setCursor(new Date(y, 0, 1));
                        return;
                      }
                      const m = Number(v);
                      if (!Number.isNaN(m)) setCursor((prev) => new Date(prev.getFullYear(), m, 1));
                    }}
                  >
                    <SelectTrigger className="h-10 bg-white [&>svg]:text-blue-700">
                      <SelectValue
                        placeholder={
                          view === "year"
                            ? String(cursor.getFullYear())
                            : new Date(2000, cursor.getMonth(), 1).toLocaleString("en-US", { month: "long" })
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px]">
                      {view === "year"
                        ? yearOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))
                        : monthOnlyOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  className="h-10 w-10 p-0 bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                  onClick={goNext}
                  aria-label={view === "year" ? "Next year" : "Next month"}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <Skeleton className="h-[420px] w-full" />
                  </div>
                ) : view === "month" ? (
                  <div className="bg-white">
                    <div className="grid grid-cols-7 border-b border-slate-200">
                      {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                        <div key={d} className="px-3 py-3 text-xs font-semibold text-slate-500">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7">
                      {calendarGrid.weeks.flat().map((cell) => {
                        const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
                        const list = calendarGrid.byDay.get(key) ?? [];
                        const inMonth = cell.inMonth;
                        const isToday = isSameDay(cell.date, new Date());

                        return (
                          <div
                            key={key}
                            className={`min-h-[120px] border-b border-r border-slate-200 p-2 ${
                              !inMonth ? "bg-slate-50" : "bg-white"
                            }`}
                          >
                            <div
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold ${
                                isToday && inMonth
                                  ? "bg-blue-600 text-white"
                                  : inMonth
                                    ? "text-slate-900"
                                    : "text-slate-400"
                              }`}
                            >
                              {cell.date.getDate()}
                            </div>
                            <div className="mt-1 space-y-1">
                              {list.slice(0, 2).map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className={`flex w-full items-center gap-1 text-left text-xs px-2 py-1 rounded-full ${getTaskPillClass(t.category)}`}
                                  title={t.title}
                                  onClick={() => openDetails(t)}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${getUpcomingAccentClass(t.category)}`} />
                                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                                </button>
                              ))}
                              {list.length > 2 && (
                                <button
                                  type="button"
                                  className="text-[11px] text-slate-500 hover:text-slate-700"
                                  onClick={() => openDayList(cell.date, list)}
                                >
                                  +{list.length - 2} more
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Array.from({ length: 12 }).map((_, m) => {
                        const d = new Date(cursor.getFullYear(), m, 1);
                        const ms = startOfDay(startOfMonth(d));
                        const me = endOfDay(endOfMonth(d));
                        const monthList = filteredTasks.filter((t) => t.date >= ms && t.date <= me);
                        const count = monthList.length;
                        const hasItems = count > 0;

                        return (
                          <button
                            key={m}
                            type="button"
                            className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
                            onClick={() => openMonthList(d, monthList)}
                          >
                            <div className="text-sm font-semibold text-slate-900">
                              {d.toLocaleString("en-US", { month: "long" })}
                            </div>
                            <div className="text-xs mt-1">
                              <span className={hasItems ? "font-semibold text-blue-700" : "text-slate-500"}>{count}</span>{" "}
                              <span className={hasItems ? "text-blue-700" : "text-slate-500"}>tasks</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-600" />
                    Month Summary
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                    {cursor.toLocaleString("en-US", { month: "short", year: "numeric" })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> Total items
                  </div>
                  <div className="font-semibold text-slate-900">{monthSummary.total}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Safe (&gt;7 days)
                  </div>
                  <div className="font-semibold text-emerald-600">{monthSummary.safe}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Due Soon (3-7d)
                  </div>
                  <div className="font-semibold text-amber-600">{monthSummary.dueSoon}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-red-500" /> Critical (0-2d)
                  </div>
                  <div className="font-semibold text-red-600">{monthSummary.critical}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-red-800" /> Overdue
                  </div>
                  <div className="font-semibold text-red-800">{monthSummary.overdue}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-600" />
                    Upcoming
                  </span>
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">
                    {upcoming.length} items
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : upcoming.length === 0 ? (
                  <div className="text-sm text-slate-500">No upcoming tasks in the next 30 days.</div>
                ) : (
                  upcoming.slice(0, 4).map((t) => {
                    const today = startOfDay(new Date());
                    const diff = daysBetween(t.date, today);
                    const rightText = diff === 0 ? "Today" : `${diff}d`;

                    return (
                      <div key={t.id} className="flex items-stretch gap-3">
                        <div className={`w-1.5 rounded-full ${getUpcomingAccentClass(t.category)}`} />
                        <div className="flex-1 min-w-0 border border-slate-200 rounded-xl p-3 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate" title={t.title}>
                                {t.title}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getTaskPillClass(t.category)}`}>
                                  {t.category === "subscriptions"
                                    ? "Subscriptions"
                                    : t.category === "compliance"
                                      ? "Compliance"
                                      : "Renewals"}
                                </span>
                                {t.statusText ? <span className="text-xs text-slate-500">{t.statusText}</span> : null}
                              </div>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <div className="text-xs text-slate-500">{formatShortMonthDay(t.date)}</div>
                              <div className={`text-xs font-semibold ${diff === 0 ? "text-red-600" : "text-slate-700"}`}>{rightText}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
