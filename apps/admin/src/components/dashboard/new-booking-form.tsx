"use client";

import { useActionState, useRef, useState } from "react";
import { X } from "lucide-react";
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
import { depositFor, getQuote, QuoteError, type PricingSettings } from "@leadgen/core/booking/pricing";
import type { NewBookingState } from "@/app/app/[tenant]/bookings/new/actions";
import { Field } from "@/components/dashboard/form-kit";
import { useUnsavedChanges } from "@/components/dashboard/unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox, Radio } from "@/components/ui/checkbox";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  postcode: string | null;
};

// "Add booking". The price comes from the same price list as the booking
// page (getQuote), worked out as the form is filled in; the owner can change
// the price, the length and the deposit. Every field is controlled, so what
// was typed survives an error from the server.
export function NewBookingForm({
  action,
  services,
  addOns,
  pricing,
  resources,
  hasUnit,
  unitAddress,
  stripeReady,
  defaults,
}: {
  action: (state: NewBookingState, formData: FormData) => Promise<NewBookingState>;
  services: Service[];
  addOns: AddOn[];
  pricing: PricingSettings;
  resources: { id: string; name: string; location_types: LocationType[] }[];
  hasUnit: boolean;
  unitAddress: string | null;
  stripeReady: boolean;
  defaults: { date: string; time: string; resourceId: string; customer: Customer | null };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};
  const form = useRef<HTMLFormElement>(null);
  useUnsavedChanges(form);

  const [customer, setCustomer] = useState(defaults.customer);
  const [name, setName] = useState(defaults.customer?.name ?? "");
  const [email, setEmail] = useState(defaults.customer?.email ?? "");
  const [phone, setPhone] = useState(defaults.customer?.phone ?? "");

  const locations = (Object.keys(LOCATION_TYPES) as LocationType[]).filter(
    (l) => resources.some((r) => r.location_types.includes(l)) && (l === "mobile" || hasUnit),
  );
  const [serviceId, setServiceId] = useState(services[0].id);
  const service = services.find((s) => s.id === serviceId)!;
  const [sizeClass, setSizeClass] = useState<SizeClass>("medium");
  const [conditionKey, setConditionKey] = useState("");
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [locationType, setLocationType] = useState<LocationType>(
    locations.find((l) => service.location_types.includes(l)) ?? locations[0] ?? "mobile",
  );
  const [addressLine, setAddressLine] = useState(defaults.customer?.address_line ?? "");
  const [postcode, setPostcode] = useState(defaults.customer?.postcode ?? "");

  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [resourceId, setResourceId] = useState(defaults.resourceId);
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [registration, setRegistration] = useState("");
  const [notes, setNotes] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [requestDeposit, setRequestDeposit] = useState(true);

  const extras = addOns.filter((a) => addOnFitsService(a, serviceId));
  const chosenExtras = addOnIds.filter((id) => extras.some((a) => a.id === id));
  const vans = resources.filter((r) => r.location_types.includes(locationType));

  let quote = null;
  let quoteError: string | null = null;
  try {
    quote = getQuote({
      service,
      addOns,
      addOnIds: chosenExtras,
      sizeClass,
      conditionKey: conditionKey || null,
      locationType,
      settings: pricing,
    });
  } catch (error) {
    if (!(error instanceof QuoteError)) throw error;
    quoteError = error.message;
  }

  const pounds = (v: string) => (/^£?\d+(\.\d{1,2})?$/.test(v.trim()) ? Math.round(Number(v.trim().replace(/^£/, "")) * 100) : null);
  const total = quote ? (pounds(price) ?? quote.total_pence) : 0;
  const usualDeposit = depositFor(total, pricing.deposit);
  const depositPence = Math.min(pounds(deposit) ?? usualDeposit, total);
  const canRequestDeposit = depositPence > 0 && stripeReady && !!email.trim();

  return (
    <form ref={form} action={formAction} className="grid max-w-3xl gap-8" noValidate>
      {customer && <input type="hidden" name="customer_id" value={customer.id} />}
      <input type="hidden" name="add_on_ids" value={chosenExtras.join(",")} />

      <Section title="Customer">
        {customer && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
            Booking for {customer.name}, who&apos;s already a customer.
            <button
              type="button"
              onClick={() => setCustomer(null)}
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              <X className="size-3.5" />
              Someone else
            </button>
          </p>
        )}
        <Field label="Name" name="name" error={errors.name} className="sm:col-span-2">
          <Input name="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email (for their confirmation)" name="email" error={errors.email}>
          <Input name="email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone" name="phone" error={errors.phone}>
          <Input name="phone" type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {!customer && (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            If someone with this email or phone is already a customer, the booking goes on their record.
          </p>
        )}
      </Section>

      <Section title="The job">
        <Field label="Service" name="service_id" error={errors.service_id}>
          <Select name="service_id" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Car size" name="size_class" error={errors.size_class}>
          <Select
            name="size_class"
            value={sizeClass}
            onChange={(e) => setSizeClass(e.target.value as SizeClass)}
          >
            {(Object.entries(SIZE_CLASSES) as [SizeClass, string][]).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {pricing.condition_tiers.length > 0 && (
          <Field label="Condition" name="condition_key" error={errors.condition_key}>
            <Select
              name="condition_key"
              value={conditionKey}
              onChange={(e) => setConditionKey(e.target.value)}
            >
              <option value="">Not seen yet (no uplift)</option>
              {pricing.condition_tiers.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {extras.length > 0 && (
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Extras</legend>
            {extras.map((a) => (
              <Checkbox
                key={a.id}
                checked={chosenExtras.includes(a.id)}
                onChange={(e) =>
                  setAddOnIds(e.target.checked ? [...chosenExtras, a.id] : chosenExtras.filter((id) => id !== a.id))
                }
              >
                {a.name}
                <span className="text-muted-foreground">+{formatPence(a.price_pence)}</span>
              </Checkbox>
            ))}
            {errors.add_on_ids && <p className="text-sm text-destructive">{errors.add_on_ids}</p>}
          </fieldset>
        )}

        {locations.length > 1 && (
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Where</legend>
            <div className="flex flex-wrap gap-4">
              {locations.map((l) => (
                <Radio
                  key={l}
                  name="location_type"
                  value={l}
                  checked={locationType === l}
                  onChange={() => {
                    setLocationType(l);
                    setResourceId("");
                  }}
                >
                  {l === "mobile" ? "At the customer's address" : "At your shop"}
                </Radio>
              ))}
            </div>
          </fieldset>
        )}
        {locations.length <= 1 && <input type="hidden" name="location_type" value={locationType} />}
        {locationType === "mobile" ? (
          <>
            <Field label="Address" name="address_line" error={errors.address_line}>
              <Input name="address_line" autoComplete="off" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
            </Field>
            <Field label="Postcode" name="postcode" error={errors.postcode}>
              <Input name="postcode" autoComplete="off" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
            </Field>
          </>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">Drop-off at {unitAddress ?? "your shop"}.</p>
        )}
      </Section>

      <Section title="When">
        <Field label="Date" name="date" error={errors.date}>
          <Input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Start time" name="time" error={errors.time}>
          <Input name="time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {vans.length > 1 && (
          <Field label="Assigned to" name="resource_id" error={errors.resource_id}>
            <Select name="resource_id" value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">Whichever is free</option>
              {vans.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="How long (minutes)" name="duration_mins" error={errors.duration_mins}>
          <Input
            name="duration_mins"
            inputMode="numeric"
            placeholder={quote ? `${quote.duration_mins} (${formatDuration(quote.duration_mins)})` : ""}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          You can book outside your hours or in time off, but not on top of another job on the same van or bay.
        </p>
      </Section>

      <Section title="Price">
        {quoteError ? (
          <p className="text-sm text-destructive sm:col-span-2">{quoteError}</p>
        ) : (
          quote && (
            <ul className="grid gap-1 text-sm sm:col-span-2">
              {quote.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{l.label}</span>
                  <span>{formatPence(l.amount_pence)}</span>
                </li>
              ))}
              <li className="mt-1 flex justify-between gap-4 border-t pt-2 font-medium">
                <span>Price list total</span>
                <span>{formatPence(quote.total_pence)}</span>
              </li>
            </ul>
          )
        )}
        <Field label="Price to charge" name="price" error={errors.price}>
          <MoneyInput
            name="price"
            inputMode="decimal"
            placeholder={quote ? (quote.total_pence / 100).toFixed(2) : ""}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field label="Deposit (0 for none)" name="deposit" error={errors.deposit}>
          <MoneyInput
            name="deposit"
            inputMode="decimal"
            placeholder={(usualDeposit / 100).toFixed(2)}
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Car and notes">
        <Field label="Make" name="make" error={errors.make}>
          <Input name="make" autoComplete="off" value={make} onChange={(e) => setMake(e.target.value)} />
        </Field>
        <Field label="Model" name="model" error={errors.model}>
          <Input name="model" autoComplete="off" value={model} onChange={(e) => setModel(e.target.value)} />
        </Field>
        <Field label="Registration" name="registration" error={errors.registration}>
          <Input
            name="registration"
            autoComplete="off"
            className="font-mono uppercase"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
          />
        </Field>
        <Field label="Notes" name="notes" error={errors.notes} className="sm:col-span-2">
          <Textarea name="notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Section>

      <Section title="Tell the customer">
        <Checkbox
          labelClassName="sm:col-span-2"
          name="send_confirmation"
          checked={sendConfirmation && !!email.trim()}
          disabled={!email.trim()}
          onChange={(e) => setSendConfirmation(e.target.checked)}
        >
          <span>
            Email them their booking confirmation
            {!email.trim() && <span className="block text-muted-foreground">Add their email address to send it.</span>}
          </span>
        </Checkbox>
        <Checkbox
          labelClassName="sm:col-span-2"
          name="request_deposit"
          checked={requestDeposit && canRequestDeposit}
          disabled={!canRequestDeposit}
          onChange={(e) => setRequestDeposit(e.target.checked)}
        >
          <span>
            {depositPence > 0 ? `Email them a link to pay the ${formatPence(depositPence)} deposit` : "Email them a link to pay a deposit"}
            <span className="block text-muted-foreground">
              {depositPence === 0
                ? "There's no deposit on this booking."
                : !stripeReady
                  ? "Connect Stripe under Settings → Payments to take deposits online."
                  : !email.trim()
                    ? "Add their email address to send it."
                    : "They pay it from their booking page. You can send it again from the booking."}
            </span>
          </span>
        </Checkbox>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || !!quoteError}>
          {pending ? "Adding…" : quote ? `Add booking · ${formatPence(total)}` : "Add booking"}
        </Button>
        {state.message && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}
