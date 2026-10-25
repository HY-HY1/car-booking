"use client";

import { cn } from "@/lib/utils";

// One series of columns over time: income per day, jobs per month. Thin
// columns with a rounded top, hairline gridlines, a tooltip on hover or focus,
// and the same numbers as a table underneath for anyone who wants them.

export type BarDatum = { label: string; fullLabel: string; value: number };

type Props = {
  title: string;
  // "money" values are pence.
  kind: "money" | "count";
  data: BarDatum[];
  emptyText: string;
};

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: pence % 100 === 0 ? 0 : 2 }).format(pence / 100);

function compactMoney(pence: number) {
  const pounds = pence / 100;
  if (pounds >= 1000) return `£${+(pounds / 1000).toFixed(1)}K`;
  return `£${Math.round(pounds)}`;
}

// A round number just above the biggest value, so the top gridline is a clean
// figure (£50, £100, £200) and not the exact peak.
function niceMax(max: number, kind: Props["kind"]) {
  const unit = kind === "money" ? 100 : 1; // pounds, or whole jobs
  const v = Math.max(max / unit, kind === "count" ? 2 : 10);
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 5, 10].find((m) => m * pow >= v)!;
  return step * pow * unit;
}

// Show enough x labels to read without touching: about eight across.
function labelEvery(n: number) {
  return Math.max(1, Math.ceil(n / 8));
}

export function BarChart({ title, kind, data, emptyText }: Props) {
  const fmt = kind === "money" ? money : (n: number) => String(n);
  const tick = kind === "money" ? compactMoney : (n: number) => String(Math.round(n));
  const total = data.reduce((t, d) => t + d.value, 0);
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)), kind);
  const every = labelEvery(data.length);
  const ticks = [0, top / 2, top];

  return (
    <figure className="grid gap-3" style={{ ["--viz" as string]: "var(--viz-1)" }}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{fmt(total)} in total</span>
      </figcaption>

      {/* 13rem tall: 1.5rem for the x labels, 11.5rem of plot. */}
      <div className="relative h-52 pr-1 pl-11">
        {/* y axis */}
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute right-0 left-0" style={{ bottom: `calc(1.5rem + ${t / top} * 11.5rem)` }}>
            <span className="absolute -top-2 left-0 w-9 pr-2 text-right text-xs text-muted-foreground tabular-nums">{tick(t)}</span>
            <div className="ml-11 h-px bg-border" />
          </div>
        ))}

        {total === 0 ? (
          <p className="absolute inset-x-11 top-1/3 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="flex h-full items-end gap-0.5 pb-6">
            {data.map((d, i) => {
              const pct = (d.value / top) * 100;
              // Keep the tooltip on screen at the two ends.
              const align = i < data.length * 0.2 ? "left-0" : i > data.length * 0.8 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div key={i} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                  <button
                    type="button"
                    aria-label={`${d.fullLabel}: ${fmt(d.value)}`}
                    className="peer flex h-full w-full items-end justify-center outline-none"
                  >
                    {d.value > 0 && (
                      <span
                        className="block w-full max-w-6 rounded-t-[4px] bg-(--viz) transition-opacity group-hover:opacity-80 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                        style={{ height: `${Math.max(pct, 1.5)}%` }}
                      />
                    )}
                  </button>
                  <span
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block peer-focus-visible:block",
                      align,
                    )}
                  >
                    <span className="block text-sm font-semibold">{fmt(d.value)}</span>
                    <span className="block text-muted-foreground">{d.fullLabel}</span>
                  </span>
                  {i % every === 0 && (
                    <span className="pointer-events-none absolute top-full mt-1 text-xs whitespace-nowrap text-muted-foreground">
                      {d.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <details className="text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground underline-offset-4 hover:underline">View as a table</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">When</th>
                <th className="px-3 py-1.5 text-right font-medium">{title}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((d, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">{d.fullLabel}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
