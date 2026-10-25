"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { DayKey, WeeklyHours } from "@leadgen/core/booking/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WEEK: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const MAX_WINDOWS = 3;

// A week of opening times: tick the days that are open, set when, and add a
// second stretch for a lunch break. Posts its state as json in one hidden
// field; the server checks it again.
export function HoursEditor({ name, initial, label }: { name: string; initial: WeeklyHours; label: string }) {
  const [hours, setHours] = useState<WeeklyHours>(initial);
  const set = (day: DayKey, windows: [string, string][]) => setHours((h) => ({ ...h, [day]: windows }));
  const edit = (day: DayKey, index: number, part: 0 | 1, value: string) =>
    set(
      day,
      (hours[day] ?? []).map((w, i) => (i === index ? (part === 0 ? [value, w[1]] : [w[0], value]) : w)) as [string, string][],
    );

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{label}</legend>
      <input type="hidden" name={name} value={JSON.stringify(hours)} />
      {WEEK.map(({ key, label: dayName }) => {
        const windows = hours[key] ?? [];
        const open = windows.length > 0;
        return (
          <div key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2">
            <label className="flex w-32 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={open}
                onChange={(e) => set(key, e.target.checked ? [["08:00", "17:00"]] : [])}
                className="size-4 accent-primary"
              />
              {dayName}
            </label>
            {open ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {windows.map((w, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-sm">
                    <Input
                      type="time"
                      value={w[0]}
                      onChange={(e) => edit(key, i, 0, e.target.value)}
                      aria-label={`${dayName} opens`}
                      className="w-28"
                    />
                    to
                    <Input
                      type="time"
                      value={w[1]}
                      onChange={(e) => edit(key, i, 1, e.target.value)}
                      aria-label={`${dayName} closes`}
                      className="w-28"
                    />
                    {windows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove this ${dayName} stretch`}
                        onClick={() =>
                          set(
                            key,
                            windows.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <X />
                      </Button>
                    )}
                  </span>
                ))}
                {windows.length < MAX_WINDOWS && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const last = windows[windows.length - 1][1];
                      // A later stretch, an hour after the last one ends (or a
                      // sensible evening one if that runs off the day).
                      const start = last < "21:00" ? `${String(Number(last.slice(0, 2)) + 1).padStart(2, "0")}:${last.slice(3)}` : "21:00";
                      set(key, [...windows, [start, "23:00"]]);
                    }}
                  >
                    <Plus /> Add a stretch
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Closed</span>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          const monday = hours.mon ?? [];
          setHours((h) => ({ ...h, tue: monday, wed: monday, thu: monday, fri: monday }));
        }}
      >
        Copy Monday to Tuesday–Friday
      </Button>
    </fieldset>
  );
}
