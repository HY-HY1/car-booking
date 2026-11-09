"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";
import { appUrl } from "@/lib/urls";

// Something that no longer exists: a deleted booking, or an old link to one.
export default function DashboardNotFound() {
  const { tenant } = useParams<{ tenant: string }>();
  return (
    <StatusPage
      code="404"
      title="We can't find that"
      actions={
        <Link href={appUrl(`/${tenant}`)} className={buttonVariants({ size: "lg" })}>
          Back to the overview
        </Link>
      }
    >
      It may have been deleted, or the link may be out of date.
    </StatusPage>
  );
}
