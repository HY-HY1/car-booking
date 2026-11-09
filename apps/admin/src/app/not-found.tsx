import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";
import { appUrl, marketingUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <StatusPage
        brand
        code="404"
        title="We can't find that page"
        actions={
          <>
            <Link href={appUrl()} className={buttonVariants({ size: "lg" })}>
              Go to your dashboard
            </Link>
            <Link href={marketingUrl()} className={buttonVariants({ size: "lg", variant: "outline" })}>
              Home page
            </Link>
          </>
        }
      >
        The link may be out of date, or the page may have moved.
      </StatusPage>
    </div>
  );
}
