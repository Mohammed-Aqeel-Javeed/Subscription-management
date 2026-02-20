import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar, Download } from "lucide-react";

import type { Subscription } from "@shared/schema";

type RangePreset = "next30" | "next7" | "next90";

function isDraftSubscription(sub: Subscription): boolean {
  const rawStatus = String((sub as any)?.status ?? "").trim().toLowerCase();
  return Boolean((sub as any)?.isDraft) || rawStatus === "draft";
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

  // Try to unwrap JSON/quoted values a few times.
  for (let attempts = 0; attempts < 3; attempts++) {
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        return normalizeDepartmentTokens(parsed);
      } catch {
        const withDoubleQuotes = s.replace(/'/g, '"');
        try {
          const parsed = JSON.parse(withDoubleQuotes);
          return normalizeDepartmentTokens(parsed);
        } catch {
          break;
        }
      }
    }

    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      try {
        const parsed = JSON.parse(s);
        if (typeof parsed === "string") {
          s = parsed.trim();
          continue;
        }
        return normalizeDepartmentTokens(parsed);
      } catch {
        s = s.slice(1, -1).trim();
        continue;
      }
    }

    break;
  }

  if (s.includes("|")) return s.split("|").map((p) => p.trim()).filter(Boolean);

  if (s.startsWith("[") || s.startsWith("{")) return [];

  return [s];
}

function getNormalizedDepartments(sub: Subscription): string[] {
  const out: string[] = [];
  out.push(...normalizeDepartmentTokens((sub as any)?.departments));
  out.push(...normalizeDepartmentTokens((sub as any)?.department));
  return Array.from(new Set(out.map((d) => d.trim()).filter(Boolean)));
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

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateDMY(value: Date) {
  const dd = String(value.getDate()).padStart(2, "0");
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const yyyy = String(value.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function getDaysLeftMeta(target: Date) {
  const today = startOfDay(new Date());
  const diffMs = startOfDay(target).getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: "(Today)", className: "text-orange-500" };
  if (diffDays > 0) return { label: `(${diffDays} day${diffDays === 1 ? "" : "s"})`, className: "text-orange-500" };
  const overdueDays = Math.abs(diffDays);
  return { label: `(${overdueDays} day${overdueDays === 1 ? "" : "s"} ago)`, className: "text-rose-600" };
}

function getMonthlyAmount(sub: Subscription) {
  const raw = Number((sub as any).amount ?? 0);
  const cycle = String((sub as any).billingCycle ?? "").toLowerCase();
  if (!Number.isFinite(raw)) return 0;
  if (cycle === "monthly") return raw;
  if (cycle === "yearly") return raw / 12;
  if (cycle === "quarterly") return raw / 3;
  if (cycle === "weekly") return (raw * 52) / 12;
  return raw;
}

export default function UpcomingRenewalReport() {
  const navigate = useNavigate();
  const [rangePreset, setRangePreset] = React.useState<RangePreset>("next30");
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("all");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");

  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const { fromDate, toDate } = React.useMemo(() => {
    const start = startOfDay(new Date());
    if (rangePreset === "next7") return { fromDate: start, toDate: endOfDay(addDays(start, 7)) };
    if (rangePreset === "next90") return { fromDate: start, toDate: endOfDay(addDays(start, 90)) };
    return { fromDate: start, toDate: endOfDay(addDays(start, 30)) };
  }, [rangePreset]);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    subscriptions.forEach((sub) => {
      if (isDraftSubscription(sub)) return;
      getNormalizedDepartments(sub).forEach((d) => {
        if (d) set.add(d);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [subscriptions]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    subscriptions.forEach((sub) => {
      if (isDraftSubscription(sub)) return;
      const cat = String((sub as any)?.category ?? "").trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [subscriptions]);

  const filtered = React.useMemo(() => {
    return subscriptions
      .filter((sub) => !isDraftSubscription(sub))
      .filter((sub) => String((sub as any)?.status ?? "").toLowerCase() !== "cancelled")
      .filter((sub) => {
        const nr = (sub as any)?.nextRenewal;
        const date = nr ? new Date(nr) : null;
        if (!date || Number.isNaN(date.getTime())) return false;
        return date >= fromDate && date <= toDate;
      })
      .filter((sub) => {
        if (selectedDepartment === "all") return true;
        return getNormalizedDepartments(sub).includes(selectedDepartment);
      })
      .filter((sub) => {
        if (selectedCategory === "all") return true;
        return String((sub as any)?.category ?? "") === selectedCategory;
      })
      .sort((a, b) => {
        const aDate = new Date((a as any)?.nextRenewal);
        const bDate = new Date((b as any)?.nextRenewal);
        return aDate.getTime() - bDate.getTime();
      });
  }, [subscriptions, fromDate, toDate, selectedDepartment, selectedCategory]);

  const handleExportCsv = () => {
    const rows = filtered.map((sub) => {
      const deps = getNormalizedDepartments(sub);
      const department = deps.length > 0 ? deps.join("|") : "";
      const renewalDate = (sub as any)?.nextRenewal ? new Date((sub as any).nextRenewal) : null;

      return {
        SubscriptionName: (sub as any)?.serviceName ?? "",
        Vendor: (sub as any)?.vendor ?? "",
        Department: department,
        Category: (sub as any)?.category ?? "",
        RenewalDate: renewalDate ? renewalDate.toISOString().split("T")[0] : "",
        Quantity: 1,
        AmountMonthly: getMonthlyAmount(sub).toFixed(2),
      };
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "upcoming-renewals.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-4xl font-bold text-gray-900">Upcoming Renewal</h2>

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
                  <SelectItem value="next7">Next 7 days</SelectItem>
                  <SelectItem value="next30">Next 30 days</SelectItem>
                  <SelectItem value="next90">Next 90 days</SelectItem>
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
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-gray-400 bg-gray-200">
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">SERVICE</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">VENDOR</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">DEPARTMENT</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">RENEWAL DATE</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">QUANTITY</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-right text-xs font-bold text-gray-800 uppercase tracking-wide">AMOUNT</TableHead>
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
                      No upcoming renewals in the selected range.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filtered.map((sub) => {
                      const deps = getNormalizedDepartments(sub);
                      const renewalDate = (sub as any)?.nextRenewal ? new Date((sub as any).nextRenewal) : null;
                      const monthly = getMonthlyAmount(sub);

                      return (
                        <TableRow 
                          key={String((sub as any)?.id ?? (sub as any)?._id ?? (sub as any)?.serviceName)}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <TableCell className="px-3 py-3 font-medium text-gray-800">
                            <span className="block truncate max-w-[250px]" title={(sub as any)?.serviceName ?? ""}>
                              {(sub as any)?.serviceName ?? ""}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600">{(sub as any)?.vendor ?? ""}</TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600">
                            {deps.length > 0 ? (
                              <div
                                className="flex flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap max-w-full"
                                title={deps.join(", ")}
                              >
                                {deps.map((d) => (
                                  <Badge
                                    key={d}
                                    variant="secondary"
                                    className="rounded-full bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border border-indigo-200 font-medium text-xs leading-none py-1 px-3 whitespace-nowrap flex-shrink-0"
                                  >
                                    {d}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600">
                            {renewalDate ? (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span>{formatDateDMY(renewalDate)}</span>
                                <span className={getDaysLeftMeta(renewalDate).className}>
                                  {getDaysLeftMeta(renewalDate).label}
                                </span>
                              </div>
                            ) : (
                              ""
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-center text-sm font-medium text-gray-900">1</TableCell>
                          <TableCell className="px-3 py-3 text-right text-sm font-medium text-gray-900">
                            ${monthly.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-gray-100 border-t-2 border-gray-300">
                      <TableCell colSpan={4} className="text-lg font-bold text-gray-900 py-4">
                        Grand Total
                      </TableCell>
                      <TableCell className="text-center text-lg font-bold text-indigo-600 py-4">
                        {filtered.length}
                      </TableCell>
                      <TableCell className="text-right text-lg font-bold text-indigo-600 py-4">
                        ${filtered.reduce((sum, sub) => sum + getMonthlyAmount(sub), 0).toFixed(2)}
                      </TableCell>
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
