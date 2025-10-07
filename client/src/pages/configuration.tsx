import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings, Eye, EyeOff, CreditCard, Shield, Bell, Banknote, DollarSign, Edit, Trash2, Maximize2, Minimize2, Search } from "lucide-react";
import { cardImages } from "@/assets/card-icons/cardImages";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/lib/config";
export default function Configuration() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Handle tab switching from URL parameters
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return tabParam || 'currency';
  });
  
  // Update tab when URL changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [editingRates, setEditingRates] = useState<{ [key: string]: string }>({});
  // Delete payment method handler (DELETE from backend)
  const handleDeletePaymentMethod = (method: any) => {
    if (!method._id) {
      toast({ title: "Error", description: "Cannot delete: missing id", variant: "destructive" });
      return;
    }
    fetch(`/api/payment/${method._id}`, { method: "DELETE" })
      .then(res => res.json())
      .then(() => {
        fetch("/api/payment")
          .then(res => res.json())
          .then(data => setPaymentMethods(data));
  queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
        toast({
          title: "Payment Method Deleted",
          description: `Payment method has been deleted successfully`,
          variant: "destructive",
        });
      });
  };
  
  // Edit payment method logic
  const openEditPayment = (method: any) => {
    setPaymentForm({
      title: method.title || method.name || '',
      type: method.type || '',
      description: method.description || '',
      icon: method.icon || '',
      manager: method.manager || '',
      expiresAt: method.expiresAt || '',
    });
    setEditPaymentModalOpen(true);
    setEditingPaymentId(method._id);
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
  fetch(`/api/payment/${editingPaymentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: paymentForm.title,
        type: paymentForm.type,
        description: paymentForm.description,
        icon: paymentForm.icon,
        manager: paymentForm.manager,
        expiresAt: paymentForm.expiresAt,
      }),
    })
      .then(res => res.json())
      .then(() => {
        fetch("/api/payment")
          .then(res => res.json())
          .then(data => setPaymentMethods(data));
  queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
        setEditPaymentModalOpen(false);
        setEditingPaymentId(null);
        toast({
          title: "Payment Method Updated",
          description: `Payment method has been updated successfully`,
        });
      });
  };
  
  // Edit Payment Method Modal state
  const [editPaymentModalOpen, setEditPaymentModalOpen] = useState(false);
  
  // Payment methods state (now loaded from backend)
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  // Fetch payment methods from backend on mount
  useEffect(() => {
    fetch("/api/payment")
      .then(res => res.json())
      .then(data => setPaymentMethods(data))
      .catch(() => setPaymentMethods([]));
  }, []);
  
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
  
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<{ defaultCurrency?: string }>({});
  
  // Fetch currencies and company info on mount and when currency/exchange dialogs toggle (refresh after saves)
  useEffect(() => {
    fetchCurrencies();
    fetchCompanyInfo();
  }, [addCurrencyOpen]);
  
  const fetchCurrencies = async () => {
    try {
      setCurrenciesLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/currencies`, { credentials: "include" });
      const data = await res.json();
      const currenciesArray = Array.isArray(data) ? data : [];
      
      // Fetch latest exchange rates for each currency
      const currenciesWithRates = await Promise.all(
        currenciesArray.map(async (currency) => {
          try {
            const rateRes = await fetch(`${API_BASE_URL}/api/exchange-rates/${currency.code}`, { credentials: "include" });
            if (rateRes.ok) {
              const rates = await rateRes.json();
              if (Array.isArray(rates) && rates.length > 0) {
                // Get the most recent rate
                const latestRate = rates[rates.length - 1];
                return {
                  ...currency,
                  latestRate: latestRate.rate || latestRate.relRate || '-'
                };
              }
            }
            return { ...currency, latestRate: '-' };
          } catch {
            return { ...currency, latestRate: '-' };
          }
        })
      );
      
      setCurrencies(currenciesWithRates);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      setCurrencies([]);
      toast({
        title: "Error",
        description: "Failed to load currencies",
        variant: "destructive",
      });
    } finally {
      setCurrenciesLoading(false);
    }
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
          setAddCurrencyOpen(false);
          toast({
            title: isEditMode ? "Currency Updated" : "Currency Added",
            description: `${newCurrency.name} currency has been ${isEditMode ? 'updated' : 'added'} successfully`,
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

  // Update currency rates handler
  const updateCurrencyRates = async () => {
    try {
      const currentTimestamp = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      });
      
      const updates = Object.entries(editingRates).map(async ([code, rate]) => {
        const res = await fetch(`${API_BASE_URL}/api/currencies/${code}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            exchangeRate: rate,
            lastUpdated: currentTimestamp,
          }),
        });
        return res.ok;
      });

      const results = await Promise.all(updates);
      const allSuccessful = results.every(result => result);

      if (allSuccessful) {
        await fetchCurrencies(); // Refresh the list
        setIsUpdateMode(false);
        setEditingRates({});
        toast({
          title: "Currency Rates Updated",
          description: "All currency rates have been updated successfully",
        });
      } else {
        toast({
          title: "Partial Update",
          description: "Some currency rates failed to update",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update currency rates",
        variant: "destructive",
      });
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
  
  const { toast } = useToast();
  
  // Fetch enabled fields from backend on mount
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/config/fields')
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
    fetch('/api/config/compliance-fields')
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
  
  // Add new field and persist to backend immediately
  const addNewField = async () => {
    if (newFieldName.trim() && !fields.find(f => f.name.toLowerCase() === newFieldName.toLowerCase())) {
      const updatedFields = [
        ...fields,
        {
          name: newFieldName.trim(),
          enabled: true
        }
      ];
      setFields(updatedFields); // Optimistic update
      setNewFieldName('');
      try {
        const response = await fetch('/api/config/fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: updatedFields }),
        });
        if (!response.ok) throw new Error('Failed to save fields');
        // Refetch from backend to ensure UI is in sync
        const fetchRes = await fetch('/api/config/fields');
        const data = await fetchRes.json();
        setFields(Array.isArray(data) ? data : updatedFields);
        toast({
          title: "Field Added",
          description: `${newFieldName} field has been added successfully`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save new field to backend",
          variant: "destructive",
        });
      }
    }
  };
  
  // Add new compliance field using new backend API (POST single field)
  const addNewComplianceField = async () => {
    const name = newComplianceFieldName.trim();
    if (!name || complianceFields.find(f => f.name.toLowerCase() === name.toLowerCase())) return;
    setIsLoadingCompliance(true);
    try {
      const response = await fetch('/api/config/compliance-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          enabled: true,
          fieldType: 'compliance',
        }),
      });
      if (!response.ok) throw new Error('Failed to save compliance field');
      setNewComplianceFieldName('');
      // Refetch from backend to ensure UI is in sync
      const fetchRes = await fetch('/api/config/compliance-fields');
      const data = await fetchRes.json();
      setComplianceFields(Array.isArray(data) ? data : []);
      toast({
        title: "Compliance Field Added",
        description: `${name} field has been added successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save new compliance field to backend",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCompliance(false);
    }
  };
  
  const updateFieldEnablement = (fieldName: string, enabled: boolean) => {
    setFields(prev => prev.map(f =>
      f.name === fieldName ? { ...f, enabled } : f
    ));
  };
  
  // Update compliance field enablement using PATCH (new API)
  const updateComplianceFieldEnablement = async (fieldName: string, enabled: boolean) => {
    const field = complianceFields.find(f => f.name === fieldName);
    if (!field || !field._id) return;
    setIsLoadingCompliance(true);
    try {
      const response = await fetch(`/api/config/compliance-fields/${field._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Failed to update compliance field');
      // Refetch
      const fetchRes = await fetch('/api/config/compliance-fields');
      const data = await fetchRes.json();
      setComplianceFields(Array.isArray(data) ? data : complianceFields);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update compliance field",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCompliance(false);
    }
  };
  
  // Save enabled fields to backend and refetch after save
  const saveFieldSettings = async () => {
    try {
      const response = await fetch('/api/config/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!response.ok) throw new Error('Failed to save fields');
      // Refetch from backend to ensure UI is in sync
      const fetchRes = await fetch('/api/config/fields');
      const data = await fetchRes.json();
      setFields(Array.isArray(data) ? data : fields);
      toast({
        title: "Settings Saved",
        description: "Field enablement configuration has been saved successfully",
      });
    } catch (error) {
      console.error("Error saving fields:", error);
      toast({
        title: "Error",
        description: "Failed to save field configuration",
        variant: "destructive",
      });
    }
  };
  
  // Save compliance fields: update all fields (enabled/disabled/order) using PATCH for each field
  const saveComplianceFieldSettings = async () => {
    setIsLoadingCompliance(true);
    try {
      // Update all fields in parallel
      await Promise.all(complianceFields.map(async (field) => {
        if (!field._id) return;
        await fetch(`/api/config/compliance-fields/${field._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: field.enabled,
            displayOrder: field.displayOrder,
          }),
        });
      }));
      // Refetch
      const fetchRes = await fetch('/api/config/compliance-fields');
      const data = await fetchRes.json();
      setComplianceFields(Array.isArray(data) ? data : complianceFields);
      toast({
        title: "Compliance Settings Saved",
        description: "Compliance field configuration has been saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save compliance field configuration",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCompliance(false);
    }
  };
  
  // Delete field from backend
  const deleteField = async (fieldName: string) => {
    const updatedFields = fields.filter(f => f.name !== fieldName);
    setFields(updatedFields);
    try {
      const response = await fetch('/api/config/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: updatedFields }),
      });
      if (!response.ok) throw new Error('Failed to delete field');
      // Refetch from backend to ensure UI is in sync
      const fetchRes = await fetch('/api/config/fields');
      const data = await fetchRes.json();
      setFields(Array.isArray(data) ? data : updatedFields);
      toast({
        title: "Field Deleted",
        description: `${fieldName} field has been deleted successfully`,
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete field from backend",
        variant: "destructive",
      });
    }
  };
  
  // Delete compliance field using DELETE (new API, by _id)
  const deleteComplianceField = async (fieldNameOrId: string) => {
    // Try to find by _id first, fallback to name for legacy UI
    let field = complianceFields.find(f => f._id === fieldNameOrId);
    if (!field) field = complianceFields.find(f => f.name === fieldNameOrId);
    if (!field || !field._id) {
      toast({
        title: "Error",
        description: "Field not found or missing id",
        variant: "destructive",
      });
      return;
    }
    setIsLoadingCompliance(true);
    try {
      const response = await fetch(`/api/config/compliance-fields/${field._id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete compliance field');
      // Refetch
      const fetchRes = await fetch('/api/config/compliance-fields');
      const data = await fetchRes.json();
      setComplianceFields(Array.isArray(data) ? data : complianceFields);
      toast({
        title: "Compliance Field Deleted",
        description: `${field.name} field has been deleted successfully`,
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete compliance field from backend",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCompliance(false);
    }
  };
  
  // (Removed) Demo credit card details state
  
  // Deprecated demo handlers removed
  
  // Handler for adding a new payment method (POST to backend)
  function handleAddPaymentMethod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paymentForm.title.trim() || !paymentForm.type.trim()) return;
  fetch("/api/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: paymentForm.title,
        type: paymentForm.type,
        description: paymentForm.description,
        icon: paymentForm.icon,
        manager: paymentForm.manager,
        expiresAt: paymentForm.expiresAt,
      }),
    })
      .then(res => res.json())
      .then(() => {
        // Refetch payment methods after adding
        fetch("/api/payment")
          .then(res => res.json())
          .then(data => setPaymentMethods(data));
  queryClient.invalidateQueries({ queryKey: ["/api/payment"] });
        setAddPaymentModalOpen(false);
        setPaymentForm({
          title: '',
          type: '',
          description: '',
          icon: '',
          manager: '',
          expiresAt: '',
        });
        toast({ title: 'Payment method added', description: 'A new payment method has been added.' });
      });
  }
  
  // --- Payment Method Modal State ---
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [isAddPaymentFullscreen, setIsAddPaymentFullscreen] = useState(false);
  const [isEditPaymentFullscreen, setIsEditPaymentFullscreen] = useState(false);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    title: '',
    type: '',
    description: '',
    icon: '',
    manager: '',
    expiresAt: '',
  });
  
  // Card image options for payment method
  const iconOptions = [
    { value: 'visa', label: 'Visa', img: cardImages.visa },
    { value: 'mastercard', label: 'MasterCard', img: cardImages.mastercard },
    { value: 'paypal', label: 'PayPal', img: cardImages.paypal },
    { value: 'amex', label: 'Amex', img: cardImages.amex },
    { value: 'apple_pay', label: 'Apple Pay', img: cardImages.apple_pay },
    { value: 'google_pay', label: 'Google Pay', img: cardImages.google_pay },
    { value: 'bank', label: 'Bank', img: cardImages.bank },
    { value: 'cash', label: 'Cash', img: cardImages.cash },
    { value: 'other', label: 'Other', img: cardImages.other },
  ];
  
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Modern Professional Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Setup & Configuration</h1>
            </div>
          </div>
        </div>

        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="flex w-full bg-white rounded-lg p-1 shadow-sm mb-6 font-inter gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <TabsTrigger
                  value="currency"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-md focus:outline-none transition-all duration-300 font-inter
                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
                  text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Currency</span>
                </TabsTrigger>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <TabsTrigger
                  value="payment"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-md focus:outline-none transition-all duration-300 font-inter
                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
                  text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <Banknote className="w-4 h-4" />
                  <span>Payment Methods</span>
                </TabsTrigger>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <TabsTrigger
                  value="reminder"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-md focus:outline-none transition-all duration-300 font-inter
                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
                  text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <Bell className="w-4 h-4" />
                  <span>Reminder Policy</span>
                </TabsTrigger>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <TabsTrigger
                  value="subscription"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-md focus:outline-none transition-all duration-300 font-inter
                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
                  text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Subscription</span>
                </TabsTrigger>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <TabsTrigger
                  value="compliance"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-md focus:outline-none transition-all duration-300 font-inter
                  data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-inner
                  text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <Shield className="w-4 h-4" />
                  <span>Compliance</span>
                </TabsTrigger>
              </motion.div>
            </TabsList>
            
                <AnimatePresence mode="wait">
                  <TabsContent value="currency" className="mt-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="p-6 bg-white">
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex gap-2 items-center">
                            <DollarSign className="w-5 h-5" />
                            <h3 className="text-xl font-semibold">Currency Management</h3>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* Local Currency Display */}
                            <div className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                              <div className="text-center">
                                <span className="text-sm text-gray-600 font-medium block">Local Currency</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-lg font-semibold text-blue-600">
                                    {companyInfo.defaultCurrency || 'Not Set'}
                                  </span>
                                  {companyInfo.defaultCurrency && (
                                    <span className="text-sm text-gray-500">
                                      ({currencies.find(c => c.code === companyInfo.defaultCurrency)?.symbol || '$'})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              {isUpdateMode ? (
                                <>
                                  <Button
                                    variant="outline"
                                    onClick={cancelUpdateMode}
                                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={updateCurrencyRates}
                                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold shadow-md"
                                  >
                                    Save Changes
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    onClick={enterUpdateMode}
                                    disabled={currencies.length === 0}
                                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Update Currency
                                  </Button>
                                  <Button
                                    className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md"
                                    style={{ boxShadow: '0 2px 8px rgba(99,102,241,0.15)' }}
                                    onClick={() => {
                                      setIsEditMode(false);
                                      setAddCurrencyOpen(true);
                                    }}
                                  >Add Currency</Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <Dialog open={addCurrencyOpen} onOpenChange={(open) => {
                          if (!open) {
                            // Reset form when modal closes
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
                          }
                          setAddCurrencyOpen(open);
                        }}>
                          <DialogContent className="max-w-2xl min-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter">
                            {/* Header with Gradient Background */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
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
                              <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Currency Code Field */}
                                <div className="space-y-2">
                                  <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                    Currency Code <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    value={newCurrency.code}
                                    onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value })}
                                    className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                                  />
                                </div>

                                {/* Description Field */}
                                <div className="space-y-2">
                                  <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                    Description <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    value={newCurrency.name}
                                    onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                                    className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                                  />
                                </div>

                                {/* Symbol Field */}
                                <div className="space-y-2">
                                  <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                    Symbol <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    value={newCurrency.symbol}
                                    onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                                    className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                                  />
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
                                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 md:col-span-2">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setAddCurrencyOpen(false)} 
                                    className="h-9 px-6 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-all duration-200"
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={() => {
                                      addNewCurrency();
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
                        {currenciesLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="text-gray-500">Loading currencies...</div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                          <div className="rounded-md border shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-900">CURRENCY CODE</th>
                                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-900">DESCRIPTION</th>
                                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-900">SYMBOL</th>
                                  <th className={`py-3 px-4 text-left text-sm font-semibold ${isUpdateMode ? 'text-blue-600 bg-blue-50' : 'text-gray-900'}`}>
                                    Exch.Rate against 1 LCY {isUpdateMode && <span className="text-xs">(Editable)</span>}
                                  </th>
                                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-900">CREATED</th>
                                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-900">LAST UPDATED</th>
                                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-900">ACTIONS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                {currencies.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="py-8 text-center text-gray-500">
                                      No currencies found. Add your first currency to get started.
                                    </td>
                                  </tr>
                                ) : (
                                  currencies.map((currency) => (
                                  <tr key={currency.code}>
                                    <td className="py-3 px-4 text-sm text-gray-900">{currency.code}</td>
                                    <td className="py-3 px-4 text-sm text-gray-900">{currency.name}</td>
                                    <td className="py-3 px-4 text-sm text-gray-900">{currency.symbol}</td>
                                    <td className="py-3 px-4 text-sm text-gray-500">
                                      {isUpdateMode ? (
                                        <Input
                                          type="number"
                                          step="0.0001"
                                          min="0"
                                          value={editingRates[currency.code] || ''}
                                          onChange={(e) => handleRateChange(currency.code, e.target.value)}
                                          className="w-24 h-8 text-sm border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                                          placeholder="Rate"
                                        />
                                      ) : (
                                        currency.exchangeRate || '-'
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500">
                                      {currency.created || 'Sep 25, 2025'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500">
                                      {currency.lastUpdated ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                          {currency.lastUpdated}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      {!isUpdateMode && (
                                        <div className="flex gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
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
                                            }}
                                          >
                                            <Edit className="h-4 w-4 text-blue-500" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => deleteCurrency(currency.code)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        )}
                      </Card>
                    </motion.div>
                  </TabsContent>
              
              <TabsContent value="payment" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          value={paymentSearchTerm}
                          onChange={(e) => setPaymentSearchTerm(e.target.value)}
                          className="pl-10 w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 bg-gray-50 focus:bg-white transition-all duration-200"
                        />
                      </div>
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Button
                          onClick={() => setAddPaymentModalOpen(true)}
                          className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Payment Method
                        </Button>
                      </motion.div>
                    </div>
                    {/* Payment Methods List */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paymentMethods
                        .filter(method => 
                          method.name.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
                          method.type.toLowerCase().includes(paymentSearchTerm.toLowerCase())
                        )
                        .map((method, idx) => {
                        const iconObj = iconOptions.find(opt => opt.value === method.icon);
                        return (
                          <motion.div 
                            key={idx} 
                            whileHover={{ scale: 1.02 }}
                            className="bg-white border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              {iconObj ? (
                                <div className="flex-shrink-0 p-2 bg-gray-100 rounded-lg">
                                  <img src={iconObj.img} alt={iconObj.label} className="w-10 h-6 object-contain" />
                                </div>
                              ) : (
                                <div className="w-14 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                                  <CreditCard className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{method.name}</div>
                                <div className="text-sm text-gray-500">{method.type}</div>
                              </div>
                            </div>
                            
                            {method.description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{method.description}</p>
                            )}
                            
                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => openEditPayment(method)} 
                                className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg px-3 py-1 h-8 font-medium"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => handleDeletePaymentMethod(method)} 
                                className="text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg px-3 py-1 h-8 font-medium"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                      
                      {paymentMethods.filter(method => 
                        method.name.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
                        method.type.toLowerCase().includes(paymentSearchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
                          <CreditCard className="w-12 h-12 mb-4 text-gray-300" />
                          <h3 className="text-lg font-medium text-gray-600 mb-2">
                            {paymentSearchTerm ? 'No payment methods found' : 'No payment methods yet'}
                          </h3>
                          <p className="text-center max-w-md">
                            {paymentSearchTerm 
                              ? `No payment methods match "${paymentSearchTerm}". Try adjusting your search.`
                              : 'Add your first payment method to get started with managing your subscription payments.'
                            }
                          </p>
                        </div>
                      )}
                    </div>
                    {/* Edit Payment Method Modal */}
                    <Dialog open={editPaymentModalOpen} onOpenChange={setEditPaymentModalOpen}>
                      <DialogContent className={`${isEditPaymentFullscreen ? 'max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh]' : 'max-w-3xl min-w-[600px] max-h-[85vh]'} overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter`}>
                        {/* Header with Gradient Background */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 rounded-t-2xl">
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
                              
                              {/* Extend Button */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsEditPaymentFullscreen(!isEditPaymentFullscreen)}
                                className="bg-white text-indigo-600 hover:bg-gray-50 font-medium px-3 py-2 rounded-lg transition-all duration-200 h-10 w-10 p-0 flex items-center justify-center border-white shadow-sm"
                              >
                                {isEditPaymentFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </DialogHeader>
                        </div>

                        {/* Form Content */}
                        <div className="px-8 py-6">
                          <form onSubmit={handleEditPaymentMethod} className={`${isEditPaymentFullscreen ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}`}>
                            {/* Title Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Title <span className="text-red-500">*</span>
                              </Label>
                              <Input 
                                required 
                                value={paymentForm.title} 
                                onChange={e => setPaymentForm(f => ({ ...f, title: e.target.value }))}
                                placeholder=""
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
                                className="w-full h-9 px-3 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-20 font-medium bg-gray-50 focus:bg-white transition-all duration-200 text-gray-900"
                                value={paymentForm.type} 
                                onChange={e => setPaymentForm(f => ({ ...f, type: e.target.value }))}
                              >
                                <option value="">Select payment type</option>
                                <option value="Credit">Credit Card</option>
                                <option value="Debit">Debit Card</option>
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Digital Wallet">Digital Wallet</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            {/* Description Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Description
                              </Label>
                              <Input 
                                value={paymentForm.description} 
                                onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))}
                                placeholder=""
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Manager Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Managed by
                              </Label>
                              <Input 
                                value={paymentForm.manager} 
                                onChange={e => setPaymentForm(f => ({ ...f, manager: e.target.value }))}
                                placeholder=""
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Expires At Field */}
                            <div className={`space-y-2 ${isEditPaymentFullscreen ? 'lg:col-span-1' : 'md:col-span-1'}`}>
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Expires at
                              </Label>
                              <Input 
                                type="date" 
                                value={paymentForm.expiresAt} 
                                onChange={e => setPaymentForm(f => ({ ...f, expiresAt: e.target.value }))}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Card Image Selection - Full Width */}
                            <div className={`space-y-3 ${isEditPaymentFullscreen ? 'lg:col-span-2' : 'md:col-span-2'}`}>
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Card Image
                              </Label>
                              <div className={`grid gap-3 ${isEditPaymentFullscreen ? 'grid-cols-6 lg:grid-cols-9' : 'grid-cols-6 lg:grid-cols-9'}`}>
                                {iconOptions.map(opt => (
                                  <button
                                    type="button"
                                    key={opt.value}
                                    className={`relative p-3 border-2 rounded-lg bg-white hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 ${
                                      paymentForm.icon === opt.value 
                                        ? 'border-indigo-500 bg-indigo-50 shadow-lg ring-2 ring-indigo-500 ring-opacity-20' 
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => setPaymentForm(f => ({ ...f, icon: opt.value }))}
                                    title={opt.label}
                                  >
                                    <img src={opt.img} alt={opt.label} className="w-12 h-8 object-contain mx-auto" />
                                    {paymentForm.icon === opt.value && (
                                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Action Buttons - Full Width */}
                            <div className={`flex justify-end space-x-4 pt-6 border-t border-gray-200 ${isEditPaymentFullscreen ? 'lg:col-span-2' : 'md:col-span-2'}`}>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setEditPaymentModalOpen(false)} 
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
                    {/* Modal for Add Payment Method */}
                    <Dialog open={addPaymentModalOpen} onOpenChange={setAddPaymentModalOpen}>
                      <DialogContent className={`${isAddPaymentFullscreen ? 'max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh]' : 'max-w-3xl min-w-[600px] max-h-[85vh]'} overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white transition-[width,height] duration-300 font-inter`}>
                        {/* Header with Gradient Background */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
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
                              
                              {/* Extend Button */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsAddPaymentFullscreen(!isAddPaymentFullscreen)}
                                className="bg-white text-blue-600 hover:bg-gray-50 font-medium px-3 py-2 rounded-lg transition-all duration-200 h-10 w-10 p-0 flex items-center justify-center border-white shadow-sm"
                              >
                                {isAddPaymentFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </DialogHeader>
                        </div>

                        {/* Form Content */}
                        <div className="px-8 py-6">
                          <form onSubmit={handleAddPaymentMethod} className={`${isAddPaymentFullscreen ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}`}>
                            {/* Title Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Title <span className="text-red-500">*</span>
                              </Label>
                              <Input 
                                required 
                                value={paymentForm.title} 
                                onChange={e => setPaymentForm(f => ({ ...f, title: e.target.value }))}
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
                                className="w-full h-9 px-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 font-medium bg-gray-50 focus:bg-white transition-all duration-200 text-gray-900"
                                value={paymentForm.type} 
                                onChange={e => setPaymentForm(f => ({ ...f, type: e.target.value }))}
                              >
                                <option value="">Select payment type</option>
                                <option value="Credit">Credit Card</option>
                                <option value="Debit">Debit Card</option>
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Digital Wallet">Digital Wallet</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            {/* Description Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Description
                              </Label>
                              <Input 
                                value={paymentForm.description} 
                                onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Manager Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Managed by
                              </Label>
                              <Input 
                                value={paymentForm.manager} 
                                onChange={e => setPaymentForm(f => ({ ...f, manager: e.target.value }))}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Expires At Field */}
                            <div className={`space-y-2 ${isAddPaymentFullscreen ? 'lg:col-span-1' : 'md:col-span-1'}`}>
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Expires at
                              </Label>
                              <Input 
                                type="date" 
                                value={paymentForm.expiresAt} 
                                onChange={e => setPaymentForm(f => ({ ...f, expiresAt: e.target.value }))}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Card Image Selection - Full Width */}
                            <div className={`space-y-3 ${isAddPaymentFullscreen ? 'lg:col-span-2' : 'md:col-span-2'}`}>
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Card Image
                              </Label>
                              <div className={`grid gap-3 ${isAddPaymentFullscreen ? 'grid-cols-6 lg:grid-cols-9' : 'grid-cols-6 lg:grid-cols-9'}`}>
                                {iconOptions.map(opt => (
                                  <button
                                    type="button"
                                    key={opt.value}
                                    className={`relative p-3 border-2 rounded-lg bg-white hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 ${
                                      paymentForm.icon === opt.value 
                                        ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-500 ring-opacity-20' 
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => setPaymentForm(f => ({ ...f, icon: opt.value }))}
                                    title={opt.label}
                                  >
                                    <img src={opt.img} alt={opt.label} className="w-12 h-8 object-contain mx-auto" />
                                    {paymentForm.icon === opt.value && (
                                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Action Buttons - Full Width */}
                            <div className={`flex justify-end space-x-4 pt-6 border-t border-gray-200 ${isAddPaymentFullscreen ? 'lg:col-span-2' : 'md:col-span-2'}`}>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setAddPaymentModalOpen(false)} 
                                className="h-9 px-6 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-all duration-200"
                              >
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                className="h-9 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl rounded-lg transition-all duration-200 tracking-wide"
                              >
                                Create Payment Method
                              </Button>
                            </div>
                          </form>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </Card>
                </motion.div>
              </TabsContent>
              
              <TabsContent value="reminder" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
                    <div className="flex items-center gap-4 mb-6">
                      <motion.div 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md"
                      >
                        <Bell className="text-white" size={20} />
                      </motion.div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Reminder Policy</h3>
                        <p className="text-gray-500 text-sm">Configure reminder settings</p>
                      </div>
                    </div>
                    <div className="text-gray-600 py-8 text-center">Reminder policy configuration will appear here.</div>
                  </Card>
                </motion.div>
              </TabsContent>
              
              <TabsContent value="subscription" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
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
                        <h3 className="text-lg font-semibold text-gray-900 font-inter">Field Enablement</h3>
                        {/* Description removed as requested */}
                      </div>
                    </div>
                    <div className="space-y-6">
                      {/* Add New Field */}
                      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                        <Input
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          className="w-80 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg h-10 font-inter"
                          onKeyPress={(e) => e.key === 'Enter' && addNewField()}
                        />
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <Button
                            onClick={addNewField}
                            disabled={!newFieldName.trim()}
                            className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg font-inter"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Field
                          </Button>
                        </motion.div>
                      </div>
                      
                      {/* Field List */}
                      <div className="space-y-4">
                        <h3 className="text-base font-semibold text-gray-900">Available Fields</h3>
                        
                        {isLoading ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                          </div>
                        ) : fields.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
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
                                      onClick={() => deleteField(field.name)}
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
                      
                      {/* Removed Summary and Save Configuration */}
                    </div>
                  </Card>
                </motion.div>
              </TabsContent>
              
              <TabsContent value="compliance" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
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
                        {/* Description removed as requested */}
                      </div>
                    </div>
                    <div className="space-y-6">
                      {/* Add New Compliance Field */}
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
                            Add Field
                          </Button>
                        </motion.div>
                      </div>
                      
                      {/* Compliance Field List */}
                      <div className="space-y-4">
                        <h3 className="text-base font-semibold text-gray-900">Available Compliance Fields</h3>
                        
                        {isLoadingCompliance ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                          </div>
                        ) : complianceFields.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
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
                                      onClick={() => field._id && deleteComplianceField(field._id)}
                                      disabled={!field._id}
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
                      
                      {/* Removed Summary and Save Configuration */}
                    </div>
                  </Card>
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>
        </div>
      </div>
    </div>
  );
}