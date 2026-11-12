import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { formatPhone } from "@leadgen/core/customer-fields";
import type { PublicTenant } from "@leadgen/core/tenants";
import { cn } from "@/lib/cn";
import { pageUrl } from "@/lib/urls";

// The frame every customer page sits in: the business's header, the page,
// and a footer with how to reach them and the legal links. The booking pages
// are built to sit behind a business's own website, so this stays plain: it
// should read as finished on its own without trying to be a whole website.

// One column width for every page, so headers, content and footers line up.
export const container = "mx-auto w-full max-w-5xl px-4 sm:px-6";

type Tenant = Pick<PublicTenant, "name" | "slug" | "customDomain" | "branding" | "contact">;

export function SiteFrame({
  tenant,
  embedded = false,
  bookButton = true,
  bottomBar = false,
  children,
}: {
  tenant: Tenant;
  // Inside the embed script's panel: the panel has its own header, so only
  // the legal links are shown, small.
  embedded?: boolean;
  // Hidden on the booking form itself.
  bookButton?: boolean;
  // The page has a bar fixed to the bottom on phones; keep the footer clear of it.
  bottomBar?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {!embedded && <SiteHeader tenant={tenant} bookButton={bookButton} />}
      {children}
      {embedded ? <LegalLinks tenant={tenant} className="justify-center px-4 py-6" /> : <SiteFooter tenant={tenant} bottomBar={bottomBar} />}
    </>
  );
}

export function SiteHeader({ tenant, bookButton = true }: { tenant: Tenant; bookButton?: boolean }) {
  const website = tenant.branding.website_url;
  return (
    <header className="bg-brand text-brand-fg">
      <div className={cn(container, "flex h-16 items-center justify-between gap-4")}>
        <Link href={pageUrl(tenant)} className="flex min-w-0 items-center gap-3 font-semibold tracking-tight">
          {tenant.branding.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.branding.logo_url} alt={tenant.name} className="h-8 w-auto max-w-44 object-contain object-left" />
          ) : (
            <span className="truncate text-lg">{tenant.name}</span>
          )}
        </Link>
        <nav aria-label="Main" className="flex shrink-0 items-center gap-1 text-sm sm:gap-2">
          <Link href={pageUrl(tenant, "/#services")} className="hidden rounded-full px-3 py-2 font-medium opacity-80 transition hover:opacity-100 sm:inline-flex">
            Services
          </Link>
          {website && (
            <a href={website} className="hidden items-center gap-1 rounded-full px-3 py-2 font-medium opacity-80 transition hover:opacity-100 sm:inline-flex">
              Our website <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
          {bookButton ? (
            <Link
              href={pageUrl(tenant, "/quote")}
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 font-medium text-accent-fg shadow-sm ring-1 ring-black/5 transition hover:opacity-90"
            >
              Book now
            </Link>
          ) : (
            website && (
              <a href={website} className="inline-flex items-center gap-1 rounded-full px-3 py-2 font-medium opacity-80 transition hover:opacity-100 sm:hidden">
                Our website <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            )
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ tenant, bottomBar = false }: { tenant: Tenant; bottomBar?: boolean }) {
  const { phone, email } = tenant.contact;
  const website = tenant.branding.website_url;
  return (
    <footer className={cn("border-t bg-white", bottomBar && "pb-20 sm:pb-0")}>
      <div className={cn(container, "grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:gap-12")}>
        <div className="grid content-start gap-2">
          <p className="font-semibold tracking-tight">{tenant.name}</p>
          {tenant.branding.tagline && <p className="max-w-sm text-sm text-neutral-600">{tenant.branding.tagline}</p>}
          {(phone || email) && (
            <ul className="mt-2 grid gap-1.5 text-sm">
              {phone && (
                <li>
                  <a href={`tel:${phone}`} className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-950">
                    <Phone className="size-4 text-neutral-400" aria-hidden /> {formatPhone(phone)}
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="inline-flex items-center gap-2 break-all text-neutral-700 hover:text-neutral-950">
                    <Mail className="size-4 shrink-0 text-neutral-400" aria-hidden /> {email}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
        <nav aria-label="Footer" className="grid content-start gap-2 text-sm">
          <p className="font-medium">Book with us</p>
          <Link href={pageUrl(tenant, "/#services")} className="text-neutral-600 hover:text-neutral-950">
            Services
          </Link>
          <Link href={pageUrl(tenant, "/quote")} className="text-neutral-600 hover:text-neutral-950">
            Get an instant quote
          </Link>
          {website && (
            <a href={website} className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-950">
              Our website <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
        </nav>
      </div>
      <div className="border-t">
        <div className={cn(container, "flex flex-col gap-2 py-5 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between")}>
          <p>
            &copy; {new Date().getFullYear()} {tenant.name}
          </p>
          <LegalLinks tenant={tenant} />
        </div>
      </div>
    </footer>
  );
}

// The three steps of booking online, true of every business on the platform.
export const BOOKING_STEPS = [
  { title: "Choose a service", text: "Pick what you'd like done and add any extras." },
  { title: "Get your price", text: "Tell us about your car and see the exact price straight away." },
  { title: "Pick a time", text: "Choose a day and time that suits you and book in a couple of minutes." },
];

export function BookingSteps({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-4", className)}>
      {BOOKING_STEPS.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-fg">
            {i + 1}
          </span>
          <div className="pt-1">
            <h3 className="font-medium">{step.title}</h3>
            <p className="mt-0.5 text-sm text-neutral-600">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function LegalLinks({ tenant, className }: { tenant: Tenant; className?: string }) {
  const links = [
    { href: tenant.branding.terms_url ?? pageUrl(tenant, "/terms"), label: "Booking terms" },
    { href: pageUrl(tenant, "/privacy"), label: "Privacy notice" },
    { href: pageUrl(tenant, "/privacy/request"), label: "Your data rights" },
  ];
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500", className)}>
      {links.map((l) => (
        <li key={l.label}>
          <a href={l.href} className="underline-offset-4 hover:text-neutral-900 hover:underline">
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
