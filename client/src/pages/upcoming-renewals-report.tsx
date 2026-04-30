import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

type License = {
  id?: string;
  _id?: string;
  licenseName?: string;
  category?: string;
  beneficiaryNameNo?: string;
  entityOwner?: string;
  endDate?: string;
  responsiblePerson?: string;
  renewalPerson1?: string;
  department?: unknown;
  departments?: unknown;
  lcyAmount?: number;
  renewalAmount?: number;
  renewalFee?: number;
  currency?: string;
  status?: string;
};

const UPCOMING_WINDOW_DAYS = 60;

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

function parseDateLike(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDateDDMMMYYYY(value: Date | null): string {
  if (!value) return "";
  const dd = String(value.getDate()).padStart(2, "0");
  const mmm = value.toLocaleString("en-US", { month: "short" });
  const yyyy = value.getFullYear();
  return `${dd}-${mmm}-${yyyy}`;
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

function getNormalizedDepartments(lic: License): string[] {
  const out: string[] = [];
  out.push(...normalizeDepartmentTokens((lic as any)?.departments));
  out.push(...normalizeDepartmentTokens((lic as any)?.department));
  return Array.from(new Set(out.map((d) => d.trim()).filter(Boolean)));
}

function getRenewalPerson(lic: License): string {
  return (
    String((lic as any)?.renewalPerson1 || "").trim() ||
    String((lic as any)?.responsiblePerson || "").trim() ||
    "Unassigned"
  );
}

function getBeneficiary(lic: License): string {
  return String((lic as any)?.beneficiaryNameNo || "").trim() || String((lic as any)?.entityOwner || "").trim();
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCost(lic: License): string {
  const amountRaw = Number((lic as any)?.lcyAmount ?? (lic as any)?.renewalAmount ?? (lic as any)?.renewalFee ?? 0);
  const currency = String((lic as any)?.currency || "").trim();

  if (!Number.isFinite(amountRaw) || amountRaw === 0) return "";

  if (!currency) return formatNumber(amountRaw);

  // If they stored a symbol like '$', '€', etc.
  if (currency.length <= 3 && /[^A-Za-z0-9]/.test(currency)) {
    return `${currency}${formatNumber(amountRaw)}`;
  }

  // Otherwise show as code + amount
  return `${currency} ${formatNumber(amountRaw)}`;
}

export default function UpcomingRenewalsReport() {
  const navigate = useNavigate();

  const { data: licenses = [], isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const toDate = React.useMemo(() => {
    const start = startOfDay(new Date());
    return endOfDay(addDays(start, UPCOMING_WINDOW_DAYS));
  }, []);

  const rows = React.useMemo(() => {
    const today = startOfDay(new Date());

    const items = (licenses || [])
      .map((lic) => {
        const expiry = parseDateLike((lic as any)?.endDate);
        const expiryStart = expiry ? startOfDay(expiry) : null;
        const upcoming = expiryStart ? expiryStart.getTime() >= today.getTime() && expiryStart.getTime() <= toDate.getTime() : false;

        const departments = getNormalizedDepartments(lic);

        return {
          id: String((lic as any)?.id ?? (lic as any)?._id ?? (lic as any)?.licenseName ?? Math.random()),
          title: String((lic as any)?.licenseName || "").trim(),
          category: String((lic as any)?.category || "").trim(),
          beneficiary: getBeneficiary(lic),
          expiryDate: expiry,
          renewalPerson: getRenewalPerson(lic),
          department: departments.length ? departments.join(", ") : "",
          renewalCost: formatCost(lic),
          status: String((lic as any)?.status || "").trim(),
          upcoming,
        };
      })
      .filter((r) => r.upcoming)
      .filter((r) => String(r.status).toLowerCase() !== "cancelled")
      .sort((a, b) => {
        const aTime = a.expiryDate ? a.expiryDate.getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.expiryDate ? b.expiryDate.getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });

    return items;
  }, [licenses, toDate]);

  return (
    <div className="p-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col min-h-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-4xl font-bold text-gray-900">Upcoming Renewals Report</h2>

        <Button
          type="button"
          onClick={() => navigate("/reports")}
          className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <div className="mb-6 shrink-0 text-sm font-semibold text-gray-900">Filter: <span className="font-normal text-gray-700">Expiry within next {UPCOMING_WINDOW_DAYS} days</span></div>

            <div className="rounded-lg bg-white border border-gray-200 shadow-md overflow-hidden flex-1 min-h-0 flex flex-col">
            <Table containerClassName="flex-1 min-h-0 overflow-auto" className="table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Title/Name</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Category</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Beneficiary</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Expiry Date</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Renewal Person</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Department</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-right text-xs font-bold text-white uppercase tracking-wide">Renewal Cost</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No upcoming renewals found.
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
                            <span className="relative font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors duration-200 truncate max-w-[260px]">
                              {r.title}
                              <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
                            </span>
                            <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">
                              →
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-700">{r.category}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-700">{r.beneficiary}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-700">{formatDateDDMMMYYYY(r.expiryDate)}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-700">{r.renewalPerson}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-700">{r.department}</TableCell>
                        <TableCell className="px-3 py-3 text-right text-sm text-gray-700">{r.renewalCost}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-700">{r.status}</TableCell>
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
