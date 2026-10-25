import { afterEach, describe, expect, it, vi } from "vitest";
import { isReservedSlug } from "./reserved-slugs";
import {
  adminUrl,
  apiUrl,
  appPathOf,
  appUrl,
  docsUrl,
  marketingUrl,
  parseBookingPath,
  routingConfig,
  surfaceForHost,
  tenantUrl,
} from "./urls";

function mode(env: { mode?: string; root?: string; site?: string }) {
  vi.stubEnv("NEXT_PUBLIC_ROUTING_MODE", env.mode ?? "");
  vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", env.root ?? "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", env.site ?? "");
}

afterEach(() => vi.unstubAllEnvs());

describe("path mode", () => {
  it("is the default", () => {
    mode({});
    expect(routingConfig()).toEqual({ mode: "path", rootDomain: "localhost:3000", siteUrl: "http://localhost:3000" });
  });

  it("builds site-relative paths", () => {
    mode({ mode: "path" });
    expect(tenantUrl("ascnd", "/confirm")).toBe("/booking/ascnd/confirm");
    expect(tenantUrl("ascnd")).toBe("/booking/ascnd");
    expect(appUrl()).toBe("/app");
    expect(appUrl("/ascnd/bookings")).toBe("/app/ascnd/bookings");
    expect(adminUrl("/new")).toBe("/admin/new");
    expect(marketingUrl()).toBe("/");
    expect(marketingUrl("/docs/api")).toBe("/docs/api");
  });

  it("makes them absolute on the site's address when asked", () => {
    mode({ mode: "path", site: "https://bookings-cars.vercel.app/" });
    expect(tenantUrl("ascnd", "/confirmed/1", { absolute: true })).toBe("https://bookings-cars.vercel.app/booking/ascnd/confirmed/1");
    expect(appUrl("/ascnd", { absolute: true })).toBe("https://bookings-cars.vercel.app/app/ascnd");
    expect(adminUrl("", { absolute: true })).toBe("https://bookings-cars.vercel.app/admin");
    expect(marketingUrl("/", { absolute: true })).toBe("https://bookings-cars.vercel.app");
  });

  it("ignores custom domains: everything shares one origin", () => {
    mode({ mode: "path" });
    expect(tenantUrl("ascnd", "/quote", { customDomain: "booking.theirsite.com" })).toBe("/booking/ascnd/quote");
  });
});

describe("subdomain mode", () => {
  it("puts each surface on its own host", () => {
    mode({ mode: "subdomain", root: "domain.com", site: "https://domain.com" });
    expect(tenantUrl("ascnd", "/confirm")).toBe("https://ascnd.domain.com/confirm");
    expect(appUrl("/ascnd/bookings")).toBe("https://app.domain.com/ascnd/bookings");
    expect(adminUrl("/new")).toBe("https://admin.domain.com/new");
    expect(marketingUrl("/docs")).toBe("https://domain.com/docs");
    expect(appUrl()).toBe("https://app.domain.com");
    expect(marketingUrl()).toBe("https://domain.com");
  });

  it("returns full URLs even without absolute, since every surface is cross-origin", () => {
    mode({ mode: "subdomain", root: "domain.com", site: "https://domain.com" });
    expect(tenantUrl("ascnd", "/quote", { absolute: false })).toBe("https://ascnd.domain.com/quote");
  });

  it("prefers a verified custom domain for booking pages", () => {
    mode({ mode: "subdomain", root: "domain.com", site: "https://domain.com" });
    expect(tenantUrl("ascnd", "/confirm", { customDomain: "booking.theirsite.com" })).toBe("https://booking.theirsite.com/confirm");
    expect(tenantUrl("ascnd", "/", { customDomain: "Booking.TheirSite.com." })).toBe("https://booking.theirsite.com");
    expect(tenantUrl("ascnd", "/", { customDomain: null })).toBe("https://ascnd.domain.com");
  });

  it("works on *.localhost in development, with http and the port", () => {
    mode({ mode: "subdomain", root: "localhost:3000", site: "http://localhost:3000" });
    expect(tenantUrl("ascnd", "/quote")).toBe("http://ascnd.localhost:3000/quote");
    expect(appUrl("/login")).toBe("http://app.localhost:3000/login");
    expect(adminUrl()).toBe("http://admin.localhost:3000");
    expect(marketingUrl("/docs")).toBe("http://localhost:3000/docs");
    expect(tenantUrl("ascnd", "/", { customDomain: "book.shine.localhost" })).toBe("http://book.shine.localhost:3000");
  });
});

describe("paths", () => {
  it("tidies slashes", () => {
    mode({ mode: "path" });
    expect(tenantUrl("ascnd", "confirm/")).toBe("/booking/ascnd/confirm");
    expect(appUrl("//ascnd//bookings/")).toBe("/app/ascnd/bookings");
    expect(marketingUrl("")).toBe("/");
  });

  it("never turns a path into a protocol-relative URL", () => {
    mode({ mode: "path" });
    expect(marketingUrl("//evil.com/x")).toBe("/evil.com/x");
    mode({ mode: "subdomain", root: "domain.com", site: "https://domain.com" });
    expect(appUrl("//evil.com")).toBe("https://app.domain.com/evil.com");
  });

  it("keeps query strings and fragments", () => {
    mode({ mode: "path" });
    expect(tenantUrl("ascnd", "/quote?embed=1")).toBe("/booking/ascnd/quote?embed=1");
    expect(tenantUrl("ascnd", "/quote/?embed=1#top")).toBe("/booking/ascnd/quote?embed=1#top");
    expect(appUrl("?tenant=ascnd")).toBe("/app?tenant=ascnd");
    expect(marketingUrl("?ref=x")).toBe("/?ref=x");
    expect(appUrl("/login?next=/app/ascnd//x")).toBe("/app/login?next=/app/ascnd//x");
    mode({ mode: "subdomain", root: "domain.com", site: "https://domain.com" });
    expect(appUrl("?tenant=ascnd")).toBe("https://app.domain.com/?tenant=ascnd");
    expect(tenantUrl("ascnd", "/unsubscribe?t=a.b.c")).toBe("https://ascnd.domain.com/unsubscribe?t=a.b.c");
  });
});

describe("docs, API and dashboard paths", () => {
  it("puts the docs under /docs on the marketing site", () => {
    mode({ mode: "path" });
    expect(docsUrl()).toBe("/docs");
    expect(docsUrl("/api/keys")).toBe("/docs/api/keys");
    expect(docsUrl("/dashboard#roles")).toBe("/docs/dashboard#roles");
    mode({ mode: "subdomain", root: "domain.com", site: "https://domain.com" });
    expect(docsUrl("/pricing")).toBe("https://domain.com/docs/pricing");
  });

  it("serves the API on the site in path mode and the dashboard's host in subdomain mode", () => {
    mode({ mode: "path", site: "https://bookings-cars.vercel.app" });
    expect(apiUrl("/v1/catalog")).toBe("/api/v1/catalog");
    expect(apiUrl("/stripe/onboarding-link?tenant=ascnd", { absolute: true })).toBe(
      "https://bookings-cars.vercel.app/api/stripe/onboarding-link?tenant=ascnd",
    );
    mode({ mode: "subdomain", root: "domain.com", site: "https://domain.com" });
    expect(apiUrl("/v1/catalog")).toBe("https://app.domain.com/api/v1/catalog");
  });

  it("reads a dashboard path the same from either side of the rewrite", () => {
    expect(appPathOf("/app/ascnd/bookings")).toBe("/ascnd/bookings");
    expect(appPathOf("/ascnd/bookings")).toBe("/ascnd/bookings");
    expect(appPathOf("/app")).toBe("/");
    expect(appPathOf("/apple")).toBe("/apple");
  });
});

describe("surfaceForHost", () => {
  const cfg = { mode: "subdomain" as const, rootDomain: "domain.com", siteUrl: "https://domain.com" };

  it("knows our own hosts", () => {
    expect(surfaceForHost("domain.com", cfg)).toEqual({ surface: "marketing" });
    expect(surfaceForHost("www.domain.com", cfg)).toEqual({ surface: "marketing" });
    expect(surfaceForHost("app.domain.com", cfg)).toEqual({ surface: "app" });
    expect(surfaceForHost("ADMIN.domain.com", cfg)).toEqual({ surface: "admin" });
    expect(surfaceForHost("ascnd.domain.com", cfg)).toEqual({ surface: "tenant", slug: "ascnd" });
  });

  it("treats everything else as a custom domain to look up", () => {
    expect(surfaceForHost("booking.theirsite.com", cfg)).toEqual({ surface: "custom", hostname: "booking.theirsite.com" });
    expect(surfaceForHost("a.b.domain.com", cfg)).toEqual({ surface: "custom", hostname: "a.b.domain.com" });
    expect(surfaceForHost("notdomain.com", cfg)).toEqual({ surface: "custom", hostname: "notdomain.com" });
  });

  it("ignores ports, for *.localhost in development", () => {
    const local = { mode: "subdomain" as const, rootDomain: "localhost:3000", siteUrl: "http://localhost:3000" };
    expect(surfaceForHost("localhost:3000", local)).toEqual({ surface: "marketing" });
    expect(surfaceForHost("app.localhost:3000", local)).toEqual({ surface: "app" });
    expect(surfaceForHost("ascnd.localhost:3000", local)).toEqual({ surface: "tenant", slug: "ascnd" });
  });
});

describe("parseBookingPath", () => {
  it("reads the slug and the rest of the path", () => {
    expect(parseBookingPath("/booking/ascnd/quote")).toEqual({ slug: "ascnd", rest: "/quote" });
    expect(parseBookingPath("/booking/ascnd")).toEqual({ slug: "ascnd", rest: "/" });
    expect(parseBookingPath("/booking/test-detailing/services/full-valet")).toEqual({
      slug: "test-detailing",
      rest: "/services/full-valet",
    });
  });

  it("is null for anything that isn't a business's page", () => {
    expect(parseBookingPath("/booking")).toBeNull();
    expect(parseBookingPath("/booking/")).toBeNull();
    expect(parseBookingPath("/booking/_next/static/x.js")).toBeNull();
    expect(parseBookingPath("/booking/ASCND")).toBeNull();
    expect(parseBookingPath("/app/ascnd")).toBeNull();
  });
});

describe("reserved slugs", () => {
  it("covers our subdomains and route names", () => {
    for (const slug of ["www", "app", "admin", "api", "booking", "login", "signup", "account", "new"]) {
      expect(isReservedSlug(slug)).toBe(true);
    }
    expect(isReservedSlug("ascnd")).toBe(false);
  });
});
