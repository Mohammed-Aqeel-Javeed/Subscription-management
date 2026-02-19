import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { History, ArrowLeft } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface HistoryRecord {
  _id?: string;
  action: string;
  subscriptionId?: string | { toString(): string };
  timestamp: string;
  loggedAt?: string;
  changedBy?: string;
  changeReason?: string;
  data?: Record<string, any>;
  updatedFields?: Record<string, any>;
}

function parseMoneyLike(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;

  // If this looks like ciphertext/base64, don't try to parse it as a number.
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (base64Regex.test(s) && s.length > 80) return null;

  // Allow values like "AFN 5,000.00" by stripping non-numeric chars (except . , -)
  const cleaned = s.replace(/[^0-9,.-]/g, "");
  if (!cleaned) return null;

  const num = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function getActionBadgeColor(action: string) {
  switch (String(action || "").toLowerCase()) {
    case "create":
    case "created":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "update":
    case "updated":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "delete":
    case "deleted":
      return "bg-red-100 text-red-700 border-red-200";
    case "renewed":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function formatTimestamp(timestamp: string, opts?: { forceLocal?: boolean }) {
  if (!timestamp) return { date: "N/A", time: "00:00" };

  const raw = String(timestamp).trim();
  const date = parseTimestampLike(raw);
  if (!date) return { date: "N/A", time: "00:00" };

  const forceLocal = Boolean(opts?.forceLocal);
  // For effective-date timestamps (often date-only), keep UTC formatting to avoid day drift.
  // For loggedAt (real-time audit), show local time for the viewer.
  const useUtc =
    !forceLocal &&
    (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw));

  const day = String(useUtc ? date.getUTCDate() : date.getDate()).padStart(2, "0");
  const month = String((useUtc ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, "0");
  const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
  const hours = String(useUtc ? date.getUTCHours() : date.getHours()).padStart(2, "0");
  const minutes = String(useUtc ? date.getUTCMinutes() : date.getMinutes()).padStart(2, "0");
  return { date: `${day}/${month}/${year}`, time: `${hours}:${minutes}` };
}

function parseTimestampLike(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // ISO or RFC-like
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;

  // YYYY-MM-DD (treat as local midnight)
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    // Interpret date-only as UTC midnight to avoid timezone drifting the day.
    const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD/MM/YYYY HH:mm
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const hours = dmy[4] ? Number(dmy[4]) : 0;
    const minutes = dmy[5] ? Number(dmy[5]) : 0;
    const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function prettyFieldLabel(key: string) {
  switch (key) {
    case "serviceName":
      return "Subscription Name";
    case "vendor":
      return "Vendor";
    case "ownerName":
    case "owner":
      return "Owner";
    case "startDate":
      return "Start Date";
    case "nextRenewal":
      return "End Date";
    case "amount":
      return "Amount";
    case "qty":
      return "Qty";
    case "totalAmount":
      return "Total Amount";
    case "lcyAmount":
      return "LCY Amount";
    case "taxAmount":
      return "Tax Amount";
    case "totalAmountInclTax":
      return "Total Amount (Incl. Tax)";
    case "status":
      return "Status";
    default:
      return key;
  }
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "Not Set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatDateDdMmYyyy(value: any) {
  if (value === null || value === undefined || value === "") return "Not Set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatValue(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function buildChangesText(record: HistoryRecord) {
  const action = String(record.action || "").toLowerCase();
  const oldData = record.data || {};
  const newData = record.updatedFields || {};

  const reason = record.changeReason ? `Reason: ${record.changeReason}` : "";

  if (action === "create" || action === "created") {
    return ["Created subscription", reason].filter(Boolean).join("\n");
  }

  if (action === "delete" || action === "deleted") {
    return ["Deleted subscription", reason].filter(Boolean).join("\n");
  }

  const fieldsToCompare = [
    "serviceName",
    "vendor",
    "ownerName",
    "owner",
    "startDate",
    "nextRenewal",
    "amount",
    "qty",
    "totalAmount",
    "lcyAmount",
    "taxAmount",
    "totalAmountInclTax",
    "status",
  ];

  const numericFields = new Set([
    "amount",
    "qty",
    "totalAmount",
    "lcyAmount",
    "taxAmount",
    "totalAmountInclTax",
  ]);

  const lines: string[] = [];
  for (const key of fieldsToCompare) {
    if (!(key in newData)) continue;
    const before = oldData[key];
    const after = newData[key];

    const isDateField = key === "startDate" || key === "nextRenewal" || key === "endDate" || key === "initialDate";
    const beforeText = isDateField ? formatDateDdMmYyyy(before) : formatValue(before);
    const afterText = isDateField ? formatDateDdMmYyyy(after) : formatValue(after);

    if (numericFields.has(key)) {
      const beforeNum = parseMoneyLike(before);
      const afterNum = parseMoneyLike(after);
      if (beforeNum !== null && afterNum !== null) {
        const beforeRounded = Math.round(beforeNum * 100) / 100;
        const afterRounded = Math.round(afterNum * 100) / 100;
        if (beforeRounded === afterRounded) continue;
      } else {
        // If we can't parse as numbers, fall back to text comparison.
        if (beforeText === afterText) continue;
      }
    } else {
      if (beforeText === afterText) continue;
    }
    lines.push(`${prettyFieldLabel(key)}: ${beforeText} → ${afterText}`);
  }

  const fallbackLabel = record.action ? String(record.action) : "Updated";
  const main = lines.length > 0 ? lines.join("\n") : fallbackLabel;
  return [main, reason].filter(Boolean).join("\n");
}

function inferDisplayAction(record: HistoryRecord): string {
  const action = String(record.action || "").toLowerCase();
  if (action !== "update" && action !== "updated") return record.action;

  const oldData = record.data || {};
  const newData = record.updatedFields || {};

  // Heuristic: if only startDate + nextRenewal changed, treat as renewal.
  const changedKeys: string[] = [];
  const keysToCheck = ["serviceName", "vendor", "ownerName", "owner", "startDate", "nextRenewal", "amount", "qty", "totalAmount", "lcyAmount", "status"];
  for (const k of keysToCheck) {
    if (!(k in newData)) continue;
    const before = oldData[k];
    const after = newData[k];
    const beforeText = (k === "startDate" || k === "nextRenewal") ? formatDateDdMmYyyy(before) : formatValue(before);
    const afterText = (k === "startDate" || k === "nextRenewal") ? formatDateDdMmYyyy(after) : formatValue(after);
    if (beforeText !== afterText) changedKeys.push(k);
  }

  if (changedKeys.length > 0 && changedKeys.every((k) => k === "startDate" || k === "nextRenewal")) {
    return "renewed";
  }

  return record.action;
}

export default function SubscriptionHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subscriptionId = searchParams.get("id");
  const subscriptionNameParam = searchParams.get("name");

  const queryClient = useQueryClient();

  const endpoint = subscriptionId ? `/api/history/${subscriptionId}` : `/api/history/list`;
  const queryKey = subscriptionId
    ? ["/api/history", "subscription", subscriptionId]
    : ["/api/history", "list"];

  const { data: history = [], isLoading, refetch } = useQuery<HistoryRecord[]>({
    queryKey,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `${endpoint}?limit=2000`);
        const json = await res.json().catch(() => []);
        return Array.isArray(json) ? json : [];
      } catch (e) {
        console.error("Failed to load history:", e);
        return [];
      }
    },
  });

  useEffect(() => {
    const refresh = () => {
      // Invalidate both list and per-subscription keys.
      queryClient.invalidateQueries({ queryKey: ["/api/history"], exact: false });
      void refetch();
    };

    const events = [
      "subscription-created",
      "subscription-updated",
      "subscription-deleted",
      "subscription-renewed",
      "account-changed",
      "login",
      "logout",
    ];
    events.forEach((ev) => window.addEventListener(ev, refresh));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, refresh));
    };
  }, [queryClient, refetch]);

  const sortedHistory = useMemo(() => {
    const items = Array.isArray(history) ? [...history] : [];
    items.sort((a, b) => {
      const aStamp = a.loggedAt || a.timestamp;
      const bStamp = b.loggedAt || b.timestamp;
      const aTimeRaw = parseTimestampLike(aStamp)?.getTime() ?? NaN;
      const bTimeRaw = parseTimestampLike(bStamp)?.getTime() ?? NaN;
      const aTime = Number.isFinite(aTimeRaw) ? aTimeRaw : 0;
      const bTime = Number.isFinite(bTimeRaw) ? bTimeRaw : 0;
      if (bTime !== aTime) return bTime - aTime;
      return String(b._id || "").localeCompare(String(a._id || ""));
    });
    return items;
  }, [history]);

  const firstName =
    (sortedHistory?.[0]?.updatedFields?.serviceName as string) ||
    (sortedHistory?.[0]?.data?.serviceName as string) ||
    "Selected Subscription";

  const headerName = subscriptionNameParam ? decodeURIComponent(subscriptionNameParam) : firstName;
  const headerTitle = subscriptionId ? `${headerName} Audit Log` : "Subscription Audit Log";

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-['Inter']">
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center shadow-lg">
                <History className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{headerTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={() => navigate("/subscriptions")} variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Subscriptions
              </Button>
            </div>
          </div>
        </div>

        {/* Log Table */}
        <Card className="flex-1 overflow-hidden flex flex-col border-slate-200 shadow-lg bg-white">
          <div className="flex-1 overflow-auto relative">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading logs...</p>
                </div>
              </div>
            ) : history && history.length > 0 ? (
              <div className="h-full overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[200px]">Subscription Name</th>
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[180px]">Changed By</th>
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[400px]">Changes</th>
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[100px]">Action</th>
                      <th className="font-semibold text-slate-700 bg-slate-50 text-left px-4 py-3 w-[140px]">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {sortedHistory.map((item: any, index: number) => {
                      const stampToShow = item.loggedAt || item.timestamp;
                      const timestamp = formatTimestamp(stampToShow, { forceLocal: Boolean(item.loggedAt) });
                      const name = item?.updatedFields?.serviceName || item?.data?.serviceName || "N/A";
                      const changedBy =
                        item?.changedBy ||
                        item?.user ||
                        item?.data?.ownerName ||
                        item?.data?.owner ||
                        "System";
                      const changesText = buildChangesText(item);
                      const displayAction = inferDisplayAction(item);

                      return (
                        <tr key={item._id || index} className="hover:bg-slate-50 border-b border-slate-100">
                          <td className="font-medium text-sm text-slate-900 align-top py-3 px-4">{name}</td>
                          <td className="text-sm text-slate-700 align-top py-3 px-4">{changedBy}</td>
                          <td className="text-sm text-slate-600 align-top py-3 px-4">
                            <div className="whitespace-pre-line leading-relaxed">{changesText || "No changes recorded"}</div>
                          </td>
                          <td className="align-top py-3 px-4">
                            <Badge className={`${getActionBadgeColor(displayAction)} px-2 py-1 text-xs font-medium border capitalize`}>
                              {displayAction}
                            </Badge>
                          </td>
                          <td className="text-sm text-slate-500 align-top py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium">{timestamp.date}</span>
                              {timestamp.time && <span className="text-xs text-slate-400">{timestamp.time}</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <History className="h-8 w-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">
                      {subscriptionId ? "No history records found for this subscription" : "No history records found"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {subscriptionId
                        ? "This subscription has no recorded changes yet"
                        : "Logs will appear here when subscriptions are created, updated, renewed, or deleted"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
