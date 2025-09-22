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
    <aside className="w-64 bg-gradient-to-br from-gray-50 via-white to-gray-100 shadow-lg flex flex-col h-screen border-r border-gray-200 relative overflow-hidden font-sans">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDYwIDYwIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiM0RjQ2RTUiIGQ9Ik0zNiAzNGMtMy4zMTQgMC02LTIuNjg2LTYtNnMyLjY4Ni02IDYtNiA2IDIuNjg2IDYgNi0yLjY4NiA2LTYgNnptMCAxOGMtMy4zMTQgMC02LTIuNjg2LTYtNnMyLjY4Ni02IDYtNiA2IDIuNjg2IDYgNi0yLjY4NiA2LTYgNnptMTgtMGMtMy4zMTQgMC02LTIuNjg2LTYtNnMyLjY4Ni02IDYtNiA2IDIuNjg2IDYgNi0yLjY4NiA2LTYgNnptMTggMThjLTMuMzE0IDAtNi0yLjY4Ni02LTZzMi42ODYtNiA2LTYgNiAyLjY4NiA2IDYtMi42ODYgNi02IDZ6Ii8+PC9nPjwvc3ZnPg==')] bg-repeat"></div>
      </div>
      
      <div className="p-6 border-b border-gray-200 relative z-10">
        <div className="flex items-center space-x-3">
          <img 
            src="/assets/logo.png"
            alt="SubsTracker Logo" 
            className="w-10 h-10 object-contain"
          />
          <h1 className="text-xl font-bold bg-gradient-to-r from-pink-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent tracking-tight animate-gradient leading-tight">
            SubsTracker
          </h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto relative z-10">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <li key={item.path}>
                <Link to={item.path} className={`
                  group relative flex items-center gap-3 px-4 py-3 rounded-lg 
                  transition-all duration-300 overflow-hidden
                  ${isActive 
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}>
                  {/* Indigo accent bar that expands to full width on hover */}
                  <div className={`
                    absolute left-0 top-0 bottom-0 w-0 bg-gradient-to-r from-indigo-500/20 to-indigo-400/10
                    transition-all duration-500 ease-out
                    ${isActive ? 'w-full' : 'group-hover:w-full'}
                  `}></div>
                  <Icon 
                    size={20} 
                    className={`
                      ${isActive ? 'text-indigo-600' : 'text-gray-500 group-hover:text-indigo-600'} 
                      transition-colors duration-300 z-10 flex-shrink-0
                    `} 
                  />
                  <span className="text-sm font-medium transition-all duration-300 group-hover:translate-x-2 z-10 tracking-tight">
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-6 bg-indigo-500 rounded-full animate-pulse"></div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-200 relative z-10">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all duration-300 cursor-pointer group">
          <div className="relative transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full flex items-center justify-center shadow-md animate-pulse">
              <User className="text-white" size={18} />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-ping"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors duration-300 truncate">
              John Doe
            </p>
            <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-300 truncate">
              Administrator
            </p>
          </div>
          <div className="text-gray-400 group-hover:text-gray-600 transition-all duration-300 group-hover:rotate-180 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s ease infinite;
        }
        
        /* Improve font rendering */
        aside {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
      `}</style>
    </aside>
  );
}