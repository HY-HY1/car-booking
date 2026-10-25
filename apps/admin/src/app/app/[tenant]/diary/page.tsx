import type { Metadata } from "next";
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
import { BlockTimeForm } from "@/components/dashboard/diary/block-time-form";
import { DiaryControls, diaryHref, ResourceFilter } from "@/components/dashboard/diary/diary-controls";
import {
  DiaryGrid,
  type GridBlock,
  type GridColumn,
  type GridJob,
  type GridLeg,
} from "@/components/dashboard/diary/diary-grid";
import { JobPanel, type PanelJob } from "@/components/dashboard/diary/job-panel";
import { RemoveTimeOff } from "@/components/dashboard/diary/remove-time-off";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireTenant } from "@/lib/auth";
import { timeOffLabel, viewLabel } from "@/lib/diary-display";
import { createClient } from "@/lib/supabase/server";
import { addBlockedTime, removeBlockedTime, setBookingStatusAction } from "./actions";

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
  const [settingsResult, resourcesResult] = await Promise.all([
    supabase
      .from("booking_settings")
      .select("timezone, weekly_hours, unit_weekly_hours, travel_buffer_mins, unit_buffer_mins")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabase
      .from("resources")
      .select("id, name, location_types, weekly_hours, sort_order, active")
      .eq("tenant_id", tenant.id)
      .order("sort_order")
      .order("created_at"),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  if (resourcesResult.error) throw resourcesResult.error;

  const timeZone = settingsResult.data?.timezone ?? "Europe/London";
  const hoursSettings = {
    weekly_hours: weeklyHoursSchema.safeParse(settingsResult.data?.weekly_hours).data ?? {},
    unit_weekly_hours: weeklyHoursSchema.nullable().safeParse(settingsResult.data?.unit_weekly_hours).data ?? null,
  };
  const bufferSettings = {
    travel_buffer_mins: settingsResult.data?.travel_buffer_mins ?? 30,
    unit_buffer_mins: settingsResult.data?.unit_buffer_mins ?? 0,
  };
  const resources = z.array(resourceSchema.extend({ active: z.boolean() })).parse(resourcesResult.data);
  const nameOf = new Map(resources.map((r) => [r.id, r.name]));

  const now = new Date();
  const today = localDate(now, timeZone);
  const view = parseView(sp.view);
  const date = parseDiaryDate(sp.date, today);
  const days = diaryDays(view, date);
  const range = diaryRange(days, timeZone);

  const [bookingsResult, blockedResult] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, status, starts_at, ends_at, hold_expires_at, resource_id, location_type, address_line, postcode, access_notes, customer_notes, quote_snapshot, price_pence, deposit_pence, deposit_status, customer:customers(id, name, email, phone), service:services(name), vehicle:vehicles(make, model, registration, size_class)",
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
  ]);
  if (bookingsResult.error) throw bookingsResult.error;
  if (blockedResult.error) throw blockedResult.error;

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

  const label = viewLabel(view, days, today);
  const period = view === "week" ? "this week" : "this day";
  const counted = bookings.filter((b) => b.status !== "no_show" && (!chosen || b.resource_id === chosen.id)).length;

  return (
    <>
      <PageHeader
        title="Diary"
        description={`Your jobs by day${several ? ", van by van," : ""} including travel time between mobile jobs. Click a job for the details.`}
      />

      <DiaryControls slug={slug} view={view} date={date} today={today} label={label} resource={chosen?.id} />
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
        blocks={blocks}
        legs={drawnLegs}
        selectedId={selected?.id}
        showResource={several && mergedColumn}
        resourceFilter={chosen?.id}
      />

      <p className="mt-2 text-xs text-muted-foreground">
        {counted === 0
          ? `Nothing booked ${period}. Jobs appear here as customers book.`
          : `${counted} ${counted === 1 ? "job" : "jobs"} ${period}.`}{" "}
        Dashed amber is a slot held while the customer pays; hatched is time off; the grey strip between jobs is
        the estimated drive.
        {several && mergedColumn && " Pick a van above to see its drive times, or use the Day view for a column each."}
      </p>

      {selected && (
        <JobPanel
          job={selected}
          slug={slug}
          timeZone={timeZone}
          closeHref={diaryHref(slug, view, date, undefined, chosen?.id)}
          setStatus={setBookingStatusAction.bind(null, slug, selected.id)}
          canManage={can("bookings.manage")}
        />
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium">Time off {period}</h2>
        {blocks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None. Customers can book any time you&apos;re open.</p>
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

        <details className="mt-4 rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">Block out time</summary>
          <p className="mt-2 mb-4 text-sm text-muted-foreground">
            A holiday, a day off, the van in for a service. Customers can&apos;t book into it. Jobs already in
            that time stay on your diary.
          </p>
          <BlockTimeForm
            action={addBlockedTime.bind(null, slug)}
            defaultDate={date}
            resources={resources.filter((r) => r.active)}
          />
        </details>
      </section>
    </>
  );
}
