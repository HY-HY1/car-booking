import Link from "next/link";
import { PRICE } from "@/lib/brand";
import { appUrl } from "@/lib/urls";

// Small pieces shared by the marketing pages (app/(marketing)/(site)).

export const kicker = "lp-data text-xs tracking-[0.18em] uppercase";

// Marks stand-in proof while the pages are designed (lib/proof.ts). Never
// rendered in production, because placeholders aren't.
export function PlaceholderTag() {
  return (
    <span className="lp-data ml-2 inline-block border border-dashed border-current px-1.5 py-0.5 align-middle text-[10px] tracking-[0.14em] uppercase opacity-70">
      Placeholder
    </span>
  );
}

// A subpage's opening: kicker, big title, intro, on ink.
export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-20">
      <div className="mx-auto max-w-7xl">
        <p className={`${kicker} text-(--mist)`}>{eyebrow}</p>
        <h1 className="lp-display mt-6 max-w-5xl text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.95]">{title}</h1>
        <div className="mt-7 max-w-2xl text-lg leading-relaxed text-(--mist)">{children}</div>
      </div>
    </section>
  );
}

export function TrialButton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <Link href={appUrl("/signup")} className={`inline-block bg-(--hi) px-6 py-3.5 font-semibold text-(--ink) hover:bg-[#ff7140] ${className}`}>
      {children ?? `Start your ${PRICE.trialDays}-day free trial`}
    </Link>
  );
}

// The orange band that closes every page.
export function CtaBand({ title = "Get your booking link today." }: { title?: string }) {
  return (
    <section className="bg-(--hi) px-4 py-14 text-(--ink) sm:px-6 sm:py-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <p className="lp-display max-w-3xl text-[clamp(2.5rem,6vw,5rem)] leading-[0.9]">{title}</p>
        <div className="shrink-0">
          <Link href={appUrl("/signup")} className="inline-block bg-(--ink) px-6 py-3.5 font-semibold text-(--paper) hover:bg-black">
            Start free trial
          </Link>
          <p className="lp-data mt-3 text-xs">
            {PRICE.trialDays} days free · {PRICE.monthly} a month after · no contract
          </p>
        </div>
      </div>
    </section>
  );
}
