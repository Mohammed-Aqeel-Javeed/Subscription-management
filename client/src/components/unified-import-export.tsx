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
  { code: "AUD", description: "Australian Dollar", symbol: "A$" },
  { code: "BDT", description: "Bangladeshi Taka", symbol: "৳" },
  { code: "BGN", description: "Bulgarian Lev", symbol: "лв" },
  { code: "BRL", description: "Brazilian Real", symbol: "R$" },
  { code: "CAD", description: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", description: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", description: "Chinese Yuan", symbol: "¥" },
  { code: "CZK", description: "Czech Koruna", symbol: "Kč" },
  { code: "DKK", description: "Danish Krone", symbol: "kr" },
  { code: "EGP", description: "Egyptian Pound", symbol: "£" },
  { code: "EUR", description: "Euro", symbol: "€" },
  { code: "GBP", description: "British Pound Sterling", symbol: "£" },
  { code: "HKD", description: "Hong Kong Dollar", symbol: "HK$" },
  { code: "HUF", description: "Hungarian Forint", symbol: "Ft" },
  { code: "IDR", description: "Indonesian Rupiah", symbol: "Rp" },
  { code: "ILS", description: "Israeli New Shekel", symbol: "₪" },
  { code: "INR", description: "Indian Rupee", symbol: "₹" },
  { code: "JPY", description: "Japanese Yen", symbol: "¥" },
  { code: "KRW", description: "South Korean Won", symbol: "₩" },
  { code: "MXN", description: "Mexican Peso", symbol: "$" },
  { code: "MYR", description: "Malaysian Ringgit", symbol: "RM" },
  { code: "NOK", description: "Norwegian Krone", symbol: "kr" },
  { code: "NZD", description: "New Zealand Dollar", symbol: "NZ$" },
  { code: "PHP", description: "Philippine Peso", symbol: "₱" },
  { code: "PKR", description: "Pakistani Rupee", symbol: "₨" },
  { code: "PLN", description: "Polish Zloty", symbol: "zł" },
  { code: "RUB", description: "Russian Ruble", symbol: "₽" },
  { code: "SAR", description: "Saudi Riyal", symbol: "﷼" },
  { code: "SEK", description: "Swedish Krona", symbol: "kr" },
  { code: "SGD", description: "Singapore Dollar", symbol: "S$" },
  { code: "THB", description: "Thai Baht", symbol: "฿" },
  { code: "TRY", description: "Turkish Lira", symbol: "₺" },
  { code: "TWD", description: "New Taiwan Dollar", symbol: "NT$" },
  { code: "USD", description: "United States Dollar", symbol: "$" },
  { code: "VND", description: "Vietnamese Dong", symbol: "₫" },
  { code: "ZAR", description: "South African Rand", symbol: "R" }
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
    instructionsSheet.addRow(['   • Expires at: Expiration date in MM/YYYY format (e.g., 12/2027)']);
    instructionsSheet.addRow(['   • Used in: Subscriptions sheet for payment method selection']);
    instructionsSheet.addRow([]);
    
    // Subscriptions
    const subRow = instructionsSheet.addRow(['6️⃣ Subscriptions Sheet']);
    subRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    instructionsSheet.addRow(['   • Service Name: Subscription service name (auto-capitalizes first letter)']);
    instructionsSheet.addRow(['   • Vendor: Select from dropdown (90+ popular vendors available)']);
    instructionsSheet.addRow(['   • Amount: Subscription cost']);
    instructionsSheet.addRow(['   • Commitment cycle: Select from dropdown (Monthly, Yearly, Quarterly, Weekly, Trail)']);
    instructionsSheet.addRow(['   • Start Date: Format dd/mm/yyyy (e.g., 01/01/2025)']);
    instructionsSheet.addRow(['   • Next Renewal: Auto-calculates based on Start Date + Commitment cycle']);
    instructionsSheet.addRow(['   • Status: Subscription status (Active, Inactive, etc.)']);
    instructionsSheet.addRow(['   • Category: Select from dropdown (references Categories sheet)']);
    instructionsSheet.addRow(['   • Departments: Enter department names separated by | (e.g., IT|Marketing)']);
    instructionsSheet.addRow(['   • Owner: Select from dropdown (references Employees sheet)']);
    instructionsSheet.addRow(['   • Owner Email: Auto-fills when you select Owner']);
    instructionsSheet.addRow(['   • Reminder Policy: Reminder frequency']);
    instructionsSheet.addRow(['   • Reminder Days: Days before renewal to send reminder']);
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
    instructionsSheet.addRow(['   🎯 Next Renewal auto-calculates - no manual entry needed']);
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
    
    // Add sample rows
    const usdRow = currencySheet.getRow(3);
    usdRow.getCell(1).value = '$ United States Dollar (USD)';
    usdRow.getCell(2).value = '1.00';
    usdRow.commit();
    
    const eurRow = currencySheet.getRow(4);
    eurRow.getCell(1).value = '€ Euro (EUR)';
    eurRow.getCell(2).value = '0.85';
    eurRow.commit();
    
    const inrRow = currencySheet.getRow(5);
    inrRow.getCell(1).value = '₹ Indian Rupee (INR)';
    inrRow.getCell(2).value = '83.12';
    inrRow.commit();
    
    // Add dropdown list validation ONLY (duplicate check will happen on import)
    for (let i = 3; i <= 500; i++) {
      const cell = currencySheet.getCell(`A${i}`);
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
    
    // 2. CATEGORIES SHEET
    const catSheet = workbook.addWorksheet('Categories');
    catSheet.columns = [{ header: 'Category Name', key: 'name', width: 25 }];
    catSheet.addRow({ name: 'Software & SaaS' });
    catSheet.addRow({ name: 'Entertainment' });
    catSheet.addRow({ name: 'Cloud Services' });
    
    // Add duplicate validation for Category Name
    for (let i = 2; i <= 500; i++) {
      const cell = catSheet.getCell(`A${i}`);
      cell.dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`COUNTIF($A$2:$A$500,A${i})=1`],
        showInputMessage: true,
        promptTitle: 'Category Name Required',
        prompt: 'Enter a unique category name. Duplicates are not allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Duplicate Category',
        error: 'This category name already exists! Please use a unique name.'
      };
    }
    
    // 3. DEPARTMENTS SHEET
    const deptSheet = workbook.addWorksheet('Departments');
    deptSheet.columns = [
      { header: 'Department Name', key: 'name', width: 20 },
      { header: 'Head', key: 'head', width: 20 },
      { header: 'Email', key: 'email', width: 25 }
    ];
    deptSheet.addRow({ name: 'IT', head: 'Jane Smith', email: 'jane@company.com' });
    deptSheet.addRow({ name: 'Marketing', head: 'John Doe', email: 'john@company.com' });
    deptSheet.addRow({ name: 'Finance', head: 'Sarah Lee', email: 'sarah@company.com' });
    
    // Add duplicate validation for Department Name
    for (let i = 2; i <= 500; i++) {
      const cell = deptSheet.getCell(`A${i}`);
      cell.dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`COUNTIF($A$2:$A$500,A${i})=1`],
        showInputMessage: true,
        promptTitle: 'Department Name Required',
        prompt: 'Enter a unique department name. Duplicates are not allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Duplicate Department',
        error: 'This department name already exists! Please use a unique name.'
      };
    }
    
    // 4. EMPLOYEES SHEET
    const empSheet = workbook.addWorksheet('Employees');
    empSheet.columns = [
      { header: 'Full Name', key: 'name', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Status', key: 'status', width: 12 }
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
      // Email validation - required and must be valid email format with duplicate check
      const emailCell = empSheet.getCell(`B${i}`);
      emailCell.dataValidation = {
        type: 'custom',
        allowBlank: false,
        formulae: [`AND(NOT(ISERROR(FIND("@",B${i}))),NOT(ISERROR(FIND(".",B${i}))),COUNTIF($B$2:$B$500,B${i})=1)`],
        showInputMessage: true,
        promptTitle: 'Email Required',
        prompt: 'Enter a valid email address (must contain @ and .). No duplicates allowed.',
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Invalid or Duplicate Email',
        error: 'Please enter a valid, unique email address. Email must contain @ and . symbols and must not be duplicated.'
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
    }
    
    // 5. PAYMENT METHODS SHEET
    const paySheet = workbook.addWorksheet('Payment Methods');
    paySheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Managed by', key: 'managedBy', width: 25 },
      { header: 'Financial Institution', key: 'financialInstitution', width: 25 },
      { header: 'Expires at', key: 'expiresAt', width: 15 }
    ];
    
    // Add sample row
    paySheet.addRow({
      name: 'Corporate Visa',
      type: 'Credit',
      managedBy: 'John Doe',
      financialInstitution: 'HSBC Bank',
      expiresAt: '12/2027'
    });
    
    // Set Expires at column (E) to text format to preserve slashes
    const samplePayRow = paySheet.getRow(2);
    samplePayRow.getCell(5).numFmt = '@'; // Text format for Expires at column
    
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
      
      // Add Managed by (Employee) dropdown for Payment Methods (C column) - references Employees sheet
      const managedByCell = paySheet.getCell(`C${i}`);
      managedByCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Employees!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Employee',
        prompt: 'Choose an employee from the Employees sheet.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Employee',
        error: 'Please select a valid employee.'
      };
      
      // Set Expires at column (E) to text format for all rows to preserve slashes
      const expiresAtCell = paySheet.getCell(`E${i}`);
      expiresAtCell.numFmt = '@';
    }
    
    // 6. VENDORS SHEET (Hidden)
    const vendorsSheet = workbook.addWorksheet('Vendors');
    vendorsSheet.state = 'veryHidden';
    vendorsSheet.columns = [{ header: 'Vendor Name', key: 'name', width: 30 }];
    
    // Add complete vendor list matching subscription modal VENDOR_LIST exactly
    const VENDOR_LIST = [
      "Netflix", "Disney+", "Amazon Prime / Prime Video", "Apple TV+", "HBO GO (Asia)", "Viu", "iQIYI", 
      "meWATCH Prime (Mediacorp)", "Spotify", "Apple Music", "YouTube Premium", "Tidal", "Audible",
      "PlayStation Plus", "Xbox Game Pass", "Nintendo Switch Online", "Microsoft 365", "Zoom", 
      "Google Workspace", "Slack", "Notion", "Dropbox", "Box", "iCloud+", "Asana", "Monday.com", 
      "Trello", "Miro", "DocuSign", "Calendly", "Adobe Acrobat / Sign", "Adobe Creative Cloud", 
      "Figma", "Canva Pro", "Sketch", "Affinity (V2)", "Procreate (add-ons)", "Shutterstock", 
      "Envato Elements", "GitHub", "GitLab", "Bitbucket", "JetBrains", "AWS", "Microsoft Azure", 
      "Google Cloud Platform", "DigitalOcean", "Linode / Akamai", "Cloudflare", "Vercel", "Netlify", 
      "Heroku", "Datadog", "New Relic", "Sentry", "PagerDuty", "Auth0 (Okta)", "Twilio", "SendGrid", 
      "Mailgun", "Salesforce", "HubSpot", "Pipedrive", "Zoho", "Mailchimp", "Klaviyo", "Intercom", 
      "Zendesk", "Freshdesk / Freshworks", "Typeform", "SurveyMonkey", "Buffer", "Hootsuite", 
      "SEMrush", "Ahrefs", "Xero", "QuickBooks Online", "FreshBooks", "SAP Concur", "Expensify", 
      "Stripe (Billing)", "Chargebee", "Zuora", "PayPal (subscriptions)", "Osome", "Sleek", 
      "JustLogin", "Talenox", "Swingvy", "QuickHR", "StaffAny", "Employment Hero", "Deel", "Remote", 
      "Rippling", "Workday", "SAP SuccessFactors", "1Password", "LastPass", "Dashlane", "Norton 360", 
      "Bitdefender", "ESET", "Kaspersky", "Malwarebytes", "Backblaze", "CrashPlan", "Acronis", 
      "NordVPN", "ExpressVPN", "Surfshark", "Proton VPN", "Singtel", "StarHub", "M1", "MyRepublic", 
      "ViewQwest", "WhizComms", "Simba (TPG)", "The Straits Times", "The Business Times", 
      "Lianhe Zaobao", "The Edge Singapore", "Tech in Asia+", "Nikkei Asia", "Financial Times", 
      "The Economist", "Bloomberg", "The Wall Street Journal", "GrabUnlimited (Grab)", "Deliveroo Plus", 
      "Foodpanda Pro", "Amazon Prime (Fresh benefits)", "ClassPass", "Strava", "Fitbit Premium", 
      "Apple Fitness+", "Calm", "Headspace", "LinkedIn",
    ];
    
    VENDOR_LIST.forEach(vendor => {
      vendorsSheet.addRow({ name: vendor });
    });
    
    // 7. SUBSCRIPTIONS SHEET
    const subsSheet = workbook.addWorksheet('Subscriptions');
    subsSheet.columns = [
      { header: 'Service Name', key: 'serviceName', width: 20 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Commitment cycle', key: 'billingCycle', width: 18 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'Next Renewal', key: 'nextRenewal', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Departments', key: 'departments', width: 20 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Owner Email', key: 'ownerEmail', width: 25 },
      { header: 'Reminder Policy', key: 'reminderPolicy', width: 15 },
      { header: 'Reminder Days', key: 'reminderDays', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];
    
    // Add sample row with formula for Next Renewal
    const sampleRow = subsSheet.getRow(2);
    sampleRow.getCell(1).value = 'Netflix';
    sampleRow.getCell(2).value = 'Netflix Inc';
    sampleRow.getCell(3).value = 15.99;
    sampleRow.getCell(4).value = 'Monthly';
    sampleRow.getCell(5).value = '01/01/2025';
    sampleRow.getCell(5).numFmt = '@'; // Text format to preserve slashes
    // Next Renewal formula (column 6/F)
    sampleRow.getCell(6).value = {
      formula: `IF(AND(E2<>"",D2<>""),TEXT(IF(D2="Monthly",DATE(YEAR(E2),MONTH(E2)+1,DAY(E2))-1,IF(D2="Quarterly",DATE(YEAR(E2),MONTH(E2)+3,DAY(E2))-1,IF(D2="Yearly",DATE(YEAR(E2)+1,MONTH(E2),DAY(E2))-1,IF(D2="Weekly",E2+6,IF(D2="Trail",E2+30,""))))),"dd/mm/yyyy"),"")`,
      result: '31/01/2025'
    };
    sampleRow.getCell(6).numFmt = '@'; // Text format to preserve slashes
    sampleRow.getCell(7).value = 'Active';
    sampleRow.getCell(8).value = 'Entertainment';
    sampleRow.getCell(9).value = 'Marketing';
    sampleRow.getCell(10).value = 'John Doe';
    // Owner Email formula (column 11/K) - VLOOKUP to get email from Employees sheet
    sampleRow.getCell(11).value = {
      formula: `IF(J2<>"",IFERROR(VLOOKUP(J2,Employees!A:B,2,FALSE),""),"")`,
      result: 'john@company.com'
    };
    sampleRow.getCell(12).value = 'One time';
    sampleRow.getCell(13).value = 7;
    sampleRow.getCell(14).value = 'Team streaming subscription';
    sampleRow.commit();
    
    // Add Commitment cycle dropdown and other validations for Subscriptions
    const commitmentCycles = ['Monthly', 'Yearly', 'Quarterly', 'Weekly', 'Trail'];
    for (let i = 2; i <= 500; i++) {
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
      
      // Vendor dropdown (B column) - references Vendors sheet
      const vendorCell = subsSheet.getCell(`B${i}`);
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
      
      // Commitment cycle dropdown (D column)
      const cycleCell = subsSheet.getCell(`D${i}`);
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
      
      // Add Next Renewal formula for all rows (F column)
      if (i > 2) { // Skip row 2 as we already added it
        const renewalCell = subsSheet.getCell(`F${i}`);
        renewalCell.value = {
          formula: `IF(AND(E${i}<>"",D${i}<>""),TEXT(IF(D${i}="Monthly",DATE(YEAR(E${i}),MONTH(E${i})+1,DAY(E${i}))-1,IF(D${i}="Quarterly",DATE(YEAR(E${i}),MONTH(E${i})+3,DAY(E${i}))-1,IF(D${i}="Yearly",DATE(YEAR(E${i})+1,MONTH(E${i}),DAY(E${i}))-1,IF(D${i}="Weekly",E${i}+6,IF(D${i}="Trail",E${i}+30,""))))),"dd/mm/yyyy"),"")`,
          result: ''
        };
        renewalCell.numFmt = '@'; // Text format to preserve slashes
      }
      
      // Set date format for Start Date column to text format (preserves slashes)
      const startDateCell = subsSheet.getCell(`E${i}`);
      startDateCell.numFmt = '@';
      
      // Category dropdown (H2:H500) - references Categories sheet
      const categoryCell = subsSheet.getCell(`H${i}`);
      categoryCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Categories!$A$2:$A$500'],
        showInputMessage: true,
        promptTitle: 'Select Category',
        prompt: 'Choose a category from the Categories sheet.',
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Invalid Category',
        error: 'Please select a valid category.'
      };
      
      // Department dropdown (I2:I500) - references Departments sheet
      const deptCell = subsSheet.getCell(`I${i}`);
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
      
      // Add Owner (Employee) dropdown for Subscriptions (J2:J500) - references Employees sheet
      const ownerCell = subsSheet.getCell(`J${i}`);
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
      
      // Add Owner Email auto-fill formula for all rows (K column) - VLOOKUP from Employees
      if (i > 2) {
        const ownerEmailCell = subsSheet.getCell(`K${i}`);
        ownerEmailCell.value = {
          formula: `IF(J${i}<>"",IFERROR(VLOOKUP(J${i},Employees!A:B,2,FALSE),""),"")`,
          result: ''
        };
      }
    }
    
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
          if (duplicatesWithExisting.length > 0 && duplicatesInImport.length === 0) {
            allDuplicates.push({sheet: 'Categories', items: duplicatesWithExisting});
          }
          
          if (duplicatesInImport.length > 0) {
            toast({
              title: "Import Failed - Duplicate Categories",
              description: `Duplicate categories in Excel: ${duplicatesInImport.join(', ')}`,
              variant: "destructive",
              duration: 5000,
            });
            return;
          }
          
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
          if (duplicatesWithExisting.length > 0 && duplicatesInImport.length === 0) {
            allDuplicates.push({sheet: 'Departments', items: duplicatesWithExisting});
          }
          
          if (duplicatesInImport.length > 0) {
            toast({
              title: "Import Failed - Duplicate Departments",
              description: `Duplicate departments in Excel: ${duplicatesInImport.join(', ')}`,
              variant: "destructive",
              duration: 5000,
            });
            return;
          }
          
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
          
          if (duplicatesInImport.length > 0) {
            toast({
              title: "Import Failed - Duplicate Currencies",
              description: `Duplicate currencies in Excel: ${duplicatesInImport.join(', ')}`,
              variant: "destructive",
              duration: 5000,
            });
            return;
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
              
              const res = await fetch(`${API_BASE_URL}/api/currencies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  code: currencyCode,
                  name: description,
                  symbol: symbol,
                  exchangeRate: row['Exch.Rate against 1 LCY'] || row['Exchange Rate'] || 1
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
              
              const res = await fetch(`${API_BASE_URL}/api/payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  name,
                  type: row['Type'],
                  manager: row['Managed by'] || '',
                  financialInstitution: row['Financial Institution'] || '',
                  expiresAt: row['Expires at'] || ''
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
              
              const payload: any = {
                serviceName,
                vendor,
                amount: parseFloat(row['Amount']) || 0,
                billingCycle: (row['Commitment cycle'] || row['Billing Cycle'] || row['BillingCycle'] || 'monthly').toLowerCase(),
                startDate: normalizeDate(row['Start Date'] || row['StartDate']),
                nextRenewal: normalizeDate(row['Next Renewal'] || row['NextRenewal']),
                status: row['Status'] || row['status'] || 'Draft',
                category: row['Category'] || row['category'] || '',
                department: '',
                departments: (row['Departments'] || '').split('|').filter((d: string) => d),
                owner: ownerName,
                ownerEmail: ownerEmail,
                reminderPolicy: row['Reminder Policy'] || row['ReminderPolicy'] || 'One time',
                reminderDays: parseInt(row['Reminder Days'] || row['ReminderDays']) || 7,
                notes: row['Notes'] || row['notes'] || ''
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

        // Show specific error for all duplicates
        if (allDuplicates.length > 0) {
          setDuplicateAlert({
            show: true,
            duplicates: allDuplicates
          });
          // Don't refresh page if there are only duplicates and nothing succeeded
          if (totalSuccess === 0) {
            return;
          }
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

  return (
    <>
      {/* Custom Centered Alert for Duplicate Items */}
      {duplicateAlert.show && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setDuplicateAlert({show: false, duplicates: []})}
          style={{ overflow: 'auto', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif" }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
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
                onClick={() => setDuplicateAlert({show: false, duplicates: []})}
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
                onClick={() => setDuplicateAlert({show: false, duplicates: []})}
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
