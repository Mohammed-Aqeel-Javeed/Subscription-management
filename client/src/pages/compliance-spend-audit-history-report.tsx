import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ArrowLeft, Download } from "lucide-react";

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
  filingComplianceCategory?: string;

  amount?: number | string;
  fee?: number | string;
  cost?: number | string;

  frequency?: string;
  filingFrequency?: string;
  billingCycle?: string;

  status?: string;
  isDraft?: boolean;

  updatedAt?: string;
  createdAt?: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function getFilingItemName(item: ComplianceListItem): string {
  return (
    normalizeText(item.policy) ||
    normalizeText(item.filingName) ||
    normalizeText(item.complianceName) ||
    normalizeText(item.name) ||
    "-"
  );
}

function getCategory(item: ComplianceListItem): string {
  return (
    normalizeText(item.filingComplianceCategory) ||
    normalizeText(item.complianceCategory) ||
    normalizeText(item.category) ||
    "-"
  );
}

function getFeeValue(item: ComplianceListItem): number {
  const candidates = [item.amount, item.fee, item.cost];
  for (const raw of candidates) {
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function getCycle(item: ComplianceListItem): string {
  const raw = normalizeText(item.frequency) || normalizeText(item.filingFrequency) || normalizeText(item.billingCycle);
  if (!raw) return "-";

  const lowered = raw.toLowerCase();
  if (lowered === "yearly") return "Annual";
  if (lowered === "one time" || lowered === "one-time" || lowered === "onetime") return "One-time";
  if (lowered === "monthly") return "Monthly";
  if (lowered === "quarterly") return "Quarterly";
  return raw;
}

function getStatusLabel(item: ComplianceListItem): string {
  const s = normalizeText(item.status);
  return s || "No Due";
}

function getCategoryPillClasses(category: string) {
  const value = String(category || "").trim();
  if (!value || value === "-") return "bg-slate-100 text-slate-700 border-slate-200";

  const lowered = value.toLowerCase();
  if (lowered.includes("tax")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (lowered.includes("regulat")) return "bg-purple-50 text-purple-700 border-purple-200";

  const palette = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-amber-50 text-amber-800 border-amber-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
  ];

  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash + value.charCodeAt(i)) % 100000;
  return palette[hash % palette.length];
}

function getStatusPillClasses(status: string) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "bg-slate-100 text-slate-700 border-slate-200";

  if (value.includes("late") || value.includes("overdue")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (value.includes("due")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (value.includes("no due") || value.includes("not due")) return "bg-slate-100 text-slate-700 border-slate-200";
  if (value.includes("submit") || value.includes("complete") || value.includes("done"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";

  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getCyclePillClasses(cycle: string) {
  const value = String(cycle || "").trim().toLowerCase();
  if (!value || value === "-") return "bg-slate-100 text-slate-700 border-slate-200";

  if (value.includes("annual") || value.includes("year")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (value.includes("one")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value.includes("month")) return "bg-purple-50 text-purple-700 border-purple-200";
  if (value.includes("quarter")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatCurrencyUSD(amount: number) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function ComplianceSpendAuditHistoryReport() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [selectedCycle, setSelectedCycle] = React.useState<string>("all");

  const { data: items = [], isLoading } = useQuery<ComplianceListItem[]>({
    queryKey: ["compliance", "list"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/compliance/list");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const rows = React.useMemo(() => {
    return (Array.isArray(items) ? items : [])
      .filter((item) => {
        const isDraft = Boolean(item.isDraft) || normalizeText(item.status).toLowerCase() === "draft";
        return !isDraft;
      })
      .map((item) => {
      const name = getFilingItemName(item);
      const category = getCategory(item);
      const fee = getFeeValue(item);
      const cycle = getCycle(item);
      const status = getStatusLabel(item);

      return {
        key: String(item._id || item.id || name),
        item,
        name,
        category,
        fee,
        cycle,
        status,
      };
    });
  }, [items]);

  const statusOptions = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.status));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const cycleOptions = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.cycle));
    return Array.from(set).filter((v) => v && v !== "-").sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = React.useMemo(() => {
    return rows
      .filter((r) => (selectedStatus === "all" ? true : r.status === selectedStatus))
      .filter((r) => (selectedCycle === "all" ? true : r.cycle === selectedCycle));
  }, [rows, selectedStatus, selectedCycle]);

  const handleExportCsv = () => {
    const out = filtered.map((r) => ({
      FilingName: r.name,
      Category: r.category,
      FeeOrCost: r.fee,
      BillingCycle: r.cycle,
      Status: r.status,
    }));

    const csv = Papa.unparse(out);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compliance-spend-audit-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col min-h-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-4xl font-bold text-gray-900">Compliance Spend &amp; Audit History</h2>

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
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full lg:w-[280px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCycle} onValueChange={setSelectedCycle}>
              <SelectTrigger className="w-full lg:w-[280px]">
                <SelectValue placeholder="All Cycles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cycles</SelectItem>
                {cycleOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
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
      </div>

      <div className="rounded-lg bg-white border border-gray-200 shadow-md overflow-hidden flex-1 min-h-0 flex flex-col">
      <Table containerClassName="flex-1 min-h-0 overflow-auto" className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[220px]">
                    FILING NAME
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[220px]">
                    CATEGORY
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-3 text-right text-xs font-bold text-white uppercase tracking-wide w-[140px]">
                    FEE / COST
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[170px]">
                    BILLING CYCLE
                  </TableHead>
                  <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[140px]">
                    STATUS
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  <AnimatePresence>
                    {filtered.map((r, index) => (
                      <motion.tr
                        key={r.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.04 * index }}
                        className={`border-b border-gray-100 hover:bg-indigo-50/40 transition-colors ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <TableCell className="px-3 py-3 font-medium text-gray-800 w-[220px] min-w-0 overflow-hidden text-left">
                          <div title={r.name} className="group inline-flex items-center gap-1 max-w-full text-left">
                            <span className="relative font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors duration-200 truncate whitespace-nowrap max-w-[220px]">
                              {r.name}
                              <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
                            </span>
                            <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">
                              →
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 w-[220px] text-left">
                          <span
                            className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border min-w-[110px] ${getCategoryPillClasses(
                              r.category
                            )}`}
                          >
                            {r.category}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right font-semibold text-gray-800 w-[140px]">
                          {formatCurrencyUSD(r.fee)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-left w-[170px]">
                          <span
                            className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border min-w-[120px] whitespace-nowrap ${getCyclePillClasses(
                              r.cycle
                            )}`}
                          >
                            {r.cycle}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-left w-[140px]">
                          <span
                            className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border min-w-[120px] whitespace-nowrap ${getStatusPillClasses(
                              r.status
                            )}`}
                          >
                            {r.status}
                          </span>
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
