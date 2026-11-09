import { getRequestTenant } from "@/lib/tenant";
import { pageUrl, tenantUrl } from "@/lib/urls";

export default async function NotFound() {
  const dev = process.env.NODE_ENV === "development";
  const tenant = await getRequestTenant();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
      {tenant?.branding.logo_url ? (
        // On the brand colour, as on the home page: a logo can be white.
        <span className="mb-6 rounded-xl bg-brand px-5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tenant.branding.logo_url} alt={tenant.name} className="h-8 w-auto" />
        </span>
      ) : (
        tenant && <p className="mb-6 text-lg font-semibold tracking-tight">{tenant.name}</p>
      )}
      <p className="font-mono text-sm text-neutral-500">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">We can&apos;t find that page</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        {tenant
          ? "The link may be out of date. You can still get a quote and book from the home page."
          : "Check the link you were sent, or go back to the business's website."}
      </p>
      {tenant && (
        <a
          href={pageUrl(tenant, "/")}
          className="mt-4 inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-brand-fg transition hover:opacity-90"
        >
          Back to {tenant.name}
        </a>
      )}
      {dev && !tenant && (
        <p className="mt-2 grid gap-1 text-sm">
          <span className="text-neutral-500">Each business has its own booking pages. Try:</span>
          <a className="underline" href={tenantUrl("ascnd")}>{tenantUrl("ascnd", "/", { absolute: true })}</a>
          <a className="underline" href={tenantUrl("ascnd", "/embed-test")}>The embed test page</a>
        </p>
      )}
    </main>
  );
}
