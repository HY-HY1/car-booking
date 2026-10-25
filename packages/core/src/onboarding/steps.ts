import type { WeeklyHours } from "../booking/config";
import { STARTER_SERVICES } from "../platform/rules";

// The checklist a new business works through before it takes real bookings.
// Nothing is stored: each step is worked out from what the business has set
// up, so it ticks itself off as the owner fills things in, and a step that
// was done and later undone comes back.

export type SetupInput = {
  services: { name: string; duration_mins: number; base_price_pence: number; active: boolean }[];
  offersMobile: boolean;
  offersUnit: boolean;
  weeklyHours: WeeklyHours;
  // null = the shop follows the mobile hours.
  unitWeeklyHours: WeeklyHours | null;
  basePostcode: string | null;
  depositType: "none" | "percent" | "fixed" | "full";
  stripe: "connected" | "pending" | "none";
  // Confirmed or completed bookings, plus leads.
  enquiries: number;
};

export type SetupStepKey = "services" | "hours" | "area" | "payments" | "address" | "enquiry";

export type SetupStep = {
  key: SetupStepKey;
  done: boolean;
  // Optional steps are shown but don't hold up "ready to go".
  required: boolean;
  // Only set when the step is under way but not finished, or blocked on us.
  state?: "in_progress" | "waiting_on_us";
};

const hasHours = (h: WeeklyHours | null) => Object.values(h ?? {}).some((ranges) => ranges && ranges.length > 0);

// The placeholders every business is created with. Seeing only these means
// the owner hasn't looked at their prices yet.
function isStarterService(s: SetupInput["services"][number]) {
  return STARTER_SERVICES.some(
    (p) => p.name === s.name && p.base_price_pence === s.base_price_pence && p.duration_mins === s.duration_mins,
  );
}

export function setupSteps(input: SetupInput): SetupStep[] {
  const active = input.services.filter((s) => s.active);
  const reviewed = active.some((s) => !isStarterService(s));

  const mobileHoursOk = !input.offersMobile || hasHours(input.weeklyHours);
  const unitHoursOk = !input.offersUnit || hasHours(input.unitWeeklyHours ?? input.weeklyHours);

  return [
    { key: "services", required: true, done: reviewed },
    { key: "hours", required: true, done: mobileHoursOk && unitHoursOk },
    // A shop's postcode is required by the database, so only the van's start
    // point can be missing.
    { key: "area", required: true, done: !input.offersMobile || Boolean(input.basePostcode) },
    {
      key: "payments",
      // With no deposit there's nothing to collect online.
      required: input.depositType !== "none",
      done: input.stripe === "connected",
      state: input.stripe === "pending" ? "in_progress" : undefined,
    },
    // A business's booking pages work from the moment it exists, at its
    // slug's address (/booking/<slug> or <slug>.domain.com), so this one is
    // there to say where rather than to wait on anything.
    { key: "address", required: true, done: true },
    { key: "enquiry", required: false, done: input.enquiries > 0 },
  ];
}

export function setupProgress(steps: SetupStep[]) {
  const required = steps.filter((s) => s.required);
  const doneRequired = required.filter((s) => s.done).length;
  return {
    doneRequired,
    totalRequired: required.length,
    ready: doneRequired === required.length,
  };
}
