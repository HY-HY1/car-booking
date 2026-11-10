import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { userAgent } from "next/server";
import { Plus } from "lucide-react";
import { z } from "zod";
import { bufferFor, resourceSchema, weeklyHoursSchema } from "@leadgen/core/booking/config";
import {
  DIARY_STATUSES,
  diaryDays,
  diaryRange,
  parseDiaryDate,
  parseView,
  resourceHours,
  travelLegs,
  unionHours,
} from "@leadgen/core/booking/diary";
import { coordsFor, lookupPostcodes } from "@leadgen/core/booking/geo";
import { localDate } from "@leadgen/core/booking/time";
import { policyOf, refundAdvice } from "@leadgen/core/settings/policy";
import { BlockTimeForm } from "@/components/dashboard/diary/block-time-form";
import { DiaryAgenda } from "@/components/dashboard/diary/diary-agenda";
import { DayStrip, DiaryControls, diaryHref, ResourceFilter } from "@/components/dashboard/diary/diary-controls";
import {
  DiaryGrid,
  type GridBlock,
  type GridColumn,
  type GridJob,
  type GridLeg,
} from "@/components/dashboard/diary/diary-grid";
import { DiaryLegend } from "@/components/dashboard/diary/diary-legend";
import { JobPanel, type PanelJob } from "@/components/dashboard/diary/job-panel";
import { RemoveTimeOff } from "@/components/dashboard/diary/remove-time-off";
import { RoutePlanner } from "@/components/dashboard/diary/route-planner";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth";
import { timeOffLabel, viewLabel } from "@/lib/diary-display";
import { listJobPhotos } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { addBlockedTime, moveBookingAction, removeBlockedTime, setBookingStatusAction } from "./actions";
import { formatDayTime } from "@leadgen/core/dates";

export const metadata: Metadata = { title: "Diary" };

type DiaryBooking = PanelJob & { hold_expires_at: string | null; resource_id: string };

export default async function DiaryPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/diary">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireTenant(slug);
  const sp = await searchParams;

  // RLS limits every read to this business.
  const supabase = await createClient();
  const [settingsResult, resourcesResult, stripeResult] = await Promise.all([
    supabase
      .from("booking_settings")
      .select("timezone, weekly_hours, unit_weekly_hours, travel_buffer_mins, unit_buffer_mins, cancellation_policy")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabase
      .from("resources")
      .select("id, name, location_types, weekly_hours, sort_order, active, calendar_id")
      .eq("tenant_id", tenant.id)
      .order("sort_order")
      .order("created_at"),
    supabase.from("tenants").select("stripe_ready").eq("id", tenant.id).single(),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  if (resourcesResult.error) throw resourcesResult.error;
  if (stripeResult.error) throw stripeResult.error;

  const timeZone = settingsResult.data?.timezone ?? "Europe/London";
  const hoursSettings = {
    weekly_hours: weeklyHoursSchema.safeParse(settingsResult.data?.weekly_hours).data ?? {},
    unit_weekly_hours: weeklyHoursSchema.nullable().safeParse(settingsResult.data?.unit_weekly_hours).data ?? null,
  };
  const bufferSettings = {
    travel_buffer_mins: settingsResult.data?.travel_buffer_mins ?? 30,
    unit_buffer_mins: settingsResult.data?.unit_buffer_mins ?? 0,
  };
  const resources = z
    .array(resourceSchema.extend({ active: z.boolean(), calendar_id: z.string().nullable() }))
    .parse(resourcesResult.data);
  const nameOf = new Map(resources.map((r) => [r.id, r.name]));

  const now = new Date();
  const today = localDate(now, timeZone);
  // Nothing asked for: a phone opens on today, anything bigger on the week.
  const { device } = userAgent({ headers: await headers() });
  const view = parseView(sp.view ?? (device.type === "mobile" ? "day" : "week"));
  const date = parseDiaryDate(sp.date, today);
  const days = diaryDays(view, date);
  const range = diaryRange(days, timeZone);

  const [bookingsResult, blockedResult, calendarResult, busyResult] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, status, starts_at, ends_at, hold_expires_at, resource_id, location_type, address_line, postcode, access_notes, customer_notes, internal_notes, staff:staff(name), quote_snapshot, price_pence, deposit_pence, deposit_status, stripe_payment_intent_id, customer:customers(id, name, email, phone), service:services(name), vehicle:vehicles(make, model, registration, size_class)",
      )
      .eq("tenant_id", tenant.id)
      .in("status", [...DIARY_STATUSES])
      .lt("starts_at", range.end.toISOString())
      .gt("ends_at", range.start.toISOString())
      .order("starts_at")
      .limit(500),
    supabase
      .from("blocked_times")
      .select("id, starts_at, ends_at, reason, resource_id")
      .eq("tenant_id", tenant.id)
      .lt("starts_at", range.end.toISOString())
      .gt("ends_at", range.start.toISOString())
      .order("starts_at")
      .limit(200),
    supabase.from("calendar_connections").select("default_calendar_id, status").eq("tenant_id", tenant.id).maybeSingle(),
    supabase
      .from("calendar_busy")
      .select("calendar_id, event_id, starts_at, ends_at")
      .eq("tenant_id", tenant.id)
      .lt("starts_at", range.end.toISOString())
      .gt("ends_at", range.start.toISOString())
      .order("starts_at")
      .limit(500),
  ]);
  if (bookingsResult.error) throw bookingsResult.error;
  if (blockedResult.error) throw blockedResult.error;
  // Google Calendar is extra: if it can't be read, the diary still shows.
  if (calendarResult.error || busyResult.error) console.error("Diary calendar read failed", calendarResult.error ?? busyResult.error);
  const calendar = calendarResult.error || busyResult.error ? null : calendarResult.data;
  const busyRows = busyResult.data ?? [];

  // A hold whose time has run out is an abandoned checkout, not a job.
  const bookings = (bookingsResult.data as unknown as DiaryBooking[]).filter(
    (b) => b.status !== "held" || (b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now.getTime()),
  );
  const blocks: GridBlock[] = blockedResult.data.map((b) => ({
    id: b.id,
    start: b.starts_at,
    end: b.ends_at,
    reason: b.reason,
    resourceId: b.resource_id,
    resourceName: b.resource_id ? (nameOf.get(b.resource_id) ?? null) : null,
  }));

  // The vans and bays shown: those taking bookings, and any switched off that
  // still have something in this period.
  const used = new Set([...bookings.map((b) => b.resource_id), ...blocks.flatMap((b) => (b.resourceId ? [b.resourceId] : []))]);
  const shown = resources.filter((r) => r.active || used.has(r.id));
  const several = shown.length > 1;

  // Busy in Google Calendar: for the vans using that calendar, or the whole
  // business when every van shown uses it.
  const calendarOf = (r: (typeof resources)[number]) => r.calendar_id ?? calendar?.default_calendar_id;
  const googleBlocks: GridBlock[] = calendar
    ? busyRows.flatMap((b): GridBlock[] => {
        const users = shown.filter((r) => calendarOf(r) === b.calendar_id);
        const block = { start: b.starts_at, end: b.ends_at, reason: "Busy in Google Calendar", google: true };
        if (users.length === 0) return [];
        if (users.length === shown.length) {
          return [{ ...block, id: `g-${b.calendar_id}-${b.event_id}`, resourceId: null, resourceName: null }];
        }
        return users.map((r) => ({ ...block, id: `g-${b.calendar_id}-${b.event_id}-${r.id}`, resourceId: r.id, resourceName: r.name }));
      })
    : [];
  const chosen = typeof sp.resource === "string" ? shown.find((r) => r.id === sp.resource) : undefined;

  const columns: GridColumn[] =
    view === "day" && several && !chosen
      ? shown.map((r) => ({
          key: r.id,
          day: date,
          resourceId: r.id,
          variant: "resource",
          title: r.name,
          hours: resourceHours(hoursSettings, r),
        }))
      : days.map((day) => ({
          key: day,
          day,
          resourceId: chosen?.id ?? null,
          variant: "day",
          title: day,
          hours: chosen ? resourceHours(hoursSettings, chosen) : unionHours(shown.map((r) => resourceHours(hoursSettings, r))),
        }));
  const mergedColumn = columns.some((c) => c.resourceId === null);

  const jobs: GridJob[] = bookings.map((b) => ({
    id: b.id,
    status: b.status,
    start: b.starts_at,
    end: b.ends_at,
    customer: b.customer?.name ?? null,
    service: b.service?.name ?? null,
    vehicle: [b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(" ") || null,
    postcode: b.postcode,
    locationType: b.location_type,
    resourceId: b.resource_id,
    resourceName: nameOf.get(b.resource_id) ?? "",
    phone: b.customer?.phone ?? null,
    address: [b.address_line, b.postcode].filter(Boolean).join(", "),
    hasEmail: Boolean(b.customer?.email),
  }));

  // Drive time between one job and the next, van by van: two vans' jobs are
  // never one after the other. A no-show isn't a place to be.
  const travelling = bookings.filter((b) => b.status !== "no_show");
  const lookup = travelling.length > 1 ? await lookupPostcodes(travelling.map((b) => b.postcode)) : new Map();
  const legs: GridLeg[] = shown.flatMap((r) =>
    travelLegs(
      travelling
        .filter((b) => b.resource_id === r.id)
        .map((b) => ({
          id: b.id,
          start: new Date(b.starts_at),
          end: new Date(b.ends_at),
          postcode: b.postcode,
          locationType: b.location_type,
        })),
      (postcode) => coordsFor(lookup, postcode),
      (a, b) => bufferFor(bufferSettings, a.locationType ?? "mobile", b.locationType ?? "mobile"),
    ).map((leg) => ({ ...leg, resourceId: r.id })),
  );
  // Several vans in one column would draw each other's gaps over the jobs.
  const drawnLegs = several && mergedColumn ? [] : legs;

  const selectedParam = typeof sp.job === "string" ? sp.job : undefined;
  const selectedRow = bookings.find((b) => b.id === selectedParam);
  const selected = selectedRow && { ...selectedRow, resourceName: several ? (nameOf.get(selectedRow.resource_id) ?? null) : null };
  const selectedEvent =
    selected && calendar
      ? await supabase
          .from("calendar_events")
          .select("sync_error, changed_in_google_at")
          .eq("tenant_id", tenant.id)
          .eq("booking_id", selected.id)
          .maybeSingle()
      : null;
  if (selectedEvent?.error) console.error("Diary calendar event read failed", selectedEvent.error);
  // Extra as well: the panel still opens if the photos can't be read.
  const selectedPhotos = selected?.customer
    ? await listJobPhotos(tenant.id, selected.id, selected.customer.id).catch((err) => {
        console.error("Job photos read failed", err);
        return [];
      })
    : [];
  const canManage = can("bookings.manage");
  const move = moveBookingAction.bind(null, slug);

  const label = viewLabel(view, days, today);
  const period = view === "week" ? "this week" : "this day";
  const counted = bookings.filter((b) => b.status !== "no_show" && (!chosen || b.resource_id === chosen.id)).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Diary" />
        {canManage && (
          <Link
            href={appUrl(`/${slug}/bookings/new?date=${date}${chosen ? `&resource=${chosen.id}` : ""}`)}
            className={buttonVariants({ size: "lg" })}
          >
            <Plus />
            Add booking
          </Link>
        )}
      </div>

      {typeof sp.repeats === "string" && (
        <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm">
          Repeats booked: {sp.repeats}.
          {typeof sp.skipped === "string" && ` ${sp.skipped.split(",").length} couldn't be booked because something's already there: ${sp.skipped.split(",").join(", ")}.`}
        </p>
      )}

      {sp.deposit === "failed" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
          The booking is in, but the deposit request couldn&apos;t be emailed. Open the job to try again.
        </p>
      )}

      {calendar?.status === "needs_reconnect" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
          Google Calendar needs reconnecting: new jobs aren&apos;t going into it and its busy times aren&apos;t updating.{" "}
          {can("settings.edit") && (
            <Link href={appUrl(`/${slug}/settings/integrations`)} className="font-medium underline underline-offset-2">
              Reconnect it
            </Link>
          )}
        </p>
      )}

      <DiaryControls slug={slug} view={view} date={date} today={today} label={label} resource={chosen?.id} />
      {view === "day" && <DayStrip slug={slug} date={date} today={today} resource={chosen?.id} />}
      {several && (
        <ResourceFilter slug={slug} view={view} date={date} resources={shown} current={chosen?.id} />
      )}

      <DiaryGrid
        slug={slug}
        view={view}
        columns={columns}
        today={today}
        now={now}
        timeZone={timeZone}
        jobs={jobs}
        blocks={[...blocks, ...googleBlocks]}
        legs={drawnLegs}
        selectedId={selected?.id}
        showResource={several && mergedColumn}
        resourceFilter={chosen?.id}
        moveJob={canManage ? move : undefined}
        canAdd={canManage}
      />
      <DiaryAgenda
        slug={slug}
        view={view}
        days={days}
        today={today}
        now={now}
        timeZone={timeZone}
        jobs={jobs}
        blocks={[...blocks, ...googleBlocks]}
        // One list holds every van, so only a single van's drives run in order.
        legs={several && !chosen ? [] : legs}
        selectedId={selected?.id}
        showResource={several && !chosen}
        resourceFilter={chosen?.id}
        canAdd={canManage}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {counted === 0 ? `Nothing booked ${period}.` : `${counted} ${counted === 1 ? "job" : "jobs"} ${period}.`}
        </p>
        <DiaryLegend google={Boolean(calendar)} drive={drawnLegs.length > 0} />
      </div>

      {selected && (
        <JobPanel
          job={selected}
          slug={slug}
          timeZone={timeZone}
          closeHref={diaryHref(slug, view, date, undefined, chosen?.id)}
          setStatus={setBookingStatusAction.bind(null, slug, selected.id)}
          canManage={can("bookings.manage")}
          calendarNote={calendarNoteOf(selectedEvent?.data ?? null, timeZone)}
          depositBlocked={stripeResult.data.stripe_ready ? undefined : "Connect Stripe under Settings → Payments to take deposits online."}
          photos={selectedPhotos}
          move={move}
          refund={
            can("money") && selected.deposit_status === "paid" && selected.stripe_payment_intent_id
              ? {
                  depositPence: selected.deposit_pence,
                  advice: refundAdvice(
                    policyOf(settingsResult.data?.cancellation_policy),
                    { startsAt: selected.starts_at, depositPaidPence: selected.deposit_pence },
                    now,
                  ),
                }
              : undefined
          }
          moveResources={resources
            .filter((r) => (r.active || r.id === selected.resource_id) && r.location_types.includes(selected.location_type))
            .map((r) => ({ id: r.id, name: r.name }))}
        />
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
      <section aria-labelledby="route-heading">
        <h2 id="route-heading" className="mb-3 font-medium">Route planner</h2>
        <RoutePlanner
          key={`${date}-${view}-${chosen?.id ?? ""}`}
          slug={slug}
          days={days}
          initialDay={days.includes(today) ? today : days[0]}
          timeZone={timeZone}
          vans={shown.filter((r) => (chosen ? r.id === chosen.id : travelling.some((b) => b.resource_id === r.id)))}
        />
      </section>

      <div className="grid gap-8">
      <section aria-labelledby="block-heading">
        <h2 id="block-heading" className="font-medium">Block out time</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Customers can&apos;t book into it. Jobs already in that time stay on your diary.
        </p>
        <BlockTimeForm
          action={addBlockedTime.bind(null, slug)}
          defaultDate={date}
          resources={resources.filter((r) => r.active)}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium">Time off {period}</h2>
        {blocks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>
                  {timeOffLabel(b.start, b.end, timeZone)}
                  {several && <span className="text-muted-foreground"> · {b.resourceName ?? "Whole business"}</span>}
                  {b.reason && <span className="text-muted-foreground"> · {b.reason}</span>}
                </span>
                <RemoveTimeOff action={removeBlockedTime.bind(null, slug, b.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
      </div>
    </>
  );
}

// The job's Google Calendar event, if anything about it needs saying.
function calendarNoteOf(event: { sync_error: string | null; changed_in_google_at: string | null } | null, timeZone: string) {
  if (event?.sync_error) return "Couldn't put this job in Google Calendar yet. We'll keep trying.";
  if (event?.changed_in_google_at) {
    const when = formatDayTime(event.changed_in_google_at, timeZone);
    return `This job's event was moved or deleted in Google Calendar (${when}) and has been put back. Change bookings here, not in Google.`;
  }
  return null;
}
