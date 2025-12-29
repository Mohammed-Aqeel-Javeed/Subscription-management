import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Settings, Eye, EyeOff, CreditCard, Shield, Bell, Banknote, DollarSign, Edit, Trash2, Maximize2, Minimize2, Search, Upload, Download, FileSpreadsheet } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/lib/config";
import * as XLSX from 'xlsx';
export default function Configuration() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch employees for Managed by dropdown
  const { data: employeesRaw = [] } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/employees`, { credentials: 'include' });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  
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
      owner: method.owner || '',
      manager: method.manager || '',
      expiresAt: method.expiresAt || '',
      financialInstitution: method.financialInstitution || '',
      lastFourDigits: method.lastFourDigits || '',
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
        owner: paymentForm.owner,
        manager: paymentForm.manager,
        expiresAt: paymentForm.expiresAt,
        financialInstitution: paymentForm.financialInstitution,
        lastFourDigits: paymentForm.lastFourDigits,
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
          variant: "success",
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

  // Fetch subscriptions to count payment method usage
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/subscriptions")
      .then(res => res.json())
      .then(data => setSubscriptions(data))
      .catch(() => setSubscriptions([]));
  }, []);

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
      const filtered = currencyList
        .filter(curr => {
          const codeMatch = curr.code.toUpperCase().startsWith(search);
          const nameMatch = curr.description.toUpperCase().includes(search);
          return codeMatch || nameMatch;
        })
        .map(curr => ({
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
        'Exchange Rate': '1.00',
        'Created': '',
        'Last Updated': ''
      },
      {
        'Currency Code': 'EUR',
        'Description': 'Euro',
        'Symbol': '€',
        'Exchange Rate': '0.85',
        'Created': '',
        'Last Updated': ''
      },
      {
        'Currency Code': 'GBP',
        'Description': 'British Pound Sterling',
        'Symbol': '£',
        'Exchange Rate': '0.73',
        'Created': '',
        'Last Updated': ''
      }
    ];
    
    const wsCurrency = XLSX.utils.json_to_sheet(currencyTemplateData);
    wsCurrency['!cols'] = [
      { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
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

  // Export All Data (Currency + Payment Methods)
  const exportAllToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Currency Sheet
    const currencyExportData = currencies.map(currency => ({
      'Currency Code': currency.code,
      'Description': currency.name,
      'Symbol': currency.symbol,
      'Exchange Rate': currency.exchangeRate || '',
      'Created': currency.created || '',
      'Last Updated': currency.lastUpdated || ''
    }));
    
    const wsCurrency = XLSX.utils.json_to_sheet(currencyExportData);
    wsCurrency['!cols'] = [
      { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCurrency, 'Currency');
    
    // Payment Methods Sheet
    const paymentExportData = paymentMethods.map(method => ({
      'Title': method.name || method.title,
      'Type': method.type,
      'Owner': method.owner || '',
      'Manager': method.manager || '',
      'Financial Institution': method.financialInstitution || '',
      'Expires At': method.expiresAt || '',
      'Last 4 Digits': method.lastFourDigits || ''
    }));
    
    const wsPayment = XLSX.utils.json_to_sheet(paymentExportData);
    wsPayment['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, wsPayment, 'Payment Methods');
    
    XLSX.writeFile(wb, `Configuration_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: `Exported ${currencies.length} currencies and ${paymentMethods.length} payment methods to Excel`,
      variant: "success",
    });
  };

  // Import Combined Excel (Currency + Payment Methods)
  const importCombinedExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let currencySuccess = 0;
        let currencyError = 0;
        let paymentSuccess = 0;
        let paymentError = 0;

        // Import Currency Sheet
        if (workbook.SheetNames.includes('Currency')) {
          const currencySheet = workbook.Sheets['Currency'];
          const currencyData = XLSX.utils.sheet_to_json(currencySheet) as any[];

          for (const row of currencyData) {
            try {
              const currencyData = {
                code: (row['Currency Code'] || '').toString().trim().toUpperCase(),
                name: (row['Description'] || '').toString().trim(),
                symbol: (row['Symbol'] || '').toString().trim(),
                exchangeRate: (row['Exchange Rate'] || '').toString().trim(),
              };

              if (!currencyData.code || !currencyData.name || !currencyData.symbol) {
                currencyError++;
                continue;
              }

              const exists = currencies.find(c => c.code === currencyData.code);
              const method = exists ? 'PUT' : 'POST';
              const url = exists 
                ? `${API_BASE_URL}/api/currencies/${currencyData.code}` 
                : `${API_BASE_URL}/api/currencies`;

              const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(currencyData),
              });

              if (res.ok) {
                currencySuccess++;
              } else {
                currencyError++;
              }
            } catch (error) {
              currencyError++;
            }
          }
        }

        // Import Payment Methods Sheet
        if (workbook.SheetNames.includes('Payment Methods')) {
          const paymentSheet = workbook.Sheets['Payment Methods'];
          const paymentData = XLSX.utils.sheet_to_json(paymentSheet) as any[];

          for (const row of paymentData) {
            try {
              const paymentData = {
                name: (row['Title'] || '').toString().trim(),
                type: (row['Type'] || '').toString().trim(),
                description: (row['Description'] || '').toString().trim(),
                icon: (row['Icon'] || '').toString().trim(),
                manager: (row['Manager'] || '').toString().trim(),
                expiresAt: (row['Expires At'] || '').toString().trim(),
              };

              if (!paymentData.name || !paymentData.type) {
                paymentError++;
                continue;
              }

              const res = await fetch("/api/payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(paymentData),
              });

              if (res.ok) {
                paymentSuccess++;
              } else {
                paymentError++;
              }
            } catch (error) {
              paymentError++;
            }
          }
        }

        // Refresh data
        await fetchCurrencies();
        const refreshRes = await fetch("/api/payment");
        const refreshData = await refreshRes.json();
        setPaymentMethods(refreshData);
        queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payment"] });

        toast({
          title: "Import Complete",
          description: `Currencies: ${currencySuccess} success, ${currencyError} failed. Payment Methods: ${paymentSuccess} success, ${paymentError} failed.`,
          variant: (currencyError > 0 || paymentError > 0) ? "destructive" : "success",
        });
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Failed to parse Excel file. Please check the file format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset file input
    if (currencyFileInputRef.current) {
      currencyFileInputRef.current.value = '';
    }
  };

  // Download Currency Template
  const downloadCurrencyTemplate = () => {
    const templateData = [
      {
        'Currency Code': 'USD',
        'Description': 'United States Dollar',
        'Symbol': '$',
        'Exchange Rate': '1.00',
        'Created': '',
        'Last Updated': ''
      },
      {
        'Currency Code': 'EUR',
        'Description': 'Euro',
        'Symbol': '€',
        'Exchange Rate': '0.85',
        'Created': '',
        'Last Updated': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Currencies');
    
    const wscols = [
      { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, 'Currency_Template.xlsx');
    
    toast({
      title: "Template Downloaded",
      description: "Use this template to import currencies",
      variant: "success",
    });
  };

  // Download Payment Method Template
  const downloadPaymentTemplate = () => {
    const templateData = [
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
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Methods');
    
    const wscols = [
      { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, 'PaymentMethod_Template.xlsx');
    
    toast({
      title: "Template Downloaded",
      description: "Use this template to import payment methods. Valid icons: visa, mastercard, paypal, amex, apple_pay, google_pay, bank, cash, other",
      variant: "success",
    });
  };

  // Excel Export for Currencies
  const exportCurrenciesToExcel = () => {
    const exportData = currencies.map(currency => ({
      'Currency Code': currency.code,
      'Description': currency.name,
      'Symbol': currency.symbol,
      'Exchange Rate': currency.exchangeRate || '',
      'Created': currency.created || '',
      'Last Updated': currency.lastUpdated || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Currencies');
    
    // Auto-size columns
    const maxWidth = 20;
    const wscols = [
      { wch: 15 }, // Currency Code
      { wch: 30 }, // Description
      { wch: 10 }, // Symbol
      { wch: 15 }, // Exchange Rate
      { wch: 15 }, // Created
      { wch: 15 }  // Last Updated
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `Currencies_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: `${currencies.length} currencies exported to Excel`,
      variant: "success",
    });
  };

  // Excel Import for Currencies
  const importCurrenciesFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
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

        let successCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          try {
            const currencyData = {
              code: (row['Currency Code'] || '').toString().trim().toUpperCase(),
              name: (row['Description'] || '').toString().trim(),
              symbol: (row['Symbol'] || '').toString().trim(),
              exchangeRate: (row['Exchange Rate'] || '').toString().trim(),
            };

            if (!currencyData.code || !currencyData.name || !currencyData.symbol) {
              errorCount++;
              continue;
            }

            // Check if currency already exists
            const exists = currencies.find(c => c.code === currencyData.code);
            const method = exists ? 'PUT' : 'POST';
            const url = exists 
              ? `${API_BASE_URL}/api/currencies/${currencyData.code}` 
              : `${API_BASE_URL}/api/currencies`;

            const res = await fetch(url, {
              method,
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(currencyData),
            });

            if (res.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
          }
        }

        await fetchCurrencies();
        queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });

        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} currencies. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
          variant: errorCount > 0 ? "destructive" : "success",
        });
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Failed to parse Excel file. Please check the file format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset file input
    if (currencyFileInputRef.current) {
      currencyFileInputRef.current.value = '';
    }
  };

  // Excel Export for Payment Methods
  const exportPaymentMethodsToExcel = () => {
    const exportData = paymentMethods.map(method => ({
      'Title': method.name || method.title,
      'Type': method.type,
      'Owner': method.owner || '',
      'Manager': method.manager || '',
      'Financial Institution': method.financialInstitution || '',
      'Expires At': method.expiresAt || '',
      'Last 4 Digits': method.lastFourDigits || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Methods');
    
    // Auto-size columns
    const wscols = [
      { wch: 20 }, // Title
      { wch: 15 }, // Type
      { wch: 30 }, // Description
      { wch: 15 }, // Icon
      { wch: 20 }, // Manager
      { wch: 15 }  // Expires At
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `PaymentMethods_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: `${paymentMethods.length} payment methods exported to Excel`,
      variant: "success",
    });
  };

  // Excel Import for Payment Methods
  const importPaymentMethodsFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
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

        let successCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          try {
            const paymentData = {
              name: (row['Title'] || '').toString().trim(),
              type: (row['Type'] || '').toString().trim(),
              description: (row['Description'] || '').toString().trim(),
              icon: (row['Icon'] || '').toString().trim(),
              manager: (row['Manager'] || '').toString().trim(),
              expiresAt: (row['Expires At'] || '').toString().trim(),
            };

            if (!paymentData.name || !paymentData.type) {
              errorCount++;
              continue;
            }

            const res = await fetch("/api/payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paymentData),
            });

            if (res.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
          }
        }

        // Refetch payment methods
        const refreshRes = await fetch("/api/payment");
        const refreshData = await refreshRes.json();
        setPaymentMethods(refreshData);
        queryClient.invalidateQueries({ queryKey: ["/api/payment"] });

        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} payment methods. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
          variant: errorCount > 0 ? "destructive" : "success",
        });
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Failed to parse Excel file. Please check the file format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset file input
    if (currencyFileInputRef.current) {
      currencyFileInputRef.current.value = '';
    }
  };
  
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
          // Invalidate React Query cache for currencies to update other components
          queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
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
        // Invalidate React Query cache for currencies to update other components
        queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
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
        // Invalidate React Query cache for currencies to update other components
        queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
        setIsUpdateMode(false);
        setEditingRates({});
        toast({
          title: "Currency Rates Updated",
          description: "All currency rates have been updated successfully",
          variant: "success",
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
  
  // Add new field and persist to backend immediately (MAX 4 FIELDS)
  const addNewField = async () => {
    // Check if already at maximum limit
    if (fields.length >= 4) {
      toast({
        title: "Limit Reached",
        description: "Maximum 4 fields allowed. Delete a field to add a new one.",
        variant: "destructive",
      });
      return;
    }
    
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
          variant: "success",
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
        variant: "success",
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
        variant: "success",
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
        variant: "success",
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
        owner: paymentForm.owner,
        manager: paymentForm.manager,
        expiresAt: paymentForm.expiresAt,
        financialInstitution: paymentForm.financialInstitution,
        lastFourDigits: paymentForm.lastFourDigits,
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
          owner: '',
          manager: '',
          expiresAt: '',
          financialInstitution: '',
          lastFourDigits: '',
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
    owner: '',
    manager: '',
    expiresAt: '',
    financialInstitution: '',
    lastFourDigits: '',
  });
  

  
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Modern Professional Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Setup & Configuration</h1>
              </div>
            </div>
            
            {/* Consolidated Excel Import/Export Buttons */}
            <div className="flex items-center gap-3">
              <input
                ref={currencyFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={importCombinedExcel}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={downloadCombinedTemplate}
                className="border-purple-300 text-purple-700 hover:bg-purple-50 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Template
              </Button>
              <Button
                variant="outline"
                onClick={() => currencyFileInputRef.current?.click()}
                className="border-green-300 text-green-700 hover:bg-green-50 shadow-sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button
                variant="outline"
                onClick={exportAllToExcel}
                disabled={currencies.length === 0 && paymentMethods.length === 0}
                className="border-blue-300 text-blue-700 hover:bg-blue-50 shadow-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
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
                                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-900">CURRENCY</th>
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
                                    <td colSpan={5} className="py-8 text-center text-gray-500">
                                      No currencies found. Add your first currency to get started.
                                    </td>
                                  </tr>
                                ) : (
                                  currencies.map((currency) => (
                                  <tr key={currency.code}>
                                    <td className="py-3 px-4 text-sm text-gray-900">
                                      {currency.symbol} {currency.name} ({currency.code})
                                    </td>
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
                                        currency.exchangeRate ? parseFloat(currency.exchangeRate).toFixed(2) : '-'
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
                          onClick={() => {
                            if (paymentMethods.length >= 4) {
                              toast({ 
                                title: 'Limit Reached', 
                                description: 'Maximum 4 payment methods allowed.',
                                variant: 'destructive'
                              });
                              return;
                            }
                            setAddPaymentModalOpen(true);
                          }}
                          className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg"
                          disabled={paymentMethods.length >= 4}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Payment Method {paymentMethods.length >= 4 && '(Max 4)'}
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
                        const subsCount = getPaymentMethodSubscriptions(method.name).length;
                        return (
                          <motion.div 
                            key={idx} 
                            whileHover={{ scale: 1.02 }}
                            className="bg-white border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{method.name}</div>
                                <div className="text-sm text-gray-500">{method.type}</div>
                              </div>
                              {/* Subscription Count Badge */}
                              <button
                                onClick={() => openPaymentSubsModal(method.name)}
                                className="flex-shrink-0 bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm hover:bg-blue-200 transition-colors cursor-pointer"
                                title="View subscriptions using this payment method"
                              >
                                {subsCount}
                              </button>
                            </div>
                            
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
                    
                    {/* Payment Method Subscriptions Modal */}
                    <Dialog open={paymentSubsModalOpen} onOpenChange={setPaymentSubsModalOpen}>
                      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0 bg-white font-inter">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
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
                            {/* Name Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Name <span className="text-red-500">*</span>
                              </Label>
                              <Input 
                                required 
                                value={paymentForm.title} 
                                onChange={e => setPaymentForm(f => ({ ...f, title: e.target.value }))}
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

                            {/* Manager Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Managed by
                              </Label>
                              <Select
                                value={paymentForm.manager}
                                onValueChange={(value) => setPaymentForm(f => ({ ...f, manager: value }))}
                              >
                                <SelectTrigger className="h-9 px-3 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full">
                                  <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                  {employeesRaw.length > 0 ? (
                                    employeesRaw.map((emp: any) => (
                                      <SelectItem key={emp._id || emp.id || emp.name} value={emp.name}>
                                        {emp.name}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-employee" disabled>No employees found</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Financial Institution Field */}
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

                            {/* Last 4 Digits Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Last 4 Digits
                              </Label>
                              <Input 
                                value={paymentForm.lastFourDigits} 
                                onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  setPaymentForm(f => ({ ...f, lastFourDigits: value }));
                                }}
                                maxLength={4}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Expires At Field */}
                            <div className={`space-y-2 ${isEditPaymentFullscreen ? 'lg:col-span-1' : 'md:col-span-1'}`}>
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Expires at
                              </Label>
                              <div className="relative">
                                <Input 
                                  type="month" 
                                  placeholder="MM/YYYY"
                                  value={paymentForm.expiresAt} 
                                  onChange={e => setPaymentForm(f => ({ ...f, expiresAt: e.target.value }))}
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
                            {/* Name Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Name <span className="text-red-500">*</span>
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

                            {/* Owner Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Owner
                              </Label>
                              <Select
                                value={paymentForm.owner}
                                onValueChange={(value) => setPaymentForm(f => ({ ...f, owner: value }))}
                              >
                                <SelectTrigger className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full">
                                  <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                  {employeesRaw.length > 0 ? (
                                    employeesRaw.map((emp: any) => (
                                      <SelectItem key={emp._id || emp.id || emp.name} value={emp.name}>
                                        {emp.name}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-employee" disabled>No employees found</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Manager Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Managed by
                              </Label>
                              <Select
                                value={paymentForm.manager}
                                onValueChange={(value) => setPaymentForm(f => ({ ...f, manager: value }))}
                              >
                                <SelectTrigger className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full">
                                  <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                                <SelectContent>
                                  {employeesRaw.length > 0 ? (
                                    employeesRaw.map((emp: any) => (
                                      <SelectItem key={emp._id || emp.id || emp.name} value={emp.name}>
                                        {emp.name}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-employee" disabled>No employees found</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Financial Institution Field */}
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

                            {/* Last 4 Digits Field */}
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Last 4 Digits
                              </Label>
                              <Input 
                                value={paymentForm.lastFourDigits} 
                                onChange={e => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  setPaymentForm(f => ({ ...f, lastFourDigits: value }));
                                }}
                                maxLength={4}
                                className="h-9 px-3 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 font-medium bg-gray-50 focus:bg-white transition-all duration-200 w-full"
                              />
                            </div>

                            {/* Expires At Field */}
                            <div className={`space-y-2 ${isAddPaymentFullscreen ? 'lg:col-span-1' : 'md:col-span-1'}`}>
                              <Label className="text-sm font-semibold text-gray-700 tracking-wide">
                                Expires at
                              </Label>
                              <div className="relative">
                                <Input 
                                  type="month" 
                                  placeholder="MM/YYYY"
                                  value={paymentForm.expiresAt} 
                                  onChange={e => setPaymentForm(f => ({ ...f, expiresAt: e.target.value }))}
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
                          disabled={fields.length >= 4}
                          placeholder={fields.length >= 4 ? "Maximum 4 fields reached" : "Enter field name"}
                        />
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <Button
                            onClick={addNewField}
                            disabled={!newFieldName.trim() || fields.length >= 4}
                            className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-semibold shadow-md py-2 px-4 rounded-lg font-inter"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {fields.length >= 4 ? 'Max 4 Fields' : 'Add Field'}
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