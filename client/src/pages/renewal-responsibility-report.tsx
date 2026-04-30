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
  endDate?: string;
  responsiblePerson?: string;
  renewalStatus?: string;
  status?: string;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateLike(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isCompletedRenewal(lic: License): boolean {
  const s = String((lic as any)?.renewalStatus ?? "").trim().toLowerCase();
  if (!s) return false;
  return s.includes("approved") || s.includes("completed") || s.includes("success") || s === "done";
}

export default function RenewalResponsibilityReport() {
  const navigate = useNavigate();

  const { data: licenses = [], isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const rows = React.useMemo(() => {
    const today = startOfDay(new Date());

    type Row = {
      person: string;
      totalRenewals: number;
      upcoming: number;
      expired: number;
      completed: number;
    };

    const map = new Map<string, Row>();

    (licenses || []).forEach((lic) => {
      const person =
        String((lic as any)?.renewalPerson1 || "").trim() ||
        String((lic as any)?.responsiblePerson || "").trim() ||
        "Unassigned";
      const expiry = parseDateLike((lic as any)?.endDate);
      const isExpired = expiry ? startOfDay(expiry).getTime() < today.getTime() : false;
      const isUpcoming = expiry ? startOfDay(expiry).getTime() >= today.getTime() : false;
      const completed = isCompletedRenewal(lic);

      const existing = map.get(person) || {
        person,
        totalRenewals: 0,
        upcoming: 0,
        expired: 0,
        completed: 0,
      };

      existing.totalRenewals += 1;
      existing.upcoming += isUpcoming ? 1 : 0;
      existing.expired += isExpired ? 1 : 0;
      existing.completed += completed ? 1 : 0;

      map.set(person, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.person.localeCompare(b.person));
  }, [licenses]);

  const totals = React.useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.totalRenewals += r.totalRenewals;
        acc.upcoming += r.upcoming;
        acc.expired += r.expired;
        acc.completed += r.completed;
        return acc;
      },
      { totalRenewals: 0, upcoming: 0, expired: 0, completed: 0 },
    );
  }, [rows]);

  const handleExportCsv = () => {
    const exportRows = rows.map((r) => ({
      RenewalPerson: r.person,
      TotalRenewals: r.totalRenewals,
      Upcoming: r.upcoming,
      Expired: r.expired,
      Completed: r.completed,
    }));

    const csv = Papa.unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "renewal-responsibility-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col min-h-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-4xl font-bold text-gray-900">Renewal Responsibility Report</h2>

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
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Renewal Person</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide">Total Renewals</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide">Upcoming</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide">Expired</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide">Completed</TableHead>
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
                  <>
                    <AnimatePresence>
                      {rows.map((r, index) => (
                        <motion.tr
                          key={r.person}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: 0.04 * index }}
                          className={`border-b border-gray-100 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-indigo-50/40`}
                        >
                          <TableCell className="px-3 py-3 font-medium text-gray-800">
                            <div title={r.person} className="group inline-flex items-center gap-1 max-w-full text-left">
                              <span className="relative font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors duration-200 truncate max-w-[260px]">
                                {r.person}
                                <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
                              </span>
                              <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">
                                →
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-center text-sm font-medium text-gray-900">{r.totalRenewals}</TableCell>
                          <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.upcoming}</TableCell>
                          <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.expired}</TableCell>
                          <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.completed}</TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>

                    <TableRow>
                      <TableCell className="sticky bottom-0 z-20 bg-gray-200 text-lg font-bold text-gray-900 py-4 border-t border-gray-200">Grand Total</TableCell>
                      <TableCell className="sticky bottom-0 z-20 bg-gray-200 text-center text-lg font-bold text-indigo-600 py-4 border-t border-gray-200">{totals.totalRenewals}</TableCell>
                      <TableCell className="sticky bottom-0 z-20 bg-gray-200 text-center text-lg font-bold text-indigo-600 py-4 border-t border-gray-200">{totals.upcoming}</TableCell>
                      <TableCell className="sticky bottom-0 z-20 bg-gray-200 text-center text-lg font-bold text-indigo-600 py-4 border-t border-gray-200">{totals.expired}</TableCell>
                      <TableCell className="sticky bottom-0 z-20 bg-gray-200 text-center text-lg font-bold text-indigo-600 py-4 border-t border-gray-200">{totals.completed}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
      </div>
    </div>
  );
}
