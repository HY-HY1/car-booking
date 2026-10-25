import { describe, expect, it } from "vitest";
import {
  bookingRulesFormSchema,
  hoursFormSchema,
  locationsFormSchema,
  parseHours,
  resourceFormSchema,
} from "./settings-rules";

const issue = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? null : { path: String(r.error!.issues[0].path[0]), message: r.error!.issues[0].message };

describe("locationsFormSchema", () => {
  const base = {
    offers_mobile: "on",
    base_postcode: "bs14dj",
    area_type: "radius",
    radius_miles: "15",
    districts: "",
    unit_address: "",
    unit_postcode: "",
  };

  it("takes a mobile business with a radius", () => {
    const out = locationsFormSchema.parse(base);
    expect(out).toMatchObject({
      offers_mobile: true,
      offers_unit: false,
      base_postcode: "BS1 4DJ",
      service_area: { radius_miles: 15 },
      unit_address: null,
      unit_postcode: null,
    });
  });

  it("needs somewhere to work", () => {
    expect(issue(locationsFormSchema.safeParse({ ...base, offers_mobile: undefined }))?.path).toBe("offers_mobile");
  });

  it("measures a radius from the base, so needs one", () => {
    expect(issue(locationsFormSchema.safeParse({ ...base, base_postcode: "" }))?.path).toBe("base_postcode");
    expect(issue(locationsFormSchema.safeParse({ ...base, radius_miles: "far" }))?.path).toBe("radius_miles");
  });

  it("reads postcode districts however they're separated", () => {
    const out = locationsFormSchema.parse({ ...base, area_type: "districts", districts: "bs1, BS16  bs1;bs2" });
    expect(out.service_area).toEqual({ districts: ["BS1", "BS16", "BS2"] });
    expect(issue(locationsFormSchema.safeParse({ ...base, area_type: "districts", districts: "Bristol" }))?.path).toBe(
      "districts",
    );
    expect(issue(locationsFormSchema.safeParse({ ...base, area_type: "districts", districts: "" }))?.path).toBe("districts");
  });

  it("serves anywhere when asked", () => {
    expect(locationsFormSchema.parse({ ...base, area_type: "anywhere", base_postcode: "" }).service_area).toEqual({});
  });

  it("needs a shop address and postcode when the shop is on", () => {
    const shop = { ...base, offers_unit: "on" };
    expect(issue(locationsFormSchema.safeParse(shop))?.path).toBe("unit_address");
    expect(issue(locationsFormSchema.safeParse({ ...shop, unit_address: "Unit 4" }))?.path).toBe("unit_postcode");
    const ok = locationsFormSchema.parse({ ...shop, unit_address: "Unit 4, Trade Park", unit_postcode: "bs2 0aa" });
    expect(ok).toMatchObject({ offers_unit: true, unit_address: "Unit 4, Trade Park", unit_postcode: "BS2 0AA" });
  });

  it("takes a shop-only business with no mobile area to fill in", () => {
    const out = locationsFormSchema.parse({
      offers_mobile: undefined,
      offers_unit: "on",
      base_postcode: "",
      area_type: "radius",
      radius_miles: "",
      districts: "",
      unit_address: "Unit 4",
      unit_postcode: "BS2 0AA",
    });
    expect(out).toMatchObject({ offers_mobile: false, offers_unit: true, service_area: {} });
  });
});

describe("opening hours", () => {
  it("sorts windows and drops empty days", () => {
    const parsed = parseHours(JSON.stringify({ mon: [["13:00", "17:00"], ["08:00", "12:00"]], tue: [] }));
    expect(parsed).toEqual({ hours: { mon: [["08:00", "12:00"], ["13:00", "17:00"]] } });
  });

  it("refuses overlaps, backwards times and rubbish", () => {
    expect(parseHours(JSON.stringify({ wed: [["08:00", "12:00"], ["11:00", "15:00"]] }))).toEqual({
      error: "Wednesday's opening times overlap.",
    });
    expect(parseHours(JSON.stringify({ mon: [["17:00", "08:00"]] }))).toHaveProperty("error");
    expect(parseHours("not json")).toHaveProperty("error");
  });

  it("keeps shop hours only when they differ", () => {
    const mobile = JSON.stringify({ mon: [["08:00", "17:00"]] });
    const shop = JSON.stringify({ sat: [["09:00", "13:00"]] });
    expect(hoursFormSchema.parse({ mobile_hours: mobile, shop_hours: shop })).toEqual({
      weekly_hours: { mon: [["08:00", "17:00"]] },
      unit_weekly_hours: null,
    });
    expect(hoursFormSchema.parse({ mobile_hours: mobile, shop_different: "on", shop_hours: shop })).toEqual({
      weekly_hours: { mon: [["08:00", "17:00"]] },
      unit_weekly_hours: { sat: [["09:00", "13:00"]] },
    });
    expect(issue(hoursFormSchema.safeParse({ mobile_hours: mobile, shop_different: "on", shop_hours: "{" }))?.path).toBe(
      "shop_hours",
    );
  });
});

describe("bookingRulesFormSchema", () => {
  const ok = {
    slot_interval_mins: "30",
    min_notice_hours: "24",
    max_days_ahead: "60",
    travel_buffer_mins: "30",
    unit_buffer_mins: "0",
    hold_minutes: "15",
  };
  it("reads whole numbers", () => {
    expect(bookingRulesFormSchema.parse(ok)).toEqual({
      slot_interval_mins: 30,
      min_notice_hours: 24,
      max_days_ahead: 60,
      travel_buffer_mins: 30,
      unit_buffer_mins: 0,
      hold_minutes: 15,
    });
  });
  it("keeps each within what the database allows", () => {
    expect(issue(bookingRulesFormSchema.safeParse({ ...ok, slot_interval_mins: "3" }))?.path).toBe("slot_interval_mins");
    expect(issue(bookingRulesFormSchema.safeParse({ ...ok, max_days_ahead: "0" }))?.path).toBe("max_days_ahead");
    expect(issue(bookingRulesFormSchema.safeParse({ ...ok, hold_minutes: "200" }))?.path).toBe("hold_minutes");
    expect(issue(bookingRulesFormSchema.safeParse({ ...ok, travel_buffer_mins: "-5" }))?.path).toBe("travel_buffer_mins");
  });
});

describe("resourceFormSchema", () => {
  const van = { name: " Van 2 ", location_mobile: "on", hours: "{}", sort_order: "" };

  it("builds a van that follows the business hours", () => {
    expect(resourceFormSchema.parse({ ...van, active: "on" })).toEqual({
      name: "Van 2",
      location_types: ["mobile"],
      weekly_hours: null,
      active: true,
      sort_order: undefined,
    });
  });

  it("can work both places, with its own hours", () => {
    const out = resourceFormSchema.parse({
      ...van,
      location_unit: "on",
      custom_hours: "on",
      hours: JSON.stringify({ fri: [["09:00", "17:00"]] }),
      sort_order: "3",
    });
    expect(out).toMatchObject({
      location_types: ["mobile", "unit"],
      weekly_hours: { fri: [["09:00", "17:00"]] },
      active: false,
      sort_order: 3,
    });
  });

  it("needs a name, a place to work and, if it has its own hours, some", () => {
    expect(issue(resourceFormSchema.safeParse({ ...van, name: " " }))?.path).toBe("name");
    expect(issue(resourceFormSchema.safeParse({ ...van, location_mobile: undefined }))?.path).toBe("location_mobile");
    expect(issue(resourceFormSchema.safeParse({ ...van, custom_hours: "on" }))?.path).toBe("hours");
  });
});
