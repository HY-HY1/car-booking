import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatPence } from "@leadgen/core/booking/config";
import { listPayments, type PaymentWithBooking } from "@leadgen/core/stripe/payment-list";
import { requireTenant } from "@/lib/auth";
import { PAYMENT_SOURCE, PAYMENT_STATUS } from "@/lib/payment-labels";
import { cn } from "@/lib/utils";
import { OwnersOnly, StripeNotConnected } from "./notices";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/payments">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireTenant(slug);
  if (!can("money")) return <OwnersOnly />;

  const after = (await searchParams).after;
  const page = await listPayments(tenant.id, typeof after === "string" ? after : undefined);
  if (!page.connected) return <StripeNotConnected slug={slug} />;

  const base = appUrl(`/${slug}/payments`);

  if (page.payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {after ? "No more payments." : "No payments yet. They appear here as soon as a customer pays."}
        {after && (
          <>
            {" "}
            <Link href={base} className="underline underline-offset-4">
              Back to the latest
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">For</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium sr-only">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {page.payments.map((p) => (
              <PaymentRow key={p.id} p={p} slug={slug} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        {after ? (
          <Link href={base} className="text-muted-foreground underline-offset-4 hover:underline">
            Back to the latest
          </Link>
        ) : (
          <span />
        )}
        {page.nextCursor && (
          <Link href={`${base}?after=${page.nextCursor}`} className="font-medium underline-offset-4 hover:underline">
            Older payments
          </Link>
        )}
      </div>
    </>
  );
}

function PaymentRow({ p, slug }: { p: PaymentWithBooking; slug: string }) {
  const status = PAYMENT_STATUS[p.status];
  const name = p.booking?.customerName ?? p.customerName;
  return (
    <tr className="align-top hover:bg-muted/30">
      <td className="px-4 py-3 whitespace-nowrap">{formatWhen(p.createdAt)}</td>
      <td className="px-4 py-3">
        <span className="font-medium">{name ?? "—"}</span>
        {p.customerEmail && <span className="block text-xs text-muted-foreground">{p.customerEmail}</span>}
      </td>
      <td className="px-4 py-3">
        {PAYMENT_SOURCE[p.source]}
        {p.booking ? (
          <Link
            href={appUrl(`/${slug}/bookings/${p.booking.id}`)}
            className="block text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {[p.booking.serviceName, formatWhen(p.booking.startsAt)].filter(Boolean).join(", ")}
          </Link>
        ) : (
          p.description && <span className="block text-xs text-muted-foreground">{p.description}</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {formatPence(p.amountPence)}
        {p.refundedPence > 0 && (
          <span className="block text-xs text-muted-foreground">{formatPence(p.refundedPence)} refunded</span>
        )}
        {p.feePence !== null && p.netPence !== null && (
          <span className="block text-xs text-muted-foreground">
            Fee {formatPence(p.feePence)} · You get {formatPence(p.netPence)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.tone)}>{status.label}</span>
      </td>
      <td className="px-4 py-3">
        {p.receiptUrl && (
          <a
            href={p.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the receipt"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </td>
    </tr>
  );
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}
