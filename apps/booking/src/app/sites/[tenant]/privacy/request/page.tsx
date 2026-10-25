import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal-page";
import { getRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Privacy request" };

export default async function PrivacyRequestPage() {
  const tenant = await getRequestTenant();
  if (!tenant) notFound();
  return (
    <LegalPage title="Make a privacy request">
      <p>
        Use this form to ask {tenant.privacy.legalName || tenant.name} for a copy of your data, to
        correct or erase it, or to stop marketing. See the{" "}
        <Link href={pageUrl(tenant, "/privacy")} className="underline">privacy notice</Link> for what we hold and why.
      </p>
      <RequestForm />
    </LegalPage>
  );
}
