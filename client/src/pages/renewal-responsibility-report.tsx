import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <div className="p-8">
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
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
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Renewal Person</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">Total Renewals</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">Upcoming</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">Expired</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">Completed</TableHead>
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
                    {rows.map((r) => (
                      <TableRow key={r.person} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <TableCell className="px-3 py-3 font-medium text-gray-800">{r.person}</TableCell>
                        <TableCell className="px-3 py-3 text-center text-sm font-medium text-gray-900">{r.totalRenewals}</TableCell>
                        <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.upcoming}</TableCell>
                        <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.expired}</TableCell>
                        <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.completed}</TableCell>
                      </TableRow>
                    ))}

                    <TableRow className="bg-gray-100 border-t-2 border-gray-300">
                      <TableCell className="text-lg font-bold text-gray-900 py-4">Grand Total</TableCell>
                      <TableCell className="text-center text-lg font-bold text-indigo-600 py-4">{totals.totalRenewals}</TableCell>
                      <TableCell className="text-center text-lg font-bold text-indigo-600 py-4">{totals.upcoming}</TableCell>
                      <TableCell className="text-center text-lg font-bold text-indigo-600 py-4">{totals.expired}</TableCell>
                      <TableCell className="text-center text-lg font-bold text-indigo-600 py-4">{totals.completed}</TableCell>
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
