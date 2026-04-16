import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Layers, Settings, FileBarChart, BellRing, Building2, ShieldCheck, Award, LogOut, Shuffle, Check, PanelLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { UnifiedImportExport } from "../unified-import-export";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Can } from "@/components/Can";
import { useSidebarSlot } from "@/context/SidebarSlotContext";
import { findPlatformSection, platformNavSections } from "@/lib/platform-nav";

type Company = {
  tenantId: string;
  companyName: string;
  isActive: boolean;
};

function CompanySwitcherDialog({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/user/companies"],
    queryFn: async () => {
      const res = await apiFetch("/api/user/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredCompanies = companies.filter((company) =>
    company.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getColorForCompany = (name: string) => {
    const colors = [
      "bg-yellow-500",
      "bg-purple-400",
      "bg-amber-600",
      "bg-teal-500",
      "bg-pink-400",
      "bg-indigo-500",
      "bg-red-500",
      "bg-green-500",
      "bg-blue-500",
      "bg-orange-500",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleSwitchCompany = async (tenantId: string) => {
    try {
      const res = await apiFetch("/api/user/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });

      if (!res.ok) {
        throw new Error("Failed to switch company");
      }

      const data = await res.json().catch(() => ({} as any));
      if (typeof (data as any)?.token === "string" && (data as any).token.length > 0) {
        const normalized = String((data as any).token).trim().replace(/^Bearer\s+/i, "");
        sessionStorage.setItem("token", normalized);
        sessionStorage.setItem("isAuthenticated", "true");
      }

      // Notify the app that tenant context changed.
      window.dispatchEvent(new Event("account-changed"));

      queryClient.clear();
      window.location.reload();

      toast({
        title: "Company Switched",
        description: "Successfully switched to the selected company",
        variant: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to switch company. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shuffle size={18} className="text-blue-700" />
            <span className="text-lg font-semibold text-gray-900">Available Companies</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-full focus:outline-none"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>

          <div className="mb-2 text-xs font-semibold text-gray-600 px-2">Your Companies</div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">No company found.</div>
            ) : (
              <div className="space-y-1">
                {filteredCompanies.map((company) => (
                  <button
                    key={company.tenantId}
                    onClick={() => {
                      if (!company.isActive) {
                        handleSwitchCompany(company.tenantId);
                      }
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <div
                      className={`h-8 w-8 ${getColorForCompany(company.companyName)} rounded-full flex items-center justify-center flex-shrink-0`}
                    >
                      <span className="text-xs font-bold text-white">{getInitials(company.companyName)}</span>
                    </div>
                    <span className="flex-1 truncate text-sm text-gray-900">{company.companyName}</span>
                    {company.isActive && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Company Button */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={async () => {
                try {
                  // Logout first
                  await fetch("/api/logout", { method: "POST", credentials: "include" });

                  // Clear session storage
                  sessionStorage.removeItem("isAuthenticated");
                  sessionStorage.clear();

                  // Clear all React Query cache
                  queryClient.clear();

                  // Dispatch logout event
                  window.dispatchEvent(new Event("logout"));

                  // Close dialog
                  onClose();

                  // Navigate to signup with a flag to open the add company modal
                  navigate("/signup?addCompany=true", { replace: true });
                } catch {
                  toast({
                    title: "Error",
                    description: "Failed to logout. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all shadow-sm"
            >
              <Building2 className="h-4 w-4" />
              <span>Add Company</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/subscriptions", label: "Subscriptions", icon: Layers },
  { path: "/compliance", label: "Compliance", icon: Award },
  { path: "/government-license", label: "Renewals", icon: ShieldCheck },
  { path: "/notifications", label: "Notifications", icon: BellRing },
  { path: "/configuration", label: "Setup & Configuration", icon: Settings },
  { path: "/company-details", label: "Company Details", icon: Building2 },
  { path: "/reports", label: "Reports", icon: FileBarChart },
];

const configSubItems = [
  { path: "/configuration/currency", label: "Currency" },
  { path: "/configuration/payment", label: "Payment Methods" },
  { path: "/configuration/custom-field", label: "Custom field" },
];

const companySubItems = [
  { path: "/company-details/company", label: "Company Information" },
  { path: "/company-details/department", label: "Department" },
  { path: "/company-details/employee", label: "Employees" },
  { path: "/company-details/subscription", label: "Subscription Category" },
  { path: "/company-details/users", label: "User Management", requiresUserRead: true },
] as const;

export default function Sidebar({ isOpen = true, onToggle }: { isOpen?: boolean; onToggle?: () => void }) {
  const buildPlatformOpenState = (pathname: string) =>
    Object.fromEntries(
      platformNavSections.map((section) => [
        section.id,
        pathname === section.path || pathname.startsWith(`${section.path}/`),
      ])
    ) as Record<string, boolean>;

  // Get current location for active state
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCompanySwitcherDialog, setShowCompanySwitcherDialog] = useState(false);
  const [configOpen, setConfigOpen] = useState(() => location.pathname.startsWith("/configuration"));
  const [companyOpen, setCompanyOpen] = useState(() => location.pathname.startsWith("/company-details"));
  const [platformOpen, setPlatformOpen] = useState<Record<string, boolean>>(() =>
    buildPlatformOpenState(location.pathname)
  );
  const { active: pageSlotActive, replaceNav: pageSlotReplaceNav } = useSidebarSlot();

  // Auto-expand the dropdown of the active section route.
  useEffect(() => {
    if (location.pathname.startsWith("/configuration")) setConfigOpen(true);
    if (location.pathname.startsWith("/company-details")) setCompanyOpen(true);

    const activePlatformSection = findPlatformSection(location.pathname);
    if (activePlatformSection) {
      setPlatformOpen((current) => {
        if (current[activePlatformSection.id]) return current;
        return { ...current, [activePlatformSection.id]: true };
      });
    }
  }, [location.pathname]);

  // Fetch current user data
  const { data: currentUser } = useQuery({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const res = await apiFetch("/api/me");
      if (!res.ok) {
        throw new Error("Failed to fetch user data");
      }
      return res.json();
    },
    retry: false, // Don't retry on auth failure
    staleTime: 0, // Always refetch to get current company info
    refetchOnWindowFocus: true,
  });

  const isGlobalAdmin = currentUser?.role === "global_admin";
  const sidebarBackground = isGlobalAdmin
    ? "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 45%, #ffffff 100%)"
    : "linear-gradient(180deg, #ede9fe 0%, #e0d8fd 50%, #ddd5fc 100%)";

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
    
    // Clear session storage
    sessionStorage.removeItem("token");
    localStorage.removeItem("token");
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.clear();
    
    // Clear all React Query cache
    queryClient.clear();
    
    // Dispatch logout event for other components
    window.dispatchEvent(new Event('logout'));
    
    // Navigate to landing page and replace history to prevent back navigation
    navigate("/landing", { replace: true });
  };
  
  // Collapsed sidebar view (icon-only)
  if (!isOpen) {
    return (
      <div
        className={
          "flex flex-col h-full w-16 border-r " +
          (isGlobalAdmin ? "border-indigo-200/60" : "border-indigo-200/50")
        }
        style={{ background: sidebarBackground }}
      >
        {/* Collapsed Header */}
        <div
          className={
            "flex flex-col items-center gap-1 px-2 pt-3 pb-2 border-b " +
            (isGlobalAdmin ? "border-indigo-200/60" : "border-indigo-200/50")
          }
        >
          <button
            onClick={onToggle}
            className={
              "relative group h-11 w-11 flex items-center justify-center rounded-xl shadow-sm transition-all duration-200 hover:scale-105 " +
              (isGlobalAdmin
                ? "bg-white/80 hover:bg-white border border-indigo-200/60"
                : "bg-white/60 hover:bg-white/80")
            }
            aria-label="Open Sidebar"
          >
            <img
              src="/assets/logo.png"
              alt="Trackla Logo"
              className="w-9 h-9 object-contain drop-shadow transition-opacity duration-150 group-hover:opacity-0"
              style={{ imageRendering: 'crisp-edges' }}
            />

            {/* On hover: swap small logo to the "open sidebar" icon */}
            <PanelLeft
              size={20}
              className={
                "absolute opacity-0 transition-opacity duration-150 group-hover:opacity-100 " +
                "text-indigo-600"
              }
            />
          </button>
        </div>

        {/* Collapsed Navigation Icons */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto overscroll-contain custom-scrollbar">
          <ul className="space-y-1">
            {(isGlobalAdmin ? platformNavSections : navItems).map((item) => {
              const Icon = item.icon;
              const activePlatformSection = isGlobalAdmin ? findPlatformSection(location.pathname) : undefined;

              const isActive =
                location.pathname === item.path ||
                (item.path === "/configuration" && location.pathname.startsWith("/configuration/")) ||
                (item.path === "/company-details" && location.pathname.startsWith("/company-details/")) ||
                (isGlobalAdmin && activePlatformSection?.path === item.path);

              const link = (
                <Link
                  to={item.path}
                  className={
                    `flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ` +
                    (isActive
                      ? "bg-white shadow-xl"
                      : (isGlobalAdmin ? "hover:bg-white/70 hover:shadow-md" : "hover:bg-white/10 hover:shadow-md"))
                  }
                  title={item.label}
                >
                  <div
                    className={
                      `relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 ` +
                      (isActive
                        ? "bg-transparent"
                        : (isGlobalAdmin ? "bg-white/80 border border-indigo-200/60" : "bg-white/10 border border-white/10"))
                    }
                    style={{
                      boxShadow: isActive
                        ? "none"
                        : (isGlobalAdmin ? "0 1px 2px rgba(99,102,241,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.12)"),
                    }}
                  >
                    <Icon className={"relative z-10 " + (isGlobalAdmin ? "text-indigo-700" : "text-indigo-800")} size={16} />
                  </div>
                </Link>
              );

              // Protect Settings and Company Details based on role
              if (!isGlobalAdmin && (item.path === "/configuration" || item.path === "/company-details")) {
                return (
                  <Can I="manage" a="Settings" key={item.path} fallback={null}>
                    <li>{link}</li>
                  </Can>
                );
              }

              return <li key={item.path}>{link}</li>;
            })}
          </ul>
        </nav>

        {/* Collapsed Footer: Only Logout button, no user avatar/initial */}
        <div className={"p-2 border-t " + (isGlobalAdmin ? "border-indigo-200/60" : "border-indigo-200/50")}>
          <div className="flex items-center justify-center">
            <button
              onClick={handleLogout}
              className={
                "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 " +
                (isGlobalAdmin
                  ? "text-indigo-500 hover:text-red-600 hover:bg-red-50"
                  : "text-indigo-400 hover:text-red-500 hover:bg-white/50")
              }
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "flex flex-col h-full border-r " +
        (isGlobalAdmin ? "border-indigo-200/60" : "border-indigo-200/50")
      }
      style={{ background: sidebarBackground }}
    >
      <div
        className={
          "flex flex-col items-start gap-1 px-4 pt-3 pb-2 border-b " +
          (isGlobalAdmin ? "border-indigo-200/60" : "border-indigo-200/50")
        }
      >
        <div className="flex items-center gap-2 justify-between w-full">
          <div className="flex items-center gap-0">
            <img 
              src="/assets/logo.png"
              alt="Trackla Logo" 
              className="w-20 h-20 object-contain drop-shadow-xl"
              style={{ imageRendering: 'crisp-edges' }}
            />
            <h1 className={"text-2xl font-bold tracking-tight text-indigo-900"}>
              Trackla
            </h1>
          </div>
          {onToggle && (
            <button
              onClick={onToggle}
              className={
                "h-8 w-8 flex items-center justify-center rounded-lg transition-all duration-200 " +
                (isGlobalAdmin
                  ? "bg-white/80 hover:bg-white text-indigo-600 border border-indigo-200/60"
                  : "bg-white/50 hover:bg-white/70 text-indigo-600")
              }
              title="Close Sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}
        </div>
        {currentUser && !isGlobalAdmin && (
          <button
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/15 transition-all duration-200 w-full border border-indigo-200/40"
            onClick={() => setShowCompanySwitcherDialog(true)}
            title="Switch Company"
          >
            <Shuffle size={14} className="text-indigo-500 flex-shrink-0" />
            <span className="text-sm text-indigo-700 font-semibold leading-tight truncate flex-1 text-left">
              {currentUser.companyName || "Select company..."}
            </span>
          </button>
        )}
      </div>
      {/* Company Switcher Dialog */}
      {!isGlobalAdmin && showCompanySwitcherDialog && (
        <CompanySwitcherDialog 
          onClose={() => setShowCompanySwitcherDialog(false)} 
        />
      )}
      <nav className="flex-1 px-3 py-2 overflow-y-auto overscroll-contain custom-scrollbar">
        {/* Default navigation (hidden when a page wants to fully use the sidebar) */}
        {pageSlotActive && pageSlotReplaceNav ? null : (
          <>
            {isGlobalAdmin ? (
              <ul className="space-y-0.5">
                {platformNavSections.map((section) => {
                  const Icon = section.icon;
                  const isActive =
                    location.pathname === section.path ||
                    location.pathname.startsWith(`${section.path}/`);
                  const isExpanded = platformOpen[section.id] ?? isActive;
                  return (
                    <li key={section.id}>
                      <div
                        className={
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 " +
                          (isActive
                            ? "bg-indigo-600 text-white font-semibold shadow-md"
                            : "text-indigo-800 hover:bg-white/60 hover:text-indigo-900")
                        }
                      >
                        <Link to={section.path} className="flex items-center gap-3 flex-1 min-w-0">
                          <Icon size={18} className="flex-shrink-0" />
                          <span className="font-sidebar font-semibold truncate">{section.label}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPlatformOpen((current) => ({
                              ...current,
                              [section.id]: !(current[section.id] ?? false),
                            }));
                          }}
                          className={
                            "h-7 w-7 rounded-md flex items-center justify-center transition-colors " +
                            (isActive ? "hover:bg-white/15" : "hover:bg-white/60")
                          }
                          aria-label={isExpanded ? `Collapse ${section.label}` : `Expand ${section.label}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className={isActive ? "h-4 w-4 text-white" : "h-4 w-4 text-indigo-800"} />
                          ) : (
                            <ChevronRight className={isActive ? "h-4 w-4 text-white" : "h-4 w-4 text-indigo-800"} />
                          )}
                        </button>
                      </div>
                      {isExpanded ? (
                        <div className="mt-1 ml-9 space-y-0.5">
                          {section.items.map((subItem) => {
                            const subActive = location.pathname === subItem.path;
                            return (
                              <Link
                                key={subItem.path}
                                to={subItem.path}
                                className={
                                  "flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 " +
                                  (subActive
                                    ? "bg-white text-indigo-950 font-semibold shadow-sm"
                                    : "text-indigo-700 hover:bg-white/60 hover:text-indigo-950")
                                }
                              >
                                <span className="truncate">{subItem.label}</span>
                                {subItem.readOnly ? (
                                  <span className="text-[10px] uppercase tracking-wide text-indigo-500">View</span>
                                ) : null}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-0.5">
                {navItems.map((item) => {
            const Icon = item.icon;
            const isConfigRoute = item.path === "/configuration";
            const isCompanyRoute = item.path === "/company-details";
            const isActive =
              location.pathname === item.path ||
              (isConfigRoute && location.pathname.startsWith("/configuration/")) ||
              (isCompanyRoute && location.pathname.startsWith("/company-details/"));
            
            // Protect Settings and Company Details based on role
            if (isConfigRoute || isCompanyRoute) {
              return (
                <Can I="manage" a="Settings" key={item.path} fallback={null}>
                  <li>
                    <div
                      className={
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 " +
                        (isActive
                          ? "bg-indigo-600 text-white font-semibold shadow-md"
                          : "text-indigo-800 hover:bg-white/50 hover:text-indigo-900")
                      }
                    >
                      <Link
                        to={item.path}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <Icon size={18} className="flex-shrink-0" />
                        <span className="font-sidebar font-semibold truncate">
                          {item.label}
                        </span>
                      </Link>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isConfigRoute) setConfigOpen((v) => !v);
                          if (isCompanyRoute) setCompanyOpen((v) => !v);
                        }}
                        className={
                          "h-7 w-7 rounded-md flex items-center justify-center transition-colors " +
                          (isActive ? "hover:bg-white/15" : "hover:bg-white/40")
                        }
                        aria-label={
                          isConfigRoute
                            ? (configOpen ? "Collapse configuration" : "Expand configuration")
                            : (companyOpen ? "Collapse company details" : "Expand company details")
                        }
                      >
                        {isConfigRoute ? (
                          configOpen ? (
                            <ChevronDown className={isActive ? "h-4 w-4 text-white" : "h-4 w-4 text-indigo-800"} />
                          ) : (
                            <ChevronRight className={isActive ? "h-4 w-4 text-white" : "h-4 w-4 text-indigo-800"} />
                          )
                        ) : companyOpen ? (
                          <ChevronDown className={isActive ? "h-4 w-4 text-white" : "h-4 w-4 text-indigo-800"} />
                        ) : (
                          <ChevronRight className={isActive ? "h-4 w-4 text-white" : "h-4 w-4 text-indigo-800"} />
                        )}
                      </button>
                    </div>

                    {isConfigRoute && configOpen ? (
                      <div className="mt-1 ml-9 space-y-0.5">
                        {configSubItems.map((sub) => {
                          const subActive = location.pathname === sub.path;
                          return (
                            <Link
                              key={sub.path}
                              to={sub.path}
                              className={
                                "block px-3 py-1.5 rounded-lg text-sm transition-all duration-150 " +
                                (subActive
                                  ? "bg-white/70 text-indigo-950 font-semibold"
                                  : "text-indigo-800/90 hover:bg-white/40 hover:text-indigo-950")
                              }
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}

                    {isCompanyRoute && companyOpen ? (
                      <div className="mt-1 ml-9 space-y-0.5">
                        {companySubItems.map((sub) => {
                          const subActive = location.pathname === sub.path;
                          const link = (
                            <Link
                              key={sub.path}
                              to={sub.path}
                              className={
                                "block px-3 py-1.5 rounded-lg text-sm transition-all duration-150 " +
                                (subActive
                                  ? "bg-white/70 text-indigo-950 font-semibold"
                                  : "text-indigo-800/90 hover:bg-white/40 hover:text-indigo-950")
                              }
                            >
                              {sub.label}
                            </Link>
                          );

                          if ("requiresUserRead" in sub && sub.requiresUserRead) {
                            return (
                              <Can I="read" a="User" key={sub.path} fallback={null}>
                                {link}
                              </Can>
                            );
                          }
                          return link;
                        })}
                      </div>
                    ) : null}
                  </li>
                </Can>
              );
            }
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 " +
                    (isActive
                      ? "bg-indigo-600 text-white font-semibold shadow-md"
                      : "text-indigo-800 hover:bg-white/50 hover:text-indigo-900")
                  }
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="font-sidebar font-semibold">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
              </ul>
            )}
            
            {/* Import/Export Button in Navigation */}
            {isGlobalAdmin ? null : (
              <div className="mt-4 pt-4 border-t border-indigo-200/50">
                <UnifiedImportExport />
              </div>
            )}
          </>
        )}

        {/* Always keep slot container mounted for portals */}
        <div
          id="page-sidebar-slot"
          className={pageSlotActive && pageSlotReplaceNav ? "h-full" : "hidden"}
        />
      </nav>
      
      <div className={"px-3 py-3 border-t " + (isGlobalAdmin ? "border-indigo-200/60" : "border-indigo-200/50")}>
        <button
          onClick={handleLogout}
          className={
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-all duration-200 " +
            (isGlobalAdmin
              ? "text-indigo-500 hover:text-red-600 hover:bg-red-50"
              : "text-indigo-400 hover:text-red-600 hover:bg-red-50")
          }
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}