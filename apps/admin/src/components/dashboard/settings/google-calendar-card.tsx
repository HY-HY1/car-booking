"use client";

import { useState, useTransition } from "react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field, SaveForm, fieldClass, type Action } from "../form-kit";

// Settings → Integrations: connecting Google Calendar, and which calendar
// each van or bay uses.

type Calendar = { id: string; name: string; primary: boolean };

export type CalendarCardProps = {
  configured: boolean;
  // Names the missing env vars, in development only.
  missingHint: string | null;
  canEdit: boolean;
  connectHref: string;
  outcome: string | null;
  connection: { email: string | null; status: "active" | "needs_reconnect"; lastError: string | null; defaultCalendarId: string } | null;
  calendars: Calendar[] | null;
  resources: { id: string; name: string; calendarId: string | null; active: boolean }[];
  failing: number;
  saveAction: Action;
  disconnectAction: () => Promise<SaveState>;
};

const OUTCOMES: Record<string, { text: string; good?: boolean }> = {
  connected: {
    text: "Connected. Your upcoming jobs are going into Google Calendar now, and its busy times are being read in.",
    good: true,
  },
  denied: { text: "Google wasn't given access, so nothing was connected." },
  scope: { text: "Google Calendar needs access to your events. Connect again and leave the calendar boxes ticked." },
  expired: { text: "That took too long or was started somewhere else. Try connecting again." },
  failed: { text: "Couldn't connect to Google just now. Try again." },
  no_access: { text: "Your access level doesn't include changing integrations." },
  unconfigured: { text: "Google sign-in isn't set up on this platform yet." },
};

export function GoogleCalendarCard(props: CalendarCardProps) {
  const { connection, configured, canEdit, outcome } = props;
  const note = outcome ? OUTCOMES[outcome] : undefined;

  return (
    <li className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="font-medium">Google Calendar</span>
          <span className="block text-sm text-muted-foreground">
            Your bookings in your Google Calendar, and busy times there blocked out for customers.
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs",
            connection?.status === "active"
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : connection
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                : "bg-muted text-muted-foreground",
          )}
        >
          {connection?.status === "active" ? "Connected" : connection ? "Needs reconnecting" : configured ? "Not connected" : "Coming soon"}
        </span>
      </div>

      {note && (
        <p role="status" className={cn("text-sm", note.good ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
          {note.text}
        </p>
      )}

      {!configured && props.missingHint && <p className="text-xs text-muted-foreground">{props.missingHint}</p>}

      {configured && !connection && (
        <>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            <li>Every booking goes into your calendar with the customer&apos;s name, phone, address, car and notes.</li>
            <li>Anything that makes you busy there (a dentist, a school run) stops customers booking that time.</li>
            <li>Changes to a booking show in Google straight away. Move a job here, not in Google: Google edits are put back.</li>
          </ul>
          {canEdit && (
            <div>
              <a href={props.connectHref} className={buttonVariants()}>
                Connect Google Calendar
              </a>
            </div>
          )}
        </>
      )}

      {configured && connection?.status === "needs_reconnect" && (
        <div className="grid gap-3">
          <p className="text-sm">
            Google stopped letting us in{connection.email ? ` to ${connection.email}` : ""}
            {connection.lastError ? `: ${connection.lastError}` : "."} New jobs aren&apos;t going into your calendar, and busy
            times there aren&apos;t being updated.
          </p>
          {canEdit && (
            <div className="flex flex-wrap gap-3">
              <a href={props.connectHref} className={buttonVariants()}>
                Reconnect Google Calendar
              </a>
              <Disconnect action={props.disconnectAction} />
            </div>
          )}
        </div>
      )}

      {configured && connection?.status === "active" && <Connected {...props} connection={connection} />}
    </li>
  );
}

function Connected(props: CalendarCardProps & { connection: NonNullable<CalendarCardProps["connection"]> }) {
  const { connection, calendars, resources, canEdit } = props;
  const vans = resources.filter((r) => r.active || r.calendarId);

  return (
    <div className="grid gap-4">
      <p className="text-sm">
        Connected{connection.email ? ` as ${connection.email}` : ""}.
        {props.failing > 0 && (
          <span className="text-destructive">
            {" "}
            {props.failing === 1 ? "One job" : `${props.failing} jobs`} couldn&apos;t be written to Google last time. We&apos;ll keep
            trying; the diary shows which.
          </span>
        )}
      </p>

      {calendars === null ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your calendars from Google just now. Reload to try again.</p>
      ) : (
        <SaveForm action={props.saveAction} readOnly={!canEdit} savedText="Saved. Jobs are moving to their calendars now.">
          {(errors) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Calendar for your jobs" name="default_calendar" error={errors.default_calendar}>
                <CalendarSelect name="default_calendar" calendars={calendars} value={connection.defaultCalendarId} />
              </Field>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Jobs go into this calendar, and busy times in it block every van and bay that uses it.
              </p>
              {vans.length > 1 &&
                vans.map((r) => (
                  <Field key={r.id} label={r.name} name={`resource:${r.id}`}>
                    <CalendarSelect
                      name={`resource:${r.id}`}
                      calendars={calendars}
                      value={r.calendarId ?? ""}
                      inherit="Same as your jobs calendar"
                    />
                  </Field>
                ))}
              {vans.length > 1 && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Give a van its own calendar (one per driver, say) and only that calendar&apos;s busy times block it.
                </p>
              )}
            </div>
          )}
        </SaveForm>
      )}

      <p className="text-xs text-muted-foreground">
        Only busy times are read from Google: not what your appointments are or who they&apos;re with. Times marked
        &ldquo;Free&rdquo; in Google, like most all-day events, don&apos;t block anything.
      </p>

      {canEdit && (
        <div>
          <Disconnect action={props.disconnectAction} />
        </div>
      )}
    </div>
  );
}

function CalendarSelect({
  name,
  calendars,
  value,
  inherit,
}: {
  name: string;
  calendars: Calendar[];
  value: string;
  inherit?: string;
}) {
  // A calendar that's been removed from this account still shows, so saving
  // doesn't silently change it.
  const known = value === "" || calendars.some((c) => c.id === value);
  return (
    <select name={name} defaultValue={value} className={cn(fieldClass, "h-8")}>
      {inherit && <option value="">{inherit}</option>}
      {calendars.map((c) => (
        <option key={c.id} value={c.id}>
          {c.primary ? `${c.name} (main calendar)` : c.name}
        </option>
      ))}
      {!known && <option value={value}>A calendar you no longer have</option>}
    </select>
  );
}

function Disconnect({ action }: { action: () => Promise<SaveState> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        className="text-destructive"
        onClick={() => {
          if (
            !confirm(
              "Disconnect Google Calendar? Upcoming jobs come out of your Google Calendar (past ones stay) and its busy times stop blocking bookings.",
            )
          )
            return;
          startTransition(async () => setError((await action()).message));
        }}
      >
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </>
  );
}
