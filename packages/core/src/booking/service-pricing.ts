import { formatPence, SIZE_CLASSES, type ConditionTier, type Service, type SizeClass } from "./config";
import type { PricingSettings } from "./pricing";

// What a service's own page shows about its price, from the same settings
// the booking form prices with (pricing.ts): a price and time for each car
// size, and the things that change it (the car's condition, a call-out or
// travel for jobs at the customer's address, a minimum charge). Pure, so it
// can be tested, and so the page never shows a price the form wouldn't.

export type SizeRow = { size: SizeClass; name: string; examples: string; pricePence: number; durationMins: number };

const roundToPound = (pence: number) => Math.round(pence / 100) * 100;

// Small, Medium… with the cars each covers, from "Small: Fiesta, Polo, Corsa".
function sizeLabel(size: SizeClass) {
  const [name, examples = ""] = SIZE_CLASSES[size].split(":").map((s) => s.trim());
  return { name, examples };
}

// The service's price and time for each size. A size the minimum charge
// lifts shows the minimum, as that's what it would cost.
export function sizeRows(service: Pick<Service, "base_price_pence" | "duration_mins" | "size_adjustments">, minPricePence = 0): SizeRow[] {
  return (Object.keys(SIZE_CLASSES) as SizeClass[]).map((size) => {
    const adj = service.size_adjustments[size];
    return {
      size,
      ...sizeLabel(size),
      pricePence: Math.max(service.base_price_pence + (adj?.price_pence ?? 0), minPricePence),
      durationMins: service.duration_mins + (adj?.extra_mins ?? 0),
    };
  });
}

// All sizes the same price and time: the table says so once instead.
export function oneSizeFitsAll(rows: SizeRow[]) {
  return rows.every((r) => r.pricePence === rows[0].pricePence && r.durationMins === rows[0].durationMins);
}

// "Typical duration: 2 hr 30 min – 3 hrs" style range, in minutes.
export function durationRange(rows: SizeRow[]) {
  const mins = rows.map((r) => r.durationMins);
  return { min: Math.min(...mins), max: Math.max(...mins) };
}

// How the car's condition changes the price, a line a tier, in the owner's
// order: "Light: no change", "Heavy: about £20 more", "Very heavy: price
// confirmed when we see the car". Priced on the service's base price.
export function conditionLines(tiers: ConditionTier[], basePence: number): { label: string; effect: string }[] {
  return tiers.map((t) => {
    const label = t.label.split(":")[0].trim();
    if (t.needs_inspection) return { label, effect: "Price confirmed when we see the car" };
    const extra = roundToPound(basePence * (t.multiplier - 1));
    if (extra > 0) return { label, effect: `About ${formatPence(extra)} more${t.extra_mins ? ", and takes longer" : ""}` };
    if (extra < 0) return { label, effect: `About ${formatPence(-extra)} less` };
    return { label, effect: "No change" };
  });
}

// The notes under the price table, as short sentences; none that don't apply.
export function priceNotes(
  settings: Pick<PricingSettings, "offers_mobile" | "mobile_surcharge_pence" | "travel_fee" | "min_price_pence" | "condition_tiers">,
): string[] {
  const notes: string[] = [];
  if (settings.condition_tiers.length) notes.push("Your exact price depends on the car's condition, worked out from a couple of photos when you book.");
  if (settings.offers_mobile && settings.mobile_surcharge_pence) {
    notes.push(`Jobs at your address have a ${formatPence(settings.mobile_surcharge_pence)} call-out charge.`);
  }
  if (settings.offers_mobile && settings.travel_fee?.pence_per_mile) {
    const { free_miles, pence_per_mile } = settings.travel_fee;
    notes.push(
      free_miles
        ? `Travel is free within ${free_miles} ${free_miles === 1 ? "mile" : "miles"}, then ${formatPence(pence_per_mile)} a mile.`
        : `Travel is ${formatPence(pence_per_mile)} a mile.`,
    );
  }
  if (settings.min_price_pence) notes.push(`Minimum charge ${formatPence(settings.min_price_pence)}.`);
  return notes;
}
