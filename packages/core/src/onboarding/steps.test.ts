import { describe, expect, it } from "vitest";
import { STARTER_SERVICES, weeklyHoursFor } from "../platform/rules";
import { setupProgress, setupSteps, type SetupInput, type SetupStepKey } from "./steps";

const starter = STARTER_SERVICES.map((s) => ({
  name: s.name,
  duration_mins: s.duration_mins,
  base_price_pence: s.base_price_pence,
  active: true,
}));

// A business exactly as the platform panel creates it.
const fresh: SetupInput = {
  services: starter,
  offersMobile: true,
  offersUnit: false,
  weeklyHours: weeklyHoursFor("weekdays"),
  unitWeeklyHours: null,
  basePostcode: null,
  depositType: "percent",
  stripe: "none",
  sender: "none",
  enquiries: 0,
};

const step = (input: SetupInput, key: SetupStepKey) => setupSteps(input).find((s) => s.key === key)!;

describe("setupSteps", () => {
  it("starts a freshly created business with the hours done and its booking page live", () => {
    const done = setupSteps(fresh).filter((s) => s.done).map((s) => s.key);
    expect(done).toEqual(["hours", "address"]);
  });

  it("counts services as reviewed once any active one differs from the placeholders", () => {
    const edited = { ...fresh, services: [{ ...starter[0], base_price_pence: 5500 }, starter[1]] };
    expect(step(edited, "services").done).toBe(true);
    const added = { ...fresh, services: [...starter, { ...starter[0], name: "Ceramic coating" }] };
    expect(step(added, "services").done).toBe(true);
  });

  it("ignores switched-off services when judging whether prices were reviewed", () => {
    const off = { ...fresh, services: [...starter, { ...starter[0], name: "Ceramic coating", active: false }] };
    expect(step(off, "services").done).toBe(false);
  });

  it("needs hours for each place the business works", () => {
    expect(step({ ...fresh, weeklyHours: {} }, "hours").done).toBe(false);
    // Shop hours fall back to the mobile hours when not set separately.
    const shop = { ...fresh, offersMobile: false, offersUnit: true };
    expect(step(shop, "hours").done).toBe(true);
    expect(step({ ...shop, unitWeeklyHours: {} }, "hours").done).toBe(false);
    expect(step({ ...shop, weeklyHours: {} , unitWeeklyHours: weeklyHoursFor("every_day") }, "hours").done).toBe(true);
  });

  it("treats a day with no time ranges as closed", () => {
    expect(step({ ...fresh, weeklyHours: { mon: [] } }, "hours").done).toBe(false);
  });

  it("needs a start postcode only when the van goes to customers", () => {
    expect(step(fresh, "area").done).toBe(false);
    expect(step({ ...fresh, basePostcode: "BS1 4DJ" }, "area").done).toBe(true);
    expect(step({ ...fresh, offersMobile: false, offersUnit: true }, "area").done).toBe(true);
  });

  it("makes Stripe optional when there is no deposit", () => {
    expect(step(fresh, "payments").required).toBe(true);
    expect(step({ ...fresh, depositType: "none" }, "payments").required).toBe(false);
  });

  it("separates a half-finished Stripe setup from none", () => {
    expect(step({ ...fresh, stripe: "pending" }, "payments")).toMatchObject({ done: false, state: "in_progress" });
    expect(step({ ...fresh, stripe: "connected" }, "payments")).toMatchObject({ done: true, state: undefined });
  });

  it("has the booking page live from the start", () => {
    expect(step(fresh, "address")).toMatchObject({ done: true, required: true });
    expect(step(fresh, "address").state).toBeUndefined();
  });

  it("never requires a first enquiry", () => {
    expect(step(fresh, "enquiry").required).toBe(false);
    expect(step({ ...fresh, enquiries: 1 }, "enquiry").done).toBe(true);
  });

  it("needs the business's own email address verified", () => {
    expect(step(fresh, "email")).toMatchObject({ required: true, done: false });
    expect(step({ ...fresh, sender: "pending" }, "email")).toMatchObject({ done: false, state: "in_progress" });
    expect(step({ ...fresh, sender: "verified" }, "email").done).toBe(true);
  });
});

describe("setupProgress", () => {
  it("counts only required steps", () => {
    expect(setupProgress(setupSteps(fresh))).toEqual({ doneRequired: 2, totalRequired: 6, ready: false });
    expect(setupProgress(setupSteps({ ...fresh, depositType: "none" }))).toEqual({ doneRequired: 2, totalRequired: 5, ready: false });
  });

  it("is ready when every required step is done, even without an enquiry", () => {
    const ready: SetupInput = {
      ...fresh,
      services: [{ ...starter[0], base_price_pence: 6000 }],
      basePostcode: "BS1 4DJ",
      stripe: "connected",
      sender: "verified",
    };
    expect(setupProgress(setupSteps(ready))).toEqual({ doneRequired: 6, totalRequired: 6, ready: true });
  });
});
