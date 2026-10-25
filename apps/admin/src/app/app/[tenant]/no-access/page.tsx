import type { Metadata } from "next";
import Link from "next/link";
import { ROLES } from "@leadgen/core/team/access";
import { buttonVariants } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "No access" };

// Where requireAccess() sends someone whose access level doesn't include a page.
export default async function NoAccessPage({ params }: PageProps<"/app/[tenant]/no-access">) {
  const { tenant: slug } = await params;
  const { role } = await requireTenant(slug);
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">That&apos;s not part of your access</h1>
      <p className="text-sm text-muted-foreground">
        You&apos;re a {ROLES[role].label.toLowerCase()} here: {ROLES[role].detail} Ask the business owner if you need more.
      </p>
      <Link href={appUrl(`/${slug}/diary`)} className={buttonVariants({ variant: "outline" })}>
        Go to the diary
      </Link>
    </div>
  );
}
