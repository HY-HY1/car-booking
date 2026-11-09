import Link from "next/link";
import { appUrl } from "@/lib/urls";
import { EmptyState } from "@/components/ui/empty-state";

export function OwnersOnly() {
  return (
    <EmptyState>
      Payments are only visible to the business owner.
    </EmptyState>
  );
}

export function StripeNotConnected({ slug }: { slug: string }) {
  return (
    <EmptyState>
      Stripe isn&apos;t connected yet.{" "}
      <Link href={appUrl(`/${slug}/settings/payments`)} className="underline underline-offset-4">
        Connect it under Settings
      </Link>{" "}
      to see payments and create payment links.
    </EmptyState>
  );
}
