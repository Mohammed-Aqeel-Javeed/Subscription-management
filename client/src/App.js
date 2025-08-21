import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/layout/sidebar";
import Dashboard from "@/pages/dashboard";
import ComplianceLedger from "@/pages/compliance-ledger";
import Subscriptions from "@/pages/subscriptions";
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
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsxs(TooltipProvider, { children: [_jsx(Toaster, {}), _jsx(BrowserRouter, { children: _jsx(AppWithSidebar, {}) })] }) }));
}
function AppWithSidebar() {
    var hideSidebarPaths = ["/login", "/signup", "/auth"];
    var location = useLocation();
    return (_jsxs("div", { className: "flex h-screen", children: [hideSidebarPaths.includes(location.pathname) ? null : _jsx(Sidebar, {}), _jsx("main", { className: "flex-1 overflow-auto", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(AuthPage, {}) }), _jsx(Route, { path: "/auth", element: _jsx(AuthPage, {}) }), _jsx(Route, { path: "/signup", element: _jsx(SignupPage, {}) }), _jsx(Route, { path: "/", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/subscriptions", element: _jsx(Subscriptions, {}) }), _jsx(Route, { path: "/notifications", element: _jsx(Notifications, {}) }), _jsx(Route, { path: "/reminders", element: _jsx(Configuration, {}) }), _jsx(Route, { path: "/reports", element: _jsx(Reports, {}) }), _jsx(Route, { path: "/subscription-history", element: _jsx(SubscriptionHistory, {}) }), _jsx(Route, { path: "/compliance-dashboard", element: _jsx(ComplianceDashboard, {}) }), _jsx(Route, { path: "/compliance", element: _jsx(Compliance, {}) }), _jsx(Route, { path: "/compliance-ledger", element: _jsx(ComplianceLedger, {}) }), _jsx(Route, { path: "/company-details", element: _jsx(CompanyDetails, {}) }), _jsx(Route, { path: "/subscription-user", element: _jsx(SubscriptionUserPage, {}) }), _jsx(Route, { path: "/calendar-monthly", element: _jsx(CalendarMonthly, {}) }), _jsx(Route, { path: "/calendar-yearly", element: _jsx(CalendarYearly, {}) }), _jsx(Route, { path: "*", element: _jsx(NotFound, {}) })] }) })] }));
}
export default App;
