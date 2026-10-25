import { can, type Permission, type Role } from "@leadgen/core/team/access";

// Every page the dashboard search can jump to. Client-safe (no server imports)
// because the search box filters these in the browser as you type. Pages an
// access level can't open aren't offered to it.

export type DashboardPage = {
  label: string;
  // Appended to /dashboard/[tenant].
  href: string;
  // Extra words that should find it.
  keywords?: string;
  permission?: Permission;
};

export const DASHBOARD_PAGES: DashboardPage[] = [
  { label: "Dashboard", href: "", keywords: "overview home stats income" },
  { label: "Calendar", href: "/diary", keywords: "diary schedule jobs time off" },
  { label: "Bookings", href: "/bookings", keywords: "jobs deposits" },
  { label: "Leads", href: "/leads", keywords: "quotes enquiries", permission: "leads.view" },
  { label: "Packages", href: "/pricing", keywords: "services prices pricing", permission: "pricing.view" },
  { label: "Coverage Area", href: "/coverage", keywords: "postcode travel radius", permission: "settings.view" },
  { label: "Staff / Techs", href: "/staff", keywords: "team technicians employees", permission: "settings.view" },
  { label: "Customers", href: "/customers", keywords: "clients marketing", permission: "customers.view" },
  { label: "Add customer", href: "/customers/new", keywords: "new customer", permission: "customers.view" },
  { label: "Payments", href: "/payments", keywords: "income stripe refunds", permission: "money" },
  { label: "Payment links", href: "/payments/links", keywords: "pay link invoice", permission: "money" },
  { label: "Account settings", href: "/settings/account", keywords: "profile name email password sign out devices" },
  { label: "Settings", href: "/settings", keywords: "business name contact phone vat time zone trade", permission: "settings.view" },
  { label: "Booking page settings", href: "/settings/booking-page", keywords: "branding logo colour cover domain embed website button", permission: "settings.view" },
  { label: "Booking settings", href: "/settings/booking", keywords: "hours availability van unit approval photos questions cancellation policy", permission: "settings.view" },
  { label: "AI assistant", href: "/settings/assistant", keywords: "ai agent follow up hand off tone", permission: "settings.view" },
  { label: "Payment settings", href: "/settings/payments", keywords: "stripe deposit refund payouts", permission: "settings.view" },
  { label: "Notifications", href: "/settings/notifications", keywords: "email sms reminder confirmation review alerts templates", permission: "settings.view" },
  { label: "Privacy settings", href: "/settings/privacy", keywords: "gdpr data export erase retention consent delete account", permission: "settings.view" },
  { label: "Billing", href: "/settings/billing", keywords: "subscription plan invoices card", permission: "settings.view" },
  { label: "Team & access", href: "/settings/team", keywords: "team staff logins users access levels roles invite permissions", permission: "settings.view" },
  { label: "Integrations", href: "/settings/integrations", keywords: "api key integration website sync developer catalog google calendar webhooks", permission: "api" },
  { label: "Setup", href: "/setup", keywords: "get set up checklist embed website code booking link", permission: "setup" },
];

export function matchPages(q: string, role: Role) {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return DASHBOARD_PAGES.filter(
    (p) => (!p.permission || can(role, p.permission)) && `${p.label} ${p.keywords ?? ""}`.toLowerCase().includes(term),
  ).slice(0, 5);
}
