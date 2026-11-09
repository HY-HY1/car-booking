import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, policyOf, type CancellationPolicy } from "../settings/policy";
import { blockedLine, customerOptions, refundLine, signManageToken, verifyManageToken } from "./manage-rules";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BOOKING = "33333333-3333-4333-8333-333333333333";
const START = "2026-11-10T10:00:00Z";
const hoursBefore = (h: number) => new Date(new Date(START).getTime() - h * 3_600_000);
const live = { status: "confirmed", startsAt: START, rescheduleCount: 0 };

describe("manage link", () => {
  it("opens only for its own business, and not once tampered with", async () => {
    const token = await signManageToken("secret", TENANT, BOOKING);
    expect(await verifyManageToken("secret", TENANT, token)).toBe(BOOKING);
    expect(await verifyManageToken("secret", OTHER, token)).toBeNull();
    expect(await verifyManageToken("other secret", TENANT, token)).toBeNull();
    expect(await verifyManageToken("secret", TENANT, token.replace(BOOKING, OTHER))).toBeNull();
    expect(await verifyManageToken("secret", TENANT, `${token}.x`)).toBeNull();
    expect(await verifyManageToken("secret", TENANT, "nonsense")).toBeNull();
  });
});

describe("what a customer can do", () => {
  it("cancels and moves up to each cut-off", () => {
    const policy: CancellationPolicy = { ...DEFAULT_POLICY, cutoff_hours: 48, reschedule_cutoff_hours: 24 };
    const early = customerOptions(policy, live, hoursBefore(72));
    expect(early.cancel).toEqual({ allowed: true, until: hoursBefore(48) });
    expect(early.reschedule).toEqual({ allowed: true, until: hoursBefore(24) });

    const between = customerOptions(policy, live, hoursBefore(30));
    expect(between.cancel).toEqual({ allowed: false, why: "too_late" });
    expect(between.reschedule.allowed).toBe(true);

    // Exactly at the cut-off still counts.
    expect(customerOptions(policy, live, hoursBefore(24)).reschedule.allowed).toBe(true);
    expect(customerOptions(policy, live, hoursBefore(23)).reschedule).toEqual({ allowed: false, why: "too_late" });
  });

  it("does nothing online without a policy, or when the business takes changes itself", () => {
    expect(customerOptions(null, live, hoursBefore(72)).cancel).toEqual({ allowed: false, why: "offline" });
    expect(customerOptions({ ...DEFAULT_POLICY, self_service: false }, live, hoursBefore(72)).reschedule).toEqual({
      allowed: false,
      why: "offline",
    });
  });

  it("reads policies saved before self-service existed as allowing it", () => {
    const { self_service: _, ...old } = DEFAULT_POLICY;
    expect(policyOf(old)?.self_service).toBe(true);
  });

  it("stops moving after the limit, but still allows cancelling", () => {
    const policy = { ...DEFAULT_POLICY, max_reschedules: 2 };
    const moved = customerOptions(policy, { ...live, rescheduleCount: 2 }, hoursBefore(72));
    expect(moved.reschedule).toEqual({ allowed: false, why: "limit" });
    expect(moved.cancel.allowed).toBe(true);
    expect(customerOptions(policy, { ...live, rescheduleCount: 1 }, hoursBefore(72)).reschedule.allowed).toBe(true);
  });

  it("only touches live bookings that haven't started", () => {
    expect(customerOptions(DEFAULT_POLICY, { ...live, status: "requested" }, hoursBefore(72)).cancel.allowed).toBe(true);
    expect(customerOptions(DEFAULT_POLICY, { ...live, status: "cancelled" }, hoursBefore(72)).cancel).toEqual({
      allowed: false,
      why: "closed",
    });
    expect(customerOptions(DEFAULT_POLICY, { ...live, status: "held" }, hoursBefore(72)).cancel.allowed).toBe(false);
    expect(customerOptions({ ...DEFAULT_POLICY, cutoff_hours: 0 }, live, hoursBefore(-1)).cancel).toEqual({
      allowed: false,
      why: "started",
    });
  });

  it("says why, and points to the business", () => {
    expect(blockedLine("cancel", "too_late", DEFAULT_POLICY)).toBe(
      "It's too late to cancel online (up to 24 hours before the appointment). Get in touch with the business instead.",
    );
    expect(blockedLine("reschedule", "offline", null)).toBe("To change the time, get in touch with the business.");
    expect(blockedLine("cancel", "closed", null)).toBeNull();
  });
});

describe("refund line", () => {
  it("says what the policy gives back", () => {
    expect(refundLine({ kind: "full", refundPence: 2000, reason: "" }, 2000)).toBe("Your £20 deposit will be refunded in full.");
    expect(refundLine({ kind: "partial", refundPence: 1500, reason: "" }, 2000)).toBe(
      "£15 of your £20 deposit will be refunded.",
    );
    expect(refundLine({ kind: "none", refundPence: 0, reason: "" }, 2000)).toBe(
      "Your £20 deposit isn't refundable under the cancellation policy.",
    );
    expect(refundLine(null, 0)).toBeNull();
  });
});
