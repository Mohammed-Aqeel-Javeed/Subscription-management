import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { History, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@shared/types";

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

function sanitizeId(raw: string | null) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  return trimmed;
}

function sanitizeName(raw: string | null) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 200);
}

function sanitizeToken(raw: string | null) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length < 20 || trimmed.length > 10000) return null;
  return trimmed;
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
    case "ownerEmail":
      return "Owner Email";
    case "users":
      return "Users";
    case "paymentMethod":
      return "Payment Method";
    case "website":
      return "Website";
    case "billingCycle":
      return "Billing Cycle";
    case "paymentFrequency":
      return "Payment Frequency";
    case "currency":
      return "Currency";
    case "category":
      return "Category";
    case "departments":
      return "Departments";
    case "department":
      return "Department";
    case "reminderDays":
      return "Reminder Days";
    case "reminderPolicy":
      return "Reminder Policy";
    case "notes":
      return "Notes";
    case "description":
      return "Description";
    case "isActive":
      return "Active";
    case "isDraft":
      return "Draft";
    case "startDate":
      return "Start Date";
    case "firstPurchaseDate":
      return "First Purchase Date";
    case "currentCycleStart":
    case "CurrentCycleStart":
      return "Current Cycle Start";
    case "nextRenewal":
      return "End Date";
    case "endDate":
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

function getHistoryKeysToCompare(record: HistoryRecord, isNamedHistory?: boolean) {
  const newData = record.updatedFields || {};

  // Keep a stable, human-friendly ordering for common fields.
  const preferredOrder = [
    "serviceName",
    "vendor",
    "website",
    "category",
    "departments",
    "department",
    "ownerName",
    "owner",
    "users",
    "paymentMethod",
    "billingCycle",
    "paymentFrequency",
    "currency",
    "startDate",
    "nextRenewal",
    "endDate",
    "amount",
    "qty",
    "taxAmount",
    "totalAmount",
    "lcyAmount",
    "totalAmountInclTax",
    "reminderDays",
    "reminderPolicy",
    "notes",
    "description",
    "status",
    "isActive",
    "isDraft",
  ];

  // Avoid showing internal/system fields if they appear in updatedFields.
  const excludedKeys = new Set([
    "_id",
    "ownerEmail",
    "id",
    "subscriptionId",
    "tenantId",
    "companyId",
    "userId",
    "createdAt",
    "updatedAt",
    "createdOn",
    "modifiedOn",
    "loggedAt",
    "timestamp",
    "__v",
    "isDraft", // Exclude draft status from history display
  ]);

  const allowedInNamedHistory = new Set(["owner", "ownerName", "amount", "users"]);

  const ordered = [...preferredOrder, ...Object.keys(newData)];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const k of ordered) {
    if (!k) continue;
    if (excludedKeys.has(k)) continue;
    if (!(k in newData)) continue;
    
    // When viewing named history, restrict shown fields to Owner, Amount, Users
    if (isNamedHistory && !allowedInNamedHistory.has(k)) continue;
    
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(k);
  }
  return unique;
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "Not Set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const items = value
      .map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
        if (typeof v === "object") {
          const name = (v as any)?.name ?? (v as any)?.fullName;
          if (typeof name === "string" && name.trim()) return name.trim();
          const email = (v as any)?.email;
          if (typeof email === "string" && email.trim()) return email.trim();
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        }
        return String(v);
      })
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (items.length === 0) return "Not Set";
    // Sort for stable comparisons/reads (e.g., departments arrays).
    return items.sort((a, b) => a.localeCompare(b)).join(", ");
  }
  if (typeof value === "string") {
    // Truncate very long strings
    if (value.length > 30) {
      return value.substring(0, 27) + "...";
    }
    return value;
  }
  try {
    const jsonStr = JSON.stringify(value);
    if (jsonStr.length > 30) {
      return jsonStr.substring(0, 27) + "...";
    }
    return jsonStr;
  } catch {
    const str = String(value);
    if (str.length > 30) {
      return str.substring(0, 27) + "...";
    }
    return str;
  }
}

function formatNotesValue(value: any) {
  if (value === null || value === undefined || value === "") return "Not Set";

  let parsed: any = value;
  if (typeof parsed === "string") {
    const s = parsed.trim();
    if (!s) return "Not Set";
    if (s === "Not Set") return "Not Set";
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        parsed = JSON.parse(s);
      } catch {
        // If it's not valid JSON, fall back to the string as-is.
        parsed = s;
      }
    } else {
      return s;
    }
  }

  if (Array.isArray(parsed)) {
    const texts = parsed
      .map((item) => {
        if (item === null || item === undefined) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object") {
          const t = (item as any)?.text ?? (item as any)?.note ?? (item as any)?.message;
          if (typeof t === "string" && t.trim()) return t.trim();
          return "";
        }
        return String(item).trim();
      })
      .filter(Boolean);
    return texts.length > 0 ? texts.join("; ") : "Not Set";
  }

  if (typeof parsed === "object") {
    const t = (parsed as any)?.text ?? (parsed as any)?.note ?? (parsed as any)?.message;
    if (typeof t === "string" && t.trim()) return t.trim();
    return "Not Set";
  }

  return String(parsed).trim() || "Not Set";
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

function truncateText(value: string | undefined | null, maxChars: number) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars)).trimEnd()}...` : text;
}

function hasActualChanges(record: HistoryRecord, isNamedHistory?: boolean): boolean {
  const action = String(record.action || "").toLowerCase();
  
  // If named history restrict out renewals completely
  if (isNamedHistory && (action === "renewed" || inferDisplayAction(record) === "renewed")) {
    return false;
  }
  
  // Always show create and delete actions
  if (action === "create" || action === "created" || action === "delete" || action === "deleted") {
    // If user strictly requested only Owner, Amount, Users: we could hide these but creates are usually needed.
    // However, if we hide them, they won't see "Subscription created" in the Named History view.
    // Let's hide it if `isNamedHistory` is true to match strict requirements. 
    return !isNamedHistory;
  }

  const oldData = record.data || {};
  const newData = record.updatedFields || {};
  const fieldsToCompare = getHistoryKeysToCompare(record, isNamedHistory);

  const numericFields = new Set([
    "amount",
    "qty",
    "totalAmount",
    "lcyAmount",
    "taxAmount",
    "totalAmountInclTax",
  ]);

  const dateFields = new Set(["startDate", "nextRenewal", "endDate", "initialDate"]);

  // Check if there are any actual field changes
  for (const key of fieldsToCompare) {
    if (!(key in newData)) continue;
    const before = oldData[key];
    const after = newData[key];

    const isDateField = dateFields.has(key);
    const beforeText = isDateField ? formatDateDdMmYyyy(before) : formatValue(before);
    const afterText = isDateField ? formatDateDdMmYyyy(after) : formatValue(after);

    if (numericFields.has(key)) {
      const beforeNum = parseMoneyLike(before);
      const afterNum = parseMoneyLike(after);
      if (beforeNum !== null && afterNum !== null) {
        const beforeRounded = Math.round(beforeNum * 100) / 100;
        const afterRounded = Math.round(afterNum * 100) / 100;
        if (beforeRounded !== afterRounded) return true;
      } else {
        if (beforeText !== afterText) return true;
      }
    } else {
      if (beforeText !== afterText) return true;
    }
  }

  return false;
}

function buildChangesText(record: HistoryRecord, isNamedHistory?: boolean) {
  const action = String(record.action || "").toLowerCase();
  const oldData = record.data || {};
  const newData = record.updatedFields || {};

  const looksLikeJsonArrayString = (value: unknown) => {
    if (typeof value !== 'string') return false;
    const s = value.trim();
    return s.startsWith('[') && s.endsWith(']');
  };

  const reason = record.changeReason ? `Reason: ${record.changeReason}` : "";

  if (action === "create" || action === "created") {
    return isNamedHistory ? "" : ["Subscription created", reason].filter(Boolean).join("\n");
  }

  if (action === "delete" || action === "deleted") {
    return isNamedHistory ? "" : ["Subscription deleted", reason].filter(Boolean).join("\n");
  }

  const fieldsToCompare = getHistoryKeysToCompare(record, isNamedHistory);

  const numericFields = new Set([
    "amount",
    "qty",
    "totalAmount",
    "lcyAmount",
    "taxAmount",
    "totalAmountInclTax",
  ]);

  const dateFields = new Set(["startDate", "nextRenewal", "endDate", "initialDate", "currentCycleStart", "CurrentCycleStart"]);
  
  // Check if this is a renewal action
  const isRenewal = action === "renewed" || inferDisplayAction(record) === "renewed";
  const isAutoRenewal = (() => {
    const by = String(record.changedBy || "").toLowerCase();
    const r = String(record.changeReason || "").toLowerCase();
    return by.includes("auto-renewal") || r.includes("auto-renewal");
  })();

  if (isRenewal) {
    const beforeStart = (oldData as any)?.currentCycleStart ?? (oldData as any)?.CurrentCycleStart ?? (oldData as any)?.startDate;
    const beforeEnd = (oldData as any)?.nextRenewal ?? (oldData as any)?.endDate;
    const afterStart = (newData as any)?.currentCycleStart ?? (newData as any)?.CurrentCycleStart ?? (newData as any)?.startDate;
    const afterEnd = (newData as any)?.nextRenewal ?? (newData as any)?.endDate;

    const summary = `${isAutoRenewal ? "Auto-renewed" : "Renewed"}: ${formatDateDdMmYyyy(beforeStart)} → ${formatDateDdMmYyyy(afterStart)} | End date: ${formatDateDdMmYyyy(beforeEnd)} → ${formatDateDdMmYyyy(afterEnd)}`;
    return [summary, reason].filter(Boolean).join("\n");
  }

  const lines: string[] = [];
  let suppressedChange = false;
  for (const key of fieldsToCompare) {
    if (!(key in newData)) continue;
    
    // For renewals, only show date fields that actually changed
    if (isRenewal && !dateFields.has(key)) continue;
    
    const before = oldData[key];
    const after = newData[key];

    // Avoid showing both Departments and Department fields
    const keyLowerPre = String(key).toLowerCase();
    if (keyLowerPre === 'department') {
      const hasDepartmentsKey = Object.prototype.hasOwnProperty.call(newData, 'departments') || Object.prototype.hasOwnProperty.call(oldData, 'departments');
      const departmentLooksArray = looksLikeJsonArrayString(before) || looksLikeJsonArrayString(after);
      if (hasDepartmentsKey && departmentLooksArray) {
        continue;
      }
    }

    const isDateField = dateFields.has(key);
    const isNotesField = key === "notes";
    let beforeText = isDateField ? formatDateDdMmYyyy(before) : (isNotesField ? formatNotesValue(before) : formatValue(before));
    let afterText = isDateField ? formatDateDdMmYyyy(after) : (isNotesField ? formatNotesValue(after) : formatValue(after));

    const keyLower = String(key).toLowerCase();
    const isSuppressedField =
      keyLower === 'notes' ||
      keyLower === 'documents' ||
      keyLower === 'document' ||
      keyLower === 'attachments' ||
      keyLower === 'attachment' ||
      keyLower === 'files' ||
      keyLower.includes('document') ||
      keyLower.includes('attachment');

    const hasChanged = (() => {
      if (numericFields.has(key)) {
        const beforeNum = parseMoneyLike(before);
        const afterNum = parseMoneyLike(after);
        if (beforeNum !== null && afterNum !== null) {
          const beforeRounded = Math.round(beforeNum * 100) / 100;
          const afterRounded = Math.round(afterNum * 100) / 100;
          return beforeRounded !== afterRounded;
        }
        return beforeText !== afterText;
      }
      return beforeText !== afterText;
    })();

    if (!hasChanged) continue;

    // Hide notes/documents changes in the UI
    if (isSuppressedField) {
      suppressedChange = true;
      continue;
    }

    if (numericFields.has(key)) {
      const beforeNum = parseMoneyLike(before);
      const afterNum = parseMoneyLike(after);
      if (beforeNum !== null && afterNum !== null) {
        const beforeRounded = Math.round(beforeNum * 100) / 100;
        const afterRounded = Math.round(afterNum * 100) / 100;
        if (beforeRounded === afterRounded) continue;
      } else {
        if (beforeText === afterText) continue;
      }
    } else {
      if (beforeText === afterText) continue;
    }
    
    // Ensure truncation for display
    if (!isDateField && beforeText.length > 30) {
      beforeText = beforeText.substring(0, 27) + "...";
    }
    if (!isDateField && afterText.length > 30) {
      afterText = afterText.substring(0, 27) + "...";
    }
    
    lines.push(`${prettyFieldLabel(key)}: ${beforeText} → ${afterText}`);
  }

  const main = lines.join("\n");
  if (!main && suppressedChange) {
    return ["Subscription updated", reason].filter(Boolean).join("\n");
  }
  return [main, reason].filter(Boolean).join("\n");
}

function inferDisplayAction(record: HistoryRecord): string {
  const action = String(record.action || "").toLowerCase();
  if (action !== "update" && action !== "updated") return record.action;

  const oldData = record.data || {};
  const newData = record.updatedFields || {};

  // Heuristic: if only renewal date fields changed, treat as renewal.
  const changedKeys: string[] = [];
  const keysToCheck = getHistoryKeysToCompare(record);
  for (const k of keysToCheck) {
    if (!(k in newData)) continue;
    const before = oldData[k];
    const after = newData[k];
    const isDateField = k === "startDate" || k === "nextRenewal" || k === "endDate" || k === "initialDate";
    const beforeText = isDateField ? formatDateDdMmYyyy(before) : formatValue(before);
    const afterText = isDateField ? formatDateDdMmYyyy(after) : formatValue(after);
    if (beforeText !== afterText) changedKeys.push(k);
  }

  if (changedKeys.length > 0 && changedKeys.every((k) => k === "startDate" || k === "nextRenewal" || k === "endDate")) {
    return "renewed";
  }

  return record.action;
}

export default function SubscriptionHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idParam = sanitizeId(searchParams.get("id"));
  const openToken = sanitizeToken(searchParams.get("openToken"));
  const subscriptionNameParam = sanitizeName(searchParams.get("name"));

  const [resolvedSubscriptionId, setResolvedSubscriptionId] = useState<string | null>(idParam);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Function to mint deeplink token
  const mintDeeplinkToken = async (id: string) => {
    const res = await fetch('/api/deeplink/token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'subscription', id: String(id) }),
    });
    if (!res.ok) throw new Error('Failed to create deeplink token');
    const data = (await res.json()) as { token?: string };
    if (!data?.token) throw new Error('Invalid deeplink token response');
    return String(data.token);
  };

  // Handle back navigation to subscriptions with modal reopened
  const handleBackToSubscriptions = () => {
    const idToOpen = resolvedSubscriptionId || idParam;
    
    if (!idToOpen) {
      navigate("/subscriptions", { replace: true });
      return;
    }

    void (async () => {
      try {
        const token = await mintDeeplinkToken(String(idToOpen));
        const qs = new URLSearchParams({ openToken: token }).toString();
        navigate(`/subscriptions?${qs}`, { replace: true });
      } catch {
        const qs = new URLSearchParams({ open: String(idToOpen) }).toString();
        navigate(`/subscriptions?${qs}`, { replace: true });
      }
    })();
  };

  useEffect(() => {
    if (idParam) {
      setTokenError(null);
      setResolvedSubscriptionId(idParam);
      return;
    }

    if (!openToken) {
      setTokenError(null);
      setResolvedSubscriptionId(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const qs = new URLSearchParams({ token: openToken }).toString();
        const res = await fetch(`/api/deeplink/resolve?${qs}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to resolve token");
        const data = (await res.json()) as { id?: string };
        const resolved = sanitizeId(data?.id ? String(data.id) : null);
        if (!resolved) throw new Error("Invalid token payload");
        if (!cancelled) {
          setTokenError(null);
          setResolvedSubscriptionId(resolved);
        }
      } catch {
        if (!cancelled) {
          setResolvedSubscriptionId(null);
          setTokenError("Invalid or expired link");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idParam, openToken]);

  const queryClient = useQueryClient();

  const pageSize = 50;
  const [page, setPage] = useState(1);
  const [expandedChangeRows, setExpandedChangeRows] = useState<Record<string, boolean>>({});

  const effectiveSubscriptionId = resolvedSubscriptionId;
  const endpoint = effectiveSubscriptionId ? `/api/history/${effectiveSubscriptionId}` : `/api/history/list`;
  const queryKey = effectiveSubscriptionId
    ? ["/api/history", "subscription", effectiveSubscriptionId, page, pageSize]
    : ["/api/history", "list", page, pageSize];

  type HistoryPageResponse = {
    items: HistoryRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };

  const { data: historyPage, isLoading, isFetching, refetch } = useQuery<HistoryPageResponse>({
    queryKey,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString();
        const res = await apiRequest("GET", `${endpoint}?${qs}`);
        const json = await res.json().catch(() => null);
        if (json && typeof json === 'object' && Array.isArray((json as any).items)) {
          return json as HistoryPageResponse;
        }
        const items = Array.isArray(json) ? (json as HistoryRecord[]) : [];
        return { items, total: items.length, page: 1, pageSize: items.length, totalPages: 1 };
      } catch (e) {
        console.error("Failed to load history:", e);
        return { items: [], total: 0, page: 1, pageSize, totalPages: 1 };
      }
    },
  });

  useEffect(() => {
    setPage(1);
  }, [effectiveSubscriptionId]);

  const historyItems = historyPage?.items ?? [];
  const totalPages = historyPage?.totalPages ?? 1;

  const { data: subscriptions = [] } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    enabled: !effectiveSubscriptionId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/subscriptions");
        const json = await res.json().catch(() => []);
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    },
  });

  const subscriptionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const sub of subscriptions) {
      const name = String((sub as any)?.serviceName || "").trim();
      if (!name) continue;
      const id = (sub as any)?.id;
      const oid = (sub as any)?._id;
      if (id) map.set(String(id), name);
      if (oid) map.set(String(oid), name);
    }
    return map;
  }, [subscriptions]);

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
    const items = Array.isArray(historyItems) ? [...historyItems] : [];
    const isNamed = Boolean(effectiveSubscriptionId);
    
    // Filter out records that have no actual changes
    const filtered = items.filter(item => hasActualChanges(item, isNamed));
    
    filtered.sort((a, b) => {
      const aStamp = a.loggedAt || a.timestamp;
      const bStamp = b.loggedAt || b.timestamp;
      const aTimeRaw = parseTimestampLike(aStamp)?.getTime() ?? NaN;
      const bTimeRaw = parseTimestampLike(bStamp)?.getTime() ?? NaN;
      const aTime = Number.isFinite(aTimeRaw) ? aTimeRaw : 0;
      const bTime = Number.isFinite(bTimeRaw) ? bTimeRaw : 0;
      if (bTime !== aTime) return bTime - aTime;
      return String(b._id || "").localeCompare(String(a._id || ""));
    });
    return filtered;
  }, [historyItems]);

  const firstName =
    (sortedHistory?.[0]?.updatedFields?.serviceName as string) ||
    (sortedHistory?.[0]?.data?.serviceName as string) ||
    "Selected Subscription";

  const headerName = subscriptionNameParam || firstName;
  const isNamedHistory = Boolean(effectiveSubscriptionId);
  const headerTitle = isNamedHistory ? `${headerName} History Log` : "Audit Trail";
  const displayedHeaderName = isNamedHistory ? (truncateText(String(headerName), 45) || String(headerName)) : "";

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-['Inter']">
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {isNamedHistory && (
                <Button
                  onClick={handleBackToSubscriptions}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-blue-500/20 hover:bg-blue-500/30 backdrop-blur-sm border border-blue-300/50 shadow-sm transition-all duration-200 hover:scale-105"
                >
                  <ArrowLeft className="h-5 w-5 text-blue-600" />
                </Button>
              )}
              <div className="h-12 w-12 flex items-center justify-center">
                <History className="h-7 w-7 text-indigo-600" />
              </div>
              <div>
                <h1
                  className="text-2xl font-semibold text-gray-900 tracking-tight max-w-[70vw] flex items-center gap-2 min-w-0"
                  title={headerTitle}
                >
                  {isNamedHistory ? (
                    <>
                      <span className="truncate min-w-0">{displayedHeaderName}</span>
                      <span className="flex-shrink-0 whitespace-nowrap">History Log</span>
                    </>
                  ) : (
                    <span className="truncate">{headerTitle}</span>
                  )}
                </h1>
                {tokenError ? <p className="text-sm text-red-600 mt-1">{tokenError}</p> : null}
              </div>
            </div>
          </div>
        </div>

        {/* Log Table */}
        <Card className="flex-1 overflow-hidden flex flex-col border-slate-200 shadow-lg bg-white">
          <div className="flex-1 overflow-auto relative">
            {isLoading && !historyPage ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading logs...</p>
                </div>
              </div>
            ) : sortedHistory.length > 0 ? (
              <div className="h-full overflow-auto">
                {isFetching && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-100 z-50">
                    <div className="h-full bg-blue-600 animate-pulse"></div>
                  </div>
                )}
                <table className="w-full table-fixed border-collapse">
                  <thead className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                    <tr className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                      {!effectiveSubscriptionId && (
                        <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[200px]">Subscription Name</th>
                      )}
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[180px]">Changed By</th>
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[500px]">Change Summary</th>
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[180px]">Updated On</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {sortedHistory.map((item: any, index: number) => {
                      const stampToShow = item.loggedAt || item.timestamp;
                      const timestamp = formatTimestamp(stampToShow, { forceLocal: Boolean(item.loggedAt) });
                      const recordSubId = item?.subscriptionId ? String(item.subscriptionId) : "";
                      const name =
                        item?.updatedFields?.serviceName ||
                        item?.data?.serviceName ||
                        item?.subscriptionName ||
                        (recordSubId ? subscriptionNameById.get(recordSubId) : "") ||
                        "Unknown Subscription";
                      const changedBy =
                        item?.changedBy ||
                        item?.user ||
                        item?.data?.ownerName ||
                        item?.data?.owner ||
                        "System";
                      const changesText = buildChangesText(item, isNamedHistory);
                      const rowKey = String(item._id || `${stampToShow ?? ""}-${index}`);
                      const fullChanges = String(changesText ?? "").trim();
                      const changeLines = fullChanges.split(/\r?\n/).filter((l) => l.trim() !== "");
                      const firstLine = changeLines[0] ?? "";
                      const summary = truncateText(firstLine, 160);
                      const hasMore = changeLines.length > 1 || summary !== firstLine;
                      const isExpanded = Boolean(expandedChangeRows[rowKey]);

                      return (
                        <tr
                          key={item._id || index}
                          className={`border-b border-gray-100 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          } hover:bg-indigo-50/40`}
                        >
                          {!effectiveSubscriptionId && (
                            <td className="px-4 py-3 font-medium text-gray-800 w-[200px] max-w-[200px]">
                              <div className="truncate" title={name}>{name}</div>
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-gray-800 w-[180px] max-w-[180px]">
                            <div className="truncate" title={changedBy}>{changedBy}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 w-[500px] max-w-[500px]">
                            <div className="flex items-start gap-2">
                              <div className="whitespace-pre-wrap break-words leading-relaxed flex-1 min-w-0" title={fullChanges || "No changes recorded"}>
                                {(isExpanded ? fullChanges : summary) || "No changes recorded"}
                              </div>
                              {hasMore && (
                                <button
                                  type="button"
                                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap flex-shrink-0"
                                  onClick={() =>
                                    setExpandedChangeRows((prev) => ({
                                      ...prev,
                                      [rowKey]: !Boolean(prev[rowKey]),
                                    }))
                                  }
                                >
                                  {isExpanded ? "Show Less" : "Show More"}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 w-[180px] min-w-[180px]">
                            <div className="whitespace-nowrap">
                              <span className="font-medium">{timestamp.date}</span>
                              {timestamp.time && <span className="text-xs text-gray-400 ml-2">{timestamp.time}</span>}
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
                      {effectiveSubscriptionId ? "No history records found for this subscription" : "No history records found"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {effectiveSubscriptionId
                        ? "This subscription has no recorded changes yet"
                        : "Logs will appear here when subscriptions are created, updated, renewed, or deleted"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {totalPages > 1 ? (
            <div className="border-t border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                {[1, 2, 3]
                  .filter((p) => p <= totalPages)
                  .map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={p === page ? "default" : "outline"}
                      className="h-9 w-10 px-0"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
