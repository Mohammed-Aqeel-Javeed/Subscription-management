import { useMemo } from "react";
import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { History, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

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

function truncateText(value: string | undefined | null, maxChars: number) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars)).trimEnd()}...` : text;
}

function getRenewalStatusLabel(status: string) {
  const s = String(status || "").trim();
  return s || "-";
}

function getRenewalNotesPreview(raw: any): string {
  if (!raw) return "";

  if (Array.isArray(raw)) {
    const last = raw[raw.length - 1];
    return String(last?.text || "").trim();
  }

  const asString = String(raw);
  const trimmed = asString.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const last = parsed[parsed.length - 1];
      return String(last?.text || "").trim();
    }
  } catch {
    // ignore
  }

  return trimmed;
}

export default function ComplianceLogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const idParam = useMemo(() => sanitizeId(searchParams.get("id")), [searchParams]);
  const openToken = useMemo(() => sanitizeToken(searchParams.get("openToken")), [searchParams]);
  const licenseNameParam = useMemo(() => sanitizeName(searchParams.get("name")), [searchParams]);

  const [resolvedLicenseId, setResolvedLicenseId] = React.useState<string | null>(idParam);
  const [tokenError, setTokenError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (idParam) {
      setTokenError(null);
      setResolvedLicenseId(idParam);
      return;
    }

    if (!openToken) {
      setTokenError(null);
      setResolvedLicenseId(null);
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
          setResolvedLicenseId(resolved);
        }
      } catch {
        if (!cancelled) {
          setResolvedLicenseId(null);
          setTokenError("Invalid or expired link");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idParam, openToken]);

  const licenseId = resolvedLicenseId;

  // Function to mint deeplink token
  const mintDeeplinkToken = async (id: string) => {
    const res = await fetch('/api/deeplink/token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'license', id: String(id) }),
    });
    if (!res.ok) throw new Error('Failed to create deeplink token');
    const data = (await res.json()) as { token?: string };
    if (!data?.token) throw new Error('Invalid deeplink token response');
    return String(data.token);
  };

  // Handle back navigation to government-license with modal reopened
  const handleBackToRenewals = () => {
    const idToOpen = resolvedLicenseId || idParam;
    
    if (!idToOpen) {
      navigate("/government-license", { replace: true });
      return;
    }

    void (async () => {
      try {
        const token = await mintDeeplinkToken(String(idToOpen));
        const qs = new URLSearchParams({ openToken: token }).toString();
        navigate(`/government-license?${qs}`, { replace: true });
      } catch {
        const qs = new URLSearchParams({ open: String(idToOpen) }).toString();
        navigate(`/government-license?${qs}`, { replace: true });
      }
    })();
  };

  const { data: logEntries = [], isLoading } = useQuery({
    queryKey: ["/api/licenses", licenseId, "renewal-status-log"],
    enabled: Boolean(licenseId),
    queryFn: async () => {
      if (!licenseId) return [];
      const res = await fetch(`${API_BASE_URL}/api/licenses/${encodeURIComponent(licenseId)}/renewal-status-log`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const title = licenseId && licenseNameParam ? `${decodeURIComponent(licenseNameParam)} Log` : "Compliance Log";

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-['Inter']">
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <History className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight truncate max-w-[70vw]" title={title}>
                  {truncateText(title, 80) || title}
                </h1>
                {tokenError ? <p className="text-sm text-red-600 mt-1">{tokenError}</p> : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleBackToRenewals}
                variant="outline"
                className="flex items-center gap-2 bg-gradient-to-br from-indigo-500/90 to-blue-600/90 hover:from-indigo-600/90 hover:to-blue-700/90 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Renewals
              </Button>
            </div>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col border-slate-200 shadow-lg bg-white">
          <div className="flex-1 overflow-auto relative">
            {!licenseId ? (
              <div className="flex items-center justify-center h-full p-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <History className="h-8 w-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">No renewal selected</p>
                    <p className="text-sm text-slate-500 mt-1">Open this page from the Renewal Submit → Log button.</p>
                  </div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading log...</p>
                </div>
              </div>
            ) : logEntries && logEntries.length > 0 ? (
              <div className="h-full overflow-auto">
                <table className="w-full table-fixed border-collapse">
                  <thead className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                    <tr className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[220px]">Renewal Status</th>
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[170px]">New Issue Date</th>
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[170px]">New Expiry Date</th>
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[190px]">Renewal Initiated date</th>
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[190px]">Submitted by</th>
                      <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {logEntries.map((row: any, index: number) => {
                      const notesText = getRenewalNotesPreview(row?.renewalNotes);
                      const statusLabel = row?.renewalStatus ? getRenewalStatusLabel(String(row.renewalStatus)) : "-";
                      const key = String(row?.id || row?._id || row?.loggedAt || Math.random());
                      return (
                        <tr
                          key={key}
                          className={`border-b border-gray-100 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          } hover:bg-indigo-50/40`}
                        >
                          <td className="text-sm text-slate-900 align-top py-3 px-4">{statusLabel || "-"}</td>
                          <td className="text-sm text-slate-700 align-top py-3 px-4">
                            {row?.startDate ? new Date(String(row.startDate)).toLocaleDateString("en-GB") : "-"}
                          </td>
                          <td className="text-sm text-slate-700 align-top py-3 px-4">
                            {row?.endDate ? new Date(String(row.endDate)).toLocaleDateString("en-GB") : "-"}
                          </td>
                          <td className="text-sm text-slate-700 align-top py-3 px-4">
                            {row?.renewalInitiatedDate
                              ? new Date(String(row.renewalInitiatedDate)).toLocaleDateString("en-GB")
                              : "-"}
                          </td>
                          <td className="text-sm text-slate-700 align-top py-3 px-4">{String(row?.submittedBy || "-")}</td>
                          <td className="text-sm text-slate-600 align-top py-3 px-4" title={notesText}>
                            {notesText ? truncateText(notesText, 60) : "-"}
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
                    <p className="text-slate-600 font-medium">No log entries yet</p>
                    <p className="text-sm text-slate-500 mt-1">Log entries appear after you update Renewal Submit fields.</p>
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
