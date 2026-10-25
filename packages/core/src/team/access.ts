import { z } from "zod";

// Access levels for the people who log in to a business. Every dashboard page
// and action asks can(role, permission); the database enforces the same
// lines where it can (supabase/migrations/20261027120000_team_access.sql).
// No database access, so client components and tests can use it.

export const ROLES = {
  owner: {
    label: "Owner",
    detail: "Everything, including billing, who has access, Stripe and closing the account.",
  },
  manager: {
    label: "Manager",
    detail: "Runs the business day to day: bookings, customers, prices, settings, payments and refunds. Can't change billing or who has access.",
  },
  staff: {
    label: "Office",
    detail: "Takes and manages bookings, the diary, customers and enquiries. Can see settings and prices but not change them, and can't see money.",
  },
  technician: {
    label: "Technician",
    detail: "The diary and the jobs: sees what's booked and marks jobs done. No customer list, enquiries, money or settings.",
  },
} as const;

export type Role = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as Role[];
export const roleSchema = z.enum(ROLE_KEYS as [Role, ...Role[]], "Pick an access level.");

const ALL: Role[] = ["owner", "manager", "staff", "technician"];
const OFFICE: Role[] = ["owner", "manager", "staff"];
const MANAGEMENT: Role[] = ["owner", "manager"];
const OWNER: Role[] = ["owner"];

export const PERMISSIONS = {
  // The diary, bookings and marking jobs done.
  "diary.view": ALL,
  "jobs.update": ALL,
  // Approving, declining, cancelling and putting back bookings.
  "bookings.manage": OFFICE,
  "customers.view": OFFICE,
  "leads.view": OFFICE,
  "pricing.view": OFFICE,
  "settings.view": OFFICE,
  // Erasing customers, deleting photos, exporting one customer's data.
  "customers.delete": MANAGEMENT,
  "pricing.edit": MANAGEMENT,
  "settings.edit": MANAGEMENT,
  "staff.edit": MANAGEMENT,
  // Income, the Payments pages, payment links and refunds.
  money: MANAGEMENT,
  setup: MANAGEMENT,
  billing: OWNER,
  "team.manage": OWNER,
  "stripe.connect": OWNER,
  api: OWNER,
  // The whole business's data in one file, and closing the account.
  "data.export": OWNER,
  "account.close": OWNER,
} as const satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in ROLES;
}

export function can(role: Role | string | null | undefined, permission: Permission) {
  return isRole(role) && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

// What each level can do, for the Team page.
export const ROLE_SUMMARY: { label: string; permission: Permission }[] = [
  { label: "Diary and jobs", permission: "diary.view" },
  { label: "Approve and cancel bookings", permission: "bookings.manage" },
  { label: "Customers and enquiries", permission: "customers.view" },
  { label: "Change prices and settings", permission: "settings.edit" },
  { label: "Payments, income and refunds", permission: "money" },
  { label: "Billing", permission: "billing" },
  { label: "Logins and access levels", permission: "team.manage" },
];

// Changing who has access: the business must always keep an owner.
export function wouldLeaveNoOwner(
  members: { userId: string; role: string }[],
  change: { userId: string; newRole: Role | null },
) {
  const owners = members.filter((m) => m.role === "owner" && m.userId !== change.userId).length;
  return owners === 0 && change.newRole !== "owner";
}
