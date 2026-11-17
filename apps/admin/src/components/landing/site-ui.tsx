import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { appUrl } from "@/lib/urls";

// Pieces shared by the rebuilt marketing pages (site.css look). The old
// look's pieces are in ./ui.tsx.

// The top of a page other than home: the hero's grid and glow, smaller, with
// an eyebrow, title, intro and anything else (buttons, a form) below.
export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pt-24">
      <div aria-hidden className="site-grid absolute inset-0 -z-10" />
      <div aria-hidden className="site-glow absolute inset-0 -z-10" />
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium text-(--accent)">{eyebrow}</p>
        <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tighter text-balance sm:text-6xl">{title}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-(--muted)">{intro}</p>
        {children}
      </div>
    </section>
  );
}

// The band that closes every page.
export function ClosingCta({ title, note }: { title: string; note?: string }) {
  return (
    <section className="border-t border-(--line) bg-(--soft) px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        <Ctas className="mt-8 justify-center" />
        {note && <p className="mt-4 text-sm text-(--muted)">{note}</p>}
      </div>
    </section>
  );
}

// A page section: optional eyebrow, title, intro and link, then its content.
export function Section({
  id,
  eyebrow,
  title,
  intro,
  link,
  center = false,
  className = "",
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  link?: [label: string, href: string];
  center?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-20 border-t border-(--line) px-4 py-24 sm:px-6 ${className}`}>
      <div className="mx-auto max-w-6xl">
        <div className={`mb-14 ${center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}`}>
          {eyebrow && <p className="text-sm font-medium text-(--accent)">{eyebrow}</p>}
          <h2 id={`${id}-title`} className="mt-3 text-4xl font-semibold tracking-tighter text-balance sm:text-5xl">
            {title}
          </h2>
          {intro && <p className="mt-5 text-lg text-pretty text-(--muted)">{intro}</p>}
          {link && (
            <Link href={link[1]} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium hover:text-(--accent)">
              {link[0]}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

// The two calls to action: start a trial, or book a demo.
export function Ctas({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link href={appUrl("/signup")} className="site-cta inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold">
        Start free trial
        <ArrowRight aria-hidden className="size-4" />
      </Link>
      <Link href="/contact?topic=demo" className="rounded-full px-6 py-3 font-medium hover:bg-(--soft)">
        Book a demo
      </Link>
    </div>
  );
}

// A screenshot in a browser window: three dots and an address bar. `secure`
// adds the padlock, for a real web address.
export function BrowserFrame({
  address,
  secure = false,
  className = "",
  children,
}: {
  address: string;
  secure?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-(--line) bg-[#0d0f10] ${className}`}>
      <div className="flex items-center gap-4 border-b border-(--line) px-4 py-3">
        <span aria-hidden className="flex shrink-0 gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto flex max-w-sm min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-(--soft) px-3 py-1 text-xs text-(--muted)">
          {secure && <Lock aria-hidden className="size-3 shrink-0" />}
          <span className="truncate">{address}</span>
        </span>
        {/* Balances the dots, so the address sits in the middle. */}
        <span aria-hidden className="w-13.5 shrink-0" />
      </div>
      {children}
    </div>
  );
}

// A marked gap where an image or real content goes next.
export function Slot({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border border-dashed border-(--line) bg-(--soft) p-4 text-center text-sm text-(--muted) ${className}`}
    >
      {children}
    </div>
  );
}
