import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileSpreadsheet, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper to auto-capitalize first letter of each word (matching subscription modal)
const capitalizeWords = (str: string): string => {
  if (!str) return str;
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Currency list for auto-fill
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
  { code: "BAM", description: "Bosnia-Herzegovina Convertible Mark", symbol: "KM" },
  { code: "BBD", description: "Barbadian Dollar", symbol: "$" },
  { code: "BDT", description: "Bangladeshi Taka", symbol: "৳" },
  { code: "BGN", description: "Bulgarian Lev", symbol: "лв" },
  { code: "BHD", description: "Bahraini Dinar", symbol: ".د.ب" },
  { code: "BIF", description: "Burundian Franc", symbol: "Fr" },
  { code: "BMD", description: "Bermudan Dollar", symbol: "$" },
  { code: "BND", description: "Brunei Dollar", symbol: "$" },
  { code: "BOB", description: "Bolivian Boliviano", symbol: "Bs." },
  { code: "BRL", description: "Brazilian Real", symbol: "R$" },
  { code: "BSD", description: "Bahamian Dollar", symbol: "$" },
  { code: "BTN", description: "Bhutanese Ngultrum", symbol: "Nu." },
  { code: "BWP", description: "Botswanan Pula", symbol: "P" },
  { code: "BYN", description: "Belarusian Ruble", symbol: "Br" },
  { code: "BZD", description: "Belize Dollar", symbol: "$" },
  { code: "CAD", description: "Canadian Dollar", symbol: "C$" },
  { code: "CDF", description: "Congolese Franc", symbol: "Fr" },
  { code: "CHF", description: "Swiss Franc", symbol: "CHF" },
  { code: "CLP", description: "Chilean Peso", symbol: "$" },
  { code: "CNY", description: "Chinese Yuan", symbol: "¥" },
  { code: "COP", description: "Colombian Peso", symbol: "$" },
  { code: "CRC", description: "Costa Rican Colón", symbol: "₡" },
  { code: "CUP", description: "Cuban Peso", symbol: "$" },
  { code: "CVE", description: "Cape Verdean Escudo", symbol: "$" },
  { code: "CZK", description: "Czech Koruna", symbol: "Kč" },
  { code: "DJF", description: "Djiboutian Franc", symbol: "Fr" },
  { code: "DKK", description: "Danish Krone", symbol: "kr" },
  { code: "DOP", description: "Dominican Peso", symbol: "$" },
  { code: "DZD", description: "Algerian Dinar", symbol: "د.ج" },
  { code: "EGP", description: "Egyptian Pound", symbol: "£" },
  { code: "ERN", description: "Eritrean Nakfa", symbol: "Nfk" },
  { code: "ETB", description: "Ethiopian Birr", symbol: "Br" },
  { code: "EUR", description: "Euro", symbol: "€" },
  { code: "FJD", description: "Fijian Dollar", symbol: "$" },
  { code: "FKP", description: "Falkland Islands Pound", symbol: "£" },
  { code: "FOK", description: "Faroese Króna", symbol: "kr" },
  { code: "GBP", description: "British Pound Sterling", symbol: "£" },
  { code: "GEL", description: "Georgian Lari", symbol: "₾" },
  { code: "GGP", description: "Guernsey Pound", symbol: "£" },
  { code: "GHS", description: "Ghanaian Cedi", symbol: "₵" },
  { code: "GIP", description: "Gibraltar Pound", symbol: "£" },
  { code: "GMD", description: "Gambian Dalasi", symbol: "D" },
  { code: "GNF", description: "Guinean Franc", symbol: "Fr" },
  { code: "GTQ", description: "Guatemalan Quetzal", symbol: "Q" },
  { code: "GYD", description: "Guyanaese Dollar", symbol: "$" },
  { code: "HKD", description: "Hong Kong Dollar", symbol: "HK$" },
  { code: "HNL", description: "Honduran Lempira", symbol: "L" },
  { code: "HRK", description: "Croatian Kuna", symbol: "kn" },
  { code: "HTG", description: "Haitian Gourde", symbol: "G" },
  { code: "HUF", description: "Hungarian Forint", symbol: "Ft" },
  { code: "IDR", description: "Indonesian Rupiah", symbol: "Rp" },
  { code: "ILS", description: "Israeli New Shekel", symbol: "₪" },
  { code: "IMP", description: "Manx Pound", symbol: "£" },
  { code: "INR", description: "Indian Rupee", symbol: "₹" },
  { code: "IQD", description: "Iraqi Dinar", symbol: "ع.د" },
  { code: "IRR", description: "Iranian Rial", symbol: "﷼" },
  { code: "ISK", description: "Icelandic Króna", symbol: "kr" },
  { code: "JEP", description: "Jersey Pound", symbol: "£" },
  { code: "JMD", description: "Jamaican Dollar", symbol: "$" },
  { code: "JOD", description: "Jordanian Dinar", symbol: "د.ا" },
  { code: "JPY", description: "Japanese Yen", symbol: "¥" },
  { code: "KES", description: "Kenyan Shilling", symbol: "Sh" },
  { code: "KGS", description: "Kyrgystani Som", symbol: "с" },
  { code: "KHR", description: "Cambodian Riel", symbol: "៛" },
  { code: "KID", description: "Kiribati Dollar", symbol: "$" },
  { code: "KMF", description: "Comorian Franc", symbol: "Fr" },
  { code: "KRW", description: "South Korean Won", symbol: "₩" },
  { code: "KWD", description: "Kuwaiti Dinar", symbol: "د.ك" },
  { code: "KYD", description: "Cayman Islands Dollar", symbol: "$" },
  { code: "KZT", description: "Kazakhstani Tenge", symbol: "₸" },
  { code: "LAK", description: "Laotian Kip", symbol: "₭" },
  { code: "LBP", description: "Lebanese Pound", symbol: "ل.ل" },
  { code: "LKR", description: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "LRD", description: "Liberian Dollar", symbol: "$" },
  { code: "LSL", description: "Lesotho Loti", symbol: "L" },
  { code: "LYD", description: "Libyan Dinar", symbol: "ل.د" },
  { code: "MAD", description: "Moroccan Dirham", symbol: "د.م." },
  { code: "MDL", description: "Moldovan Leu", symbol: "L" },
  { code: "MGA", description: "Malagasy Ariary", symbol: "Ar" },
  { code: "MKD", description: "Macedonian Denar", symbol: "ден" },
  { code: "MMK", description: "Myanma Kyat", symbol: "Ks" },
  { code: "MNT", description: "Mongolian Tugrik", symbol: "₮" },
  { code: "MOP", description: "Macanese Pataca", symbol: "P" },
  { code: "MRU", description: "Mauritanian Ouguiya", symbol: "UM" },
  { code: "MUR", description: "Mauritian Rupee", symbol: "₨" },
  { code: "MVR", description: "Maldivian Rufiyaa", symbol: "Rf" },
  { code: "MWK", description: "Malawian Kwacha", symbol: "MK" },
  { code: "MXN", description: "Mexican Peso", symbol: "$" },
  { code: "MYR", description: "Malaysian Ringgit", symbol: "RM" },
  { code: "MZN", description: "Mozambican Metical", symbol: "MT" },
  { code: "NAD", description: "Namibian Dollar", symbol: "$" },
  { code: "NGN", description: "Nigerian Naira", symbol: "₦" },
  { code: "NIO", description: "Nicaraguan Córdoba", symbol: "C$" },
  { code: "NOK", description: "Norwegian Krone", symbol: "kr" },
  { code: "NPR", description: "Nepalese Rupee", symbol: "₨" },
  { code: "NZD", description: "New Zealand Dollar", symbol: "NZ$" },
  { code: "OMR", description: "Omani Rial", symbol: "ر.ع." },
  { code: "PAB", description: "Panamanian Balboa", symbol: "B/." },
  { code: "PEN", description: "Peruvian Sol", symbol: "S/." },
  { code: "PGK", description: "Papua New Guinean Kina", symbol: "K" },
  { code: "PHP", description: "Philippine Peso", symbol: "₱" },
  { code: "PKR", description: "Pakistani Rupee", symbol: "₨" },
  { code: "PLN", description: "Polish Zloty", symbol: "zł" },
  { code: "PYG", description: "Paraguayan Guarani", symbol: "₲" },
  { code: "QAR", description: "Qatari Rial", symbol: "ر.ق" },
  { code: "RON", description: "Romanian Leu", symbol: "lei" },
  { code: "RSD", description: "Serbian Dinar", symbol: "дин" },
  { code: "RUB", description: "Russian Ruble", symbol: "₽" },
  { code: "RWF", description: "Rwandan Franc", symbol: "Fr" },
  { code: "SAR", description: "Saudi Riyal", symbol: "﷼" },
  { code: "SBD", description: "Solomon Islands Dollar", symbol: "$" },
  { code: "SCR", description: "Seychellois Rupee", symbol: "₨" },
  { code: "SDG", description: "Sudanese Pound", symbol: "ج.س." },
  { code: "SEK", description: "Swedish Krona", symbol: "kr" },
  { code: "SGD", description: "Singapore Dollar", symbol: "S$" },
  { code: "SHP", description: "Saint Helena Pound", symbol: "£" },
  { code: "SLL", description: "Sierra Leonean Leone", symbol: "Le" },
  { code: "SOS", description: "Somali Shilling", symbol: "Sh" },
  { code: "SRD", description: "Surinamese Dollar", symbol: "$" },
  { code: "SSP", description: "South Sudanese Pound", symbol: "£" },
  { code: "STN", description: "São Tomé and Príncipe Dobra", symbol: "Db" },
  { code: "SYP", description: "Syrian Pound", symbol: "£" },
  { code: "SZL", description: "Swazi Lilangeni", symbol: "L" },
  { code: "THB", description: "Thai Baht", symbol: "฿" },
  { code: "TJS", description: "Tajikistani Somoni", symbol: "ЅМ" },
  { code: "TMT", description: "Turkmenistani Manat", symbol: "m" },
  { code: "TND", description: "Tunisian Dinar", symbol: "د.ت" },
  { code: "TOP", description: "Tongan Paʻanga", symbol: "T$" },
  { code: "TRY", description: "Turkish Lira", symbol: "₺" },
  { code: "TTD", description: "Trinidad and Tobago Dollar", symbol: "$" },
  { code: "TVD", description: "Tuvaluan Dollar", symbol: "$" },
  { code: "TWD", description: "New Taiwan Dollar", symbol: "NT$" },
  { code: "TZS", description: "Tanzanian Shilling", symbol: "Sh" },
  { code: "UAH", description: "Ukrainian Hryvnia", symbol: "₴" },
  { code: "UGX", description: "Ugandan Shilling", symbol: "Sh" },
  { code: "USD", description: "United States Dollar", symbol: "$" },
  { code: "UYU", description: "Uruguayan Peso", symbol: "$" },
  { code: "UZS", description: "Uzbekistan Som", symbol: "so'm" },
  { code: "VES", description: "Venezuelan Bolívar", symbol: "Bs." },
  { code: "VND", description: "Vietnamese Dong", symbol: "₫" },
  { code: "VUV", description: "Vanuatu Vatu", symbol: "Vt" },
  { code: "WST", description: "Samoan Tala", symbol: "T" },
  { code: "XAF", description: "Central African CFA Franc", symbol: "Fr" },
  { code: "XCD", description: "East Caribbean Dollar", symbol: "$" },
  { code: "XDR", description: "Special Drawing Rights", symbol: "SDR" },
  { code: "XOF", description: "West African CFA Franc", symbol: "Fr" },
  { code: "XPF", description: "CFP Franc", symbol: "Fr" },
  { code: "YER", description: "Yemeni Rial", symbol: "﷼" },
  { code: "ZAR", description: "South African Rand", symbol: "R" },
  { code: "ZMW", description: "Zambian Kwacha", symbol: "ZK" },
  { code: "ZWL", description: "Zimbabwean Dollar", symbol: "$" }
];

export function UnifiedImportExport({ localCurrency = "LCY" }) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [duplicateAlert, setDuplicateAlert] = useState<{
    show: boolean;
    duplicates: {
      sheet: string;
      items: string[];
    }[];
  }>({show: false, duplicates: []});
  const hasSuccessfulImportsRef = useRef(false);

  // Resolve effective local currency for templates:
  // 1) explicit prop value (if not default "LCY")
  // 2) companyInfo.defaultCurrency from backend
  // 3) /api/me defaultCurrency fallback
  const [resolvedLocalCurrency, setResolvedLocalCurrency] = useState(localCurrency);

  useEffect(() => {
    const fetchLocalCurrency = async () => {
      try {
        // If caller passed a real currency code, respect it
        if (localCurrency && localCurrency !== "LCY") {
          setResolvedLocalCurrency(localCurrency);
          return;
        }

        // Try company-info first
        const companyRes = await fetch(`${API_BASE_URL}/api/company-info`, {
          credentials: "include",
        });
        if (companyRes.ok) {
          const companyData = await companyRes.json();
          if (companyData?.defaultCurrency) {
            setResolvedLocalCurrency(companyData.defaultCurrency);
            return;
          }
        }

        // Fallback: user profile from /api/me
        const meRes = await fetch(`${API_BASE_URL}/api/me`, {
          credentials: "include",
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.defaultCurrency) {
            setResolvedLocalCurrency(meData.defaultCurrency);
            return;
          }
        }
      } catch {
        // Silent failure - keep default LCY label
      }
    };

    // Only try to resolve if still at default placeholder
    if (!resolvedLocalCurrency || resolvedLocalCurrency === "LCY") {
      fetchLocalCurrency();
    }
  }, [localCurrency, resolvedLocalCurrency]);

  // Download Unified Template with Dropdowns using ExcelJS
  const downloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
    
    // Create hidden lookup sheet for dropdowns and formulas
    const lookupSheet = workbook.addWorksheet('Lookup');
    lookupSheet.state = 'veryHidden';
    
    // Add currency data to lookup sheet (Code, Description, Symbol)
    lookupSheet.columns = [
      { header: 'Code', key: 'code', width: 10 },
      { header: 'Description', key: 'description', width: 25 },
      { header: 'Symbol', key: 'symbol', width: 10 }
    ];
    
    currencyList.forEach((currency) => {
      lookupSheet.addRow({
        code: currency.code,
        description: currency.description,
        symbol: currency.symbol
      });
    });
    
    // 0. INSTRUCTIONS SHEET (First sheet)
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.getColumn(1).width = 100;
    
    // Title
    const titleRow = instructionsSheet.getRow(1);
    titleRow.getCell(1).value = '📋 Subscription Tracker - Import Template Instructions';
    titleRow.getCell(1).font = { size: 18, bold: true, color: { argb: 'FF4F46E5' } };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    titleRow.height = 30;
    
    instructionsSheet.addRow([]);
    
    // Overview
    const overviewRow = instructionsSheet.addRow(['📌 Overview']);
    overviewRow.getCell(1).font = { size: 14, bold: true, color: { argb: 'FF1E40AF' } };
    instructionsSheet.addRow(['This Excel template allows you to import your subscription data into the Subscription Tracker system. Each sheet serves a specific purpose and some sheets have smart features like dropdowns and auto-fill formulas.']);
    instructionsSheet.addRow([]);
    
    // Sheet descriptions
    const sheetsRow = instructionsSheet.addRow(['📊 Sheet Descriptions']);
    sheetsRow.getCell(1).font = { size: 14, bold: true, color: { argb: 'FF1E40AF' } };
    instructionsSheet.addRow([]);
    
    // Currencies
    const currRow = instructionsSheet.addRow(['1️⃣ Currencies Sheet']);
    currRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    instructionsSheet.addRow(['   • Currency Code: Select from dropdown (auto-populates Description)']);
    instructionsSheet.addRow(['   • Description: Auto-fills when you select a currency code']);
    instructionsSheet.addRow(['   • Exch.Rate against 1 LCY: Enter the exchange rate (e.g., 1.00 for USD, 83.12 for INR)']);
    instructionsSheet.addRow(['   • Tip: Just select the currency code and enter the rate - description fills automatically!']);
    instructionsSheet.addRow([]);
    
    // Categories
    const catRow = instructionsSheet.addRow(['2️⃣ Categories Sheet']);
    catRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    instructionsSheet.addRow(['   • Category Name: Enter subscription categories (e.g., Software & SaaS, Entertainment, Cloud Services)']);
    instructionsSheet.addRow(['   • Used in: Subscriptions sheet for categorizing your subscriptions']);
    instructionsSheet.addRow([]);
    
    // Departments
    const deptRow = instructionsSheet.addRow(['3️⃣ Departments Sheet']);
    deptRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    instructionsSheet.addRow(['   • Department Name: Enter department names (e.g., IT, Marketing, Finance)']);
    instructionsSheet.addRow(['   • Head: Department head name']);
    instructionsSheet.addRow(['   • Email: Department contact email']);
    instructionsSheet.addRow(['   • Used in: Employees sheet (department dropdown) and Subscriptions sheet']);
    instructionsSheet.addRow([]);
    
    // Employees
    const empRow = instructionsSheet.addRow(['4️⃣ Employees Sheet']);
    empRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    instructionsSheet.addRow(['   • Full Name: Employee full name']);
    instructionsSheet.addRow(['   • Email: Employee email address (must be unique)']);
    instructionsSheet.addRow(['   • Department: Select from dropdown (references Departments sheet)']);
    instructionsSheet.addRow(['   • Role: Employee role/job title']);
    instructionsSheet.addRow(['   • Status: active or inactive']);
    instructionsSheet.addRow(['   • Used in: Payment Methods (Managed by) and Subscriptions (Owner) dropdowns']);
    instructionsSheet.addRow([]);
    
    // Payment Methods
    const payRow = instructionsSheet.addRow(['5️⃣ Payment Methods Sheet']);
    payRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    instructionsSheet.addRow(['   • Name: Payment method name (e.g., Corporate Visa)']);
    instructionsSheet.addRow(['   • Type: Select from dropdown (Credit, Debit, Bank Transfer, etc.)']);
    instructionsSheet.addRow(['   • Description: Optional description']);
    instructionsSheet.addRow(['   • Managed by: Select employee from dropdown (references Employees sheet)']);
    instructionsSheet.addRow(['   • Financial Institution: Bank or institution name (e.g., HSBC Bank)']);
    instructionsSheet.addRow(['   • Expires at: Expiration date in MM/YYYY format ONLY (e.g., 12/2027)']);
    instructionsSheet.addRow(['   • Used in: Subscriptions sheet for payment method selection']);
    instructionsSheet.addRow([]);
    
    // Subscriptions
    const subRow = instructionsSheet.addRow(['6️⃣ Subscriptions Sheet']);
    subRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    instructionsSheet.addRow(['   • Service Name: Subscription service name (auto-capitalizes first letter)']);
    instructionsSheet.addRow(['   • Vendor: Select from dropdown (90+ popular vendors available)']);
    instructionsSheet.addRow(['   • Currency: Select from dropdown (references Currencies sheet)']);
    instructionsSheet.addRow(['   • Quantity: Number of units/licenses (must be at least 1)']);
    instructionsSheet.addRow(['   • Amount per unit: Cost per unit/license']);
    instructionsSheet.addRow(['   • Total Amount: Auto-calculates (Quantity × Amount per unit)']);
    instructionsSheet.addRow(['   • Commitment cycle: Select from dropdown (Monthly, Yearly, Quarterly, Weekly, Trial, Pay-as-you-go)']);
    instructionsSheet.addRow(['   • Payment Frequency: Select from dropdown (how often payments are made)']);
    instructionsSheet.addRow(['   • Payment Method: Select from dropdown (references Payment Methods sheet)']);
    instructionsSheet.addRow(['   • Start Date: Format dd/mm/yyyy (e.g., 01/01/2025)']);
    instructionsSheet.addRow(['   • Next Renewal: Auto-calculates based on Start Date + Commitment cycle']);
    instructionsSheet.addRow(['   • Auto Renewal: Select Yes or No (enables automatic renewal)']);
    instructionsSheet.addRow(['   • Status: Select from dropdown (Active or Inactive)']);
    instructionsSheet.addRow(['   • Category: Select from dropdown (references Categories sheet)']);
    instructionsSheet.addRow(['   • Departments: Enter department names separated by | (e.g., IT|Marketing)']);
    instructionsSheet.addRow(['   • Owner: Select from dropdown (references Employees sheet)']);
    instructionsSheet.addRow(['   • Owner Email: Auto-fills when you select Owner']);
    instructionsSheet.addRow(['   • Reminder Policy: Select from dropdown (One time, Two times, Until Renewal)']);
    instructionsSheet.addRow(['   • Reminder Days: Days before renewal to send reminder (e.g., 7 for one week before)']);
    instructionsSheet.addRow(['   • Notes: Additional notes']);
    instructionsSheet.addRow([]);
    
    // Compliance
    const complianceRow = instructionsSheet.addRow(['7️⃣ Compliance Sheet']);
    complianceRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    instructionsSheet.addRow(['   • Filing Name: Name of the compliance filing (required)']);
    instructionsSheet.addRow(['   • Policy: Associated policy or regulation']);
    instructionsSheet.addRow(['   • Filing Frequency: Select from dropdown (Monthly, Quarterly, Yearly, etc.)']);
    instructionsSheet.addRow(['   • Compliance Category: Select from dropdown (Tax, Legal, Financial, etc.)']);
    instructionsSheet.addRow(['   • Governing Authority: Regulatory body or authority']);
    instructionsSheet.addRow(['   • Start Date: Compliance period start (format dd/mm/yyyy)']);
    instructionsSheet.addRow(['   • End Date: Compliance period end (format dd/mm/yyyy)']);
    instructionsSheet.addRow(['   • Submission Deadline: Deadline for submission (format dd/mm/yyyy)']);
    instructionsSheet.addRow(['   • Submission Date: Actual submission date (format dd/mm/yyyy)']);
    instructionsSheet.addRow(['   • Status: Select from dropdown (Pending, Completed, Overdue, etc.)']);
    instructionsSheet.addRow(['   • Reminder Policy: Reminder frequency for deadlines']);
    instructionsSheet.addRow(['   • Reminder Days: Days before deadline to send reminder']);
    instructionsSheet.addRow(['   • Remarks: Additional notes or comments']);
    instructionsSheet.addRow([]);
    
    // Important Notes
    const notesRow = instructionsSheet.addRow(['⚠️ Important Notes']);
    notesRow.getCell(1).font = { size: 14, bold: true, color: { argb: 'FFDC2626' } };
    instructionsSheet.addRow(['   ✓ Fill sheets in order: Currencies → Categories → Departments → Employees → Payment Methods → Subscriptions → Compliance']);
    instructionsSheet.addRow(['   ✓ Employee emails must be unique (duplicates will be rejected)']);
    instructionsSheet.addRow(['   ✓ Dates must be in dd/mm/yyyy format (e.g., 20/11/2025)']);
    instructionsSheet.addRow(['   ✓ Use dropdowns whenever available - they ensure data consistency']);
    instructionsSheet.addRow([]);
    
    // Tips
    const tipsRow = instructionsSheet.addRow(['💡 Pro Tips']);
    tipsRow.getCell(1).font = { size: 14, bold: true, color: { argb: 'FF7C3AED' } };
    instructionsSheet.addRow(['   🎯 Service names auto-capitalize ("netflix" becomes "Netflix")']);
    instructionsSheet.addRow(['   🎯 Currency descriptions auto-fill when you select the code']);
    instructionsSheet.addRow(['   🎯 Owner Email auto-fills when you select an owner']);
    instructionsSheet.addRow(['   🎯 Total Amount auto-calculates (Quantity × Amount per unit)']);
    instructionsSheet.addRow(['   🎯 Next Renewal auto-calculates based on Start Date + Commitment cycle']);
    instructionsSheet.addRow(['   🎯 LCY Amount auto-calculates during import using exchange rates']);
    instructionsSheet.addRow(['   🎯 You can add your own vendors if not in the dropdown']);
    instructionsSheet.addRow([]);
    
    const supportRow = instructionsSheet.addRow(['📞 Need Help? Check the system documentation or contact support.']);
    supportRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
    
    // Create hidden sheet for currency list (to avoid 255 character limit in dropdown)
    const currencyListSheet = workbook.addWorksheet('_CurrencyList');
    currencyListSheet.state = 'hidden';
    const formattedCurrencies = currencyList.map(c => `${c.symbol} ${c.description} (${c.code})`);
    formattedCurrencies.forEach((currency, index) => {
      currencyListSheet.getCell(`A${index + 1}`).value = currency;
    });
    
    // Create hidden sheet with just currency codes for subscription dropdown
    const currencyCodesSheet = workbook.addWorksheet('_CurrencyCodes');
    currencyCodesSheet.state = 'veryHidden';
    const currencyCodes = currencyList.map(c => c.code);
    currencyCodes.forEach((code, index) => {
      currencyCodesSheet.getCell(`A${index + 1}`).value = code;
    });
    
    // 1. CURRENCIES SHEET
    const currencySheet = workbook.addWorksheet('Currencies');
    const lcyLabel = resolvedLocalCurrency || localCurrency || "LCY";
    currencySheet.columns = [
      { header: 'Currency', key: 'currency', width: 40 },
      { header: `Exch.Rate against 1 ${lcyLabel}`, key: 'rate', width: 22 }
    ];
    
    // Add NOTE instruction row
    const noteRow = currencySheet.getRow(2);
    noteRow.getCell(1).value = '⚠️ NOTE';
    noteRow.getCell(2).value = `Select currency from dropdown (format: $ United States Dollar (USD)).\nExchange rate should be against 1 ${lcyLabel}`;
    noteRow.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' } };
    noteRow.getCell(2).font = { italic: true, color: { argb: 'FF059669' } };
    noteRow.commit();
    
    // Add sample rows with left alignment
    const usdRow = currencySheet.getRow(3);
    usdRow.getCell(1).value = '$ United States Dollar (USD)';
    usdRow.getCell(1).alignment = { horizontal: 'left' };
    usdRow.getCell(2).value = '1.00';
    usdRow.commit();
    
    const eurRow = currencySheet.getRow(4);
    eurRow.getCell(1).value = '€ Euro (EUR)';
    eurRow.getCell(1).alignment = { horizontal: 'left' };
    eurRow.getCell(2).value = '0.85';
    eurRow.commit();
    
    const inrRow = currencySheet.getRow(5);
    inrRow.getCell(1).value = '₹ Indian Rupee (INR)';
    inrRow.getCell(1).alignment = { horizontal: 'left' };
    inrRow.getCell(2).value = '83.12';
    inrRow.commit();
    
    // Add dropdown list validation ONLY (duplicate check will happen on import)
    for (let i = 3; i <= 500; i++) {
      const cell = currencySheet.getCell(`A${i}`);
      cell.alignment = { horizontal: 'left' }; // Align currency text to left
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_CurrencyList!$A$1:$A$${formattedCurrencies.length}`],
        showInputMessage: true,
        promptTitle: 'Select Currency',
        prompt: 'Choose a currency from the dropdown. Duplicates will be highlighted in red and blocked during import.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Select from List',
        error: 'Please select a currency from the dropdown list.'
      };
      
      // Exchange Rate validation - must be numeric with 2 decimal places
      const rateCell = currencySheet.getCell(`B${i}`);
      rateCell.numFmt = '0.00'; // Format as number with 2 decimal places
      rateCell.dataValidation = {
        type: 'decimal',
        operator: 'greaterThan',
        allowBlank: false,
        formulae: [0],
        showInputMessage: true,
        promptTitle: 'Exchange Rate Required',
        prompt: 'Enter the exchange rate as a number (e.g., 1.00, 83.12). Must be greater than 0.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Exchange Rate',
        error: 'Please enter a valid number greater than 0. Decimal values are allowed.'
      };
    }
    
    // Add conditional formatting to highlight duplicates in Currency column
    currencySheet.addConditionalFormatting({
      ref: 'A3:A500',
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['COUNTIF($A$3:$A$500,A3)>1'],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFFEE2E2' }
            },
            font: {
              color: { argb: 'FFDC2626' },
              bold: true
            }
          }
        }
      ]
    });
    
    // Create helper sheet to extract currency codes from Currencies sheet (for Subscriptions dropdown)
    const currencyExtractSheet = workbook.addWorksheet('_CurrencyExtract');
    currencyExtractSheet.state = 'veryHidden';
    // Add formulas to extract the code from format like "$ United States Dollar (USD)"
    for (let i = 1; i <= 500; i++) {
      const extractCell = currencyExtractSheet.getCell(`A${i}`);
      extractCell.value = {
        formula: `IF(Currencies!A${i+2}<>"",MID(Currencies!A${i+2},FIND("(",Currencies!A${i+2})+1,FIND(")",Currencies!A${i+2})-FIND("(",Currencies!A${i+2})-1),"")`
      };
    }
    
    // 2. CATEGORIES SHEET
    const catSheet = workbook.addWorksheet('Categories');
    // Add a hidden normalization column to ensure manual text matches are detected
    catSheet.columns = [
      { header: 'Category Name', key: 'name', width: 25 },
      { header: 'Normalized', key: 'norm', width: 2 }
    ];
    
    // Add only one example category (users can add more)
    catSheet.addRow({ name: 'Productivity & Collaboration' });
    
    // Add dropdown for Category Name column (A2:A500) - references CategoryList sheet
    for (let i = 2; i <= 500; i++) {
      const categoryNameCell = catSheet.getCell(`A${i}`);
      categoryNameCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['CategoryList!$A$2:$A$12'],
        showInputMessage: true,
        promptTitle: 'Select Category',
        prompt: 'Choose a category from the dropdown list. Duplicates will be highlighted in red.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Category Selection',
        error: 'Please select a category from the dropdown or type your own.'
      };
      // Normalization formula in hidden column B to catch trimmed/upper-cased duplicates
      const normCell = catSheet.getCell(`B${i}`);
      normCell.value = { formula: `IF(A${i}="","",UPPER(TRIM(A${i})))`, result: '' };
    }

    // Hide normalization column visually
    catSheet.getColumn(2).hidden = true;

    // Add conditional formatting to highlight duplicates in red (using normalized column for robust matching)
    catSheet.addConditionalFormatting({
      ref: 'A2:A500',
      rules: [
        {
          type: 'expression',
          priority: 1,
          // Only flag duplicates when the cell is non-empty
          formulae: ['AND(A2<>"",COUNTIF($B$2:$B$500,UPPER(TRIM(A2)))>1)'],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true }
          }
        }
      ]
    });
    
    // 3. DEPARTMENTS SHEET
    const deptSheet = workbook.addWorksheet('Departments');
    deptSheet.columns = [
      { header: 'Department Name', key: 'name', width: 20 },
      { header: 'Head', key: 'head', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'NormName', key: 'normName', width: 2 },
      { header: 'NormHead', key: 'normHead', width: 2 },
      { header: 'NormEmail', key: 'normEmail', width: 2 }
    ];
    deptSheet.addRow({ name: 'IT', head: 'Jane Smith', email: 'jane@company.com' });
    deptSheet.addRow({ name: 'Marketing', head: 'John Doe', email: 'john@company.com' });
    deptSheet.addRow({ name: 'Finance', head: 'Sarah Lee', email: 'sarah@company.com' });
    
    // Add normalization formulas and validation for Departments sheet
    for (let i = 2; i <= 500; i++) {
      // Normalization formulas in hidden columns D, E, F
      const normNameCell = deptSheet.getCell(`D${i}`);
      normNameCell.value = { formula: `IF(A${i}="","",UPPER(TRIM(A${i})))`, result: '' };
      
      const normHeadCell = deptSheet.getCell(`E${i}`);
      normHeadCell.value = { formula: `IF(B${i}="","",UPPER(TRIM(B${i})))`, result: '' };
      
      const normEmailCell = deptSheet.getCell(`F${i}`);
      normEmailCell.value = { formula: `IF(C${i}="","",UPPER(TRIM(C${i})))`, result: '' };
      
      // Department Name duplicate validation with error alert
      const deptNameCell = deptSheet.getCell(`A${i}`);
      deptNameCell.dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`COUNTIF($D$2:$D$500,UPPER(TRIM(A${i})))=1`],
        showInputMessage: true,
        promptTitle: 'Department Name Required',
        prompt: 'Enter a unique department name. Duplicates are not allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Duplicate Department',
        error: 'This department name already exists! Please use a unique name.'
      };
      
      // Head duplicate validation with error alert
      const headCell = deptSheet.getCell(`B${i}`);
      headCell.dataValidation = {
        type: 'custom',
        allowBlank: true,
        formulae: [`OR(B${i}="",COUNTIF($E$2:$E$500,UPPER(TRIM(B${i})))=1)`],
        showInputMessage: true,
        promptTitle: 'Department Head',
        prompt: 'Enter a unique department head name. Duplicates are not allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Duplicate Head',
        error: 'This department head already exists! Please use a unique name.'
      };
      
      // Email validation - must contain @ and .com AND be unique
      const emailCell = deptSheet.getCell(`C${i}`);
      emailCell.dataValidation = {
        type: 'custom',
        allowBlank: true,
        formulae: [`OR(C${i}="",AND(ISNUMBER(FIND("@",C${i})),ISNUMBER(FIND(".com",C${i})),COUNTIF($F$2:$F$500,UPPER(TRIM(C${i})))=1))`],
        showInputMessage: true,
        promptTitle: 'Email Format',
        prompt: 'Email must contain @ and .com and be unique (e.g., user@company.com)',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid or Duplicate Email',
        error: 'Email must contain both @ and .com, and must be unique!'
      };
    }
    
    // Hide normalization columns
    deptSheet.getColumn(4).hidden = true;
    deptSheet.getColumn(5).hidden = true;
    deptSheet.getColumn(6).hidden = true;
    
    // Conditional formatting for duplicate Department Names
    deptSheet.addConditionalFormatting({
      ref: 'A2:A500',
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['AND(A2<>"",COUNTIF($D$2:$D$500,UPPER(TRIM(A2)))>1)'],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true }
          }
        }
      ]
    });
    
    // Conditional formatting for duplicate Heads
    deptSheet.addConditionalFormatting({
      ref: 'B2:B500',
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['AND(B2<>"",COUNTIF($E$2:$E$500,UPPER(TRIM(B2)))>1)'],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true }
          }
        }
      ]
    });
    
    // Conditional formatting for duplicate Emails
    deptSheet.addConditionalFormatting({
      ref: 'C2:C500',
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['AND(C2<>"",COUNTIF($F$2:$F$500,UPPER(TRIM(C2)))>1)'],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true }
          }
        }
      ]
    });
    
    // 4. EMPLOYEES SHEET
    const empSheet = workbook.addWorksheet('Employees');
    empSheet.columns = [
      { header: 'Full Name', key: 'name', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'NormName', key: 'normName', width: 2 },
      { header: 'NormEmail', key: 'normEmail', width: 2 }
    ];
    empSheet.addRow({
      name: 'John Doe',
      email: 'john@company.com',
      department: 'IT',
      role: 'Software',
      status: 'active'
    });
    
    // Add Department dropdown for Employees (C2:C500) - references Departments sheet
    for (let i = 2; i <= 500; i++) {
      // Normalization formulas in hidden columns F, G
      const normNameCell = empSheet.getCell(`F${i}`);
      normNameCell.value = { formula: `IF(A${i}="","",UPPER(TRIM(A${i})))`, result: '' };
      
      const normEmailCell = empSheet.getCell(`G${i}`);
      normEmailCell.value = { formula: `IF(B${i}="","",UPPER(TRIM(B${i})))`, result: '' };
      
      // Full Name duplicate validation with error alert
      const empNameCell = empSheet.getCell(`A${i}`);
      empNameCell.dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`COUNTIF($F$2:$F$500,UPPER(TRIM(A${i})))=1`],
        showInputMessage: true,
        promptTitle: 'Employee Name Required',
        prompt: 'Enter a unique employee name. Duplicates are not allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Duplicate Employee',
        error: 'This employee name already exists! Please use a unique name.'
      };
      
      // Email duplicate validation with error alert
      const empEmailCell = empSheet.getCell(`B${i}`);
      empEmailCell.dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`COUNTIF($G$2:$G$500,UPPER(TRIM(B${i})))=1`],
        showInputMessage: true,
        promptTitle: 'Employee Email Required',
        prompt: 'Enter a unique employee email. Duplicates are not allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Duplicate Email',
        error: 'This email already exists! Please use a unique email.'
      };
      
      // Department dropdown
      const cell = empSheet.getCell(`C${i}`);
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Departments!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Department',
        prompt: 'Choose a department from the Departments sheet.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Department',
        error: 'Please select a valid department.'
      };
      
      // Status dropdown (E column) - active or inactive
      const statusCell = empSheet.getCell(`E${i}`);
      statusCell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"active,inactive"'],
        showInputMessage: true,
        promptTitle: 'Select Status',
        prompt: 'Choose employee status: active or inactive.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Status',
        error: 'Please select either "active" or "inactive".'
      };
    }
    
    // Hide normalization columns
    empSheet.getColumn(6).hidden = true;
    empSheet.getColumn(7).hidden = true;
    
    // Conditional formatting for duplicate Full Names
    empSheet.addConditionalFormatting({
      ref: 'A2:A500',
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['AND(A2<>"",COUNTIF($F$2:$F$500,UPPER(TRIM(A2)))>1)'],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true }
          }
        }
      ]
    });
    
    // Conditional formatting for duplicate Emails
    empSheet.addConditionalFormatting({
      ref: 'B2:B500',
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: ['AND(B2<>"",COUNTIF($G$2:$G$500,UPPER(TRIM(B2)))>1)'],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } },
            font: { color: { argb: 'FFFFFFFF' }, bold: true }
          }
        }
      ]
    });
    
    // 5. PAYMENT METHODS SHEET
    const paySheet = workbook.addWorksheet('Payment Methods');
    paySheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Owner', key: 'owner', width: 25 },
      { header: 'Managed by', key: 'managedBy', width: 25 },
      { header: 'Financial Institution', key: 'financialInstitution', width: 25 },
      { header: 'Expires at', key: 'expiresAt', width: 15 },
      { header: 'Last 4 Digits', key: 'last4Digits', width: 15 }
    ];
    
    // Add sample row
    paySheet.addRow({
      name: 'Corporate Visa',
      type: 'Credit',
      owner: 'John Doe',
      managedBy: 'Jane Smith',
      financialInstitution: 'HSBC Bank',
      expiresAt: '12/2027',
      last4Digits: '1234'
    });
    
    // Set Expires at column (F) to text format to preserve slashes
    const samplePayRow = paySheet.getRow(2);
    samplePayRow.getCell(6).numFmt = '@'; // Text format for Expires at column
    
    // Add Type dropdown validation for rows 2-500
    const paymentTypes = ['Credit', 'Debit', 'Cash', 'Bank Transfer', 'Digital Wallet', 'Other'];
    for (let i = 2; i <= 500; i++) {
      // Payment Method Name duplicate validation (A column)
      const nameCell = paySheet.getCell(`A${i}`);
      nameCell.dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`COUNTIF($A$2:$A$500,A${i})=1`],
        showInputMessage: true,
        promptTitle: 'Payment Method Name Required',
        prompt: 'Enter a unique payment method name. Duplicates are not allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Duplicate Payment Method',
        error: 'This payment method name already exists! Please use a unique name.'
      };
      
      // Type dropdown
      const cell = paySheet.getCell(`B${i}`);
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${paymentTypes.join(',')}"`],
        showInputMessage: true,
        promptTitle: 'Select Payment Type',
        prompt: 'Choose a payment method type from the dropdown.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Type',
        error: 'Please select a valid payment type from the dropdown list.'
      };
      
      // Add Owner (Employee) dropdown for Payment Methods (C column) - references Employees sheet
      const ownerCell = paySheet.getCell(`C${i}`);
      ownerCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Employees!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Owner',
        prompt: 'Choose an employee from the Employees sheet.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Employee',
        error: 'Please select a valid employee.'
      };
      
      // Add Managed by (Employee) dropdown for Payment Methods (D column) - references Employees sheet
      const managedByCell = paySheet.getCell(`D${i}`);
      managedByCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Employees!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Manager',
        prompt: 'Choose an employee from the Employees sheet.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Employee',
        error: 'Please select a valid employee.'
      };
      
      // Expires at validation - MM/YYYY format only (F column)
      const expiresAtCell = paySheet.getCell(`F${i}`);
      expiresAtCell.numFmt = '@'; // Text format to preserve slashes
      expiresAtCell.dataValidation = {
        type: 'custom',
        allowBlank: true,
        formulae: [`AND(LEN(F${i})=7,ISNUMBER(VALUE(LEFT(F${i},2))),MID(F${i},3,1)="/",ISNUMBER(VALUE(RIGHT(F${i},4))),VALUE(LEFT(F${i},2))>=1,VALUE(LEFT(F${i},2))<=12,VALUE(RIGHT(F${i},4))>=2020)`],
        showInputMessage: true,
        promptTitle: 'Expiry Date Format',
        prompt: 'Enter expiry date in MM/YYYY format (e.g., 12/2027). Month must be 01-12.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Expiry Date',
        error: 'Please use MM/YYYY format (e.g., 12/2027). Month must be between 01 and 12.'
      };
      
      // Last 4 Digits validation - exactly 4 digits (G column)
      const last4Cell = paySheet.getCell(`G${i}`);
      last4Cell.numFmt = '@'; // Text format to preserve leading zeros
      last4Cell.dataValidation = {
        type: 'custom',
        allowBlank: true,
        formulae: [`AND(LEN(G${i})=4,ISNUMBER(VALUE(G${i})))`],
        showInputMessage: true,
        promptTitle: 'Last 4 Digits',
        prompt: 'Enter exactly 4 digits (e.g., 1234).',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid Format',
        error: 'Please enter exactly 4 numeric digits.'
      };
    }
    
    // 6. VENDORS SHEET (Hidden)
    const vendorsSheet = workbook.addWorksheet('Vendors');
    vendorsSheet.state = 'veryHidden';
    vendorsSheet.columns = [{ header: 'Vendor Name', key: 'name', width: 30 }];
    
  const VENDOR_LIST = [
    "Microsoft Corporation", "Amazon Web Services, Inc.", "Google LLC", "Salesforce, Inc.", "Adobe Inc.",
    "Oracle Corporation", "SAP SE", "International Business Machines Corporation (IBM)", "ServiceNow, Inc.",
    "Atlassian Corporation", "Zoom Video Communications, Inc.", "Slack Technologies, LLC (Salesforce)",
    "Dropbox, Inc.", "Box, Inc.", "DocuSign, Inc.", "HubSpot, Inc.", "Canva Pty Ltd", "Shopify Inc.",
    "Snowflake Inc.", "Twilio Inc.", "VMware, Inc. (Broadcom)", "Cisco Systems, Inc.", "Dell Technologies Inc.",
    "Hewlett Packard Enterprise Company", "Citrix Systems, Inc.", "Palo Alto Networks, Inc.",
    "CrowdStrike Holdings, Inc.", "Fortinet, Inc.", "Zscaler, Inc.", "Cloudflare, Inc.", "Okta, Inc.",
    "Tenable Holdings, Inc.", "Rapid7, Inc.", "Splunk Inc.", "Proofpoint, Inc.", "CyberArk Software Ltd.",
    "Trend Micro Incorporated", "McAfee, LLC", "Sophos Ltd.", "SentinelOne, Inc.",
    "Check Point Software Technologies Ltd.", "Mandiant (Google)", "Rubrik, Inc.", "Veeam Software",
    "Commvault Systems, Inc.", "Intuit Inc.", "Stripe, Inc.", "PayPal Holdings, Inc.", "Block, Inc. (Square)",
    "Xero Limited", "The Sage Group plc", "Fiserv, Inc.", "Fidelity National Information Services, Inc. (FIS)",
    "Bill.com Holdings, Inc.", "Expensify, Inc.", "Coupa Software Inc.", "Brex Inc.", "Ramp Business Corporation",
    "Adyen N.V.", "Plaid Inc.", "Automatic Data Processing, Inc. (ADP)", "Workday, Inc.", "Paychex, Inc.",
    "Paycom Software, Inc.", "Ceridian HCM Holding Inc. (Dayforce)", "UKG Inc. (Ultimate Kronos Group)",
    "BambooHR LLC", "Rippling People Center Inc.", "Gusto, Inc.", "Deel, Inc.", "Robert Half International Inc.",
    "Cornerstone OnDemand, Inc.", "Leidos Holdings, Inc.", "Northrop Grumman Corporation",
    "General Dynamics Corporation", "Raytheon Technologies Corporation (RTX)", "Booz Allen Hamilton Holding Corporation",
    "Science Applications International Corporation (SAIC)", "CACI International Inc", "Palantir Technologies Inc.",
    "Tyler Technologies, Inc.", "Carahsoft Technology Corp.", "Crayon Group Holding ASA (Acquirer of Rhipe)",
    "Ingram Micro Inc.", "Pax8, Inc.", "TD SYNNEX Corporation", "Arrow Electronics, Inc. (Arrow ECS)",
    "Dicker Data Limited", "Sherweb Inc.", "AppDirect, Inc.", "Insight Enterprises, Inc.", "SoftwareOne AG",
    "CDW Corporation", "SHI International Corp.", "Zendesk, Inc.", "Freshworks Inc.", "Intercom, Inc.",
    "Qualtrics, LLC", "SurveyMonkey (Momentive Global Inc.)", "Hootsuite Inc.", "Sprout Social, Inc.",
    "Semrush Holdings, Inc.", "Ahrefs Pte. Ltd.", "Moz, Inc.", "Braze, Inc.", "Klaviyo, Inc.",
    "ActiveCampaign, LLC", "Constant Contact, Inc.", "Mailchimp (Intuit Inc.)", "Typeform SL",
    "Drift.com, Inc.", "Pipedrive Inc.", "Zoho Corporation Pvt. Ltd.", "Yotpo Ltd.", "Trustpilot Group plc",
    "G2.com, Inc.", "Cision Ltd.", "Meltwater B.V.", "Sprinklr, Inc.", "Datadog, Inc.", "New Relic, Inc.",
    "Dynatrace, Inc.", "PagerDuty, Inc.", "HashiCorp, Inc.", "JFrog Ltd.", "DigitalOcean Holdings, Inc.",
    "Akamai Technologies, Inc.", "F5, Inc.", "Juniper Networks, Inc.", "Arista Networks, Inc.", "NetApp, Inc.",
    "Pure Storage, Inc.", "Red Hat, Inc. (IBM)", "SUSE S.A.", "Canonical Ltd. (Ubuntu)", "Docker, Inc.",
    "Elastic N.V.", "MongoDB, Inc.", "Redis, Inc.", "Couchbase, Inc.", "GitHub, Inc. (Microsoft)",
    "GitLab Inc.", "JetBrains s.r.o.", "Postman, Inc.", "OpenAI, L.L.C.", "Anthropic, PBC",
    "Databricks, Inc.", "Glean Technologies, Inc.", "Harvey AI, Inc.", "Hebbia, Inc.", "Waabi Innovation Inc.",
    "Weaviate B.V.", "Writer, Inc.", "NVIDIA Corporation", "Siemens AG", "Sift Science, Inc.",
    "Scale AI, Inc.", "Hugging Face, Inc.", "Jasper AI, Inc.", "Netflix, Inc.", "Disney+",
    "Amazon Prime Video", "Apple TV+", "Spotify Technology S.A.", "YouTube Premium", "Singtel",
    "StarHub Ltd", "M1 Limited", "Grab Holdings Ltd", "Sea Limited", "Tableau Software, LLC (Salesforce)",
    "QlikTech International AB", "MicroStrategy Incorporated", "Asana, Inc.", "Monday.com Ltd",
    "Smartsheet Inc.", "Notion Labs, Inc.", "Trello (Atlassian)", "Basecamp, LLC", "Figma, Inc.",
    "Sketch B.V.", "InVisionApp Inc.", "Miro (RealtimeBoard Inc.)", "Lucid Software Inc.", "Shutterstock, Inc.",
    "Getty Images Holdings, Inc.", "Envato Pty Ltd", "Webflow, Inc.", "Squarespace, Inc.", "Wix.com Ltd.",
    "GoDaddy Inc.", "Namecheap, Inc.", "Bluehost Inc. (Newfold Digital)", "SiteGround Hosting Ltd.",
    "WP Engine, Inc.", "1Password", "LastPass", "Dashlane", "NordVPN", "ExpressVPN"
  ];
    
    VENDOR_LIST.forEach(vendor => {
      vendorsSheet.addRow({ name: vendor });
    });
    
    // 6b. CATEGORY LIST SHEET (Hidden - for dropdown suggestions)
    const categoryListSheet = workbook.addWorksheet('CategoryList');
    categoryListSheet.state = 'veryHidden';
    categoryListSheet.columns = [{ header: 'Category Name', key: 'name', width: 30 }];
    
    // Add all default category suggestions
    const DEFAULT_CATEGORY_LIST = [
      'Productivity & Collaboration',
      'Accounting & Finance',
      'CRM & Sales',
      'Development & Hosting',
      'Design & Creative Tools',
      'Marketing & SEO',
      'Communication Tools',
      'Security & Compliance',
      'HR & Admin',
      'Subscription Infrastructure',
      'Office Infrastructure'
    ];
    
    DEFAULT_CATEGORY_LIST.forEach(category => {
      categoryListSheet.addRow({ name: category });
    });
    
    // 7. SUBSCRIPTIONS SHEET
    const subsSheet = workbook.addWorksheet('Subscriptions');
    subsSheet.columns = [
      { header: 'Service Name', key: 'serviceName', width: 20 },
      { header: 'Website', key: 'website', width: 30 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Currency', key: 'currency', width: 12 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Amount per unit', key: 'amount', width: 15 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 },
      { header: 'Commitment cycle', key: 'billingCycle', width: 18 },
      { header: 'Payment Frequency', key: 'paymentFrequency', width: 18 },
      { header: 'Payment Method', key: 'paymentMethod', width: 20 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'Next Renewal', key: 'nextRenewal', width: 15 },
      { header: 'Auto Renewal', key: 'autoRenewal', width: 13 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Departments', key: 'departments', width: 20 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Owner Email', key: 'ownerEmail', width: 25 },
      { header: 'Reminder Policy', key: 'reminderPolicy', width: 18 },
      { header: 'Reminder Days', key: 'reminderDays', width: 15 },
      { header: 'Notes', key: 'notes', width: 35 }
    ];
    
    // Style the header row to make columns distinct
    const headerRow = subsSheet.getRow(1);
    headerRow.height = 20;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    
    // Apply borders to each header cell individually to prevent merging
    for (let col = 1; col <= 21; col++) {
      const cell = headerRow.getCell(col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    }
    
    // Add sample row with formula for Next Renewal
    const sampleRow = subsSheet.getRow(2);
    sampleRow.getCell(1).value = 'Netflix';
    sampleRow.getCell(2).value = 'https://www.netflix.com';
    sampleRow.getCell(3).value = 'Netflix Inc';
    sampleRow.getCell(4).value = 'SGD';
    sampleRow.getCell(5).value = 1;
    sampleRow.getCell(6).value = 15.99;
    // Total Amount formula (column 7/G) = Qty * Amount per unit
    sampleRow.getCell(7).value = {
      formula: 'E2*F2',
      result: 15.99
    };
    sampleRow.getCell(8).value = 'Monthly'; // Commitment cycle
    sampleRow.getCell(9).value = 'Monthly'; // Payment Frequency
    sampleRow.getCell(10).value = 'Corporate Visa'; // Payment Method
    sampleRow.getCell(11).value = '01/01/2025'; // Start Date
    sampleRow.getCell(11).numFmt = '@'; // Text format to preserve slashes
    // Next Renewal formula (column 12/L) - updated for new column positions
    sampleRow.getCell(12).value = {
      formula: `IF(AND(K2<>"",H2<>""),TEXT(IF(H2="Monthly",DATE(YEAR(K2),MONTH(K2)+1,DAY(K2))-1,IF(H2="Quarterly",DATE(YEAR(K2),MONTH(K2)+3,DAY(K2))-1,IF(H2="Yearly",DATE(YEAR(K2)+1,MONTH(K2),DAY(K2))-1,IF(H2="Weekly",K2+6,IF(H2="Trial",K2+30,""))))),"dd/mm/yyyy"),"")`,
      result: '31/01/2025'
    };
    sampleRow.getCell(12).numFmt = '@'; // Text format to preserve slashes
    sampleRow.getCell(13).value = 'Yes'; // Auto Renewal
    sampleRow.getCell(14).value = 'Active'; // Status
    sampleRow.getCell(15).value = 'Entertainment'; // Category
    sampleRow.getCell(16).value = 'Marketing'; // Departments
    sampleRow.getCell(17).value = 'John Doe'; // Owner
    // Owner Email formula (column 18/R) - VLOOKUP to get email from Employees sheet
    sampleRow.getCell(18).value = {
      formula: `IFERROR(VLOOKUP(Q2,Employees!$A$2:$B$500,2,0),"")`,
      result: 'john@company.com'
    };
    sampleRow.getCell(19).value = 'One time'; // Reminder Policy
    sampleRow.getCell(20).value = 7; // Reminder Days
    sampleRow.getCell(21).value = 'Team streaming subscription'; // Notes
    sampleRow.commit();
    
    // Add Commitment cycle dropdown and other validations for Subscriptions
    const commitmentCycles = ['Monthly', 'Yearly', 'Quarterly', 'Weekly', 'Trial', 'Pay-as-you-go'];
    const subscriptionStatuses = ['Active', 'Inactive'];
    const reminderPolicies = ['One time', 'Two times', 'Until Renewal'];
    
    for (let i = 2; i <= 500; i++) {
      // Total Amount formula for all rows (column G/7) = Qty * Amount per unit (only if both exist)
      const totalAmountCell = subsSheet.getCell(`G${i}`);
      totalAmountCell.value = {
        formula: `IF(AND(E${i}<>"",F${i}<>""),E${i}*F${i},"")`
      };
      totalAmountCell.numFmt = '0.00'; // Format as number with 2 decimal places
      totalAmountCell.protection = { locked: true }; // Lock the cell
      
      // Service Name duplicate validation (A column)
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
        error: 'This service name already exists! Please use a unique name.'
      };
      
      // Vendor dropdown (C column) - references Vendors sheet
      const vendorCell = subsSheet.getCell(`C${i}`);
      vendorCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Vendors!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Vendor',
        prompt: 'Choose a vendor from the Vendors sheet or type your own.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Vendor',
        error: 'Please select a valid vendor from the dropdown list.'
      };
      
      // Currency dropdown (D column) - references extracted codes from Currencies sheet
      const currencyCell = subsSheet.getCell(`D${i}`);
      currencyCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['_CurrencyExtract!$A$1:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Currency',
        prompt: 'Choose a currency code from the currencies defined in the Currencies sheet.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Currency',
        error: 'Please select a valid currency from the dropdown list.'
      };
      
      // Qty validation - integer >= 1 (E column)
      const qtyCell = subsSheet.getCell(`E${i}`);
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
        error: 'Please enter a whole number >= 1.'
      };
      
      // Amount validation - numeric with 2 decimal places (F column)
      const amountCell = subsSheet.getCell(`F${i}`);
      amountCell.numFmt = '0.00'; // Format as number with 2 decimal places
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
        error: 'Please enter a valid number. Decimal values are allowed (e.g., 15.99).'
      };
      
      // Commitment cycle dropdown (H column)
      const cycleCell = subsSheet.getCell(`H${i}`);
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
        error: 'Please select a valid commitment cycle.'
      };
      
      // Payment Frequency dropdown (I column)
      const paymentFreqCell = subsSheet.getCell(`I${i}`);
      paymentFreqCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${commitmentCycles.join(',')}"`],
        showInputMessage: true,
        promptTitle: 'Select Payment Frequency',
        prompt: 'Choose how often payments are made.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Frequency',
        error: 'Please select a valid payment frequency.'
      };
      
      // Payment Method dropdown (J column) - references Payment Methods sheet
      const paymentMethodCell = subsSheet.getCell(`J${i}`);
      paymentMethodCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`'Payment Methods'!$A$2:$A$500`],
        showInputMessage: true,
        promptTitle: 'Select Payment Method',
        prompt: 'Choose a payment method from the Payment Methods sheet.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Payment Method',
        error: 'Please select a valid payment method.'
      };
      
      // Set date format for Start Date column to text format (preserves slashes) (K column)
      const startDateCell = subsSheet.getCell(`K${i}`);
      startDateCell.numFmt = '@';
      
      // Add Next Renewal formula for all rows (L column)
      if (i > 2) { // Skip row 2 as we already added it
        const renewalCell = subsSheet.getCell(`L${i}`);
        renewalCell.value = {
          formula: `IF(AND(K${i}<>"",H${i}<>""),TEXT(IF(H${i}="Monthly",DATE(YEAR(K${i}),MONTH(K${i})+1,DAY(K${i}))-1,IF(H${i}="Quarterly",DATE(YEAR(K${i}),MONTH(K${i})+3,DAY(K${i}))-1,IF(H${i}="Yearly",DATE(YEAR(K${i})+1,MONTH(K${i}),DAY(K${i}))-1,IF(H${i}="Weekly",K${i}+6,IF(H${i}="Trial",K${i}+30,""))))),"dd/mm/yyyy"),"")`,
          result: ''
        };
        renewalCell.numFmt = '@'; // Text format to preserve slashes
      }
      
      // Auto Renewal dropdown (M column) - Yes/No
      const autoRenewalCell = subsSheet.getCell(`M${i}`);
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
        error: 'Please select Yes or No.'
      };
      
      // Status dropdown (N column)
      const statusCell = subsSheet.getCell(`N${i}`);
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
        error: 'Please select a valid status: Active, Inactive, Cancelled, Suspended, or Trial.'
      };
      
      // Category dropdown (O column) - references Categories sheet
      const categoryCell = subsSheet.getCell(`O${i}`);
      categoryCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Categories!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Category',
        prompt: 'Choose a category from the dropdown or type your own.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Category',
        error: 'Please select a valid category from the dropdown list.'
      };
      
      // Department dropdown (P column) - references Departments sheet
      const deptCell = subsSheet.getCell(`P${i}`);
      deptCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Departments!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Department',
        prompt: 'Choose a department from the Departments sheet. Use | to separate multiple departments.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Department',
        error: 'Please select a valid department.'
      };
      
      // Add Owner (Employee) dropdown for Subscriptions (Q column) - references Employees sheet
      const ownerCell = subsSheet.getCell(`Q${i}`);
      ownerCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Employees!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Owner',
        prompt: 'Choose an employee from the Employees sheet.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Owner',
        error: 'Please select a valid employee.'
      };
      
      // Add Owner Email auto-fill formula for all rows (R column) - VLOOKUP from Employees
      if (i > 2) {
        const ownerEmailCell = subsSheet.getCell(`R${i}`);
        ownerEmailCell.value = {
          formula: `IFERROR(VLOOKUP(Q${i},Employees!$A$2:$B$500,2,0),"")`,
          result: ''
        };
      }
      
      // Reminder Policy dropdown (S column)
      const reminderPolicyCell = subsSheet.getCell(`S${i}`);
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
        error: 'Please select a valid reminder policy from the dropdown.'
      };
      
      // Reminder Days validation - integer between 1 and 365 (T column)
      const reminderDaysCell = subsSheet.getCell(`T${i}`);
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
        error: 'Please enter a whole number between 1 and 365.'
      };
    }
    
    // Unlock editable cells in Subscriptions sheet (all except Total Amount, Next Renewal, and Owner Email)
    for (let i = 2; i <= 500; i++) {
      // Unlock all columns except G (Total Amount), L (Next Renewal), and R (Owner Email)
      // A=Service Name, B=Website, C=Vendor, D=Currency, E=Qty, F=Amount per unit, G=Total Amount (locked)
      // H=Commitment cycle, I=Payment Frequency, J=Payment Method, K=Start Date, L=Next Renewal (locked)
      // M=Auto Renewal, N=Status, O=Category, P=Departments, Q=Owner, R=Owner Email (locked)
      // S=Reminder Policy, T=Reminder Days, U=Notes
      const editableColumns = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'J', 'K', 'M', 'N', 'O', 'P', 'Q', 'S', 'T', 'U'];
      editableColumns.forEach(col => {
        const cell = subsSheet.getCell(`${col}${i}`);
        cell.protection = { locked: false };
      });
    }
    
    // Protect Subscriptions sheet to prevent formula editing
    subsSheet.protect('', {
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
      insertHyperlinks: false
    });
    
    // Style header rows for all sheets
    [currencySheet, catSheet, deptSheet, empSheet, paySheet, subsSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    });
    
    // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), 'Subscription_Tracker_Template.xlsx');
      
      toast({
        title: "Template Downloaded",
        description: "Template with currency dropdown created successfully!",
      });
    } catch (error) {
      console.error('Template generation error:', error);
      toast({
        title: "Failed to download template",
        description: "Please try again. If the problem persists, contact support.",
        variant: "destructive",
      });
    }
  };

  // Export All Data
  const exportAllData = async () => {
    try {
      const wb = XLSX.utils.book_new();
      
      // Fetch and export Subscriptions
      const subsRes = await fetch(`${API_BASE_URL}/api/subscriptions`, { credentials: "include" });
      const subscriptions = await subsRes.json();
      const subsData = subscriptions.map((sub: any) => ({
        'Service Name': sub.serviceName,
        'Vendor': sub.vendor,
        'Amount': sub.amount,
        'Billing Cycle': sub.billingCycle,
        'Start Date': sub.startDate ? new Date(sub.startDate).toISOString().split('T')[0] : '',
        'Next Renewal': sub.nextRenewal ? new Date(sub.nextRenewal).toISOString().split('T')[0] : '',
        'Status': sub.status,
        'Category': sub.category,
        'Departments': (sub.departments || []).join('|'),
        'Reminder Policy': sub.reminderPolicy,
        'Reminder Days': sub.reminderDays,
        'Notes': sub.notes || ''
      }));
      
      // Fetch and export Categories
      const catRes = await fetch(`${API_BASE_URL}/api/company/categories`, { credentials: "include" });
      const categories = await catRes.json();
      const catData = categories.map((cat: any) => ({
        'Category Name': cat.name
      }));
      
      // Fetch and export Departments
      const deptRes = await fetch(`${API_BASE_URL}/api/company/departments`, { credentials: "include" });
      const departments = await deptRes.json();
      const deptData = departments.map((dept: any) => ({
        'Department Name': dept.name,
        'Head': dept.head || '',
        'Email': dept.email || ''
      }));
      
      // Fetch and export Employees
      const empRes = await fetch(`${API_BASE_URL}/api/employees`, { credentials: "include" });
      const employees = await empRes.json();
      const empData = employees.map((emp: any) => ({
        'Full Name': emp.name,
        'Email': emp.email,
        'Department': emp.department || '',
        'Role': emp.role || '',
        'Status': emp.status || 'Active'
      }));
      
      // Fetch and export Currencies
      const currRes = await fetch(`${API_BASE_URL}/api/currencies`, { credentials: "include" });
      const currencies = await currRes.json();
      const currData = currencies.map((curr: any) => ({
        'Currency': `${curr.symbol} ${curr.name} (${curr.code})`,
        'Exch.Rate against 1 LCY': curr.exchangeRate || ''
      }));
      
      // Fetch and export Payment Methods
      const payRes = await fetch(`${API_BASE_URL}/api/payment`, { credentials: "include" });
      const payments = await payRes.json();
      const payData = payments.map((pay: any) => ({
        'Name': pay.name || pay.title,
        'Type': pay.type,
        'Managed by': pay.manager || '',
        'Financial Institution': pay.financialInstitution || '',
        'Expires at': pay.expiresAt || ''
      }));
      
      // Add all sheets
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subsData), 'Subscriptions');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), 'Categories');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptData), 'Departments');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empData), 'Employees');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(currData), 'Currencies');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payData), 'Payment Methods');
      
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Subscription_Tracker_Export_${date}.xlsx`);
      
      toast({
        title: "Export Successful",
        description: `Exported ${subsData.length} subscriptions and all configuration data`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Import All Data
  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show loading toast
    const loadingToast = toast({
      title: "Importing...",
      description: "Please wait while we import your data. This may take a moment.",
      duration: Infinity, // Keep showing until import completes
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let totalSuccess = 0;
        let totalError = 0;
        const results: string[] = [];
        
        // Track duplicates by sheet type
        const allDuplicates: {sheet: string; items: string[]}[] = [];
        
        // Fetch current user information for notes
        let currentUserName = 'Import';
        try {
          const userRes = await fetch(`${API_BASE_URL}/api/me`, { credentials: "include" });
          if (userRes.ok) {
            const userData = await userRes.json();
            currentUserName = userData.fullName || userData.name || userData.username || userData.email || 'Import';
            console.log('Import user:', currentUserName, userData);
          } else {
            console.error('Failed to fetch user info:', userRes.status);
          }
        } catch (err) {
          console.error('Error fetching user info:', err);
        }

        // Import Categories first (referenced by subscriptions)
        if (workbook.SheetNames.includes('Categories')) {
          const sheet = workbook.Sheets['Categories'];
          const categories = XLSX.utils.sheet_to_json(sheet) as any[];
          let catSuccess = 0, catError = 0;
          
          // Fetch existing categories
          let existingCategories: string[] = [];
          try {
            const existingRes = await fetch(`${API_BASE_URL}/api/company/categories`, { credentials: "include" });
            const existing = await existingRes.json();
            existingCategories = existing.map((cat: any) => cat.name?.toLowerCase()).filter(Boolean);
          } catch {}
          
          // Check for duplicates within import data
          const importCategories = new Set<string>();
          const duplicatesInImport: string[] = [];
          const duplicatesWithExisting: string[] = [];
          
          for (const row of categories) {
            const name = row['Category Name']?.toString().trim().toLowerCase();
            if (name) {
              if (importCategories.has(name)) {
                duplicatesInImport.push(name);
              }
              importCategories.add(name);
              
              // Check against existing
              if (existingCategories.includes(name)) {
                duplicatesWithExisting.push(name);
              }
            }
          }
          
          if (duplicatesInImport.length > 0) {
            allDuplicates.push({sheet: 'Categories', items: duplicatesInImport});
          }
          if (duplicatesWithExisting.length > 0) {
            allDuplicates.push({sheet: 'Categories', items: duplicatesWithExisting});
          }
          
          // If duplicates found, skip importing this sheet
          if (duplicatesInImport.length > 0 || duplicatesWithExisting.length > 0) {
            // Skip the import loop for this sheet
            results.push(`Categories: 0 success, ${categories.length} failed (duplicates)`);
          } else {
          
          for (const row of categories) {
            try {
              const name = row['Category Name']?.toString().trim();
              
              // Check if category already exists
              if (name && existingCategories.includes(name.toLowerCase())) {
                catError++;
                continue;
              }
              
              const res = await fetch(`${API_BASE_URL}/api/company/categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name }),
              });
              if (res.ok) {
                catSuccess++;
                existingCategories.push(name.toLowerCase());
              } else {
                catError++;
              }
            } catch { catError++; }
          }
            results.push(`Categories: ${catSuccess} success, ${catError} failed`);
            totalSuccess += catSuccess;
            totalError += catError;
          }
        }

        // Import Departments
        if (workbook.SheetNames.includes('Departments')) {
          const sheet = workbook.Sheets['Departments'];
          const departments = XLSX.utils.sheet_to_json(sheet) as any[];
          let deptSuccess = 0, deptError = 0;
          
          // Fetch existing departments
          let existingDepartments: string[] = [];
          try {
            const existingRes = await fetch(`${API_BASE_URL}/api/company/departments`, { credentials: "include" });
            const existing = await existingRes.json();
            existingDepartments = existing.map((dept: any) => dept.name?.toLowerCase()).filter(Boolean);
          } catch {}
          
          // Check for duplicates within import data
          const importDepartments = new Set<string>();
          const duplicatesInImport: string[] = [];
          const duplicatesWithExisting: string[] = [];
          
          for (const row of departments) {
            const name = row['Department Name']?.toString().trim().toLowerCase();
            if (name) {
              if (importDepartments.has(name)) {
                duplicatesInImport.push(name);
              }
              importDepartments.add(name);
              
              // Check against existing
              if (existingDepartments.includes(name)) {
                duplicatesWithExisting.push(name);
              }
            }
          }
          
          if (duplicatesInImport.length > 0) {
            allDuplicates.push({sheet: 'Departments', items: duplicatesInImport});
          }
          if (duplicatesWithExisting.length > 0) {
            allDuplicates.push({sheet: 'Departments', items: duplicatesWithExisting});
          }
          
          // If duplicates found, skip importing this sheet
          if (duplicatesInImport.length > 0 || duplicatesWithExisting.length > 0) {
            // Skip the import loop for this sheet
            results.push(`Departments: 0 success, ${departments.length} failed (duplicates)`);
          } else {
          
          for (const row of departments) {
            try {
              const name = row['Department Name']?.toString().trim();
              
              // Check if department already exists
              if (name && existingDepartments.includes(name.toLowerCase())) {
                deptError++;
                continue;
              }
              
              const res = await fetch(`${API_BASE_URL}/api/company/departments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  name,
                  head: row['Head'],
                  email: row['Email']
                }),
              });
              if (res.ok) {
                deptSuccess++;
                existingDepartments.push(name.toLowerCase());
              } else {
                deptError++;
              }
            } catch { deptError++; }
          }
            results.push(`Departments: ${deptSuccess} success, ${deptError} failed`);
            totalSuccess += deptSuccess;
            totalError += deptError;
          }
        }

        // Import Employees
        if (workbook.SheetNames.includes('Employees')) {
          const sheet = workbook.Sheets['Employees'];
          const employees = XLSX.utils.sheet_to_json(sheet) as any[];
          let empSuccess = 0, empError = 0;
          
          // Fetch existing employees to check for duplicate emails
          let existingEmails: string[] = [];
          try {
            const existingRes = await fetch(`${API_BASE_URL}/api/employees`, { credentials: "include" });
            const existingEmployees = await existingRes.json();
            existingEmails = existingEmployees.map((emp: any) => emp.email?.toLowerCase()).filter(Boolean);
          } catch {}
          
          // Check for duplicate emails within import data and missing emails
          const importEmails = new Set<string>();
          const duplicatesInImport: string[] = [];
          const duplicatesWithExisting: string[] = [];
          const missingEmails: string[] = [];
          
          for (const row of employees) {
            const name = row['Full Name']?.toString().trim();
            const email = row['Email']?.toString().trim().toLowerCase();
            
            // Check if email is missing
            if (!email && name) {
              missingEmails.push(name);
              continue;
            }
            
            if (email) {
              if (importEmails.has(email)) {
                duplicatesInImport.push(email);
              }
              importEmails.add(email);
              
              // Check against existing
              if (existingEmails.includes(email)) {
                duplicatesWithExisting.push(email);
              }
            }
          }
          
          if (duplicatesInImport.length > 0) {
            allDuplicates.push({sheet: 'Employees', items: duplicatesInImport});
          }
          if (duplicatesWithExisting.length > 0 && duplicatesInImport.length === 0) {
            allDuplicates.push({sheet: 'Employees', items: duplicatesWithExisting});
          }
          if (missingEmails.length > 0) {
            allDuplicates.push({sheet: 'Employees', items: missingEmails.map(name => `${name} (Missing Email)`)});
          }
          
          // If duplicates found, show error and stop import
          if (duplicatesInImport.length > 0) {
            toast({
              title: "Import Failed",
              description: `Duplicate emails found in Excel: ${duplicatesInImport.join(', ')}`,
              variant: "destructive",
              duration: 5000,
            });
            return;
          }
          
          for (const row of employees) {
            try {
              const name = row['Full Name']?.toString().trim();
              const email = row['Email']?.toString().trim();
              
              // Skip if email is missing (already caught in validation above)
              if (!email || !name) {
                empError++;
                continue;
              }
              
              // Check if email already exists in system
              if (existingEmails.includes(email.toLowerCase())) {
                empError++;
                continue; // Skip this employee
              }
              
              const res = await fetch(`${API_BASE_URL}/api/employees`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  name: row['Full Name'],
                  email: email,
                  department: row['Department'],
                  role: row['Role'],
                  jobTitle: row['Role'],
                  status: row['Status'] && row['Status'].toString().trim() ? row['Status'].toString().trim() : 'Active'
                }),
              });
              if (res.ok) {
                empSuccess++;
                // Add to existing emails to prevent duplicates within this import
                if (email) existingEmails.push(email.toLowerCase());
              } else {
                empError++;
              }
            } catch { empError++; }
          }
          results.push(`Employees: ${empSuccess} success, ${empError} failed`);
          totalSuccess += empSuccess;
          totalError += empError;
        }

        // Import Currencies
        if (workbook.SheetNames.includes('Currencies')) {
          const sheet = workbook.Sheets['Currencies'];
          const currencies = XLSX.utils.sheet_to_json(sheet) as any[];
          let currSuccess = 0, currError = 0;
          
          // Fetch existing currencies
          let existingCurrencies: string[] = [];
          try {
            const existingRes = await fetch(`${API_BASE_URL}/api/currencies`, { credentials: "include" });
            const existing = await existingRes.json();
            existingCurrencies = existing.map((curr: any) => curr.code?.toUpperCase()).filter(Boolean);
          } catch {}
          
          // Check for duplicates within import data
          const importCurrencies = new Set<string>();
          const duplicatesInImport: string[] = [];
          const duplicatesWithExisting: string[] = [];
          
          for (const row of currencies) {
            // Parse the new format: "$ United States Dollar (USD)"
            const currencyStr = (row['Currency'] || '').toString().trim();
            if (!currencyStr || currencyStr.includes('⚠️ NOTE') || currencyStr.includes('NOTE')) {
              continue;
            }
            
            // Extract code from format "Symbol Description (CODE)"
            const codeMatch = currencyStr.match(/\(([A-Z]{3})\)$/);
            const code = codeMatch ? codeMatch[1] : '';
            
            if (code) {
              if (importCurrencies.has(code)) {
                duplicatesInImport.push(currencyStr);
              }
              importCurrencies.add(code);
              
              // Check against existing
              if (existingCurrencies.includes(code)) {
                duplicatesWithExisting.push(currencyStr);
              }
            }
          }
          
          if (duplicatesInImport.length > 0) {
            allDuplicates.push({sheet: 'Currencies', items: duplicatesInImport});
          }
          if (duplicatesWithExisting.length > 0 && duplicatesInImport.length === 0) {
            allDuplicates.push({sheet: 'Currencies', items: duplicatesWithExisting});
          }
          
          for (const row of currencies) {
            try {
              const currencyStr = (row['Currency'] || '').toString().trim();
              
              // Skip instruction/note rows
              if (!currencyStr || currencyStr.includes('⚠️ NOTE') || currencyStr.includes('NOTE')) {
                continue;
              }
              
              // Parse format: "$ United States Dollar (USD)"
              const codeMatch = currencyStr.match(/\(([A-Z]{3})\)$/);
              const symbolMatch = currencyStr.match(/^([^\s]+)/);
              const descMatch = currencyStr.match(/^[^\s]+\s+(.+?)\s+\([A-Z]{3}\)$/);
              
              const currencyCode = codeMatch ? codeMatch[1] : '';
              const symbol = symbolMatch ? symbolMatch[1] : '';
              const description = descMatch ? descMatch[1] : '';
              
              // Check if currency already exists
              if (currencyCode && existingCurrencies.includes(currencyCode)) {
                currError++;
                continue;
              }
              // Check if currency already exists
              if (currencyCode && existingCurrencies.includes(currencyCode)) {
                currError++;
                continue;
              }
              
              // Find exchange rate column (handles any currency code like SGD, USD, LCY, etc.)
              const exchangeRateKey = Object.keys(row).find(key => 
                key.startsWith('Exch.Rate against 1') || key === 'Exchange Rate'
              );
              const exchangeRate = exchangeRateKey ? parseFloat(row[exchangeRateKey]) || 1 : 1;
              
              const res = await fetch(`${API_BASE_URL}/api/currencies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  code: currencyCode,
                  name: description,
                  symbol: symbol,
                  exchangeRate: exchangeRate
                }),
              });
              if (res.ok) {
                currSuccess++;
                existingCurrencies.push(currencyCode);
              } else {
                currError++;
              }
            } catch { currError++; }
          }
          results.push(`Currencies: ${currSuccess} success, ${currError} failed`);
          totalSuccess += currSuccess;
          totalError += currError;
        }

        // Import Payment Methods
        if (workbook.SheetNames.includes('Payment Methods')) {
          const sheet = workbook.Sheets['Payment Methods'];
          const payments = XLSX.utils.sheet_to_json(sheet) as any[];
          let paySuccess = 0, payError = 0;
          
          // Fetch existing payment methods
          let existingPayments: string[] = [];
          try {
            const existingRes = await fetch(`${API_BASE_URL}/api/payment`, { credentials: "include" });
            const existing = await existingRes.json();
            existingPayments = existing.map((pay: any) => pay.name?.toLowerCase()).filter(Boolean);
          } catch {}
          
          // Check for duplicates within import data
          const importPayments = new Set<string>();
          const duplicatesInImport: string[] = [];
          const duplicatesWithExisting: string[] = [];
          
          for (const row of payments) {
            const name = (row['Name'] || row['Title'] || '').toString().trim().toLowerCase();
            if (name) {
              if (importPayments.has(name)) {
                duplicatesInImport.push(name);
              }
              importPayments.add(name);
              
              // Check against existing
              if (existingPayments.includes(name)) {
                duplicatesWithExisting.push(name);
              }
            }
          }
          
          if (duplicatesInImport.length > 0) {
            allDuplicates.push({sheet: 'Payment Methods', items: duplicatesInImport});
          }
          if (duplicatesWithExisting.length > 0 && duplicatesInImport.length === 0) {
            allDuplicates.push({sheet: 'Payment Methods', items: duplicatesWithExisting});
          }
          
          if (duplicatesInImport.length > 0) {
            toast({
              title: "Import Failed - Duplicate Payment Methods",
              description: `Duplicate payment methods in Excel: ${duplicatesInImport.join(', ')}`,
              variant: "destructive",
              duration: 5000,
            });
            return;
          }
          
          for (const row of payments) {
            try {
              const name = (row['Name'] || row['Title'] || '').toString().trim();
              
              // Check if payment method already exists
              if (name && existingPayments.includes(name.toLowerCase())) {
                payError++;
                continue;
              }
              
              const expiresAtRaw = row['Expires at'] || '';
              let expiresAt = '';
              // Convert MM/YYYY to YYYY-MM format for month input
              if (expiresAtRaw && typeof expiresAtRaw === 'string') {
                const match = expiresAtRaw.match(/^(\d{2})\/(\d{4})$/);
                if (match) {
                  const [, month, year] = match;
                  expiresAt = `${year}-${month}`;
                } else {
                  expiresAt = expiresAtRaw; // Use as-is if already in correct format
                }
              }
              
              const res = await fetch(`${API_BASE_URL}/api/payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  name,
                  type: row['Type'],
                  owner: row['Owner'] || '',
                  manager: row['Managed by'] || '',
                  financialInstitution: row['Financial Institution'] || '',
                  lastFourDigits: row['Last 4 Digits'] || '',
                  expiresAt
                }),
              });
              if (res.ok) {
                paySuccess++;
                existingPayments.push(name.toLowerCase());
              } else {
                payError++;
              }
            } catch { payError++; }
          }
          results.push(`Payment Methods: ${paySuccess} success, ${payError} failed`);
          totalSuccess += paySuccess;
          totalError += payError;
        }

        // Import Subscriptions last
        if (workbook.SheetNames.includes('Subscriptions')) {
          const sheet = workbook.Sheets['Subscriptions'];
          const subscriptions = XLSX.utils.sheet_to_json(sheet) as any[];
          let subSuccess = 0, subError = 0;
          
          // Fetch existing subscriptions to check for duplicates
          let existingSubscriptions: Array<{serviceName: string, vendor: string}> = [];
          try {
            const existingRes = await fetch(`${API_BASE_URL}/api/subscriptions`, { credentials: "include" });
            const existing = await existingRes.json();
            existingSubscriptions = existing.map((sub: any) => ({
              serviceName: sub.serviceName?.toLowerCase(),
              vendor: sub.vendor?.toLowerCase()
            })).filter((s: any) => s.serviceName);
          } catch {}
          
          // Fetch currencies once for all subscriptions (performance optimization)
          let currenciesMap: Record<string, number> = {};
          try {
            const currRes = await fetch(`${API_BASE_URL}/api/currencies`, { credentials: "include" });
            if (currRes.ok) {
              const currencies = await currRes.json();
              currencies.forEach((c: any) => {
                if (c.code && c.exchangeRate) {
                  currenciesMap[c.code] = parseFloat(c.exchangeRate);
                }
              });
            }
          } catch (err) {
            console.error('Error fetching exchange rates:', err);
          }
          
          // Check for duplicates within import data (same service name + vendor combination)
          const importSubscriptions = new Set<string>();
          const duplicatesInImport: string[] = [];
          
          for (const row of subscriptions) {
            const serviceName = (row['Service Name'] || row['ServiceName'] || '').toString().trim().toLowerCase();
            const vendor = (row['Vendor'] || row['vendor'] || '').toString().trim().toLowerCase();
            const key = `${serviceName}|${vendor}`;
            
            if (serviceName) {
              if (importSubscriptions.has(key)) {
                duplicatesInImport.push(`${serviceName} (${vendor})`);
              }
              importSubscriptions.add(key);
            }
          }
          
          if (duplicatesInImport.length > 0) {
            toast({
              title: "Import Failed - Duplicate Subscriptions",
              description: `Duplicate subscriptions in Excel: ${duplicatesInImport.join(', ')}`,
              variant: "destructive",
              duration: 5000,
            });
            return;
          }
          
          // Fetch employees to auto-fill owner email
          let employeesMap: Record<string, string> = {};
          try {
            const empRes = await fetch(`${API_BASE_URL}/api/employees`, { credentials: "include" });
            const employees = await empRes.json();
            employees.forEach((emp: any) => {
              employeesMap[emp.name] = emp.email;
            });
          } catch {}
          
          // Helper to normalize date from dd-mm-yyyy or dd/mm/yyyy to yyyy-mm-dd
          const normalizeDate = (dateVal: any): string => {
            if (!dateVal) return new Date().toISOString().split('T')[0];
            const str = String(dateVal).trim();
            
            // Already in yyyy-mm-dd format
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
            
            // dd-mm-yyyy format
            if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
              const [dd, mm, yyyy] = str.split('-');
              return `${yyyy}-${mm}-${dd}`;
            }
            
            // dd/mm/yyyy format
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
              const [dd, mm, yyyy] = str.split('/');
              return `${yyyy}-${mm}-${dd}`;
            }
            
            // Try parsing as date object
            try {
              const d = new Date(str);
              if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
              }
            } catch {}
            
            // Fallback to today
            return new Date().toISOString().split('T')[0];
          };
          
          // Track subscription duplicates
          const subDuplicatesWithExisting: string[] = [];
          
          for (const row of subscriptions) {
            try {
              const ownerName = row['Owner'] || row['owner'] || '';
              const ownerEmail = row['Owner Email'] || row['OwnerEmail'] || employeesMap[ownerName] || '';
              const serviceName = capitalizeWords(row['Service Name'] || row['ServiceName'] || '');
              const vendor = row['Vendor'] || row['vendor'] || '';
              const website = row['Website'] || row['website'] || '';
              const qty = parseInt(row['Quantity'] || row['Qty'] || row['qty']) || 1;
              
              // Validate Qty >= 1
              if (qty < 1) {
                subError++;
                continue;
              }
              
              // Check if subscription already exists (same service name + vendor)
              const isDuplicate = existingSubscriptions.some(
                (sub) => {
                  const match = sub.serviceName === serviceName.toLowerCase() && sub.vendor === vendor.toLowerCase();
                  return match;
                }
              );
              
              if (isDuplicate) {
                subError++;
                subDuplicatesWithExisting.push(`${serviceName}`);
                continue;
              }
              
              // Parse currency - clean up any brackets or extra characters
              let currencyValue = (row['Currency'] || row['currency'] || '').toString().trim();
              // Remove closing bracket if present (e.g., "USD)" -> "USD")
              currencyValue = currencyValue.replace(/\)$/, '');
              // If it's still in format like "(USD", extract just the code
              if (currencyValue.includes('(')) {
                const match = currencyValue.match(/\(([A-Z]{3})\)?/);
                currencyValue = match ? match[1] : currencyValue;
              }
              
              // Parse departments - handle both string and array formats
              let departmentsArray: string[] = [];
              const deptValue = row['Departments'] || row['departments'] || '';
              if (typeof deptValue === 'string') {
                departmentsArray = deptValue.split('|').map((d: string) => d.trim()).filter((d: string) => d);
              } else if (Array.isArray(deptValue)) {
                departmentsArray = deptValue;
              }
              
              // Parse auto renewal - convert Yes/No to boolean
              const autoRenewalValue = (row['Auto Renewal'] || row['autoRenewal'] || '').toString().trim().toLowerCase();
              const autoRenewal = autoRenewalValue === 'yes' || autoRenewalValue === 'true' || autoRenewalValue === '1';
              
              // Calculate total amount if not provided
              const amountPerUnit = parseFloat(row['Amount per unit'] || row['amount per unit'] || row['Amount'] || row['amount']) || 0;
              let totalAmount = parseFloat(row['Total Amount'] || row['total amount'] || row['TotalAmount']) || 0;
              if (!totalAmount && amountPerUnit && qty) {
                totalAmount = amountPerUnit * qty;
              }
              
              // Calculate LCY amount if not provided (using pre-fetched currencies map)
              let lcyAmount = parseFloat(row['LCY Amount (SGD)'] || row['LCY Amount'] || row['lcyAmount']) || 0;
              if (!lcyAmount && totalAmount && currencyValue && currenciesMap[currencyValue]) {
                const exchangeRate = currenciesMap[currencyValue];
                if (exchangeRate > 0) {
                  // LCY Amount = Total Amount ÷ Exchange Rate
                  lcyAmount = totalAmount / exchangeRate;
                }
              }
              
              // Parse notes - convert simple string to array format for card-based UI
              const notesValue = (row['Notes'] || row['notes'] || '').toString().trim();
              let notesArray: Array<{id: string, text: string, createdAt: string, createdBy: string}> = [];
              if (notesValue) {
                notesArray = [{
                  id: Date.now().toString(),
                  text: notesValue,
                  createdAt: new Date().toISOString(),
                  createdBy: currentUserName
                }];
              }
              
              const payload: any = {
                serviceName,
                website,
                vendor,
                qty,
                amount: amountPerUnit,
                totalAmount: totalAmount,
                currency: currencyValue,
                lcyAmount: lcyAmount,
                billingCycle: (row['Commitment cycle'] || row['Commitment Cycle'] || row['Billing Cycle'] || row['BillingCycle'] || 'monthly').toLowerCase(),
                paymentFrequency: (row['Payment Frequency'] || row['payment frequency'] || row['PaymentFrequency'] || '').toString().toLowerCase(),
                paymentMethod: row['Payment Method'] || row['payment method'] || row['PaymentMethod'] || '',
                startDate: normalizeDate(row['Start Date'] || row['StartDate']),
                nextRenewal: normalizeDate(row['Next Renewal'] || row['NextRenewal']),
                autoRenewal: autoRenewal,
                status: row['Status'] || row['status'] || 'Draft',
                category: row['Category'] || row['category'] || '',
                department: JSON.stringify(departmentsArray),
                departments: departmentsArray,
                owner: ownerName,
                ownerEmail: ownerEmail,
                reminderPolicy: row['Reminder Policy'] || row['ReminderPolicy'] || 'One time',
                reminderDays: parseInt(row['Reminder Days'] || row['ReminderDays']) || 7,
                notes: notesArray.length > 0 ? JSON.stringify(notesArray) : undefined
              };
              
              // Basic validation
              if (!payload.serviceName) {
                subError++;
                continue;
              }
              
              const res = await fetch(`${API_BASE_URL}/api/subscriptions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
              });
              if (res.ok) {
                subSuccess++;
                // Add to existing list to prevent duplicates within same import
                existingSubscriptions.push({
                  serviceName: serviceName.toLowerCase(),
                  vendor: vendor.toLowerCase()
                });
              } else {
                subError++;
              }
            } catch { subError++; }
          }
          results.push(`Subscriptions: ${subSuccess} success, ${subError} failed`);
          totalSuccess += subSuccess;
          totalError += subError;
          
          // Add subscription duplicates to the list
          if (subDuplicatesWithExisting.length > 0) {
            allDuplicates.push({sheet: 'Subscriptions', items: subDuplicatesWithExisting});
          }
        }

        // Dismiss loading toast
        loadingToast.dismiss();
        
        // Show specific error for all duplicates
        if (allDuplicates.length > 0) {
          // Track if any items were successfully imported
          hasSuccessfulImportsRef.current = totalSuccess > 0;
          
          setDuplicateAlert({
            show: true,
            duplicates: allDuplicates
          });
          
          // Show import summary if some items succeeded
          if (totalSuccess > 0) {
            toast({
              title: "Import Partially Complete",
              description: results.join(' | '),
              variant: "destructive",
            });
          }
          
          // Don't refresh page when duplicates are shown - user needs to close the dialog first
          return;
        }

        // Show import summary
        toast({
          title: "Import Complete",
          description: results.join(' | '),
          variant: totalError > 0 ? "destructive" : "default",
        });

        // Refresh the page to show new data
        window.location.reload();
      } catch (error) {
        // Dismiss loading toast on error
        loadingToast.dismiss();
        
        toast({
          title: "Import Failed",
          description: "Failed to parse Excel file. Please check the format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCloseDuplicateDialog = () => {
    setDuplicateAlert({show: false, duplicates: []});
    // Reload page if some items were successfully imported
    if (hasSuccessfulImportsRef.current) {
      window.location.reload();
    }
    hasSuccessfulImportsRef.current = false;
  };

  // Auto-focus the duplicate alert dialog when it appears
  const duplicateDialogRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (duplicateAlert.show && duplicateDialogRef.current) {
      // Focus the dialog container to make it interactive immediately
      duplicateDialogRef.current.focus();
      // Also ensure the body doesn't scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [duplicateAlert.show]);

  return (
    <>
      {/* Custom Centered Alert for Duplicate Items */}
      {duplicateAlert.show && (
        <div 
          ref={duplicateDialogRef}
          tabIndex={-1}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleCloseDuplicateDialog}
          style={{ overflow: 'auto', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif" }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-4 animate-in zoom-in-95 duration-200 relative z-[10000]"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 2rem)', pointerEvents: 'auto' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl">⚠️</div>
                <div>
                  <h3 className="text-xl font-bold text-white">Duplicate Items Found</h3>
                  <p className="text-red-100 text-sm mt-0.5">Cannot import existing data</p>
                </div>
              </div>
              <button
                onClick={handleCloseDuplicateDialog}
                className="text-white hover:bg-red-800 rounded-lg p-2 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <div className="space-y-4">
                {duplicateAlert.duplicates.map((duplicate, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <h4 className="font-semibold text-red-800 text-sm">{duplicate.sheet}</h4>
                    </div>
                    <div className="space-y-1">
                      {duplicate.items.map((item, itemIndex) => (
                        <span key={itemIndex} className="inline-block bg-white px-3 py-1 rounded-md text-xs text-red-700 border border-red-100 mr-2 mb-2">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-white px-6 py-5 border-t border-gray-100 flex justify-center">
              <button
                onClick={handleCloseDuplicateDialog}
                className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm transition-all duration-200"
      >
        <FileSpreadsheet className="w-[18px] h-[18px] text-gray-500" />
        <span className="font-medium">Import/Export</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <FileSpreadsheet className="w-5 h-5" />
              Unified Import/Export
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4 bg-white">
            <p className="text-sm text-gray-600">
              Import or export all your data (subscriptions, categories, departments, employees, currencies, payment methods) in one Excel file.
            </p>
            
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="w-full justify-start gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 bg-white"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download Template
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={importData}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full justify-start gap-2 border-green-300 text-green-700 hover:bg-green-50 bg-white"
              >
                <Upload className="w-4 h-4" />
                
                Import Data
              </Button>
              
              <Button
                variant="outline"
                onClick={exportAllData}
                className="w-full justify-start gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 bg-white"
              >
                <Download className="w-4 h-4" />
                Export All Data
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
