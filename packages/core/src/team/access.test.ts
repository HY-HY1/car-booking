import { describe, expect, it } from "vitest";
import { can, isRole, PERMISSIONS, ROLE_KEYS, wouldLeaveNoOwner } from "./access";

describe("access levels", () => {
  it("gives owners everything", () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can("owner", p)).toBe(true);
  });

  it("keeps billing, logins, Stripe, API keys and closing the account for owners", () => {
    for (const p of ["billing", "team.manage", "stripe.connect", "api", "data.export", "account.close"] as const) {
      expect(can("manager", p)).toBe(false);
      expect(can("staff", p)).toBe(false);
      expect(can("technician", p)).toBe(false);
    }
  });

  it("lets managers run the business", () => {
    for (const p of ["settings.edit", "pricing.edit", "money", "customers.delete", "bookings.manage"] as const) {
      expect(can("manager", p)).toBe(true);
    }
  });

  it("gives the office bookings and customers but not money or editing", () => {
    expect(can("staff", "customers.view")).toBe(true);
    expect(can("staff", "leads.view")).toBe(true);
    expect(can("staff", "bookings.manage")).toBe(true);
    expect(can("staff", "settings.view")).toBe(true);
    expect(can("staff", "settings.edit")).toBe(false);
    expect(can("staff", "money")).toBe(false);
  });

  it("limits technicians to the diary and their jobs", () => {
    const allowed = (Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]).filter((p) => can("technician", p));
    expect(allowed.sort()).toEqual(["diary.view", "jobs.update"]);
  });

  it("refuses unknown roles", () => {
    expect(can("admin", "diary.view")).toBe(false);
    expect(can(null, "diary.view")).toBe(false);
    expect(isRole("technician")).toBe(true);
    expect(ROLE_KEYS).toEqual(["owner", "manager", "staff", "technician"]);
  });
});

describe("keeping an owner", () => {
  const team = [
    { userId: "a", role: "owner" },
    { userId: "b", role: "manager" },
  ];

  it("won't demote or remove the only owner", () => {
    expect(wouldLeaveNoOwner(team, { userId: "a", newRole: "manager" })).toBe(true);
    expect(wouldLeaveNoOwner(team, { userId: "a", newRole: null })).toBe(true);
  });

  it("allows it once there's another owner", () => {
    const two = [...team, { userId: "c", role: "owner" }];
    expect(wouldLeaveNoOwner(two, { userId: "a", newRole: null })).toBe(false);
    expect(wouldLeaveNoOwner(team, { userId: "b", newRole: "owner" })).toBe(false);
    expect(wouldLeaveNoOwner(team, { userId: "b", newRole: null })).toBe(false);
  });
});
