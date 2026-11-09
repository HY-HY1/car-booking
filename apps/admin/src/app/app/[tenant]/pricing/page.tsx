import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { formatPence, SIZE_CLASSES } from "@leadgen/core/booking/config";
import { getQuote } from "@leadgen/core/booking/pricing";
import { PageHeader } from "@/components/dashboard/page-header";
import { AddOnEditor, NewAddOn, RulesForm } from "@/components/dashboard/pricing-forms";
import { ServicesTable } from "@/components/dashboard/services-table";
import { SortableRows } from "@/components/dashboard/sortable";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { loadPricing } from "@/lib/pricing";
import {
  SIZES,
  type EditableAddOn,
  type EditableService,
  type PricingRules,
} from "@/lib/pricing-fields";
import { deleteAddOn, reorderAddOns, reorderServices, saveAddOn, savePricingRules } from "./actions";
import { appUrl } from "@/lib/urls";
import { EmptyState } from "@/components/ui/empty-state";

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
        <EmptyState>Booking isn&apos;t set up for this business yet.</EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pricing" />
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
          <ServicesTable services={services} base={base} readOnly={readOnly} reorder={reorderServices.bind(null, slug)} />
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
          {addOns.length === 0 && <EmptyState compact>No extras yet.</EmptyState>}
          <SortableRows
            readOnly={readOnly}
            save={reorderAddOns.bind(null, slug)}
            items={addOns.map((a) => ({
              id: a.id,
              label: a.name,
              content: (
                <AddOnEditor
                  addOn={a}
                  services={services}
                  action={saveAddOn.bind(null, slug, a.id)}
                  deleteAction={deleteAddOn.bind(null, slug, a.id)}
                  readOnly={readOnly}
                />
              ),
            }))}
          />
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
