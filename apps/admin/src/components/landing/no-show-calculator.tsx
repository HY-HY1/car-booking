"use client";

import { useId, useState } from "react";
import { PRODUCT_NAME } from "@/lib/brand";

// What no-shows cost a year, against a year of the subscription. Plain
// arithmetic on the visitor's own numbers; nothing is saved or sent.
export function NoShowCalculator({ yearlyPounds }: { yearlyPounds: number }) {
  const [price, setPrice] = useState(80);
  const [perMonth, setPerMonth] = useState(2);
  const priceId = useId();
  const countId = useId();

  const lost = price * perMonth * 12;
  const ratio = lost > 0 ? lost / yearlyPounds : 0;
  const pounds = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

  return (
    <div className="lp-printed-hi border-2 border-(--paper) bg-(--paper) text-(--ink)">
      <div className="grid gap-6 border-b-2 border-(--ink) p-6 sm:grid-cols-2 sm:p-8">
        <label htmlFor={priceId} className="block">
          <span className="lp-data block text-[11px] tracking-[0.14em] text-(--graphite) uppercase">Your average job</span>
          <span className="mt-2 flex items-baseline gap-1 border-b-2 border-(--ink)">
            <span className="lp-display text-4xl">£</span>
            <input
              id={priceId}
              type="number"
              inputMode="numeric"
              min={0}
              max={5000}
              value={price}
              onChange={(e) => setPrice(clamp(e.target.valueAsNumber, 0, 5000))}
              className="lp-display w-full bg-transparent py-1 text-4xl outline-none"
            />
          </span>
        </label>
        <div>
          <label htmlFor={countId} className="lp-data block text-[11px] tracking-[0.14em] text-(--graphite) uppercase">
            No-shows and late cancels a month
          </label>
          <div className="mt-3 flex items-center gap-4">
            <input
              id={countId}
              type="range"
              min={0}
              max={10}
              step={1}
              value={perMonth}
              onChange={(e) => setPerMonth(e.target.valueAsNumber)}
              className="w-full accent-(--hi)"
            />
            <span className="lp-display w-8 text-right text-4xl tabular-nums">{perMonth}</span>
          </div>
        </div>
      </div>

      <dl className="grid sm:grid-cols-2" aria-live="polite">
        <div className="border-b-2 border-(--ink) p-6 sm:border-r-2 sm:border-b-0 sm:p-8">
          <dt className="lp-data text-[11px] tracking-[0.14em] text-(--graphite) uppercase">Lost a year now</dt>
          <dd className="lp-display mt-2 text-6xl text-[#d9430b] tabular-nums">{pounds(lost)}</dd>
        </div>
        <div className="p-6 sm:p-8">
          <dt className="lp-data text-[11px] tracking-[0.14em] text-(--graphite) uppercase">A year of {PRODUCT_NAME}</dt>
          <dd className="lp-display mt-2 text-6xl tabular-nums">{pounds(yearlyPounds)}</dd>
        </div>
      </dl>
      <p className="border-t-2 border-(--ink) bg-(--ink) px-6 py-4 text-sm text-(--paper) sm:px-8">
        {lost === 0
          ? "No no-shows? Deposits still mean every booking is a committed one."
          : ratio >= 1
            ? `No-shows alone cost you ${ratio >= 1.95 ? `${Math.floor(ratio * 10) / 10}×` : "more than"} what it costs. With a deposit on every booking, a no-show still pays.`
            : `That's ${Math.round(ratio * 100)}% of a year's subscription, before the wasted drive and the job you turned away.`}
      </p>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
