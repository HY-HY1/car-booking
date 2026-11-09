"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Slot } from "@leadgen/core/booking/engine";
import { longDate } from "@leadgen/core/booking/calendar";
import { DateTimePicker } from "../../quote/date-time-picker";
import { cancelAction, findDatesAction, findSlotsAction, rescheduleAction } from "./actions";

// What a button needs: whether it can be used, until when, or why not.
export type ActionView = { allowed: true; until: string } | { allowed: false; reason: string | null };

type Mode =
  | { kind: "idle" }
  | { kind: "moving"; today: string; dates: string[] }
  | { kind: "cancelling" };

export function ManageActions({
  token,
  startsAt,
  reschedule,
  cancel,
  refundLine,
}: {
  token: string;
  startsAt: string;
  reschedule: ActionView;
  cancel: ActionView;
  refundLine: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [date, setDate] = useState<string>();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot>();

  function pickDate(d: string) {
    setDate(d);
    setSlot(undefined);
    setSlots(null);
    setLoadingSlots(true);
    findSlotsAction(token, d)
      .then((result) => {
        if (!result.ok) return setError(result.message);
        // The customer's current time is left out: picking it changes nothing.
        setSlots(result.slots.filter((s) => s.startsAt !== new Date(startsAt).toISOString()));
      })
      .catch(() => setError("Couldn't load the times. Try again."))
      .finally(() => setLoadingSlots(false));
  }

  function openMoving() {
    setError(null);
    start(async () => {
      try {
        const result = await findDatesAction(token);
        if (!result.ok) return setError(result.message);
        setMode({ kind: "moving", today: result.today, dates: result.dates });
        if (result.dates[0]) pickDate(result.dates[0]);
      } catch {
        setError("Couldn't load the diary. Try again.");
      }
    });
  }

  function confirmMove() {
    if (!slot) return;
    setError(null);
    start(async () => {
      try {
        const result = await rescheduleAction(token, slot.startsAt);
        if (!result.ok) {
          setError(result.message);
          if (result.code === "slot_taken" && date) pickDate(date);
          return;
        }
        setDone(`Done. Your booking is now on ${longDate(date!)} at ${slot.time}. We've emailed you the new time.`);
        setMode({ kind: "idle" });
        router.refresh();
      } catch {
        setError("Couldn't move your booking. Try again.");
      }
    });
  }

  function confirmCancel() {
    setError(null);
    start(async () => {
      try {
        const result = await cancelAction(token);
        if (!result.ok) return setError(result.message);
        setDone(["Your booking is cancelled. We've emailed you to confirm.", result.refundLine].filter(Boolean).join(" "));
        setMode({ kind: "idle" });
        router.refresh();
      } catch {
        setError("Couldn't cancel your booking. Try again.");
      }
    });
  }

  // Why either can't be done; once, when it's the same reason for both.
  const reasons = [...new Set([reschedule, cancel].flatMap((o) => (!o.allowed && o.reason ? [o.reason] : [])))];

  return (
    <section className="grid gap-4">
      {done && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{done}</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}

      {mode.kind === "idle" && (
        <>
          {(reschedule.allowed || cancel.allowed) && (
            <div className="flex flex-wrap gap-3">
              {reschedule.allowed && (
                <button
                  type="button"
                  onClick={openMoving}
                  disabled={pending}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-60"
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Change the time
                </button>
              )}
              {cancel.allowed && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode({ kind: "cancelling" });
                  }}
                  disabled={pending}
                  className="inline-flex h-12 items-center rounded-full border border-neutral-300 px-6 font-medium transition hover:border-neutral-500 disabled:opacity-60"
                >
                  Cancel booking
                </button>
              )}
            </div>
          )}
          <div className="grid gap-1 text-sm text-neutral-500">
            {reschedule.allowed && <p>You can change the time until {reschedule.until}.</p>}
            {cancel.allowed && <p>You can cancel until {cancel.until}.</p>}
            {reasons.map((r) => (
              <p key={r}>{r}</p>
            ))}
          </div>
        </>
      )}

      {mode.kind === "moving" && (
        <div className="grid gap-4">
          <h2 className="text-lg font-semibold">Pick a new time</h2>
          {mode.dates.length === 0 ? (
            <p className="text-sm text-neutral-500">
              There aren&apos;t any free times to move to right now. Get in touch with the business and they&apos;ll
              help.
            </p>
          ) : (
            <DateTimePicker
              today={mode.today}
              openDates={mode.dates}
              date={date}
              onPickDate={pickDate}
              slots={slots}
              loadingSlots={loadingSlots}
              slot={slot}
              onPickSlot={setSlot}
            />
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmMove}
              disabled={!slot || pending}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-40"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {slot && date ? `Move to ${longDate(date)}, ${slot.time}` : "Pick a time"}
            </button>
            <button
              type="button"
              onClick={() => setMode({ kind: "idle" })}
              disabled={pending}
              className="inline-flex h-12 items-center rounded-full px-4 font-medium text-neutral-600 hover:text-neutral-900"
            >
              Keep my current time
            </button>
          </div>
        </div>
      )}

      {mode.kind === "cancelling" && (
        <div className="grid gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-4">
          <h2 className="font-semibold">Cancel this booking?</h2>
          <p className="text-sm text-neutral-600">
            The time will be given to someone else, so you&apos;d need to book again to get it back.
          </p>
          {refundLine && <p className="text-sm font-medium">{refundLine}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmCancel}
              disabled={pending}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-5 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Yes, cancel it
            </button>
            <button
              type="button"
              onClick={() => setMode({ kind: "idle" })}
              disabled={pending}
              className="inline-flex h-11 items-center rounded-full px-4 font-medium text-neutral-600 hover:text-neutral-900"
            >
              Keep my booking
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
