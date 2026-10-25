import { describe, expect, it } from "vitest";
import { bookingSettingsSchema, depositSchema, resourceSchema, serviceAreaSchema } from "../booking/config";
import {
  bookingSettingsFor,
  brandingFor,
  newBusinessSchema,
  normalizeHostname,
  slugify,
  slugSchema,
  startingResources,
  weeklyHoursFor,
} from "./rules";

const valid = {
  name: "Shine Mobile Valeting",
  slug: "shine-mobile",
  ownerEmail: "Owner@Shine.example",
  hostname: "https://Bookings.Shine.example/",
  starterServices: true,
  addMe: true,
};

describe("slugify", () => {
  it("makes a URL-safe slug from a name", () => {
    expect(slugify("Shine Mobile Valeting")).toBe("shine-mobile-valeting");
    expect(slugify("  Bob's Café & Wash!  ")).toBe("bob-s-cafe-and-wash");
    expect(slugify("---")).toBe("");
  });

  it("always passes the slug rules, or is too short to (signup then adds a number)", () => {
    for (const name of ["Mr. Clean (Bristol) Ltd", "x".repeat(80), "Ünïcödé Détailing"]) {
      const slug = slugify(name);
      expect(slug.length).toBeLessThanOrEqual(40);
      expect(slugSchema.safeParse(slug).success).toBe(true);
    }
    expect(slugify("A")).toBe("a");
    expect(slugSchema.safeParse("a").success).toBe(false);
  });
});

describe("slugSchema", () => {
  it("rejects what the database check or a fixed page would", () => {
    for (const bad of ["", "Has Space", "-lead", "trail-", "double--hyphen", "new", "api", "platform"]) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
    expect(slugSchema.safeParse("ascnd").success).toBe(true);
    expect(slugSchema.safeParse("ASCND-2").success).toBe(true);
  });

  it("is 3 to 40 characters", () => {
    expect(slugSchema.safeParse("ab").success).toBe(false);
    expect(slugSchema.safeParse("abc").success).toBe(true);
    expect(slugSchema.safeParse("a".repeat(40)).success).toBe(true);
    expect(slugSchema.safeParse("a".repeat(41)).success).toBe(false);
  });

  it("rejects the names our subdomains and routes use", () => {
    for (const reserved of ["www", "app", "admin", "mail", "docs", "booking", "test", "demo", "signup", "account", "sites"]) {
      expect(slugSchema.safeParse(reserved).success).toBe(false);
    }
    expect(slugSchema.safeParse("test-detailing").success).toBe(true);
    expect(slugSchema.safeParse("App").success).toBe(false);
  });
});

describe("normalizeHostname", () => {
  it("reduces pasted URLs to a bare lowercase hostname", () => {
    expect(normalizeHostname("https://Bookings.Example.co.uk/quote?x=1")).toBe("bookings.example.co.uk");
    expect(normalizeHostname(" shine.localhost:3000 ")).toBe("shine.localhost");
    expect(normalizeHostname("example.co.uk.")).toBe("example.co.uk");
  });
});

describe("newBusinessSchema", () => {
  it("accepts a minimal form and fills the defaults", () => {
    const r = newBusinessSchema.parse(valid);
    expect(r.ownerEmail).toBe("owner@shine.example");
    expect(r.hostname).toBe("bookings.shine.example");
    expect(r.hours).toBe("weekdays");
    expect(r.depositPercent).toBe(25);
    expect(r.primaryColor).toBe("#18181b");
  });

  it("accepts a localhost hostname for development", () => {
    expect(newBusinessSchema.safeParse({ ...valid, hostname: "shine.localhost" }).success).toBe(true);
  });

  it("rejects bad input with a message per field", () => {
    const bad = newBusinessSchema.safeParse({
      ...valid,
      name: " ",
      ownerEmail: "nope",
      hostname: "not a host",
      basePostcode: "XYZ",
      depositPercent: 150,
      primaryColor: "red",
    });
    expect(bad.success).toBe(false);
    const fields = new Set(bad.error?.issues.map((i) => String(i.path[0])));
    for (const f of ["name", "ownerEmail", "hostname", "basePostcode", "depositPercent", "primaryColor"]) {
      expect(fields.has(f)).toBe(true);
    }
  });

  it("treats a blank postcode as not given and tidies a real one", () => {
    expect(newBusinessSchema.parse({ ...valid, basePostcode: "" }).basePostcode).toBeUndefined();
    expect(newBusinessSchema.parse({ ...valid, basePostcode: "bs14dj" }).basePostcode).toBe("BS1 4DJ");
  });
});

describe("what a new business is created with", () => {
  const input = newBusinessSchema.parse({ ...valid, basePostcode: "BS1 4DJ", radiusMiles: "15", depositPercent: "30" });

  it("builds booking settings the engine accepts", () => {
    const row = {
      tenant_id: "5f0c1c46-6b6a-4f7b-9d57-2d3f1b8e9a10",
      timezone: "Europe/London",
      slot_interval_mins: 30,
      min_notice_hours: 24,
      max_days_ahead: 60,
      travel_buffer_mins: 30,
      hold_minutes: 15,
      unit_address: null,
      unit_postcode: null,
      unit_weekly_hours: null,
      unit_buffer_mins: 0,
      min_price_pence: 0,
      mobile_surcharge_pence: 0,
      condition_tiers: [],
      ...bookingSettingsFor(input),
    };
    expect(bookingSettingsSchema.safeParse(row).success).toBe(true);
    expect(row.service_area).toEqual({ radius_miles: 15 });
    expect(row.deposit).toEqual({ type: "percent", value: 30 });
  });

  it("starts with one van, to be added to under Settings → Booking", () => {
    const [van, ...rest] = startingResources();
    expect(rest).toEqual([]);
    expect(resourceSchema.safeParse({ ...van, id: "5f0c1c46-6b6a-4f7b-9d57-2d3f1b8e9a10", weekly_hours: null }).success).toBe(true);
    expect(van.location_types).toEqual(["mobile"]);
  });

  it("starts a unit with a bay and both with a van and a bay", () => {
    const names = (l: "mobile" | "unit" | "both") => startingResources(l).map((r) => [r.name, r.location_types, r.sort_order]);
    expect(names("unit")).toEqual([["Bay", ["unit"], 0]]);
    expect(names("both")).toEqual([["Van", ["mobile"], 0], ["Bay", ["unit"], 1]]);
  });

  it("offers what the business does, and needs a unit postcode for a unit", () => {
    const mobile = bookingSettingsFor(newBusinessSchema.parse(valid));
    expect(mobile).toMatchObject({ offers_mobile: true, offers_unit: false });
    expect(mobile).not.toHaveProperty("unit_postcode");

    const both = newBusinessSchema.parse({ ...valid, locations: "both", basePostcode: "BS1 4DJ", unitPostcode: "bs16 1ab" });
    expect(bookingSettingsFor(both)).toMatchObject({ offers_mobile: true, offers_unit: true, unit_postcode: "BS16 1AB" });

    const unit = newBusinessSchema.parse({ ...valid, locations: "unit", unitPostcode: "BS16 1AB" });
    expect(bookingSettingsFor(unit)).toMatchObject({ offers_mobile: false, offers_unit: true });

    const missing = newBusinessSchema.safeParse({ ...valid, locations: "unit" });
    expect(missing.success ? null : missing.error.issues[0]).toMatchObject({ path: ["unitPostcode"], message: "Enter the postcode of your unit." });
  });

  it("serves anywhere without a base postcode, and takes no deposit at 0%", () => {
    const open = bookingSettingsFor(newBusinessSchema.parse({ ...valid, radiusMiles: "15", depositPercent: "0" }));
    expect(open.service_area).toEqual({});
    expect(serviceAreaSchema.safeParse(open.service_area).success).toBe(true);
    expect(open.deposit).toEqual({ type: "none" });
    expect(depositSchema.safeParse(open.deposit).success).toBe(true);
  });

  it("has hours for each preset", () => {
    expect(Object.keys(weeklyHoursFor("weekdays"))).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(weeklyHoursFor("weekdays_sat").sat).toEqual([["09:00", "15:00"]]);
    expect(Object.keys(weeklyHoursFor("every_day"))).toHaveLength(7);
    expect(weeklyHoursFor("none")).toEqual({});
  });

  it("brands with the chosen colours and an optional tagline", () => {
    expect(brandingFor(input)).toEqual({ primary_color: "#18181b", accent_color: "#3b82f6" });
    expect(brandingFor({ ...input, tagline: "We come to you" }).tagline).toBe("We come to you");
  });
});
