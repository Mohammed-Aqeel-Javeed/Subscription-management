import { Link, useLocation } from "react-router-dom";
import { CreditCard, PieChart, List, Settings, FileText, Users, User, Bell, Building2, Shield, ShieldCheck } from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: PieChart },
  { path: "/subscriptions", label: "Subscriptions", icon: List },
  { path: "/compliance", label: "Compliance", icon: ShieldCheck },
  { path: "/government-license", label: "Government License", icon: Shield },
  { path: "/notifications", label: "Notifications", icon: Bell },
  { path: "/reminders", label: "Setup & Configuration", icon: Settings },
  { path: "/company-details", label: "Company Details", icon: Building2 },
  { path: "/reports", label: "Reports", icon: FileText },
  // ...removed User Management link...
];

export default function Sidebar() {
  // Get current location for active state
  const location = window.location.pathname;
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
            const isActive = location === item.path;
            
            return (
              <li key={item.path}>
                <Link to={item.path} className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
                  }
                `}>
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
      </nav>
      
      <div className="p-4 border-t border-gray-200 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/80 hover:bg-white hover:shadow-sm transition-all duration-200 cursor-pointer">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <User className="text-white" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              John Doe
            </p>
            <p className="text-xs text-gray-500 truncate">
              Administrator
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}