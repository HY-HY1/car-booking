import { tenantUrl } from "@/lib/urls";

export default function NotFound() {
  const dev = process.env.NODE_ENV === "development";
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        Check the link you were sent, or go back to the business&apos;s website.
      </p>
      {dev && (
        <p className="mt-2 grid gap-1 text-sm">
          <span className="text-neutral-500">Each business has its own booking pages. Try:</span>
          <a className="underline" href={tenantUrl("ascnd")}>{tenantUrl("ascnd", "/", { absolute: true })}</a>
          <a className="underline" href={tenantUrl("ascnd", "/embed-test")}>The embed test page</a>
        </p>
      )}
    </main>
  );
}
