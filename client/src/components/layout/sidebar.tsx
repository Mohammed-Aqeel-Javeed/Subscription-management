import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Layers, Settings, FileBarChart, User, BellRing, Building2, ShieldCheck, Award, LogOut } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { UnifiedImportExport } from "../unified-import-export";

const navItems = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/subscriptions", label: "Subscriptions", icon: Layers },
  { path: "/compliance", label: "Compliance", icon: Award },
  { path: "/government-license", label: "Government License", icon: ShieldCheck },
  { path: "/notifications", label: "Notifications", icon: BellRing },
  { path: "/reminders", label: "Setup & Configuration", icon: Settings },
  { path: "/company-details", label: "Company Details", icon: Building2 },
  { path: "/reports", label: "Reports", icon: FileBarChart },
  // ...removed User Management link...
];

export default function Sidebar() {
  // Get current location for active state
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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
    <aside className="w-64 bg-gradient-to-b from-slate-50 to-slate-100 shadow-sm flex flex-col h-screen border-r border-gray-200 relative overflow-hidden">
      
      <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <img 
            src="/assets/logo.png"
            alt="SubsTracker Logo" 
            className="w-8 h-8 object-contain"
          />
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            SubsTracker
          </h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <Link to={item.path} className={`
                  relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 group overflow-hidden
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
                  }
                `}>
                  {/* Blue line that travels from left to right */}
                  <div className={`
                    absolute top-0 bottom-0 w-1 transition-all duration-500 ease-in-out
                    ${isActive 
                      ? 'bg-white right-0 rounded-l-full' 
                      : 'bg-blue-500 -left-1 group-hover:left-0 group-hover:right-0 group-hover:w-full group-hover:opacity-10 rounded-none'
                    }
                  `} />
                  <Icon 
                    size={18} 
                    className={`
                      ${isActive ? 'text-white' : 'text-gray-500'} 
                      transition-colors duration-200
                    `} 
                  />
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
      
      <div className="p-4 border-t border-gray-200 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/80 hover:bg-white hover:shadow-sm transition-all duration-200 cursor-pointer mb-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <User className="text-white" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {currentUser?.fullName || currentUser?.email || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              Administrator
            </p>
          </div>
        </div>
        
        {/* Logout Button - Attractive Red Design with Reduced Width */}
        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 group relative overflow-hidden"
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
    </aside>
  );
}