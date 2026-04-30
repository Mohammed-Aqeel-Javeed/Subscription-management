import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download } from "lucide-react";

type License = {
  id?: string;
  _id?: string;
  licenseName?: string;
  endDate?: string;
  reminderDays?: number | string;
  responsiblePerson?: string;
  renewalStatus?: string;
  status?: string;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseDateLike(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateISO(value: Date | null): string {
  if (!value) return "";
  return value.toISOString().split("T")[0];
}

function parseReminderDays(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function getReminderStatus(lic: License): string {
  const today = startOfDay(new Date());
  const expiry = parseDateLike((lic as any)?.endDate);
  if (!expiry) return "Reminder Pending";

  if (startOfDay(expiry).getTime() < today.getTime()) return "Expired";

  const reminderDays = parseReminderDays((lic as any)?.reminderDays);
  if (reminderDays == null) return "Reminder Pending";

  const trigger = startOfDay(addDays(expiry, -reminderDays));
  if (today.getTime() >= trigger.getTime()) return "Reminder Sent";

  return "Reminder Pending";
}

export default function RenewalLeadTimeAnalysisReport() {
  const navigate = useNavigate();

  const { data: licenses = [], isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const rows = React.useMemo(() => {
    const items = (licenses || [])
      .map((lic) => {
        const expiry = parseDateLike((lic as any)?.endDate);
        const reminderDays = parseReminderDays((lic as any)?.reminderDays);
        const responsible =
          String((lic as any)?.renewalPerson1 || "").trim() ||
          String((lic as any)?.responsiblePerson || "").trim() ||
          "Unassigned";

        return {
          id: String((lic as any)?.id ?? (lic as any)?._id ?? (lic as any)?.licenseName ?? Math.random()),
          title: String((lic as any)?.licenseName || "").trim(),
          expiryDate: expiry,
          reminderDays: reminderDays ?? "",
          responsiblePerson: responsible,
          status: getReminderStatus(lic),
        };
      })
      .sort((a, b) => {
        const aTime = a.expiryDate ? a.expiryDate.getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.expiryDate ? b.expiryDate.getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });

    return items;
  }, [licenses]);

  const handleExportCsv = () => {
    const exportRows = rows.map((r) => ({
      Title: r.title,
      ExpiryDate: formatDateISO(r.expiryDate),
      ReminderDays: r.reminderDays,
      ResponsiblePerson: r.responsiblePerson,
      Status: r.status,
    }));

    const csv = Papa.unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "renewal-lead-time-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col min-h-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-4xl font-bold text-gray-900">Renewal Lead Time Analysis</h2>

        <Button
          type="button"
          onClick={() => navigate("/reports")}
          className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <div className="mb-6 shrink-0 flex justify-end">
        <Button
          onClick={handleExportCsv}
          className="w-full lg:w-auto bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
          type="button"
        >
          <Download />
          Export to CSV
        </Button>
      </div>

      <div className="rounded-lg bg-white border border-gray-200 shadow-md overflow-hidden flex-1 min-h-0 flex flex-col">
      <Table containerClassName="flex-1 min-h-0 overflow-auto" className="table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Title</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Expiry Date</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide">Reminder Days</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Responsible Person</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No renewals found.
                    </TableCell>
                  </TableRow>
                ) : (
                  <AnimatePresence>
                    {rows.map((r, index) => (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.04 * index }}
                        className={`border-b border-gray-100 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-indigo-50/40`}
                      >
                        <TableCell className="px-3 py-3 font-medium text-gray-800">
                          <div title={r.title} className="group inline-flex items-center gap-1 max-w-full text-left">
                            <span className="relative font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors duration-200 truncate max-w-[350px]">
                              {r.title}
                              <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
                            </span>
                            <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">
                              →
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-600">{formatDateISO(r.expiryDate)}</TableCell>
                        <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.reminderDays}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-600">{r.responsiblePerson}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-600">{r.status}</TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </TableBody>
            </Table>
      </div>
    </div>
  );
}
