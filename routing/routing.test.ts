import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { modeOf, rewrites, vercelConfig } from "./rules.mjs";
import { serviceFor } from "./match.mjs";

const path = rewrites({ ROUTING_MODE: "path", NEXT_PUBLIC_ROUTING_MODE: "path" });
const sub = rewrites({ ROUTING_MODE: "subdomain", NEXT_PUBLIC_ROUTING_MODE: "subdomain", NEXT_PUBLIC_ROOT_DOMAIN: "domain.com" });
const app = (rules: typeof path, pathname: string, host = "bookings-cars.vercel.app") => serviceFor(rules, pathname, host);

describe("path mode", () => {
  it("sends booking pages and their files to the booking app", () => {
    expect(app(path, "/booking")).toBe("admin"); // no business in it
    expect(app(path, "/booking/ascnd")).toBe("booking");
    expect(app(path, "/booking/ascnd/")).toBe("booking");
    expect(app(path, "/booking/ascnd/quote")).toBe("booking");
    expect(app(path, "/booking/_next/static/chunks/x.js")).toBe("booking");
  });

  it("sends everything else to the admin app", () => {
    for (const p of ["/", "/docs/api", "/legal/terms", "/app", "/app/ascnd/bookings", "/admin/new", "/_next/static/x.js"]) {
      expect(app(path, p), p).toBe("admin");
    }
  });

  it("sends a business's own domain to the booking app, and this machine to admin", () => {
    expect(app(path, "/", "book.ascnddetailing.co.uk")).toBe("booking");
    expect(app(path, "/quote", "book.ascnddetailing.co.uk")).toBe("booking");
    expect(app(path, "/api/v1/catalog", "book.ascnddetailing.co.uk")).toBe("admin");
    expect(app(path, "/app", "localhost:3000")).toBe("admin");
    expect(app(path, "/", "car-booking-git-main-x.vercel.app")).toBe("admin");
  });

  it("routes the API by path", () => {
    expect(app(path, "/api/webhooks/stripe")).toBe("booking");
    expect(app(path, "/api/webhooks/stripe-accounts")).toBe("booking");
    expect(app(path, "/api/jobs/emails")).toBe("booking");
    expect(app(path, "/api/webhooks/stripe-billing")).toBe("admin");
    expect(app(path, "/api/v1/catalog")).toBe("admin");
  });
});

describe("subdomain mode", () => {
  it("gives the root domain, www, app and admin to the admin app", () => {
    for (const host of ["domain.com", "www.domain.com", "app.domain.com", "admin.domain.com"]) {
      expect(app(sub, "/", host), host).toBe("admin");
    }
    expect(app(sub, "/ascnd/bookings", "app.domain.com")).toBe("admin");
  });

  it("gives every other host to the booking app", () => {
    expect(app(sub, "/", "ascnd.domain.com")).toBe("booking");
    expect(app(sub, "/quote", "booking.theirsite.com")).toBe("booking");
    expect(app(sub, "/", "bookings-cars-abc123.vercel.app")).toBe("booking");
  });

  it("still routes the API and old /booking links by path, whatever the host", () => {
    expect(app(sub, "/api/webhooks/stripe", "domain.com")).toBe("booking");
    expect(app(sub, "/api/jobs/emails", "bookings-cars-abc123.vercel.app")).toBe("booking");
    expect(app(sub, "/api/stripe/onboarding-link", "app.domain.com")).toBe("admin");
    expect(app(sub, "/api/v1/catalog", "ascnd.domain.com")).toBe("admin");
    expect(app(sub, "/booking/ascnd/quote", "domain.com")).toBe("booking");
  });

  it("ignores the port on hosts, for *.localhost:3000", () => {
    const local = rewrites({ ROUTING_MODE: "subdomain", NEXT_PUBLIC_ROUTING_MODE: "subdomain", NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000" });
    expect(serviceFor(local, "/", "app.localhost:3000")).toBe("admin");
    expect(serviceFor(local, "/", "localhost:3000")).toBe("admin");
    expect(serviceFor(local, "/", "ascnd.localhost:3000")).toBe("booking");
  });
});

describe("env checks", () => {
  it("refuses mismatched or incomplete settings", () => {
    expect(() => rewrites({ ROUTING_MODE: "subdomain", NEXT_PUBLIC_ROUTING_MODE: "path" })).toThrow(/same value/);
    expect(() => rewrites({ ROUTING_MODE: "subdomain", NEXT_PUBLIC_ROUTING_MODE: "subdomain" })).toThrow(/ROOT_DOMAIN/);
  });
});

describe("vercel.json", () => {
  it("is what write-vercel-json.mjs makes for the mode it was written for", () => {
    const committed = JSON.parse(readFileSync(join(__dirname, "../vercel.json"), "utf8"));
    const mode = modeOf(committed);
    const hosts = committed.rewrites
      .flatMap((r: { has?: { value: unknown }[] }) => r.has ?? [])
      .map((h: { value: unknown }) => h.value)
      .filter((v: unknown): v is string => typeof v === "string");
    const env =
      mode === "subdomain"
        ? { ROUTING_MODE: mode, NEXT_PUBLIC_ROUTING_MODE: mode, NEXT_PUBLIC_ROOT_DOMAIN: hosts[0] }
        : { ROUTING_MODE: mode, NEXT_PUBLIC_ROUTING_MODE: mode, NEXT_PUBLIC_SITE_URL: `https://${hosts[0]}` };
    expect(committed).toEqual(vercelConfig(env));
  });
});
