"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil } from "lucide-react";
import {
  addOnFitsService,
  formatDuration,
  formatPence,
  LOCATION_TYPES,
  SIZE_CLASSES,
  type AddOn,
  type LocationType,
  type Service,
  type SizeClass,
} from "@leadgen/core/booking/config";
import {
  CONCERNS,
  CONTACT_METHODS,
  HANDOVER,
  HEARD_FROM,
  MOBILE_HANDOVER,
  UNIT_HANDOVER,
  type Concern,
  type ContactMethod,
  type Handover,
  type HeardFrom,
} from "@leadgen/core/booking/answers";
import type { ConditionAssessment } from "@leadgen/core/booking/condition";
import type { Questions } from "@leadgen/core/settings/questions";
import { getQuote, type PricingSettings, type Quote } from "@leadgen/core/booking/pricing";
import { collectsDepositOnline } from "@leadgen/core/stripe/rules";
import type { Slot } from "@leadgen/core/booking/engine";
import { shortDate } from "@leadgen/core/booking/calendar";
import { CAR_MAKES, CAR_MODELS, POPULAR_MAKES } from "@leadgen/core/vehicles/catalog";
import { suggestSize } from "@leadgen/core/vehicles/sizes";
import { SearchSelect, type OptionGroup } from "@/components/search-select";
import { pageUrl } from "@/lib/urls";
import {
  assessPhotosAction,
  bookAction,
  checkAreaAction,
  findOpenDatesAction,
  findSlotsAction,
  saveLeadAction,
} from "./actions";
import { DateTimePicker } from "./date-time-picker";
import { PhotoPicker, type PhotoItem } from "./photo-picker";

// The booking page: every step on one page, the finished ones folded down to
// a line, with the price following the customer in a summary beside it. The
// Booking Agent will sit on top of the same engine; this stays as the
// fallback when the AI is down or slow. Prices shown here are a preview from
// the same getQuote() the server runs again when the booking is made, so
// nothing the browser sends sets a price.

type Props = {
  tenantName: string;
  // For links to this business's other pages (pageUrl).
  tenant: { slug: string; customDomain: string | null };
  services: Service[];
  addOns: AddOn[];
  pricing: PricingSettings;
  unitAddress: string | null;
  timezone: string;
  // The tenant-local date today.
  today: string;
  // Every day the business works within the booking window; the fallback if
  // the days with time free can't be worked out.
  dates: string[];
  // The tenant can take card deposits through Stripe.
  stripeReady: boolean;
  // A service picked on its own page, so the form starts after that step.
  initialServiceId?: string;
  // Inside the embed script's panel: one narrow column.
  embedded: boolean;
  // Which optional questions this business asks (Settings → Booking).
  questions: Questions;
  // Booking needs at least this many photos; 0 = photos are optional.
  minPhotos: number;
  // Bookings wait for the owner to approve them.
  needsApproval: boolean;
  // The cancellation policy, a sentence per line; null = none set.
  policy: string[] | null;
  // What the marketing tick box says.
  consentText: string;
  // Where "privacy notice" links go.
  privacyUrl: string;
};

const OTHER = "Other (not listed)";

const MAKE_GROUPS: OptionGroup[] = [
  { label: "Popular", options: [...POPULAR_MAKES] },
  { label: "All makes", options: CAR_MAKES },
];

const STEPS = [
  { id: "service", title: "Service" },
  { id: "vehicle", title: "Your car" },
  { id: "options", title: "Extras and options" },
  { id: "where", title: "Where" },
  { id: "details", title: "Your details" },
  { id: "time", title: "Date and time" },
  { id: "confirm", title: "Review and book" },
] as const;
type StepId = (typeof STEPS)[number]["id"];
const stepIndex = (id: StepId) => STEPS.findIndex((s) => s.id === id);

type Phase = "form" | "pay" | "done";

type Answers = {
  serviceId?: string;
  sizeClass?: SizeClass;
  addOnIds: string[];
  locationType?: LocationType;
  postcode: string;
  addressLine: string;
  name: string;
  email: string;
  phone: string;
  emailMarketing: boolean;
  // The picker choices; make/model hold typed text when "Other" is picked.
  makeChoice: string;
  modelChoice: string;
  make: string;
  model: string;
  registration: string;
  colour: string;
  year: string;
  concerns: Concern[];
  handover?: Handover;
  contactMethod?: ContactMethod;
  heardFrom?: HeardFrom;
  water?: "yes" | "no" | "unsure";
  power?: "yes" | "no" | "unsure";
  parking?: "driveway" | "street" | "car_park" | "other";
  carLocation: string;
  notes: string;
  flexible: boolean;
  acceptedTerms: boolean;
  date?: string;
  slot?: Slot;
};

const EMPTY: Answers = {
  addOnIds: [],
  postcode: "",
  addressLine: "",
  name: "",
  email: "",
  phone: "",
  emailMarketing: false,
  makeChoice: "",
  modelChoice: "",
  make: "",
  model: "",
  registration: "",
  colour: "",
  year: "",
  concerns: [],
  carLocation: "",
  notes: "",
  flexible: false,
  acceptedTerms: false,
};

export function BookingFlow(props: Props) {
  const { services, addOns, pricing, timezone, questions: ask } = props;
  const preselected = services.some((x) => x.id === props.initialServiceId);
  const [active, setActive] = useState<number>(preselected ? 1 : 0);
  const [phase, setPhase] = useState<Phase>("form");
  const [a, setA] = useState<Answers>(preselected ? { ...EMPTY, serviceId: props.initialServiceId } : EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  // Days with a start time free; null while that's being worked out.
  const [openDates, setOpenDates] = useState<string[] | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  // The booking went in as a request for the owner to approve.
  const [requested, setRequested] = useState(false);
  const photoIds = photos.flatMap((p) => (p.status === "done" && p.id ? [p.id] : []));
  const uploading = photos.some((p) => p.status === "uploading");
  // The condition comes from a check of the photos (never asked), and only
  // counts for the photos it looked at: adding or removing one means a new check.
  const pricesByCondition = pricing.condition_tiers.length > 0;
  const photoKey = [...photoIds].sort().join(",");
  const [assessment, setAssessment] = useState<(ConditionAssessment & { photoKey: string }) | null>(null);
  const [checking, setChecking] = useState(false);
  const check = assessment?.photoKey === photoKey ? assessment : null;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const service = services.find((s) => s.id === a.serviceId);
  const serviceAddOns = service ? addOns.filter((x) => addOnFitsService(x, service.id)) : [];
  const locations = service
    ? (Object.keys(LOCATION_TYPES) as LocationType[]).filter(
        (l) =>
          service.location_types.includes(l) &&
          (l === "mobile" ? pricing.offers_mobile : pricing.offers_unit),
      )
    : [];
  const handoverOptions = a.locationType === "unit" ? UNIT_HANDOVER : MOBILE_HANDOVER;

  // Recomputed each render; the React Compiler memoizes it.
  const carMake = a.makeChoice === OTHER ? a.make.trim() : a.makeChoice;
  const carModel = a.makeChoice === OTHER || a.modelChoice === OTHER ? a.model.trim() : a.modelChoice;
  const conditionTier =
    check?.status === "assessed" ? pricing.condition_tiers.find((t) => t.key === check.conditionKey) : undefined;

  const suggestedSize = carMake && carModel ? suggestSize(carMake, carModel) : null;
  const sizeName = (size: SizeClass) => (size === "xl" ? "XL" : size);
  const sizeHint = !suggestedSize
    ? undefined
    : a.sizeClass === suggestedSize
      ? `We've picked ${sizeName(suggestedSize)} for a ${carMake} ${carModel}. Change it if that's not right.`
      : a.sizeClass
        ? `A ${carMake} ${carModel} is usually ${sizeName(suggestedSize)}. ${props.tenantName} may adjust the price if the size doesn't match on the day.`
        : undefined;

  const quote = ((): Quote | null => {
    if (!service || !a.sizeClass) return null;
    try {
      return getQuote({
        service,
        addOns,
        addOnIds: a.addOnIds,
        sizeClass: a.sizeClass,
        conditionKey: conditionTier?.key ?? null,
        locationType: a.locationType ?? locations[0] ?? "mobile",
        settings: pricing,
      });
    } catch {
      return null;
    }
  })();

  const payOnline = !!quote && collectsDepositOnline(quote.deposit_pence, props.stripeReady);

  const set = (patch: Partial<Answers>) => {
    setError(null);
    setA((prev) => ({ ...prev, ...patch }));
  };

  const goTo = (index: number) => {
    setError(null);
    setActive(index);
    // After the card has opened, bring it to the top of the screen.
    setTimeout(() => document.getElementById(`step-${STEPS[index].id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const next = () => goTo(active + 1);

  // Leaving "Your car" with photos that haven't been checked: check them
  // first, so the price below includes the car's condition. A confident
  // answer moves on; an unsure one stays put so clearer photos can be added
  // (pressing Continue again goes on without them). If the check can't run,
  // the job is priced without it and the owner sees the car.
  const continueFromCar = async () => {
    if (!pricesByCondition || !photoIds.length || check) return next();
    setError(null);
    setChecking(true);
    const key = photoKey;
    let result: ConditionAssessment | null = null;
    try {
      const r = await assessPhotosAction(photoIds);
      if (r.ok) result = r.assessment;
    } catch {
      // Treated as unchecked.
    }
    setChecking(false);
    if (result) setAssessment({ ...result, photoKey: key });
    if (result?.status !== "unsure") next();
  };

  // Turns an engine result into either the next step or an error message.
  const run = <T extends { ok: boolean; message?: string }>(
    action: () => Promise<T>,
    onOk: (result: T) => void,
  ) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) onOk(result);
        else setError(result.message ?? "Something went wrong. Try again.");
        // Prices were edited mid-booking: reload them so the summary
        // shows what the server will charge.
        if ("code" in result && result.code === "price_changed") router.refresh();
      } catch {
        setError("Something went wrong on our side. Try again in a moment.");
      }
    });
  };

  const quoteRequest = () => ({
    serviceId: a.serviceId!,
    sizeClass: a.sizeClass!,
    // The server reads the condition from this check, not from the browser.
    assessmentId: check?.id ?? null,
    addOnIds: a.addOnIds,
    locationType: a.locationType!,
  });

  const contact = () => ({
    name: a.name,
    email: a.email,
    phone: a.phone,
    emailMarketing: a.emailMarketing,
  });

  const place = () =>
    a.locationType === "mobile"
      ? { postcode: a.postcode, addressLine: a.addressLine }
      : {};

  const access = () =>
    a.locationType === "mobile"
      ? { water: a.water, power: a.power, parking: a.parking, carLocation: a.carLocation }
      : {};

  const year = /^\d{4}$/.test(a.year.trim()) ? Number(a.year.trim()) : undefined;
  const details = () => ({
    colour: a.colour,
    year,
    concerns: a.concerns,
    handover: a.handover,
    contactMethod: a.contactMethod,
    heardFrom: a.heardFrom,
    flexible: a.flexible,
    acceptedTerms: a.acceptedTerms,
  });

  const pickDate = (date: string) => {
    set({ date, slot: undefined });
    setSlots(null);
    run(
      () => findSlotsAction({ ...quoteRequest(), ...place(), date }),
      (r) => r.ok && setSlots(r.slots),
    );
  };

  // Called on the way into the time step: which days have time free for this
  // job, and the earliest of them already picked so the times show at once.
  const loadOpenDates = () => {
    setOpenDates(null);
    setSlots(null);
    setA((prev) => ({ ...prev, date: undefined, slot: undefined }));
    startTransition(async () => {
      let dates = props.dates;
      try {
        const result = await findOpenDatesAction({ ...quoteRequest(), ...place() });
        if (result.ok) dates = result.dates;
      } catch {
        // Fall back to every working day; a taken slot is caught at booking.
      }
      setOpenDates(dates);
      if (dates[0]) pickDate(dates[0]);
    });
  };

  // One line per finished step, shown while it's folded.
  const summaries: Record<StepId, string> = {
    service: service?.name ?? "",
    vehicle: [
      [carMake, carModel].filter(Boolean).join(" "),
      a.sizeClass && sizeName(a.sizeClass),
      conditionTier?.label.split(":")[0],
    ]
      .filter(Boolean)
      .join(" · "),
    options: [
      a.addOnIds.length ? `${a.addOnIds.length} ${a.addOnIds.length === 1 ? "extra" : "extras"}` : "No extras",
      a.concerns.length ? `${a.concerns.length} ${a.concerns.length === 1 ? "thing" : "things"} to look at` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    where: a.locationType === "mobile" ? `${a.addressLine}, ${a.postcode.toUpperCase()}` : (props.unitAddress ?? "Drop-off"),
    details: [a.name, a.email].filter(Boolean).join(" · "),
    time: a.slot && a.date ? `${shortDate(a.date)} at ${a.slot.time}` : "",
    confirm: "",
  };

  const stepState = (id: StepId) => {
    const i = stepIndex(id);
    return i < active ? "done" : i === active ? "active" : "todo";
  };

  const cardProps = (id: StepId) => ({
    id,
    n: stepIndex(id) + 1,
    title: STEPS[stepIndex(id)].title,
    state: stepState(id) as "done" | "active" | "todo",
    summary: summaries[id],
    error: active === stepIndex(id) ? error : null,
    onEdit: () => goTo(stepIndex(id)),
  });

  const finished = phase !== "form";
  // An unchecked condition only reads as "to be confirmed" once the photos
  // step is behind them; before that they may still add photos.
  const unconfirmed = !!quote?.needs_inspection && (!!conditionTier || active > stepIndex("vehicle") || finished);

  return (
    <div className={props.embedded ? "grid gap-6" : "grid items-start gap-6 lg:grid-cols-[1fr_22rem]"}>
      <div className="grid gap-4">
        {phase === "pay" && checkoutUrl && (
          <div className="grid justify-items-center gap-3 rounded-2xl border bg-white py-12 text-center">
            <Loader2 className="size-8 animate-spin text-neutral-400" />
            <h2 className="text-xl font-semibold">Taking you to our secure payment page…</h2>
            <p className="max-w-sm text-sm text-neutral-500">
              Your time is held for a little while so you can pay the deposit.
            </p>
            {/* Fallback if the automatic redirect is blocked. */}
            <a href={checkoutUrl} target="_top" className="text-sm underline underline-offset-4">
              Continue to payment
            </a>
          </div>
        )}

        {phase === "done" && quote && a.slot && (
          <div className="grid justify-items-center gap-3 rounded-2xl border bg-white px-4 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-brand text-brand-fg">
              <Check className="size-7" />
            </div>
            <h2 className="text-2xl font-semibold">{requested ? "Booking request sent" : "You’re booked in"}</h2>
            <p className="text-neutral-600">
              {quote.service_name}, {formatInstant(a.slot.startsAt, timezone)}.
            </p>
            <p className="max-w-sm text-sm text-neutral-500">
              {requested
                ? `${props.tenantName} will confirm your booking shortly. The time is kept for you until they do.`
                : quote.deposit_pence > 0
                  ? `${props.tenantName} will be in touch about the ${formatPence(quote.deposit_pence)} deposit.`
                  : `${props.tenantName} will be in touch before the day.`}
            </p>
          </div>
        )}

        {!finished && (
          <>
            <StepCard {...cardProps("service")}>
              <div className="grid gap-3">
                {services.map((s) => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    moreHref={s.slug ? pageUrl(props.tenant, `/services/${s.slug}`) : undefined}
                    selected={a.serviceId === s.id}
                    onClick={() => {
                      // A different service has different extras and
                      // places, so those answers start again.
                      if (s.id !== a.serviceId) set({ serviceId: s.id, addOnIds: [], locationType: undefined, handover: undefined });
                      next();
                    }}
                  />
                ))}
              </div>
            </StepCard>

            <StepCard {...cardProps("vehicle")}>
              {service && (
                <div className="grid gap-5">
                  <Section title="What car is it?">
                    <SearchSelect
                      label="Make"
                      placeholder="Search makes, e.g. Ford"
                      groups={MAKE_GROUPS}
                      value={a.makeChoice}
                      extraOption={OTHER}
                      onChange={(makeChoice) => set({ makeChoice, modelChoice: "", make: "", model: "" })}
                    />
                    {a.makeChoice === OTHER ? (
                      <>
                        <Field label="Make" value={a.make} onChange={(make) => set({ make })} />
                        <Field label="Model" value={a.model} onChange={(model) => set({ model })} />
                      </>
                    ) : (
                      <>
                        <SearchSelect
                          label="Model"
                          placeholder={a.makeChoice ? `Search ${a.makeChoice} models` : "Choose a make first"}
                          disabled={!a.makeChoice}
                          groups={[{ options: CAR_MODELS[a.makeChoice] ?? [] }]}
                          value={a.modelChoice}
                          extraOption={OTHER}
                          onChange={(modelChoice) =>
                            set({ modelChoice, model: "", sizeClass: suggestSize(a.makeChoice, modelChoice) ?? a.sizeClass })
                          }
                        />
                        {a.modelChoice === OTHER && (
                          <Field label="Model" value={a.model} onChange={(model) => set({ model })} />
                        )}
                      </>
                    )}
                    {(ask.registration || ask.colour_year) && (
                      <div className={ask.registration && ask.colour_year ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
                        {ask.registration && (
                          <Field
                            label="Registration"
                            placeholder="Optional"
                            value={a.registration}
                            onChange={(registration) => set({ registration })}
                            autoComplete="off"
                          />
                        )}
                        {ask.colour_year && (
                          <>
                            <Field label="Colour" placeholder="Optional" value={a.colour} onChange={(colour) => set({ colour })} />
                            <Field
                              label="Year"
                              placeholder="Optional"
                              inputMode="numeric"
                              maxLength={4}
                              value={a.year}
                              onChange={(year) => set({ year: year.replace(/\D/g, "") })}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </Section>
                  <Section title="What size is the car?" hint={sizeHint}>
                    {(Object.keys(SIZE_CLASSES) as SizeClass[]).map((size) => (
                      <Option
                        key={size}
                        selected={a.sizeClass === size}
                        onClick={() => set({ sizeClass: size })}
                        title={SIZE_CLASSES[size].split(":")[0]}
                        detail={SIZE_CLASSES[size].split(":")[1]}
                      />
                    ))}
                  </Section>
                  <Section
                    title={props.minPhotos ? "Photos of the car (needed to book)" : "Photos of the car"}
                    hint={
                      props.minPhotos
                        ? `Add at least ${props.minPhotos === 1 ? "one photo" : `${props.minPhotos} photos`} so ${props.tenantName} can see what the job needs.`
                        : pricesByCondition
                          ? `The price for the car's condition comes from these. Without photos, ${props.tenantName} confirms it when they see the car.`
                          : undefined
                    }
                  >
                    <PhotoPicker tenantName={props.tenantName} photos={photos} setPhotos={setPhotos} />
                    {check && (
                      <p
                        role="status"
                        className={`rounded-xl p-3 text-sm ${conditionTier ? "bg-neutral-100 text-neutral-700" : "bg-amber-50 text-amber-900"}`}
                      >
                        {conditionTier
                          ? `From your photos: ${conditionTier.label.split(":")[0]}.${conditionTier.needs_inspection ? ` ${props.tenantName} will confirm the price when they see the car.` : ""}`
                          : `We couldn't tell the car's condition from these photos, so ${props.tenantName} will confirm the price when they see it. You can add clearer photos, or carry on.`}
                      </p>
                    )}
                  </Section>
                  <Continue
                    label={
                      uploading
                        ? "Uploading photos…"
                        : checking
                          ? "Checking your photos…"
                          : photoIds.length < props.minPhotos
                            ? `Add ${props.minPhotos - photoIds.length} more ${props.minPhotos - photoIds.length === 1 ? "photo" : "photos"} to continue`
                            : "Continue"
                    }
                    disabled={uploading || checking || !carMake || !carModel || !a.sizeClass || photoIds.length < props.minPhotos}
                    onClick={continueFromCar}
                  />
                </div>
              )}
            </StepCard>

            <StepCard {...cardProps("options")}>
              <div className="grid gap-5">
                {serviceAddOns.length > 0 && (
                  <Section title="Any extras?">
                    {serviceAddOns.map((x) => {
                      const on = a.addOnIds.includes(x.id);
                      return (
                        <Option
                          key={x.id}
                          selected={on}
                          multi
                          onClick={() =>
                            set({ addOnIds: on ? a.addOnIds.filter((id) => id !== x.id) : [...a.addOnIds, x.id] })
                          }
                          title={x.name}
                          detail={x.description}
                          aside={`+${formatPence(x.price_pence)}`}
                        />
                      );
                    })}
                  </Section>
                )}
                {ask.concerns && (
                  <Section title="Anything we should look at?" hint="Tick any that apply so we bring the right products and allow enough time.">
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(CONCERNS) as Concern[]).map((k) => {
                        const on = a.concerns.includes(k);
                        return (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={on}
                            onClick={() => set({ concerns: on ? a.concerns.filter((c) => c !== k) : [...a.concerns, k] })}
                            className={chip(on)}
                          >
                            {CONCERNS[k]}
                          </button>
                        );
                      })}
                    </div>
                  </Section>
                )}
                <Continue label={a.addOnIds.length || a.concerns.length ? "Continue" : "Nothing extra, continue"} onClick={next} />
              </div>
            </StepCard>

            <StepCard {...cardProps("where")}>
              <div className="grid gap-5">
                <Section title="Where will the car be?">
                  {locations.map((l) => (
                    <Option
                      key={l}
                      selected={a.locationType === l}
                      onClick={() => set({ locationType: l, ...(l !== a.locationType && { handover: undefined }) })}
                      title={LOCATION_TYPES[l]}
                      detail={l === "unit" ? props.unitAddress : "We come to you"}
                    />
                  ))}
                </Section>
                {a.locationType === "mobile" && (
                  <>
                    <div className="grid gap-3">
                      <Field label="Postcode" value={a.postcode} onChange={(postcode) => set({ postcode })} autoComplete="postal-code" />
                      <Field
                        label="First line of the address"
                        value={a.addressLine}
                        onChange={(addressLine) => set({ addressLine })}
                        autoComplete="address-line1"
                      />
                    </div>
                    {(ask.access || ask.car_location) && (
                      <Section title="About the spot">
                        {ask.access && (
                          <>
                            <Choice
                              label="Can we use an outside tap?"
                              value={a.water}
                              options={{ yes: "Yes", no: "No", unsure: "Not sure" }}
                              onChange={(water) => set({ water })}
                            />
                            <Choice
                              label="Is there a power socket nearby?"
                              value={a.power}
                              options={{ yes: "Yes", no: "No", unsure: "Not sure" }}
                              onChange={(power) => set({ power })}
                            />
                            <Choice
                              label="Where will the car be parked?"
                              value={a.parking}
                              options={{ driveway: "Driveway", street: "On the street", car_park: "Car park", other: "Other" }}
                              onChange={(parking) => set({ parking })}
                            />
                          </>
                        )}
                        {ask.car_location && (
                          <Field
                            label="Finding you (optional)"
                            placeholder="Gate code, which bay, a landmark…"
                            value={a.carLocation}
                            onChange={(carLocation) => set({ carLocation })}
                            multiline
                          />
                        )}
                      </Section>
                    )}
                  </>
                )}
                {a.locationType && ask.handover && (
                  <Section title="How will we get the car?" hint="Optional.">
                    <div className="flex flex-wrap gap-2">
                      {handoverOptions.map((k) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={a.handover === k}
                          onClick={() => set({ handover: a.handover === k ? undefined : k })}
                          className={chip(a.handover === k)}
                        >
                          {HANDOVER[k]}
                        </button>
                      ))}
                    </div>
                  </Section>
                )}
                <Continue
                  pending={pending}
                  disabled={!a.locationType || (a.locationType === "mobile" && (!a.postcode.trim() || !a.addressLine.trim()))}
                  onClick={() =>
                    a.locationType === "mobile"
                      ? run(() => checkAreaAction(a.postcode), next)
                      : next()
                  }
                />
              </div>
            </StepCard>

            <StepCard {...cardProps("details")}>
              {quote && (
                <div className="grid gap-5">
                  <Section title="Your details">
                    <Field label="Name" value={a.name} onChange={(name) => set({ name })} autoComplete="name" />
                    <Field label="Email" type="email" value={a.email} onChange={(email) => set({ email })} autoComplete="email" />
                    <Field label="Mobile number" type="tel" value={a.phone} onChange={(phone) => set({ phone })} autoComplete="tel" />
                  </Section>
                  {ask.contact_method && (
                    <Section title="How should we contact you?" hint="Optional.">
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(CONTACT_METHODS) as ContactMethod[]).map((k) => (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={a.contactMethod === k}
                            onClick={() => set({ contactMethod: a.contactMethod === k ? undefined : k })}
                            className={chip(a.contactMethod === k)}
                          >
                            {CONTACT_METHODS[k]}
                          </button>
                        ))}
                      </div>
                    </Section>
                  )}
                  {ask.heard_from && (
                    <Section title="How did you hear about us?" hint="Optional.">
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(HEARD_FROM) as HeardFrom[]).map((k) => (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={a.heardFrom === k}
                            onClick={() => set({ heardFrom: a.heardFrom === k ? undefined : k })}
                            className={chip(a.heardFrom === k)}
                          >
                            {HEARD_FROM[k]}
                          </button>
                        ))}
                      </div>
                    </Section>
                  )}
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={a.emailMarketing}
                      onChange={(e) => set({ emailMarketing: e.target.checked })}
                      className="mt-0.5 size-4 accent-[var(--brand)]"
                    />
                    <span>{props.consentText}</span>
                  </label>
                  <p className="text-xs text-neutral-500">
                    {props.tenantName} uses your details to handle this enquiry and booking, and may contact
                    you about it, including to follow up if you don&apos;t finish booking. See our{" "}
                    <a href={props.privacyUrl} target="_blank" rel="noopener" className="underline">privacy notice</a>{" "}
                    for how long we keep them and your rights.
                  </p>
                  <Continue
                    pending={pending}
                    disabled={!a.name.trim() || !a.email.trim() || !a.phone.trim()}
                    onClick={() =>
                      run(
                        () =>
                          saveLeadAction({
                            ...quoteRequest(),
                            ...place(),
                            contact: contact(),
                            photoIds,
                            draft: {
                              vehicle: { make: carMake, model: carModel, registration: a.registration },
                              access: access(),
                              details: details(),
                            },
                          }),
                        () => {
                          next();
                          loadOpenDates();
                        },
                      )
                    }
                  />
                </div>
              )}
            </StepCard>

            <StepCard {...cardProps("time")}>
              {quote && (
                <div className="grid gap-5">
                  <Section title="When suits you?" hint={`The job takes about ${formatDuration(quote.duration_mins)}.`}>
                    {openDates === null ? (
                      <p className="flex items-center gap-2 text-sm text-neutral-500">
                        <Loader2 className="size-4 animate-spin" /> Checking the diary…
                      </p>
                    ) : openDates.length === 0 ? (
                      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                        {props.tenantName} is fully booked for the coming weeks. Please get in touch directly and
                        we&apos;ll find you a time.
                      </p>
                    ) : (
                      <DateTimePicker
                        today={props.today}
                        openDates={openDates}
                        date={a.date}
                        onPickDate={pickDate}
                        slots={slots}
                        loadingSlots={pending}
                        slot={a.slot}
                        onPickSlot={(slot) => set({ slot })}
                      />
                    )}
                  </Section>
                  {ask.flexible && (
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={a.flexible}
                        onChange={(e) => set({ flexible: e.target.checked })}
                        className="mt-0.5 size-4 accent-[var(--brand)]"
                      />
                      <span>I&apos;m flexible. Let me know if an earlier time opens up.</span>
                    </label>
                  )}
                  <Continue
                    label={a.slot && a.date ? `Continue · ${shortDate(a.date)} at ${a.slot.time}` : "Pick a time to continue"}
                    disabled={!a.slot}
                    onClick={next}
                  />
                </div>
              )}
            </StepCard>

            <StepCard {...cardProps("confirm")}>
              {quote && a.slot && (
                <div className="grid gap-5">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border bg-white p-4 text-sm">
                    <dt className="text-neutral-500">When</dt>
                    <dd>
                      {formatInstant(a.slot.startsAt, timezone)}
                      <span className="text-neutral-500"> · about {formatDuration(quote.duration_mins)}</span>
                    </dd>
                    <dt className="text-neutral-500">Where</dt>
                    <dd>
                      {a.locationType === "mobile" ? `${a.addressLine}, ${a.postcode.toUpperCase()}` : props.unitAddress}
                    </dd>
                    <dt className="text-neutral-500">Car</dt>
                    <dd>
                      {[a.colour.trim(), year, carMake, carModel].filter(Boolean).join(" ")}
                      {a.registration.trim() && <span className="font-mono text-neutral-500"> · {a.registration.trim().toUpperCase()}</span>}
                    </dd>
                    {a.concerns.length > 0 && (
                      <>
                        <dt className="text-neutral-500">To look at</dt>
                        <dd>{a.concerns.map((c) => CONCERNS[c]).join(", ")}</dd>
                      </>
                    )}
                    {photoIds.length > 0 && (
                      <>
                        <dt className="text-neutral-500">Photos</dt>
                        <dd>{photoIds.length} attached</dd>
                      </>
                    )}
                    <dt className="text-neutral-500">Name</dt>
                    <dd>{a.name}</dd>
                  </dl>
                  {quote.needs_inspection && (
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                      {conditionTier
                        ? `From your photos, ${props.tenantName} will need to see the car before confirming the final price.`
                        : `${props.tenantName} will confirm the final price when they see the car, as ${photoIds.length ? "the photos didn't show enough to price from" : "there are no photos to price from"}.`}
                    </p>
                  )}
                  {ask.notes && (
                    <Field label="Anything else we should know? (optional)" value={a.notes} onChange={(notes) => set({ notes })} multiline />
                  )}
                  {props.policy && (
                    <div className="rounded-xl border bg-white p-3 text-sm text-neutral-600">
                      <p className="mb-1 font-medium text-neutral-900">Cancellations and changes</p>
                      {props.policy.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  )}
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={a.acceptedTerms}
                      onChange={(e) => set({ acceptedTerms: e.target.checked })}
                      className="mt-0.5 size-4 accent-[var(--brand)]"
                    />
                    <span>
                      The details above are right, and I&apos;ve read the{" "}
                      <a href={props.privacyUrl} target="_blank" rel="noopener" className="underline">privacy notice</a>.
                    </span>
                  </label>
                  {payOnline && (
                    <p className="text-sm text-neutral-500">
                      You&apos;ll pay the {formatPence(quote.deposit_pence)} deposit securely on the next page. Your
                      time is held while you do.
                    </p>
                  )}
                  <Continue
                    label={
                      payOnline
                        ? `Pay ${formatPence(quote.deposit_pence)} ${quote.deposit_pence >= quote.total_pence ? "now" : "deposit"}`
                        : props.needsApproval
                          ? "Send booking request"
                          : "Confirm booking"
                    }
                    pending={pending}
                    disabled={!a.acceptedTerms}
                    onClick={() =>
                      run(
                        () =>
                          bookAction({
                            ...quoteRequest(),
                            ...place(),
                            contact: contact(),
                            photoIds,
                            startsAt: a.slot!.startsAt,
                            vehicle: { make: carMake, model: carModel, registration: a.registration },
                            access: access(),
                            details: details(),
                            notes: a.notes,
                            expectedTotalPence: quote.total_pence,
                          }),
                        (result) => {
                          const url = "checkoutUrl" in result ? result.checkoutUrl : null;
                          window.scrollTo({ top: 0 });
                          if (url) {
                            setCheckoutUrl(url);
                            setPhase("pay");
                            goToCheckout(url);
                          } else {
                            setRequested("status" in result && result.status === "requested");
                            setPhase("done");
                          }
                        },
                      )
                    }
                  />
                </div>
              )}
            </StepCard>
          </>
        )}
      </div>

      <Summary
        quote={quote}
        service={service}
        car={[carMake, carModel].filter(Boolean).join(" ")}
        where={a.locationType ? summaries.where : ""}
        when={a.slot && a.date ? formatInstant(a.slot.startsAt, timezone) : ""}
        showDeposit={active >= stepIndex("time") || finished}
        unconfirmed={unconfirmed}
        sticky={!props.embedded}
      />
    </div>
  );
}

// ------------------------------------------------------------------ pieces

// One step of the page. Finished steps fold to a line you can reopen,
// steps still to come stay dimmed so the customer sees the way ahead.
function StepCard({
  id,
  n,
  title,
  state,
  summary,
  error,
  onEdit,
  children,
}: {
  id: StepId;
  n: number;
  title: string;
  state: "done" | "active" | "todo";
  summary: string;
  error: string | null;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`step-${id}`}
      aria-labelledby={`step-${id}-title`}
      className={`scroll-mt-4 rounded-2xl border bg-white ${state === "todo" ? "border-dashed opacity-60" : "border-neutral-200"}`}
    >
      <header className="flex items-center gap-3 p-4">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-medium ${
            state === "todo" ? "bg-neutral-100 text-neutral-500" : "bg-brand text-brand-fg"
          }`}
        >
          {state === "done" ? <Check className="size-4" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`step-${id}-title`} className="text-lg leading-tight font-semibold">
            {title}
          </h2>
          {state === "done" && summary && <p className="truncate text-sm text-neutral-500">{summary}</p>}
        </div>
        {state === "done" && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Pencil className="size-3.5" /> Change
          </button>
        )}
      </header>
      {state === "active" && (
        <div className="grid gap-4 border-t p-4">
          {children}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// The booking so far, with the price. Beside the steps on a wide screen,
// below them on a phone.
function Summary({
  quote,
  service,
  car,
  where,
  when,
  showDeposit,
  unconfirmed,
  sticky,
}: {
  quote: Quote | null;
  service: Service | undefined;
  car: string;
  where: string;
  when: string;
  showDeposit: boolean;
  // The final price waits on the owner seeing the car.
  unconfirmed: boolean;
  sticky: boolean;
}) {
  const rows = [
    ["Service", service?.name],
    ["Car", car],
    ["Where", where],
    ["When", when],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  return (
    <aside aria-label="Your booking" className={`grid gap-3 ${sticky ? "lg:sticky lg:top-6" : ""}`}>
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Your booking</h2>
        {rows.length > 0 ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-neutral-500">Pick a service to get started.</p>
        )}
        {quote ? (
          <div className="mt-3 border-t pt-3">
            <QuoteLines quote={quote} showDeposit={showDeposit} />
          </div>
        ) : (
          service && (
            <p className="mt-3 border-t pt-3 text-sm text-neutral-500">
              From {formatPence(service.base_price_pence)}. Your exact price appears once you&apos;ve chosen your car&apos;s size.
            </p>
          )
        )}
      </div>
      {quote && (
        <p className="px-1 text-xs text-neutral-500">
          Takes about {formatDuration(quote.duration_mins)}. {unconfirmed ? "Final price confirmed after seeing the car." : quote.needs_inspection ? "" : "No hidden fees."}
        </p>
      )}
    </aside>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        {hint && <p className="text-sm text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ServiceCard({
  service: s,
  moreHref,
  selected,
  onClick,
}: {
  service: { name: string; description: string | null; tagline?: string | null; includes?: string[]; image_path?: string | null; base_price_pence: number; slug?: string | null };
  // The service's own page, if it has one.
  moreHref?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const image = s.image_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service-images/${s.image_path}`
    : null;
  return (
    <div className="grid gap-1.5">
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full overflow-hidden rounded-2xl border bg-white text-left transition hover:border-neutral-400 ${
        selected ? "border-brand ring-2 ring-brand" : "border-neutral-200"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt="" className="aspect-[16/7] w-full object-cover" />}
      <span className="block p-4">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{s.name}</span>
          <span className="shrink-0 text-sm font-medium">from {formatPence(s.base_price_pence)}</span>
        </span>
        {s.tagline && <span className="mt-0.5 block text-sm text-neutral-600">{s.tagline}</span>}
        {s.description && <span className="mt-1 block text-sm text-neutral-500">{s.description.trim()}</span>}
        {!!s.includes?.length && (
          <span className="mt-3 grid gap-1 text-sm text-neutral-700">
            {s.includes.map((item) => (
              <span key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                {item}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
    {moreHref && (
      <a href={moreHref} target="_top" className="justify-self-start px-1 text-sm text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline">
        More about {s.name}
      </a>
    )}
    </div>
  );
}

function Option({
  title,
  detail,
  aside,
  selected,
  multi,
  onClick,
}: {
  title: string;
  detail?: string | null;
  aside?: string;
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:border-neutral-400 ${
        selected ? "border-brand ring-2 ring-brand" : "border-neutral-200"
      }`}
    >
      {multi && (
        <span
          className={`grid size-5 shrink-0 place-items-center rounded border ${
            selected ? "border-brand bg-brand text-brand-fg" : "border-neutral-300"
          }`}
        >
          {selected && <Check className="size-3.5" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {detail && <span className="block text-sm text-neutral-500">{detail.trim()}</span>}
      </span>
      {aside && <span className="shrink-0 text-sm font-medium">{aside}</span>}
    </button>
  );
}

function Choice<K extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: K | undefined;
  options: Record<K, string>;
  onChange: (value: K) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(options) as K[]).map((k) => (
          <button key={k} type="button" onClick={() => onChange(k)} className={chip(value === k)}>
            {options[k]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  multiline,
  placeholder,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: "numeric";
  maxLength?: number;
}) {
  const className =
    "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";
  return (
    <label className="grid gap-1.5 text-sm">
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      ) : (
        <input
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      )}
    </label>
  );
}

function Continue({
  label = "Continue",
  disabled,
  pending,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  pending?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={onClick}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-40"
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </button>
  );
}

function QuoteLines({ quote, showDeposit }: { quote: Quote; showDeposit?: boolean }) {
  return (
    <div className="text-sm">
      <ul className="grid gap-1.5">
        {quote.lines.map((line, i) => (
          <li key={i} className="flex justify-between gap-4">
            <span className="text-neutral-600">{line.label}</span>
            <span>{formatPence(line.amount_pence)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t pt-3 text-base font-semibold">
        <span>Total</span>
        <span>{formatPence(quote.total_pence)}</span>
      </div>
      {showDeposit && quote.deposit_pence > 0 && (
        <div className="mt-1 flex justify-between text-neutral-500">
          <span>Deposit to secure the booking</span>
          <span>{formatPence(quote.deposit_pence)}</span>
        </div>
      )}
    </div>
  );
}

// Stripe's checkout page can't load inside another page, and the embed puts
// this form in an iframe. So the embed script is asked to take the whole
// window there; on its own page it's a plain redirect.
function goToCheckout(url: string) {
  if (window.parent !== window) {
    window.parent.postMessage({ type: "instant-quote:checkout", url }, "*");
  } else {
    window.location.href = url;
  }
}

function chip(selected: boolean) {
  return `shrink-0 rounded-xl border px-3 py-2 text-center text-sm transition ${
    selected ? "border-brand bg-brand text-brand-fg" : "border-neutral-200 bg-white hover:border-neutral-400"
  }`;
}

function formatInstant(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
