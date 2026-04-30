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

function formatDateDDMMMYYYY(value: Date | null): string {
  if (!value) return "";
  const dd = String(value.getDate()).padStart(2, "0");
  const mmm = value.toLocaleString("en-US", { month: "short" });
  const yyyy = value.getFullYear();
  return `${dd}-${mmm}-${yyyy}`;
}

// Renewal Status badge colors + labels (exactly matching Renewal page)
function getRenewalStatusClassName(renewalStatus: string) {
  switch (renewalStatus) {
    case "Approved":
      return "bg-green-600 text-white";
    case "Cancelled":
      return "bg-red-600 text-white";
    case "Rejected":
      return "bg-red-600 text-white";
    case "Renewal Initiated":
      return "bg-blue-600 text-white";
    case "Application Submitted":
      return "bg-indigo-600 text-white";
    case "Amendments/ Appeal Submitted":
      return "bg-orange-600 text-white";
    case "Resubmitted":
      return "bg-purple-600 text-white";
    default:
      return "bg-blue-600 text-white";
  }
}

function getRenewalStatusLabel(renewalStatus: string) {
  switch (renewalStatus) {
    case "Renewal Initiated":
      return "Initiated";
    case "Application Submitted":
      return "Submitted";
    case "Amendments/ Appeal Submitted":
      return "Amendment/Appeal";
    default:
      return renewalStatus;
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

function getResponsiblePerson(lic: License): string {
  return (
    String((lic as any)?.renewalPerson1 || "").trim() ||
    String((lic as any)?.responsiblePerson || "").trim() ||
    "Unassigned"
  );
}

function getBeneficiary(lic: License): string {
  return String((lic as any)?.beneficiaryNameNo || "").trim() || String((lic as any)?.entityOwner || "").trim();
}

export default function ExpiredRenewalsReport() {
  const navigate = useNavigate();

  const { data: licenses = [], isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const rows = React.useMemo(() => {
    const today = startOfDay(new Date());

    const items = (licenses || [])
      .map((lic) => {
        const expiry = parseDateLike((lic as any)?.endDate);
        const expiryStart = expiry ? startOfDay(expiry) : null;
        const expired = expiryStart ? expiryStart.getTime() < today.getTime() : false;

        const daysExpired = expiryStart ? Math.max(0, Math.round((today.getTime() - expiryStart.getTime()) / (1000 * 60 * 60 * 24))) : null;
        const departments = getNormalizedDepartments(lic);

        return {
          id: String((lic as any)?.id ?? (lic as any)?._id ?? (lic as any)?.licenseName ?? Math.random()),
          title: String((lic as any)?.licenseName || "").trim(),
          category: String((lic as any)?.category || "").trim(),
          beneficiary: getBeneficiary(lic),
          expiryDate: expiry,
          daysExpired,
          responsiblePerson: getResponsiblePerson(lic),
          department: departments.length ? departments.join(", ") : "",
          renewalStatus: String((lic as any)?.renewalStatus || "").trim(),
          expired,
          status: String((lic as any)?.status || "").trim(),
        };
      })
      .filter((r) => r.expired)
      .filter((r) => String(r.status).toLowerCase() !== "cancelled")
      .sort((a, b) => {
        const aTime = a.expiryDate ? a.expiryDate.getTime() : 0;
        const bTime = b.expiryDate ? b.expiryDate.getTime() : 0;
        return bTime - aTime;
      });

    return items;
  }, [licenses]);

  return (
    <div className="p-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col min-h-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-4xl font-bold text-gray-900">Expired Renewals Report</h2>

        <Button
          type="button"
          onClick={() => navigate("/reports")}
          className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <div className="rounded-lg bg-white border border-gray-200 shadow-md overflow-hidden flex-1 min-h-0 flex flex-col">
      <Table containerClassName="flex-1 min-h-0 overflow-auto" className="table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Title/Name</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Category</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Beneficiary</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Expiry Date</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-center text-xs font-bold text-white uppercase tracking-wide">Days Expired</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Responsible Person</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Department</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Renewal Status</TableHead>
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
                      No expired renewals found.
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
                        <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.daysExpired ?? ""}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-700">{r.responsiblePerson}</TableCell>
                        <TableCell className="px-3 py-3 text-sm text-gray-700">{r.department}</TableCell>
                        <TableCell className="px-3 py-3 w-[150px] text-left">
                          {r.renewalStatus ? (
                            <span
                              className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none min-w-[140px] ${getRenewalStatusClassName(
                                r.renewalStatus
                              )}`}
                            >
                              {getRenewalStatusLabel(r.renewalStatus)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
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
