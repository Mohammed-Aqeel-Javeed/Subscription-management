import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars)).trimEnd()}...` : text;
}

function truncateMultiline(value: string | undefined | null, maxCharsPerLine: number) {
  const text = String(value ?? '');
  if (!text) return '';
  const lines = text.split('\n');
  return lines.map((l) => truncateText(l, maxCharsPerLine)).join('\n');
}

export default function RenewalLog() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idParam = useMemo(() => sanitizeId(searchParams.get('id')), [searchParams]);
  const openToken = useMemo(() => sanitizeToken(searchParams.get('openToken')), [searchParams]);
  const licenseNameParam = useMemo(() => sanitizeName(searchParams.get('name')), [searchParams]);
  const viewParam = useMemo(() => String(searchParams.get('view') || '').trim().toLowerCase(), [searchParams]);
  const stateView = useMemo(() => {
    const v = (location.state as any)?.view;
    return typeof v === 'string' ? v.trim().toLowerCase() : '';
  }, [location.state]);
  const isSubmissionView = viewParam === 'submission' || stateView === 'submission';

  const [resolvedLicenseId, setResolvedLicenseId] = useState<string | null>(idParam);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isResolvingToken, setIsResolvingToken] = useState(() => Boolean(openToken && !idParam));

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

  useEffect(() => {
    if (idParam) {
      setIsResolvingToken(false);
      setTokenError(null);
      setResolvedLicenseId(idParam);
      return;
    }

    if (!openToken) {
      setIsResolvingToken(false);
      setTokenError(null);
      setResolvedLicenseId(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      if (!cancelled) setIsResolvingToken(true);
      try {
        const qs = new URLSearchParams({ token: openToken }).toString();
        const res = await fetch(`/api/deeplink/resolve?${qs}`, { credentials: "include" });
        if (!res.ok) throw new Error('Failed to resolve token');
        const data = (await res.json()) as { id?: string };
        const resolved = sanitizeId(data?.id ? String(data.id) : null);
        if (!resolved) throw new Error('Invalid token payload');
        if (!cancelled) {
          setTokenError(null);
          setResolvedLicenseId(resolved);
          setIsResolvingToken(false);

          // Persist the resolved ID into the URL so a refresh/idle tab reload
          // doesn't depend on an expiring deeplink token.
          try {
            const next = new URLSearchParams(searchParams);
            if (!next.get('id')) next.set('id', resolved);
            navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true, state: location.state });
          } catch {
            // no-op
          }
        }
      } catch {
        if (!cancelled) {
          setResolvedLicenseId(null);
          setTokenError('Invalid or expired link');
          setIsResolvingToken(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idParam, openToken, location.pathname, location.state, navigate, searchParams]);

  const licenseId = resolvedLicenseId;
  const showAllLogs = !licenseId && !openToken;

  // Fetch logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["/api/logs"],
    enabled: !isResolvingToken && (Boolean(licenseId) || showAllLogs),
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/logs`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Filter logs by license ID if provided
  // Try to match by licenseId first (new logs), fallback to licenseName (old logs)
  const filteredLogs = licenseId 
    ? logs.filter((log: any) => {
        // First try to match by licenseId (for new logs)
        if (log.licenseId) {
          return log.licenseId === licenseId;
        }
        // If no licenseId in log, we can't filter by ID
        // This means old logs won't show when filtering by ID
        return false;
      })
    : showAllLogs
      ? logs
      : [];

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return { date: '-', time: '' };
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return { date: '-', time: '' };
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}`
    };
  };

  const formatAmount = (value: any) => {
    if (value === null || value === undefined) return '-';
    const s = typeof value === 'string' ? value.trim() : '';
    const n = typeof value === 'number' ? value : (s ? Number(s) : Number.NaN);
    if (!Number.isFinite(n)) return '-';
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const extractNewValueFromChanges = (changes: any, label: string) => {
    const text = String(changes || '');
    if (!text) return '';
    const line = text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().startsWith(`${label.toLowerCase()}:`));
    if (!line) return '';
    const afterColon = line.slice(line.indexOf(':') + 1).trim();
    // Prefer the "new" side when we have an arrow (old → new)
    const arrowIdx = afterColon.lastIndexOf('→');
    if (arrowIdx >= 0) return afterColon.slice(arrowIdx + 1).trim();
    return afterColon;
  };

  const formatIsoDateFromTimestamp = (ts: any) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  // Renewal Status pill (match Renewal page colors/labels)
  const getRenewalStatusPillClassName = (renewalStatus: string) => {
    switch (renewalStatus) {
      case 'Approved':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'Rejected':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'Renewal Initiated':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Application Submitted':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'Amendments/ Appeal Submitted':
        return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'Resubmitted':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const getRenewalStatusPillLabel = (renewalStatus: string) => {
    switch (renewalStatus) {
      case 'Renewal Initiated':
        return 'Initiated';
      case 'Application Submitted':
        return 'Submitted';
      case 'Amendments/ Appeal Submitted':
        return 'Amendment/Appeal';
      default:
        return renewalStatus;
    }
  };

  const isSubmissionLogEntry = (log: any) => {
    if (!log) return false;
    if (log.renewalStatus || log.submittedBy || log.renewalInitiatedDate) return true;
    const changes = String(log.changes || '');
    return (
      changes.includes('Renewal Status:') ||
      changes.includes('Submitted By:') ||
      changes.includes('Renewal Amount:') ||
      changes.includes('Renewal Initiated:')
    );
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-['Inter']">
      <div className="flex-1 overflow-hidden flex flex-col p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 flex items-center justify-center">
                <History className="h-7 w-7 text-indigo-600" />
              </div>
              <div>
                {(() => {
                  const derivedName = filteredLogs.length > 0 ? (filteredLogs[0]?.licenseName as string | undefined) : undefined;
                  const displayName = licenseNameParam ? decodeURIComponent(licenseNameParam) : derivedName;
                  const isNamedHistory = Boolean(licenseId && displayName);
                  const title = isSubmissionView
                    ? (isNamedHistory ? `${displayName} Submission Log` : 'Renewal Submission Log')
                    : (isNamedHistory ? `${displayName} History Log` : 'Renewal History Log');
                  const displayedHeaderName = isNamedHistory ? (truncateText(String(displayName), 45) || String(displayName)) : '';
                  return (
                    <h1
                      className="text-2xl font-semibold text-gray-900 tracking-tight max-w-[70vw] flex items-center gap-2 min-w-0"
                      title={title}
                    >
                      {isNamedHistory ? (
                        <>
                          <span className="truncate min-w-0">{displayedHeaderName}</span>
                          <span className="flex-shrink-0 whitespace-nowrap">{isSubmissionView ? 'Submission Log' : 'History Log'}</span>
                        </>
                      ) : (
                        <span className="truncate">{title}</span>
                      )}
                    </h1>
                  );
                })()}
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
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="h-full overflow-auto">
                <table className="w-full table-fixed border-collapse">
                  <thead className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                    <tr className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                      {isSubmissionView ? (
                        <>
                          <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[140px]">Date</th>
                          <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[220px]">Renewal Status</th>
                          <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[240px]">Submitted By</th>
                          <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[140px]">Amount</th>
                          <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[140px]">Updated On</th>
                        </>
                      ) : (
                        <>
                          {!licenseId && (
                            <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[200px]">Renewal Name</th>
                          )}
                          <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[180px]">Changed By</th>
                          <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[400px]">Changes</th>
                          <th className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[140px]">Updated On</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                  {(isSubmissionView ? filteredLogs.filter(isSubmissionLogEntry) : filteredLogs).map((log: any, index: number) => {
                    const timestamp = formatTimestamp(log.timestamp);

                    // Submission-view fields (prefer structured fields; fallback to parsing changes text)
                    const initiated =
                      String(log.renewalInitiatedDate || '').trim() ||
                      extractNewValueFromChanges(log.changes, 'Renewal Initiated') ||
                      formatIsoDateFromTimestamp(log.timestamp);
                    const renewalStatus = String(log.renewalStatus || '').trim() ||
                      extractNewValueFromChanges(log.changes, 'Renewal Status');
                    const isApproved = String(renewalStatus || '').trim().toLowerCase() === 'approved';
                    const submittedBy =
                      String(log.submittedBy || '').trim() ||
                      extractNewValueFromChanges(log.changes, 'Submitted By') ||
                      (isApproved ? '' : String(log.user || '').trim()) ||
                      String(log.user || '').trim();
                    const amount =
                      log.amount ??
                      (() => {
                        const parsed = extractNewValueFromChanges(log.changes, 'Renewal Amount');
                        return parsed ? parsed : undefined;
                      })();

                    const approvedIssueDate =
                      String((log as any).approvedIssueDate || '').trim() ||
                      extractNewValueFromChanges(log.changes, 'Issue Date');

                    const dateForSubmissionLog = isApproved
                      ? (approvedIssueDate || initiated)
                      : initiated;

                    // History-view: show changes (filtered) like before
                    let changesText = log.changes || 'No changes recorded';
                    if (!isSubmissionView && String(changesText || '').includes('\n')) {
                      const lines = String(changesText)
                        .split('\n')
                        .filter((line: string) => {
                          if (!line.includes('Not Set →')) return true;
                          if (
                            line.includes('Cancellation Reason:') ||
                            line.includes('Rejection Reason:') ||
                            line.includes('Amendment/Appeal Reason:')
                          ) {
                            return true;
                          }
                          return false;
                        });
                      changesText = lines.length > 0 ? lines.join('\n') : changesText;
                    }

                    return (
                      <tr
                        key={index}
                        className={`border-b border-gray-100 transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        } hover:bg-indigo-50/40`}
                      >
                        {isSubmissionView ? (
                          <>
                            <td className="text-sm text-slate-700 align-top py-3 px-4">{dateForSubmissionLog || '-'}</td>
                            <td className="text-sm text-slate-700 align-top py-3 px-4">
                              {renewalStatus ? (
                                <span
                                  className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-tight whitespace-nowrap min-w-[180px] text-left ${getRenewalStatusPillClassName(renewalStatus)}`}
                                  title={renewalStatus}
                                >
                                  {getRenewalStatusPillLabel(renewalStatus)}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="text-sm text-slate-700 align-top py-3 px-4">{submittedBy || '-'}</td>
                            <td className="text-sm text-slate-700 align-top py-3 px-4">{formatAmount(amount)}</td>
                            <td className="text-sm text-slate-500 align-top py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-medium">{timestamp.date}</span>
                                {timestamp.time && <span className="text-xs text-slate-400">{timestamp.time}</span>}
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            {!licenseId && (
                              <td className="font-medium text-sm text-slate-900 align-top py-3 px-4">
                                <span className="block max-w-[260px] truncate" title={String(log.licenseName || '')}>
                                  {truncateText(String(log.licenseName || '-'), 28) || '-'}
                                </span>
                              </td>
                            )}
                            <td className="text-sm text-slate-700 align-top py-3 px-4">
                              {String((log as any).userDisplayName || log.user || 'System')}
                            </td>
                            <td className="text-sm text-slate-600 align-top py-3 px-4">
                              <div className="whitespace-pre-line leading-relaxed" title={String(changesText || 'No changes recorded')}>
                                {truncateMultiline(String(changesText || 'No changes recorded'), 90)}
                              </div>
                            </td>
                            <td className="text-sm text-slate-500 align-top py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-medium">{timestamp.date}</span>
                                {timestamp.time && <span className="text-xs text-slate-400">{timestamp.time}</span>}
                              </div>
                            </td>
                          </>
                        )}
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
                      {licenseId ? 'No history records found for this renewal' : 'No history records found'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {licenseId 
                        ? 'This renewal has no recorded changes yet' 
                        : 'Logs will appear here when renewals are created, updated, or deleted'}
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
