import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/context/UserContext";
import { SidebarSlotProvider } from "@/context/SidebarSlotContext";
import { apiFetch } from "@/lib/api";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import Chatbot from "@/pages/chatbot";
import Dashboard from "@/pages/dashboard";
import ComplianceLedger from "@/pages/compliance-ledger";
import ComplianceLogPage from "@/pages/compliance-log";
import Subscriptions from "@/pages/subscriptions";
import CancelledSubscriptionsPage from "@/pages/cancelled-subscriptions";
import Notifications from "@/pages/notifications";
import Configuration from "@/pages/configuration";
import Reports from "@/pages/reports";
import UpcomingRenewalReport from "@/pages/upcoming-renewal-report";
import SpendingAnalysisReport from "@/pages/spending-analysis-report";
import CardWiseSpendReport from "@/pages/card-wise-spend-report";
import UpcomingFilingsReport from "@/pages/upcoming-filings-report";
import ComplianceSpendAuditHistoryReport from "@/pages/compliance-spend-audit-history-report";
import DepartmentalComplianceScorecardReport from "@/pages/departmental-compliance-scorecard-report";
import DepartmentWiseRenewalsReport from "@/pages/department-wise-renewals-report";
import RenewalLeadTimeAnalysisReport from "@/pages/renewal-lead-time-analysis-report";
import RenewalResponsibilityReport from "@/pages/renewal-responsibility-report";
import ExpiredRenewalsReport from "@/pages/expired-renewals-report";
import UpcomingRenewalsReport from "@/pages/upcoming-renewals-report";
import SubscriptionHistory from "@/pages/subscription-history";
import GovernmentLicense from "@/pages/government-license";
import RenewalLog from "@/pages/renewal-log";
// import Users from "@/pages/users";
import NotFound from "@/pages/not-found";
import SubscriptionUserPage from "@/pages/subscription-user";
import ComplianceDashboard from "@/pages/compliance-dashboard";
import RenewalDashboard from "@/pages/renewal-dashboard";
import Compliance from "@/pages/compliance";
import AuthPage from "@/pages/auth";
import SignupPage from "@/pages/signup";
import CompanyDetails from "@/pages/company-details";
import CalendarPage from "@/pages/calendar";
import CalendarMonthly from "@/pages/calendar-monthly";
import CalendarYearly from "@/pages/calendar-yearly";
import LandingPage from "@/pages/landing";
import Profile from "@/pages/profile";
import SecureLinkRedirect from "@/pages/secure-link";
import PlatformAdminPage from "@/pages/platform-admin";
import UpgradePage from "@/pages/upgrade";
import PaymentSuccessPage from "@/pages/payment-success";
import TrialExpiredOverlay from "@/components/TrialExpiredOverlay";
import { useUser } from "@/context/UserContext";
import { useIsMobile } from "@/hooks/use-mobile";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserProvider>
          <Toaster />
          <BrowserRouter>
            <AppWithSidebar />
          </BrowserRouter>
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AppWithSidebar() {
  const hideSidebarPaths = ["/", "/login", "/signup", "/auth", "/landing", "/s", "/upgrade", "/payment-success"];
  const hideChatbotPaths = ["/", "/login", "/signup", "/auth", "/landing", "/s", "/upgrade", "/payment-success", "/dashboard", "/notifications", "/reports", "/reports/upcoming-renewal", "/reports/spending-analysis", "/reports/card-wise", "/reports/upcoming-filings", "/reports/compliance-spend", "/reports/departmental-scorecard", "/reports/department-wise-renewals", "/reports/renewal-lead-time-analysis", "/reports/renewal-responsibility", "/reports/expired-renewals", "/reports/upcoming-renewals"];
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const isSecureLinkRoute = location.pathname.startsWith('/s/');
  const shouldHideSidebar = isSecureLinkRoute || hideSidebarPaths.includes(location.pathname);
  const shouldHideChatbot = isSecureLinkRoute || hideChatbotPaths.includes(location.pathname);

  // Plan expiry gate — covers both trial expiry and cancelled paid subscriptions
  const { user: currentUser } = useUser();
  const overlayExcluded = ["/upgrade", "/payment-success", "/", "/login", "/signup", "/auth"];
  const isTrialExpired =
    currentUser?.plan === "trial" &&
    !!currentUser?.trialEndsAt &&
    new Date(currentUser.trialEndsAt) < new Date();
  const isPlanExpired = currentUser?.plan === "expired";
  const isPlanLocked =
    currentUser !== null &&
    currentUser?.role !== "global_admin" &&
    (isTrialExpired || isPlanExpired);
  const showTrialOverlay = isPlanLocked && !overlayExcluded.includes(location.pathname);

  // Determine if chatbot should be shown
  const showChatbot = !shouldHideChatbot;

  // Clear session when window/tab is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear session storage when browser/tab closes
      sessionStorage.clear();
    };

    // Add event listener for window close
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Check authentication on every route change
  const checkAuth = React.useCallback(async () => {
      // Skip auth check for public pages
      const publicPaths = ["/login", "/signup", "/auth", "/landing", "/upgrade", "/payment-success"];
      if (publicPaths.includes(location.pathname) || location.pathname.startsWith('/s/')) {
        return;
      }

      // For root path, check if user is authenticated
      if (location.pathname === "/") {
        try {
          const res = await apiFetch("/api/me");
          if (res.ok) {
            const me = await res.json().catch(() => null);
            const next = me?.role === "global_admin" ? "/platform-admin" : "/dashboard";
            navigate(next, { replace: true });
          }
          // If not authenticated, stay on landing page
        } catch (error) {
          // Network error, stay on landing page
        }
        return;
      }

      try {
        const res = await apiFetch("/api/me");
        console.log("[App Auth Guard] /api/me response:", {
          ok: res.ok,
          status: res.status,
          pathname: location.pathname
        });
        if (!res.ok) {
          // Only hard-redirect on real auth failures.
          if (res.status === 401 || res.status === 403) {
            console.log("[App Auth Guard] Not authenticated, redirecting to landing");
            sessionStorage.clear();
            navigate("/", { replace: true });
          }
          return;
        }

        const me = await res.json().catch(() => null);
        if (me?.role === "global_admin") {
          const allowed = new Set(["/platform-admin", "/profile"]);
          if (!allowed.has(location.pathname)) {
            navigate("/platform-admin", { replace: true });
          }
        }
      } catch (error) {
        // Likely wake-from-sleep/offline/server-restart: do not clear session or redirect.
        console.error("[App Auth Guard] Error checking auth:", error);
        return;
      }
  }, [location.pathname, navigate]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Re-validate auth when waking from sleep / tab becomes visible.
  useEffect(() => {
    const onVisibleOrOnline = () => {
      if (document.visibilityState === "visible") {
        checkAuth();
      }
    };

    window.addEventListener("focus", onVisibleOrOnline);
    window.addEventListener("online", onVisibleOrOnline);
    document.addEventListener("visibilitychange", onVisibleOrOnline);

    return () => {
      window.removeEventListener("focus", onVisibleOrOnline);
      window.removeEventListener("online", onVisibleOrOnline);
      document.removeEventListener("visibilitychange", onVisibleOrOnline);
    };
  }, [checkAuth]);

  // Responsive default: keep sidebar collapsed on mobile.
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Some views manage their own internal scrolling (tables/panels).
  // For those routes, lock the outer page scroll so mouse-wheel doesn't move the whole view.
  const lockOuterScroll =
    location.pathname.startsWith("/company-details/") ||
    location.pathname.startsWith("/configuration");

  return (
    <SidebarSlotProvider>
      <div className="flex h-screen w-full overflow-hidden">
        {shouldHideSidebar ? null : (
          <Sidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        )}
        {showTrialOverlay && (
          <TrialExpiredOverlay
            plan={currentUser?.plan}
            trialEndsAt={currentUser?.trialEndsAt}
          />
        )}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {!shouldHideSidebar && <Header />}
          <div className={lockOuterScroll ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-auto"}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/s/:token" element={<SecureLinkRedirect />} />
              <Route path="/platform-admin" element={<PlatformAdminPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/subscriptions/cancelled" element={<CancelledSubscriptionsPage />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/configuration" element={<Configuration />} />
              <Route path="/configuration/:section" element={<Configuration />} />
              <Route path="/reminders" element={<Configuration />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/upcoming-renewal" element={<UpcomingRenewalReport />} />
              <Route path="/reports/spending-analysis" element={<SpendingAnalysisReport />} />
              <Route path="/reports/card-wise" element={<CardWiseSpendReport />} />
              <Route path="/reports/upcoming-filings" element={<UpcomingFilingsReport />} />
              <Route path="/reports/compliance-spend" element={<ComplianceSpendAuditHistoryReport />} />
              <Route path="/reports/departmental-scorecard" element={<DepartmentalComplianceScorecardReport />} />
              <Route path="/reports/department-wise-renewals" element={<DepartmentWiseRenewalsReport />} />
              <Route path="/reports/renewal-lead-time-analysis" element={<RenewalLeadTimeAnalysisReport />} />
              <Route path="/reports/renewal-responsibility" element={<RenewalResponsibilityReport />} />
              <Route path="/reports/expired-renewals" element={<ExpiredRenewalsReport />} />
              <Route path="/reports/upcoming-renewals" element={<UpcomingRenewalsReport />} />
              <Route path="/subscription-history" element={<SubscriptionHistory />} />
              {/* <Route path="/users" element={<Users />} /> */}
              <Route path="/compliance-dashboard" element={<ComplianceDashboard />} />
              <Route path="/renewal-dashboard" element={<RenewalDashboard />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/compliance-ledger" element={<ComplianceLedger />} />
              <Route path="/compliance-log" element={<ComplianceLogPage />} />
              <Route path="/government-license" element={<GovernmentLicense />} />
              <Route path="/renewal-log" element={<RenewalLog />} />
              <Route path="/company-details" element={<CompanyDetails />} />
              <Route path="/company-details/:section" element={<CompanyDetails />} />
              <Route path="/subscription-user" element={<SubscriptionUserPage />} />
              <Route path="/profile" element={<Profile />} />
                <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/calendar-monthly" element={<CalendarMonthly />} />
              <Route path="/calendar-yearly" element={<CalendarYearly />} />
              <Route path="/upgrade" element={<UpgradePage />} />
              <Route path="/payment-success" element={<PaymentSuccessPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
        {/* Chatbot - shown on all pages except dashboard, notifications, reports, and auth pages */}
        {showChatbot && <Chatbot />}
      </div>
    </SidebarSlotProvider>
  );
}

export default App;
