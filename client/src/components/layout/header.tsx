import React, { useState, useRef, useEffect } from "react";
import { Bell, MoreVertical } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

type NotificationItem = {
  eventType?: 'created' | 'deleted' | 'updated' | 'reminder' | 'payment_method_expiring';
  reminderTriggerDate?: string;
  createdAt?: string;
  timestamp?: string;
  isRead?: boolean;
  [key: string]: any;
};

export default function Header() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isGlobalAdmin = user?.role === "global_admin";

  const { data: subscriptionNotifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 60_000,
    enabled: !isGlobalAdmin,
  });
  const { data: complianceNotifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['/api/notifications/compliance'],
    refetchInterval: 60_000,
    enabled: !isGlobalAdmin,
  });
  const { data: licenseNotifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['/api/notifications/license'],
    refetchInterval: 60_000,
    enabled: !isGlobalAdmin,
  });

  const unreadCount = (() => {
    const notifications = [...subscriptionNotifications, ...complianceNotifications, ...licenseNotifications];
    const todayDate = new Date();
    const dueFiltered = notifications.filter((n) => {
      if (n?.eventType === 'created' || n?.eventType === 'deleted' || n?.eventType === 'updated') return true;
      if (!n?.reminderTriggerDate) return true;
      const triggerDate = new Date(n.reminderTriggerDate);
      return triggerDate <= todayDate;
    });
    return dueFiltered.filter((n) => !(n as any)?.isRead).length;
  })();

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  const formatRole = (role: string) => {
    if (!role) return "";
    return role
      .replace(/[-_]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const getUserName = () => {
    return user?.fullName || user?.email || "User";
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
      <div className="flex-1" />

      {/* Right Side Icons */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          onClick={() => navigate("/notifications")}
          className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell
            className={unreadCount > 0 ? "h-5 w-5 text-yellow-400" : "h-5 w-5 text-gray-600"}
            fill={unreadCount > 0 ? "currentColor" : "none"}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none flex items-center justify-center border-2 border-white">
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Profile + Kebab Menu */}
        <div className="relative flex items-center gap-3" ref={profileRef}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-gray-700">{getInitials(getUserName())}</span>
              )}
            </div>
            <div className="hidden sm:flex flex-col leading-tight">
              <div className="text-sm font-semibold text-gray-900 max-w-[180px] truncate">
                {getUserName()}
              </div>
              <div className="text-xs text-gray-500 max-w-[180px] truncate">
                {formatRole(getUserRole())}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Profile menu"
          >
            <MoreVertical className="h-5 w-5 text-gray-600" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
              {/* Account Section Header */}
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</h3>
              </div>

              {/* User Info */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {getInitials(getUserName())}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {getUserName()}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {user?.email || ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu */}
              <div className="border-b border-gray-200">
                <button
                  onClick={() => {
                    navigate("/profile");
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Profile
                </button>

                <button
                  onClick={() => {
                    navigate("/configuration");
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Settings
                </button>
              </div>

              {/* Additional Options */}
              <div className="border-b border-gray-200">
                <button
                  onClick={() => {
                    window.dispatchEvent(new Event("open-chatbot"));
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Help
                </button>
              </div>

              {/* Logout */}
              <div className="p-2">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                >
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
