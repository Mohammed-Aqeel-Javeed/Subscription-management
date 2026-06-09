import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
type ReportItem = {
  id: string;
  label: string;
  description?: string;
};

type ReportCategory = "all" | "subscription" | "compliance" | "renewal";

// ─── Icon helpers ─────────────────────────────────────────────────────────────
function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function IconFilings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconAudit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function IconScorecard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function IconDept() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconTime() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconExpired() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 transform transition-transform duration-200 group-hover:translate-x-1">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ─── Per-report metadata ──────────────────────────────────────────────────────
const reportMeta: Record<string, { icon: React.ReactNode; description: string; gradient: string; iconBg: string }> = {
  "sub-0": {
    icon: <IconRefresh />,
    description: "Track subscriptions nearing their renewal date.",
    gradient: "from-violet-500 to-indigo-600",
    iconBg: "bg-violet-100 text-violet-600",
  },
  "sub-1": {
    icon: <IconChart />,
    description: "Visualise subscription spend trends over time.",
    gradient: "from-blue-500 to-cyan-600",
    iconBg: "bg-blue-100 text-blue-600",
  },
  "sub-2": {
    icon: <IconCard />,
    description: "Breakdown of spend grouped by payment card.",
    gradient: "from-sky-500 to-blue-600",
    iconBg: "bg-sky-100 text-sky-600",
  },
  "sub-3": {
    icon: <IconChart />,
    description: "Additional subscription analytics report.",
    gradient: "from-indigo-400 to-blue-500",
    iconBg: "bg-indigo-100 text-indigo-600",
  },
  "sub-4": {
    icon: <IconChart />,
    description: "Additional subscription analytics report.",
    gradient: "from-indigo-400 to-blue-500",
    iconBg: "bg-indigo-100 text-indigo-600",
  },
  "comp-0": {
    icon: <IconFilings />,
    description: "Stay ahead of upcoming compliance filing deadlines.",
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  "comp-1": {
    icon: <IconAudit />,
    description: "Full audit trail of compliance spend history.",
    gradient: "from-teal-500 to-green-600",
    iconBg: "bg-teal-100 text-teal-600",
  },
  "comp-2": {
    icon: <IconScorecard />,
    description: "Compliance performance scores by department.",
    gradient: "from-green-500 to-emerald-600",
    iconBg: "bg-green-100 text-green-600",
  },
  "comp-3": {
    icon: <IconAudit />,
    description: "Additional compliance analytics report.",
    gradient: "from-teal-400 to-cyan-500",
    iconBg: "bg-teal-100 text-teal-600",
  },
  "comp-4": {
    icon: <IconAudit />,
    description: "Additional compliance analytics report.",
    gradient: "from-teal-400 to-cyan-500",
    iconBg: "bg-teal-100 text-teal-600",
  },
  "ren-0": {
    icon: <IconDept />,
    description: "Renewal overview categorised by department.",
    gradient: "from-orange-500 to-amber-600",
    iconBg: "bg-orange-100 text-orange-600",
  },
  "ren-1": {
    icon: <IconTime />,
    description: "Analyse the lead time for each renewal cycle.",
    gradient: "from-amber-500 to-yellow-600",
    iconBg: "bg-amber-100 text-amber-600",
  },
  "ren-2": {
    icon: <IconUser />,
    description: "See who is responsible for each renewal.",
    gradient: "from-rose-500 to-pink-600",
    iconBg: "bg-rose-100 text-rose-600",
  },
  "ren-3": {
    icon: <IconExpired />,
    description: "List of subscriptions that have already expired.",
    gradient: "from-red-500 to-rose-600",
    iconBg: "bg-red-100 text-red-600",
  },
  "ren-4": {
    icon: <IconCalendar />,
    description: "Upcoming renewals across all subscriptions.",
    gradient: "from-fuchsia-500 to-purple-600",
    iconBg: "bg-fuchsia-100 text-fuchsia-600",
  },
};

// ─── Section badge colours ────────────────────────────────────────────────────
const sectionStyle = {
  subscription: {
    badge: "bg-violet-100 text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-500",
    headerGrad: "from-violet-50 to-indigo-50",
  },
  compliance: {
    badge: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    headerGrad: "from-emerald-50 to-teal-50",
  },
  renewal: {
    badge: "bg-orange-100 text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
    headerGrad: "from-orange-50 to-amber-50",
  },
};

// ─── Report Row ───────────────────────────────────────────────────────────────
function ReportRow({ item, onOpen }: { item: ReportItem; onOpen: (id: string) => void }) {
  const meta = reportMeta[item.id] ?? {
    icon: <IconChart />,
    description: "View detailed analytics report.",
    gradient: "from-slate-500 to-gray-600",
    iconBg: "bg-slate-100 text-slate-600",
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="w-full flex items-center p-5 bg-white hover:bg-slate-50/50 transition-colors text-left group focus-visible:outline-none focus-visible:bg-slate-50"
    >
      <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl ${meta.iconBg} transition-transform duration-200 group-hover:scale-105 mr-5`}>
        {meta.icon}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="inline-flex items-center gap-1 max-w-full">
          <span className="relative font-semibold text-[15px] text-slate-800 group-hover:text-indigo-600 transition-colors duration-200 truncate leading-snug">
            {item.label}
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-indigo-500 group-hover:w-full transition-all duration-300 rounded-full" />
          </span>
          <span className="text-indigo-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-xs flex-shrink-0">→</span>
        </div>
        <p className="text-[13px] text-slate-500 mt-1">{meta.description}</p>
      </div>

      <div className="flex-shrink-0 ml-4 text-slate-300 group-hover:text-indigo-500 transition-colors duration-200">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────
function FilterTabs({
  activeCategory,
  onCategoryChange,
}: {
  activeCategory: ReportCategory;
  onCategoryChange: (c: ReportCategory) => void;
}) {
  const tabs: { id: ReportCategory; label: string }[] = [
    { id: "all", label: "All Reports" },
    { id: "subscription", label: "Subscription" },
    { id: "compliance", label: "Compliance" },
    { id: "renewal", label: "Renewal" },
  ];

  return (
    <div className="inline-flex items-center bg-slate-50 border border-slate-100 rounded-xl p-1.5 shadow-sm">
      {tabs.map((tab) => {
        const active = activeCategory === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onCategoryChange(tab.id)}
            className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
              active
                ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Reports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = (searchParams.get("tab") as ReportCategory) || "all";
  const [activeCategory, setActiveCategory] = React.useState<ReportCategory>(initialCategory);

  const handleCategoryChange = (cat: ReportCategory) => {
    setActiveCategory(cat);
    setSearchParams(cat === "all" ? {} : { tab: cat }, { replace: true });
  };

  const subscriptionReports: ReportItem[] = [
    { id: "sub-0", label: "Upcoming Renewal" },
    { id: "sub-1", label: "Spending Analysis" },
    { id: "sub-2", label: "Card Wise" },
  ];

  const complianceReports: ReportItem[] = [
    { id: "comp-0", label: "Upcoming Filing" },
    { id: "comp-1", label: "Compliance Spend & Audit" },
    { id: "comp-2", label: "Departmental Compliance Scorecard" },
  ];

  const renewalReports: ReportItem[] = [
    { id: "ren-0", label: "Department-wise Renewals Report" },
    { id: "ren-1", label: "Renewal Lead Time Analysis" },
    { id: "ren-2", label: "Renewal Responsibility Report" },
    { id: "ren-3", label: "Expired Renewals Report" },
    { id: "ren-4", label: "Upcoming Renewals Report" },
  ];

  const openReport = (id: string) => {
    const tabParam = activeCategory !== "all" ? `?tab=${activeCategory}` : "";
    if (id === "sub-0") { navigate("/reports/upcoming-renewal" + tabParam); return; }
    if (id === "sub-1") { navigate("/reports/spending-analysis" + tabParam); return; }
    if (id === "sub-2") { navigate("/reports/card-wise" + tabParam); return; }
    if (id === "comp-0") { navigate("/reports/upcoming-filings" + tabParam); return; }
    if (id === "comp-1") { navigate("/reports/compliance-spend" + tabParam); return; }
    if (id === "comp-2") { navigate("/reports/departmental-scorecard" + tabParam); return; }
    if (id === "ren-0") { navigate("/reports/department-wise-renewals" + tabParam); return; }
    if (id === "ren-1") { navigate("/reports/renewal-lead-time-analysis" + tabParam); return; }
    if (id === "ren-2") { navigate("/reports/renewal-responsibility" + tabParam); return; }
    if (id === "ren-3") { navigate("/reports/expired-renewals" + tabParam); return; }
    if (id === "ren-4") { navigate("/reports/upcoming-renewals" + tabParam); return; }
    console.log("Open report", id);
  };

  const shouldShowCategory = (category: ReportCategory) =>
    activeCategory === "all" || activeCategory === category;

  const visibleReports = [
    ...(shouldShowCategory("subscription") ? subscriptionReports : []),
    ...(shouldShowCategory("compliance") ? complianceReports : []),
    ...(shouldShowCategory("renewal") ? renewalReports : []),
  ];

  return (
    <div className="min-h-screen bg-transparent p-6 lg:p-10 font-['Inter']">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-6">Reports</h1>
        <FilterTabs activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
      </div>

      <div className="max-w-6xl">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden divide-y divide-slate-50/80">
          {visibleReports.map((item) => (
            <ReportRow key={item.id} item={item} onOpen={openReport} />
          ))}
        </div>
      </div>
    </div>
  );
}
