import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export type PlatformNavItem = {
  id: string;
  label: string;
  path: string;
  description: string;
  readOnly?: boolean;
};

export type PlatformNavSection = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
  items: PlatformNavItem[];
};

export const platformNavSections: PlatformNavSection[] = [
  {
    id: "overview",
    label: "Overview",
    path: "/platform-admin",
    icon: LayoutDashboard,
    description: "Platform-wide metrics, analytics, and health.",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        path: "/platform-admin",
        description: "Platform KPIs, growth, and recent cross-tenant activity.",
      },
      {
        id: "analytics",
        label: "Analytics",
        path: "/platform-admin/analytics",
        description: "Tenant growth, adoption, and usage summaries across the SaaS platform.",
      },
    ],
  },
  {
    id: "tenants",
    label: "Tenants",
    path: "/platform-admin/tenants",
    icon: Building2,
    description: "Company management and tenant usage visibility.",
    items: [
      {
        id: "organizations",
        label: "Organizations",
        path: "/platform-admin/tenants",
        description: "Manage all companies onboarded to the platform.",
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    path: "/platform-admin/billing",
    icon: CreditCard,
    description: "Stripe billing, invoices, and payment status tracking.",
    items: [
      {
        id: "billing-overview",
        label: "Billing Overview",
        path: "/platform-admin/billing",
        description: "Stripe billing summary for payments, invoices, and revenue flow.",
      },
      {
        id: "stripe-subscriptions",
        label: "Subscriptions",
        path: "/platform-admin/billing/subscriptions",
        description: "Stripe-linked subscription records and renewal windows.",
      },
      {
        id: "payments",
        label: "Payments",
        path: "/platform-admin/billing/payments",
        description: "Payment history and subscription charge outcomes from Stripe.",
      },
      {
        id: "invoices",
        label: "Invoices",
        path: "/platform-admin/billing/invoices",
        description: "Invoice list with paid, pending, and failed status visibility.",
      },
    ],
  },
  {
    id: "users",
    label: "Users",
    path: "/platform-admin/users",
    icon: Users,
    description: "Platform user directory across all tenant accounts.",
    items: [
      {
        id: "all-users",
        label: "All Users",
        path: "/platform-admin/users",
        description: "Browse all authenticated users across companies.",
      },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    path: "/platform-admin/monitoring",
    icon: Activity,
    description: "Audit and operational monitoring for the platform.",
    items: [
      {
        id: "system-health",
        label: "System Health",
        path: "/platform-admin/monitoring",
        description: "Health indicators for billing, schedulers, and core platform services.",
      },
      {
        id: "audit-logs",
        label: "Audit Activity",
        path: "/platform-admin/monitoring/activity",
        description: "Latest audit trail entries generated across tenants.",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    path: "/platform-admin/settings",
    icon: Settings,
    description: "Platform configuration, feature switches, and security posture.",
    items: [
      {
        id: "platform-settings",
        label: "Platform Settings",
        path: "/platform-admin/settings",
        description: "Platform-level operating controls and admin preferences.",
      },
      {
        id: "security",
        label: "Security",
        path: "/platform-admin/settings/security",
        description: "Security posture and critical protections enabled in the platform.",
      },
    ],
  },
];

export const platformSectionIcons = {
  analytics: BarChart3,
  systemHealth: HeartPulse,
  security: ShieldCheck,
  documents: FileText,
};

export function findPlatformSection(pathname: string): PlatformNavSection | undefined {
  // Pick the most specific (longest path) match.
  // Without this, the Overview section ("/platform-admin") would match every sub-route
  // and break section-specific features like billing/users query enabling.
  const matches = platformNavSections.filter(
    (section) => pathname === section.path || pathname.startsWith(`${section.path}/`)
  );
  if (!matches.length) return undefined;
  return matches.sort((a, b) => b.path.length - a.path.length)[0];
}

export function findPlatformItem(pathname: string): PlatformNavItem | undefined {
  for (const section of platformNavSections) {
    const exact = section.items.find((item) => item.path === pathname);
    if (exact) return exact;
  }
  return undefined;
}

export function isGlobalAdminPlatformPath(pathname: string): boolean {
  return pathname === "/profile" || pathname === "/platform-admin" || pathname.startsWith("/platform-admin/");
}