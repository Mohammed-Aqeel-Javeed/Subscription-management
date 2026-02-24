import React, { useState, useRef, useEffect } from "react";
import { Bell, Search, LogOut, User, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";

// Define all available pages for search - matching sidebar exactly
const pages = [
  { name: "Dashboard", path: "/dashboard", keywords: ["dashboard", "home", "overview", "analytics"] },
  { name: "Subscriptions", path: "/subscriptions", keywords: ["subscriptions", "services", "subs"] },
  { name: "Compliance", path: "/compliance", keywords: ["compliance", "filing", "regulations"] },
  { name: "Renewals", path: "/government-license", keywords: ["renewals", "license", "government", "permits"] },
  { name: "Notifications", path: "/notifications", keywords: ["notifications", "alerts", "reminders"] },
  { name: "Setup & Configuration", path: "/reminders", keywords: ["configuration", "settings", "setup", "reminders"] },
  { name: "Company Details", path: "/company-details", keywords: ["company", "details", "employees", "departments"] },
  { name: "Reports", path: "/reports", keywords: ["reports", "analytics"] },
];

export default function Header() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Filter pages based on search query
  const filteredPages = searchQuery.trim()
    ? pages.filter(page =>
        page.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.keywords.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getUserRole = () => {
    if (!user) return "";
    return user.role || "USER";
  };

  const getUserName = () => {
    return user?.fullName || user?.email || "User";
  };

  const handleSearchSelect = (path: string) => {
    navigate(path);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      sessionStorage.clear();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl relative" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            className="pl-10 pr-4 h-10 bg-gray-50 border-gray-200 rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchQuery.trim() && (
          <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
            {filteredPages.length > 0 ? (
              filteredPages.map((page) => (
                <div
                  key={page.path}
                  onClick={() => handleSearchSelect(page.path)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-indigo-700 hover:text-indigo-900 underline underline-offset-2 font-medium text-left">
                    {page.name}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-gray-500 text-sm">No pages found</div>
            )}
          </div>
        )}
      </div>

      {/* Right Side Icons */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          onClick={() => navigate("/notifications")}
          className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="h-5 w-5 text-gray-600" />
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 px-3 py-2 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {getInitials(getUserName())}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900 leading-tight">
                  {getUserName()}
                </span>
                <span className="text-xs text-gray-600 leading-tight uppercase">
                  {getUserRole()}
                </span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-600" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
              {/* Profile Header */}
              <div className="bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center text-white text-lg font-bold">
                    {getInitials(getUserName())}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-base">
                      {getUserName()}
                    </div>
                    <div className="text-white/80 text-sm">
                      {user?.email || ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Role:</span>
                    <span className="font-medium text-gray-900 uppercase">{getUserRole()}</span>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <div className="p-3">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg transition-all font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
