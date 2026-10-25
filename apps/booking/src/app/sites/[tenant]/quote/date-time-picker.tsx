"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  addMonths,
  groupByTimeOfDay,
  longDate,
  monthGrid,
  monthOf,
  monthsBetween,
  monthTitle,
  shortDate,
  WEEKDAY_HEADINGS,
} from "@leadgen/core/booking/calendar";
import type { Slot } from "@leadgen/core/booking/engine";
import { cn } from "@/lib/cn";

// Pick a day on a month calendar, then a start time. Days the business is
// closed or fully booked are greyed out and can't be tapped, and the earliest
// free day is already selected when the picker opens, so the times are on
// screen straight away.

type Props = {
  // The tenant-local date today, "YYYY-MM-DD".
  today: string;
  // Days with at least one start time free. The calendar runs from the first
  // to the last bookable day, whichever of them are open.
  openDates: string[];
  date?: string;
  onPickDate: (date: string) => void;
  slots: Slot[] | null;
  loadingSlots: boolean;
  slot?: Slot;
  onPickSlot: (slot: Slot) => void;
};

export function DateTimePicker({ today, openDates, date, onPickDate, slots, loadingSlots, slot, onPickSlot }: Props) {
  const open = new Set(openDates);
  const first = openDates[0];
  const last = openDates[openDates.length - 1];
  const months = monthsBetween(first, last);

  const [month, setMonth] = useState(monthOf(date ?? first));
  const slotsRef = useRef<HTMLDivElement>(null);

  const position = months.indexOf(month);
  const goTo = (by: number) => setMonth(addMonths(month, by));

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(-1)}
            disabled={position <= 0}
            aria-label="Previous month"
            className="grid size-9 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h3 className="font-semibold" aria-live="polite">
            {monthTitle(month)}
          </h3>
          <button
            type="button"
            onClick={() => goTo(1)}
            disabled={position >= months.length - 1}
            aria-label="Next month"
            className="grid size-9 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
          {WEEKDAY_HEADINGS.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>

        <div className="grid gap-1">
          {monthGrid(month).map((week, w) => (
            <div key={w} className="grid grid-cols-7 gap-1">
              {week.map((d, i) => {
                if (!d) return <span key={i} />;
                const available = open.has(d);
                const selected = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!available}
                    aria-pressed={selected}
                    aria-label={`${longDate(d)}${available ? "" : ", not available"}`}
                    onClick={() => {
                      onPickDate(d);
                      // Bring the times into view on a small screen.
                      requestAnimationFrame(() => slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
                    }}
                    className={cn(
                      "relative grid aspect-square place-items-center rounded-xl text-sm transition",
                      selected
                        ? "bg-brand font-semibold text-brand-fg"
                        : available
                          ? "border border-neutral-200 font-medium hover:border-neutral-500"
                          : "cursor-default text-neutral-300",
                    )}
                  >
                    {Number(d.slice(8))}
                    {d === today && (
                      <span className={cn("absolute bottom-1 size-1 rounded-full", selected ? "bg-brand-fg" : "bg-neutral-400")} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-neutral-500">Greyed-out days are closed or fully booked.</p>
      </div>

      <div ref={slotsRef} className="grid scroll-mt-4 gap-4">
        {date ? (
          <>
            <h3 className="text-lg font-semibold">{longDate(date)}</h3>
            {loadingSlots && !slots ? (
              <p className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" /> Checking the diary…
              </p>
            ) : slots?.length ? (
              groupByTimeOfDay(slots).map(([name, list]) => (
                <div key={name} className="grid gap-2">
                  <p className="text-sm font-medium text-neutral-500">{name}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {list.map((s) => (
                      <button
                        key={s.startsAt}
                        type="button"
                        aria-pressed={slot?.startsAt === s.startsAt}
                        onClick={() => onPickSlot(s)}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-center font-medium transition",
                          slot?.startsAt === s.startsAt
                            ? "border-brand bg-brand text-brand-fg"
                            : "border-neutral-200 bg-white hover:border-neutral-500",
                        )}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : slots ? (
              <p className="text-sm text-neutral-500">Nothing free that day any more. Pick another date.</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-neutral-500">Pick a date to see the times.</p>
        )}
      </div>

      {slot && date && (
        <p className="rounded-xl bg-neutral-100 px-4 py-3 text-center text-sm">
          Your time: <span className="font-semibold">{shortDate(date)} at {slot.time}</span>
        </p>
      )}
    </div>
  );
}
