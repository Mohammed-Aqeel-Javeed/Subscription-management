const truncateText = (value: unknown, maxChars: number) => {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 1))}…`;
};
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { calculateSubscriptionStatus, getStatusBadgeClass, getStatusPriority } from "@/lib/subscription-status";
import { Plus, Edit, Trash2, Search, Layers, AlertCircle, Calendar, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import SubscriptionModal from "@/components/modals/subscription-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Subscription } from "@shared/schema";
import { Can } from "@/components/Can";
import { useSidebarSlot } from "@/context/SidebarSlotContext";
import {
  VENDOR_LIST,
} from "@/lib/subscription-template-lists";

// Extend Subscription type locally to include department and _id for frontend use
type SubscriptionWithExtras = Subscription & {
  departments?: string[];
  _id?: string;
  owner?: string | null;
  ownerEmail?: string | null;
};

export default function Subscriptions() {
  const location = useLocation();
  const navigate = useNavigate();
  // ...existing code...
  // Removed duplicate declaration of subscriptions, isLoading, and refetch

  // Check if we should open modal immediately based on URL parameter
  const searchParams = new URLSearchParams(location.search);
  const shouldOpenModal = !!searchParams.get('open') || !!searchParams.get('openToken') || searchParams.get('create') === '1';

  const [modalOpen, setModalOpen] = useState(shouldOpenModal);
  const [editingSubscription, setEditingSubscription] = useState<Partial<SubscriptionWithExtras> | undefined>();
  const [pendingOpenSubscriptionId, setPendingOpenSubscriptionId] = useState<string | null>(null);
  const [openActionsMenuForId, setOpenActionsMenuForId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const initialIsCancelledView = location.pathname.includes('cancelled');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialIsCancelledView ? ["Cancelled"] : []);
  const [selectedBillingCycles, setSelectedBillingCycles] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [selectedReminderPolicies, setSelectedReminderPolicies] = useState<string[]>([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const { setActive: setSidebarSlotActive, setReplaceNav: setSidebarReplaceNav } = useSidebarSlot();
  const [sidebarSlotEl, setSidebarSlotEl] = React.useState<HTMLElement | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  React.useEffect(() => {
    const el = document.getElementById("page-sidebar-slot") as HTMLElement | null;
    setSidebarSlotEl(el);
  }, []);

  React.useEffect(() => {
    setSidebarSlotActive(filtersOpen);
    setSidebarReplaceNav(filtersOpen);

    return () => {
      setSidebarSlotActive(false);
      setSidebarReplaceNav(false);
    };
  }, [filtersOpen, setSidebarSlotActive, setSidebarReplaceNav]);

  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");
  const [startDateFrom, setStartDateFrom] = useState<string>("");
  const [startDateTo, setStartDateTo] = useState<string>("");
  const [nextRenewalFrom, setNextRenewalFrom] = useState<string>("");
  const [nextRenewalTo, setNextRenewalTo] = useState<string>("");

  // When a modal is opened for editing, we temporarily replace the URL with a secure token URL (/s/<token>)
  // so the user can copy/share it. We restore the original URL when the modal closes.
  const modalUrlRestoreRef = React.useRef<string | null>(null);

  const setSecureUrlForSubscriptionEdit = React.useCallback(async (subscriptionId: string) => {
    const id = String(subscriptionId ?? '').trim();
    if (!id) return;

    try {
      // 1) Mint entity deeplink token (encrypted record id)
      const res1 = await fetch('/api/deeplink/token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'subscription', id }),
      });
      if (!res1.ok) return;
      const data1 = (await res1.json().catch(() => ({}))) as { token?: string };
      const openToken = String(data1?.token ?? '').trim();
      if (!openToken) return;

      // 2) Wrap it into a secure-link token to get an OpenAI-style URL (/s/<token>)
      const res2 = await fetch('/api/secure-link/token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/subscriptions',
          query: { openToken },
          ttlMs: 10 * 60 * 1000,
        }),
      });
      if (!res2.ok) return;
      const data2 = (await res2.json().catch(() => ({}))) as { token?: string };
      const secureToken = String(data2?.token ?? '').trim();
      if (!secureToken) return;

      if (!modalUrlRestoreRef.current) {
        modalUrlRestoreRef.current = window.location.pathname + window.location.search;
      }
      // Replace without triggering router navigation (address bar changes, UI stays)
      window.history.replaceState(null, '', `/s/${encodeURIComponent(secureToken)}`);
    } catch {
      // ignore
    }
  }, []);

  const setSecureUrlForSubscriptionCreate = React.useCallback(async () => {
    try {
      const res = await fetch('/api/secure-link/token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/subscriptions',
          query: { create: '1' },
          ttlMs: 10 * 60 * 1000,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as { token?: string };
      const secureToken = String(data?.token ?? '').trim();
      if (!secureToken) return;

      if (!modalUrlRestoreRef.current) {
        modalUrlRestoreRef.current = window.location.pathname + window.location.search;
      }
      window.history.replaceState(null, '', `/s/${encodeURIComponent(secureToken)}`);
    } catch {
      // ignore
    }
  }, []);

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<SubscriptionWithExtras | null>(null);

  // Import confirmation dialog state
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [dataManagementSelectKey, setDataManagementSelectKey] = useState(0);
  const [importErrors, setImportErrors] = useState<{ rowNum: number; errors: string[] }[]>([]);
  const [importErrorsDialogOpen, setImportErrorsDialogOpen] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<"serviceName" | "vendor" | "amount" | "billingCycle" | "nextRenewal" | "status" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  React.useEffect(() => {
    if (location.pathname.includes('cancelled')) {
      setSelectedStatuses(['Cancelled']);
    } else {
      setSelectedStatuses([]);
    }
  }, [location.pathname]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null);

  const [selectedSubscriptionIds, setSelectedSubscriptionIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const { data: subscriptions, isLoading } = useQuery<SubscriptionWithExtras[]>({
    queryKey: ["/api/subscriptions"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: openedSubscription, isLoading: isOpenedSubscriptionLoading } = useQuery<SubscriptionWithExtras | null>({
    queryKey: ["/api/subscriptions", pendingOpenSubscriptionId],
    enabled: !!pendingOpenSubscriptionId,
    queryFn: async () => {
      if (!pendingOpenSubscriptionId) return null;
      const res = await fetch(`/api/subscriptions/${pendingOpenSubscriptionId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Handle URL parameter to open specific subscription modal (placed after subscriptions declaration)
  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const openToken = searchParams.get('openToken');
    const openSubscriptionId = searchParams.get('open');
    const createMode = searchParams.get('create') === '1';

    const resolveToken = async (token: string) => {
      const qs = new URLSearchParams({ token }).toString();
      const res = await fetch(`/api/deeplink/resolve?${qs}`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = (await res.json()) as { id?: string };
      return data?.id ? String(data.id) : null;
    };

    if (!openToken && !openSubscriptionId && !createMode) return;

    if (createMode) {
      // Clear the query param and open modal in create mode.
      navigate(location.pathname, { replace: true, state: location.state });
      setEditingSubscription(undefined);
      setModalOpen(true);
      requestAnimationFrame(() => {
        void setSecureUrlForSubscriptionCreate();
      });
      return;
    }

    // Open immediately (avoid showing the table while data loads)
    setModalOpen(true);

    void (async () => {
      const resolvedId = openToken ? await resolveToken(openToken) : openSubscriptionId;
      if (!resolvedId) {
        // Clear the query param and stop
        navigate(location.pathname, { replace: true, state: location.state });
        return;
      }

      // If we already have it in the list, use it right away.
      const fromList = subscriptions?.find(sub => sub.id === resolvedId || sub._id === resolvedId);
      if (fromList) {
        setPendingOpenSubscriptionId(null);
        setEditingSubscription(fromList);
        navigate(location.pathname, { replace: true, state: location.state });
        requestAnimationFrame(() => {
          void setSecureUrlForSubscriptionEdit(resolvedId);
        });
        return;
      }

      // Otherwise fetch the single subscription by id.
      setEditingSubscription(undefined);
      setPendingOpenSubscriptionId(resolvedId);
      navigate(location.pathname, { replace: true, state: location.state });
    })();
  }, [location.search, subscriptions, navigate, location.pathname, setSecureUrlForSubscriptionEdit, setSecureUrlForSubscriptionCreate]);

  useEffect(() => {
    if (!pendingOpenSubscriptionId) return;
    if (!openedSubscription) return;

    setEditingSubscription(openedSubscription);
    setPendingOpenSubscriptionId(null);
    navigate(location.pathname, { replace: true, state: location.state });
    requestAnimationFrame(() => {
      void setSecureUrlForSubscriptionEdit(pendingOpenSubscriptionId);
    });
  }, [openedSubscription, pendingOpenSubscriptionId, navigate, location.pathname, setSecureUrlForSubscriptionEdit]);

  useEffect(() => {
    if (!modalOpen) return;
    if (!editingSubscription) return;
    if (!subscriptions || subscriptions.length === 0) return;

    const currentId = String(editingSubscription.id ?? editingSubscription._id ?? '');
    if (!currentId) return;
    if ((editingSubscription as any)?.documents !== undefined && (editingSubscription as any)?.documents !== null) return;

    const matched = subscriptions.find(
      (sub) => String(sub.id ?? sub._id ?? '') === currentId && (sub as any)?.documents !== undefined && (sub as any)?.documents !== null
    );
    if (!matched) return;

    setEditingSubscription((prev) => {
      if (!prev) return prev;
      const prevId = String(prev.id ?? prev._id ?? '');
      if (prevId !== currentId) return prev;
      if ((prev as any)?.documents !== undefined && (prev as any)?.documents !== null) return prev;
      return {
        ...prev,
        documents: (matched as any).documents,
      };
    });
  }, [modalOpen, editingSubscription, subscriptions]);
  // Listen for login/logout/account change events and trigger immediate refetch
  React.useEffect(() => {
    function triggerImmediateRefresh() {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"], exact: false });
    }
    // Listen for subscription-renewed event and refetch subscriptions
    function handleSubscriptionRenewed() { triggerImmediateRefresh(); }

    // Add event listeners
    const events = ['account-changed', 'login', 'logout', 'subscription-created', 'subscription-updated', 'subscription-deleted'];
    events.forEach(ev => window.addEventListener(ev, triggerImmediateRefresh));
    window.addEventListener('subscription-renewed', handleSubscriptionRenewed);

    return () => {
      // Remove event listeners
      events.forEach(ev => window.removeEventListener(ev, triggerImmediateRefresh));
      window.removeEventListener('subscription-renewed', handleSubscriptionRenewed);
    };
  }, [queryClient]);
  // Listen for new subscription created from modal
  React.useEffect(() => {
    function handleCreated(e: any) {
      if (e.detail) {
        setEditingSubscription(e.detail);
      }
    }
    window.addEventListener('subscription-created', handleCreated);
    return () => window.removeEventListener('subscription-created', handleCreated);
  }, []);
  // Fetch recent activities
  // (Removed unused recent activities query to improve performance)

  // Watch for tenantId changes and trigger refetch
  // Removed manual polling logic in favor of react-query interval + events

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => apiRequest("DELETE", `/api/subscriptions/${id}`)
      .then(async (res) => {
        // If backend returns a success message, treat as success
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.message && data.message.includes("deleted")) {
            return data;
          }
        }
        // If not ok, throw error to trigger onError
        throw new Error(await res.text());
      }),
    onSuccess: (_data, deletedIdRaw) => {
      const deletedId = String(deletedIdRaw ?? "");
      if (deletedId) {
        queryClient.setQueryData(["/api/subscriptions"], (old: SubscriptionWithExtras[] | undefined) =>
          Array.isArray(old)
            ? old.filter((sub) => String(sub._id ?? sub.id ?? "") !== deletedId)
            : old
        );

        setSelectedSubscriptionIds((prev) => {
          if (!prev.size) return prev;
          const next = new Set(prev);
          next.delete(deletedId);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({
        title: "Success",
        description: "Subscription deleted successfully",
        variant: "destructive",
      });

      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('subscription-deleted', { detail: { id: deletedId } }));
        }
      } catch {
        // ignore
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subscription",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let success = 0;
      let failed = 0;

      for (const id of ids) {
        try {
          const res = await apiRequest("DELETE", `/api/subscriptions/${id}`);
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json().catch(() => null);
          if (data && data.message && String(data.message).toLowerCase().includes("deleted")) {
            success++;
          } else {
            // treat as success if server returned OK, even without message
            success++;
          }
        } catch {
          failed++;
        }
      }

      return { success, failed };
    },
    onSuccess: ({ success, failed }, ids) => {
      const deleted = new Set(ids.map((x) => String(x)));
      queryClient.setQueryData(["/api/subscriptions"], (old: SubscriptionWithExtras[] | undefined) =>
        Array.isArray(old)
          ? old.filter((sub) => !deleted.has(String(sub._id ?? sub.id ?? "")))
          : old
      );
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });

      setSelectedSubscriptionIds(new Set());
      setBulkDeleteConfirmOpen(false);

      if (failed > 0) {
        toast({
          title: "Bulk delete finished with errors",
          description: `Deleted ${success}. Failed ${failed}.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Deleted",
          description: `Deleted ${success} subscription(s).`,
          variant: "destructive",
        });
      }

      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('subscription-deleted', { detail: { ids } }));
        }
      } catch {
        // ignore
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to bulk delete subscriptions",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (subscription: SubscriptionWithExtras) => {
    // Always use id for editing, fallback to _id if present
    const subscriptionId = subscription.id?.toString() || subscription._id?.toString();
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "Invalid subscription ID",
        variant: "destructive",
      });
      return;
    }
    setEditingSubscription({
      ...subscription,
      id: subscriptionId,
      amount: subscription.amount !== undefined ? String(subscription.amount) : "",
      // department: removed, only use departments array
    });
    setModalOpen(true);

    // Set a secure URL in the address bar while the edit modal is open.
    // This makes the URL shareable without exposing internal IDs.
    void setSecureUrlForSubscriptionEdit(subscriptionId);
  };

  const handleCloseModal = () => {
    const returnTo = (location.state as any)?.returnTo;
    if (typeof returnTo === 'string' && returnTo.length > 0) {
      navigate(returnTo, { replace: true });
      return;
    }

    if (modalUrlRestoreRef.current) {
      window.history.replaceState(null, '', modalUrlRestoreRef.current);
      modalUrlRestoreRef.current = null;
    }

    setModalOpen(false);
    setEditingSubscription(undefined);
  };

  const handleDelete = (subscription: SubscriptionWithExtras) => {
    setSubscriptionToDelete(subscription);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (subscriptionToDelete) {
      deleteMutation.mutate(subscriptionToDelete._id || subscriptionToDelete.id);
      setDeleteConfirmOpen(false);
      setSubscriptionToDelete(null);
    }
  };

  const handleAddNew = () => {
    setEditingSubscription(undefined);
    setModalOpen(true);
    void setSecureUrlForSubscriptionCreate();
  };

  const toDdMmYyyy = (val: unknown): string => {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(String(val));
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const downloadSubscriptionsWorkbook = async (options: {
    filename: string;
    seedRows?: Array<{
      serviceName: string;
      qty?: number;
      amount?: number;
      totalAmount?: number;
      taxAmount?: number;
      totalAmountInclTax?: number;
      billingCycle?: string;
      paymentFrequency?: string;
      startDate?: string;
      nextRenewal?: string;
      autoRenewal?: string;
      status?: string;
      department?: string;
      paymentMethod?: string;
      owner?: string;
      ownerEmail?: string;
      reminderPolicy?: string;
      reminderDays?: number;
      notes?: string;
      firstPurchaseDate?: string;
    }>;
    toastTitle: string;
    toastDescription: string;
  }) => {
    const { filename, seedRows = [], toastTitle, toastDescription } = options;
    const workbook = new ExcelJS.Workbook();
    const sheetName = 'Subscriptions';
    const subsSheet = workbook.addWorksheet(sheetName);

    subsSheet.views = [{ state: 'frozen', ySplit: 1 }];
    subsSheet.columns = [
      { header: 'Service Name', key: 'serviceName', width: 20 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Amount per unit', key: 'amount', width: 15 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 },
      { header: 'Tax Amount', key: 'taxAmount', width: 15 },
      { header: 'Total Amount Incl. Tax', key: 'totalAmountInclTax', width: 22 },
      { header: 'Commitment cycle', key: 'billingCycle', width: 18 },
      { header: 'Payment Frequency', key: 'paymentFrequency', width: 18 },
      { header: 'First Purchase Date', key: 'firstPurchaseDate', width: 18 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'Next Renewal', key: 'nextRenewal', width: 15 },
      { header: 'Auto Renewal', key: 'autoRenewal', width: 13 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Payment Method', key: 'paymentMethod', width: 20 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Owner Email', key: 'ownerEmail', width: 25 },
      { header: 'Reminder Policy', key: 'reminderPolicy', width: 18 },
      { header: 'Reminder Days', key: 'reminderDays', width: 15 },
      { header: 'Notes', key: 'notes', width: 35 },
    ];

    // Header styles (match bulk template)
    const headerRow = subsSheet.getRow(1);
    headerRow.height = 20;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    for (let col = 1; col <= 20; col++) {
      const cell = headerRow.getCell(col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    }

    const commitmentCycles = ['Weekly', 'Monthly', 'Quarterly', 'Yearly', '2 Years', '3 Years', 'Trial', 'Pay-as-you-go'];
    const paymentFrequencies = ['Weekly', '28 Days', 'Monthly', 'Quarterly', 'Yearly', '2 Years', '3 Years'];
    const subscriptionStatuses = ['Active', 'Inactive', 'Cancelled'];
    const reminderPolicies = ['One time', 'Two times', 'Until Renewal'];

    for (let i = 2; i <= 500; i++) {
      // Total Amount (D) = Qty (B) * Amount per unit (C)
      const totalAmountCell = subsSheet.getCell(`D${i}`);
      totalAmountCell.value = { formula: `IF(AND(B${i}<>"",C${i}<>""),B${i}*C${i},"")`, result: '' };
      totalAmountCell.numFmt = '0.00';
      totalAmountCell.protection = { locked: true };

      // Tax Amount (E) - Editable, no default 0.00
      const taxAmountCell = subsSheet.getCell(`E${i}`);
      taxAmountCell.numFmt = '0.00';
      taxAmountCell.protection = { locked: false };

      // Total Amount Incl. Tax (F) = Total Amount (D) + Tax Amount (E)
      const totalInclTaxCell = subsSheet.getCell(`F${i}`);
      totalInclTaxCell.value = { formula: `IF(D${i}<>"",D${i}+E${i},"")`, result: '' };
      totalInclTaxCell.numFmt = '0.00';
      totalInclTaxCell.protection = { locked: true };

      const serviceNameCell = subsSheet.getCell(`A${i}`);
      serviceNameCell.dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`COUNTIF($A$2:$A$500,A${i})=1`],
        showInputMessage: true,
        promptTitle: 'Service Name Required',
        prompt: 'Enter a unique service name. Duplicates are not allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Duplicate Service Name',
        error: 'This service name already exists! Please use a unique name.',
      };

      const qtyCell = subsSheet.getCell(`B${i}`);
      qtyCell.dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        allowBlank: false,
        formulae: [1],
        showInputMessage: true,
        promptTitle: 'Quantity',
        prompt: 'Enter the quantity (must be at least 1).',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Quantity',
        error: 'Please enter a whole number >= 1.',
      };

      const amountCell = subsSheet.getCell(`C${i}`);
      amountCell.numFmt = '0.00';
      amountCell.dataValidation = {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        allowBlank: false,
        formulae: [0],
        showInputMessage: true,
        promptTitle: 'Amount Required',
        prompt: 'Enter the subscription amount as a number (e.g., 15.99, 100.00). Must be 0 or greater.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Amount',
        error: 'Please enter a valid number. Decimal values are allowed (e.g., 15.99).',
      };

      const cycleCell = subsSheet.getCell(`G${i}`);
      cycleCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${commitmentCycles.join(',')}"`],
        showInputMessage: true,
        promptTitle: 'Select Commitment Cycle',
        prompt: 'Choose a commitment cycle.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Cycle',
        error: 'Please select a valid commitment cycle.',
      };

      const paymentFreqCell = subsSheet.getCell(`H${i}`);
      paymentFreqCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${paymentFrequencies.join(',')}"`],
        showInputMessage: true,
        promptTitle: 'Select Payment Frequency',
        prompt: 'Choose how often payments are made.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Frequency',
        error: 'Please select a valid payment frequency.',
      };

      const firstPurchaseCell = subsSheet.getCell(`I${i}`);
      firstPurchaseCell.numFmt = '@';
      firstPurchaseCell.dataValidation = {
        type: 'custom',
        allowBlank: true,
        formulae: [`OR(I${i}="",IFERROR(DATEVALUE(I${i}),I${i})<=TODAY())`],
        showInputMessage: true,
        promptTitle: 'First Purchase Date',
        prompt: 'Must not be in the future.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Date',
        error: 'First Purchase Date cannot be in the future.',
      };

      const startDateCell = subsSheet.getCell(`J${i}`);
      startDateCell.numFmt = '@';
      startDateCell.dataValidation = {
        type: 'custom',
        allowBlank: true,
        formulae: [
          `OR(J${i}="",I${i}="",IFERROR(DATEVALUE(J${i}),J${i})>=IFERROR(DATEVALUE(I${i}),I${i}))`,
        ],
        showInputMessage: true,
        promptTitle: 'Current Cycle Start',
        prompt: 'Must be on or after First Purchase Date.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Date',
        error: 'Current Cycle Start must be on or after First Purchase Date.',
      };

      const freqFormula = `IF(H${i}<>"",H${i},G${i})`;
      const renewalCell = subsSheet.getCell(`K${i}`);
      renewalCell.value = {
        formula: `IF(AND(J${i}<>"",OR(G${i}<>"",H${i}<>"")),TEXT(IF(${freqFormula}="Weekly",J${i}+6,IF(${freqFormula}="28 Days",J${i}+27,IF(${freqFormula}="Monthly",DATE(YEAR(J${i}),MONTH(J${i})+1,DAY(J${i}))-1,IF(${freqFormula}="Quarterly",DATE(YEAR(J${i}),MONTH(J${i})+3,DAY(J${i}))-1,IF(${freqFormula}="Yearly",DATE(YEAR(J${i})+1,MONTH(J${i}),DAY(J${i}))-1,IF(${freqFormula}="2 Years",DATE(YEAR(J${i})+2,MONTH(J${i}),DAY(J${i}))-1,IF(${freqFormula}="3 Years",DATE(YEAR(J${i})+3,MONTH(J${i}),DAY(J${i}))-1,IF(${freqFormula}="Trial",J${i}+30,IF(${freqFormula}="Pay-as-you-go",DATE(YEAR(J${i}),MONTH(J${i})+1,DAY(J${i})),""))))))))),"dd/mm/yyyy"),"")`,
        result: '',
      };
      renewalCell.numFmt = '@';
      renewalCell.protection = { locked: true };

      const autoRenewalCell = subsSheet.getCell(`L${i}`);
      autoRenewalCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Yes,No"'],
        showInputMessage: true,
        promptTitle: 'Auto Renewal',
        prompt: 'Select Yes to enable automatic renewal, No to disable.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Value',
        error: 'Please select Yes or No.',
      };

      const statusCell = subsSheet.getCell(`M${i}`);
      statusCell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${subscriptionStatuses.join(',')}"`],
        showInputMessage: true,
        promptTitle: 'Select Status',
        prompt: 'Choose subscription status from the dropdown.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Status',
        error: 'Please select a valid status.',
      };

      const reminderPolicyCell = subsSheet.getCell(`R${i}`);
      reminderPolicyCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${reminderPolicies.join(',')}"`],
        showInputMessage: true,
        promptTitle: 'Select Reminder Policy',
        prompt: 'Choose reminder policy: One time, Two times, or Until Renewal.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Reminder Policy',
        error: 'Please select a valid reminder policy from the dropdown.',
      };

      const reminderDaysCell = subsSheet.getCell(`S${i}`);
      reminderDaysCell.dataValidation = {
        type: 'whole',
        operator: 'between',
        allowBlank: true,
        formulae: [1, 365],
        showInputMessage: true,
        promptTitle: 'Reminder Days',
        prompt: 'Enter the number of days before renewal to send a reminder (1-365).',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Reminder Days',
        error: 'Please enter a whole number between 1 and 365.',
      };
    }

    // Unlock editable cells (lock computed columns: Total Amount (D), Total Amount Incl. Tax (F), Next Renewal (K), and Owner Email (Q))
    for (let i = 2; i <= 500; i++) {
      const editableColumns = ['A', 'B', 'C', 'E', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T'];
      editableColumns.forEach((col) => {
        subsSheet.getCell(`${col}${i}`).protection = { locked: false };
      });
    }

    // Seed exported rows (keep formulas but provide cached result values for D/F/K so imports work without opening Excel)
    for (let idx = 0; idx < seedRows.length && idx < 499; idx++) {
      const r = seedRows[idx];
      const rowNum = idx + 2;

      subsSheet.getCell(`A${rowNum}`).value = r.serviceName || '';
      subsSheet.getCell(`B${rowNum}`).value = Number.isFinite(r.qty as any) ? Number(r.qty) : 1;
      subsSheet.getCell(`C${rowNum}`).value = Number.isFinite(r.amount as any) ? Number(r.amount) : 0;
      subsSheet.getCell(`G${rowNum}`).value = r.billingCycle || '';
      subsSheet.getCell(`H${rowNum}`).value = r.paymentFrequency || '';
      subsSheet.getCell(`I${rowNum}`).value = r.firstPurchaseDate || '';
      subsSheet.getCell(`J${rowNum}`).value = r.startDate || '';
      subsSheet.getCell(`L${rowNum}`).value = r.autoRenewal || '';
      subsSheet.getCell(`M${rowNum}`).value = r.status || '';
      subsSheet.getCell(`N${rowNum}`).value = r.department || '';
      subsSheet.getCell(`O${rowNum}`).value = r.paymentMethod || '';
      subsSheet.getCell(`P${rowNum}`).value = r.owner || '';
      subsSheet.getCell(`Q${rowNum}`).value = r.ownerEmail || '';
      subsSheet.getCell(`R${rowNum}`).value = r.reminderPolicy || '';
      subsSheet.getCell(`S${rowNum}`).value = Number.isFinite(r.reminderDays as any) ? Number(r.reminderDays) : '';
      subsSheet.getCell(`T${rowNum}`).value = r.notes || '';

      const qtyVal = Number(subsSheet.getCell(`B${rowNum}`).value || 0);
      const amtVal = Number(subsSheet.getCell(`C${rowNum}`).value || 0);
      const computedTotal = qtyVal * amtVal;

      const totalAmountCell = subsSheet.getCell(`D${rowNum}`);
      totalAmountCell.value = { formula: `IF(AND(B${rowNum}<>"",C${rowNum}<>""),B${rowNum}*C${rowNum},"")`, result: computedTotal };

      const taxAmountCell = subsSheet.getCell(`E${rowNum}`);
      const taxVal = Number(r.taxAmount) || 0;
      taxAmountCell.value = taxVal || '';

      const totalInclCell = subsSheet.getCell(`F${rowNum}`);
      totalInclCell.value = { formula: `IF(D${rowNum}<>"",D${rowNum}+E${rowNum},"")`, result: computedTotal + taxVal };

      const freqFormulaExport = `IF(H${rowNum}<>"",H${rowNum},G${rowNum})`;
      const renewalCell = subsSheet.getCell(`K${rowNum}`);
      const renewalResult = r.nextRenewal || '';
      renewalCell.value = {
        formula: `IF(AND(J${rowNum}<>"",OR(G${rowNum}<>"",H${rowNum}<>"")),TEXT(IF(${freqFormulaExport}="Weekly",J${rowNum}+6,IF(${freqFormulaExport}="28 Days",J${rowNum}+27,IF(${freqFormulaExport}="Monthly",DATE(YEAR(J${rowNum}),MONTH(J${rowNum})+1,DAY(J${rowNum}))-1,IF(${freqFormulaExport}="Quarterly",DATE(YEAR(J${rowNum}),MONTH(J${rowNum})+3,DAY(J${rowNum}))-1,IF(${freqFormulaExport}="Yearly",DATE(YEAR(J${rowNum})+1,MONTH(J${rowNum}),DAY(J${rowNum}))-1,IF(${freqFormulaExport}="2 Years",DATE(YEAR(J${rowNum})+2,MONTH(J${rowNum}),DAY(J${rowNum}))-1,IF(${freqFormulaExport}="3 Years",DATE(YEAR(J${rowNum})+3,MONTH(J${rowNum}),DAY(J${rowNum}))-1,IF(${freqFormulaExport}="Trial",J${rowNum}+30,IF(${freqFormulaExport}="Pay-as-you-go",DATE(YEAR(J${rowNum}),MONTH(J${rowNum})+1,DAY(J${rowNum})),""))))))))),"dd/mm/yyyy"),"")`,
        result: renewalResult,
      };
    }

    await subsSheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertRows: false,
      insertColumns: false,
      deleteRows: false,
      deleteColumns: false,
      sort: false,
      autoFilter: false,
      insertHyperlinks: false,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), filename);
    toast({ title: toastTitle, description: toastDescription, variant: 'success' });
  };

  // EXPORT current (filtered) subscriptions to XLSX (same template structure)
  const handleExport = async () => {
    if (!filteredSubscriptions.length) {
      toast({ title: 'No data', description: 'There are no subscriptions to export', variant: 'destructive' });
      return;
    }

    const seedRows = filteredSubscriptions.map((sub) => {
      const statusRaw = String((sub as any)?.status ?? '').trim();
      const isDraftStatus = statusRaw.toLowerCase() === 'draft';
      const qty = Number((sub as any)?.qty ?? 1);
      const amount = Number((sub as any)?.amount ?? 0);
      const totalAmount = Number((sub as any)?.totalAmount ?? qty * amount);

      const firstPurchaseRaw = (sub as any)?.firstPurchaseDate ?? (sub as any)?.initialDate;
      return {
        serviceName: String((sub as any)?.serviceName ?? '').trim(),
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        amount: Number.isFinite(amount) ? amount : 0,
        totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
        taxAmount: Number((sub as any)?.taxAmount) || 0,
        totalAmountInclTax: Number((sub as any)?.totalAmountInclTax) || 0,
        billingCycle: String((sub as any)?.billingCycle ?? ''),
        paymentFrequency: String((sub as any)?.paymentFrequency ?? ''),
        startDate: toDdMmYyyy((sub as any)?.startDate),
        nextRenewal: toDdMmYyyy((sub as any)?.nextRenewal),
        autoRenewal: (sub as any)?.autoRenewal === true ? 'Yes' : (sub as any)?.autoRenewal === false ? 'No' : '',
        status: isDraftStatus ? '' : statusRaw,
        department: (sub as any)?.departments?.join('|') || (sub as any)?.department || '',
        paymentMethod: String((sub as any)?.paymentMethod ?? ''),
        owner: String((sub as any)?.owner ?? ''),
        ownerEmail: String((sub as any)?.ownerEmail ?? ''),
        reminderPolicy: String((sub as any)?.reminderPolicy ?? ''),
        reminderDays: Number((sub as any)?.reminderDays ?? ''),
        notes: String((sub as any)?.notes ?? ''),
        firstPurchaseDate: toDdMmYyyy(firstPurchaseRaw),
      };
    }).filter(r => r.serviceName);

    if (!seedRows.length) {
      toast({ title: 'No data', description: 'There are no subscriptions to export', variant: 'destructive' });
      return;
    }

    try {
      await downloadSubscriptionsWorkbook({
        filename: `Subscriptions_Export_${new Date().toISOString().slice(0, 10)}.xlsx`,
        seedRows,
        toastTitle: 'Exported',
        toastDescription: 'Subscriptions exported (template format)',
      });
    } catch {
      toast({
        title: 'Export error',
        description: 'Failed to export subscriptions. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const downloadSubscriptionsImportTemplate = async () => {
    try {
      await downloadSubscriptionsWorkbook({
        filename: 'Subscriptions_Import_Template.xlsx',
        seedRows: [],
        toastTitle: 'Template Downloaded',
        toastDescription: 'Subscriptions template downloaded (single sheet)',
      });
    } catch {
      toast({
        title: 'Template error',
        description: 'Failed to generate template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const triggerImport = () => fileInputRef.current?.click();

  // IMPORT from CSV/XLSX -> create subscriptions
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress({ processed: 0, total: 0 });

    const normalizeServiceName = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
    const existingServiceNames = new Set(
      (Array.isArray(subscriptions) ? subscriptions : [])
        .map((s) => normalizeServiceName((s as any)?.serviceName))
        .filter(Boolean)
        .map((s) => s.toLowerCase())
    );

    const getValue = (row: Record<string, any>, keys: string[]) => {
      for (const key of keys) {
        const val = row?.[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') return val;
      }
      return '';
    };

    const parseNumber = (val: unknown): number => {
      if (val === null || val === undefined) return 0;
      const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    const toIsoDate = (val: unknown): string => {
      if (!val) return '';
      if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().split('T')[0];
      const s = String(val).trim();
      if (!s) return '';

      // yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

      // dd/mm/yyyy or dd-mm-yyyy
      const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        return `${yyyy}-${mm}-${dd}`;
      }

      const d = new Date(s);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    };

    const parseDepartments = (val: unknown): string[] => {
      const raw = String(val ?? '').trim();
      if (!raw) return [];
      return raw
        .split('|')
        .map((d) => d.trim())
        .filter(Boolean);
    };

    const normalizeYesNoToBool = (val: unknown): boolean | undefined => {
      const s = String(val ?? '').trim().toLowerCase();
      if (!s) return undefined;
      if (s === 'yes' || s === 'true' || s === '1') return true;
      if (s === 'no' || s === 'false' || s === '0') return false;
      return undefined;
    };

    const fetchMasterData = async () => {
      try {
        const [deptRes, payRes, empRes] = await Promise.all([
          fetch('/api/company/departments', { credentials: 'include' }),
          fetch('/api/payment', { credentials: 'include' }),
          fetch('/api/employees', { credentials: 'include' })
        ]);
        const depts = deptRes.ok ? await deptRes.json() : [];
        const pays = payRes.ok ? await payRes.json() : [];
        const emps = empRes.ok ? await empRes.json() : [];
        return {
          departments: depts.map((d: any) => String(d.name || '').trim().toLowerCase()),
          paymentMethods: pays.map((p: any) => String(p.name || p.title || '').trim().toLowerCase()),
          employees: emps.map((e: any) => String(e.name || '').trim().toLowerCase()),
          employeesMap: emps.reduce((acc: Record<string, string>, e: any) => {
            if (e.name) acc[e.name.trim().toLowerCase()] = e.email;
            return acc;
          }, {})
        };
      } catch (err) {
        console.error('Failed to fetch master data:', err);
        return { departments: [], paymentMethods: [], employees: [], employeesMap: {} };
      }
    };

    const processRows = async (rows: any[]) => {
      if (!rows.length) {
        toast({ title: 'Empty file', description: 'No rows found in file', variant: 'destructive' });
        return;
      }

      const isEffectivelyEmptyRow = (row: Record<string, any>): boolean => {
        const candidates: unknown[] = [
          getValue(row, ['Service Name', 'ServiceName', 'serviceName']),
          getValue(row, ['Qty', 'QTY', 'qty']),
          getValue(row, ['Amount per unit', 'Amount Per Unit', 'Amount', 'amount']),
          getValue(row, ['Total Amount', 'TotalAmount', 'totalAmount']),
          getValue(row, ['Commitment cycle', 'Commitment Cycle', 'BillingCycle', 'billingCycle']),
          getValue(row, ['Payment Frequency', 'paymentFrequency', 'PaymentFrequency']),
          getValue(row, ['First Purchase Date', 'FirstPurchaseDate', 'firstPurchaseDate']),
          getValue(row, ['Start Date', 'StartDate', 'startDate']),
          getValue(row, ['Next Renewal', 'NextRenewal', 'nextRenewal']),
          getValue(row, ['Auto Renewal', 'AutoRenewal', 'autoRenewal']),
          getValue(row, ['Status', 'status']),
          getValue(row, ['Department', 'department', 'Departments', 'departments']),
          getValue(row, ['Payment Method', 'paymentMethod', 'PaymentMethod']),
          getValue(row, ['Owner', 'owner']),
          getValue(row, ['Reminder Policy', 'ReminderPolicy', 'reminderPolicy']),
          getValue(row, ['Reminder Days', 'ReminderDays', 'reminderDays']),
          getValue(row, ['Notes', 'notes']),
        ];

        return candidates.every((v) => String(v ?? '').trim() === '');
      };

      const processableRows = rows.filter((row) => !isEffectivelyEmptyRow(row as any));
      if (!processableRows.length) {
        toast({ title: 'Empty file', description: 'No filled rows found in file', variant: 'destructive' });
        return;
      }

      setImportProgress({ processed: 0, total: processableRows.length });

      const masterData = await fetchMasterData();
      let success = 0;
      let failed = 0;
      const seenInFile = new Set<string>();
      const validationFailures: { rowNum: number; errors: string[] }[] = [];

      let processed = 0;
      for (let idx = 0; idx < processableRows.length; idx++) {
        const row = processableRows[idx];
        const rowNum = idx + 2; // header is row 1
        try {
          const normalizedName = normalizeServiceName(
            getValue(row, ['Service Name', 'ServiceName', 'serviceName'])
          );
          const key = normalizedName.toLowerCase();

          const rowErrors: string[] = [];

          if (!normalizedName) {
            rowErrors.push('Missing Service Name');
          } else {
            if (existingServiceNames.has(key)) {
              rowErrors.push(`Duplicate service name already exists: "${normalizedName}"`);
            }
            if (seenInFile.has(key)) {
              rowErrors.push(`Duplicate service name in file: "${normalizedName}"`);
            }
          }

          const rawDept = getValue(row, ['Department', 'department', 'Departments', 'departments']);
          const rawPaymentMethod = getValue(row, ['Payment Method', 'paymentMethod', 'PaymentMethod']);
          const rawOwner = getValue(row, ['Owner', 'owner']);

          if (rawDept) {
            const rawDeptsArray = rawDept.split('|').map((d: string) => d.trim()).filter(Boolean);
            for (const d of rawDeptsArray) {
              if (!masterData.departments.includes(d.toLowerCase())) {
                rowErrors.push(`Department "${d}" does not exist.`);
              }
            }
          }

          if (rawPaymentMethod) {
            if (!masterData.paymentMethods.includes(rawPaymentMethod.trim().toLowerCase())) {
              rowErrors.push(`Payment Method "${rawPaymentMethod}" does not exist.`);
            }
          }

          if (rawOwner) {
            if (!masterData.employees.includes(rawOwner.trim().toLowerCase())) {
              rowErrors.push(`Assigned Owner "${rawOwner}" does not exist.`);
            }
          }

          if (rowErrors.length > 0) {
            failed++;
            validationFailures.push({ rowNum, errors: rowErrors });
            continue;
          }

          const qty = Math.max(1, Math.floor(parseNumber(getValue(row, ['Qty', 'QTY', 'qty'])) || 1));
          const amountPerUnit = parseNumber(getValue(row, ['Amount per unit', 'Amount Per Unit', 'Amount', 'amount']));
          const totalAmount = qty * amountPerUnit;
          const taxAmount = parseNumber(getValue(row, ['Tax Amount', 'TaxAmount', 'taxAmount']));
          const totalAmountInclTax = totalAmount + taxAmount;

          const firstPurchaseDate = toIsoDate(
            getValue(row, ['First Purchase Date', 'FirstPurchaseDate', 'firstPurchaseDate'])
          );
          const startDateFromFile = toIsoDate(getValue(row, ['Start Date', 'StartDate', 'startDate']));
          const effectiveStartDate = startDateFromFile || firstPurchaseDate || new Date().toISOString().split('T')[0];

          const billingCycleRaw = getValue(row, ['Commitment cycle', 'BillingCycle', 'billingCycle', 'Commitment Cycle']) || 'monthly';
          const billingCycle = String(billingCycleRaw).trim().toLowerCase();
          const paymentFrequencyRaw = getValue(row, ['Payment Frequency', 'paymentFrequency', 'PaymentFrequency']);
          const paymentFrequency = paymentFrequencyRaw ? String(paymentFrequencyRaw).trim().toLowerCase() : '';

          const calculateEndDateLocal = (startDateStr: string, cycleStr: string): string => {
            if (!startDateStr || !cycleStr) return "";
            const token = cycleStr.trim().toLowerCase();
            const date = new Date(startDateStr + 'T00:00:00');
            if (isNaN(date.getTime())) return "";
            const endDate = new Date(date);

            const dayMatch = token.match(/^(\d+)\s*days?$/);
            if (dayMatch) {
              const days = Math.max(1, parseInt(dayMatch[1], 10));
              endDate.setDate(endDate.getDate() + (days - 1));
            } else {
              switch (token) {
                case "pay-as-you-go":
                  endDate.setMonth(endDate.getMonth() + 1);
                  break;
                case "monthly":
                  endDate.setMonth(endDate.getMonth() + 1);
                  endDate.setDate(endDate.getDate() - 1);
                  break;
                case "quarterly":
                  endDate.setMonth(endDate.getMonth() + 3);
                  endDate.setDate(endDate.getDate() - 1);
                  break;
                case "yearly":
                  endDate.setFullYear(endDate.getFullYear() + 1);
                  endDate.setDate(endDate.getDate() - 1);
                  break;
                case "2 years":
                  endDate.setFullYear(endDate.getFullYear() + 2);
                  endDate.setDate(endDate.getDate() - 1);
                  break;
                case "3 years":
                  endDate.setFullYear(endDate.getFullYear() + 3);
                  endDate.setDate(endDate.getDate() - 1);
                  break;
                case "weekly":
                  endDate.setDate(endDate.getDate() + 6);
                  break;
                case "trial":
                  endDate.setDate(endDate.getDate() + 30);
                  break;
              }
            }
            const yyyy = endDate.getFullYear();
            const mm = String(endDate.getMonth() + 1).padStart(2, '0');
            const dd = String(endDate.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          };

          const calculatedNextRenewal = toIsoDate(getValue(row, ['Next Renewal', 'NextRenewal', 'nextRenewal'])) ||
            calculateEndDateLocal(effectiveStartDate, paymentFrequency) ||
            calculateEndDateLocal(effectiveStartDate, billingCycle) ||
            effectiveStartDate;

          const departmentsArray = rawDept ? rawDept.split('|').map((d: string) => d.trim()).filter(Boolean) : [];

          const payload: any = {
            serviceName: normalizedName,
            qty,
            amount: amountPerUnit,
            totalAmount,
            taxAmount,
            totalAmountInclTax,
            billingCycle: billingCycle || 'monthly',
            paymentFrequency: paymentFrequency || undefined,
            paymentMethod: rawPaymentMethod || undefined,
            startDate: effectiveStartDate,
            firstPurchaseDate: firstPurchaseDate || undefined,
            initialDate: firstPurchaseDate || undefined,
            currentCycleStart: effectiveStartDate,
            nextRenewal: calculatedNextRenewal,
            autoRenewal: normalizeYesNoToBool(getValue(row, ['Auto Renewal', 'AutoRenewal', 'autoRenewal'])),
            status: getValue(row, ['Status', 'status']) || 'Draft',
            category: getValue(row, ['Category', 'category']),
            departments: departmentsArray,
            owner: rawOwner || undefined,
            ownerEmail: rawOwner ? masterData.employeesMap[rawOwner.trim().toLowerCase()] || '' : '',
            reminderPolicy: getValue(row, ['Reminder Policy', 'ReminderPolicy', 'reminderPolicy']) || 'One time',
            reminderDays: Math.max(1, Math.floor(parseNumber(getValue(row, ['Reminder Days', 'ReminderDays', 'reminderDays'])) || 7)),
            notes: getValue(row, ['Notes', 'notes']),
          };

          await apiRequest('POST', '/api/subscriptions', payload);
          seenInFile.add(key);
          existingServiceNames.add(key);
          success++;
        } catch {
          failed++;
          validationFailures.push({ rowNum, errors: ['Failed to import this row due to system error.'] });
        } finally {
          processed++;
          setImportProgress((prev) => (prev ? { ...prev, processed } : { processed, total: processableRows.length }));
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });

      if (validationFailures.length > 0) {
        setImportErrors(validationFailures);
        setImportErrorsDialogOpen(true);
        toast({
          title: 'Import finished with errors',
          description: `Imported ${success} row(s). Failed: ${failed}. Check validation report.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Import finished',
          description: `Imported ${success} row(s). Failed: ${failed}`,
          variant: 'success',
        });
      }
    };

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames.includes('Subscriptions') ? 'Subscriptions' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false });
        await processRows(rows as any[]);
      } catch {
        toast({ title: 'Import error', description: 'Failed to read XLSX file', variant: 'destructive' });
      } finally {
        setIsImporting(false);
        setImportProgress(null);
        e.target.value = '';
      }
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows: any[] = results.data as any[];
          await processRows(rows);
        } finally {
          setIsImporting(false);
          setImportProgress(null);
          e.target.value = '';
        }
      },
      error: () => {
        toast({ title: 'Import error', description: 'Failed to parse file', variant: 'destructive' });
        setIsImporting(false);
        setImportProgress(null);
        e.target.value = '';
      },
    });
  };

  const parseDate = (val: unknown): Date | null => {
    if (!val) return null;
    const d = val instanceof Date ? val : new Date(String(val));
    return isNaN(d.getTime()) ? null : d;
  };

  const endOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const filteredSubscriptions = Array.isArray(subscriptions) ? subscriptions.filter(sub => {
    const q = searchTerm.trim().toLowerCase();
    const ownerVal = String((sub as any)?.owner || (sub as any)?.ownerEmail || '').trim();
    // Calculate the dynamic status based on expiry date and reminder days
    const calculatedStatus = calculateSubscriptionStatus(
      (sub as any).nextRenewal,
      (sub as any).reminderDays,
      sub.status
    );

    const effectiveStatus = (String(sub.billingCycle || '').toLowerCase() === 'trial')
      ? 'Trial'
      : calculatedStatus; // Use calculated status instead of raw status

    const matchesSearch = !q ||
      (sub.serviceName || '').toLowerCase().includes(q) ||
      (sub.vendor || '').toLowerCase().includes(q);

    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(String(sub.category || ''));
    const matchesVendor = selectedVendors.length === 0 || selectedVendors.includes(String(sub.vendor || ''));
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(effectiveStatus);
    const matchesBilling = selectedBillingCycles.length === 0 || selectedBillingCycles.includes(String(sub.billingCycle || ''));
    const matchesDepartment = selectedDepartments.length === 0 || selectedDepartments.some(d => (sub.departments || []).includes(d));
    const matchesOwner = selectedOwners.length === 0 || selectedOwners.includes(ownerVal);
    const matchesPaymentMethod = selectedPaymentMethods.length === 0 || selectedPaymentMethods.includes(String((sub as any)?.paymentMethod || ''));
    const matchesReminderPolicy = selectedReminderPolicies.length === 0 || selectedReminderPolicies.includes(String((sub as any)?.reminderPolicy || ''));

    const amountVal = parseFloat(String(sub.amount)) || 0;
    const min = amountMin.trim() ? parseFloat(amountMin) : null;
    const max = amountMax.trim() ? parseFloat(amountMax) : null;
    const matchesAmount = (min === null || amountVal >= min) && (max === null || amountVal <= max);

    const startVal = parseDate((sub as any)?.startDate);
    const startFromVal = startDateFrom ? parseDate(startDateFrom) : null;
    const startToVal = startDateTo ? endOfDay(parseDate(startDateTo) || new Date('invalid')) : null;
    const matchesStartDate = (!startFromVal || (startVal && startVal >= startFromVal)) && (!startToVal || (startVal && startVal <= startToVal));

    const renewVal = parseDate((sub as any)?.nextRenewal);
    const renewFromVal = nextRenewalFrom ? parseDate(nextRenewalFrom) : null;
    const renewToVal = nextRenewalTo ? endOfDay(parseDate(nextRenewalTo) || new Date('invalid')) : null;
    const matchesNextRenewal = (!renewFromVal || (renewVal && renewVal >= renewFromVal)) && (!renewToVal || (renewVal && renewVal <= renewToVal));

    // If date filters are active but the record has invalid date, exclude it.
    const startDateFiltersActive = !!startFromVal || !!startToVal;
    const nextRenewalFiltersActive = !!renewFromVal || !!renewToVal;
    if (startDateFiltersActive && !startVal) return false;
    if (nextRenewalFiltersActive && !renewVal) return false;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesVendor &&
      matchesStatus &&
      matchesBilling &&
      matchesDepartment &&
      matchesOwner &&
      matchesPaymentMethod &&
      matchesReminderPolicy &&
      matchesAmount &&
      matchesStartDate &&
      matchesNextRenewal
    );
  }).sort((a, b) => {
    // Apply sorting if a field is selected
    if (!sortField) {
      // Default: Sort by status priority (Active → Expiring Soon → Expired → Cancelled → Draft), then by amount
      const aStatus = calculateSubscriptionStatus(a.nextRenewal, a.reminderDays, a.status);
      const bStatus = calculateSubscriptionStatus(b.nextRenewal, b.reminderDays, b.status);

      const aPriority = getStatusPriority(aStatus);
      const bPriority = getStatusPriority(bStatus);

      // First sort by status priority
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Within the same status, sort by highest amount first
      const parseAmount = (sub: any) => {
        const raw = sub?.lcyAmount ?? sub?.totalAmount ?? sub?.amount;
        if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
        const s = String(raw ?? '').replace(/,/g, '').trim();
        const n = s ? Number(s) : 0;
        return Number.isFinite(n) ? n : 0;
      };

      const aAmt = parseAmount(a);
      const bAmt = parseAmount(b);
      if (bAmt !== aAmt) return bAmt - aAmt;

      // Tie-breaker: latest saved first
      const aTime = new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime();
      const bTime = new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime();
      return bTime - aTime;
    }

    if (sortField === "serviceName") {
      const aVal = (a.serviceName || "").toLowerCase();
      const bVal = (b.serviceName || "").toLowerCase();
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (sortField === "vendor") {
      const aVal = (a.vendor || "").toLowerCase();
      const bVal = (b.vendor || "").toLowerCase();
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (sortField === "amount") {
      const aVal = parseFloat(String((a as any)?.lcyAmount ?? a.amount)) || 0;
      const bVal = parseFloat(String((b as any)?.lcyAmount ?? b.amount)) || 0;
      return sortDirection === "asc"
        ? aVal - bVal
        : bVal - aVal;
    }

    if (sortField === "billingCycle") {
      const aVal = (a.billingCycle || "").toLowerCase();
      const bVal = (b.billingCycle || "").toLowerCase();
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (sortField === "nextRenewal") {
      const aVal = new Date(a.nextRenewal || 0).getTime();
      const bVal = new Date(b.nextRenewal || 0).getTime();
      return sortDirection === "asc"
        ? aVal - bVal
        : bVal - aVal;
    }

    if (sortField === "status") {
      const aStatus = calculateSubscriptionStatus(a.nextRenewal, a.reminderDays, a.status);
      const bStatus = calculateSubscriptionStatus(b.nextRenewal, b.reminderDays, b.status);
      const aPriority = getStatusPriority(aStatus);
      const bPriority = getStatusPriority(bStatus);
      return sortDirection === "asc"
        ? aPriority - bPriority
        : bPriority - aPriority;
    }

    return 0;
  }) : [];

  // Pagination calculations
  const totalFiltered = filteredSubscriptions.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategories, selectedVendors, selectedStatuses, selectedBillingCycles, selectedDepartments, selectedOwners, selectedPaymentMethods, selectedReminderPolicies]);

  const visibleSubscriptionIds = React.useMemo(() => {
    return (Array.isArray(filteredSubscriptions) ? filteredSubscriptions : [])
      .map((s) => String((s as any)?._id ?? (s as any)?.id ?? '').trim())
      .filter(Boolean);
  }, [filteredSubscriptions]);

  const selectedVisibleCount = React.useMemo(() => {
    if (!visibleSubscriptionIds.length || !selectedSubscriptionIds.size) return 0;
    let count = 0;
    for (const id of visibleSubscriptionIds) {
      if (selectedSubscriptionIds.has(id)) count++;
    }
    return count;
  }, [visibleSubscriptionIds, selectedSubscriptionIds]);

  const allVisibleSelected = visibleSubscriptionIds.length > 0 && selectedVisibleCount === visibleSubscriptionIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleSubscriptionIds.length;

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedSubscriptionIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleSubscriptionIds.forEach((id) => next.add(id));
      } else {
        visibleSubscriptionIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedSubscriptionIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Category badge sizing: use the longest category label (clamped) so all category badges are the same width.
  // Use `width` (not `minWidth`) so it can shrink to fit the column and won't get clipped.
  const categoryBadgeWidthCh = (() => {
    let maxLen = 0;
    for (const sub of filteredSubscriptions) {
      const val = String((sub as any)?.category ?? "").trim();
      if (val.length > maxLen) maxLen = val.length;
    }

    // Clamp so badges don't get too tiny or too wide.
    return Math.min(Math.max(maxLen, 6), 28);
  })();

  // Status pill sizing: use the longest displayed status label so all status pills are the same width.
  const statusPillWidthCh = (() => {
    let maxLen = 0;
    for (const sub of (Array.isArray(subscriptions) ? subscriptions : [])) {
      const isTrial = String(sub.billingCycle || '').toLowerCase() === 'trial' || sub.billingCycle === 'Trial';
      const calculatedStatus = calculateSubscriptionStatus(
        sub.nextRenewal,
        sub.reminderDays,
        sub.status
      );
      const label = isTrial ? 'Trial' : calculatedStatus;
      if (label.length > maxLen) maxLen = label.length;
    }

    // Clamp so it stays clean even if a custom status is long.
    return Math.min(Math.max(maxLen, 8), 18);
  })();

  // Toggle sort function
  const handleSort = (field: "serviceName" | "vendor" | "amount" | "billingCycle" | "nextRenewal" | "status") => {
    if (sortField === field) {
      // Toggle direction or clear sort
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get sort icon
  const getSortIcon = (field: "serviceName" | "vendor" | "amount" | "billingCycle" | "nextRenewal" | "status") => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline-block opacity-40" />;
    }
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline-block" />
      : <ArrowDown className="h-3 w-3 ml-1 inline-block" />;
  };

  const uniqueCategories = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => String(sub.category || '')).filter(Boolean) : [])).sort();
  const uniqueVendors = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => String(sub.vendor || '')).filter(Boolean) : [])).sort();
  const uniqueBillingCycles = Array.from(new Set(Array.isArray(subscriptions) ? subscriptions.map(sub => String(sub.billingCycle || '')).filter(Boolean) : [])).sort();
  const uniqueDepartments = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions.flatMap(sub => (sub.departments || []).map(d => String(d || '')).filter(Boolean))
      : []
  )).sort((a, b) => (a === 'Company Level' ? -1 : b === 'Company Level' ? 1 : a.localeCompare(b)));
  const uniqueOwners = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions
        .map(sub => String((sub as any)?.owner || (sub as any)?.ownerEmail || '').trim())
        .filter(Boolean)
      : []
  )).sort();
  const uniquePaymentMethods = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions.map(sub => String((sub as any)?.paymentMethod || '').trim()).filter(Boolean)
      : []
  )).sort();
  const uniqueReminderPolicies = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions.map(sub => String((sub as any)?.reminderPolicy || '').trim()).filter(Boolean)
      : []
  )).sort();

  const uniqueStatuses = Array.from(new Set(
    Array.isArray(subscriptions)
      ? subscriptions
        .map(sub => (String(sub.billingCycle || '').toLowerCase() === 'trial') ? 'Trial' : String(sub.status || '').trim())
        .filter(Boolean)
      : []
  )).sort();

  // Category color helper removed (unused)

  // Helper to display department(s) from JSON string or array

  // Helper to format date as dd/mm/yyyy
  const formatDate = (dateVal?: string | Date) => {
    if (!dateVal) return "";
    let d: Date;
    if (typeof dateVal === "string") {
      d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
    } else {
      d = dateVal;
    }
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const toggleSelected = (current: string[], value: string) => {
    return current.includes(value) ? current.filter(v => v !== value) : [...current, value];
  };

  const CheckboxList = ({
    sectionId,
    options,
    selected,
    onChange,
  }: {
    sectionId: string;
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
  }) => {
    if (options.length === 0) {
      return <div className="px-2 py-1 text-sm text-gray-500">No options</div>;
    }
    return (
      <div className="max-h-56 overflow-auto overscroll-contain custom-scrollbar pr-1">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          const id = `${sectionId}-${opt}`.replace(/\s+/g, '-').toLowerCase();
          return (
            <div
              key={opt}
              className="flex items-center gap-2 px-2 py-2 hover:bg-slate-100 rounded-md"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(toggleSelected(selected, opt));
              }}
            >
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={() => {
                  onChange(toggleSelected(selected, opt));
                }}
              />
              <label
                htmlFor={id}
                className="text-sm cursor-pointer select-none flex-1 truncate"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(toggleSelected(selected, opt));
                }}
              >
                {opt}
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});
  const [filterShowAll, setFilterShowAll] = useState<Record<string, boolean>>({});

  const FilterSection = ({
    sectionId,
    title,
    options,
    selected,
    onChange,
  }: {
    sectionId: string;
    title: string;
    options: string[];
    selected: string[];
    onChange: (next: string[]) => void;
  }) => {
    const query = (filterSearch[sectionId] || '').trim().toLowerCase();
    const showAll = !!filterShowAll[sectionId];
    const filtered = query
      ? options.filter((opt) => opt.toLowerCase().includes(query))
      : options;

    const MAX_VISIBLE = 50;
    const visible = showAll ? filtered : filtered.slice(0, MAX_VISIBLE);
    const remaining = Math.max(0, filtered.length - visible.length);

    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            value={filterSearch[sectionId] || ''}
            onChange={(e) => {
              const next = e.target.value;
              setFilterSearch((prev) => ({ ...prev, [sectionId]: next }));
              setFilterShowAll((prev) => ({ ...prev, [sectionId]: false }));
            }}
            placeholder={`Search ${title}`}
            className="pl-10 h-9 text-sm"
          />
        </div>

        <CheckboxList sectionId={sectionId} options={visible} selected={selected} onChange={onChange} />

        {remaining > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-blue-600 hover:text-blue-700 justify-start"
            onClick={() => setFilterShowAll((prev) => ({ ...prev, [sectionId]: true }))}
          >
            {remaining} more
          </Button>
        )}
      </div>
    );
  };

  const activeFilterCount =
    selectedCategories.length +
    selectedVendors.length +
    selectedStatuses.length +
    selectedBillingCycles.length +
    selectedDepartments.length +
    selectedOwners.length +
    selectedPaymentMethods.length +
    selectedReminderPolicies.length +
    (amountMin.trim() ? 1 : 0) +
    (amountMax.trim() ? 1 : 0) +
    (startDateFrom ? 1 : 0) +
    (startDateTo ? 1 : 0) +
    (nextRenewalFrom ? 1 : 0) +
    (nextRenewalTo ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedVendors([]);
    setSelectedStatuses(initialIsCancelledView ? ['Cancelled'] : []);
    setSelectedBillingCycles([]);
    setSelectedDepartments([]);
    setSelectedOwners([]);
    setSelectedPaymentMethods([]);
    setSelectedReminderPolicies([]);
    setAmountMin('');
    setAmountMax('');
    setStartDateFrom('');
    setStartDateTo('');
    setNextRenewalFrom('');
    setNextRenewalTo('');
  };

  const FiltersSidebarPanel = () => (
    <div className="bg-white border border-gray-200  shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-gray-900">Filters</div>
          <div className="text-xs text-gray-500 mt-0.5">Refine subscriptions</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            onClick={() => setFiltersOpen(false)}
          >
            Close
          </Button>
        </div>
      </div>

      <div className="p-5 max-h-[calc(100vh-260px)] overflow-auto overscroll-contain custom-scrollbar">
        <Accordion type="multiple" defaultValue={["categories", "price", "vendor"]}>
          <AccordionItem value="categories">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Categories
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="categories"
                title="Category"
                options={uniqueCategories}
                selected={selectedCategories}
                onChange={setSelectedCategories}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="vendor">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Vendor
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="vendor"
                title="Vendor"
                options={uniqueVendors}
                selected={selectedVendors}
                onChange={setSelectedVendors}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="status">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Status
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="status"
                title="Status"
                options={uniqueStatuses}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="billing">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Billing
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="billing"
                title="Billing"
                options={uniqueBillingCycles}
                selected={selectedBillingCycles}
                onChange={setSelectedBillingCycles}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="department">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Department
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="department"
                title="Department"
                options={uniqueDepartments}
                selected={selectedDepartments}
                onChange={setSelectedDepartments}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="owner">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Owner
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="owner"
                title="Owner"
                options={uniqueOwners}
                selected={selectedOwners}
                onChange={setSelectedOwners}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payment">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Payment
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="payment"
                title="Payment"
                options={uniquePaymentMethods}
                selected={selectedPaymentMethods}
                onChange={setSelectedPaymentMethods}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reminder">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Reminder
            </AccordionTrigger>
            <AccordionContent>
              <FilterSection
                sectionId="reminder"
                title="Reminder"
                options={uniqueReminderPolicies}
                selected={selectedReminderPolicies}
                onChange={setSelectedReminderPolicies}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="price">
            <AccordionTrigger className="text-xs font-bold text-gray-800 tracking-wider uppercase">
              Price
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center gap-2 px-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Min"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  className="h-9"
                />
                <span className="text-sm text-gray-500">to</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Max"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  className="h-9"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  );

  if (isLoading && !subscriptions) {
    return (
      <div className="h-full bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 p-4 md:p-6 relative">
        <div className="h-full w-full flex flex-col min-h-0">
          {/* Header Section */}
          <div className="bg-white  shadow-xl p-4 mb-6 border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
                    <Layers className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <Skeleton className="h-10 w-64 mb-2" />
                    <Skeleton className="h-6 w-96" />
                  </div>
                </div>
              </div>
              <div className="flex flex-row gap-4 items-center">
                <Skeleton className="h-12 w-48 rounded-xl" />
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <Card className="mb-6 border-slate-200 shadow-md rounded-xl">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-48 rounded-lg" />
                  <Skeleton className="h-10 w-48 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Section */}
          <Card className="border-slate-200 shadow-lg  overflow-hidden">
            <CardContent className="p-0">
              <div className="space-y-2 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (modalOpen) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-gray-50 via-slate-100 to-gray-100 p-6 overflow-auto flex flex-col">
        <SubscriptionModal
          open={modalOpen}
          onOpenChange={handleCloseModal}
          subscription={editingSubscription}
        />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 via-slate-100 to-gray-100">
      {isImporting && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="w-[360px] max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Importing…</div>
              <div className="text-sm text-gray-600">
                {importProgress && importProgress.total > 0
                  ? `${Math.round((importProgress.processed / importProgress.total) * 100)}%`
                  : '0%'}
              </div>
            </div>
            <div className="mt-3">
              <Progress
                className="h-2"
                value={
                  importProgress && importProgress.total > 0
                    ? (importProgress.processed / importProgress.total) * 100
                    : 0
                }
              />
              <div className="mt-2 text-xs text-gray-500">
                {importProgress && importProgress.total > 0
                  ? `${importProgress.processed} / ${importProgress.total} processed`
                  : 'Preparing import…'}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="h-full w-full px-6 py-8 flex flex-col min-h-0">
        <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
          <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Import Subscriptions Data
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-700 space-y-3">
                <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-amber-900 text-xs font-semibold rounded-r-md">
                  WARNING: You must download and use our official Excel template to import subscriptions. Importing other files will fail.
                </div>
                <p className="text-sm font-medium">
                  Please follow these steps:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600">
                  <li>Download the template using the button below.</li>
                  <li>Fill in the template with your data.</li>
                  <li>Click upload to select your filled template file.</li>
                </ol>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">
                Cancel
              </AlertDialogCancel>
              <Button
                type="button"
                variant="outline"
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold"
                onClick={() => {
                  downloadSubscriptionsImportTemplate();
                  setImportConfirmOpen(false);
                }}
              >
                Download Template
              </Button>
              <AlertDialogAction
                className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold shadow-md"
                onClick={() => {
                  setImportConfirmOpen(false);
                  setTimeout(() => triggerImport(), 0);
                }}
              >
                Upload File
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {filtersOpen && sidebarSlotEl ? createPortal(<FiltersSidebarPanel />, sidebarSlotEl) : null}
        {/* ── Header Row ── */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg"
            >
              <Layers className="h-5 w-5 text-white" />
            </motion.div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Subscription Management</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Add Subscription button - first */}
            <Can I="create" a="Subscription">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={handleAddNew}
                  className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium shadow-lg rounded-lg h-10 px-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Subscription
                </Button>
              </motion.div>
            </Can>

            {selectedSubscriptionIds.size > 0 && (
              <Button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(true)}
                className="h-10 rounded-lg bg-red-600 text-white hover:bg-red-700 border-0 font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedSubscriptionIds.size})
              </Button>
            )}

            {/* Data Management Dropdown - third */}
            <Select
              key={dataManagementSelectKey}
              onValueChange={(value) => {
                if (value === 'export') {
                  handleExport();
                } else if (value === 'import') {
                  setImportConfirmOpen(true);
                }

                // Important: Radix Select won't call onValueChange if the same value is selected again.
                // Remounting clears its internal selection so Import works every time.
                setDataManagementSelectKey((k) => k + 1);
              }}
            >
              <SelectTrigger className="w-16 h-10 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 text-white border-0 hover:from-indigo-600 hover:to-blue-700 font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 px-2.5" title="Import/Export">
                <ArrowUpDown className="h-4 w-4 text-white" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="export" className="cursor-pointer">
                  <div className="flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </div>
                </SelectItem>
                <SelectItem value="import" className="cursor-pointer">
                  <div className="flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
            <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete selected subscriptions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete {selectedSubscriptionIds.size} subscription(s). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-white border border-gray-200 hover:bg-gray-50">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => {
                    const ids = Array.from(selectedSubscriptionIds);
                    bulkDeleteMutation.mutate(ids);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Search + Filter - hidden when modal is open */}
        {!modalOpen && (
          <>
            {/* Search + Filter By */}
            <div className="mb-4 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search subscriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-72 border-gray-200 bg-white text-gray-900 placeholder-gray-400 h-10 text-sm rounded-lg shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-5 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:text-white text-sm font-semibold shadow-md border-0 hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg transition-all"
                  onClick={() => setFiltersOpen((v) => !v)}
                >
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Button>
              </div>
            </div>

            {/* Main Content */}
            <div className="min-w-0 flex-1 min-h-0">
              <Card className="bg-white border border-gray-200 shadow-md overflow-hidden h-full flex flex-col min-h-0">
                <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                  <Table containerClassName="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" className="table-fixed">
                    <TableHeader className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-600">
                      <TableRow className="border-b-2 border-indigo-700 bg-gradient-to-r from-indigo-600 to-blue-600">
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-2 text-center text-xs font-bold text-white uppercase tracking-wide w-[48px]">
                          <Checkbox
                            aria-label="Select all visible subscriptions"
                            checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                            onCheckedChange={(v) => toggleSelectAllVisible(!!v)}
                            className="border-white data-[state=checked]:bg-white data-[state=checked]:text-indigo-700"
                          />
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[300px]">
                          <button
                            onClick={() => handleSort("serviceName")}
                            className="flex items-center font-bold hover:text-indigo-200 transition-colors cursor-pointer"
                          >
                            SERVICE
                            {getSortIcon("serviceName")}
                          </button>
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-4 text-left text-xs font-bold text-white uppercase tracking-wide w-[200px]">
                          CATEGORY
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-3 text-left text-xs font-bold text-white uppercase tracking-wide w-[110px]">
                          <button
                            onClick={() => handleSort("billingCycle")}
                            className="flex items-center font-bold hover:text-indigo-200 transition-colors cursor-pointer"
                          >
                            BILLING
                            {getSortIcon("billingCycle")}
                          </button>
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-1 text-center text-xs font-bold text-white uppercase tracking-wide w-[60px]">
                          QTY
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-2 text-right text-xs font-bold text-white uppercase tracking-wide w-[130px]">
                          <button
                            onClick={() => handleSort("amount")}
                            className="flex items-center justify-end w-full font-bold hover:text-indigo-200 transition-colors cursor-pointer"
                          >
                            AMOUNT(LCY)
                            {getSortIcon("amount")}
                          </button>
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-3 text-left text-xs font-bold text-white uppercase tracking-wide w-[150px]">
                          <button
                            onClick={() => handleSort("nextRenewal")}
                            className="flex items-center font-bold hover:text-indigo-200 transition-colors cursor-pointer"
                          >
                            NEXT RENEWAL
                            {getSortIcon("nextRenewal")}
                          </button>
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-2 text-left text-xs font-bold text-white uppercase tracking-wide w-[140px]">
                          <button
                            onClick={() => handleSort("status")}
                            className="flex items-center font-bold hover:text-indigo-200 transition-colors cursor-pointer"
                          >
                            STATUS
                            {getSortIcon("status")}
                          </button>
                        </TableHead>
                        <TableHead className="sticky top-0 z-20 bg-transparent h-12 px-1 pr-2 text-right text-xs font-bold text-white uppercase tracking-wide w-[60px]">
                          ACTIONS
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSubscriptions && paginatedSubscriptions.length > 0 ? (
                        <AnimatePresence>
                          {paginatedSubscriptions.map((subscription, index) => (
                            <motion.tr
                              key={subscription._id || subscription.id}
                              className={`border-b border-gray-100 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-indigo-50/40`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <TableCell className="px-2 py-3 w-[48px] text-center">
                                {(() => {
                                  const rowId = String((subscription as any)?._id ?? (subscription as any)?.id ?? '').trim();
                                  if (!rowId) return null;
                                  return (
                                    <Checkbox
                                      aria-label={`Select ${subscription.serviceName}`}
                                      checked={selectedSubscriptionIds.has(rowId)}
                                      onCheckedChange={(v) => toggleSelectOne(rowId, !!v)}
                                    />
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="px-3 py-3 font-medium text-gray-800 w-[300px] max-w-[300px] overflow-hidden text-left">
                                <div>
                                  <button
                                    onClick={() => handleEdit(subscription)}
                                    title={subscription.serviceName}
                                    className="group inline-flex items-center gap-1 max-w-full text-left"
                                  >
                                    <span className="relative font-semibold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors duration-200 truncate">
                                      {truncateText(subscription.serviceName, 35)}
                                      <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
                                    </span>
                                    <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">→</span>
                                  </button>
                                  {subscription.notes && (() => {
                                    try {
                                      const notesArray = typeof subscription.notes === 'string' ? JSON.parse(subscription.notes) : subscription.notes;
                                      if (Array.isArray(notesArray) && notesArray.length > 0) {
                                        // Show the first note's text
                                        const firstNote = notesArray[0];
                                        return (
                                          <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                                            {firstNote.text}
                                          </div>
                                        );
                                      }
                                    } catch {
                                      // If it's old format (plain text), show it
                                      if (typeof subscription.notes === 'string' && !subscription.notes.startsWith('[')) {
                                        return <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{subscription.notes}</div>;
                                      }
                                    }
                                    return null;
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-3 w-[200px] max-w-[200px] overflow-hidden text-left">
                                {(() => {
                                  const categoryValue = String((subscription as any)?.category ?? "").trim();
                                  if (!categoryValue) {
                                    return (
                                      <span
                                        className="inline-flex items-center justify-start text-gray-400 text-xs"
                                        style={{ width: `${categoryBadgeWidthCh}ch`, maxWidth: "100%" }}
                                      >
                                        -
                                      </span>
                                    );
                                  }

                                  const raw = categoryValue;
                                  const normalized = raw.toLowerCase();

                                  // Distinct pastel colors per category (softer tones), plus deterministic fallback.
                                  const categoryClassMap: Record<string, string> = {
                                    "productivity & collaboration": "bg-blue-100 text-blue-800 border-blue-300",
                                    "accounting & finance": "bg-emerald-100 text-emerald-800 border-emerald-300",
                                    "crm & sales": "bg-indigo-100 text-indigo-800 border-indigo-300",
                                    "development & hosting": "bg-purple-100 text-purple-800 border-purple-300",
                                    "design & creative tools": "bg-orange-100 text-orange-800 border-orange-300",
                                    "marketing & seo": "bg-amber-100 text-amber-800 border-amber-300",
                                    "communication tools": "bg-sky-100 text-sky-800 border-sky-300",
                                    "security & compliance": "bg-rose-100 text-rose-800 border-rose-300",
                                    "hr & admin": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
                                    "subscription infrastructure": "bg-cyan-100 text-cyan-800 border-cyan-300",
                                    "office infrastructure": "bg-teal-100 text-teal-800 border-teal-300",
                                    "games": "bg-violet-100 text-violet-800 border-violet-300",
                                  };

                                  const fallbackPalette: string[] = [
                                    "bg-blue-100 text-blue-800 border-blue-300",
                                    "bg-emerald-100 text-emerald-800 border-emerald-300",
                                    "bg-indigo-100 text-indigo-800 border-indigo-300",
                                    "bg-purple-100 text-purple-800 border-purple-300",
                                    "bg-orange-100 text-orange-800 border-orange-300",
                                    "bg-amber-100 text-amber-800 border-amber-300",
                                    "bg-sky-100 text-sky-800 border-sky-300",
                                    "bg-rose-100 text-rose-800 border-rose-300",
                                    "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
                                    "bg-cyan-100 text-cyan-800 border-cyan-300",
                                    "bg-teal-100 text-teal-800 border-teal-300",
                                    "bg-violet-100 text-violet-800 border-violet-300",
                                    "bg-slate-100 text-slate-800 border-slate-300",
                                    "bg-pink-100 text-pink-800 border-pink-300",
                                  ];

                                  const hashString = (value: string) => {
                                    let hash = 0;
                                    for (let i = 0; i < value.length; i++) {
                                      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
                                    }
                                    return hash;
                                  };

                                  const badgeClass =
                                    categoryClassMap[normalized] ??
                                    fallbackPalette[Math.abs(hashString(normalized)) % fallbackPalette.length];

                                  return (
                                    <span
                                      className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-tight border max-w-full text-left ${badgeClass}`}
                                      style={{ width: `${categoryBadgeWidthCh}ch`, maxWidth: "100%" }}
                                    >
                                      <span className="truncate whitespace-nowrap" title={raw}>
                                        {raw}
                                      </span>
                                    </span>
                                  );
                                })()}
                              </TableCell>

                              <TableCell className="px-2 py-3 text-sm text-gray-600 w-[110px] capitalize">
                                {subscription.billingCycle}
                              </TableCell>

                              <TableCell className="px-1 py-3 text-center w-[60px]">
                                <span className="text-sm font-medium text-gray-900">
                                  {Number((subscription as any)?.qty ?? 1) || 1}
                                </span>
                              </TableCell>

                              <TableCell className="px-2 py-3 text-right w-[130px]">
                                <span className="text-sm font-medium text-gray-900">
                                  {(() => {
                                    const raw = (subscription as any)?.lcyAmount ?? subscription.amount;
                                    const n = Number.parseFloat(String(raw));
                                    return Number.isFinite(n) ? n.toFixed(2) : '—';
                                  })()}
                                </span>
                              </TableCell>

                              <TableCell className="px-2 py-3 text-left w-[150px]">
                                <div className="flex items-center justify-start text-sm text-gray-700">
                                  <Calendar className="h-3 w-3 text-gray-400 mr-1" />
                                  {formatDate(subscription.nextRenewal)}
                                </div>
                              </TableCell>
                              <TableCell className="px-2 py-3 w-[140px] text-left">
                                {(() => {
                                  const calculatedStatus = calculateSubscriptionStatus(
                                    subscription.nextRenewal,
                                    subscription.reminderDays,
                                    subscription.status
                                  );
                                  return (
                                    <span
                                      className={`inline-flex items-center justify-start px-3 py-1 rounded-full text-xs font-semibold leading-none border ${subscription.billingCycle === 'Trial'
                                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                                          : getStatusBadgeClass(calculatedStatus)
                                        }`}
                                      style={{ width: `calc(${statusPillWidthCh}ch + 1.5rem)`, maxWidth: '100%' }}
                                    >
                                      <span
                                        className="truncate whitespace-nowrap"
                                        title={subscription.billingCycle === 'Trial' ? 'Trial' : calculatedStatus}
                                      >
                                        {subscription.billingCycle === 'Trial' ? 'Trial' : calculatedStatus}
                                      </span>
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="px-1 pr-2 py-3 text-right w-[60px]">
                                {(() => {
                                  const rowId = String(subscription._id || subscription.id || "");
                                  const isOpen = !!rowId && openActionsMenuForId === rowId;
                                  const isAnotherRowOpen = !!openActionsMenuForId && openActionsMenuForId !== rowId;
                                  return (
                                    <DropdownMenu
                                      open={isOpen}
                                      onOpenChange={(open) => {
                                        if (!rowId) return;
                                        setOpenActionsMenuForId(open ? rowId : null);
                                      }}
                                    >
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className={`h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${isAnotherRowOpen ? "invisible" : ""
                                            }`}
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="z-[1000] bg-white text-gray-900 border border-gray-200 shadow-lg"
                                      >
                                        <Can I="update" a="Subscription">
                                          <DropdownMenuItem
                                            onClick={() => handleEdit(subscription)}
                                            className="cursor-pointer"
                                          >
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                          </DropdownMenuItem>
                                        </Can>
                                        <Can I="delete" a="Subscription">
                                          <DropdownMenuItem
                                            onClick={() => handleDelete(subscription)}
                                            className="cursor-pointer text-red-600 focus:text-red-600"
                                            disabled={deleteMutation.isPending}
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </Can>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  );
                                })()}
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-500">
                              <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                              <p className="text-sm font-medium text-gray-900">No subscriptions found</p>
                              <p className="text-xs text-gray-500 mt-1">Try adjusting your search filters or add a new subscription</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>

                {/* Gmail-style Pagination */}
                {totalFiltered > 0 && (
                  <div className="border-t border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-slate-700">
                      <div>
                        {(() => {
                          const start = totalFiltered === 0 ? 0 : startIndex + 1;
                          const end = Math.min(endIndex, totalFiltered);
                          return `${start}–${end} of ${totalFiltered}`;
                        })()}
                      </div>
                      <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                        <span className="text-xs text-slate-500">Rows per page:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
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
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                        >
                          Previous
                        </Button>
                        {(() => {
                          const buttons: number[] = [];
                          const maxButtons = 5;
                          let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
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
                              variant={p === currentPage ? "default" : "ghost"}
                              className={`h-9 w-9 px-0 text-sm ${p === currentPage
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "text-slate-600 hover:bg-slate-100"
                                }`}
                              onClick={() => setCurrentPage(p)}
                            >
                              {p}
                            </Button>
                          ));
                        })()}
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 px-3 text-sm text-slate-600 hover:bg-slate-100"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}


        <SubscriptionModal
          open={modalOpen}
          onOpenChange={handleCloseModal}
          subscription={editingSubscription}
        />

        <Dialog
          open={modalOpen && !editingSubscription && (isLoading || isOpenedSubscriptionLoading)}
          onOpenChange={(open) => {
            if (!open) {
              setPendingOpenSubscriptionId(null);
              handleCloseModal();
            }
          }}
        >
          <DialogContent className="max-w-md ">
            <DialogHeader>
              <DialogTitle>Loading subscription...</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-600" />
              Please wait
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-md  border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
            {/* Header with Red Gradient Background */}
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-white">
                      Delete Subscription
                    </DialogTitle>
                    <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
                  </div>
                </div>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                Are you sure you want to delete the subscription <span className="font-semibold text-gray-900">"{subscriptionToDelete?.serviceName}"</span>?
              </p>
              <p className="text-gray-600 text-xs leading-relaxed">
                This will permanently remove this subscription and all its associated data from your system.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setSubscriptionToDelete(null);
                }}
                className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Validation Errors Dialog */}
        <Dialog open={importErrorsDialogOpen} onOpenChange={setImportErrorsDialogOpen}>
          <DialogContent className="max-w-xl border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-white">
                      Import Validation Errors
                    </DialogTitle>
                    <p className="text-red-100 mt-0.5 text-sm font-medium">Some rows could not be imported due to validation failures.</p>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="px-6 py-5 overflow-y-auto max-h-[350px]">
              <p className="text-gray-700 text-sm mb-4 leading-relaxed">
                We found the following issues in the uploaded sheet. Valid rows have been imported successfully, but these rows were skipped:
              </p>
              <div className="space-y-3">
                {importErrors.map((err, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="font-semibold text-red-800 text-sm mb-1">Row {err.rowNum}</div>
                    <ul className="list-disc list-inside space-y-1">
                      {err.errors.map((msg, msgIdx) => (
                        <li key={msgIdx} className="text-xs text-red-700">{msg}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
              <Button
                type="button"
                onClick={() => {
                  setImportErrorsDialogOpen(false);
                  setImportErrors([]);
                }}
                className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          ref={fileInputRef}
          onChange={handleImport}
          className="hidden"
        />
      </div>
    </div>
  );
}
