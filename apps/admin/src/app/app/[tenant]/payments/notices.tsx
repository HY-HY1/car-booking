import Link from "next/link";
import { appUrl } from "@/lib/urls";

export function OwnersOnly() {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      Payments are only visible to the business owner.
    </div>
  );
}

export function StripeNotConnected({ slug }: { slug: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      Stripe isn&apos;t connected yet.{" "}
      <Link href={appUrl(`/${slug}/settings/payments`)} className="underline underline-offset-4">
        Connect it under Settings
      </Link>{" "}
      to see payments and create payment links.
    </div>
  );
}
