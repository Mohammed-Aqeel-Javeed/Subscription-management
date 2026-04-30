import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar, Download } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";

type ComplianceListItem = {
  _id?: string;
  id?: string;
  policy?: string;
  filingName?: string;
  complianceName?: string;
  name?: string;
  category?: string;
  complianceCategory?: string;
  status?: string;
  submissionDeadline?: string;
  filingSubmissionDeadline?: string;
  owner?: string;
};

type RangePreset = "next30" | "next7" | "next90";

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

function parseDateValue(value: unknown): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();
  if (!str) return null;

  const iso = new Date(str);
  if (!Number.isNaN(iso.getTime())) return iso;

  // DD/MM/YYYY or DD-MM-YYYY
  const m = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+.*)?$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const dmy = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(dmy.getTime()) ? null : dmy;
  }

  return null;
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

function getFilingName(item: ComplianceListItem) {
  return String(item.policy || item.filingName || item.complianceName || item.name || "").trim();
}

function getCategory(item: ComplianceListItem) {
  return String(item.complianceCategory || item.category || "").trim();
}

function getDueDate(item: ComplianceListItem): Date | null {
  return parseDateValue(item.submissionDeadline || item.filingSubmissionDeadline);
}

function getStatus(item: ComplianceListItem, dueDate: Date | null): string {
  const raw = String(item.status || "").trim();
  if (raw) return raw;
  if (!dueDate) return "";

  const today = startOfDay(new Date());
  const target = startOfDay(dueDate);

  if (target.getTime() === today.getTime()) return "Due Today";
  if (target.getTime() < today.getTime()) return "Overdue";
  return "Pending";
}

export default function UpcomingFilingsReport() {
  const navigate = useNavigate();
  const [rangePreset, setRangePreset] = React.useState<RangePreset>("next30");

  const { data: complianceItems = [], isLoading } = useQuery<ComplianceListItem[]>({
    queryKey: ["compliance", "list"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/compliance/list");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { fromDate, toDate } = React.useMemo(() => {
    const start = startOfDay(new Date());
    if (rangePreset === "next7") return { fromDate: start, toDate: endOfDay(addDays(start, 7)) };
    if (rangePreset === "next90") return { fromDate: start, toDate: endOfDay(addDays(start, 90)) };
    return { fromDate: start, toDate: endOfDay(addDays(start, 30)) };
  }, [rangePreset]);

  const upcoming = React.useMemo(() => {
    const today = fromDate;
    const horizon = toDate;

    return complianceItems
      .map((item) => {
        const dueDate = getDueDate(item);
        return { item, dueDate };
      })
      .filter(({ dueDate }) => {
        if (!dueDate) return false;
        const d = startOfDay(dueDate);
        return d.getTime() >= today.getTime() && d.getTime() <= horizon.getTime();
      })
      .sort((a, b) => {
        return startOfDay(a.dueDate as Date).getTime() - startOfDay(b.dueDate as Date).getTime();
      });
  }, [complianceItems, fromDate, toDate]);

  const handleExportCsv = () => {
    const rows = upcoming.map(({ item, dueDate }) => {
      const today = startOfDay(new Date());
      const target = dueDate ? startOfDay(dueDate) : null;
      const diffDays = target ? Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

      return {
        FilingName: getFilingName(item) || "",
        Category: getCategory(item) || "",
        Status: getStatus(item, dueDate) || "",
        DueDate: dueDate ? dueDate.toISOString().split("T")[0] : "",
        DaysRemaining: diffDays == null ? "" : String(diffDays),
        AssignedOwner: String(item.owner || "").trim(),
      };
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "upcoming-filings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col min-h-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-4xl font-bold text-gray-900">Upcoming Filings</h2>

        <Button
          type="button"
          onClick={() => navigate("/reports")}
          className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <div className="mb-6 shrink-0">
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
      </div>

      <div className="rounded-lg bg-white border border-gray-200 shadow-md overflow-hidden flex-1 min-h-0 flex flex-col">
        <Table containerClassName="flex-1 min-h-0 overflow-auto" className="table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">
                    FILING NAME
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">
                    CATEGORY
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">
                    STATUS
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">
                    DUE DATE
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide">
                    DAYS REMAINING
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">
                    ASSIGNED OWNER
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
                ) : upcoming.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No upcoming filings in the selected range.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    <AnimatePresence>
                      {upcoming.map(({ item, dueDate }, index) => {
                      const filingName = getFilingName(item);
                      const category = getCategory(item);
                      const owner = String(item.owner || "").trim();

                      const today = startOfDay(new Date());
                      const target = dueDate ? startOfDay(dueDate) : null;
                      const diffDays = target ? Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : NaN;

                      return (
                        <motion.tr
                          key={String(item._id || item.id || filingName)}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: 0.04 * index }}
                          className={`border-b border-gray-100 transition-colors ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          } hover:bg-indigo-50/40`}
                        >
                          <TableCell className="px-3 py-3 font-medium text-gray-800">
                            <div
                              title={filingName || ""}
                              className="group inline-flex items-center gap-1 max-w-full text-left"
                            >
                              <span className="relative font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors duration-200 truncate max-w-[250px]">
                                {filingName || "—"}
                                <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
                              </span>
                              <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">
                                →
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600">{category || "—"}</TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600">{getStatus(item, dueDate) || "—"}</TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600">
                            {dueDate ? (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span>{formatDateDMY(dueDate)}</span>
                                <span className={getDaysLeftMeta(dueDate).className}>{getDaysLeftMeta(dueDate).label}</span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-center text-sm font-medium text-gray-900">
                            {Number.isFinite(diffDays) ? String(diffDays) : "—"}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-sm text-gray-600">{owner || "—"}</TableCell>
                        </motion.tr>
                      );
                      })}
                    </AnimatePresence>

                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="sticky bottom-0 z-20 bg-gray-200 text-lg font-bold text-gray-900 py-4 border-t border-gray-200"
                      >
                        Grand Total
                      </TableCell>
                      <TableCell className="sticky bottom-0 z-20 bg-gray-200 text-left text-lg font-bold text-indigo-600 py-4 border-t border-gray-200">
                        {upcoming.length}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
      </div>
    </div>
  );
}
