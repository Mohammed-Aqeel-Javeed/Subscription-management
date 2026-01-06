import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/context/UserContext";
import { SidebarSlotProvider } from "@/context/SidebarSlotContext";
import Sidebar from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import ComplianceLedger from "@/pages/compliance-ledger";
import Subscriptions from "@/pages/subscriptions";
import CancelledSubscriptionsPage from "@/pages/cancelled-subscriptions";
import Notifications from "@/pages/notifications";
import Configuration from "@/pages/configuration";
import Reports from "@/pages/reports";
import SubscriptionHistory from "@/pages/subscription-history";
import GovernmentLicense from "@/pages/government-license";
// import Users from "@/pages/users";
import NotFound from "@/pages/not-found";
import SubscriptionUserPage from "@/pages/subscription-user";
import ComplianceDashboard from "@/pages/compliance-dashboard";
import Compliance from "@/pages/compliance";
import AuthPage from "@/pages/auth";
import SignupPage from "@/pages/signup";
import CompanyDetails from "@/pages/company-details";
import CalendarMonthly from "@/pages/calendar-monthly";
import CalendarYearly from "@/pages/calendar-yearly";
import LandingPage from "@/pages/landing";

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
  const hideSidebarPaths = ["/", "/login", "/signup", "/auth", "/landing"];
  const location = useLocation();
  const navigate = useNavigate();

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
  useEffect(() => {
    const checkAuth = async () => {
      // Skip auth check for public pages
      const publicPaths = ["/login", "/signup", "/auth", "/landing"];
      if (publicPaths.includes(location.pathname)) {
        return;
      }

      // For root path, check if user is authenticated
      if (location.pathname === "/") {
        try {
          const res = await fetch("/api/me", { credentials: "include" });
          if (res.ok) {
            // User is authenticated, redirect to dashboard
            navigate("/dashboard", { replace: true });
          }
          // If not authenticated, stay on landing page
        } catch (error) {
          // Network error, stay on landing page
        }
        return;
      }

      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (!res.ok) {
          // Not authenticated, redirect to landing page
          sessionStorage.clear();
          navigate("/", { replace: true });
        }
      } catch (error) {
        // Network error or server error, redirect to landing page
        sessionStorage.clear();
        navigate("/", { replace: true });
      }
    };

    checkAuth();
  }, [location.pathname, navigate]);

  return (
    <SidebarSlotProvider>
      <div className="flex h-screen">
        {hideSidebarPaths.includes(location.pathname) ? null : <Sidebar />}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/subscriptions/cancelled" element={<CancelledSubscriptionsPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/configuration" element={<Configuration />} />
            <Route path="/reminders" element={<Configuration />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/subscription-history" element={<SubscriptionHistory />} />
            {/* <Route path="/users" element={<Users />} /> */}
            <Route path="/compliance-dashboard" element={<ComplianceDashboard />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/compliance-ledger" element={<ComplianceLedger />} />
            <Route path="/government-license" element={<GovernmentLicense />} />
            <Route path="/company-details" element={<CompanyDetails />} />
            <Route path="/subscription-user" element={<SubscriptionUserPage />} />
            <Route path="/calendar-monthly" element={<CalendarMonthly />} />
            <Route path="/calendar-yearly" element={<CalendarYearly />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </SidebarSlotProvider>
  );
}

export default App;
