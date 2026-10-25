import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { NewBusinessForm } from "@/components/platform/new-business-form";
import { requirePlatformAdmin } from "@/lib/platform";
import { adminUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "New business" };

export default function NewBusinessPage() {
  return (
    <>
      <BackLink href={adminUrl()}>Businesses</BackLink>
      <PageHeader
        title="New business"
        description="Creates the business, its booking address, starter settings and the owner's login."
      />
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await requirePlatformAdmin(adminUrl("/new"));
  return <NewBusinessForm />;
}
