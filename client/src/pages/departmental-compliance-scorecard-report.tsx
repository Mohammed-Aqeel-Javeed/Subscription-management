import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, ArrowLeft, Download } from "lucide-react";

type RiskLevel = "Low" | "Medium" | "High";

type ComplianceItem = {
  _id?: string;
  id?: string | number;
  status?: string;
  isDraft?: boolean;
  endDate?: string;
  submissionDeadline?: string;
  filingSubmissionDate?: string;
  department?: string;
  departments?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type Department = {
  name: string;
  visible: boolean;
};

type DepartmentScore = {
  id: string;
  name: string;
  activeFilings: number;
  overdue: number;
  riskLevel: RiskLevel;
  onTimeRate: number; // 0..100
};

type RiskFilter = "all" | RiskLevel;

type RateFilter = "all" | "90plus" | "75to89" | "below75";

function safeParseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Copied logic (and kept consistent) with the Compliance page due/late rules.
function getComplianceStatus(endDate: string, submissionDeadline: string): { status: string } {
  if (!endDate) {
    return { status: "No Due" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const twoDaysBeforeEnd = new Date(end);
  twoDaysBeforeEnd.setDate(end.getDate() - 2);
  twoDaysBeforeEnd.setHours(0, 0, 0, 0);

  if (today.getTime() === twoDaysBeforeEnd.getTime()) {
    return { status: "Going to be Due" };
  }

  if (submissionDeadline) {
    const deadline = new Date(submissionDeadline);
    deadline.setHours(0, 0, 0, 0);

    if (today.getTime() >= end.getTime() && today.getTime() < deadline.getTime()) {
      return { status: "Due" };
    } else if (today.getTime() >= deadline.getTime()) {
      return { status: "Late" };
    }
  } else {
    if (today.getTime() >= end.getTime()) {
      return { status: "Due" };
    }
  }

  return { status: "No Due" };
}

function getItemStatusLabel(item: ComplianceItem) {
  if (item.isDraft || item.status === "Draft") return "Draft";
  return getComplianceStatus(item.endDate || "", item.submissionDeadline || "").status;
}

function extractDepartments(item: ComplianceItem): string[] {
  if (Array.isArray(item.departments) && item.departments.length) {
    return item.departments.map((d) => String(d).trim()).filter(Boolean);
  }
  if (item.department) {
    const raw = String(item.department);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((d) => String(d).trim()).filter(Boolean);
      if (typeof parsed === "string") return [parsed.trim()].filter(Boolean);
    } catch {
      // not JSON
    }
    return [raw.trim()].filter(Boolean);
  }
  return [];
}

function computeOnTimeRate(items: ComplianceItem[]) {
  const submittedWithDate = items
    .map((x) => {
      const d = safeParseDate(x.filingSubmissionDate);
      return d ? { item: x, submissionDate: d } : null;
    })
    .filter(Boolean) as Array<{ item: ComplianceItem; submissionDate: Date }>;

  if (submittedWithDate.length === 0) return 100;

  const onTime = submittedWithDate.filter(({ item, submissionDate }) => {
    const deadline = safeParseDate(item.submissionDeadline) ?? safeParseDate(item.endDate);
    if (!deadline) return true;
    const dd = new Date(deadline);
    dd.setHours(23, 59, 59, 999);
    return submissionDate.getTime() <= dd.getTime();
  }).length;

  return Math.round((onTime / submittedWithDate.length) * 100);
}

function computeRiskLevel(overdueCount: number): RiskLevel {
  // Matches the screenshot-style thresholds: 0-1 Low, 2-3 Medium, 4+ High
  if (overdueCount >= 4) return "High";
  if (overdueCount >= 2) return "Medium";
  return "Low";
}

function getRiskBadgeClasses(level: RiskLevel) {
  if (level === "Low") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (level === "Medium") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function getRiskDotClasses(level: RiskLevel) {
  if (level === "Low") return "bg-emerald-500";
  if (level === "Medium") return "bg-amber-500";
  return "bg-red-500";
}

function getRateTextClasses(rate: number) {
  if (rate >= 90) return "text-emerald-700";
  if (rate >= 75) return "text-amber-700";
  return "text-red-600";
}

function getRateBarClasses(rate: number) {
  if (rate >= 90) return "bg-emerald-500";
  if (rate >= 75) return "bg-amber-500";
  return "bg-red-500";
}

function applyRateFilter(items: DepartmentScore[], rateFilter: RateFilter) {
  if (rateFilter === "90plus") return items.filter((x) => x.onTimeRate >= 90);
  if (rateFilter === "75to89") return items.filter((x) => x.onTimeRate >= 75 && x.onTimeRate < 90);
  if (rateFilter === "below75") return items.filter((x) => x.onTimeRate < 75);
  return items;
}

export default function DepartmentalComplianceScorecardReport() {
  const navigate = useNavigate();
  const [riskFilter, setRiskFilter] = React.useState<RiskFilter>("all");
  const [rateFilter, setRateFilter] = React.useState<RateFilter>("all");

  const { data: complianceItems = [], isLoading: complianceLoading } = useQuery<ComplianceItem[]>({
    queryKey: ["compliance"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/compliance/list");
      const json = await response.json();
      return Array.isArray(json) ? (json as ComplianceItem[]) : [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/company/departments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/company/departments");
      const json = await response.json();
      return Array.isArray(json) ? (json as Department[]) : [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const departmentNames = React.useMemo(() => {
    const fromApi = (Array.isArray(departments) ? departments : [])
      .filter((d) => d && d.visible !== false)
      .map((d) => String(d.name || "").trim())
      .filter(Boolean);
    if (fromApi.length) return fromApi;

    const derived = new Set<string>();
    (Array.isArray(complianceItems) ? complianceItems : []).forEach((item) => {
      extractDepartments(item).forEach((d) => derived.add(d));
    });
    return Array.from(derived).sort((a, b) => a.localeCompare(b));
  }, [departments, complianceItems]);

  const departmentScores = React.useMemo<DepartmentScore[]>(() => {
    const items = Array.isArray(complianceItems) ? complianceItems : [];

    return departmentNames.map((deptName) => {
      const deptItems = items.filter((item) => extractDepartments(item).includes(deptName));

      const nonDraft = deptItems.filter((x) => getItemStatusLabel(x) !== "Draft");
      const overdue = nonDraft.filter((x) => {
        if (String(x.status || "").toLowerCase() === "submitted") return false;
        if (safeParseDate(x.filingSubmissionDate)) return false;
        return getItemStatusLabel(x) === "Late";
      }).length;

      const onTimeRate = computeOnTimeRate(nonDraft);
      const id = deptName.trim().toLowerCase();

      return {
        id,
        name: deptName,
        activeFilings: nonDraft.length,
        overdue,
        riskLevel: computeRiskLevel(overdue),
        onTimeRate,
      };
    });
  }, [complianceItems, departmentNames]);

  const filtered = React.useMemo(() => {
    let items = departmentScores;
    if (riskFilter !== "all") {
      items = items.filter((x) => x.riskLevel === riskFilter);
    }
    items = applyRateFilter(items, rateFilter);
    return items;
  }, [departmentScores, riskFilter, rateFilter]);


  const handleExportCsv = () => {
    const rows = filtered.map((row) => ({
      Department: row.name,
      ActiveFilings: row.activeFilings,
      Overdue: row.overdue,
      RiskLevel: row.riskLevel,
      OnTimeRate: `${row.onTimeRate}%`,
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "departmental-compliance-scorecard.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-4xl font-bold text-gray-900">Departmental Compliance Scorecard</h2>

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
              <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskFilter)}>
                <SelectTrigger className="w-full lg:w-[280px]">
                  <SelectValue placeholder="All Risk Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>

              <Select value={rateFilter} onValueChange={(v) => setRateFilter(v as RateFilter)}>
                <SelectTrigger className="w-full lg:w-[280px]">
                  <SelectValue placeholder="All On-Time Rates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All On-Time Rates</SelectItem>
                  <SelectItem value="90plus">90% and above</SelectItem>
                  <SelectItem value="75to89">75% to 89%</SelectItem>
                  <SelectItem value="below75">Below 75%</SelectItem>
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
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[260px]">
                    DEPARTMENT
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[160px]">
                    ACTIVE FILINGS
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[130px]">
                    OVERDUE
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[160px]">
                    RISK LEVEL
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-gray-200 h-12 px-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wide w-[240px]">
                    ON-TIME RATE
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {complianceLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Loading scorecard…
                    </TableCell>
                  </TableRow>
                ) : null}

                {filtered.map((row) => {
                  const barWidth = Math.max(0, Math.min(100, row.onTimeRate));

                  return (
                    <TableRow key={row.id} className="bg-white hover:bg-gray-50">
                      <TableCell className="px-4 py-5">
                        <div className="font-semibold text-gray-900 truncate">{row.name}</div>
                      </TableCell>

                      <TableCell className="px-4 py-5">
                        <div className="inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-semibold border border-gray-200">
                          {row.activeFilings}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-5">
                        {row.overdue > 0 ? (
                          <div className="inline-flex items-center gap-1.5 text-red-600 font-semibold">
                            <AlertCircle className="h-4 w-4" />
                            {row.overdue}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="px-4 py-5">
                        <Badge className={cn("gap-2 border", getRiskBadgeClasses(row.riskLevel))}>
                          <span className={cn("h-2 w-2 rounded-full", getRiskDotClasses(row.riskLevel))} />
                          {row.riskLevel}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-4 py-5">
                        <div className="flex items-center gap-4">
                          <div className={cn("text-sm font-bold", getRateTextClasses(row.onTimeRate))}>{row.onTimeRate}%</div>
                          <div className="h-2 w-[140px] rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={cn("h-full", getRateBarClasses(row.onTimeRate))}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!complianceLoading && filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No departments match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {/* Footer removed per UX request */}
        </CardContent>
      </Card>
    </div>
  );
}
