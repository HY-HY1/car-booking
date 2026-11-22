"use client";

import { useState } from "react";
import { formatDuration } from "@leadgen/core/booking/config";
import { AVAILABILITY_LENGTHS, MAX_PLACES, type HomeSettings } from "@leadgen/core/branding/home";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Booking page → Home page: the sections under the heading that
// are made from the business's own diary and coverage.

export function HomePageForm({
  home,
  shortestMins,
  travels,
  action,
  readOnly,
}: {
  home: HomeSettings;
  // The shortest active service, the default length to look for.
  shortestMins: number | null;
  // The business goes to customers, so the coverage section can show.
  travels: boolean;
  action: Action;
  readOnly: boolean;
}) {
  const [availability, setAvailability] = useState(home.show_availability);
  const [area, setArea] = useState(home.show_area);

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <div className="grid gap-4 rounded-lg border p-4">
            <Switch
              name="show_availability"
              checked={availability}
              onChange={(e) => setAvailability(e.target.checked)}
              description="Under your heading: your next day with time free, and which of the next 7 days are booked up. It reads your diary, time off and connected calendar."
            >
              Show your next free day
            </Switch>
            {/* Hidden, not removed, when off: what's chosen is kept for next time. */}
            <div hidden={!availability}>
              <Field
                label="Shortest job to look for"
                name="availability_mins"
                error={errors.availability_mins}
                hint="A day shows as free if a job this long still fits. Longer jobs may need a later day; the booking form checks the real job."
                className="max-w-sm"
              >
                <Select name="availability_mins" defaultValue={home.availability_mins ? String(home.availability_mins) : ""}>
                  <option value="">Your shortest service{shortestMins ? ` (${formatDuration(shortestMins)})` : ""}</option>
                  {AVAILABILITY_LENGTHS.map((mins) => (
                    <option key={mins} value={mins}>
                      {formatDuration(mins)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border p-4">
            <Switch
              name="show_area"
              checked={area}
              onChange={(e) => setArea(e.target.checked)}
              description={
                travels
                  ? "A map of your Coverage Area and a box where customers check their postcode."
                  : "Shown once you take jobs at customers' addresses."
              }
            >
              Show your coverage map and postcode checker
            </Switch>
            <div hidden={!area}>
              <Field
                label="Places you cover"
                name="places"
                error={errors.places}
                hint={`Towns and villages, separated by commas. Listed beside the map, up to ${MAX_PLACES}. Leave blank to list none.`}
              >
                <Textarea
                  name="places"
                  rows={3}
                  defaultValue={home.places.join(", ")}
                  placeholder="e.g. Cheltenham, Charlton Kings, Prestbury, Bishop's Cleeve"
                />
              </Field>
            </div>
          </div>
        </>
      )}
    </SaveForm>
  );
}
