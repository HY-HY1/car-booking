import {
  addOnFitsService,
  extraCarMins,
  type AddOn,
  type BookingSettings,
  type LocationType,
  type Service,
  type SizeClass,
} from "./config";

// get_quote: the only place prices are worked out. The booking form, the
// Booking Agent and the dashboard all call this, so a price is the same
// whoever asks. No database access; the caller passes in the tenant's rows.

export type TravelFee = { free_miles: number; pence_per_mile: number };

export type PricingSettings = Pick<
  BookingSettings,
  | "offers_mobile"
  | "offers_unit"
  | "deposit"
  | "min_price_pence"
  | "mobile_surcharge_pence"
  | "condition_tiers"
> & { travel_fee?: TravelFee | null };

// Another car on the same visit, with its own service, size and extras.
export type ExtraCarInput = { service: Service; sizeClass: SizeClass; addOnIds: string[] };

export type QuoteInput = {
  service: Service;
  // Every add-on the tenant offers; selection is by addOnIds.
  addOns: AddOn[];
  addOnIds: string[];
  sizeClass: SizeClass;
  // From the photo check (condition.ts), never chosen by the customer.
  conditionKey?: string | null;
  locationType: LocationType;
  // How far the job is from the business, when it's known and matters.
  travelMiles?: number | null;
  settings: PricingSettings;
  // More cars done on the same visit, after the first (config.ts multiCarOf).
  extraCars?: ExtraCarInput[];
  // Time saved on each extra car, as setting up and packing away happen once.
  setupMins?: number;
};

export type QuoteLine = { label: string; amount_pence: number };

// One extra car in a quote: what it costs and the time it adds to the visit.
export type QuoteExtraCar = {
  service_id: string;
  service_name: string;
  size_class: SizeClass;
  add_on_ids: string[];
  price_pence: number;
  // Its own time, as if it were booked alone, and the time it adds here.
  own_mins: number;
  added_mins: number;
};

export type Quote = {
  service_id: string;
  service_name: string;
  size_class: SizeClass;
  condition_key: string | null;
  location_type: LocationType;
  add_on_ids: string[];
  lines: QuoteLine[];
  total_pence: number;
  deposit_pence: number;
  duration_mins: number;
  // The owner must confirm the price before the job goes ahead.
  needs_inspection: boolean;
  // Cars after the first, done on the same visit. Their lines are in `lines`
  // and their time in `duration_mins`. Missing on older quotes.
  extra_cars?: QuoteExtraCar[];
};

export class QuoteError extends Error {
  constructor(
    public code:
      | "location_not_offered"
      | "unknown_condition"
      | "unknown_add_on"
      | "add_on_not_for_service",
    message: string,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

const SIZE_LABELS: Record<SizeClass, string> = {
  small: "Small vehicle",
  medium: "Medium vehicle",
  large: "Large vehicle",
  xl: "XL vehicle",
};

// Condition surcharges are rounded to whole pounds so quotes look like
// prices a detailer would say, not £161.37.
function roundToPound(pence: number) {
  return Math.round(pence / 100) * 100;
}

// Whole miles past the free distance, rounded up. Null when nothing's due.
export function travelFeeFor(fee: TravelFee | null | undefined, miles: number | null | undefined) {
  if (!fee || !fee.pence_per_mile || miles === null || miles === undefined) return null;
  const charged = Math.ceil(Math.max(miles - fee.free_miles, 0));
  return charged > 0 ? { miles: charged, pence: charged * fee.pence_per_mile } : null;
}

// One car's service, size, condition and extras: its lines and its time.
// Anything charged once per visit (call-out, travel, minimum) isn't in here.
function priceCar(input: {
  service: Service;
  addOns: AddOn[];
  addOnIds: string[];
  sizeClass: SizeClass;
  conditionKey?: string | null;
  locationType: LocationType;
  settings: PricingSettings;
  // "Car 2: " and so on for extra cars; nothing for the first.
  prefix: string;
}) {
  const { service, sizeClass, locationType, settings, prefix } = input;
  const offered =
    service.location_types.includes(locationType) &&
    (locationType === "mobile" ? settings.offers_mobile : settings.offers_unit);
  if (!offered) {
    throw new QuoteError(
      "location_not_offered",
      locationType === "mobile"
        ? `${service.name} isn't available at your address.`
        : `${service.name} isn't available at the unit.`,
    );
  }

  const lines: QuoteLine[] = [{ label: `${prefix}${service.name}`, amount_pence: service.base_price_pence }];
  let duration = service.duration_mins;

  const size = service.size_adjustments[sizeClass];
  if (size?.price_pence) lines.push({ label: `${prefix}${SIZE_LABELS[sizeClass]}`, amount_pence: size.price_pence });
  duration += size?.extra_mins ?? 0;

  // Condition scales the service itself (a heavy job takes longer whatever
  // extras are added), not the add-ons.
  let needsInspection = false;
  let conditionKey: string | null = null;
  if (settings.condition_tiers.length && !input.conditionKey) {
    // Not worked out from photos (none sent, or they didn't show enough): no
    // uplift, and the owner sees the car before the price is final.
    needsInspection = true;
  } else if (settings.condition_tiers.length) {
    const tier = settings.condition_tiers.find((t) => t.key === input.conditionKey);
    if (!tier) throw new QuoteError("unknown_condition", "That condition option isn't available.");
    conditionKey = tier.key;
    needsInspection = tier.needs_inspection;
    if (!tier.needs_inspection) {
      const servicePence = service.base_price_pence + (size?.price_pence ?? 0);
      const extra = roundToPound(servicePence * (tier.multiplier - 1));
      if (extra) lines.push({ label: `${prefix}Condition: ${tier.label.split(":")[0]}`, amount_pence: extra });
      duration += tier.extra_mins;
    }
  }

  const addOnIds = [...new Set(input.addOnIds)];
  for (const id of addOnIds) {
    const addOn = input.addOns.find((a) => a.id === id);
    if (!addOn) throw new QuoteError("unknown_add_on", "One of the extras isn't available any more.");
    if (!addOnFitsService(addOn, service.id)) {
      throw new QuoteError("add_on_not_for_service", `${addOn.name} can't be added to ${service.name}.`);
    }
    lines.push({ label: `${prefix}${addOn.name}`, amount_pence: addOn.price_pence });
    duration += addOn.duration_mins;
  }

  return { lines, duration, needsInspection, conditionKey, addOnIds };
}

export function getQuote(input: QuoteInput): Quote {
  const { service, sizeClass, locationType, settings } = input;

  const first = priceCar({ ...input, prefix: "" });
  const lines = [...first.lines];
  let duration = first.duration;
  let needsInspection = first.needsInspection;

  // Extra cars are done on the same visit: no second journey, and setting up
  // and packing away happen once, so each adds its own time less that.
  const extraCars: QuoteExtraCar[] = (input.extraCars ?? []).map((car, i) => {
    const priced = priceCar({
      service: car.service,
      addOns: input.addOns,
      addOnIds: car.addOnIds,
      sizeClass: car.sizeClass,
      // Photos are only of the first car, so the others aren't priced by
      // condition: where that matters, the owner confirms on the day.
      conditionKey: null,
      locationType,
      settings,
      prefix: `Car ${i + 2}: `,
    });
    lines.push(...priced.lines);
    const added = extraCarMins(priced.duration, input.setupMins ?? 0);
    duration += added;
    needsInspection ||= priced.needsInspection;
    return {
      service_id: car.service.id,
      service_name: car.service.name,
      size_class: car.sizeClass,
      add_on_ids: priced.addOnIds,
      price_pence: priced.lines.reduce((sum, l) => sum + l.amount_pence, 0),
      own_mins: priced.duration,
      added_mins: added,
    };
  });

  if (locationType === "mobile" && settings.mobile_surcharge_pence) {
    lines.push({ label: "Mobile call-out", amount_pence: settings.mobile_surcharge_pence });
  }

  const travel = locationType === "mobile" ? travelFeeFor(settings.travel_fee, input.travelMiles) : null;
  if (travel) lines.push({ label: `Travel (${travel.miles} ${travel.miles === 1 ? "mile" : "miles"})`, amount_pence: travel.pence });

  let total = lines.reduce((sum, l) => sum + l.amount_pence, 0);
  if (total < settings.min_price_pence) {
    lines.push({ label: "Minimum charge", amount_pence: settings.min_price_pence - total });
    total = settings.min_price_pence;
  }

  return {
    service_id: service.id,
    service_name: service.name,
    size_class: sizeClass,
    condition_key: first.conditionKey,
    location_type: locationType,
    add_on_ids: first.addOnIds,
    lines,
    total_pence: total,
    deposit_pence: depositFor(total, settings.deposit),
    duration_mins: duration,
    needs_inspection: needsInspection,
    ...(extraCars.length > 0 && { extra_cars: extraCars }),
  };
}

export function depositFor(total: number, rule: PricingSettings["deposit"]) {
  switch (rule.type) {
    case "none":
      return 0;
    case "percent":
      return Math.round((total * rule.value) / 100);
    case "fixed":
      return Math.min(rule.value_pence, total);
    case "full":
      return total;
  }
}
