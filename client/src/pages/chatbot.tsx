import { useState, useRef, useEffect } from "react";
import { X, Send, Bot } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your Trackla assistant. How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    // FIELD-SPECIFIC QUESTIONS
    
    // Service Name field
    if (lowerMessage.includes("service name") || (lowerMessage.includes("subscription") && lowerMessage.includes("name"))) {
      if (lowerMessage.includes("duplicate") || lowerMessage.includes("already exists") || lowerMessage.includes("error")) {
        return "Service Name Duplicate Error:\n• Each subscription must have a unique service name\n• If you see 'already exists' error, the name is taken\n• Solutions:\n  1. Use a different name (add version, year, or dept)\n  2. Edit the existing subscription instead\n  3. Check if it's in Cancelled status and reactivate\n\nExample: Instead of 'Zoom', use 'Zoom Pro 2024' or 'Zoom - Marketing'";
      }
      return "Service Name Field:\n• Required field when adding subscription\n• Must be unique (no duplicates)\n• Identifies the subscription\n• Shows error if name already exists\n• Can be edited later\n\nTip: Use descriptive names like 'Microsoft 365 - Sales Team'";
    }

    // Vendor field
    if (lowerMessage.includes("vendor") && !lowerMessage.includes("manage")) {
      if (lowerMessage.includes("add") || lowerMessage.includes("new") || lowerMessage.includes("not in list")) {
        return "Adding New Vendor:\n\nMethod 1 - From Subscription Form:\n1. Click Vendor dropdown\n2. Scroll to bottom\n3. Click '+ New' button\n4. You'll be redirected to Configuration page\n5. Add vendor name\n6. Return to subscription and select it\n\nMethod 2 - From Configuration:\n1. Go to Setup & Configuration page\n2. Click 'Vendors' tab\n3. Click '+ Add Vendor'\n4. Enter vendor name\n5. Save\n\nPre-loaded with 90+ popular vendors!";
      }
      return "Vendor Field:\n• Dropdown with search\n• Pre-populated with 90+ vendors\n• Type to search and filter\n• Click '+ New' to add vendor\n• Optional but recommended\n\nPopular vendors included: Microsoft, Google, Adobe, Salesforce, Zoom, Slack, etc.";
    }

    // Quantity field
    if (lowerMessage.includes("quantity") || lowerMessage.includes("qty") || (lowerMessage.includes("license") && lowerMessage.includes("number"))) {
      return "Quantity Field:\n• Number of licenses/units/seats\n• Must be at least 1\n• Used in calculation: Total = Qty × Amount per unit\n• Example: 10 licenses × $50 = $500 total\n• Can be edited anytime\n\nUse Cases:\n• Software licenses: Number of users\n• Cloud storage: Number of TB\n• API calls: Number of requests";
    }

    // Amount/Pricing fields
    if ((lowerMessage.includes("amount") || lowerMessage.includes("price") || lowerMessage.includes("cost")) && !lowerMessage.includes("lcy")) {
      if (lowerMessage.includes("calculate") || lowerMessage.includes("total")) {
        return "Amount Calculation:\n\n1. Amount per Unit: Cost per license/unit\n2. Quantity: Number of units\n3. Total Amount = Qty × Amount per unit (auto-calculated)\n4. Tax Amount: Optional tax/VAT\n5. Total Incl Tax = Total + Tax (auto-calculated)\n\nExample:\n• 5 licenses × $100 = $500\n• Tax $50\n• Final: $550\n\nYou can manually override any field!";
      }
      return "Amount Fields:\n• Amount per Unit: Cost per license\n• Total Amount: Auto-calculated or manual\n• Tax Amount: Optional tax/VAT\n• Total Incl Tax: Final amount (auto-calculated)\n\nAll amounts support decimals (e.g., 99.99)";
    }

    // LCY Amount
    if (lowerMessage.includes("lcy") || lowerMessage.includes("local currency")) {
      return "LCY Amount (Local Currency):\n• Auto-calculated field (read-only)\n• Converts foreign currency to your local currency\n• Uses exchange rate from Currencies setup\n• Only shows if subscription currency ≠ company default\n• Updates automatically when:\n  - Total amount changes\n  - Currency changes\n  - Exchange rate updates\n\nExample:\n• Subscription: $1000 USD\n• Exchange rate: 1 USD = 1.35 SGD\n• LCY Amount: 1350 SGD\n\nManage exchange rates in Company Details → Currencies!";
    }

    // Dates and Renewal
    if (lowerMessage.includes("renewal date") || lowerMessage.includes("next renewal")) {
      return "Next Renewal Date:\n• Auto-calculated based on:\n  - Start Date\n  - Billing Cycle\n• Can be manually overridden\n• Used for reminder notifications\n• Updates when you change start date or cycle\n\nExamples:\n• Start: Jan 1, 2024 + Monthly = Feb 1, 2024\n• Start: Jan 1, 2024 + Yearly = Jan 1, 2025\n• Start: Jan 1, 2024 + Quarterly = Apr 1, 2024\n\nSet Reminder Days to get notified before renewal!";
    }

    if (lowerMessage.includes("billing cycle") || lowerMessage.includes("commitment cycle")) {
      return "Billing Cycle Options:\n• Monthly - Renews every month\n• Yearly - Renews every year\n• Quarterly - Renews every 3 months\n• Weekly - Renews every week\n• Trial - Testing period\n• Pay-as-you-go - No fixed cycle\n\nAffects:\n• Next renewal date calculation\n• Reminder scheduling\n• Reporting and forecasting\n\nMost common: Monthly and Yearly";
    }

    // Reminder Days
    if (lowerMessage.includes("reminder days") || lowerMessage.includes("reminder") && lowerMessage.includes("how many")) {
      return "Reminder Days:\n• Number of days BEFORE renewal to send notification\n• Triggers Email and/or WhatsApp reminders\n• Sent to Responsible Person\n• Recommended values:\n  - Monthly subscriptions: 7-14 days\n  - Yearly subscriptions: 30-60 days\n  - Critical renewals: 60-90 days\n\nExample:\n• Renewal date: March 1\n• Reminder days: 30\n• Reminder sent: February 1\n\nConfigure notification method in Setup & Configuration!";
    }

    // Responsible Person
    if (lowerMessage.includes("responsible person") || lowerMessage.includes("owner") || lowerMessage.includes("assign")) {
      if (lowerMessage.includes("add") || lowerMessage.includes("not in list") || lowerMessage.includes("new")) {
        return "Adding Responsible Person:\n\nMethod 1 - From Form:\n1. Click Responsible Person dropdown\n2. Scroll to bottom\n3. Click '+ New'\n4. Redirected to Company Details\n5. Add employee (name + email + role)\n6. Return and select them\n\nMethod 2 - From Company Details:\n1. Go to Company Details page\n2. Click 'Employees' tab\n3. Click '+ Add Employee'\n4. Fill: Name, Email, Role, Department\n5. Save\n\nEmployee receives renewal reminders!";
      }
      return "Responsible Person:\n• Employee who manages this subscription/renewal\n• Receives reminder notifications\n• Searchable dropdown (by name or email)\n• Can add new via '+ New' button\n• Optional but highly recommended\n\nSecondary Person:\n• Backup person\n• Also receives notifications\n• Same functionality\n\nBest Practice: Always assign responsible persons for accountability!";
    }

    // Department
    if (lowerMessage.includes("department") && !lowerMessage.includes("manage")) {
      if (lowerMessage.includes("add") || lowerMessage.includes("new") || lowerMessage.includes("create")) {
        return "Adding Department:\n\nMethod 1 - From Form:\n1. Click Department dropdown\n2. Scroll to bottom\n3. Click '+ New'\n4. Redirected to Company Details\n5. Add department name\n6. Save and return\n\nMethod 2 - From Company Details:\n1. Go to Company Details page\n2. Click 'Departments' tab\n3. Click '+ Add Department'\n4. Enter department name\n5. Toggle visibility if needed\n6. Save\n\nDepartments help organize and track spend by team!";
      }
      if (lowerMessage.includes("company level") || lowerMessage.includes("all departments")) {
        return "Company Level Department:\n• Special option meaning 'All Departments'\n• When selected, all other departments auto-selected\n• Use for company-wide subscriptions\n• Examples:\n  - Company email system\n  - Enterprise software\n  - Office utilities\n\nVs Individual Departments:\n• Select specific departments for team-specific tools\n• Examples:\n  - Marketing tools → Marketing dept\n  - Design software → Design dept\n\nYou can select multiple departments!";
      }
      return "Department Field:\n• Multi-select dropdown\n• Assign subscription to one or more departments\n• 'Company Level' = all departments\n• Click '+ New' to add department\n• Helps track spend by team\n• Used for reporting and filtering\n\nBest Practice: Assign to specific departments for better cost tracking!";
    }

    // Status field
    if (lowerMessage.includes("status") && (lowerMessage.includes("subscription") || lowerMessage.includes("what") || lowerMessage.includes("mean"))) {
      return "Subscription Status Options:\n\n• Active - Currently in use and being paid\n  Use for: Live subscriptions\n\n• Trial - Testing period, may convert to paid\n  Use for: Free trials, POCs\n\n• Draft - Planned but not yet started\n  Use for: Future subscriptions, pending approval\n\n• Cancelled - No longer in use\n  Use for: Terminated subscriptions\n\nStatus affects:\n• Dashboard counts\n• Spend calculations (only Active counted)\n• Filtering and reporting\n• Renewal reminders (only Active/Trial)\n\nChange status anytime by editing subscription!";
    }

    // Renewal Status (for renewals/licenses)
    if (lowerMessage.includes("renewal status") || (lowerMessage.includes("status") && lowerMessage.includes("renewal"))) {
      return "Renewal Status Options:\n\n• Initiated - Process started\n• Submitted - Sent to authority\n• Amendment/Appeal - Changes requested\n• Resubmitted - Sent again after changes\n• Rejected - Application denied\n• Cancelled - Process stopped\n• Approved - Renewal granted\n\nTracking Progress:\n1. Start: Initiated\n2. Submit: Submitted\n3. If issues: Amendment/Appeal or Resubmitted\n4. Final: Approved or Rejected\n\nRequired fields for Rejected/Cancelled:\n• Renewal Status Reason (explain why)\n\nHelps track government license renewal progress!";
      }

    // Documents/Attachments
    if (lowerMessage.includes("document") || lowerMessage.includes("attachment") || lowerMessage.includes("upload") || lowerMessage.includes("file")) {
      return "Documents & Attachments:\n\nHow to Upload:\n1. Open subscription/renewal form\n2. Click 'Documents' button in header\n3. Click 'Upload' or drag & drop\n4. Select file(s) from computer\n5. Files upload automatically\n6. Close dialog when done\n\nSupported:\n• Multiple files\n• PDF, Word, Excel, Images\n• Contracts, invoices, receipts\n• License certificates\n\nView/Download:\n• Click 'Documents' button anytime\n• Click file name to download\n• Delete if needed\n\nBest Practice: Upload contracts and invoices for reference!";
    }

    // Company Switching
    if (lowerMessage.includes("switch company") || lowerMessage.includes("change company") || lowerMessage.includes("select company")) {
      return "To switch company:\n1. Look at the top of the sidebar (left side)\n2. You'll see your current company name with a shuffle icon (⇄)\n3. Click on either the shuffle icon or the company name\n4. A dialog will open showing all your companies\n5. Select the company you want to switch to\n\nYour view will update to show that company's data!\n\nEach company has separate:\n• Subscriptions\n• Renewals\n• Employees\n• Departments\n• Settings";
    }

    // About Trackla / What is Trackla
    if (lowerMessage.includes("what is trackla") || lowerMessage.includes("about trackla") || lowerMessage.includes("tell me about")) {
      return "Trackla is a centralized platform that gives organizations complete control over subscriptions, renewals, and compliance—without spreadsheets or manual follow-ups. It provides a single dashboard to track all subscriptions, vendors, costs, and billing cycles with automated renewal tracking and compliance-ready records.";
    }

    // The Problem
    if (lowerMessage.includes("problem") || lowerMessage.includes("why trackla") || lowerMessage.includes("why use")) {
      return "Modern organizations face:\n• Subscriptions spread across emails and spreadsheets\n• Lack of centralized visibility for renewals and costs\n• Lost track of trials, auto-renewals, and unused licenses\n• Separate compliance monitoring\n\nResult: Wasted spend, missed renewals, compliance risk, and no single source of truth. Trackla solves all these problems!";
    }

    // Solution / Benefits
    if (lowerMessage.includes("solution") || lowerMessage.includes("benefit") || lowerMessage.includes("advantage")) {
      return "Trackla provides:\n• Single dashboard for all subscriptions, vendors, and costs\n• Automated renewal tracking with reminders\n• Clear visibility into active, trial, draft, and cancelled subscriptions\n• Ownership and department tagging\n• Compliance-ready records with approvals and logs\n\nOutcome: Reduced waste, zero missed renewals, stronger compliance, and full visibility!";
    }

    // Target Market / Who is it for
    if (lowerMessage.includes("who") || lowerMessage.includes("target") || lowerMessage.includes("for whom")) {
      return "Trackla is built for:\n• SMEs using multiple SaaS tools needing centralized control\n• Finance & Operations teams managing budgets and renewals\n• IT & Procurement teams handling software licenses\n• Multi-entity companies requiring consolidated management\n\nSimple enough for SMEs, structured enough for finance teams!";
    }

    // Key Features
    if (lowerMessage.includes("feature") || lowerMessage.includes("what can") || lowerMessage.includes("capabilities")) {
      return "Key Features:\n• Centralized Management - One dashboard for everything\n• Multi-Company Support - Manage multiple companies\n• Renewal & Cost Control - Automated Email & WhatsApp reminders\n• Audit & Compliance - Full logs and approval history\n• Owner & Department Assignment\n• Monthly and annual spend visibility\n• Status tracking (Active, Trial, Draft, Cancelled)";
    }

    // How it works
    if (lowerMessage.includes("how") && (lowerMessage.includes("work") || lowerMessage.includes("use"))) {
      return "How Trackla Works:\n1. Add subscriptions, compliance obligations, and licenses\n2. Assign owners, departments, costs, and renewal dates\n3. Track status and deadlines from centralized dashboard\n4. Receive automated Email & WhatsApp reminders\n5. Monitor spend, compliance, and audit history anytime\n\nIt's that simple!";
    }

    // Reminders / Notifications
    if (lowerMessage.includes("reminder") || lowerMessage.includes("notification") || lowerMessage.includes("alert")) {
      return "Trackla sends automated reminders via:\n• Email notifications\n• WhatsApp messages\n\nSet up in Setup & Configuration page. Configure reminder policies, lead times, and notification preferences for subscriptions and renewals to never miss a deadline!";
    }

    // Multi-company
    if (lowerMessage.includes("multi") || lowerMessage.includes("multiple compan") || lowerMessage.includes("several compan")) {
      return "Multi-Company Support:\n• Manage multiple companies from one login\n• Separate data with consolidated oversight\n• Perfect for businesses operating across multiple entities or cost centers\n• Maintain control while keeping data organized per company";
    }

    // Audit / Compliance
    if (lowerMessage.includes("audit") || lowerMessage.includes("compliance") || lowerMessage.includes("track changes")) {
      return "Audit & Compliance Features:\n• Full audit logs showing who changed what and when\n• Approval history tracking\n• Documents stored per subscription\n• Compliance-ready records\n• Renewal History Log for complete transparency\n\nPerfect for regulatory requirements and internal controls!";
    }

    // Cost / Spend / Budget
    if (lowerMessage.includes("cost") || lowerMessage.includes("spend") || lowerMessage.includes("budget") || lowerMessage.includes("money")) {
      return "Cost Management:\n• Track monthly and annual spend\n• Multi-currency support with exchange rates\n• Visibility into all subscription costs\n• Identify unused licenses and wasted spend\n• Better budgeting and financial control\n• Reduce unnecessary subscription waste";
    }

    // Subscription related questions
    if (lowerMessage.includes("add subscription") || lowerMessage.includes("create subscription")) {
      return "To add a subscription:\n1. Go to Subscriptions page\n2. Click '+ Add Subscription' button\n3. Fill in: vendor, amount, renewal date, responsible person, department\n4. Set status (Active, Trial, Draft)\n5. Add notes or documents if needed\n6. Save!\n\nYou can also bulk import subscriptions via Excel.";
    }
    if (lowerMessage.includes("subscription") && (lowerMessage.includes("edit") || lowerMessage.includes("update"))) {
      return "To edit a subscription:\n1. Go to Subscriptions page\n2. Find the subscription you want to edit\n3. Click the edit icon\n4. Make your changes\n5. Save\n\nAll changes are logged in the audit history!";
    }
    if (lowerMessage.includes("subscription") && (lowerMessage.includes("delete") || lowerMessage.includes("remove"))) {
      return "To delete a subscription:\n1. Go to Subscriptions page\n2. Find the subscription\n3. Click the delete icon\n4. Confirm deletion\n\nDeleted subscriptions are logged for audit purposes.";
    }
    if (lowerMessage.includes("subscription") && lowerMessage.includes("status")) {
      return "Subscription Statuses:\n• Active - Currently in use\n• Trial - Testing period\n• Draft - Not yet activated\n• Cancelled - No longer in use\n\nTrack and filter by status for better visibility!";
    }

    // Renewal / License related
    if (lowerMessage.includes("renewal") || lowerMessage.includes("license") || lowerMessage.includes("government")) {
      return "Renewals & Licenses:\nTrack government licenses, permits, and renewals with:\n• Renewal name and issuing authority\n• Start/end dates and renewal fees\n• Renewal status tracking\n• Automated reminders before expiry\n• Document attachments\n• Responsible person assignment\n\nNever miss a critical renewal deadline!";
    }
    if (lowerMessage.includes("add renewal") || lowerMessage.includes("add license")) {
      return "To add a renewal:\n1. Go to Renewals page\n2. Click '+ Add Renewal'\n3. Fill in: renewal name, issuing authority, dates, fee\n4. Assign responsible person and department\n5. Upload documents if needed\n6. Save\n\nSet reminder days to get notified before expiry!";
    }

    // Department related
    if (lowerMessage.includes("department")) {
      return "Department Management:\n• Manage in Company Details page\n• Add, edit, or remove departments\n• Assign subscriptions/renewals to departments\n• Track spend per department\n• Control visibility and access\n• Perfect for organizational accountability!";
    }

    // User / Employee / Role management
    if (lowerMessage.includes("user") || lowerMessage.includes("employee") || lowerMessage.includes("role") || lowerMessage.includes("permission")) {
      return "User Management:\nAvailable in Company Details page:\n• Add employees with email\n• Assign roles: Super Admin, Admin, Viewer, Contributor, Department Editor\n• Manage permissions per role\n• Track who owns what subscription\n• Assign responsible persons\n\nBuilt-in accountability and access control!";
    }

    // Export / Import
    if (lowerMessage.includes("export") || lowerMessage.includes("import") || lowerMessage.includes("excel") || lowerMessage.includes("bulk")) {
      return "Export & Import:\n• Export to Excel for backup or reporting\n• Import to bulk add subscriptions/renewals\n• Available on most pages\n• Download templates for easy import\n• Maintain data integrity\n\nGreat for migration and bulk operations!";
    }

    // History / Log / Changes
    if (lowerMessage.includes("history") || lowerMessage.includes("log") || lowerMessage.includes("changes") || lowerMessage.includes("audit trail")) {
      return "Renewal History Log:\n• Shows all changes made to renewals\n• Who made the change\n• When it was changed\n• What was modified\n• Complete audit trail\n\nEssential for compliance and accountability!";
    }

    // Currency
    if (lowerMessage.includes("currency") || lowerMessage.includes("exchange rate")) {
      if (lowerMessage.includes("subscription") || lowerMessage.includes("add") || lowerMessage.includes("can i")) {
        return "Yes! You can add currency from the subscription form:\n1. When adding/editing a subscription\n2. Click on the Currency dropdown\n3. At the bottom of the dropdown, click '+ New'\n4. You'll be redirected to Configuration page to add the currency\n5. Set the currency code and exchange rate\n6. Return to your subscription and select the new currency\n\nOr manage all currencies in Company Details → Currencies tab!";
      }
      return "Currency Management:\n• Manage in Company Details page → Currencies tab\n• Add multiple currencies\n• Set exchange rates\n• Multi-currency tracking\n• Automatic LCY (Local Currency) conversion\n• Can also add from subscription form via '+ New' button\n\nPerfect for international operations!";
    }

    // Category
    if (lowerMessage.includes("category") || lowerMessage.includes("categories")) {
      if (lowerMessage.includes("add") || lowerMessage.includes("create") || lowerMessage.includes("new") || lowerMessage.includes("from where") || lowerMessage.includes("how")) {
        return "Adding Category:\n\nYes! You can add categories in 2 ways:\n\nMethod 1 - From Subscription Form:\n1. When adding/editing a subscription\n2. Click on Category dropdown\n3. Scroll to bottom\n4. Click '+ New' button\n5. Enter category name in popup\n6. Click Save\n7. New category is auto-selected\n\nMethod 2 - From Company Details:\n1. Go to Company Details page\n2. Click 'Categories' tab\n3. Click '+ Add Category'\n4. Enter category name\n5. Save\n\nExamples: Cloud Services, Software Licenses, Marketing Tools, Communication, etc.";
      }
      if (lowerMessage.includes("another way") || lowerMessage.includes("other way") || lowerMessage.includes("different way")) {
        return "Yes, there are 2 ways to add categories:\n\n1. From Subscription Form - Click Category dropdown → '+ New' at bottom\n2. From Company Details - Go to Company Details page → Categories tab → '+ Add Category'\n\nBoth methods work perfectly! Choose whichever is more convenient for you.";
      }
      return "Categories:\n• Organize subscriptions by type\n• Add from subscription form via '+ New' button\n• Or manage in Company Details → Categories tab\n• Examples: Cloud Services, Software Licenses, Marketing Tools\n• Assign when creating subscriptions\n• Filter and report by category\n\nBetter organization and insights!";
    }

    // Dashboard
    if (lowerMessage.includes("dashboard") || lowerMessage.includes("overview")) {
      return "Dashboard:\n• Centralized view of all subscriptions\n• Upcoming renewals and deadlines\n• Spend overview (monthly/annual)\n• Status distribution\n• Quick access to all features\n• Real-time updates\n\nYour command center for subscription management!";
    }

    // Reports
    if (lowerMessage.includes("report") || lowerMessage.includes("analytics")) {
      return "Reports & Analytics:\n• Subscription spend reports\n• Renewal forecasts\n• Department-wise breakdown\n• Vendor analysis\n• Compliance status\n• Export reports to Excel\n\nData-driven insights for better decisions!";
    }

    // WhatsApp
    if (lowerMessage.includes("whatsapp")) {
      return "WhatsApp Integration:\n• Receive renewal reminders on WhatsApp\n• Instant notifications for upcoming deadlines\n• Configure in Setup & Configuration\n• Works alongside email notifications\n\nStay informed wherever you are!";
    }

    // Email
    if (lowerMessage.includes("email") && !lowerMessage.includes("user")) {
      return "Email Notifications:\n• Automated renewal reminders\n• Compliance deadline alerts\n• Configurable lead times\n• Set up in Setup & Configuration\n• Never miss important dates\n\nReliable and professional notifications!";
    }

    // Configuration / Setup
    if (lowerMessage.includes("configuration") || lowerMessage.includes("setup") || lowerMessage.includes("settings")) {
      return "Setup & Configuration:\n1. Click the Settings icon (gear) in sidebar\n2. Access tabs:\n   • Reminder Policy - Configure notification settings\n   • Payment Methods - Manage payment options\n   • Vendors - Manage vendor list\n3. Set reminder lead times\n4. Customize workflows\n\nTailor Trackla to your needs!";
    }

    // Payment Method
    if (lowerMessage.includes("payment method") || lowerMessage.includes("payment")) {
      if (lowerMessage.includes("add") || lowerMessage.includes("create") || lowerMessage.includes("new") || lowerMessage.includes("how")) {
        return "Adding Payment Method:\n\n1. Go to 'Setup & Configuration' page (gear icon)\n2. Click 'Payment Methods' tab\n3. Click '+ Add Payment Method' button\n4. Fill in the form:\n   • Title (required) - e.g., 'Company Credit Card'\n   • Type (required) - Credit, Debit, Cash, Bank Transfer, Digital Wallet, Other\n   • Description (optional)\n   • Owner (optional) - Who manages this\n   • Managed by (optional) - Secondary manager\n5. Click 'Save'\n\nYou can then assign payment methods to subscriptions!";
      }
      return "Payment Methods:\n• Manage in Setup & Configuration → Payment Methods tab\n• Track how subscriptions are paid\n• Types: Credit, Debit, Cash, Bank Transfer, Digital Wallet, Other\n• Assign owner and manager\n• See which subscriptions use each method\n• Export/Import via Excel\n\nBetter payment tracking!";
    }

    // Vendor Management
    if (lowerMessage.includes("vendor") && lowerMessage.includes("manage")) {
      return "Vendor Management:\n\n1. Go to Setup & Configuration page\n2. Click 'Vendors' tab\n3. Click '+ Add Vendor' to add new\n4. Edit or delete existing vendors\n5. Pre-loaded with 90+ popular vendors\n\nVendors are used when creating subscriptions to identify service providers!";
    }

    // Pricing / Cost of Trackla
    if (lowerMessage.includes("price") || lowerMessage.includes("pricing") || (lowerMessage.includes("how much") && lowerMessage.includes("cost"))) {
      return "For pricing information, please visit www.tracklahub.com or contact our sales team. Trackla offers flexible plans for SMEs and enterprises based on your needs!";
    }

    // Website / Demo
    if (lowerMessage.includes("website") || lowerMessage.includes("demo") || lowerMessage.includes("try")) {
      return "Visit www.tracklahub.com to:\n• See a product demo\n• Request a trial\n• Learn more about features\n• Contact our team\n\nExperience Trackla in action!";
    }

    // General help
    if (lowerMessage.includes("help") || lowerMessage.includes("what can you")) {
      return "I can help you with:\n• Understanding Trackla features\n• Adding/editing subscriptions & renewals\n• Setting up reminders & notifications\n• Managing departments & users\n• Compliance & audit tracking\n• Export/import data\n• Multi-company setup\n• Cost management\n\nWhat would you like to know?";
    }

    // Greeting
    if (lowerMessage.includes("hello") || lowerMessage.includes("hi") || lowerMessage.includes("hey")) {
      return "Hello! How can I assist you with Trackla today? Ask me about features, how to use the platform, or anything else!";
    }

    // Thank you
    if (lowerMessage.includes("thank") || lowerMessage.includes("thanks")) {
      return "You're welcome! Feel free to ask if you need any more help with Trackla.";
    }

    // Default response
    return "I'm here to help with Trackla! You can ask me about:\n• What Trackla is and why use it\n• Features and capabilities\n• How to manage subscriptions & renewals\n• Setting up reminders\n• Compliance & audit tracking\n• Multi-company support\n• Cost management\n\nWhat would you like to know?";
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Simulate bot typing delay
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(inputMessage),
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-16 w-16 rounded-full bg-gradient-to-br from-blue-500/95 via-blue-600/95 to-indigo-600/95 backdrop-blur-md shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-center group hover:scale-105 active:scale-95 border border-white/20 ring-2 ring-blue-400/30"
          aria-label="Open chatbot"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <Bot className="h-8 w-8 text-white drop-shadow-lg" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse shadow-lg"></span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 z-50 w-96 h-[500px] shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl bg-white/90 border border-blue-200/30" style={{ backdropFilter: 'blur(20px)' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500/95 via-blue-600/95 to-indigo-600/95 backdrop-blur-md text-white p-4 flex items-center justify-between border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Trackla Assistant</h3>
                <p className="text-xs text-blue-100">Online</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded-full p-1 transition-colors backdrop-blur-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-br from-blue-50/40 via-white/50 to-indigo-50/40 backdrop-blur-sm space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 backdrop-blur-md ${
                    message.sender === "user"
                      ? "bg-blue-500/90 text-white shadow-lg ring-1 ring-blue-400/50"
                      : "bg-white/90 text-slate-700 shadow-md border border-blue-100/50"
                  }`}
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                >
                  <p className="text-[15px] leading-relaxed whitespace-pre-line font-normal" style={{ letterSpacing: '0.01em' }}>{message.text}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.sender === "user" ? "text-blue-100" : "text-slate-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/90 backdrop-blur-md text-slate-700 shadow-md border border-blue-100/50 rounded-lg p-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 bg-blue-400 rounded-full animate-bounce"></span>
                    <span className="h-2 w-2 bg-blue-400 rounded-full animate-bounce delay-100"></span>
                    <span className="h-2 w-2 bg-blue-400 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white/70 backdrop-blur-md border-t border-blue-200/30">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 border-blue-200/50 bg-white/90 backdrop-blur-sm focus:border-blue-500 focus:ring-blue-500/30 placeholder:text-slate-400"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontSize: '15px' }}
              />
              <Button
                onClick={handleSendMessage}
                size="icon"
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm text-white"
              >
                <Send className="h-4 w-4 text-white" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
