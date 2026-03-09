import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
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
    <div className="p-8">
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

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-gray-400 bg-gray-200">
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Title/Name</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Category</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Beneficiary</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Expiry Date</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wide">Days Expired</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Responsible Person</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Department</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Renewal Status</TableHead>
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
                  rows.map((r) => (
                    <TableRow key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <TableCell className="px-3 py-3 font-medium text-gray-800">
                        <span className="block truncate max-w-[260px]" title={r.title}>
                          {r.title}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-sm text-gray-700">{r.category}</TableCell>
                      <TableCell className="px-3 py-3 text-sm text-gray-700">{r.beneficiary}</TableCell>
                      <TableCell className="px-3 py-3 text-sm text-gray-700">{formatDateDDMMMYYYY(r.expiryDate)}</TableCell>
                      <TableCell className="px-3 py-3 text-center text-sm text-gray-700">{r.daysExpired ?? ""}</TableCell>
                      <TableCell className="px-3 py-3 text-sm text-gray-700">{r.responsiblePerson}</TableCell>
                      <TableCell className="px-3 py-3 text-sm text-gray-700">{r.department}</TableCell>
                      <TableCell className="px-3 py-3 text-sm text-gray-700">{r.renewalStatus}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
