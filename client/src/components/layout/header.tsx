import React, { useMemo, useState, useRef, useEffect } from "react";
import { Bell, MoreVertical } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

type NotificationItem = {
  type?: 'subscription' | 'compliance' | 'license';
  eventType?: 'created' | 'deleted' | 'updated' | 'reminder' | 'payment_method_expiring';
  lifecycleEventType?: string;
  category?: string;
  complianceCategory?: string;
  reminderDays?: number;
  reminderPolicy?: string;
  filingName?: string;
  subscriptionName?: string;
  licenseName?: string;
  licenseEndDate?: string;
  name?: string;
  message?: string;
  reminderTriggerDate?: string;
  createdAt?: string;
  timestamp?: string;
  isRead?: boolean;
  [key: string]: any;
};

export default function Header() {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const isGlobalAdmin = user?.role === "global_admin";

  const { data: subscriptionNotifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 60_000,
    enabled: !isLoading && Boolean(user) && !isGlobalAdmin,
  });
  const { data: complianceNotifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['/api/notifications/compliance'],
    refetchInterval: 60_000,
    enabled: !isLoading && Boolean(user) && !isGlobalAdmin,
  });
  const { data: licenseNotifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['/api/notifications/license'],
    refetchInterval: 60_000,
    enabled: !isLoading && Boolean(user) && !isGlobalAdmin,
  });

  const dueNotifications = useMemo(() => {
    const notifications = [...subscriptionNotifications, ...complianceNotifications, ...licenseNotifications];
    const todayDate = new Date();
    return notifications.filter((n) => {
      if (n?.eventType === 'created' || n?.eventType === 'deleted' || n?.eventType === 'updated') return true;
      if (!n?.reminderTriggerDate) return true;
      const triggerDate = new Date(n.reminderTriggerDate);
      return triggerDate <= todayDate;
    });
  }, [subscriptionNotifications, complianceNotifications, licenseNotifications]);

  const unreadCount = useMemo(() => {
    return dueNotifications.filter((n) => !Boolean((n as any)?.isRead ?? (n as any)?.read ?? false)).length;
  }, [dueNotifications]);

  const topNotifications = useMemo(() => {
    const toEpoch = (raw: any) => {
      const d = raw instanceof Date ? raw : new Date(String(raw || ""));
      const t = d.getTime();
      return Number.isFinite(t) ? t : 0;
    };

    return [...dueNotifications]
      .sort((a, b) => {
        const ta = toEpoch((a as any).timestamp || (a as any).createdAt || (a as any).reminderTriggerDate);
        const tb = toEpoch((b as any).timestamp || (b as any).createdAt || (b as any).reminderTriggerDate);
        return tb - ta;
      })
      .slice(0, 3);
  }, [dueNotifications]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (profileRef.current && !profileRef.current.contains(target)) setShowProfileMenu(false);
      if (notificationsRef.current && !notificationsRef.current.contains(target)) setShowNotificationsMenu(false);
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

  const getNotificationTitle = (n: NotificationItem): string => {
    const title = String(
      // Prefer the same entity display name the Notifications page shows
      (n as any).filingName ||
      (n as any).subscriptionName ||
      (n as any).complianceName ||
      (n as any).licenseName ||
      (n as any).name ||
      // Fallbacks
      (n as any).title ||
      (n as any).message ||
      "Notification"
    );
    if (title.length > 30) return title.substring(0, 27) + "...";
    return title;
  };

  const getCategoryText = (n: NotificationItem): string => {
    if (n.type === 'compliance') return String((n as any).complianceCategory || (n as any).category || 'Compliance');
    if (n.type === 'license') return String((n as any).category || 'License');
    return String((n as any).category || 'Subscription');
  };

  const getIconBgClass = (n: NotificationItem): string => {
    if (n.eventType === 'created') return 'bg-blue-50';
    if (n.eventType === 'deleted') return 'bg-red-50';
    if (n.eventType === 'updated') return 'bg-purple-50';
    if (n.eventType === 'payment_method_expiring') return 'bg-orange-50';
    return 'bg-green-50';
  };

  const getIconTextClass = (n: NotificationItem): string => {
    if (n.eventType === 'created') return 'text-blue-600';
    if (n.eventType === 'deleted') return 'text-red-600';
    if (n.eventType === 'updated') return 'text-purple-600';
    if (n.eventType === 'payment_method_expiring') return 'text-orange-600';
    return 'text-green-600';
  };

  const getBadgeClass = (n: NotificationItem): string => {
    if (n.eventType === 'created') return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
    if (n.eventType === 'deleted') return 'bg-red-100 text-red-700 hover:bg-red-100';
    if (n.eventType === 'payment_method_expiring') return 'bg-orange-100 text-orange-700 hover:bg-orange-100';

    if (n.eventType === 'updated') {
      const lifecycle = String((n as any).lifecycleEventType || '').toLowerCase();

      if (n.type === 'compliance') {
        if (lifecycle === 'submitted') return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
        if (lifecycle === 'owner_changed') return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
        return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
      }

      if (n.type === 'license') {
        if (lifecycle === 'department_changed') return 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100';
        if (lifecycle === 'responsible_person_changed') return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100';
        if (lifecycle === 'secondary_person_changed') return 'bg-violet-100 text-violet-700 hover:bg-violet-100';
        return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
      }

      if (lifecycle === 'owner_changed') return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
      if (lifecycle === 'price_changed') return 'bg-pink-100 text-pink-700 hover:bg-pink-100';
      if (lifecycle === 'quantity_changed') return 'bg-teal-100 text-teal-700 hover:bg-teal-100';
      if (lifecycle === 'cancelled') return 'bg-red-100 text-red-700 hover:bg-red-100';
      return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
    }

    return 'bg-green-100 text-green-700 hover:bg-green-100';
  };

  const getBadgeText = (n: NotificationItem): string => {
    if (n.eventType === 'created') {
      if (n.type === 'compliance') return 'Compliance Created';
      if (n.type === 'license') return 'License Created';
      return 'Subscription Created';
    }
    if (n.eventType === 'deleted') {
      if (n.type === 'compliance') return 'Compliance Deleted';
      if (n.type === 'license') return 'License Deleted';
      return 'Subscription Deleted';
    }
    if (n.eventType === 'payment_method_expiring') return 'Payment Method Expiring';

    if (n.eventType === 'updated') {
      const lifecycle = String((n as any).lifecycleEventType || '').toLowerCase();

      if (n.type === 'compliance') {
        if (lifecycle === 'owner_changed') return 'Owner Changed';
        if (lifecycle === 'submitted') return 'Submitted';
        return 'Compliance Updated';
      }

      if (n.type === 'license') {
        if (lifecycle === 'department_changed') return 'Department Changed';
        if (lifecycle === 'responsible_person_changed') return 'Responsible Person Changed';
        if (lifecycle === 'secondary_person_changed') return 'Secondary Person Changed';
        return 'License Updated';
      }

      if (lifecycle === 'owner_changed') return 'Owner Changed';
      if (lifecycle === 'price_changed') return 'Price Changed';
      if (lifecycle === 'quantity_changed') return 'Quantity Changed';
      if (lifecycle === 'cancelled') return 'Subscription Cancelled';
      return 'Subscription Updated';
    }

    const formatDueDate = (raw: any): string => {
      if (!raw) return "";
      const d = raw instanceof Date ? raw : new Date(String(raw));
      if (!Number.isFinite(d.getTime())) return "";
      return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    };

    // Reminder (best-effort; header doesn't have full entity lookup)
    if (n.type === 'compliance') {
      const dueText = formatDueDate((n as any).submissionDeadline);
      return dueText ? `Submission (Due: ${dueText})` : 'Submission';
    }

    if (n.type === 'license') {
      const dueText = formatDueDate((n as any).licenseEndDate || (n as any).endDate);
      return dueText ? `Renewal Reminder (Due: ${dueText})` : 'Renewal Reminder';
    }

    const dueText = formatDueDate((n as any).subscriptionEndDate);
    return dueText ? `Renewal Reminder (Due: ${dueText})` : 'Renewal Reminder';
  };

  const getNotificationTimeText = (n: NotificationItem): string => {
    const raw = (n as any).timestamp || (n as any).createdAt || (n as any).reminderTriggerDate;
    if (!raw) return "";
    const d = raw instanceof Date ? raw : new Date(String(raw));
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleString(undefined, { month: "short", day: "2-digit" });
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      sessionStorage.removeItem("token");
      localStorage.removeItem("token");
      sessionStorage.clear();
      navigate("/landing");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="h-16 bg-white border-b border-gray-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex-1" />

      {/* Right Side Icons */}
      <div className="flex items-center gap-4">
        {/* Notification Bell + Dropdown */}
        {isGlobalAdmin ? null : (
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotificationsMenu((v) => !v);
                setShowProfileMenu(false);
              }}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Notifications"
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

            {showNotificationsMenu && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900">Notifications</div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotificationsMenu(false);
                      navigate("/notifications");
                    }}
                    className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    View All
                  </button>
                </div>

                {topNotifications.length === 0 ? (
                  <div className="py-10 px-6 text-center">
                    <Bell className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                    <div className="text-sm text-gray-500">No notifications</div>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {topNotifications.map((n, idx) => {
                      const isUnread = !Boolean((n as any)?.isRead ?? (n as any)?.read ?? false);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setShowNotificationsMenu(false);
                            navigate("/notifications");
                          }}
                          className={
                            "w-full text-left px-4 py-3 border-b border-gray-100 transition-colors " +
                            (isUnread ? "bg-blue-50 hover:bg-blue-100" : "bg-white hover:bg-gray-50")
                          }
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isUnread ? 'bg-blue-600' : 'bg-transparent'}`} />

                            <div className={`p-2 rounded-lg flex-shrink-0 ${getIconBgClass(n)}`}>
                              <Bell className={`h-4 w-4 ${getIconTextClass(n)}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {getNotificationTitle(n)}
                                </span>
                                <span className="text-gray-400">·</span>
                                <span className="text-xs text-gray-500">
                                  {getCategoryText(n)}
                                </span>
                                <Badge className={`text-xs font-medium px-2 py-0.5 rounded-md ${getBadgeClass(n)}`}>
                                  {getBadgeText(n)}
                                </Badge>
                              </div>
                            </div>

                            <div className="text-xs text-gray-400 flex-shrink-0">
                              {getNotificationTimeText(n)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User Profile + Kebab Menu */}
        <div className="relative flex items-center gap-3" ref={profileRef}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt="Profile"
                  className="h-full w-full object-cover rounded-full"
                  width={40}
                  height={40}
                  loading="eager"
                  decoding="async"
                />
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
