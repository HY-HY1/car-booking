"use client";

import { useState } from "react";

// The landing page's "customer side": a working copy of the quote step with
// example prices. Size sets the price and the time the job takes; extras add
// to both. Nothing is sent anywhere.

const SIZES = [
  { key: "small", label: "Small", example: "Fiesta, Polo", pence: 7000, mins: 120 },
  { key: "medium", label: "Medium", example: "Focus, Golf", pence: 8500, mins: 150 },
  { key: "large", label: "Large", example: "Octavia, X3", pence: 9500, mins: 180 },
  { key: "van", label: "Van / 4x4", example: "Transit, Discovery", pence: 11000, mins: 210 },
] as const;

const EXTRAS = [
  { key: "pet", label: "Pet hair removal", pence: 2000, mins: 30 },
  { key: "clay", label: "Clay bar & sealant", pence: 3500, mins: 45 },
  { key: "engine", label: "Engine bay clean", pence: 1500, mins: 20 },
] as const;

const DEPOSIT_PENCE = 2000;

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const hours = (mins: number) => `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
const clock = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function QuoteDemo({ signupHref }: { signupHref: string }) {
  const [size, setSize] = useState<(typeof SIZES)[number]["key"]>("medium");
  const [extras, setExtras] = useState<string[]>(["pet"]);
  const [booked, setBooked] = useState(false);

  const s = SIZES.find((x) => x.key === size)!;
  const chosen = EXTRAS.filter((e) => extras.includes(e.key));
  const total = s.pence + chosen.reduce((sum, e) => sum + e.pence, 0);
  const mins = s.mins + chosen.reduce((sum, e) => sum + e.mins, 0);
  const start = 8 * 60 + 30;

  const change = (fn: () => void) => {
    fn();
    setBooked(false);
  };

  return (
    <div className="lp-printed-hi border-2 border-(--ink) bg-white text-(--ink)">
      <div className="flex items-baseline justify-between border-b-2 border-(--ink) px-5 py-3">
        <p className="lp-display text-2xl">Full valet</p>
        <p className="lp-data text-xs text-(--graphite)">Example prices · you set yours</p>
      </div>

      <div role="radiogroup" aria-labelledby="qd-car" className="px-5 pt-5">
        <p id="qd-car" className="lp-data mb-2 text-[11px] tracking-[0.14em] text-(--graphite) uppercase">
          Your car
        </p>
        <div className="grid grid-cols-2 gap-px border border-(--ink) bg-(--ink) sm:grid-cols-4">
          {SIZES.map((x) => (
            <label
              key={x.key}
              className={`cursor-pointer px-3 py-2.5 transition-colors ${size === x.key ? "bg-(--ink) text-(--paper)" : "bg-white hover:bg-(--paper)"}`}
            >
              <input
                type="radio"
                name="size"
                value={x.key}
                checked={size === x.key}
                onChange={() => change(() => setSize(x.key))}
                className="sr-only"
              />
              <span className="block text-sm font-medium">{x.label}</span>
              <span className={`block text-xs ${size === x.key ? "text-(--mist)" : "text-(--graphite)"}`}>{x.example}</span>
            </label>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby="qd-extras" className="px-5 pt-5">
        <p id="qd-extras" className="lp-data mb-2 text-[11px] tracking-[0.14em] text-(--graphite) uppercase">
          Extras
        </p>
        <ul className="divide-y divide-(--rule) border-y border-(--rule)">
          {EXTRAS.map((e) => (
            <li key={e.key}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={extras.includes(e.key)}
                  onChange={(ev) =>
                    change(() => setExtras((cur) => (ev.target.checked ? [...cur, e.key] : cur.filter((k) => k !== e.key))))
                  }
                  className="size-4 accent-(--hi)"
                />
                <span className="flex-1">{e.label}</span>
                <span className="lp-data text-(--graphite)">+{pounds(e.pence)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <dl className="lp-data grid grid-cols-[1fr_auto] gap-y-1 px-5 pt-5 text-sm">
        <dt className="text-(--graphite)">Takes about</dt>
        <dd>{hours(mins)}</dd>
        <dt className="text-(--graphite)">First free slot</dt>
        <dd>
          Thu {clock(start)}–{clock(start + mins)}
        </dd>
        <dt className="text-(--graphite)">Deposit now</dt>
        <dd>{pounds(DEPOSIT_PENCE)}</dd>
      </dl>

      <div className="mt-4 flex items-end justify-between gap-4 border-t-2 border-(--ink) px-5 py-4">
        <div>
          <p className="lp-data text-[11px] tracking-[0.14em] text-(--graphite) uppercase">Total</p>
          <p className="lp-display text-5xl tabular-nums" aria-live="polite">
            {pounds(total)}
          </p>
        </div>
        {!booked ? (
          <button
            type="button"
            onClick={() => setBooked(true)}
            className="bg-(--hi) px-4 py-3 text-sm font-semibold text-(--ink) transition-transform hover:-translate-y-0.5"
          >
            Pay {pounds(DEPOSIT_PENCE)} deposit
          </button>
        ) : (
          <p className="lp-data border-2 border-(--hi) px-3 py-2 text-xs font-semibold tracking-widest text-(--ink) uppercase">
            Booked · Thu {clock(start)}
          </p>
        )}
      </div>

      {booked && (
        <p className="border-t border-(--rule) bg-(--paper) px-5 py-3 text-sm">
          That&apos;s the moment the job lands in your diary and the customer gets their confirmation email.{" "}
          <a href={signupHref} className="font-semibold underline decoration-(--hi) decoration-2 underline-offset-4">
            Set yours up
          </a>
        </p>
      )}
    </div>
  );
}
