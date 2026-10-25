import type { ReactNode } from "react";

// Shared frame for the privacy notice and request pages.
export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <main className="flex-1 px-4 py-12">
      <article className="mx-auto max-w-2xl [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {updated && <p className="!mt-1 text-sm text-neutral-500">Last updated {updated}</p>}
        {children}
      </article>
    </main>
  );
}
