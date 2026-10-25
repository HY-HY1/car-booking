"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import { signupSchema } from "@leadgen/core/billing/rules";
import { Field } from "@/components/platform/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { signUpAction, type SignUpState } from "./actions";
import { PaymentStep } from "./payment-step";
import { appUrl, marketingUrl } from "@/lib/urls";

// Three stages. The first two are one form whose fields stay mounted (the
// other stage is just hidden); each is checked with the same schema the server
// uses before moving on. Continuing from the second stage sends everything to
// the server action, which creates the account and business and hands back a
// Stripe client secret. The third stage is Stripe's card form on this page.
// From then on the account exists, so the earlier stages are locked.

const STEPS = [
  { label: "Your account", title: "Create your account", text: "You'll use these to sign in." },
  { label: "Your business", title: "Tell us about your business", text: "This sets up your booking page. You can change all of it later." },
  { label: "Start trial", title: "Add a card to start your trial", text: "Nothing is charged today." },
] as const;

type FieldName = "name" | "email" | "password" | "businessName" | "trade" | "locations" | "postcode";
type Data = Record<FieldName, string>;

const STEP_FIELDS: string[][] = [
  ["name", "email", "password"],
  ["businessName", "trade", "locations", "postcode", "terms"],
];
const STEP_SCHEMAS = [
  signupSchema.pick({ name: true, email: true, password: true }),
  signupSchema.pick({ businessName: true, trade: true, locations: true, postcode: true }),
];
const stepOf = (field: string) => STEP_FIELDS.findIndex((fields) => fields.includes(field));

const TRADES = [
  { value: "detailing", label: "Detailing" },
  { value: "valeting", label: "Valeting" },
  { value: "both", label: "Both" },
];
const LOCATIONS = [
  { value: "mobile", label: "Mobile", text: "I go to customers" },
  { value: "unit", label: "Unit", text: "Customers come to me" },
  { value: "both", label: "Both", text: "Mobile and a unit" },
];
const POSTCODE_HINT: Record<string, string> = {
  mobile: "Where your van sets off from. Used to work out travel time between jobs.",
  unit: "The postcode of your unit.",
  both: "Your base. Used for your van and your unit; you can change them separately later.",
};
const label = (options: { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

export function SignUpForm({ alreadySignedIn }: { alreadySignedIn: boolean }) {
  // Only what was true when the page opened counts: signing up signs the new
  // user in, and that must not send them away mid-way (see page.tsx).
  const [arrivedSignedIn] = useState(alreadySignedIn);
  const router = useRouter();
  useEffect(() => {
    if (arrivedSignedIn) router.replace(appUrl());
  }, [arrivedSignedIn, router]);

  const [state, formAction, pending] = useActionState<SignUpState, FormData>(signUpAction, {});
  const [data, setData] = useState<Data>({
    name: "",
    email: "",
    password: "",
    businessName: "",
    trade: "detailing",
    locations: "mobile",
    postcode: "",
  });
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  // Once the account exists there's a card form to show, and no way back.
  const checkout = state.checkout;

  // A reply from the server: on success, the card form; otherwise its errors,
  // on the stage they belong to.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    setErrors(state.errors ?? {});
    if (state.checkout) {
      setStep(STEPS.length - 1);
    } else {
      const stages = Object.keys(state.errors ?? {}).map((f) => stepOf(f));
      // A problem with no field of its own happened after the business stage.
      setStep(stages.length ? Math.max(0, Math.min(...stages)) : 1);
    }
  }

  // Land on the new stage's heading, for screen readers and keyboards.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  const set = (field: FieldName, value: string) => {
    setData((d) => ({ ...d, [field]: value }));
    setErrors((e) => (e[field] ? Object.fromEntries(Object.entries(e).filter(([key]) => key !== field)) : e));
  };

  const next = () => {
    const found: Record<string, string> = {};
    const result = STEP_SCHEMAS[step]?.safeParse(data);
    if (result && !result.success) {
      for (const issue of result.error.issues) found[String(issue.path[0])] ??= issue.message;
    }
    if (step === 1 && !agreed) found.terms = "Tick the box to agree before continuing.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // After the first stage, on to the second; after the second, create the account.
    if (step === 0) setStep(1);
    else form.current?.requestSubmit();
  };

  const last = step === STEPS.length - 1;
  const bind = (field: FieldName) => ({
    id: field,
    name: field,
    value: data[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(field, e.target.value),
    "aria-invalid": Boolean(errors[field]) || undefined,
  });

  if (arrivedSignedIn) return <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>;

  return (
    <div className="grid gap-8">
      <Breadcrumb step={step} locked={Boolean(checkout)} onGo={setStep} />

      <div className="grid gap-1">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
          {STEPS[step].title}
        </h2>
        <p className="text-sm text-muted-foreground">{STEPS[step].text}</p>
      </div>

      <form
        ref={form}
        action={formAction}
        noValidate
        hidden={Boolean(checkout)}
        className="grid gap-8"
        // Enter on the first two stages moves on rather than submitting.
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            if (!pending) next();
          }
        }}
      >
        {/* Bots fill this in; people never see it. */}
        <div aria-hidden className="absolute left-[-9999px]">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <div hidden={step !== 0} className="grid gap-4">
          <Field label="Your name" name="name" error={errors.name}>
            <Input {...bind("name")} autoComplete="name" />
          </Field>
          <Field label="Email" name="email" error={errors.email}>
            <Input {...bind("email")} type="email" autoComplete="email" />
          </Field>
          <Field label="Password" name="password" error={errors.password} hint="At least 8 characters.">
            <Input {...bind("password")} type="password" autoComplete="new-password" />
          </Field>
        </div>

        <div hidden={step !== 1} className="grid gap-5">
          <Field label="Business name" name="businessName" error={errors.businessName}>
            <Input {...bind("businessName")} autoComplete="organization" />
          </Field>
          <Choice
            legend="What do you do?"
            name="trade"
            value={data.trade}
            onChange={(v) => set("trade", v)}
            options={TRADES}
            columns="sm:grid-cols-3"
            error={errors.trade}
          />
          <Choice
            legend="Where do you work?"
            name="locations"
            value={data.locations}
            onChange={(v) => set("locations", v)}
            options={LOCATIONS}
            columns="sm:grid-cols-3"
            error={errors.locations}
          />
          <Field label="Postcode" name="postcode" error={errors.postcode} hint={POSTCODE_HINT[data.locations]}>
            <Input {...bind("postcode")} autoComplete="postal-code" placeholder="BS1 4DJ" className="sm:max-w-40" />
          </Field>
        </div>

        <div hidden={step !== 1} className="grid gap-1">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="terms"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setErrors((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== "terms")));
              }}
              aria-invalid={Boolean(errors.terms) || undefined}
              className="mt-0.5 size-4"
            />
            <span>
              I agree to the{" "}
              <a href={marketingUrl("/legal/terms")} target="_blank" rel="noopener" className="underline">Terms of Service</a> and the{" "}
              <a href={marketingUrl("/legal/dpa")} target="_blank" rel="noopener" className="underline">Data Processing Terms</a>, and have
              read the{" "}
              <a href={marketingUrl("/legal/privacy")} target="_blank" rel="noopener" className="underline">Privacy Policy</a>.
            </span>
          </label>
          {errors.terms && <p role="alert" className="text-sm text-destructive">{errors.terms}</p>}
        </div>

        {state.message && !Object.keys(errors).length && !checkout && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" size="lg" onClick={() => setStep(step - 1)} disabled={pending}>
              <ArrowLeft />
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="lg" onClick={next} disabled={pending} className="px-4">
            {pending ? "Creating your account…" : "Continue"}
            {!pending && <ArrowRight />}
          </Button>
        </div>
      </form>

      {checkout && last && (
        <div className="grid gap-6">
          <dl className="divide-y rounded-xl ring-1 ring-foreground/10">
            <Row title="Account">
              {data.name}
              <br />
              <span className="text-muted-foreground">{data.email}</span>
            </Row>
            <Row title="Business">
              {data.businessName}
              <br />
              <span className="text-muted-foreground">
                {label(TRADES, data.trade)} · {label(LOCATIONS, data.locations)} · {data.postcode.toUpperCase()}
              </span>
            </Row>
          </dl>
          <PaymentStep clientSecret={checkout.clientSecret} priceLabel={checkout.priceLabel} />
          <p className="text-xs text-muted-foreground">
            Your account is created. You can change your business details any time under Settings.
          </p>
        </div>
      )}
    </div>
  );
}

// `locked`: the account exists, so finished stages can no longer be reopened.
function Breadcrumb({ step, locked, onGo }: { step: number; locked: boolean; onGo: (step: number) => void }) {
  return (
    <nav aria-label="Sign-up progress">
      {/* Whole steps drop to a second line when space runs out; a label never wraps or squeezes. */}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm sm:gap-x-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const content = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  done || current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              {/* Only the current stage keeps its name on a phone. */}
              <span className={cn("whitespace-nowrap", !current && "hidden sm:inline", current ? "font-medium" : "text-muted-foreground")}>
                {s.label}
                {done && <span className="sr-only">{locked ? " (done)" : " (done, go back)"}</span>}
              </span>
            </>
          );
          return (
            <li key={s.label} className="flex items-center gap-1.5 sm:gap-2">
              {i > 0 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              {done && !locked ? (
                <button
                  type="button"
                  onClick={() => onGo(i)}
                  className="flex items-center gap-2 rounded-md outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {content}
                </button>
              ) : (
                <span aria-current={current ? "step" : undefined} className="flex items-center gap-2">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Radio buttons drawn as cards: a real input underneath, so the keyboard,
// screen readers and the form data all work as normal.
function Choice({
  legend,
  name,
  value,
  onChange,
  options,
  columns,
  error,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; text?: string }[];
  columns: string;
  error?: string;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className={cn("grid gap-2", columns)}>
        {options.map((o) => (
          <label
            key={o.value}
            className="group relative flex cursor-pointer items-start justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-muted/60 has-checked:ring-1 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className="grid gap-0.5">
              <span className="font-medium">{o.label}</span>
              {o.text && <span className="text-xs text-muted-foreground">{o.text}</span>}
            </span>
            <span
              aria-hidden
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-primary-foreground group-has-checked:border-primary group-has-checked:bg-primary"
            >
              <Check className="size-3 opacity-0 group-has-checked:opacity-100" />
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 p-4 text-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </div>
  );
}
