import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Calendar, CheckCircle, XCircle, Clock, History } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";

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

// Helper to format date as dd/mm/yyyy
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};

const toDateMs = (value: unknown): number => {
  if (!value) return 0;
  const d = new Date(String(value));
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
};

const ledgerSortMs = (item: any): number => {
  return (
    toDateMs(item?.filingSubmissionDate) ||
    toDateMs(item?.createdAt) ||
    toDateMs(item?.updatedAt) ||
    0
  );
};

// Dynamic status calculation - same as in compliance.tsx
const getComplianceStatus = (endDate?: string, submissionDeadline?: string): string => {
  // If no dates provided, default to Pending
  if (!endDate && !submissionDeadline) return "Pending";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today for accurate comparison
  
  // Use submission deadline if available, otherwise use end date
  const targetDate = new Date(submissionDeadline || endDate || "");
  if (isNaN(targetDate.getTime())) return "Pending";
  
  targetDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
  
  // If today is past the target date, it's overdue
  if (today > targetDate) {
    return "Overdue";
  }
  
  // If today equals the target date, it's due today
  if (today.getTime() === targetDate.getTime()) {
    return "Due Today";
  }
  
  // If target date is in the future, it's pending
  return "Pending";
};

// Function to map status values and get appropriate icon
const getStatusInfo = (status: string) => {
  if (status === "Completed") {
    return { 
      text: "Completed", 
      variant: "default" as const, 
      icon: <CheckCircle className="w-4 h-4" />,
      color: "bg-green-100 text-green-800"
    };
  } else if (status === "Overdue") {
    return { 
      text: "Overdue", 
      variant: "destructive" as const, 
      icon: <XCircle className="w-4 h-4" />,
      color: "bg-red-100 text-red-800"
    };
  } else if (status === "Due Today") {
    return { 
      text: "Due Today", 
      variant: "secondary" as const, 
      icon: <Clock className="w-4 h-4" />,
      color: "bg-orange-100 text-orange-800"
    };
  } else if (status === "Pending") {
    return { 
      text: "Pending", 
      variant: "secondary" as const, 
      icon: <Clock className="w-4 h-4" />,
      color: "bg-yellow-100 text-yellow-800"
    };
  } else {
    return { 
      text: status, 
      variant: "destructive" as const, 
      icon: <XCircle className="w-4 h-4" />,
      color: "bg-red-100 text-red-800"
    };
  }
};

const getCategoryPillClasses = (category?: string) => {
  const value = String(category || "").trim();
  if (!value) return "bg-slate-100 text-slate-700 border-slate-200";

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
};

const truncateText = (value: unknown, maxChars: number) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars)).trimEnd()}...` : text;
};

export default function ComplianceLedger() {

  const [searchParams] = useSearchParams();

  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(1);

  const idParam = sanitizeId(searchParams.get("id"));
  const openToken = sanitizeToken(searchParams.get("openToken"));
  const complianceNameParam = sanitizeName(searchParams.get("name"));

  const [resolvedComplianceId, setResolvedComplianceId] = React.useState<string | null>(idParam);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const [isResolvingToken, setIsResolvingToken] = React.useState(() => Boolean(openToken && !idParam));

  React.useEffect(() => {
    if (idParam) {
      setIsResolvingToken(false);
      setTokenError(null);
      setResolvedComplianceId(idParam);
      return;
    }

    if (!openToken) {
      setIsResolvingToken(false);
      setTokenError(null);
      setResolvedComplianceId(null);
      return;
    }

    // Block list fetch immediately (avoid brief "all history" flash)
    setIsResolvingToken(true);

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
          setResolvedComplianceId(resolved);
          setIsResolvingToken(false);
        }
      } catch {
        if (!cancelled) {
          setResolvedComplianceId(null);
          setTokenError("Invalid or expired link");
          setIsResolvingToken(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idParam, openToken]);

  const complianceId = resolvedComplianceId;
  const isFilteredById = Boolean(complianceId);

  React.useEffect(() => {
    setPage(1);
  }, [complianceId]);

  type ColumnDef = {
    id: string;
    label: string;
    defaultVisible: boolean;
    headerClassName?: string;
    cellClassName?: string;
    renderCell: (item: any) => React.ReactNode;
  };

  const columns = React.useMemo<ColumnDef[]>(() => {
    const base: ColumnDef[] = [];

    if (!isFilteredById) {
      base.push({
        id: "filingName",
        label: "Filing Name",
        defaultVisible: true,
        cellClassName: "font-medium text-gray-900 max-w-[280px] truncate",
        renderCell: (item) => (
          <span title={String(item.filingName || "")}>
            {truncateText(String(item.filingName || ""), 28) || "-"}
          </span>
        ),
      });
    }

    base.push(
      {
        id: "category",
        label: "Category",
        defaultVisible: true,
        renderCell: (item) => (
          <div className="flex items-center justify-start">
            <span
              className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-tight border min-w-[110px] ${getCategoryPillClasses(
                item.filingComplianceCategory
              )}`}
            >
              {item.filingComplianceCategory || "-"}
            </span>
          </div>
        ),
      },
      {
        id: "startDate",
        label: "Start Date",
        defaultVisible: true,
        renderCell: (item) => (
          <div className="flex items-center text-gray-700">
            <Calendar className="w-4 h-4 mr-2 text-gray-500" />
            {formatDate(item.filingStartDate)}
          </div>
        ),
      },
      {
        id: "endDate",
        label: "End Date",
        defaultVisible: true,
        renderCell: (item) => (
          <div className="flex items-center text-gray-700">
            <Calendar className="w-4 h-4 mr-2 text-gray-500" />
            {formatDate(item.filingEndDate)}
          </div>
        ),
      },
      {
        id: "submissionDate",
        label: "LAST SUBMITTED DATE",
        defaultVisible: true,
        renderCell: (item) => (
          <div className="flex items-center text-gray-700">
            <Calendar className="w-4 h-4 mr-2 text-gray-500" />
            {formatDate(item.filingSubmissionDate)}
          </div>
        ),
      },
      {
        id: "submissionNotes",
        label: "Submission Notes",
        defaultVisible: false,
        cellClassName: "max-w-[360px] truncate",
        renderCell: (item) => {
          const raw =
            (typeof item?.submissionNotes === "string" && item.submissionNotes.trim())
              ? item.submissionNotes
              : (typeof item?.filingRemarks === "string" ? item.filingRemarks : "");
          const value = String(raw || "").trim();
          return <span title={value}>{truncateText(value, 48) || "-"}</span>;
        },
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        renderCell: (item) => {
          let displayStatus = item.filingSubmissionStatus;
          if (item.filingSubmissionDate) {
            displayStatus = "Completed";
          } else {
            displayStatus = getComplianceStatus(item.filingEndDate, item.filingSubmissionDeadline);
          }
          const statusInfo = getStatusInfo(displayStatus);
          return (
            <Badge variant="outline" className={`${statusInfo.color} flex items-center gap-1 border-0`}>
              {statusInfo.icon}
              {statusInfo.text}
            </Badge>
          );
        },
      }
    );

    return base;
  }, [isFilteredById]);

  const [visibleColumnIds, setVisibleColumnIds] = React.useState<string[]>(() =>
    columns.filter((c) => c.defaultVisible).map((c) => c.id)
  );

  React.useEffect(() => {
    setVisibleColumnIds((prev) => {
      const allowed = new Set(columns.map((c) => c.id));
      const next = prev.filter((id) => allowed.has(id));
      if (next.length > 0) return next;
      return columns.filter((c) => c.defaultVisible).map((c) => c.id);
    });
  }, [columns]);

  const visibleColumns = React.useMemo(() => {
    const set = new Set(visibleColumnIds);
    return columns.filter((c) => set.has(c.id));
  }, [columns, visibleColumnIds]);

  const tableColumnCount = visibleColumns.length;
  
  const queryClient = useQueryClient();

  type LedgerPageResponse = {
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };

  const { data: ledgerPage, isLoading, isFetching } = useQuery<LedgerPageResponse>({
    queryKey: ["/api/ledger/list", complianceId || 'all', page, pageSize],
    enabled: !isResolvingToken,
    staleTime: 0,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (complianceId) params.set('complianceId', complianceId);
      const res = await fetch(`/api/ledger/list?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch ledger data");
      const json = await res.json();

      const pageItems: any[] = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
      const serverTotalPages = typeof json?.totalPages === 'number' ? json.totalPages : 1;
      const serverPage = typeof json?.page === 'number' ? json.page : 1;

      // Backward-compat safety: if server returned an array, filter client-side.
      let filteredData = pageItems;
      if (complianceId && Array.isArray(json)) {
        filteredData = pageItems.filter((item: any) => item.complianceId === complianceId || item._id === complianceId);
      }

      const sortedData = [...(Array.isArray(filteredData) ? filteredData : [])].sort((a: any, b: any) => {
        const diff = ledgerSortMs(b) - ledgerSortMs(a);
        if (diff !== 0) return diff;
        return String(b?._id || b?.id || '').localeCompare(String(a?._id || a?.id || ''));
      });

      return {
        items: sortedData,
        total: typeof json?.total === 'number' ? json.total : sortedData.length,
        page: serverPage,
        pageSize,
        totalPages: serverTotalPages > 0 ? serverTotalPages : 1
      };
    }
  });

  const ledgerItems = ledgerPage?.items ?? [];
  const totalPages = ledgerPage?.totalPages ?? 1;
  const totalItems = ledgerPage?.total ?? 0;
  const loading = isLoading && !ledgerPage;

  // Prefetch adjacent pages for instant navigation
  React.useEffect(() => {
    if (!queryClient || isResolvingToken) return;

    // Prefetch next page
    if (page < totalPages) {
      const nextPage = page + 1;
      queryClient.prefetchQuery({
        queryKey: ["/api/ledger/list", complianceId || 'all', nextPage, pageSize],
        queryFn: async () => {
          const params = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize) });
          if (complianceId) params.set('complianceId', complianceId);
          const res = await fetch(`/api/ledger/list?${params.toString()}`);
          if (!res.ok) throw new Error("Failed to fetch ledger data");
          const json = await res.json();
          const pageItems: any[] = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
          const serverTotalPages = typeof json?.totalPages === 'number' ? json.totalPages : 1;
          const serverPage = typeof json?.page === 'number' ? json.page : 1;
          
          let filteredData = pageItems;
          if (complianceId && Array.isArray(json)) {
            filteredData = pageItems.filter((item: any) => item.complianceId === complianceId || item._id === complianceId);
          }
          const sortedData = [...(Array.isArray(filteredData) ? filteredData : [])].sort((a: any, b: any) => {
            const diff = ledgerSortMs(b) - ledgerSortMs(a);
            if (diff !== 0) return diff;
            return String(b?._id || b?.id || '').localeCompare(String(a?._id || a?.id || ''));
          });
          return {
            items: sortedData,
            total: typeof json?.total === 'number' ? json.total : sortedData.length,
            page: serverPage,
            pageSize,
            totalPages: serverTotalPages > 0 ? serverTotalPages : 1
          };
        },
        staleTime: 0,
      });
    }

    // Prefetch previous page
    if (page > 1) {
      const prevPage = page - 1;
      queryClient.prefetchQuery({
        queryKey: ["/api/ledger/list", complianceId || 'all', prevPage, pageSize],
        queryFn: async () => {
          const params = new URLSearchParams({ page: String(prevPage), pageSize: String(pageSize) });
          if (complianceId) params.set('complianceId', complianceId);
          const res = await fetch(`/api/ledger/list?${params.toString()}`);
          if (!res.ok) throw new Error("Failed to fetch ledger data");
          const json = await res.json();
          const pageItems: any[] = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
          const serverTotalPages = typeof json?.totalPages === 'number' ? json.totalPages : 1;
          const serverPage = typeof json?.page === 'number' ? json.page : 1;
          
          let filteredData = pageItems;
          if (complianceId && Array.isArray(json)) {
            filteredData = pageItems.filter((item: any) => item.complianceId === complianceId || item._id === complianceId);
          }
          const sortedData = [...(Array.isArray(filteredData) ? filteredData : [])].sort((a: any, b: any) => {
            const diff = ledgerSortMs(b) - ledgerSortMs(a);
            if (diff !== 0) return diff;
            return String(b?._id || b?.id || '').localeCompare(String(a?._id || a?.id || ''));
          });
          return {
            items: sortedData,
            total: typeof json?.total === 'number' ? json.total : sortedData.length,
            page: serverPage,
            pageSize,
            totalPages: serverTotalPages > 0 ? serverTotalPages : 1
          };
        },
        staleTime: 0,
      });
    }
  }, [page, totalPages, complianceId, isResolvingToken, pageSize, queryClient]);

  const displayedLedgerItems = isResolvingToken ? [] : ledgerItems;


  
  const derivedName = displayedLedgerItems?.[0]?.filingName || displayedLedgerItems?.[0]?.policy;
  const headerName = complianceNameParam || derivedName;
  const isNamedHistory = Boolean(isFilteredById && headerName);
  const headerTitle = isNamedHistory ? `${headerName} History Log` : "Audit Trail";
  const displayedHeaderName = isNamedHistory ? (truncateText(String(headerName), 45) || String(headerName)) : "";

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

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 bg-gradient-to-br from-indigo-500/90 to-blue-600/90 hover:from-indigo-600/90 hover:to-blue-700/90 text-white hover:text-white focus:text-white active:text-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-md transition-all"
                  >
                    Modify Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto">
                  {columns.map((col) => {
                    const checked = visibleColumnIds.includes(col.id);
                    return (
                      <DropdownMenuItem
                        key={col.id}
                        className="flex items-center gap-3 cursor-pointer"
                        onSelect={(e) => {
                          // keep menu open while toggling
                          e.preventDefault();
                          setVisibleColumnIds((prev) => {
                            const exists = prev.includes(col.id);
                            if (!exists) return [...prev, col.id];
                            if (prev.length <= 1) return prev;
                            return prev.filter((id) => id !== col.id);
                          });
                        }}
                      >
                        <Checkbox checked={checked} />
                        <span className="text-sm text-gray-900">{col.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <Card className="relative shadow-lg border-0 overflow-hidden bg-white/80 backdrop-blur-sm flex-1 min-h-0">
          <CardContent className="p-0 h-full flex flex-col">
            {isFetching && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-100 z-50">
                <div className="h-full bg-blue-600 animate-pulse"></div>
              </div>
            )}
            <Table containerClassName="flex-1 min-h-0 h-full overflow-auto" className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                  {visibleColumns.map((col) => (
                    <TableHead
                      key={col.id}
                      className={`sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide ${
                        col.headerClassName || ""
                      }`}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                  {loading || isResolvingToken ? (
                    <TableRow>
                      <TableCell colSpan={tableColumnCount} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3"></div>
                          <p className="text-gray-600">{isResolvingToken ? 'Opening compliance...' : 'Loading compliance records...'}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : displayedLedgerItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableColumnCount} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <FileText className="w-12 h-12 text-gray-400 mb-3" />
                          <p className="text-lg font-medium text-gray-900">No records found</p>
                          <p className="text-gray-500 mt-1">Check back later</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedLedgerItems.map((item: any, index: number) => {
                      return (
                        <TableRow
                          key={item._id}
                          className={`border-b border-gray-100 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          }`}
                        >
                          {visibleColumns.map((col) => (
                            <TableCell key={col.id} className={col.cellClassName}>
                              {col.renderCell(item)}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
              </TableBody>
            </Table>

            {totalItems > 0 ? (
              <div className="border-t border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-slate-700">
                  <div>
                    {(() => {
                      const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
                      const end = Math.min(page * pageSize, totalItems);
                      return `${start}–${end} of ${totalItems}`;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    <span className="text-xs text-slate-500">Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="bg-transparent border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-sm text-slate-600 hover:bg-slate-100"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    {(() => {
                      const buttons: number[] = [];
                      const maxButtons = 5;
                      let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
                      let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                      
                      if (endPage - startPage < maxButtons - 1) {
                        startPage = Math.max(1, endPage - maxButtons + 1);
                      }
                      
                      for (let i = startPage; i <= endPage; i++) {
                        buttons.push(i);
                      }
                      
                      return buttons.map((p) => (
                        <Button
                          key={p}
                          type="button"
                          variant={p === page ? "default" : "ghost"}
                          className={`h-9 w-9 px-0 text-sm ${
                            p === page 
                              ? "bg-blue-600 text-white hover:bg-blue-700" 
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      ));
                    })()}
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-sm text-slate-600 hover:bg-slate-100"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}