import { describe, expect, it } from "vitest";
import {
  bookingEventFor,
  delivered,
  isPrivateAddress,
  MAX_ATTEMPTS,
  newSigningSecret,
  nextAttemptAt,
  sign,
  verify,
  webhookUrlProblem,
} from "./rules";

const at = (status: string, startsAt = "2026-11-20T09:00:00Z") => ({ status, startsAt });
const recent = { createdRecently: true };
const old = { createdRecently: false };

describe("bookingEventFor", () => {
  it("names a new booking, and ignores holds and abandoned checkouts", () => {
    expect(bookingEventFor(null, at("confirmed"), recent)).toBe("booking.created");
    expect(bookingEventFor(null, at("requested"), recent)).toBe("booking.created");
    expect(bookingEventFor(at("held"), at("confirmed"), recent)).toBe("booking.created");
    expect(bookingEventFor(null, at("held"), recent)).toBeNull();
    expect(bookingEventFor(at("held"), at("expired"), recent)).toBeNull();
    expect(bookingEventFor(null, at("cancelled"), recent)).toBeNull();
  });

  it("names status changes", () => {
    expect(bookingEventFor(at("requested"), at("confirmed"), recent)).toBe("booking.confirmed");
    expect(bookingEventFor(at("confirmed"), at("cancelled"), recent)).toBe("booking.cancelled");
    expect(bookingEventFor(at("requested"), at("cancelled"), recent)).toBe("booking.cancelled");
    expect(bookingEventFor(at("confirmed"), at("completed"), recent)).toBe("booking.completed");
    expect(bookingEventFor(at("confirmed"), at("no_show"), recent)).toBe("booking.no_show");
    expect(bookingEventFor(at("completed"), at("confirmed"), recent)).toBe("booking.updated");
  });

  it("names a move, and anything else as an update", () => {
    expect(bookingEventFor(at("confirmed"), at("confirmed", "2026-11-21T09:00:00Z"), recent)).toBe("booking.rescheduled");
    expect(bookingEventFor(at("confirmed", "2026-11-20T09:00:00.000Z"), at("confirmed", "2026-11-20T09:00:00+00:00"), recent)).toBe(
      "booking.updated",
    );
  });

  it("names a booking from before webhooks by where it is now", () => {
    expect(bookingEventFor(null, at("cancelled"), old)).toBe("booking.cancelled");
    expect(bookingEventFor(null, at("completed"), old)).toBe("booking.completed");
    expect(bookingEventFor(null, at("confirmed"), old)).toBe("booking.updated");
    expect(bookingEventFor(null, at("held"), old)).toBeNull();
  });
});

describe("signing", () => {
  const secret = newSigningSecret(Buffer.alloc(24, 7));

  it("signs in the Standard Webhooks layout and verifies", () => {
    const sig = sign(secret, "evt_1", 1_700_000_000, '{"a":1}');
    expect(sig).toMatch(/^v1,[A-Za-z0-9+/]+=*$/);
    expect(verify(secret, "evt_1", 1_700_000_000, '{"a":1}', sig)).toBe(true);
    expect(verify(secret, "evt_1", 1_700_000_000, '{"a":2}', sig)).toBe(false);
    expect(verify(secret, "evt_1", 1_700_000_001, '{"a":1}', sig)).toBe(false);
    expect(verify(newSigningSecret(Buffer.alloc(24, 8)), "evt_1", 1_700_000_000, '{"a":1}', sig)).toBe(false);
  });

  it("accepts any of several signatures", () => {
    const sig = sign(secret, "evt_1", 1, "x");
    expect(verify(secret, "evt_1", 1, "x", `v1,bogus ${sig}`)).toBe(true);
  });
});

describe("retries", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("backs off, then gives up", () => {
    expect(nextAttemptAt(1, now)?.toISOString()).toBe("2026-11-10T12:01:00.000Z");
    expect(nextAttemptAt(6, now)?.toISOString()).toBe("2026-11-11T12:00:00.000Z");
    expect(nextAttemptAt(MAX_ATTEMPTS, now)).toBeNull();
  });
  it("counts only 2xx as delivered", () => {
    expect(delivered(200)).toBe(true);
    expect(delivered(204)).toBe(true);
    expect(delivered(301)).toBe(false);
    expect(delivered(500)).toBe(false);
    expect(delivered(null)).toBe(false);
  });
});

describe("addresses", () => {
  it("knows private addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("checks the address someone types", () => {
    const prod = { allowLocal: false };
    expect(webhookUrlProblem("https://hooks.example.com/in", prod)).toBeNull();
    expect(webhookUrlProblem("http://hooks.example.com/in", prod)).toMatch(/https/);
    expect(webhookUrlProblem("https://localhost:3000/x", prod)).toMatch(/private/);
    expect(webhookUrlProblem("https://169.254.169.254/latest", prod)).toMatch(/private/);
    expect(webhookUrlProblem("https://[::1]/x", prod)).toMatch(/private/);
    expect(webhookUrlProblem("https://server.internal/x", prod)).toMatch(/reachable/);
    expect(webhookUrlProblem("https://user:pw@example.com/x", prod)).toMatch(/username/);
    expect(webhookUrlProblem("example.com", prod)).toMatch(/full address/);
    expect(webhookUrlProblem("http://localhost:4000/hook", { allowLocal: true })).toBeNull();
  });
});
