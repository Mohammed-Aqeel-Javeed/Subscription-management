import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Layers, Settings, FileBarChart, User, BellRing, Building2, ShieldCheck, Award, LogOut, Shuffle, Check, FileSpreadsheet } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { UnifiedImportExport } from "../unified-import-export";
import CompanySwitcher from "./company-switcher";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Can } from "@/components/Can";

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
      'bg-yellow-500', 'bg-purple-400', 'bg-amber-600', 'bg-teal-500', 
      'bg-pink-400', 'bg-indigo-500', 'bg-red-500', 'bg-green-500',
      'bg-blue-500', 'bg-orange-500'
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

      queryClient.clear();
      window.location.reload();
      
      toast({
        title: "Company Switched",
        description: "Successfully switched to the selected company",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to switch company. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shuffle size={18} className="text-blue-700" />
            <span className="text-lg font-semibold text-gray-900">Available Companies</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-full focus:outline-none">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
          <div className="max-h-64 overflow-y-auto">
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
                    <div className={`h-8 w-8 ${getColorForCompany(company.companyName)} rounded-full flex items-center justify-center flex-shrink-0`}>
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
                  window.dispatchEvent(new Event('logout'));
                  
                  // Close dialog
                  onClose();
                  
                  // Navigate to signup with a flag to open the add company modal
                  navigate('/signup?addCompany=true', { replace: true });
                } catch (error) {
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
  { path: "/dashboard", label: "Dashboard", icon: BarChart3, gradient: "from-blue-500 to-indigo-600", shadow: "rgba(59, 130, 246, 0.5)" },
  { path: "/subscriptions", label: "Subscriptions", icon: Layers, gradient: "from-purple-500 to-pink-600", shadow: "rgba(168, 85, 247, 0.5)" },
  { path: "/compliance", label: "Compliance", icon: Award, gradient: "from-amber-500 to-orange-600", shadow: "rgba(245, 158, 11, 0.5)" },
  { path: "/government-license", label: "Government License", icon: ShieldCheck, gradient: "from-emerald-500 to-teal-600", shadow: "rgba(16, 185, 129, 0.5)" },
  { path: "/notifications", label: "Notifications", icon: BellRing, gradient: "from-rose-500 to-red-600", shadow: "rgba(244, 63, 94, 0.5)" },
  { path: "/reminders", label: "Setup & Configuration", icon: Settings, gradient: "from-cyan-500 to-blue-600", shadow: "rgba(6, 182, 212, 0.5)" },
  { path: "/company-details", label: "Company Details", icon: Building2, gradient: "from-violet-500 to-purple-600", shadow: "rgba(139, 92, 246, 0.5)" },
  { path: "/reports", label: "Reports", icon: FileBarChart, gradient: "from-lime-500 to-green-600", shadow: "rgba(132, 204, 22, 0.5)" },
  // ...removed User Management link...
];

export default function Sidebar() {
  // Get current location for active state
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);
  const [showCompanySwitcherDialog, setShowCompanySwitcherDialog] = useState(false);

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

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
    
    // Clear session storage
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.clear();
    
    // Clear all React Query cache
    queryClient.clear();
    
    // Dispatch logout event for other components
    window.dispatchEvent(new Event('logout'));
    
    // Navigate to login and replace history to prevent back navigation
    navigate("/login", { replace: true });
  };
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-r border-gray-200/50 shadow-lg">
      <div className="flex flex-col items-start gap-1 px-4 pt-3 pb-2 bg-white/40 backdrop-blur-sm border-b border-gray-200/50">
        <div className="flex items-center gap-2">
          <img 
            src="/assets/logo.png"
            alt="Trackla Logo" 
            className="w-20 h-20 object-contain drop-shadow-xl"
            style={{ imageRendering: 'crisp-edges' }}
          />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Trackla
          </h1>
        </div>
        {currentUser?.companyName && (
          <div className="flex items-center gap-2 pl-2 pr-2">
            <button
              className="flex items-center justify-center flex-shrink-0 w-8 h-8 hover:bg-blue-50 rounded-md transition-colors"
              onClick={() => setShowCompanySwitcherDialog(true)}
              title="Switch Company"
            >
              <Shuffle size={18} className="text-blue-700" />
            </button>
            <button
              className="text-base text-blue-700 font-bold leading-tight hover:underline focus:outline-none text-left truncate"
              onClick={() => setShowCompanySwitcherDialog(true)}
              title="Switch Company"
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
            >
              {currentUser.companyName}
            </button>
          </div>
        )}
      </div>
      {/* Company Switcher Dialog */}
      {showCompanySwitcherDialog && (
        <CompanySwitcherDialog 
          onClose={() => setShowCompanySwitcherDialog(false)} 
        />
      )}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            // Protect Settings and Company Details based on role
            if (item.path === "/reminders" || item.path === "/company-details") {
              return (
                <Can I="manage" a="Settings" key={item.path} fallback={null}>
                  <li>
                    <Link to={item.path} className={`
                      relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-200 group
                      ${isActive 
                        ? 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-xl' 
                        : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-md backdrop-blur-sm'
                      }
                    `}>
                      <div className={`
                        relative flex items-center justify-center w-9 h-9 rounded-lg
                        transition-all duration-200
                        ${isActive 
                          ? 'bg-white/25 backdrop-blur-md border border-white/40 shadow-inner' 
                          : 'bg-gradient-to-br ' + item.gradient + ' shadow-lg border border-white/20'
                        }
                      `}
                      style={{
                        boxShadow: isActive 
                          ? 'inset 0 2px 8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)' 
                          : `0 6px 20px ${item.shadow}, inset 0 1px 0 rgba(255,255,255,0.3)`
                      }}>
                        <div className={`absolute inset-0 rounded-lg ${!isActive ? 'bg-gradient-to-b from-white/30 to-transparent' : ''}`} style={{ height: '50%' }} />
                        <Icon 
                          size={16} 
                          className="text-white relative z-10" 
                        />
                      </div>
                      <span className="font-medium">
                        {item.label}
                      </span>
                    </Link>
                  </li>
                </Can>
              );
            }
            
            return (
              <li key={item.path}>
                <Link to={item.path} className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 group
                  ${isActive 
                    ? 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-xl' 
                    : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-md backdrop-blur-sm'
                  }
                `}>
                  <div className={`
                    relative flex items-center justify-center w-9 h-9 rounded-lg
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-white/25 backdrop-blur-md border border-white/40 shadow-inner' 
                      : 'bg-gradient-to-br ' + item.gradient + ' shadow-lg border border-white/20'
                    }
                  `}
                  style={{
                    boxShadow: isActive 
                      ? 'inset 0 2px 8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)' 
                      : `0 6px 20px ${item.shadow}, inset 0 1px 0 rgba(255,255,255,0.3)`
                  }}>
                    <div className={`absolute inset-0 rounded-lg ${!isActive ? 'bg-gradient-to-b from-white/30 to-transparent' : ''}`} style={{ height: '50%' }} />
                    <Icon 
                      size={16} 
                      className="text-white relative z-10" 
                    />
                  </div>
                  <span className="font-medium">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        
        {/* Import/Export Button in Navigation */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <UnifiedImportExport />
        </div>
      </nav>
      
      <div className="p-3 border-t border-gray-200/50 bg-white/60 backdrop-blur-sm">
        
        <div className="flex items-center gap-2 p-2 rounded-xl bg-white/80 hover:bg-white hover:shadow-md transition-all duration-200 cursor-pointer mb-2">
          <div 
            className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg border border-white/20"
            style={{
              boxShadow: '0 6px 20px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
            }}
          >
            <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-white/30 to-transparent" style={{ height: '50%' }} />
            <User className="text-white relative z-10" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {currentUser?.fullName || currentUser?.email || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate capitalize">
              {currentUser?.role?.replace('_', ' ') || "User"}
            </p>
          </div>
        </div>
        
        {/* Logout Button - Attractive Red Design with Reduced Width */}
        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 group relative overflow-hidden"
          >
            {/* Animated background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            
            {/* Content */}
            <div className="relative flex items-center gap-2">
              <div className="p-1 bg-white/20 rounded group-hover:bg-white/30 transition-colors duration-200">
                <LogOut size={14} className="text-white transform group-hover:rotate-12 transition-transform duration-200" />
              </div>
              <span className="font-semibold tracking-wide">Logout</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}