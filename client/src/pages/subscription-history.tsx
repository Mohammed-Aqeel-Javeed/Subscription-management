import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { History, ArrowLeft } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface HistoryRecord {
  _id?: string;
  action: string;
  subscriptionId?: string | { toString(): string };
  timestamp: string;
  changedBy?: string;
  changeReason?: string;
  data?: Record<string, any>;
  updatedFields?: Record<string, any>;
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

function formatTimestamp(timestamp: string) {
  if (!timestamp) return { date: "N/A", time: "" };

  const raw = String(timestamp);
  // If backend stored a date-only effective date, it comes back as UTC midnight.
  // Showing local time (e.g., 05:30) is confusing; display date only.
  if (/T00:00:00(\.000)?Z$/.test(raw)) {
    const ymd = raw.split("T")[0];
    const [year, month, day] = ymd.split("-");
    if (year && month && day) {
      return { date: `${day}/${month}/${year}`, time: "" };
    }
  }

  const date = new Date(raw);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return { date: `${day}/${month}/${year}`, time: `${hours}:${minutes}` };
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
    "status",
  ];

  const lines: string[] = [];
  for (const key of fieldsToCompare) {
    if (!(key in newData)) continue;
    const before = oldData[key];
    const after = newData[key];

    const isDateField = key === "startDate" || key === "nextRenewal" || key === "endDate" || key === "initialDate";
    const beforeText = isDateField ? formatDateDdMmYyyy(before) : formatValue(before);
    const afterText = isDateField ? formatDateDdMmYyyy(after) : formatValue(after);

    if (beforeText === afterText) continue;
    lines.push(`${prettyFieldLabel(key)}: ${beforeText} → ${afterText}`);
  }

  const fallbackLabel = record.action ? String(record.action) : "Updated";
  const main = lines.length > 0 ? lines.join("\n") : fallbackLabel;
  return [main, reason].filter(Boolean).join("\n");
}

export default function SubscriptionHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subscriptionId = searchParams.get("id");
  const subscriptionNameParam = searchParams.get("name");

  const endpoint = subscriptionId ? `/api/history/${subscriptionId}` : `/api/history/list`;
  const queryKey = subscriptionId
    ? ["/api/history", "subscription", subscriptionId]
    : ["/api/history", "list"];

  const { data: history = [], isLoading } = useQuery<HistoryRecord[]>({
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

  const sortedHistory = useMemo(() => {
    const items = Array.isArray(history) ? [...history] : [];
    items.sort((a, b) => {
      const aTimeRaw = new Date(a.timestamp).getTime();
      const bTimeRaw = new Date(b.timestamp).getTime();
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
                      const timestamp = formatTimestamp(item.timestamp);
                      const name = item?.updatedFields?.serviceName || item?.data?.serviceName || "N/A";
                      const changedBy =
                        item?.changedBy ||
                        item?.user ||
                        item?.data?.ownerName ||
                        item?.data?.owner ||
                        "System";
                      const changesText = buildChangesText(item);

                      return (
                        <tr key={item._id || index} className="hover:bg-slate-50 border-b border-slate-100">
                          <td className="font-medium text-sm text-slate-900 align-top py-3 px-4">{name}</td>
                          <td className="text-sm text-slate-700 align-top py-3 px-4">{changedBy}</td>
                          <td className="text-sm text-slate-600 align-top py-3 px-4">
                            <div className="whitespace-pre-line leading-relaxed">{changesText || "No changes recorded"}</div>
                          </td>
                          <td className="align-top py-3 px-4">
                            <Badge className={`${getActionBadgeColor(item.action)} px-2 py-1 text-xs font-medium border capitalize`}>
                              {item.action}
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
