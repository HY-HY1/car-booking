import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight, ImageIcon, Plus } from "lucide-react";
import { formatDuration, formatPence, SIZE_CLASSES } from "@leadgen/core/booking/config";
import { getQuote } from "@leadgen/core/booking/pricing";
import { ComingSoon, PageHeader } from "@/components/dashboard/page-header";
import { AddOnEditor, NewAddOn, RulesForm } from "@/components/dashboard/pricing-forms";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { loadPricing } from "@/lib/pricing";
import {
  serviceImageUrl,
  SIZES,
  type EditableAddOn,
  type EditableService,
  type PricingRules,
} from "@/lib/pricing-fields";
import { cn } from "@/lib/utils";
import { deleteAddOn, saveAddOn, savePricingRules } from "./actions";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage({ params }: PageProps<"/app/[tenant]/pricing">) {
  // Everything here is per signed-in user, so render at request time.
  await connection();
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "pricing.view");
  const { rules, services, addOns } = await loadPricing(tenant.id);
  const readOnly = !can("pricing.edit");
  const base = appUrl(`/${slug}/pricing`);

  if (!rules) {
    return (
      <>
        <PageHeader title="Pricing" />
        <ComingSoon>Booking isn&apos;t set up for this business yet.</ComingSoon>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Your services, extras and pricing rules. Open a service to edit everything customers see about it."
      />
      {readOnly && (
        <p className="mb-6 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Only the business owner can change prices.
        </p>
      )}

      <div className="grid max-w-5xl gap-10">
        <Tiles services={services} addOns={addOns} rules={rules} />

        <section aria-labelledby="services-heading" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="services-heading" className="text-lg font-semibold tracking-tight">
                Services
              </h2>
              <p className="text-sm text-muted-foreground">Each one has its own page customers read before booking.</p>
            </div>
            {!readOnly && (
              <Link href={`${base}/services/new`} className={buttonVariants()}>
                <Plus /> Add a service
              </Link>
            )}
          </div>
          <ServicesTable services={services} base={base} readOnly={readOnly} />
        </section>

        <section aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="mb-1 text-lg font-semibold tracking-tight">
            What customers are quoted
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Worked out by the booking page&apos;s own pricing code
            {previewTier(rules) ? (
              <> for the &ldquo;{previewTier(rules)!.label.split(":")[0]}&rdquo; condition</>
            ) : (
              rules.condition_tiers.length > 0 && <> with no condition uplift</>
            )}
            , before extras.
          </p>
          <QuotePreview services={services.filter((s) => s.active)} rules={rules} />
        </section>

        <section aria-labelledby="extras-heading" className="grid max-w-3xl gap-3">
          <h2 id="extras-heading" className="text-lg font-semibold tracking-tight">
            Extras
          </h2>
          {addOns.length === 0 && <p className="text-sm text-muted-foreground">No extras yet.</p>}
          {addOns.map((a) => (
            <AddOnEditor
              key={a.id}
              addOn={a}
              services={services}
              action={saveAddOn.bind(null, slug, a.id)}
              deleteAction={deleteAddOn.bind(null, slug, a.id)}
              readOnly={readOnly}
            />
          ))}
          <NewAddOn services={services} action={saveAddOn.bind(null, slug, null)} readOnly={readOnly} />
        </section>

        <section aria-labelledby="rules-heading" className="max-w-3xl">
          <h2 id="rules-heading" className="mb-1 text-lg font-semibold tracking-tight">
            Minimum and condition
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The deposit is set under{" "}
            <Link href={appUrl(`/${slug}/settings/payments`)} className="underline underline-offset-4">
              Settings → Payments
            </Link>
            .
          </p>
          <RulesForm rules={rules} action={savePricingRules.bind(null, slug)} readOnly={readOnly} />
        </section>
      </div>
    </>
  );
}

function Tiles({ services, addOns, rules }: { services: EditableService[]; addOns: EditableAddOn[]; rules: PricingRules }) {
  const live = services.filter((s) => s.active);
  const prices = live.map((s) => s.base_price_pence);
  const deposit =
    rules.deposit.type === "percent"
      ? `${rules.deposit.value}%`
      : rules.deposit.type === "fixed"
        ? formatPence(rules.deposit.value_pence)
        : rules.deposit.type === "full"
          ? "Full price"
          : "None";
  const tiles = [
    { label: "Live services", value: `${live.length}`, note: `${services.length - live.length} hidden` },
    {
      label: "Prices from",
      value: prices.length ? formatPence(Math.min(...prices)) : "—",
      note: prices.length ? `up to ${formatPence(Math.max(...prices))}` : "No live services",
    },
    { label: "Extras", value: `${addOns.filter((a) => a.active).length}`, note: "offered at booking" },
    {
      label: "Deposit",
      value: deposit,
      note: rules.min_price_pence ? `minimum job ${formatPence(rules.min_price_pence)}` : "no minimum job",
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card p-4">
          <dt className="text-xs font-medium text-muted-foreground">{t.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{t.value}</dd>
          <dd className="text-xs text-muted-foreground">{t.note}</dd>
        </div>
      ))}
    </dl>
  );
}

// What a service's page still needs before it reads well.
function pageChecklist(s: EditableService) {
  return [
    { label: "Header image", done: Boolean(s.image_path) },
    { label: "Tagline", done: Boolean(s.tagline) },
    { label: "Description", done: Boolean(s.description || s.body) },
    { label: "What's included", done: Boolean(s.includes?.length) },
    { label: "How it works", done: Boolean(s.steps?.length) },
    { label: "Questions", done: Boolean(s.faqs?.length) },
  ];
}

function PageStatus({ service }: { service: EditableService }) {
  const checks = pageChecklist(service);
  const done = checks.filter((c) => c.done).length;
  const missing = checks.filter((c) => !c.done).map((c) => c.label);
  return (
    <div title={missing.length ? `Still to add: ${missing.join(", ")}` : "Page is complete"} className="grid gap-1">
      <div
        role="progressbar"
        aria-label="Page completeness"
        aria-valuemin={0}
        aria-valuemax={checks.length}
        aria-valuenow={done}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", done === checks.length ? "bg-emerald-600" : "bg-primary")}
          style={{ width: `${(done / checks.length) * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {done === checks.length ? "Complete" : `${done} of ${checks.length} done`}
      </span>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-emerald-600" : "bg-muted-foreground/60")} />
      {active ? "Live" : "Hidden"}
    </span>
  );
}

function Thumb({ service, className }: { service: EditableService; className: string }) {
  const image = serviceImageUrl(service.image_path);
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={cn("shrink-0 rounded-md object-cover", className)} />
  ) : (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground", className)}>
      <ImageIcon className="size-4" />
    </span>
  );
}

function ServicesTable({ services, base, readOnly }: { services: EditableService[]; base: string; readOnly: boolean }) {
  if (!services.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">No services yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Add your first service to start taking bookings.</p>
        {!readOnly && (
          <Link href={`${base}/services/new`} className={cn(buttonVariants(), "mt-4")}>
            <Plus /> Add a service
          </Link>
        )}
      </div>
    );
  }
  return (
    <>
      {/* Phones: one card per service. */}
      <ul className="grid gap-3 md:hidden">
        {services.map((s) => (
          <li key={s.id}>
            <Link
              href={`${base}/services/${s.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Thumb service={s} className="h-14 w-20" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.name}</span>
                  <StatusBadge active={s.active} />
                </span>
                <span className="block text-sm text-muted-foreground">
                  From {formatPence(s.base_price_pence)} · {formatDuration(s.duration_mins)}
                </span>
                <span className="mt-1.5 block">
                  <PageStatus service={s} />
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {/* Larger screens: a table, every cell a link to the service's page. */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Service</th>
              <th scope="col" className="px-4 py-2.5 font-medium">From</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Takes</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Page</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="w-10 px-2 py-2.5">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {services.map((s) => {
              const href = `${base}/services/${s.id}`;
              const cell = "block px-4 py-3";
              return (
                <tr key={s.id} className="group transition-colors hover:bg-muted/40">
                  <td>
                    <Link
                      href={href}
                      className={cn(cell, "flex items-center gap-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
                    >
                      <Thumb service={s} className="h-10 w-16" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium">
                          {s.name}
                          {s.badge && (
                            <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-normal text-accent-foreground">{s.badge}</span>
                          )}
                        </span>
                        {s.tagline && <span className="block max-w-xs truncate text-xs text-muted-foreground">{s.tagline}</span>}
                      </span>
                    </Link>
                  </td>
                  <td>
                    <Link href={href} tabIndex={-1} className={cn(cell, "tabular-nums")}>
                      {formatPence(s.base_price_pence)}
                    </Link>
                  </td>
                  <td>
                    <Link href={href} tabIndex={-1} className={cn(cell, "whitespace-nowrap")}>
                      {formatDuration(s.duration_mins)}
                    </Link>
                  </td>
                  <td>
                    <Link href={href} tabIndex={-1} className={cell}>
                      <PageStatus service={s} />
                    </Link>
                  </td>
                  <td>
                    <Link href={href} tabIndex={-1} className={cell}>
                      <StatusBadge active={s.active} />
                    </Link>
                  </td>
                  <td className="px-2 text-muted-foreground">
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// The condition level the preview prices at: the first with a price of its own.
function previewTier(rules: PricingRules) {
  return rules.condition_tiers.find((t) => !t.needs_inspection);
}

function QuotePreview({ services, rules }: { services: EditableService[]; rules: PricingRules }) {
  if (!services.length) {
    return <p className="text-sm text-muted-foreground">No services are showing on the booking page.</p>;
  }
  const condition = previewTier(rules)?.key ?? null;
  const price = (service: EditableService, size: (typeof SIZES)[number]) => {
    const locationType = service.location_types.includes("mobile") && rules.offers_mobile ? "mobile" : "unit";
    try {
      return formatPence(
        getQuote({
          service,
          addOns: [],
          addOnIds: [],
          sizeClass: size,
          conditionKey: condition,
          locationType,
          settings: rules,
        }).total_pence,
      );
    } catch {
      return "—";
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Service</th>
            {SIZES.map((size) => (
              <th key={size} scope="col" className="px-4 py-2 font-medium whitespace-nowrap">
                {SIZE_CLASSES[size].split(":")[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {services.map((s) => (
            <tr key={s.id}>
              <th scope="row" className="px-4 py-2.5 text-left font-medium">{s.name}</th>
              {SIZES.map((size) => (
                <td key={size} className="px-4 py-2.5 tabular-nums">
                  {price(s, size)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
