import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import ComplianceLedger from "@/pages/compliance-ledger";
import Subscriptions from "@/pages/subscriptions";
import CancelledSubscriptionsPage from "@/pages/cancelled-subscriptions";
import Notifications from "@/pages/notifications";
import Configuration from "@/pages/configuration";
import Reports from "@/pages/reports";
import SubscriptionHistory from "@/pages/subscription-history";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AppWithSidebar />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AppWithSidebar() {
  const hideSidebarPaths = ["/login", "/signup", "/auth"];
  const location = useLocation();
  return (
    <div className="flex h-screen">
      {hideSidebarPaths.includes(location.pathname) ? null : <Sidebar />}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<Dashboard />} />
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
          <Route path="/company-details" element={<CompanyDetails />} />
          <Route path="/subscription-user" element={<SubscriptionUserPage />} />
          <Route path="/calendar-monthly" element={<CalendarMonthly />} />
          <Route path="/calendar-yearly" element={<CalendarYearly />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
