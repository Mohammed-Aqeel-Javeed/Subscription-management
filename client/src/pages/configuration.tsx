import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronDown, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Settings, Eye, EyeOff, CreditCard, Shield, DollarSign, Edit, Trash2, Maximize2, Minimize2, Search, Upload, Download, AlertCircle, X, MoreVertical, BadgeDollarSign, WalletCards, Layers, ShieldCheck } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/lib/config";
import * as XLSX from 'xlsx';

type ConfigSection = "currency" | "payment" | "custom-field";

const CONFIG_SECTIONS: Array<{ key: ConfigSection; label: string; icon: React.ElementType }> = [
  { key: "currency", label: "Currency", icon: BadgeDollarSign },
  { key: "payment", label: "Payment Methods", icon: WalletCards },
  { key: "custom-field", label: "Custom field", icon: Layers },
];

function isConfigSection(value: unknown): value is ConfigSection {
  return (
    value === "currency" ||
    value === "payment" ||
    value === "custom-field"
  );
}

function ConfigurationLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam) return;

    // Legacy tabs (merged into Custom field)
    if (tabParam === 'subscription' || tabParam === 'compliance' || tabParam === 'reminder') {
      navigate('/configuration/custom-field', { replace: true });
      return;
    }

    if (isConfigSection(tabParam)) {
      navigate(`/configuration/${tabParam}`, { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div className="h-full bg-gray-50 relative overflow-hidden flex flex-col min-h-0">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-[30rem] w-[30rem] rounded-full bg-blue-500/10 blur-3xl" />
      </div>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-10 flex items-center gap-4">
            <div className="relative h-14 w-14 rounded-2xl bg-white/70 border border-white/70 backdrop-blur-xl shadow-md flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-blue-500/15" />
              <div className="absolute inset-[1px] rounded-2xl bg-white/70" />
              <Settings className="relative h-7 w-7 text-indigo-700" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-semibold text-indigo-950 truncate">Setup &amp; Configuration</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {CONFIG_SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(`/configuration/${item.key}`)}
                  className="group relative overflow-hidden text-left rounded-3xl border border-white/60 bg-white/30 backdrop-blur-xl p-8 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:border-indigo-200/70"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-blue-500/15 opacity-100" />
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-br from-white/10 via-white/0 to-white/10" />

                  <div className="relative flex items-center gap-5">
                    <div className="relative h-14 w-14 rounded-2xl bg-white/70 border border-white/70 backdrop-blur-xl shadow-md flex items-center justify-center">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-blue-500/15 opacity-80" />
                      <div className="absolute inset-[1px] rounded-2xl bg-white/70" />
                      <Icon className="relative h-7 w-7 text-indigo-700" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-indigo-950 truncate">{item.label}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigurationContent({ section }: { section: ConfigSection }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const exitConfirmActionRef = useRef<null | (() => void)>(null);
  const currencySnapshotRef = useRef<string>("");
  const paymentSnapshotRef = useRef<string>("");
  const modalUrlRestoreRef = useRef<string | null>(null);
  const lastSecuredTabRef = useRef<string | null>(null);

  const requestExitConfirm = (action: () => void) => {
    exitConfirmActionRef.current = action;
    setExitConfirmOpen(true);
  };

  const storeModalRestoreUrlIfNeeded = () => {
    if (modalUrlRestoreRef.current) return;
    modalUrlRestoreRef.current = window.location.pathname + window.location.search + window.location.hash;
  };

  const restoreModalUrlIfNeeded = () => {
    if (modalUrlRestoreRef.current && window.location.pathname.startsWith('/s/')) {
      window.history.replaceState(window.history.state, '', modalUrlRestoreRef.current);
    }
    modalUrlRestoreRef.current = null;
  };

  const setSecureUrlForConfigEditModal = async (tab: string, entityType: 'paymentMethod' | 'currency', id: string) => {
    const trimmedId = String(id ?? '').trim();
    if (!trimmedId) return;

    try {
      storeModalRestoreUrlIfNeeded();

      const deeplinkRes = await fetch('/api/deeplink/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entityType, id: trimmedId }),
      });
      if (!deeplinkRes.ok) return;
      const deeplinkData = (await deeplinkRes.json()) as { token?: string };
      const openToken = String(deeplinkData?.token ?? '').trim();
      if (!openToken) return;

      const secureRes = await fetch('/api/secure-link/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: '/configuration',
          query: { tab, openToken },
        }),
      });
      if (!secureRes.ok) return;
      const secureData = (await secureRes.json()) as { token?: string };
      const secureToken = String(secureData?.token ?? '').trim();
      if (!secureToken) return;

      window.history.replaceState(window.history.state, '', `/s/${secureToken}`);
    } catch {
      // best-effort only
    }
  };

  const setSecureUrlForConfigTab = async (tab: string) => {
    const t = String(tab ?? '').trim();
    if (!t) return;

    try {
      const secureRes = await fetch('/api/secure-link/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: '/configuration',
          query: { tab: t },
        }),
      });
      if (!secureRes.ok) return;
      const secureData = (await secureRes.json()) as { token?: string };
      const secureToken = String(secureData?.token ?? '').trim();
      if (!secureToken) return;

      window.history.replaceState(window.history.state, '', `/s/${secureToken}`);
    } catch {
      // best-effort only
    }
  };

  const setSecureUrlForConfigAddPaymentModal = async () => {
    try {
      storeModalRestoreUrlIfNeeded();

      const secureRes = await fetch('/api/secure-link/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: '/configuration',
          query: { tab: 'payment', addPayment: '1' },
          ttlMs: 10 * 60 * 1000,
        }),
      });
      if (!secureRes.ok) return;
      const secureData = (await secureRes.json()) as { token?: string };
      const secureToken = String(secureData?.token ?? '').trim();
      if (!secureToken) return;

      window.history.replaceState(window.history.state, '', `/s/${secureToken}`);
    } catch {
      // best-effort only
    }
  };
  
  // Fetch employees for Managed by dropdown
  const { data: employeesRaw = [] } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/employees`, { credentials: 'include' });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });
  
  const activeTab: ConfigSection = section;
  const setActiveTab = (nextTab: string) => {
    if (!isConfigSection(nextTab)) return;
    if (nextTab === section) return;
    navigate(`/configuration/${nextTab}`);
  };
  
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [isUpdatingCurrencyRates, setIsUpdatingCurrencyRates] = useState(false);
  const [editingRates, setEditingRates] = useState<{ [key: string]: string }>({});
  const [pendingCurrencyCodeToOpen, setPendingCurrencyCodeToOpen] = useState<string | null>(null);
  // Delete payment method handler (DELETE from backend)
  const handleDeletePaymentMethod = (method: any) => {
    setPaymentToDelete(method);
    setDeleteConfirmOpen(true);
  };
  
  // Confirm delete payment method
  const confirmDeletePaymentMethod = () => {
    if (!paymentToDelete?._id) {
      toast({ title: "Error", description: "Cannot delete: missing id", variant: "destructive" });
      return;
    }

    const paymentName = String(paymentToDelete.name || paymentToDelete.title || '').trim();
    const inUseCount = paymentName ? getPaymentMethodSubscriptions(paymentName).length : 0;
    if (inUseCount > 0) {
      toast({
        title: "Cannot delete payment method",
        description: `This payment method is linked to ${inUseCount} subscription(s). Please reassign the payment method before deleting.`,
        variant: "destructive",
      });
      return;
    }
    
    // Close dialog and show toast immediately for better UX
    setDeleteConfirmOpen(false);
    const deletedName = paymentToDelete.name || paymentToDelete.title;
    setPaymentToDelete(null);
    
    fetch(`/api/payment/${paymentToDelete._id}`, { method: "DELETE" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (json as any)?.message || "Failed to delete payment method";
          throw new Error(msg);
        }
        return json;
      })
      .then(() => {
        // Only use queryClient to invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
        toast({
          title: "Payment Method Deleted",
          description: `${deletedName} has been deleted successfully`,
          variant: "destructive",
        });
      })
      .catch((err) => {
        toast({
          title: "Error",
          description: err?.message || "Failed to delete payment method",
          variant: "destructive",
        });
      });
  };
  
  // Edit payment method logic
  const openEditPayment = (method: any) => {
    console.log('Opening edit payment with method:', method);
    console.log('Owner value:', method.owner);
    console.log('Manager value:', method.manager);
    console.log('Available employees:', employeesRaw.map((e: any) => e.name));
    console.log('Employees loaded:', employeesRaw.length > 0);
    
    // Trim values to remove any extra spaces
    const ownerValue = method.owner?.trim() || '';
    const managerValue = method.manager?.trim() || '';
    
    console.log('Trimmed owner:', ownerValue);
    console.log('Trimmed manager:', managerValue);
    
    const nextPaymentForm = {
      // Prefer canonical field from backend
      title: method.name || method.title || '',
      type: method.type || '',
      owner: ownerValue,
      manager: managerValue,
      expiresAt: method.expiresAt || '',
      financialInstitution: method.financialInstitution || '',
      lastFourDigits: method.lastFourDigits || '',
    };

    setPaymentForm(nextPaymentForm);
    paymentSnapshotRef.current = JSON.stringify(nextPaymentForm);
    setEditPaymentModalOpen(true);
    setEditingPaymentId(String(method?._id ?? ''));

    if (method?._id) {
      void setSecureUrlForConfigEditModal('payment', 'paymentMethod', String(method._id));
    }
  };
  
  // Track which payment method is being edited (id only)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  
  // Handle edit payment method submit (PUT to backend)
  const handleEditPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentId) {
      toast({ title: "Error", description: "Cannot update: missing id", variant: "destructive" });
      return;
    }

    const paymentId = editingPaymentId;
    const nextName = paymentForm.title.trim();
    
    // Check for duplicate payment method name (excluding the current one being edited)
    const duplicateName = paymentMethods.find(
      method => (method._id !== editingPaymentId) && 
                (method.name?.toLowerCase().trim() === paymentForm.title.toLowerCase().trim() ||
                 method.title?.toLowerCase().trim() === paymentForm.title.toLowerCase().trim())
    );
    
    if (duplicateName) {
      setValidationErrorMessage(`A payment method with the name "${paymentForm.title}" already exists. Please use a different name.`);
      setValidationErrorOpen(true);
      return;
    }
    
    // Validate expiry date is not in the past
    if (paymentForm.expiresAt) {
      const [year, month] = paymentForm.expiresAt.split('-');
      const expiryDate = new Date(parseInt(year), parseInt(month) - 1); // month is 0-indexed
      const today = new Date();
      today.setDate(1); // Set to first day of current month for comparison
      today.setHours(0, 0, 0, 0);
      
      if (expiryDate < today) {
        setValidationErrorMessage("Card expiry date cannot be in the past");
        setValidationErrorOpen(true);
        return;
      }
    }
    
    fetch(`/api/payment/${paymentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Keep both keys for backward compatibility with any older data/UI usage
        name: nextName,
        title: nextName,
        type: paymentForm.type,
        owner: paymentForm.owner,
        manager: paymentForm.manager,
        expiresAt: paymentForm.expiresAt,
        financialInstitution: paymentForm.financialInstitution,
        lastFourDigits: paymentForm.lastFourDigits,
      }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (json as any)?.message || 'Failed to update payment method';
          throw new Error(msg);
        }
        return json;
      })
      .then(() => {
        // Update cached list immediately so reopening the modal shows the updated values
        queryClient.setQueryData(["/api/payment"], (prev: any) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((pm: any) => {
            const pmId = String(pm?._id ?? pm?.id ?? '');
            if (pmId !== paymentId) return pm;
            return {
              ...pm,
              name: nextName,
              title: nextName,
              type: paymentForm.type,
              owner: paymentForm.owner,
              manager: paymentForm.manager,
              expiresAt: paymentForm.expiresAt,
              financialInstitution: paymentForm.financialInstitution,
              lastFourDigits: paymentForm.lastFourDigits,
            };
          });
        });

        // Close modal and show toast
        closeEditPaymentModal();
        setEditingPaymentId(null);
        toast({
          title: "Payment Method Updated",
          description: "Payment method has been updated successfully",
          variant: "success",
        });

        // Sync with server
        queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
        void queryClient.refetchQueries({ queryKey: ["/api/payment"] });
      })
      .catch((err) => {
        toast({
          title: 'Error',
          description: err?.message || 'Failed to update payment method',
          variant: 'destructive',
        });
      });
  };
  
  // Edit Payment Method Modal state
  const [editPaymentModalOpen, setEditPaymentModalOpen] = useState(false);
  
  // Helper function to close edit modal and navigate back if needed
  const closeEditPaymentModal = () => {
    restoreModalUrlIfNeeded();
    setEditPaymentModalOpen(false);
    
    // Check if we should return to notifications
    const shouldReturnToNotifications = localStorage.getItem('returnToNotifications') === 'true';
    if (shouldReturnToNotifications) {
      localStorage.removeItem('returnToNotifications');
      navigate('/notifications');
    }
  };
  
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [openPaymentActionsMenuForKey, setOpenPaymentActionsMenuForKey] = useState<string | null>(null);
  
  // Validation error dialog state
  const [validationErrorOpen, setValidationErrorOpen] = useState(false);
  const [validationErrorMessage, setValidationErrorMessage] = useState("");
  
  // Fetch payment methods using React Query
  const { data: paymentMethods = [], isSuccess: isPaymentMethodsLoaded } = useQuery({
    queryKey: ["/api/payment"],
    queryFn: async () => {
      const res = await fetch("/api/payment", { credentials: 'include' });
      const data = await res.json();
      console.log('Fetched payment methods:', data);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Auto-switch to payment tab if coming from payment expiry notification
  useEffect(() => {
    const shouldOpenPayment = localStorage.getItem('openPaymentMethods') === 'true';
    const paymentIdToOpen = localStorage.getItem('openPaymentId');
    
    if (shouldOpenPayment) {
      setActiveTab('payment');
      localStorage.removeItem('openPaymentMethods');
      
      // If we have a specific payment ID, open its edit modal
      if (paymentIdToOpen && isPaymentMethodsLoaded && paymentMethods.length > 0) {
        // Mark that we came from notifications
        localStorage.setItem('returnToNotifications', 'true');
        
        // Use requestAnimationFrame for immediate execution after render
        requestAnimationFrame(() => {
          const payment = paymentMethods.find(
            (pm: any) => String(pm._id) === paymentIdToOpen || String(pm.id) === paymentIdToOpen
          );
          
          if (payment) {
            console.log('Auto-opening payment method edit modal for:', payment);
            openEditPayment(payment);
          }
          
          localStorage.removeItem('openPaymentId');
        });
      } else if (!paymentIdToOpen) {
        // Just scroll to payment methods section
        requestAnimationFrame(() => {
          const paymentSection = document.getElementById('payment-methods-section');
          if (paymentSection) {
            paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
    }
  }, [isPaymentMethodsLoaded, paymentMethods]);

  // Fetch subscriptions to count payment method usage
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["/api/subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions", { credentials: 'include' });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Payment method subscription modal state
  const [paymentSubsModalOpen, setPaymentSubsModalOpen] = useState(false);
  const [selectedPaymentSubs, setSelectedPaymentSubs] = useState<{paymentMethod: string; subscriptions: any[]}>({
    paymentMethod: '',
    subscriptions: []
  });

  // Get subscriptions for a payment method
  const getPaymentMethodSubscriptions = (paymentMethodName: string) => {
    return subscriptions.filter(sub => {
      return sub.paymentMethod && 
             sub.paymentMethod.toLowerCase().trim() === paymentMethodName.toLowerCase().trim();
    });
  };

  // Get subscriptions for a currency
  const getCurrencySubscriptions = (currencyCode: string) => {
    const code = (currencyCode || '').toUpperCase().trim();
    if (!code) return [];
    return subscriptions.filter((sub) => {
      const subCurrency = (sub?.currency || '').toUpperCase().trim();
      return subCurrency === code;
    });
  };

  // Open payment method subscriptions modal
  const openPaymentSubsModal = (paymentMethodName: string) => {
    const subs = getPaymentMethodSubscriptions(paymentMethodName);
    setSelectedPaymentSubs({
      paymentMethod: paymentMethodName,
      subscriptions: subs
    });
    setPaymentSubsModalOpen(true);
  };
  
  // Currencies state and handlers
  interface Currency {
    _id?: string;
    name: string;
    code: string;
    symbol: string;
    isoNumber: string;
    exchangeRate: string;
    visible: boolean;
    created: string;
    lastUpdated?: string; // Track when currency rate was last updated
    latestRate?: string; // Added for displaying latest exchange rate
  }
  
  const [newCurrency, setNewCurrency] = useState<Currency>({
    name: '',
    code: '',
    symbol: '',
    isoNumber: '',
    exchangeRate: '',
    visible: true,
    created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  });

  // Autocomplete state
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredCurrencies, setFilteredCurrencies] = useState<Array<{code: string, description: string, symbol: string, countryCode?: string}>>([]);
  
  // File input refs for Excel import
  const currencyFileInputRef = useRef<HTMLInputElement>(null);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  
  // Currency tab Data Management
  const [currencyDataManagementSelectKey, setCurrencyDataManagementSelectKey] = useState(0);
  const [currencyImportConfirmOpen, setCurrencyImportConfirmOpen] = useState(false);
  
  // Payment Methods tab Data Management
  const [paymentDataManagementSelectKey, setPaymentDataManagementSelectKey] = useState(0);
  const [paymentImportConfirmOpen, setPaymentImportConfirmOpen] = useState(false);

  /**
   * EXCEL IMPORT/EXPORT FUNCTIONALITY
   * 
   * Currency Excel Format:
   * - Currency Code (required): 3-letter code (e.g., USD, EUR, INR)
   * - Description (required): Full name (e.g., United States Dollar)
   * - Symbol (required): Currency symbol (e.g., $, €, ₹)
   * - Exchange Rate (optional): Rate against local currency
   * - Created (auto): Date when currency was created
   * - Last Updated (auto): Date when rate was last updated
   * 
   * Payment Method Excel Format:
   * - Title (required): Payment method name
   * - Type (required): Credit, Debit, Cash, Bank Transfer, Digital Wallet, Other
   * - Description (optional): Additional details
   * - Icon (optional): visa, mastercard, paypal, amex, apple_pay, google_pay, bank, cash, other
   * - Manager (optional): Person responsible
   * - Expires At (optional): Expiration date (YYYY-MM-DD format)
   */

  // Map currency code to ISO country code for flag rendering
  const getCountryCodeForCurrency = (code: string): string | undefined => {
    const map: Record<string, string> = {
      AED: "AE",
      AFN: "AF",
      ALL: "AL",
      AMD: "AM",
      ANG: "CW",
      AOA: "AO",
      ARS: "AR",
      AUD: "AU",
      AWG: "AW",
      AZN: "AZ",
      BAM: "BA",
      BBD: "BB",
      BDT: "BD",
      BGN: "BG",
      BHD: "BH",
      BIF: "BI",
      BMD: "BM",
      BND: "BN",
      BOB: "BO",
      BRL: "BR",
      BSD: "BS",
      BTN: "BT",
      BWP: "BW",
      BYN: "BY",
      BZD: "BZ",
      CAD: "CA",
      CDF: "CD",
      CHF: "CH",
      CLP: "CL",
      CNY: "CN",
      COP: "CO",
      CRC: "CR",
      CUP: "CU",
      CVE: "CV",
      CZK: "CZ",
      DJF: "DJ",
      DKK: "DK",
      DOP: "DO",
      DZD: "DZ",
      EGP: "EG",
      ERN: "ER",
      ETB: "ET",
      EUR: "EU",
      FJD: "FJ",
      FKP: "FK",
      GBP: "GB",
      GEL: "GE",
      GHS: "GH",
      GIP: "GI",
      GMD: "GM",
      GNF: "GN",
      GTQ: "GT",
      GYD: "GY",
      HKD: "HK",
      HNL: "HN",
      HRK: "HR",
      HTG: "HT",
      HUF: "HU",
      IDR: "ID",
      ILS: "IL",
      INR: "IN",
      IQD: "IQ",
      IRR: "IR",
      ISK: "IS",
      JMD: "JM",
      JOD: "JO",
      JPY: "JP",
      KES: "KE",
      KGS: "KG",
      KHR: "KH",
      KMF: "KM",
      KWD: "KW",
      KZT: "KZ",
      LAK: "LA",
      LBP: "LB",
      LKR: "LK",
      LRD: "LR",
      LSL: "LS",
      LYD: "LY",
      MAD: "MA",
      MDL: "MD",
      MGA: "MG",
      MKD: "MK",
      MMK: "MM",
      MNT: "MN",
      MOP: "MO",
      MRU: "MR",
      MUR: "MU",
      MVR: "MV",
      MWK: "MW",
      MXN: "MX",
      MYR: "MY",
      MZN: "MZ",
      NAD: "NA",
      NGN: "NG",
      NIO: "NI",
      NOK: "NO",
      NPR: "NP",
      NZD: "NZ",
      OMR: "OM",
      PAB: "PA",
      PEN: "PE",
      PGK: "PG",
      PHP: "PH",
      PKR: "PK",
      PLN: "PL",
      PYG: "PY",
      QAR: "QA",
      RON: "RO",
      RSD: "RS",
      RUB: "RU",
      RWF: "RW",
      SAR: "SA",
      SBD: "SB",
      SCR: "SC",
      SDG: "SD",
      SEK: "SE",
      SGD: "SG",
      SHP: "SH",
      SLE: "SL",
      SOS: "SO",
      SRD: "SR",
      SSP: "SS",
      STN: "ST",
      SZL: "SZ",
      THB: "TH",
      TJS: "TJ",
      TMT: "TM",
      TND: "TN",
      TOP: "TO",
      TRY: "TR",
      TTD: "TT",
      TVD: "TV",
      TWD: "TW",
      TZS: "TZ",
      UAH: "UA",
      UGX: "UG",
      USD: "US",
      UYU: "UY",
      UZS: "UZ",
      VES: "VE",
      VND: "VN",
      VUV: "VU",
      WST: "WS",
      XAF: "CF",
      XCD: "AG",
      XOF: "SN",
      XPF: "PF",
      YER: "YE",
      ZAR: "ZA",
      ZMW: "ZM",
      ZWL: "ZW",
    };

    return map[code as keyof typeof map];
  };

  // Complete currency list for autocomplete
  const currencyList = [
    { code: "AED", description: "UAE Dirham", symbol: "د.إ" },
    { code: "AFN", description: "Afghan Afghani", symbol: "؋" },
    { code: "ALL", description: "Albanian Lek", symbol: "L" },
    { code: "AMD", description: "Armenian Dram", symbol: "֏" },
    { code: "ANG", description: "Netherlands Antillean Guilder", symbol: "ƒ" },
    { code: "AOA", description: "Angolan Kwanza", symbol: "Kz" },
    { code: "ARS", description: "Argentine Peso", symbol: "$" },
    { code: "AUD", description: "Australian Dollar", symbol: "A$" },
    { code: "AWG", description: "Aruban Florin", symbol: "ƒ" },
    { code: "AZN", description: "Azerbaijani Manat", symbol: "₼" },
    { code: "BAM", description: "Bosnia and Herzegovina Convertible Mark", symbol: "KM" },
    { code: "BBD", description: "Barbadian Dollar", symbol: "Bds$" },
    { code: "BDT", description: "Bangladeshi Taka", symbol: "৳" },
    { code: "BGN", description: "Bulgarian Lev", symbol: "лв" },
    { code: "BHD", description: "Bahraini Dinar", symbol: ".د.ب" },
    { code: "BIF", description: "Burundian Franc", symbol: "FBu" },
    { code: "BMD", description: "Bermudian Dollar", symbol: "$" },
    { code: "BND", description: "Brunei Dollar", symbol: "B$" },
    { code: "BOB", description: "Bolivian Boliviano", symbol: "Bs." },
    { code: "BRL", description: "Brazilian Real", symbol: "R$" },
    { code: "BSD", description: "Bahamian Dollar", symbol: "$" },
    { code: "BTN", description: "Bhutanese Ngultrum", symbol: "Nu." },
    { code: "BWP", description: "Botswana Pula", symbol: "P" },
    { code: "BYN", description: "Belarusian Ruble", symbol: "Br" },
    { code: "BZD", description: "Belize Dollar", symbol: "BZ$" },
    { code: "CAD", description: "Canadian Dollar", symbol: "C$" },
    { code: "CDF", description: "Congolese Franc", symbol: "FC" },
    { code: "CHF", description: "Swiss Franc", symbol: "CHF" },
    { code: "CLP", description: "Chilean Peso", symbol: "$" },
    { code: "CNY", description: "Chinese Yuan", symbol: "¥" },
    { code: "COP", description: "Colombian Peso", symbol: "$" },
    { code: "CRC", description: "Costa Rican Colón", symbol: "₡" },
    { code: "CUP", description: "Cuban Peso", symbol: "$" },
    { code: "CVE", description: "Cape Verdean Escudo", symbol: "$" },
    { code: "CZK", description: "Czech Koruna", symbol: "Kč" },
    { code: "DJF", description: "Djiboutian Franc", symbol: "Fdj" },
    { code: "DKK", description: "Danish Krone", symbol: "kr" },
    { code: "DOP", description: "Dominican Peso", symbol: "RD$" },
    { code: "DZD", description: "Algerian Dinar", symbol: "دج" },
    { code: "EGP", description: "Egyptian Pound", symbol: "£" },
    { code: "ERN", description: "Eritrean Nakfa", symbol: "Nkf" },
    { code: "ETB", description: "Ethiopian Birr", symbol: "Br" },
    { code: "EUR", description: "Euro", symbol: "€" },
    { code: "FJD", description: "Fijian Dollar", symbol: "FJ$" },
    { code: "FKP", description: "Falkland Islands Pound", symbol: "£" },
    { code: "FOK", description: "Faroese Króna", symbol: "kr" },
    { code: "GBP", description: "British Pound Sterling", symbol: "£" },
    { code: "GEL", description: "Georgian Lari", symbol: "₾" },
    { code: "GGP", description: "Guernsey Pound", symbol: "£" },
    { code: "GHS", description: "Ghanaian Cedi", symbol: "₵" },
    { code: "GIP", description: "Gibraltar Pound", symbol: "£" },
    { code: "GMD", description: "Gambian Dalasi", symbol: "D" },
    { code: "GNF", description: "Guinean Franc", symbol: "FG" },
    { code: "GTQ", description: "Guatemalan Quetzal", symbol: "Q" },
    { code: "GYD", description: "Guyanese Dollar", symbol: "G$" },
    { code: "HKD", description: "Hong Kong Dollar", symbol: "HK$" },
    { code: "HNL", description: "Honduran Lempira", symbol: "L" },
    { code: "HRK", description: "Croatian Kuna", symbol: "kn" },
    { code: "HTG", description: "Haitian Gourde", symbol: "G" },
    { code: "HUF", description: "Hungarian Forint", symbol: "Ft" },
    { code: "IDR", description: "Indonesian Rupiah", symbol: "Rp" },
    { code: "ILS", description: "Israeli New Shekel", symbol: "₪" },
    { code: "IMP", description: "Isle of Man Pound", symbol: "£" },
    { code: "INR", description: "Indian Rupee", symbol: "₹" },
    { code: "IQD", description: "Iraqi Dinar", symbol: "ع.د" },
    { code: "IRR", description: "Iranian Rial", symbol: "﷼" },
    { code: "ISK", description: "Icelandic Króna", symbol: "kr" },
    { code: "JEP", description: "Jersey Pound", symbol: "£" },
    { code: "JMD", description: "Jamaican Dollar", symbol: "J$" },
    { code: "JOD", description: "Jordanian Dinar", symbol: "د.ا" },
    { code: "JPY", description: "Japanese Yen", symbol: "¥" },
    { code: "KES", description: "Kenyan Shilling", symbol: "KSh" },
    { code: "KGS", description: "Kyrgyzstani Som", symbol: "лв" },
    { code: "KHR", description: "Cambodian Riel", symbol: "៛" },
    { code: "KID", description: "Kiribati Dollar", symbol: "$" },
    { code: "KMF", description: "Comorian Franc", symbol: "CF" },
    { code: "KRW", description: "South Korean Won", symbol: "₩" },
    { code: "KWD", description: "Kuwaiti Dinar", symbol: "د.ك" },
    { code: "KYD", description: "Cayman Islands Dollar", symbol: "CI$" },
    { code: "KZT", description: "Kazakhstani Tenge", symbol: "₸" },
    { code: "LAK", description: "Lao Kip", symbol: "₭" },
    { code: "LBP", description: "Lebanese Pound", symbol: "ل.ل" },
    { code: "LKR", description: "Sri Lankan Rupee", symbol: "Rs" },
    { code: "LRD", description: "Liberian Dollar", symbol: "L$" },
    { code: "LSL", description: "Lesotho Loti", symbol: "L" },
    { code: "LYD", description: "Libyan Dinar", symbol: "ل.د" },
    { code: "MAD", description: "Moroccan Dirham", symbol: "د.م." },
    { code: "MDL", description: "Moldovan Leu", symbol: "L" },
    { code: "MGA", description: "Malagasy Ariary", symbol: "Ar" },
    { code: "MKD", description: "Macedonian Denar", symbol: "ден" },
    { code: "MMK", description: "Myanmar Kyat", symbol: "K" },
    { code: "MNT", description: "Mongolian Tögrög", symbol: "₮" },
    { code: "MOP", description: "Macanese Pataca", symbol: "MOP$" },
    { code: "MRU", description: "Mauritanian Ouguiya", symbol: "UM" },
    { code: "MUR", description: "Mauritian Rupee", symbol: "Rs" },
    { code: "MVR", description: "Maldivian Rufiyaa", symbol: "Rf" },
    { code: "MWK", description: "Malawian Kwacha", symbol: "MK" },
    { code: "MXN", description: "Mexican Peso", symbol: "$" },
    { code: "MYR", description: "Malaysian Ringgit", symbol: "RM" },
    { code: "MZN", description: "Mozambican Metical", symbol: "MT" },
    { code: "NAD", description: "Namibian Dollar", symbol: "N$" },
    { code: "NGN", description: "Nigerian Naira", symbol: "₦" },
    { code: "NIO", description: "Nicaraguan Córdoba", symbol: "C$" },
    { code: "NOK", description: "Norwegian Krone", symbol: "kr" },
    { code: "NPR", description: "Nepalese Rupee", symbol: "Rs" },
    { code: "NZD", description: "New Zealand Dollar", symbol: "NZ$" },
    { code: "OMR", description: "Omani Rial", symbol: "﷼" },
    { code: "PAB", description: "Panamanian Balboa", symbol: "B/." },
    { code: "PEN", description: "Peruvian Sol", symbol: "S/" },
    { code: "PGK", description: "Papua New Guinean Kina", symbol: "K" },
    { code: "PHP", description: "Philippine Peso", symbol: "₱" },
    { code: "PKR", description: "Pakistani Rupee", symbol: "Rs" },
    { code: "PLN", description: "Polish Złoty", symbol: "zł" },
    { code: "PYG", description: "Paraguayan Guaraní", symbol: "₲" },
    { code: "QAR", description: "Qatari Riyal", symbol: "ر.ق" },
    { code: "RON", description: "Romanian Leu", symbol: "lei" },
    { code: "RSD", description: "Serbian Dinar", symbol: "дин." },
    { code: "RUB", description: "Russian Ruble", symbol: "₽" },
    { code: "RWF", description: "Rwandan Franc", symbol: "RF" },
    { code: "SAR", description: "Saudi Riyal", symbol: "ر.س" },
    { code: "SBD", description: "Solomon Islands Dollar", symbol: "SI$" },
    { code: "SCR", description: "Seychellois Rupee", symbol: "Rs" },
    { code: "SDG", description: "Sudanese Pound", symbol: "£" },
    { code: "SEK", description: "Swedish Krona", symbol: "kr" },
    { code: "SGD", description: "Singapore Dollar", symbol: "S$" },
    { code: "SHP", description: "Saint Helena Pound", symbol: "£" },
    { code: "SLE", description: "Sierra Leonean Leone", symbol: "Le" },
    { code: "SOS", description: "Somali Shilling", symbol: "Sh" },
    { code: "SRD", description: "Surinamese Dollar", symbol: "$" },
    { code: "SSP", description: "South Sudanese Pound", symbol: "£" },
    { code: "STN", description: "São Tomé and Príncipe Dobra", symbol: "Db" },
    { code: "SYP", description: "Syrian Pound", symbol: "£" },
    { code: "SZL", description: "Eswatini Lilangeni", symbol: "L" },
    { code: "THB", description: "Thai Baht", symbol: "฿" },
    { code: "TJS", description: "Tajikistani Somoni", symbol: "SM" },
    { code: "TMT", description: "Turkmenistani Manat", symbol: "m" },
    { code: "TND", description: "Tunisian Dinar", symbol: "د.ت" },
    { code: "TOP", description: "Tongan Paʻanga", symbol: "T$" },
    { code: "TRY", description: "Turkish Lira", symbol: "₺" },
    { code: "TTD", description: "Trinidad and Tobago Dollar", symbol: "TT$" },
    { code: "TVD", description: "Tuvaluan Dollar", symbol: "$" },
    { code: "TWD", description: "New Taiwan Dollar", symbol: "NT$" },
    { code: "TZS", description: "Tanzanian Shilling", symbol: "Sh" },
    { code: "UAH", description: "Ukrainian Hryvnia", symbol: "₴" },
    { code: "UGX", description: "Ugandan Shilling", symbol: "USh" },
    { code: "USD", description: "United States Dollar", symbol: "$" },
    { code: "UYU", description: "Uruguayan Peso", symbol: "$U" },
    { code: "UZS", description: "Uzbekistani So'm", symbol: "лв" },
    { code: "VES", description: "Venezuelan Bolívar", symbol: "Bs." },
    { code: "VND", description: "Vietnamese Đồng", symbol: "₫" },
    { code: "VUV", description: "Vanuatu Vatu", symbol: "Vt" },
    { code: "WST", description: "Samoan Tala", symbol: "T" },
    { code: "XAF", description: "Central African CFA Franc", symbol: "FCFA" },
    { code: "XCD", description: "East Caribbean Dollar", symbol: "EC$" },
    { code: "XOF", description: "West African CFA Franc", symbol: "CFA" },
    { code: "XPF", description: "CFP Franc", symbol: "₣" },
    { code: "YER", description: "Yemeni Rial", symbol: "﷼" },
    { code: "ZAR", description: "South African Rand", symbol: "R" },
    { code: "ZMW", description: "Zambian Kwacha", symbol: "ZK" },
    { code: "ZWL", description: "Zimbabwean Dollar", symbol: "Z$" }
  ];

  // Handle currency code input change with autocomplete
  const handleCurrencyCodeChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setNewCurrency({ ...newCurrency, code: upperValue });
    
    if (upperValue.length > 0) {
      const search = upperValue.trim();

      const rank = (curr: { code: string; description: string }, q: string) => {
        const code = curr.code.toUpperCase();
        const name = curr.description.toUpperCase();
        const codeIdx = code.indexOf(q);
        const nameIdx = name.indexOf(q);
        // Prefer what user is typing as text first (name prefix), then code.
        // This makes "SR" show "Sri..." before "Surinamese (SRD)".
        if (code === q) return 0;
        if (nameIdx === 0) return 10;
        if (codeIdx === 0) return 20;
        if (codeIdx > 0) return 20 + codeIdx;
        if (nameIdx > 0) return 100 + nameIdx;
        return 1000;
      };

      const filtered = currencyList
        .filter((curr) => {
          const code = curr.code.toUpperCase();
          const name = curr.description.toUpperCase();
          return code.includes(search) || name.includes(search);
        })
        .sort((a, b) => {
          const ra = rank(a, search);
          const rb = rank(b, search);
          if (ra !== rb) return ra - rb;
          return a.description.localeCompare(b.description);
        })
        .map((curr) => ({
          ...curr,
          countryCode: getCountryCodeForCurrency(curr.code),
        }));

      setFilteredCurrencies(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setShowDropdown(false);
      setFilteredCurrencies([]);
    }
  };

  // Handle currency selection from dropdown
  const handleCurrencySelect = (currency: {code: string, description: string, symbol: string, countryCode?: string}) => {
    setNewCurrency({
      ...newCurrency,
      code: currency.code,
      name: currency.description,
      symbol: currency.symbol
    });
    setShowDropdown(false);
    setFilteredCurrencies([]);
  };

  // Download Combined Template (Currency + Payment Methods)
  const downloadCombinedTemplate = () => {
    const wb = XLSX.utils.book_new();
    
    // Currency Sheet
    const currencyTemplateData = [
      {
        'Currency Code': 'USD',
        'Description': 'United States Dollar',
        'Symbol': '$',
        'Exchange Rate': '1.00'
      },
      {
        'Currency Code': 'EUR',
        'Description': 'Euro',
        'Symbol': '€',
        'Exchange Rate': '0.85'
      },
      {
        'Currency Code': 'GBP',
        'Description': 'British Pound Sterling',
        'Symbol': '£',
        'Exchange Rate': '0.73'
      }
    ];
    
    const wsCurrency = XLSX.utils.json_to_sheet(currencyTemplateData);
    wsCurrency['!cols'] = [
      { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCurrency, 'Currency');
    
    // Payment Methods Sheet
    const paymentTemplateData = [
      {
        'Title': 'Corporate Visa',
        'Type': 'Credit',
        'Description': 'Company credit card',
        'Icon': 'visa',
        'Manager': 'John Doe',
        'Expires At': '2025-12-31'
      },
      {
        'Title': 'Business PayPal',
        'Type': 'Digital Wallet',
        'Description': 'PayPal business account',
        'Icon': 'paypal',
        'Manager': 'Jane Smith',
        'Expires At': ''
      },
      {
        'Title': 'Company Bank Account',
        'Type': 'Bank Transfer',
        'Description': 'Primary business bank account',
        'Icon': 'bank',
        'Manager': 'Finance Team',
        'Expires At': ''
      }
    ];
    
    const wsPayment = XLSX.utils.json_to_sheet(paymentTemplateData);
    wsPayment['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, wsPayment, 'Payment Methods');
    
    XLSX.writeFile(wb, 'Configuration_Template.xlsx');
    
    toast({
      title: "Template Downloaded",
      description: "Excel template with Currency and Payment Methods sheets downloaded successfully",
      variant: "success",
    });
  };

  const exportCurrencies = () => {
    if (currencies.length === 0) {
      toast({ title: "No data to export", description: "Add currencies first before exporting", variant: "destructive" });
      return;
    }
    const wb = XLSX.utils.book_new();
    const currencyExportData = currencies.map(currency => ({
      'Currency Code': currency.code,
      'Description': currency.name,
      'Symbol': currency.symbol,
      'Exchange Rate': currency.exchangeRate || ''
    }));
    const ws = XLSX.utils.json_to_sheet(currencyExportData);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Currency');
    XLSX.writeFile(wb, `Currency_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Export Successful", description: `Exported ${currencies.length} currencies`, variant: "success" });
  };

  const importCurrencies = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        let success = 0, failed = 0;
        const errors: string[] = [];
        
        for (const row of jsonData) {
          try {
            const currencyCode = row['Currency Code'];
            
            // Check if currency already exists
            const existingCurrency = currencies.find(c => c.code === currencyCode);
            if (existingCurrency) {
              failed++;
              errors.push(`Currency ${currencyCode} already exists`);
              continue;
            }
            
            const currencyData = {
              code: currencyCode,
              name: row['Description'],
              symbol: row['Symbol'],
              exchangeRate: row['Exchange Rate'] || '1.00'
            };
            
            const res = await fetch(`${API_BASE_URL}/api/currencies`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(currencyData)
            });
            
            if (res.ok) {
              success++;
            } else {
              failed++;
              errors.push(`Failed to import ${currencyCode}`);
            }
          } catch { 
            failed++;
            errors.push(`Error importing currency`);
          }
        }
        
        await fetchCurrencies();
        
        if (errors.length > 0) {
          toast({ 
            title: "Import Complete with Errors", 
            description: `${success} success, ${failed} failed. ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`, 
            variant: failed > 0 ? "destructive" : "success" 
          });
        } else {
          toast({ title: "Import Complete", description: `${success} currencies imported successfully`, variant: "success" });
        }
      } catch {
        toast({ title: "Import Failed", description: "Failed to parse file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (currencyFileInputRef.current) currencyFileInputRef.current.value = '';
  };

  // Individual Payment Methods Functions
  const downloadPaymentTemplate = () => {
    const wb = XLSX.utils.book_new();
    const paymentTemplateData = [
      { 'Title': 'Corporate Visa', 'Type': 'Credit', 'Description': 'Company credit card', 'Manager': 'John Doe', 'Expires At': '2025-12-31' }
    ];
    const ws = XLSX.utils.json_to_sheet(paymentTemplateData);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Methods');
    XLSX.writeFile(wb, 'Payment_Methods_Template.xlsx');
    toast({ title: "Template Downloaded", description: "Payment methods template downloaded successfully", variant: "success" });
  };

  const exportPaymentMethods = () => {
    if (paymentMethods.length === 0) {
      toast({ title: "No data to export", description: "Add payment methods first before exporting", variant: "destructive" });
      return;
    }
    const wb = XLSX.utils.book_new();
    const paymentExportData = paymentMethods.map(method => ({
      'Title': method.name || method.title,
      'Type': method.type,
      'Description': method.description || '',
      'Manager': method.manager || '',
      'Expires At': method.expiresAt || ''
    }));
    const ws = XLSX.utils.json_to_sheet(paymentExportData);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Methods');
    XLSX.writeFile(wb, `Payment_Methods_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Export Successful", description: `Exported ${paymentMethods.length} payment methods`, variant: "success" });
  };

  const importPaymentMethods = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        let success = 0, failed = 0;
        const errors: string[] = [];
        
        for (const row of jsonData) {
          try {
            const paymentTitle = row['Title'];
            
            // Check if payment method with same name already exists
            const existingPayment = paymentMethods.find(
              p => (p.name?.toLowerCase().trim() === paymentTitle?.toLowerCase().trim()) ||
                   (p.title?.toLowerCase().trim() === paymentTitle?.toLowerCase().trim())
            );
            
            if (existingPayment) {
              failed++;
              errors.push(`Payment method "${paymentTitle}" already exists`);
              continue;
            }
            
            const paymentData = {
              name: paymentTitle,
              type: row['Type'],
              description: row['Description'] || '',
              manager: row['Manager'] || '',
              expiresAt: row['Expires At'] || ''
            };
            
            const res = await fetch(`${API_BASE_URL}/api/payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(paymentData)
            });
            
            if (res.ok) {
              success++;
            } else {
              failed++;
              errors.push(`Failed to import "${paymentTitle}"`);
            }
          } catch { 
            failed++;
            errors.push(`Error importing payment method`);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
        
        if (errors.length > 0) {
          toast({ 
            title: "Import Complete with Errors", 
            description: `${success} success, ${failed} failed. ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`, 
            variant: failed > 0 ? "destructive" : "success" 
          });
        } else {
          toast({ title: "Import Complete", description: `${success} payment methods imported successfully`, variant: "success" });
        }
      } catch {
        toast({ title: "Import Failed", description: "Failed to parse file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (paymentFileInputRef.current) paymentFileInputRef.current.value = '';
  };

  // OPTIMIZED: Use React Query for currencies
  const { data: currenciesData = [], isLoading: currenciesLoading } = useQuery({
    queryKey: ["/api/currencies"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/currencies`, { credentials: "include" });
      return res.json();
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true, // Always refetch when component mounts
  });
  
  // OPTIMIZED: Fetch latest exchange rates in a single batch call
  const { data: exchangeRatesMap = {} } = useQuery({
    queryKey: ["/api/exchange-rates/batch"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/exchange-rates/batch/latest`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });
  
  // Combine currencies with their latest rates
  const currencies = Array.isArray(currenciesData) 
    ? currenciesData.map(currency => ({
        ...currency,
        latestRate: exchangeRatesMap[currency.code]?.rate || '-'
      }))
    : [];

  // Handle secure-link openToken for Configuration edit modals
  useEffect(() => {
    const openToken = searchParams.get('openToken');
    if (!openToken) return;

    const clearTokenFromUrl = (tab: string) => {
      const t = tab || 'currency';
      navigate(`/configuration?tab=${encodeURIComponent(t)}`, { replace: true });
    };

    void (async () => {
      try {
        const qs = new URLSearchParams({ token: String(openToken) }).toString();
        const res = await fetch(`/api/deeplink/resolve?${qs}`, { credentials: 'include' });
        if (!res.ok) {
          clearTokenFromUrl(searchParams.get('tab') || 'currency');
          return;
        }
        const data = (await res.json()) as { entityType?: string; id?: string };
        const entityType = String(data?.entityType ?? '').trim();
        const id = String(data?.id ?? '').trim();
        if (!entityType || !id) {
          clearTokenFromUrl(searchParams.get('tab') || 'currency');
          return;
        }

        if (entityType === 'paymentMethod') {
          localStorage.setItem('openPaymentMethods', 'true');
          localStorage.setItem('openPaymentId', id);
          setActiveTab('payment');
          clearTokenFromUrl('payment');
          return;
        }

        if (entityType === 'currency') {
          setPendingCurrencyCodeToOpen(id);
          setActiveTab('currency');
          clearTokenFromUrl('currency');
          return;
        }

        clearTokenFromUrl(searchParams.get('tab') || 'currency');
      } catch {
        clearTokenFromUrl(searchParams.get('tab') || 'currency');
      }
    })();
  }, [searchParams, navigate]);

  // Auto-open Add Payment Method modal when deep-linked via URL: /configuration?tab=payment&addPayment=1
  useEffect(() => {
    const addPayment = searchParams.get('addPayment');
    if (addPayment !== '1') return;

    setActiveTab('payment');
    setAddPaymentModalOpen(true);
    navigate('/configuration?tab=payment', { replace: true });
  }, [searchParams, navigate]);

  // Open currency edit modal from resolved token
  useEffect(() => {
    if (!pendingCurrencyCodeToOpen) return;
    const code = String(pendingCurrencyCodeToOpen).toUpperCase().trim();
    if (!code) return;

    const match = currencies.find((c: any) => String(c?.code ?? '').toUpperCase().trim() === code);
    if (!match) return;

    setNewCurrency({
      name: match.name || '',
      code: match.code || '',
      symbol: match.symbol || '',
      isoNumber: '',
      exchangeRate: match.exchangeRate || '',
      visible: match.visible,
      created: match.created || '',
    });
    setIsEditMode(true);
    setAddCurrencyOpen(true);
    setPendingCurrencyCodeToOpen(null);

    requestAnimationFrame(() => {
      void setSecureUrlForConfigEditModal('currency', 'currency', code);
    });
  }, [pendingCurrencyCodeToOpen, currencies]);
  
  const [companyInfo, setCompanyInfo] = useState<{ defaultCurrency?: string }>({});
  
  // Fetch company info on mount
  useEffect(() => {
    fetchCompanyInfo();
  }, []);
  
  const fetchCurrencies = async () => {
    // React Query: refetch immediately so tables reflect updates right away.
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["/api/currencies"] }),
      queryClient.refetchQueries({ queryKey: ["/api/exchange-rates/batch"] }),
    ]);
  };
  
  const fetchCompanyInfo = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/company-info`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCompanyInfo(data);
      }
    } catch (error) {
      console.error("Error fetching company info:", error);
    }
  };
  
  // Note: visibility toggles removed from UI; endpoints kept server-side if needed.
  
  // Add/Update currency handler
  const addNewCurrency = async () => {
    if (
      newCurrency.name.trim() &&
      newCurrency.code.trim() &&
      newCurrency.symbol.trim() &&
      (isEditMode || !currencies.find(c => c.code.toLowerCase() === newCurrency.code.toLowerCase()))
    ) {
      try {
        const method = isEditMode ? "PUT" : "POST";
        const url = isEditMode 
          ? `${API_BASE_URL}/api/currencies/${newCurrency.code.toUpperCase()}` 
          : `${API_BASE_URL}/api/currencies`;
          
        const res = await fetch(url, {
          method: method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: newCurrency.name.trim(),
            code: newCurrency.code.trim().toUpperCase(),
            symbol: newCurrency.symbol.trim(),
            isoNumber: newCurrency.isoNumber.trim(),
            exchangeRate: newCurrency.exchangeRate.trim(),
          }),
        });
        
        if (res.ok) {
          await res.json();
          await fetchCurrencies(); // Refresh the list
          setNewCurrency({
            name: '',
            code: '',
            symbol: '',
            isoNumber: '',
            exchangeRate: '',
            visible: true,
            created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
          });
          setIsEditMode(false);
          restoreModalUrlIfNeeded();
          setAddCurrencyOpen(false);
          toast({
            title: isEditMode ? "Currency Updated" : "Currency Added",
            description: `${newCurrency.name} currency has been ${isEditMode ? 'updated' : 'added'} successfully`,
            variant: "success",
          });
        } else {
          const error = await res.json();
          toast({
            title: "Error",
            description: error.message || `Failed to ${isEditMode ? 'update' : 'add'} currency`,
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to ${isEditMode ? 'update' : 'add'} currency`,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields and ensure currency code is unique",
        variant: "destructive",
      });
    }
  };
  
  // Delete currency handler
  const deleteCurrency = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/currencies/${code}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (res.ok) {
        await fetchCurrencies(); // Refresh the list
        toast({
          title: "Currency Deleted",
          description: `Currency with code ${code} has been deleted.`,
          variant: "destructive",
        });
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.message || "Failed to delete currency",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete currency",
        variant: "destructive",
      });
    }
  };

  // Currency delete confirmation dialog state
  const [currencyDeleteOpen, setCurrencyDeleteOpen] = useState(false);
  const [currencyToDelete, setCurrencyToDelete] = useState<{ code: string; name?: string; inUseCount: number } | null>(null);
  const [openCurrencyActionsMenuForCode, setOpenCurrencyActionsMenuForCode] = useState<string | null>(null);

  // Update currency rates handler
  const updateCurrencyRates = async () => {
    if (isUpdatingCurrencyRates) return;
    setIsUpdatingCurrencyRates(true);
    try {
      const currentTimestamp = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      });

      const currentRatesByCode = new Map(
        currencies
          .filter((c: any) => c?.code)
          .map((c: any) => [String(c.code).toUpperCase().trim(), c.exchangeRate])
      );

      const invalidInputs: string[] = [];
      const updatesToSend = Object.entries(editingRates)
        .map(([codeRaw, rateRaw]) => {
          const code = String(codeRaw || '').toUpperCase().trim();
          const rateStr = String(rateRaw ?? '').trim();
          if (!code) return null;

          // Skip empty values (treat as unchanged)
          if (!rateStr) return null;

          const rateNum = Number(rateStr);
          if (!Number.isFinite(rateNum) || rateNum <= 0) {
            invalidInputs.push(code);
            return null;
          }

          const currentNum = Number(currentRatesByCode.get(code));
          if (Number.isFinite(currentNum) && Math.abs(rateNum - currentNum) < 1e-12) {
            return null; // unchanged
          }

          return { code, rateNum };
        })
        .filter(Boolean) as Array<{ code: string; rateNum: number }>;

      if (invalidInputs.length > 0) {
        toast({
          title: "Invalid exchange rate",
          description: `Please enter a valid number for: ${invalidInputs.slice(0, 8).join(", ")}${invalidInputs.length > 8 ? "…" : ""}`,
          variant: "destructive",
        });
        return;
      }

      if (updatesToSend.length === 0) {
        toast({
          title: "No changes",
          description: "No currency rates were changed.",
          variant: "success",
        });
        setIsUpdateMode(false);
        setEditingRates({});
        return;
      }

      const failedCodes: string[] = [];

      // Run sequentially to avoid overwhelming the server and reduce flakiness.
      for (const { code, rateNum } of updatesToSend) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch(`${API_BASE_URL}/api/currencies/${code}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({
              exchangeRate: rateNum,
              lastUpdated: currentTimestamp,
            }),
          });
          if (!res.ok) failedCodes.push(code);
        } catch {
          failedCodes.push(code);
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      // Always refresh list so the UI reflects any successful updates immediately.
      await fetchCurrencies();

      if (failedCodes.length === 0) {
        setIsUpdateMode(false);
        setEditingRates({});
        toast({
          title: "Currency Rates Updated",
          description: "All changed currency rates have been updated successfully",
          variant: "success",
        });
      } else {
        toast({
          title: "Partial Update",
          description: `Failed to update: ${failedCodes.slice(0, 8).join(", ")}${failedCodes.length > 8 ? "…" : ""}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update currency rates",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingCurrencyRates(false);
    }
  };

  // Handle rate change in edit mode
  const handleRateChange = (code: string, value: string) => {
    setEditingRates(prev => ({
      ...prev,
      [code]: value
    }));
  };

  // Initialize editing rates when entering update mode
  const enterUpdateMode = () => {
    const initialRates: { [key: string]: string } = {};
    currencies.forEach(currency => {
      initialRates[currency.code] = currency.exchangeRate || '';
    });
    setEditingRates(initialRates);
    setIsUpdateMode(true);
  };

  // Cancel update mode
  const cancelUpdateMode = () => {
    setIsUpdateMode(false);
    setEditingRates({});
  };
  
  // Currency state is already defined above
  
  // Field Enablement state - now fully dynamic
  const [fields, setFields] = useState<any[]>([]); // Initialize as empty array
  const [newFieldName, setNewFieldName] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Loading state
  
  // Compliance Fields state
  const [complianceFields, setComplianceFields] = useState<any[]>([]);
  const [newComplianceFieldName, setNewComplianceFieldName] = useState('');
  const [isLoadingCompliance, setIsLoadingCompliance] = useState(true);

  // Renewal Fields state
  const [renewalFields, setRenewalFields] = useState<any[]>([]);
  const [newRenewalFieldName, setNewRenewalFieldName] = useState('');
  const [isLoadingRenewal, setIsLoadingRenewal] = useState(true);

  const MAX_CUSTOM_FIELDS = 4;

  const [customFieldErrorOpen, setCustomFieldErrorOpen] = useState(false);
  const [customFieldErrorMessage, setCustomFieldErrorMessage] = useState('');

  type CustomFieldDeleteTarget =
    | { kind: 'subscription'; name: string }
    | { kind: 'compliance'; id: string; name: string }
    | { kind: 'renewal'; id: string; name: string };

  const [customFieldDeleteConfirmOpen, setCustomFieldDeleteConfirmOpen] = useState(false);
  const [customFieldPendingDelete, setCustomFieldPendingDelete] = useState<CustomFieldDeleteTarget | null>(null);

  const showCustomFieldError = (message: string) => {
    setCustomFieldErrorMessage(message);
    setCustomFieldErrorOpen(true);
  };

  const requestDeleteCustomField = (target: CustomFieldDeleteTarget) => {
    setCustomFieldPendingDelete(target);
    setCustomFieldDeleteConfirmOpen(true);
  };
  
  // Fetch enabled fields from backend on mount
  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/config/fields`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch fields');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setFields(data);
        } else {
          setFields([]);
          toast({
            title: "Data Format Error",
            description: "Received invalid field data from server",
            variant: "destructive",
          });
        }
      })
      .catch(error => {
        console.error("Error fetching fields:", error);
        setFields([]);
        toast({
          title: "Error",
          description: "Failed to load field configuration",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoading(false));
  }, []);
  
  // Fetch compliance fields from backend on mount (new API)
  useEffect(() => {
    setIsLoadingCompliance(true);
    fetch(`${API_BASE_URL}/api/config/compliance-fields`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch compliance fields');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setComplianceFields(data);
        } else {
          setComplianceFields([]);
          toast({
            title: "Data Format Error",
            description: "Received invalid compliance field data from server",
            variant: "destructive",
          });
        }
      })
      .catch(error => {
        console.error("Error fetching compliance fields:", error);
        setComplianceFields([]);
        toast({
          title: "Error",
          description: "Failed to load compliance field configuration",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoadingCompliance(false));
  }, []);

  // Fetch renewal fields from backend on mount
  useEffect(() => {
    setIsLoadingRenewal(true);
    fetch(`${API_BASE_URL}/api/config/renewal-fields`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch renewal fields');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setRenewalFields(data);
        } else {
          setRenewalFields([]);
          toast({
            title: "Data Format Error",
            description: "Received invalid renewal field data from server",
            variant: "destructive",
          });
        }
      })
      .catch(error => {
        console.error("Error fetching renewal fields:", error);
        setRenewalFields([]);
        toast({
          title: "Error",
          description: "Failed to load renewal field configuration",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoadingRenewal(false));
  }, []);

  const addNewField = async () => {
    const name = newFieldName.trim();
    if (!name) return;

    if (fields.length >= MAX_CUSTOM_FIELDS) {
      showCustomFieldError(`Only ${MAX_CUSTOM_FIELDS} fields are allowed. Delete a field to add a new one.`);
      return;
    }

    if (fields.find(f => String(f?.name ?? '').toLowerCase() === name.toLowerCase())) {
      showCustomFieldError(`"${name}" already exists. Please use a different name.`);
      return;
    }

    const previousFields = fields;
    const updatedFields = [...previousFields, { name, enabled: true }];
    setFields(updatedFields);
    setNewFieldName('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fields: updatedFields }),
      });
      if (!response.ok) throw new Error('Failed to save fields');

      const fetchRes = await fetch(`${API_BASE_URL}/api/config/fields`, { credentials: 'include' });
      const data = await fetchRes.json();
      setFields(Array.isArray(data) ? data : updatedFields);
      toast({
        title: "Field Added",
        description: `${name} field has been added successfully`,
        variant: "success",
      });
    } catch {
      showCustomFieldError('Failed to save the new field. Please try again.');
      try {
        const fetchRes = await fetch(`${API_BASE_URL}/api/config/fields`, { credentials: 'include' });
        const data = await fetchRes.json();
        setFields(Array.isArray(data) ? data : previousFields);
      } catch {
        setFields(previousFields);
      }
    }
  };

  const addNewComplianceField = async () => {
    const name = newComplianceFieldName.trim();
    if (!name) return;

    if (complianceFields.length >= MAX_CUSTOM_FIELDS) {
      showCustomFieldError(`Only ${MAX_CUSTOM_FIELDS} fields are allowed. Delete a field to add a new one.`);
      return;
    }

    if (complianceFields.find(f => String(f?.name ?? '').toLowerCase() === name.toLowerCase())) {
      showCustomFieldError(`"${name}" already exists. Please use a different name.`);
      return;
    }

    setIsLoadingCompliance(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/compliance-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          enabled: true,
          fieldType: 'compliance',
        }),
      });
      if (!response.ok) throw new Error('Failed to save compliance field');
      setNewComplianceFieldName('');

      const fetchRes = await fetch(`${API_BASE_URL}/api/config/compliance-fields`, { credentials: 'include' });
      const data = await fetchRes.json();
      setComplianceFields(Array.isArray(data) ? data : []);
      toast({
        title: "Compliance Field Added",
        description: `${name} field has been added successfully`,
        variant: "success",
      });
    } catch {
      showCustomFieldError('Failed to save the new field. Please try again.');
    } finally {
      setIsLoadingCompliance(false);
    }
  };

  const addNewRenewalField = async () => {
    const name = newRenewalFieldName.trim();
    if (!name) return;

    if (renewalFields.length >= MAX_CUSTOM_FIELDS) {
      showCustomFieldError(`Only ${MAX_CUSTOM_FIELDS} fields are allowed. Delete a field to add a new one.`);
      return;
    }

    if (renewalFields.find(f => String(f?.name ?? '').toLowerCase() === name.toLowerCase())) {
      showCustomFieldError(`"${name}" already exists. Please use a different name.`);
      return;
    }

    setIsLoadingRenewal(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/renewal-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          enabled: true,
          fieldType: 'renewal',
        }),
      });
      if (!response.ok) throw new Error('Failed to save renewal field');
      setNewRenewalFieldName('');
      const fetchRes = await fetch(`${API_BASE_URL}/api/config/renewal-fields`, { credentials: 'include' });
      const data = await fetchRes.json();
      setRenewalFields(Array.isArray(data) ? data : []);
      toast({
        title: "Renewal Field Added",
        description: `${name} field has been added successfully`,
        variant: "success",
      });
    } catch {
      showCustomFieldError('Failed to save the new field. Please try again.');
    } finally {
      setIsLoadingRenewal(false);
    }
  };

  const updateFieldEnablement = (fieldName: string, enabled: boolean) => {
    setFields(prev => prev.map(f => (f.name === fieldName ? { ...f, enabled } : f)));
  };

  const updateComplianceFieldEnablement = async (fieldName: string, enabled: boolean) => {
    const field = complianceFields.find(f => f.name === fieldName);
    if (!field || !field._id) return;
    setIsLoadingCompliance(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/compliance-fields/${field._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Failed to update compliance field');

      const fetchRes = await fetch(`${API_BASE_URL}/api/config/compliance-fields`, { credentials: 'include' });
      const data = await fetchRes.json();
      setComplianceFields(Array.isArray(data) ? data : complianceFields);
    } catch {
      showCustomFieldError('Failed to update the field. Please try again.');
    } finally {
      setIsLoadingCompliance(false);
    }
  };

  const updateRenewalFieldEnablement = async (fieldId: string, enabled: boolean) => {
    if (!fieldId) return;
    setIsLoadingRenewal(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/renewal-fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Failed to update renewal field');

      const fetchRes = await fetch(`${API_BASE_URL}/api/config/renewal-fields`, { credentials: 'include' });
      const data = await fetchRes.json();
      setRenewalFields(Array.isArray(data) ? data : renewalFields);
    } catch {
      showCustomFieldError('Failed to update the field. Please try again.');
    } finally {
      setIsLoadingRenewal(false);
    }
  };
  
  // Note: unused bulk-save helpers removed.
  
  // Delete field from backend
  const deleteField = async (fieldName: string) => {
    const updatedFields = fields.filter(f => f.name !== fieldName);
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fields: updatedFields }),
      });
      if (!response.ok) throw new Error('Failed to delete field');

      const fetchRes = await fetch(`${API_BASE_URL}/api/config/fields`, { credentials: 'include' });
      const data = await fetchRes.json();
      setFields(Array.isArray(data) ? data : updatedFields);
      toast({
        title: "Field Deleted",
        description: `${fieldName} field has been deleted successfully`,
        variant: "destructive",
      });
    } catch {
      showCustomFieldError('Failed to delete the field. Please try again.');
    }
  };
  
  // Delete compliance field using DELETE (new API, by _id)
  const deleteComplianceField = async (fieldNameOrId: string) => {
    // Try to find by _id first, fallback to name for legacy UI
    let field = complianceFields.find(f => f._id === fieldNameOrId);
    if (!field) field = complianceFields.find(f => f.name === fieldNameOrId);
    if (!field || !field._id) {
      showCustomFieldError('Cannot delete this field right now. Please refresh the page and try again.');
      return;
    }
    setIsLoadingCompliance(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/compliance-fields/${field._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete compliance field');
      // Refetch
      const fetchRes = await fetch(`${API_BASE_URL}/api/config/compliance-fields`, { credentials: 'include' });
      const data = await fetchRes.json();
      setComplianceFields(Array.isArray(data) ? data : complianceFields);
      toast({
        title: "Compliance Field Deleted",
        description: `${field.name} field has been deleted successfully`,
        variant: "destructive",
      });
    } catch {
      showCustomFieldError('Failed to delete the field. Please try again.');
    } finally {
      setIsLoadingCompliance(false);
    }
  };

  // Delete renewal field using DELETE (by _id)
  const deleteRenewalField = async (fieldId: string) => {
    if (!fieldId) return;
    const field = renewalFields.find(f => f._id === fieldId);
    setIsLoadingRenewal(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/renewal-fields/${fieldId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete renewal field');
      const fetchRes = await fetch(`${API_BASE_URL}/api/config/renewal-fields`, { credentials: 'include' });
      const data = await fetchRes.json();
      setRenewalFields(Array.isArray(data) ? data : renewalFields);
      toast({
        title: "Renewal Field Deleted",
        description: `${field?.name || 'Field'} has been deleted successfully`,
        variant: "destructive",
      });
    } catch {
      showCustomFieldError('Failed to delete the field. Please try again.');
    } finally {
      setIsLoadingRenewal(false);
    }
  };
  
  // (Removed) Demo credit card details state
  
  // Deprecated demo handlers removed
  
  // --- Payment Method Modal State ---
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [isAddPaymentFullscreen, setIsAddPaymentFullscreen] = useState(false);
  const [isEditPaymentFullscreen, setIsEditPaymentFullscreen] = useState(false);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    title: '',
    type: '',
    owner: '',
    manager: '',
    expiresAt: '',
    financialInstitution: '',
    lastFourDigits: '',
  });

  // Handler for adding a new payment method (POST to backend)
  function handleAddPaymentMethod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paymentForm.title.trim() || !paymentForm.type.trim()) return;

    // Check for duplicate payment method name
    const duplicateName = paymentMethods.find(
      method => method.name?.toLowerCase().trim() === paymentForm.title.toLowerCase().trim() ||
                method.title?.toLowerCase().trim() === paymentForm.title.toLowerCase().trim()
    );

    if (duplicateName) {
      setValidationErrorMessage(`A payment method with the name "${paymentForm.title}" already exists. Please use a different name.`);
      setValidationErrorOpen(true);
      return;
    }

    // Validate expiry date is not in the past
    if (paymentForm.expiresAt) {
      const [year, month] = paymentForm.expiresAt.split('-');
      const expiryDate = new Date(parseInt(year), parseInt(month) - 1); // month is 0-indexed
      const today = new Date();
      today.setDate(1); // Set to first day of current month for comparison
      today.setHours(0, 0, 0, 0);

      if (expiryDate < today) {
        setValidationErrorMessage("Card expiry date cannot be in the past");
        setValidationErrorOpen(true);
        return;
      }
    }

    fetch("/api/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: paymentForm.title,
        type: paymentForm.type,
        owner: paymentForm.owner,
        manager: paymentForm.manager,
        expiresAt: paymentForm.expiresAt,
        financialInstitution: paymentForm.financialInstitution,
        lastFourDigits: paymentForm.lastFourDigits,
      }),
    })
      .then(res => res.json())
      .then(() => {
        // Close modal and show toast immediately
        closeAddPaymentModalNow();
        toast({ title: 'Payment method added', description: 'A new payment method has been added.' });

        // Only use queryClient to invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
      });
  }

  // Tab-level secure URL for Configuration (Currency tab only)
  useEffect(() => {
    const isBlocking =
      editPaymentModalOpen ||
      addPaymentModalOpen ||
      paymentSubsModalOpen ||
      deleteConfirmOpen ||
      validationErrorOpen ||
      addCurrencyOpen ||
      currencyDeleteOpen ||
      importConfirmOpen ||
      currencyImportConfirmOpen ||
      paymentImportConfirmOpen ||
      exitConfirmOpen;

    if (isBlocking) return;

    if (activeTab === 'currency') {
      if (lastSecuredTabRef.current === 'currency' && window.location.pathname.startsWith('/s/')) return;
      lastSecuredTabRef.current = 'currency';
      void setSecureUrlForConfigTab('currency');
      return;
    }

    // Leaving Currency tab: ensure URL is not stuck on old /s/<token>
    if (window.location.pathname.startsWith('/s/')) {
      const next = `/configuration?tab=${encodeURIComponent(activeTab || 'currency')}`;
      window.history.replaceState(window.history.state, '', next);
    }
    lastSecuredTabRef.current = activeTab;
  }, [
    activeTab,
    editPaymentModalOpen,
    addPaymentModalOpen,
    paymentSubsModalOpen,
    deleteConfirmOpen,
    validationErrorOpen,
    addCurrencyOpen,
    currencyDeleteOpen,
    importConfirmOpen,
    currencyImportConfirmOpen,
    paymentImportConfirmOpen,
    exitConfirmOpen,
  ]);

  const isPaymentDirty = () => {
    if (!paymentSnapshotRef.current) return false;
    return JSON.stringify(paymentForm) !== paymentSnapshotRef.current;
  };

  const closeAddPaymentModalNow = () => {
    restoreModalUrlIfNeeded();
    setAddPaymentModalOpen(false);
    setIsAddPaymentFullscreen(false);
    setPaymentForm({
      title: '',
      type: '',
      owner: '',
      manager: '',
      expiresAt: '',
      financialInstitution: '',
      lastFourDigits: '',
    });
    setPmOwnerSearch('');
    setPmManagerSearch('');
    paymentSnapshotRef.current = '';
  };

  // When the Add Payment Method modal is opened, update the URL to a secure token.
  useEffect(() => {
    if (!addPaymentModalOpen) return;
    void setSecureUrlForConfigAddPaymentModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPaymentModalOpen]);

  const closeEditPaymentModalNow = () => {
    closeEditPaymentModal();
    setIsEditPaymentFullscreen(false);
    setEditingPaymentId(null);
    paymentSnapshotRef.current = '';
  };

  // Payment Method tab: Category-style dropdowns for Owner / Managed by
  const [pmOwnerOpen, setPmOwnerOpen] = useState(false);
  const [pmOwnerSearch, setPmOwnerSearch] = useState('');
  const pmOwnerDropdownRef = useRef<HTMLDivElement>(null);
  const [pmManagerOpen, setPmManagerOpen] = useState(false);
  const [pmManagerSearch, setPmManagerSearch] = useState('');
  const pmManagerDropdownRef = useRef<HTMLDivElement>(null);

  const [paymentMethodsView, setPaymentMethodsView] = useState<'tiles' | 'table'>('tiles');

  useEffect(() => {
    if (!pmOwnerOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (pmOwnerDropdownRef.current && !pmOwnerDropdownRef.current.contains(event.target as Node)) {
        setPmOwnerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pmOwnerOpen]);

  useEffect(() => {
    if (!pmManagerOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (pmManagerDropdownRef.current && !pmManagerDropdownRef.current.contains(event.target as Node)) {
        setPmManagerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pmManagerOpen]);

  useEffect(() => {
    if (addPaymentModalOpen || editPaymentModalOpen) {
      setPmOwnerSearch(paymentForm.owner || '');
      setPmManagerSearch(paymentForm.manager || '');
    }
  }, [addPaymentModalOpen, editPaymentModalOpen]);
  

  
  return (
    <div className="h-full bg-gray-50 flex flex-col min-h-0 overflow-hidden">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-h-0">
        {/* Import Confirm Dialog (Configuration Excel) */}
        <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
          <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
            <AlertDialogHeader>
              <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
              <AlertDialogDescription>
                Select Yes to choose a file. Select No to download the template.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                onClick={() => {
                  downloadCombinedTemplate();
                  setImportConfirmOpen(false);
                }}
              >
                No
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => {
                  setImportConfirmOpen(false);
                  setTimeout(() => currencyFileInputRef.current?.click(), 0);
                }}
              >
                Yes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Exit Confirmation Dialog */}
        <AlertDialog open={exitConfirmOpen} onOpenChange={(open) => !open && setExitConfirmOpen(false)}>
          <AlertDialogContent className="sm:max-w-[460px] bg-white border border-gray-200 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Confirm Exit
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-700 font-medium">
                All filled data will be deleted if you exit. Do you want to cancel or exit?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setExitConfirmOpen(false);
                  exitConfirmActionRef.current = null;
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setExitConfirmOpen(false);
                  const action = exitConfirmActionRef.current;
                  exitConfirmActionRef.current = null;
                  action?.();
                }}
                className="bg-red-600 hover:bg-red-700 text-white shadow-md px-6 py-2"
              >
                Exit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6 flex flex-col flex-1 min-h-0">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                  <TabsContent value="currency" className="mt-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="p-0 bg-transparent border-0 shadow-none h-full flex flex-col">
                        {/* ── Currency Section Header ── */}
                        <div className="sticky top-0 z-10 bg-gray-50 pb-4 mb-4">
                          <div className="flex flex-wrap justify-between items-center gap-4">

                            {/* Left: icon + title + local currency chip */}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-indigo-600">
                                <DollarSign className="w-5 h-5 text-white" />
                              </div>
                              <h2 className="text-2xl font-extrabold text-gray-900 leading-tight tracking-tight">Currency Management</h2>

                              {/* Local Currency chip — no border, soft background */}
                              {companyInfo.defaultCurrency && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50">
                                  {getCountryCodeForCurrency(companyInfo.defaultCurrency) && (
                                    <ReactCountryFlag
                                      svg
                                      countryCode={getCountryCodeForCurrency(companyInfo.defaultCurrency)!}
                                      style={{ width: '1.4rem', height: '1.4rem', borderRadius: '4px' }}
                                    />
                                  )}
                                  <div className="leading-none">
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Local Currency</p>
                                    <p className="text-sm font-bold text-indigo-700 mt-0.5">
                                      {companyInfo.defaultCurrency}
                                      {currencies.find(c => c.code === companyInfo.defaultCurrency)?.symbol && (
                                        <span className="ml-1 text-indigo-400 font-medium text-xs">
                                          ({currencies.find(c => c.code === companyInfo.defaultCurrency)?.symbol})
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right: controls */}
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Data Management Dropdown */}
                              <input
                                ref={currencyFileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={importCurrencies}
                                className="hidden"
                              />
                              <Select
                                key={currencyDataManagementSelectKey}
                                onValueChange={(value) => {
                                  if (value === 'export') {
                                    exportCurrencies();
                                  } else if (value === 'import') {
                                    setCurrencyImportConfirmOpen(true);
                                  }
                                  setCurrencyDataManagementSelectKey((k) => k + 1);
                                }}
                              >
                                <SelectTrigger className="w-44 bg-gray-100 border-0 text-gray-700 hover:bg-gray-200 font-medium transition-all duration-200 rounded-xl h-10 text-sm shadow-none">
                                  <SelectValue placeholder="Import/Export" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="import" className="cursor-pointer">
                                    <div className="flex items-center">
                                      <Upload className="h-4 w-4 mr-2" />
                                      Import
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="export" className="cursor-pointer">
                                    <div className="flex items-center">
                                      <Download className="h-4 w-4 mr-2" />
                                      Export
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Action Buttons */}
                              {isUpdateMode ? (
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={cancelUpdateMode}
                                    disabled={isUpdatingCurrencyRates}
                                    className="h-10 px-5 rounded-xl border-0 bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold text-sm shadow-none"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={updateCurrencyRates}
                                    disabled={isUpdatingCurrencyRates}
                                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-200 disabled:opacity-60 disabled:pointer-events-none text-sm border-0"
                                  >
                                    {isUpdatingCurrencyRates ? "Saving..." : "Save Changes"}
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={enterUpdateMode}
                                    disabled={currencies.length === 0}
                                    className="h-10 px-5 rounded-xl border-0 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-sm shadow-none"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Update Rates
                                  </Button>
                                  <Button
                                    className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200 text-sm border-0"
                                    onClick={() => {
                                      setIsEditMode(false);
                                      setAddCurrencyOpen(true);
                                    }}
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Currency
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <Dialog open={addCurrencyOpen} onOpenChange={(open) => {
                          if (open) {
                            currencySnapshotRef.current = JSON.stringify(newCurrency);
                            setAddCurrencyOpen(true);
                            return;
                          }

                          const isDirty = !!currencySnapshotRef.current && JSON.stringify(newCurrency) !== currencySnapshotRef.current;
                          if (isDirty) {
                            requestExitConfirm(() => {
                              restoreModalUrlIfNeeded();
                              setNewCurrency({
                                name: '',
                                code: '',
                                symbol: '',
                                isoNumber: '',
                                exchangeRate: '',
                                visible: true,
                                created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                              });
                              setIsEditMode(false);
                              setAddCurrencyOpen(false);
                              currencySnapshotRef.current = '';
                            });
                            setAddCurrencyOpen(true);
                            return;
                          }

                          // Reset form when modal closes
                          restoreModalUrlIfNeeded();
                          setNewCurrency({
                            name: '',
                            code: '',
                            symbol: '',
                            isoNumber: '',
                            exchangeRate: '',
                            visible: true,
                            created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                          });
                          setIsEditMode(false);
                          setAddCurrencyOpen(false);
                          currencySnapshotRef.current = '';
                        }}>
                          <DialogContent className="max-w-2xl min-w-[600px] max-h-[85vh] overflow-y-auto  border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter">
                            {/* Header with Gradient Background */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 ">
                              <DialogHeader>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
                                      <DollarSign className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                      <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                                        {isEditMode ? 'Update Currency' : 'Add New Currency'}
                                      </DialogTitle>
                                    </div>
                                  </div>
                                </div>
                              </DialogHeader>
                            </div>

                            {/* Form Content */}
                            <div className="px-8 py-6">
                              <form className="grid grid-cols-1 gap-6">
                                {/* Currency Selection Field with Autocomplete */}
                                <div className="space-y-2 relative">
                                  <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                    Currency <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    value={newCurrency.code}
                                    onChange={(e) => handleCurrencyCodeChange(e.target.value)}
                                    onFocus={() => {
                                      if (newCurrency.code && filteredCurrencies.length > 0) {
                                        setShowDropdown(true);
                                      }
                                    }}
                                    onBlur={() => {
                                      // Delay to allow click on dropdown item
                                      setTimeout(() => setShowDropdown(false), 200);
                                    }}
                                    placeholder="Type currency code to search..."
                                    className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                                    autoComplete="off"
                                  />
                                  {/* Autocomplete Dropdown */}
                                  {showDropdown && filteredCurrencies.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {filteredCurrencies.map((curr) => (
                                        <button
                                          key={curr.code}
                                          type="button"
                                          onPointerDown={(e) => {
                                            // Select before input blur closes the dropdown.
                                            e.preventDefault();
                                            handleCurrencySelect(curr);
                                          }}
                                          onClick={() => handleCurrencySelect(curr)}
                                          className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors duration-150 flex items-center justify-between border-b border-gray-100 last:border-b-0"
                                        >
                                          <div className="flex items-center gap-2">
                                            {curr.countryCode && (
                                              <ReactCountryFlag
                                                svg
                                                countryCode={curr.countryCode}
                                                style={{ width: "1.25rem", height: "1.25rem", borderRadius: "999px" }}
                                              />
                                            )}
                                            <span className="font-semibold text-gray-900">
                                              {curr.description} ({curr.code})
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Exchange Rate Field */}
                                <div className="space-y-2">
                                  <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                    Exch.Rate against 1 LCY <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newCurrency.exchangeRate || ''}
                                    onChange={(e) => setNewCurrency({ ...newCurrency, exchangeRate: e.target.value })}
                                    className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                                  />
                                </div>

                                {/* Action Buttons - Full Width */}
                                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => {
                                      restoreModalUrlIfNeeded();
                                      setAddCurrencyOpen(false);
                                    }}
                                    className="h-9 px-6 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-all duration-200"
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={() => {
                                      addNewCurrency();
                                      restoreModalUrlIfNeeded();
                                      setAddCurrencyOpen(false);
                                    }}
                                    className="h-9 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200 tracking-wide"
                                  >
                                    {isEditMode ? 'Update Currency' : 'Add Currency'}
                                  </Button>
                                </div>
                              </form>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Currency Delete Confirmation Dialog */}
                        <Dialog
                          open={currencyDeleteOpen}
                          onOpenChange={(open) => {
                            setCurrencyDeleteOpen(open);
                            if (!open) setCurrencyToDelete(null);
                          }}
                        >
                          <DialogContent className="max-w-md  border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
                            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
                              <DialogHeader>
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Trash2 className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <DialogTitle className="text-xl font-bold tracking-tight text-white">
                                      Delete Currency
                                    </DialogTitle>
                                    <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
                                  </div>
                                </div>
                              </DialogHeader>
                            </div>

                            <div className="px-6 py-5">
                              {(currencyToDelete?.inUseCount ?? 0) > 0 ? (
                                <>
                                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                                    The currency <span className="font-semibold text-gray-900">"{currencyToDelete?.code}"</span> is linked to <span className="font-semibold text-gray-900">{currencyToDelete?.inUseCount ?? 0}</span> subscription(s).
                                  </p>
                                  <p className="text-gray-600 text-xs leading-relaxed">
                                    You can’t delete it right now. Please reassign the currency in those subscriptions and then try again.
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                                    Are you sure you want to delete the currency <span className="font-semibold text-gray-900">"{currencyToDelete?.code}"</span>?
                                  </p>
                                  <p className="text-gray-600 text-xs leading-relaxed">
                                    This will permanently remove this currency from your system.
                                  </p>
                                </>
                              )}
                            </div>

                            <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setCurrencyDeleteOpen(false);
                                  setCurrencyToDelete(null);
                                }}
                                className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
                              >
                                {(currencyToDelete?.inUseCount ?? 0) > 0 ? 'OK' : 'Cancel'}
                              </Button>
                              {(currencyToDelete?.inUseCount ?? 0) > 0 ? null : (
                                <Button
                                  type="button"
                                  onClick={() => {
                                    const code = currencyToDelete?.code;
                                    if (code) deleteCurrency(code);
                                    setCurrencyDeleteOpen(false);
                                    setCurrencyToDelete(null);
                                  }}
                                  className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        {currenciesLoading ? (
                          <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                            <p className="text-sm text-gray-400 font-medium">Loading currencies…</p>
                          </div>
                        ) : (
                          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-md bg-white flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
                            <div className="flex-1 overflow-y-auto">
                              <table className="min-w-full">
                                {/* ── Table header ── */}
                                <thead className="sticky top-0 z-20">
                                  <tr className="bg-blue-600">
                                    <th className="py-4 px-5 text-left text-sm font-bold text-white uppercase tracking-wide bg-blue-600">Currency</th>
                                    <th className="py-4 px-5 text-left text-sm font-bold text-white uppercase tracking-wide bg-blue-600">
                                      Exch. Rate / 1 LCY
                                      {isUpdateMode && <span className="ml-2 text-xs font-semibold bg-white/25 text-white px-2 py-0.5 rounded-full normal-case">Editable</span>}
                                    </th>
                                    <th className="py-4 px-5 text-left text-sm font-bold text-white uppercase tracking-wide bg-blue-600">Created</th>
                                    <th className="py-4 px-5 text-left text-sm font-bold text-white uppercase tracking-wide bg-blue-600">Last Updated</th>
                                    <th className="py-4 px-5 text-left text-sm font-bold text-white uppercase tracking-wide bg-blue-600">Actions</th>
                                  </tr>
                                </thead>

                                {/* ── Table body ── */}
                                <tbody className="divide-y divide-gray-50">
                                  {currencies.length === 0 ? (
                                    <tr>
                                      <td colSpan={5}>
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                            <DollarSign className="w-7 h-7 text-indigo-400" />
                                          </div>
                                          <p className="text-sm font-semibold text-gray-500">No currencies yet</p>
                                          <p className="text-xs text-gray-400">Add your first currency to get started</p>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    [...currencies].reverse().map((currency, index) => {
                                      const flagCode = getCountryCodeForCurrency(String(currency.code || '').toUpperCase());
                                      return (
                                        <tr
                                          key={currency.code}
                                          className={`group transition-colors duration-150 ${
                                            index % 2 === 0 ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40'
                                          }`}
                                        >
                                          {/* Currency name + flag */}
                                          <td className="py-3.5 px-5">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setNewCurrency({
                                                  name: currency.name || '',
                                                  code: currency.code || '',
                                                  symbol: currency.symbol || '',
                                                  isoNumber: '', // Not used
                                                  exchangeRate: currency.exchangeRate || '',
                                                  visible: currency.visible,
                                                  created: currency.created || ''
                                                });
                                                setIsEditMode(true);
                                                setAddCurrencyOpen(true);
                                                const code = String(currency.code || '').toUpperCase().trim();
                                                if (code) void setSecureUrlForConfigEditModal('currency', 'currency', code);
                                              }}
                                              title={`${currency.symbol || ''} ${currency.name || ''} (${currency.code || ''})`.trim()}
                                              className="flex items-center gap-3 text-left w-full group/btn"
                                            >
                                              <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                                {flagCode ? (
                                                  <ReactCountryFlag svg countryCode={flagCode} style={{ width: '2rem', height: '1.5rem', objectFit: 'cover' }} />
                                                ) : (
                                                  <span className="text-xs font-bold text-gray-500">{(currency.code || '').slice(0, 2)}</span>
                                                )}
                                              </div>
                                              <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate group-hover/btn:text-indigo-700 transition-colors">
                                                  {currency.name || currency.code}
                                                </p>
                                                <p className="text-xs text-gray-400">{currency.symbol} · {currency.code}</p>
                                              </div>
                                            </button>
                                          </td>

                                          {/* Exchange rate */}
                                          <td className="py-3.5 px-5 text-left">
                                            {isUpdateMode ? (
                                              <Input
                                                type="number"
                                                step="0.0001"
                                                min="0"
                                                value={editingRates[currency.code] || ''}
                                                onChange={(e) => handleRateChange(currency.code, e.target.value)}
                                                className="w-28 h-8 text-sm border-blue-300 focus:border-blue-500 focus:ring-blue-500 text-right rounded-lg"
                                                placeholder="Rate"
                                              />
                                            ) : (
                                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold tabular-nums">
                                                {currency.exchangeRate ? parseFloat(currency.exchangeRate).toFixed(2) : '—'}
                                              </span>
                                            )}
                                          </td>

                                          {/* Created */}
                                          <td className="py-3.5 px-5 text-sm text-gray-500">
                                            {currency.created || '—'}
                                          </td>

                                          {/* Last updated */}
                                          <td className="py-3.5 px-5">
                                            {currency.lastUpdated ? (
                                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                {currency.lastUpdated}
                                              </span>
                                            ) : (
                                              <span className="text-gray-300 text-sm">—</span>
                                            )}
                                          </td>

                                          {/* Actions */}
                                          <td className="py-3.5 px-5">
                                            {!isUpdateMode && (() => {
                                              const rowCode = String(currency.code || '').toUpperCase().trim();
                                              if (!rowCode) return null;
                                              const isOpen = openCurrencyActionsMenuForCode === rowCode;
                                              const isAnotherRowOpen = !!openCurrencyActionsMenuForCode && openCurrencyActionsMenuForCode !== rowCode;
                                              return (
                                                <DropdownMenu
                                                  open={isOpen}
                                                  onOpenChange={(open) => setOpenCurrencyActionsMenuForCode(open ? rowCode : null)}
                                                >
                                                  <DropdownMenuTrigger asChild>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className={`h-8 w-8 p-0 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ${
                                                        isAnotherRowOpen ? 'invisible' : ''
                                                      }`}
                                                    >
                                                      <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent
                                                    align="end"
                                                    className="z-[1000] bg-white text-gray-900 border border-gray-200 shadow-lg rounded-xl"
                                                  >
                                                    <DropdownMenuItem
                                                      onClick={() => {
                                                        setNewCurrency({
                                                          name: currency.name || '',
                                                          code: currency.code || '',
                                                          symbol: currency.symbol || '',
                                                          isoNumber: '', // Not used
                                                          exchangeRate: currency.exchangeRate || '',
                                                          visible: currency.visible,
                                                          created: currency.created || ''
                                                        });
                                                        setIsEditMode(true);
                                                        setAddCurrencyOpen(true);
                                                        const code = String(currency.code || '').toUpperCase().trim();
                                                        if (code) void setSecureUrlForConfigEditModal('currency', 'currency', code);
                                                      }}
                                                      className="cursor-pointer"
                                                    >
                                                      <Edit className="h-4 w-4 mr-2" />
                                                      Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onClick={() => {
                                                        const inUseCount = getCurrencySubscriptions(rowCode).length;
                                                        setCurrencyToDelete({ code: rowCode, name: currency.name, inUseCount });
                                                        setCurrencyDeleteOpen(true);
                                                      }}
                                                      className="cursor-pointer text-red-600 focus:text-red-600"
                                                    >
                                                      <Trash2 className="h-4 w-4 mr-2" />
                                                      Delete
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              );
                                            })()}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  </TabsContent>
              
              {/* Currency Import Confirmation Dialog */}
              <AlertDialog open={currencyImportConfirmOpen} onOpenChange={setCurrencyImportConfirmOpen}>
                <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Select Yes to choose a file. Select No to download the template with examples.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                      onClick={() => {
                        // Download template with examples
                        const wb = XLSX.utils.book_new();
                        const templateData = [
                          {
                            'Currency Code': 'USD',
                            'Description': 'United States Dollar',
                            'Symbol': '$',
                            'Exchange Rate': '1.00'
                          },
                          {
                            'Currency Code': 'EUR',
                            'Description': 'Euro',
                            'Symbol': '€',
                            'Exchange Rate': '0.85'
                          },
                          {
                            'Currency Code': 'GBP',
                            'Description': 'British Pound Sterling',
                            'Symbol': '£',
                            'Exchange Rate': '0.73'
                          }
                        ];
                        const ws = XLSX.utils.json_to_sheet(templateData);
                        ws['!cols'] = [
                          { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }
                        ];
                        XLSX.utils.book_append_sheet(wb, ws, 'Currency');
                        XLSX.writeFile(wb, 'Currency_Template.xlsx');
                        toast({
                          title: "Template Downloaded",
                          description: "Currency template with examples downloaded successfully",
                          variant: "success",
                        });
                        setCurrencyImportConfirmOpen(false);
                      }}
                    >
                      No
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-green-600 text-white hover:bg-green-700"
                      onClick={() => {
                        setCurrencyImportConfirmOpen(false);
                        setTimeout(() => currencyFileInputRef.current?.click(), 0);
                      }}
                    >
                      Yes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <TabsContent value="payment" className="mt-4" id="payment-methods-section">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="bg-transparent border-0 shadow-none p-0 rounded-xl flex flex-col">
                    {/* ── Payment Methods Header ── */}
                    <div className="flex-shrink-0 bg-gray-50 pb-4 mb-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Left: icon + title + search */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-indigo-600">
                            <CreditCard className="w-5 h-5 text-white" />
                          </div>
                          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Payment Methods</h2>

                          {/* Search box */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                              value={paymentSearchTerm}
                              onChange={(e) => setPaymentSearchTerm(e.target.value)}
                              placeholder="Search..."
                              className="pl-9 w-52 bg-gray-100 border-0 rounded-xl h-10 text-sm shadow-none focus:ring-0 focus:bg-white transition-all"
                            />
                          </div>
                        </div>

                        {/* Right: controls */}
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            ref={paymentFileInputRef}
                            className="hidden"
                            accept=".xlsx,.xls"
                            onChange={importPaymentMethods}
                          />
                          <Select
                            key={paymentDataManagementSelectKey}
                            onValueChange={(value) => {
                              if (value === 'export') {
                                exportPaymentMethods();
                              } else if (value === 'import') {
                                setPaymentImportConfirmOpen(true);
                              }
                              setPaymentDataManagementSelectKey((k) => k + 1);
                            }}
                          >
                            <SelectTrigger className="w-44 bg-gray-100 border-0 text-gray-700 hover:bg-gray-200 font-medium transition-all duration-200 rounded-xl h-10 text-sm shadow-none">
                              <SelectValue placeholder="Import/Export" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="export" className="cursor-pointer">
                                <div className="flex items-center"><Download className="h-4 w-4 mr-2" />Export</div>
                              </SelectItem>
                              <SelectItem value="import" className="cursor-pointer">
                                <div className="flex items-center"><Upload className="h-4 w-4 mr-2" />Import</div>
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPaymentMethodsView((v) => (v === 'tiles' ? 'table' : 'tiles'))}
                            className="h-10 px-4 rounded-xl border-0 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-sm shadow-none"
                          >
                            {paymentMethodsView === 'tiles' ? 'Table View' : 'Card View'}
                          </Button>

                          <Button
                            onClick={() => {
                              const nextPaymentForm = {
                                title: '',
                                type: '',
                                owner: '',
                                manager: '',
                                expiresAt: '',
                                financialInstitution: '',
                                lastFourDigits: '',
                              };
                              setPaymentForm(nextPaymentForm);
                              paymentSnapshotRef.current = JSON.stringify(nextPaymentForm);
                              setPmOwnerSearch('');
                              setPmManagerSearch('');
                              setAddPaymentModalOpen(true);
                            }}
                            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200 text-sm border-0"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            New Payment Method
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div>
                    {/* Payment Methods List */}
                    {(() => {
                      const filteredPaymentMethods = [...paymentMethods]
                        .reverse()
                        .filter((method) =>
                          String(method.name || '').toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
                          String(method.type || '').toLowerCase().includes(paymentSearchTerm.toLowerCase())
                        );

                      if (filteredPaymentMethods.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                              <CreditCard className="w-8 h-8 text-indigo-400" />
                            </div>
                            <p className="text-base font-semibold text-gray-500">
                              {paymentSearchTerm ? 'No payment methods found' : 'No payment methods yet'}
                            </p>
                            <p className="text-sm text-gray-400 text-center max-w-xs">
                              {paymentSearchTerm
                                ? `No results for "${paymentSearchTerm}". Try a different search.`
                                : 'Add your first payment method to get started.'}
                            </p>
                          </div>
                        );
                      }

                      if (paymentMethodsView === 'table') {
                        return (
                          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-md bg-white flex flex-col h-full">
                            <div className="flex-1 overflow-y-auto">
                            <table className="min-w-full table-fixed">
                              <thead className="sticky top-0 z-20">
                                <tr className="bg-blue-600">
                                  <th className="py-4 px-5 text-left text-sm font-bold text-white uppercase tracking-wide bg-blue-600 w-[260px]">Name</th>
                                  <th className="py-4 px-5 text-left text-sm font-bold text-white uppercase tracking-wide bg-blue-600 w-[220px]">Type</th>
                                  <th className="py-4 px-5 text-center text-sm font-bold text-white uppercase tracking-wide bg-blue-600 w-[150px]">Subscriptions</th>
                                  <th className="py-4 px-5 text-right text-sm font-bold text-white uppercase tracking-wide bg-blue-600">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white">
                                {filteredPaymentMethods.map((method, idx) => {
                                  const subsCount = getPaymentMethodSubscriptions(method.name).length;
                                  const rowKey = String(method?._id || method?.id || method?.name || idx);
                                  const isOpen = openPaymentActionsMenuForKey === rowKey;
                                  const isAnotherRowOpen = !!openPaymentActionsMenuForKey && openPaymentActionsMenuForKey !== rowKey;

                                  return (
                                    <tr
                                      key={`${method.name}-${idx}`}
                                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                      }`}
                                    >
                                      <td className="px-3 py-3 font-medium text-gray-800 text-sm w-[260px] max-w-[260px] overflow-hidden text-left">
                                        <span className="block truncate whitespace-nowrap" title={method.name}>
                                          {method.name}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-gray-600 text-sm w-[220px] max-w-[220px] overflow-hidden text-left">
                                        <span className="block truncate whitespace-nowrap" title={method.type}>
                                          {method.type}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-center w-[150px]">
                                        <button
                                          onClick={() => openPaymentSubsModal(method.name)}
                                          className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm hover:bg-blue-200 transition-colors cursor-pointer"
                                          title="View subscriptions using this payment method"
                                        >
                                          {subsCount}
                                        </button>
                                      </td>
                                      <td className="px-3 py-3 text-right">
                                        <DropdownMenu
                                          open={isOpen}
                                          onOpenChange={(open) => setOpenPaymentActionsMenuForKey(open ? rowKey : null)}
                                        >
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className={`h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${
                                                isAnotherRowOpen ? 'invisible' : ''
                                              }`}
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="end"
                                            className="z-[1000] bg-white text-gray-900 border border-gray-200 shadow-lg"
                                          >
                                            <DropdownMenuItem
                                              onClick={() => openEditPayment(method)}
                                              className="cursor-pointer"
                                            >
                                              <Edit className="h-4 w-4 mr-2" />
                                              Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleDeletePaymentMethod(method)}
                                              className="cursor-pointer text-red-600 focus:text-red-600"
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-y-auto overflow-x-hidden" style={{ height: 'calc(100vh - 220px)' }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full min-w-0 pb-4">
                          {filteredPaymentMethods.map((method, idx) => {
                            const subsCount = getPaymentMethodSubscriptions(method.name).length;

                            // Determine active / inactive from expiry date
                            let isActive = true;
                            if (method.expiresAt) {
                              const [year, month] = String(method.expiresAt).split('-');
                              const expiry = new Date(parseInt(year), parseInt(month) - 1);
                              const today = new Date();
                              today.setDate(1); today.setHours(0,0,0,0);
                              isActive = expiry >= today;
                            }

                            // Card gradient — uniform blue for all types
                            const cardGrad = 'from-indigo-600 via-blue-600 to-blue-700';

                            // Format expiry
                            const expiryDisplay = method.expiresAt
                              ? (() => { const [y, m] = String(method.expiresAt).split('-'); return `${m}/${String(y).slice(2)}`; })()
                              : '-- / --';

                            // Last 4 digits dots
                            const last4 = method.lastFourDigits ? String(method.lastFourDigits).slice(-4) : '••••';

                            return (
                              <motion.div
                                key={idx}
                                whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
                                transition={{ duration: 0.18 }}
                                className="flex flex-col rounded-2xl overflow-hidden shadow-md border border-gray-100 bg-white"
                              >
                                {/* ── Small gradient header: icon + active badge only ── */}
                                <div className={`relative bg-gradient-to-r ${cardGrad} px-5 py-4 overflow-hidden`}>
                                  {/* Subtle decorative circle */}
                                  <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                                  <div className="relative flex items-center justify-between">
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                      <CreditCard className="w-5 h-5 text-white" />
                                    </div>
                                    {/* Active / Inactive badge — solid white bg for max visibility on any gradient */}
                                    <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-white shadow-sm ${
                                      isActive ? 'text-emerald-600' : 'text-red-500'
                                    }`}>
                                      <span className={`relative flex h-2 w-2`}>
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                      </span>
                                      {isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>

                                {/* ── White body ── */}
                                <div className="px-5 pt-4 pb-2">
                                  {/* Name */}
                                  <p className="font-bold text-gray-900 text-base leading-tight truncate">{method.name}</p>
                                  {/* Institution / type */}
                                  {method.financialInstitution
                                    ? <p className="text-sm text-gray-400 mt-0.5 truncate">{method.financialInstitution}</p>
                                    : <p className="text-sm text-gray-400 mt-0.5">{method.type || 'Card'}</p>
                                  }

                                  {/* Card number row — grey pill */}
                                  <div className="mt-3 flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 font-mono tracking-widest text-sm text-gray-700">
                                    <span className="text-gray-400 text-base">•••• •••• ••••</span>
                                    <span className="font-bold">{last4}</span>
                                  </div>

                                  {/* Type + expiry row */}
                                  <div className="mt-3 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{method.type}</span>
                                    {method.expiresAt && (
                                      <span className="text-xs font-mono text-gray-400">Exp: {expiryDisplay}</span>
                                    )}
                                  </div>
                                </div>

                                {/* ── Footer: subscription count + Edit / Delete ── */}
                                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-1">
                                  <button
                                    onClick={() => openPaymentSubsModal(method.name)}
                                    className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors"
                                    title="View subscriptions"
                                  >
                                    <span className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center font-bold text-xs">{subsCount}</span>
                                    <span className="text-xs font-semibold">Subscriptions</span>
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditPayment(method)}
                                      className="h-8 px-3 rounded-xl text-indigo-600 hover:bg-indigo-50 font-semibold text-xs"
                                    >
                                      <Edit className="w-3 h-3 mr-1" />Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeletePaymentMethod(method)}
                                      className="h-8 px-3 rounded-xl text-red-500 hover:bg-red-50 font-semibold text-xs"
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" />Delete
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                        </div>
                      );
                    })()}
                    </div>
                    
                    {/* Payment Method Subscriptions Modal */}
                    <Dialog open={paymentSubsModalOpen} onOpenChange={setPaymentSubsModalOpen}>
                      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto  border-0 shadow-2xl p-0 bg-white font-inter">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 ">
                          <DialogHeader>
                            <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                              Subscriptions using {selectedPaymentSubs.paymentMethod}
                            </DialogTitle>
                            <p className="text-blue-100 mt-1 font-medium">
                              {selectedPaymentSubs.subscriptions.length} subscription{selectedPaymentSubs.subscriptions.length !== 1 ? 's' : ''} found
                            </p>
                          </DialogHeader>
                        </div>
                        
                        <div className="px-8 py-6">
                          {selectedPaymentSubs.subscriptions.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                              <p>No subscriptions are using this payment method</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Service Name</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {selectedPaymentSubs.subscriptions.map((sub: any, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">{sub.serviceName || sub.name || '-'}</TableCell>
                                      <TableCell>{sub.owner || '-'}</TableCell>
                                      <TableCell>{sub.category || '-'}</TableCell>
                                      <TableCell>${parseFloat(String(sub.amount || 0)).toFixed(2)}</TableCell>
                                      <TableCell>
                                        <Badge className={sub.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                          {sub.status}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    {/* Edit Payment Method Modal */}
                    <Dialog open={editPaymentModalOpen} onOpenChange={(open) => {
                      if (open) {
                        setEditPaymentModalOpen(true);
                        return;
                      }
                      if (isPaymentDirty()) {
                        requestExitConfirm(closeEditPaymentModalNow);
                        return;
                      }
                      closeEditPaymentModalNow();
                    }}>
                      <DialogContent showClose={false} className={`${isEditPaymentFullscreen ? 'max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh]' : 'max-w-3xl min-w-[600px]'} overflow-hidden border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter`}>
                        {/* Header with Gradient Background */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 ">
                          <DialogHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
                                  <Edit className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                                    Edit Payment Method
                                  </DialogTitle>
                                  <p className="text-indigo-100 mt-1 font-medium">Update payment method details</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {/* Extend Button */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setIsEditPaymentFullscreen(!isEditPaymentFullscreen)}
                                  className="bg-white text-indigo-600 hover:bg-gray-50 font-medium px-3 py-2 rounded-lg transition-all duration-200 h-10 w-10 p-0 flex items-center justify-center border-white shadow-sm"
                                  title={isEditPaymentFullscreen ? 'Exit Fullscreen' : 'Expand'}
                                >
                                  {isEditPaymentFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (isPaymentDirty()) {
                                      requestExitConfirm(closeEditPaymentModalNow);
                                      return;
                                    }
                                    closeEditPaymentModalNow();
                                  }}
                                  className="bg-white text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 hover:!text-indigo-700 font-medium px-3 py-2 rounded-lg transition-all duration-200 h-10 w-10 p-0 flex items-center justify-center border-indigo-200 shadow-sm"
                                  title="Close"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </DialogHeader>
                        </div>

                        {/* Form Content */}
                        <div className="px-8 py-6">
                          <form onSubmit={handleEditPaymentMethod} className={`${isEditPaymentFullscreen ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}`}>
                            {/* Name Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Name <span className="text-red-500">*</span>
                              </Label>
                              <Input 
                                required 
                                value={paymentForm.title} 
                                onChange={e => setPaymentForm(f => ({ ...f, title: e.target.value }))}
                                onBlur={() => {
                                  // Check for duplicate name when user leaves the field (excluding current one being edited)
                                  if (paymentForm.title.trim()) {
                                    const duplicateName = paymentMethods.find(
                                      method => (method._id !== editingPaymentId) && 
                                                (method.name?.toLowerCase().trim() === paymentForm.title.toLowerCase().trim() ||
                                                 method.title?.toLowerCase().trim() === paymentForm.title.toLowerCase().trim())
                                    );
                                    
                                    if (duplicateName) {
                                      setValidationErrorMessage(`A payment method with the name "${paymentForm.title}" already exists. Please use a different name.`);
                                      setValidationErrorOpen(true);
                                    }
                                  }
                                }}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Type Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Type <span className="text-red-500">*</span>
                              </Label>
                              <select 
                                required 
                                className="w-full h-9 px-3 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-20 font-inter text-sm bg-gray-50 focus:bg-white transition-all duration-200 text-gray-900"
                                value={paymentForm.type} 
                                onChange={e => setPaymentForm(f => ({ ...f, type: e.target.value }))}
                              >
                                <option value="" className="font-inter text-sm">Select payment type</option>
                                <option value="Credit" className="font-inter text-sm">Credit Card</option>
                                <option value="Debit" className="font-inter text-sm">Debit Card</option>
                                <option value="Cash" className="font-inter text-sm">Cash</option>
                                <option value="Bank Transfer" className="font-inter text-sm">Bank Transfer</option>
                                <option value="Digital Wallet" className="font-inter text-sm">Digital Wallet</option>
                                <option value="Other" className="font-inter text-sm">Other</option>
                              </select>
                            </div>


                            {/* Owner Field - Unified Select Dropdown with Scrollbar and Search */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Owner
                              </Label>
                              <div className="relative" ref={pmOwnerDropdownRef}>
                                <div className="relative">
                                  <Input
                                    value={pmOwnerOpen ? pmOwnerSearch : (paymentForm.owner || '')}
                                    placeholder="Select employee"
                                    className="w-full border-gray-300 rounded-lg h-10 p-2 pr-10 text-base focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                    onFocus={() => {
                                      setPmOwnerSearch('');
                                      setPmOwnerOpen(true);
                                    }}
                                    onClick={() => {
                                      setPmOwnerSearch('');
                                      setPmOwnerOpen(true);
                                    }}
                                    onChange={(e) => {
                                      setPmOwnerSearch(e.target.value);
                                      setPmOwnerOpen(true);
                                    }}
                                    autoComplete="off"
                                  />
                                  <ChevronDown
                                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                                    onClick={() => {
                                      if (!pmOwnerOpen) {
                                        setPmOwnerSearch('');
                                      }
                                      setPmOwnerOpen(!pmOwnerOpen);
                                    }}
                                  />
                                </div>
                                {pmOwnerOpen && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                                    {(Array.isArray(employeesRaw) ? employeesRaw : [])
                                      .filter((emp: any) => {
                                        const q = pmOwnerSearch.trim().toLowerCase();
                                        if (!q) return true;
                                        return (
                                          String(emp?.name || '').toLowerCase().includes(q) ||
                                          String(emp?.email || '').toLowerCase().includes(q)
                                        );
                                      })
                                      .sort((a: any, b: any) => {
                                        const aSelected = paymentForm.owner === a.name;
                                        const bSelected = paymentForm.owner === b.name;
                                        if (aSelected && !bSelected) return -1;
                                        if (!aSelected && bSelected) return 1;
                                        return 0;
                                      })
                                      .map((emp: any) => {
                                        const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                                        const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                                        const selected = paymentForm.owner === emp.name;
                                        return (
                                          <div
                                            key={emp._id || emp.id || emp.email || emp.name}
                                            className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                              selected ? 'bg-blue-50 text-blue-700' : ''
                                            }`}
                                            onClick={() => {
                                              // If already selected, clear it
                                              if (paymentForm.owner === emp.name) {
                                                setPaymentForm(f => ({ ...f, owner: '' }));
                                                setPmOwnerSearch('');
                                                setPmOwnerOpen(false);
                                                return;
                                              }
                                              const name = String(emp.name || '').trim();
                                              setPaymentForm(f => ({ ...f, owner: name }));
                                              setPmOwnerSearch(name);
                                              setPmOwnerOpen(false);
                                            }}
                                          >
                                            <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                            <span className="font-normal">{displayName}</span>
                                          </div>
                                        );
                                      })}
                                    {(Array.isArray(employeesRaw) ? employeesRaw : []).length === 0 && (
                                      <div className="px-3 py-2.5 text-sm text-slate-500">No employees found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Manager Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Managed by
                              </Label>
                              <div className="relative" ref={pmManagerDropdownRef}>
                                <div className="relative">
                                  <Input
                                    value={pmManagerOpen ? pmManagerSearch : (paymentForm.manager || '')}
                                    placeholder="Select employee"
                                    className="w-full border-gray-300 rounded-lg h-10 p-2 pr-10 text-base focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                    onFocus={() => {
                                      setPmManagerSearch('');
                                      setPmManagerOpen(true);
                                    }}
                                    onClick={() => {
                                      setPmManagerSearch('');
                                      setPmManagerOpen(true);
                                    }}
                                    onChange={(e) => {
                                      setPmManagerSearch(e.target.value);
                                      setPmManagerOpen(true);
                                    }}
                                    autoComplete="off"
                                  />
                                  <ChevronDown
                                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                                    onClick={() => {
                                      if (!pmManagerOpen) {
                                        setPmManagerSearch('');
                                      }
                                      setPmManagerOpen(!pmManagerOpen);
                                    }}
                                  />
                                </div>
                                {pmManagerOpen && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                                    {(Array.isArray(employeesRaw) ? employeesRaw : [])
                                      .filter((emp: any) => {
                                        const q = pmManagerSearch.trim().toLowerCase();
                                        if (!q) return true;
                                        return (
                                          String(emp?.name || '').toLowerCase().includes(q) ||
                                          String(emp?.email || '').toLowerCase().includes(q)
                                        );
                                      })
                                      .sort((a: any, b: any) => {
                                        const aSelected = paymentForm.manager === a.name;
                                        const bSelected = paymentForm.manager === b.name;
                                        if (aSelected && !bSelected) return -1;
                                        if (!aSelected && bSelected) return 1;
                                        return 0;
                                      })
                                      .map((emp: any) => {
                                        const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                                        const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                                        const selected = paymentForm.manager === emp.name;
                                        return (
                                          <div
                                            key={emp._id || emp.id || emp.email || emp.name}
                                            className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                              selected ? 'bg-blue-50 text-blue-700' : ''
                                            }`}
                                            onClick={() => {
                                              // If already selected, clear it
                                              if (paymentForm.manager === emp.name) {
                                                setPaymentForm(f => ({ ...f, manager: '' }));
                                                setPmManagerSearch('');
                                                setPmManagerOpen(false);
                                                return;
                                              }
                                              const name = String(emp.name || '').trim();
                                              setPaymentForm(f => ({ ...f, manager: name }));
                                              setPmManagerSearch(name);
                                              setPmManagerOpen(false);
                                            }}
                                          >
                                            <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                            <span className="font-normal">{displayName}</span>
                                          </div>
                                        );
                                      })}
                                    {(Array.isArray(employeesRaw) ? employeesRaw : []).length === 0 && (
                                      <div className="px-3 py-2.5 text-sm text-slate-500">No employees found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Financial Institution Field */}
                            {paymentForm.type !== 'Cash' && (
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Financial Institution
                              </Label>
                              <Input 
                                value={paymentForm.financialInstitution} 
                                onChange={e => setPaymentForm(f => ({ ...f, financialInstitution: e.target.value }))}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>
                            )}

                            {/* Last 4 Digits Field */}
                            {paymentForm.type !== 'Cash' && (
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Last 4 Digits
                              </Label>
                              <Input 
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={paymentForm.lastFourDigits} 
                                onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  setPaymentForm(f => ({ ...f, lastFourDigits: value }));
                                }}
                                maxLength={4}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>
                            )}

                            {/* Expires At Field */}
                            {paymentForm.type !== 'Cash' && (
                            <div className={`space-y-2 ${isEditPaymentFullscreen ? 'lg:col-span-1' : 'md:col-span-1'}`}>
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Expires at
                              </Label>
                              <div className="relative">
                                <Input 
                                  type="month" 
                                  placeholder="MM/YYYY"
                                  value={paymentForm.expiresAt} 
                                  onChange={e => {
                                    const newValue = e.target.value;
                                    
                                    // Validate immediately when date is selected
                                    if (newValue) {
                                      const [year, month] = newValue.split('-');
                                      const expiryDate = new Date(parseInt(year), parseInt(month) - 1);
                                      const today = new Date();
                                      today.setDate(1);
                                      today.setHours(0, 0, 0, 0);
                                      
                                      if (expiryDate < today) {
                                        setValidationErrorMessage("Card expiry date cannot be in the past");
                                        setValidationErrorOpen(true);
                                        // Clear the invalid date
                                        setPaymentForm(f => ({ ...f, expiresAt: '' }));
                                        return;
                                      }
                                    }
                                    
                                    setPaymentForm(f => ({ ...f, expiresAt: newValue }));
                                  }}
                                  className="h-9 px-3 pr-10 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (paymentForm.expiresAt) {
                                        const [year, month] = paymentForm.expiresAt.split('-');
                                        const newYear = parseInt(year) + 1;
                                        setPaymentForm(f => ({ ...f, expiresAt: `${newYear}-${month}` }));
                                      } else {
                                        const now = new Date();
                                        setPaymentForm(f => ({ ...f, expiresAt: `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, '0')}` }));
                                      }
                                    }}
                                    className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                    title="Next year"
                                  >
                                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (paymentForm.expiresAt) {
                                        const [year, month] = paymentForm.expiresAt.split('-');
                                        const newYear = parseInt(year) - 1;
                                        setPaymentForm(f => ({ ...f, expiresAt: `${newYear}-${month}` }));
                                      } else {
                                        const now = new Date();
                                        setPaymentForm(f => ({ ...f, expiresAt: `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}` }));
                                      }
                                    }}
                                    className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                    title="Previous year"
                                  >
                                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                            )}

                            {/* Action Buttons - Full Width */}
                            <div className={`flex justify-end space-x-4 pt-6 border-t border-gray-200 ${isEditPaymentFullscreen ? 'lg:col-span-2' : 'md:col-span-2'}`}>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => closeEditPaymentModal()} 
                                className="h-9 px-6 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-all duration-200"
                              >
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                className="h-9 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200 tracking-wide"
                              >
                                Save Changes
                              </Button>
                            </div>
                          </form>
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
                                  Delete Payment Method
                                </DialogTitle>
                                <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
                              </div>
                            </div>
                          </DialogHeader>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5 bg-white">
                          {(() => {
                            const pmName = String(paymentToDelete?.name || paymentToDelete?.title || '').trim();
                            const inUse = pmName ? getPaymentMethodSubscriptions(pmName).length : 0;
                            if (inUse > 0) {
                              return (
                                <>
                                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                                    The payment method <span className="font-semibold text-gray-900">"{pmName}"</span> is linked to <span className="font-semibold text-gray-900">{inUse}</span> subscription(s).
                                  </p>
                                  <p className="text-gray-600 text-xs leading-relaxed">
                                    You can’t delete it right now. Please reassign the payment method in those subscriptions and then try again.
                                  </p>
                                </>
                              );
                            }
                            return (
                              <>
                                <p className="text-gray-700 text-sm leading-relaxed mb-4">
                                  Are you sure you want to delete the payment method <span className="font-semibold text-gray-900">"{paymentToDelete?.name || paymentToDelete?.title}"</span>?
                                </p>
                                <p className="text-gray-600 text-xs leading-relaxed">
                                  This will permanently remove this payment method from your system.
                                </p>
                              </>
                            );
                          })()}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 px-6 py-4 bg-white rounded-b-2xl border-t border-gray-100">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setDeleteConfirmOpen(false);
                              setPaymentToDelete(null);
                            }}
                            className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
                          >
                            {(() => {
                              const pmName = String(paymentToDelete?.name || paymentToDelete?.title || '').trim();
                              const inUse = pmName ? getPaymentMethodSubscriptions(pmName).length : 0;
                              return inUse > 0 ? 'OK' : 'Cancel';
                            })()}
                          </Button>
                          {(() => {
                            const pmName = String(paymentToDelete?.name || paymentToDelete?.title || '').trim();
                            const inUse = pmName ? getPaymentMethodSubscriptions(pmName).length : 0;
                            if (inUse > 0) return null;
                            return (
                              <Button 
                                type="button"
                                onClick={confirmDeletePaymentMethod}
                                className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
                              >
                                Delete
                              </Button>
                            );
                          })()}
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    {/* Validation Error Dialog */}
                    <Dialog open={validationErrorOpen} onOpenChange={setValidationErrorOpen}>
                      <DialogContent className="max-w-md  border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
                        {/* Header with Red Gradient Background */}
                        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
                          <DialogHeader>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <AlertCircle className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-white">
                                  Validation Error
                                </DialogTitle>
                                <p className="text-red-100 mt-0.5 text-sm font-medium">Please correct the error</p>
                              </div>
                            </div>
                          </DialogHeader>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5">
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {validationErrorMessage}
                          </p>
                        </div>

                        {/* Action Button */}
                        <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
                          <Button 
                            type="button"
                            onClick={() => setValidationErrorOpen(false)}
                            className="h-9 px-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
                          >
                            OK
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    {/* Modal for Add Payment Method */}
                    <Dialog open={addPaymentModalOpen} onOpenChange={(open) => {
                      if (open) {
                        setAddPaymentModalOpen(true);
                        return;
                      }
                      if (isPaymentDirty()) {
                        requestExitConfirm(closeAddPaymentModalNow);
                        return;
                      }
                      closeAddPaymentModalNow();
                    }}>
                      <DialogContent showClose={false} className={`${isAddPaymentFullscreen ? 'max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh]' : 'max-w-3xl min-w-[600px]'} overflow-hidden border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter`}>
                        {/* Header with Gradient Background */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 ">
                          <DialogHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
                                  <CreditCard className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                                    Create Payment Method
                                  </DialogTitle>
                                  {/* Description removed as requested */}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {/* Extend Button */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setIsAddPaymentFullscreen(!isAddPaymentFullscreen)}
                                  className="bg-white text-blue-600 hover:bg-gray-50 font-medium px-3 py-2 rounded-lg transition-all duration-200 h-10 w-10 p-0 flex items-center justify-center border-white shadow-sm"
                                  title={isAddPaymentFullscreen ? 'Exit Fullscreen' : 'Expand'}
                                >
                                  {isAddPaymentFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (isPaymentDirty()) {
                                      requestExitConfirm(closeAddPaymentModalNow);
                                      return;
                                    }
                                    closeAddPaymentModalNow();
                                  }}
                                  className="bg-white text-indigo-600 hover:!bg-indigo-50 hover:!border-indigo-200 hover:!text-indigo-700 font-medium px-3 py-2 rounded-lg transition-all duration-200 h-10 w-10 p-0 flex items-center justify-center border-indigo-200 shadow-sm"
                                  title="Close"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </DialogHeader>
                        </div>

                        {/* Form Content */}
                        <div className="px-8 py-6">
                          <form onSubmit={handleAddPaymentMethod} className={`${isAddPaymentFullscreen ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}`}>
                            {/* Name Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Name <span className="text-red-500">*</span>
                              </Label>
                              <Input 
                                required 
                                value={paymentForm.title} 
                                onChange={e => setPaymentForm(f => ({ ...f, title: e.target.value }))}
                                onBlur={() => {
                                  // Check for duplicate name when user leaves the field
                                  if (paymentForm.title.trim()) {
                                    const duplicateName = paymentMethods.find(
                                      method => method.name?.toLowerCase().trim() === paymentForm.title.toLowerCase().trim() ||
                                                method.title?.toLowerCase().trim() === paymentForm.title.toLowerCase().trim()
                                    );
                                    
                                    if (duplicateName) {
                                      setValidationErrorMessage(`A payment method with the name "${paymentForm.title}" already exists. Please use a different name.`);
                                      setValidationErrorOpen(true);
                                    }
                                  }
                                }}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Type Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Type <span className="text-red-500">*</span>
                              </Label>
                              <select 
                                required 
                                className="w-full h-9 px-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 font-inter text-sm bg-gray-50 focus:bg-white transition-all duration-200 text-gray-900"
                                value={paymentForm.type} 
                                onChange={e => setPaymentForm(f => ({ ...f, type: e.target.value }))}
                              >
                                <option value="" className="font-inter text-sm">Select payment type</option>
                                <option value="Credit" className="font-inter text-sm">Credit Card</option>
                                <option value="Debit" className="font-inter text-sm">Debit Card</option>
                                <option value="Cash" className="font-inter text-sm">Cash</option>
                                <option value="Bank Transfer" className="font-inter text-sm">Bank Transfer</option>
                                <option value="Digital Wallet" className="font-inter text-sm">Digital Wallet</option>
                                <option value="Other" className="font-inter text-sm">Other</option>
                              </select>
                            </div>

                            {/* Owner Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Owner
                              </Label>
                              <div className="relative" ref={pmOwnerDropdownRef}>
                                <div className="relative">
                                  <Input
                                    value={pmOwnerOpen ? pmOwnerSearch : (paymentForm.owner || '')}
                                    className="w-full border-gray-300 rounded-lg h-10 p-2 pr-10 text-base focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                    placeholder="Select employee"
                                    onFocus={() => {
                                      setPmOwnerSearch('');
                                      setPmOwnerOpen(true);
                                    }}
                                    onClick={() => {
                                      setPmOwnerSearch('');
                                      setPmOwnerOpen(true);
                                    }}
                                    onChange={e => {
                                      setPmOwnerSearch(e.target.value);
                                      setPmOwnerOpen(true);
                                    }}
                                    autoComplete="off"
                                  />
                                  <ChevronDown
                                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                                    onClick={() => {
                                      if (!pmOwnerOpen) {
                                        setPmOwnerSearch('');
                                      }
                                      setPmOwnerOpen(!pmOwnerOpen);
                                    }}
                                  />
                                </div>

                                {pmOwnerOpen && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                                    {(Array.isArray(employeesRaw) ? employeesRaw : [])
                                      .filter((emp: any) => {
                                        const q = pmOwnerSearch.trim().toLowerCase();
                                        if (!q) return true;
                                        return (
                                          String(emp?.name || '').toLowerCase().includes(q) ||
                                          String(emp?.email || '').toLowerCase().includes(q)
                                        );
                                      })
                                      .sort((a: any, b: any) => {
                                        if (a.name === paymentForm.owner) return -1;
                                        if (b.name === paymentForm.owner) return 1;
                                        return 0;
                                      })
                                      .map((emp: any) => {
                                        const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                                        const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                                        const selected = paymentForm.owner === emp.name;
                                        return (
                                          <div
                                            key={emp._id || emp.id || emp.email || emp.name}
                                            className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                              selected ? 'bg-blue-50 text-blue-700' : ''
                                            }`}
                                            onClick={() => {
                                              // If already selected, clear it
                                              if (paymentForm.owner === emp.name) {
                                                setPaymentForm(f => ({ ...f, owner: '' }));
                                                setPmOwnerSearch('');
                                                setPmOwnerOpen(false);
                                                return;
                                              }
                                              const name = String(emp.name || '').trim();
                                              setPaymentForm(f => ({ ...f, owner: name }));
                                              setPmOwnerSearch('');
                                              setPmOwnerOpen(false);
                                            }}
                                          >
                                            <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                            <span className="font-normal">{displayName}</span>
                                          </div>
                                        );
                                      })}

                                    {(Array.isArray(employeesRaw) ? employeesRaw : []).length === 0 && (
                                      <div className="px-3 py-2.5 text-slate-400 text-sm">No employees found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>


                            {/* Manager Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Managed by
                              </Label>
                              <div className="relative" ref={pmManagerDropdownRef}>
                                <div className="relative">
                                  <Input
                                    value={pmManagerOpen ? pmManagerSearch : (paymentForm.manager || '')}
                                    className="w-full border-gray-300 rounded-lg h-10 p-2 pr-10 text-base focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                    placeholder="Select employee"
                                    onFocus={() => {
                                      setPmManagerSearch('');
                                      setPmManagerOpen(true);
                                    }}
                                    onClick={() => {
                                      setPmManagerSearch('');
                                      setPmManagerOpen(true);
                                    }}
                                    onChange={e => {
                                      setPmManagerSearch(e.target.value);
                                      setPmManagerOpen(true);
                                    }}
                                    autoComplete="off"
                                  />
                                  <ChevronDown
                                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer"
                                    onClick={() => {
                                      if (!pmManagerOpen) {
                                        setPmManagerSearch('');
                                      }
                                      setPmManagerOpen(!pmManagerOpen);
                                    }}
                                  />
                                </div>

                                {pmManagerOpen && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-scroll custom-scrollbar">
                                    {(Array.isArray(employeesRaw) ? employeesRaw : [])
                                      .filter((emp: any) => {
                                        const q = pmManagerSearch.trim().toLowerCase();
                                        if (!q) return true;
                                        return (
                                          String(emp?.name || '').toLowerCase().includes(q) ||
                                          String(emp?.email || '').toLowerCase().includes(q)
                                        );
                                      })
                                      .sort((a: any, b: any) => {
                                        if (a.name === paymentForm.manager) return -1;
                                        if (b.name === paymentForm.manager) return 1;
                                        return 0;
                                      })
                                      .map((emp: any) => {
                                        const duplicateNames = employeesRaw.filter((e: any) => e.name === emp.name);
                                        const displayName = duplicateNames.length > 1 ? `${emp.name} (${emp.email})` : emp.name;
                                        const selected = paymentForm.manager === emp.name;
                                        return (
                                          <div
                                            key={emp._id || emp.id || emp.email || emp.name}
                                            className={`px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center text-sm text-slate-700 transition-colors ${
                                              selected ? 'bg-blue-50 text-blue-700' : ''
                                            }`}
                                            onClick={() => {
                                              // If already selected, clear it
                                              if (paymentForm.manager === emp.name) {
                                                setPaymentForm(f => ({ ...f, manager: '' }));
                                                setPmManagerSearch('');
                                                setPmManagerOpen(false);
                                                return;
                                              }
                                              const name = String(emp.name || '').trim();
                                              setPaymentForm(f => ({ ...f, manager: name }));
                                              setPmManagerSearch('');
                                              setPmManagerOpen(false);
                                            }}
                                          >
                                            <Check className={`mr-2 h-4 w-4 text-blue-600 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                            <span className="font-normal">{displayName}</span>
                                          </div>
                                        );
                                      })}

                                    {(Array.isArray(employeesRaw) ? employeesRaw : []).length === 0 && (
                                      <div className="px-3 py-2.5 text-slate-400 text-sm">No employees found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Financial Institution Field */}
                            {paymentForm.type !== 'Cash' && (
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Financial Institution
                              </Label>
                              <Input 
                                value={paymentForm.financialInstitution} 
                                onChange={e => setPaymentForm(f => ({ ...f, financialInstitution: e.target.value }))}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>
                            )}

                            {/* Last 4 Digits Field */}
                            {paymentForm.type !== 'Cash' && (
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Last 4 Digits
                              </Label>
                              <Input 
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={paymentForm.lastFourDigits} 
                                onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  setPaymentForm(f => ({ ...f, lastFourDigits: value }));
                                }}
                                maxLength={4}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>
                            )}

                            {/* Expires At Field */}
                            {paymentForm.type !== 'Cash' && (
                            <div className={`space-y-2 ${isAddPaymentFullscreen ? 'lg:col-span-1' : 'md:col-span-1'}`}>
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Expires at
                              </Label>
                              <div className="relative">
                                <Input 
                                  type="month" 
                                  placeholder="MM/YYYY"
                                  value={paymentForm.expiresAt} 
                                  onChange={e => {
                                    const newValue = e.target.value;
                                    
                                    // Validate immediately when date is selected
                                    if (newValue) {
                                      const [year, month] = newValue.split('-');
                                      const expiryDate = new Date(parseInt(year), parseInt(month) - 1);
                                      const today = new Date();
                                      today.setDate(1);
                                      today.setHours(0, 0, 0, 0);
                                      
                                      if (expiryDate < today) {
                                        setValidationErrorMessage("Card expiry date cannot be in the past");
                                        setValidationErrorOpen(true);
                                        // Clear the invalid date
                                        setPaymentForm(f => ({ ...f, expiresAt: '' }));
                                        return;
                                      }
                                    }
                                    
                                    setPaymentForm(f => ({ ...f, expiresAt: newValue }));
                                  }}
                                  className="h-9 px-3 pr-10 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (paymentForm.expiresAt) {
                                        const [year, month] = paymentForm.expiresAt.split('-');
                                        const newYear = parseInt(year) + 1;
                                        setPaymentForm(f => ({ ...f, expiresAt: `${newYear}-${month}` }));
                                      } else {
                                        const now = new Date();
                                        setPaymentForm(f => ({ ...f, expiresAt: `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, '0')}` }));
                                      }
                                    }}
                                    className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                    title="Next year"
                                  >
                                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (paymentForm.expiresAt) {
                                        const [year, month] = paymentForm.expiresAt.split('-');
                                        const newYear = parseInt(year) - 1;
                                        setPaymentForm(f => ({ ...f, expiresAt: `${newYear}-${month}` }));
                                      } else {
                                        const now = new Date();
                                        setPaymentForm(f => ({ ...f, expiresAt: `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}` }));
                                      }
                                    }}
                                    className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                    title="Previous year"
                                  >
                                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                            )}

                            {/* Action Buttons - Full Width */}
                            <div className={`flex justify-end space-x-4 pt-6 border-t border-gray-200 ${isAddPaymentFullscreen ? 'lg:col-span-2' : 'md:col-span-2'}`}>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={closeAddPaymentModalNow} 
                                className="h-9 px-6 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-all duration-200"
                              >
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                className="h-9 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200 tracking-wide"
                              >
                                Create
                              </Button>
                            </div>
                          </form>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Payment Import Confirm Dialog */}
                    <AlertDialog open={paymentImportConfirmOpen} onOpenChange={setPaymentImportConfirmOpen}>
                      <AlertDialogContent className="bg-white text-gray-900 border border-gray-200">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Do you have a file to import?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Select Yes to choose a file. Select No to download the template.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel
                            className="bg-red-600 text-white hover:bg-red-700 border-red-600 hover:border-red-700"
                            onClick={() => {
                              downloadPaymentTemplate();
                              setPaymentImportConfirmOpen(false);
                            }}
                          >
                            No
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-green-600 text-white hover:bg-green-700"
                            onClick={() => {
                              setPaymentImportConfirmOpen(false);
                              setTimeout(() => paymentFileInputRef.current?.click(), 0);
                            }}
                          >
                            Yes
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Card>
                </motion.div>
              </TabsContent>
              
              <TabsContent value="custom-field" className="mt-4 h-[calc(100vh-200px)] overflow-hidden">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="h-full overflow-auto overflow-x-hidden"
                >
                  <div className="space-y-6 pb-6">
                    {/* Custom Field Error Dialog */}
                    <Dialog open={customFieldErrorOpen} onOpenChange={setCustomFieldErrorOpen}>
                      <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
                        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
                          <DialogHeader>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <AlertCircle className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-white">Error</DialogTitle>
                                <p className="text-red-100 mt-0.5 text-sm font-medium">Please review and try again</p>
                              </div>
                            </div>
                          </DialogHeader>
                        </div>

                        <div className="px-6 py-5">
                          <p className="text-gray-700 text-sm leading-relaxed">{customFieldErrorMessage}</p>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCustomFieldErrorOpen(false)}
                            className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
                          >
                            OK
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Custom Field Delete Confirmation */}
                    <Dialog
                      open={customFieldDeleteConfirmOpen}
                      onOpenChange={(open) => {
                        setCustomFieldDeleteConfirmOpen(open);
                        if (!open) setCustomFieldPendingDelete(null);
                      }}
                    >
                      <DialogContent className="max-w-md border-0 shadow-2xl p-0 bg-white overflow-hidden font-inter">
                        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
                          <DialogHeader>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Trash2 className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-white">Delete Field</DialogTitle>
                                <p className="text-red-100 mt-0.5 text-sm font-medium">This action cannot be undone</p>
                              </div>
                            </div>
                          </DialogHeader>
                        </div>

                        <div className="px-6 py-5">
                          {customFieldPendingDelete ? (
                            <p className="text-gray-700 text-sm leading-relaxed mb-4">
                              Are you sure you want to delete the field{' '}
                              <span className="font-semibold text-gray-900">
                                "<span
                                  className="max-w-[200px] inline-block truncate align-bottom"
                                  title={customFieldPendingDelete.name}
                                >
                                  {customFieldPendingDelete.name}
                                </span>"
                              </span>
                              ?
                            </p>
                          ) : (
                            <p className="text-gray-700 text-sm leading-relaxed mb-4">Are you sure you want to delete this field?</p>
                          )}
                          <p className="text-gray-600 text-xs leading-relaxed">
                            This will permanently remove this field and all associated data from your system.
                          </p>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-100">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCustomFieldDeleteConfirmOpen(false);
                              setCustomFieldPendingDelete(null);
                            }}
                            className="h-9 px-5 border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-all duration-200"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              const target = customFieldPendingDelete;
                              setCustomFieldDeleteConfirmOpen(false);
                              setCustomFieldPendingDelete(null);
                              if (!target) return;

                              if (target.kind === 'subscription') {
                                void deleteField(target.name);
                              } else if (target.kind === 'compliance') {
                                void deleteComplianceField(target.id);
                              } else {
                                void deleteRenewalField(target.id);
                              }
                            }}
                            className="h-9 px-6 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200"
                          >
                            Delete
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
                      <div className="flex items-center gap-4">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md"
                        >
                          <Layers className="text-white" size={20} />
                        </motion.div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Custom field</h3>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md"
                        >
                          <Settings className="text-white" size={20} />
                        </motion.div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 font-inter">Subscription Fields</h3>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                          <Input
                            value={newFieldName}
                            onChange={(e) => setNewFieldName(e.target.value)}
                            className="w-80 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 font-inter"
                            onKeyPress={(e) => e.key === 'Enter' && addNewField()}
                            placeholder="Enter field name"
                          />
                          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button
                              onClick={addNewField}
                              disabled={!newFieldName.trim()}
                              className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg font-inter"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              New Field
                            </Button>
                          </motion.div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-base font-semibold text-gray-900">Available Fields</h3>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 h-64 md:h-72 lg:h-80 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                              </div>
                            ) : fields.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-gray-500">
                                No fields configured. Add your first field above.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {fields.map((field) => (
                                <motion.div
                                  key={field.name}
                                  whileHover={{ y: -5 }}
                                  className={`p-4 border rounded-xl transition-all duration-300 ${
                                    field.enabled
                                      ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                      : 'border-gray-200 bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <Checkbox
                                        checked={field.enabled}
                                        onCheckedChange={(checked: boolean) => updateFieldEnablement(field.name, checked)}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded"
                                      />
                                      <Label className="text-sm font-medium cursor-pointer text-gray-900">
                                        {field.name}
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {field.enabled ? (
                                        <Badge className="bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full">
                                          <Eye className="w-3 h-3 mr-1" />
                                          Enabled
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-gray-100 text-gray-600 text-xs font-semibold py-1 px-3 rounded-full">
                                          <EyeOff className="w-3 h-3 mr-1" />
                                          Disabled
                                        </Badge>
                                      )}
                                      <button
                                        className="text-red-500 hover:text-red-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300"
                                        title="Delete field"
                                        onClick={() => requestDeleteCustomField({ kind: 'subscription', name: field.name })}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </Card>

                    <Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md"
                        >
                          <Shield className="text-white" size={20} />
                        </motion.div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 font-inter">Compliance Fields</h3>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                          <Input
                            value={newComplianceFieldName}
                            onChange={(e) => setNewComplianceFieldName(e.target.value)}
                            className="w-80 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 font-inter"
                            onKeyPress={(e) => e.key === 'Enter' && addNewComplianceField()}
                          />
                          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button
                              onClick={addNewComplianceField}
                              disabled={!newComplianceFieldName.trim()}
                              className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg font-inter"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              New Field
                            </Button>
                          </motion.div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-base font-semibold text-gray-900">Available Compliance Fields</h3>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 h-64 md:h-72 lg:h-80 overflow-y-auto custom-scrollbar">
                            {isLoadingCompliance ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                              </div>
                            ) : complianceFields.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-gray-500">
                                No compliance fields configured. Add your first field above.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {complianceFields.map((field) => (
                                <motion.div
                                  key={field._id || field.name}
                                  whileHover={{ y: -5 }}
                                  className={`p-4 border rounded-xl transition-all duration-300 ${
                                    field.enabled
                                      ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                      : 'border-gray-200 bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <Checkbox
                                        checked={field.enabled}
                                        onCheckedChange={(checked: boolean) => updateComplianceFieldEnablement(field.name, checked)}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded"
                                      />
                                      <Label className="text-sm font-medium cursor-pointer text-gray-900">
                                        {field.name}
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {field.enabled ? (
                                        <Badge className="bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full">
                                          <Eye className="w-3 h-3 mr-1" />
                                          Enabled
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-gray-100 text-gray-600 text-xs font-semibold py-1 px-3 rounded-full">
                                          <EyeOff className="w-3 h-3 mr-1" />
                                          Disabled
                                        </Badge>
                                      )}
                                      <button
                                        className={`text-red-500 hover:text-red-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300 ${!field._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={field._id ? "Delete field" : "Cannot delete: missing id. Please refresh or re-add this field."}
                                        onClick={() => {
                                          if (!field._id) {
                                            showCustomFieldError('Cannot delete this field right now. Please refresh the page and try again.');
                                            return;
                                          }
                                          requestDeleteCustomField({ kind: 'compliance', id: field._id, name: field.name });
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </Card>

                    <Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md"
                        >
                          <ShieldCheck className="text-white" size={20} />
                        </motion.div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 font-inter">Renewal Fields</h3>
                          <p className="text-gray-500 text-sm">Configure renewal custom fields</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                          <Input
                            value={newRenewalFieldName}
                            onChange={(e) => setNewRenewalFieldName(e.target.value)}
                            className="w-80 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 font-inter"
                            onKeyPress={(e) => e.key === 'Enter' && addNewRenewalField()}
                            placeholder="Enter field name"
                          />
                          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button
                              onClick={addNewRenewalField}
                              disabled={!newRenewalFieldName.trim()}
                              className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg font-inter"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              New Field
                            </Button>
                          </motion.div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-base font-semibold text-gray-900">Available Renewal Fields</h3>

                          <div className="bg-white border border-gray-200 rounded-xl p-4 h-64 md:h-72 lg:h-80 overflow-y-auto custom-scrollbar">
                            {isLoadingRenewal ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                              </div>
                            ) : renewalFields.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-gray-500">
                                No renewal fields configured. Add your first field above.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {renewalFields.map((field) => (
                                <motion.div
                                  key={field._id || field.name}
                                  whileHover={{ y: -5 }}
                                  className={`p-4 border rounded-xl transition-all duration-300 ${
                                    field.enabled
                                      ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                                      : 'border-gray-200 bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <Checkbox
                                        checked={field.enabled}
                                        onCheckedChange={(checked: boolean) => field._id && updateRenewalFieldEnablement(field._id, checked)}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 rounded"
                                        disabled={!field._id}
                                      />
                                      <Label className="text-sm font-medium cursor-pointer text-gray-900">
                                        {field.name}
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {field.enabled ? (
                                        <Badge className="bg-indigo-100 text-indigo-800 text-xs font-semibold py-1 px-3 rounded-full">
                                          <Eye className="w-3 h-3 mr-1" />
                                          Enabled
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-gray-100 text-gray-600 text-xs font-semibold py-1 px-3 rounded-full">
                                          <EyeOff className="w-3 h-3 mr-1" />
                                          Disabled
                                        </Badge>
                                      )}
                                      <button
                                        className={`text-red-500 hover:text-red-700 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-300 ${!field._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={field._id ? "Delete field" : "Cannot delete: missing id. Please refresh or re-add this field."}
                                        onClick={() => {
                                          if (!field._id) {
                                            showCustomFieldError('Cannot delete this field right now. Please refresh the page and try again.');
                                            return;
                                          }
                                          requestDeleteCustomField({ kind: 'renewal', id: field._id, name: field.name });
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </Card>
                  </div>
                </motion.div>
              </TabsContent>
            </AnimatePresence>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function Configuration() {
  const { section } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Legacy routes (merged into Custom field)
  useEffect(() => {
    if (section === 'subscription' || section === 'compliance' || section === 'reminder') {
      navigate('/configuration/custom-field', { replace: true });
    }
  }, [navigate, section]);

  useEffect(() => {
    if (location.pathname === "/reminders") {
      navigate("/configuration", { replace: true });
    }
  }, [location.pathname, navigate]);

  const resolvedSection: ConfigSection | null =
    section === 'subscription' || section === 'compliance' || section === 'reminder'
      ? 'custom-field'
      : section && isConfigSection(section)
        ? section
        : null;

  if (!resolvedSection) {
    return <ConfigurationLanding />;
  }

  return <ConfigurationContent section={resolvedSection} />;
}
