import type { ReactNode } from "react";
import type { PublicTenant } from "@leadgen/core/tenants";
import { SiteFrame } from "@/components/site";

// Shared frame for the privacy notice, terms and request pages.
export function LegalPage({
  tenant,
  title,
  updated,
  children,
}: {
  tenant: PublicTenant;
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <SiteFrame tenant={tenant}>
      <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <article className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 text-neutral-700 sm:p-10 [&_h2]:mt-10 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-neutral-950 [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_strong]:text-neutral-950 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-neutral-400">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{title}</h1>
          {updated && <p className="mt-1! text-sm text-neutral-500">Last updated {updated}</p>}
          {children}
        </article>
      </main>
    </SiteFrame>
  );
}
