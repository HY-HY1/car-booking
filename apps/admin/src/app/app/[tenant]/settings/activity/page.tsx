import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ACTIVITY_AREAS, ACTIVITY_RETENTION_MONTHS, parseActivityArea, type ActivityArea } from "@leadgen/core/activity/rules";
import { formatDateTime } from "@leadgen/core/dates";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity log" };

const PER_PAGE = 50;
const areas = Object.keys(ACTIVITY_AREAS) as ActivityArea[];

// "Older" carries the last entry shown, as <time>~<id>: entries made in the
// same instant are told apart by id, so none is skipped at a page break.
function parseCursor(value: unknown) {
  if (typeof value !== "string") return null;
  const [at, id] = value.split("~");
  if (!at || Number.isNaN(Date.parse(at)) || !z.uuid().safeParse(id).success) return null;
  return { at: new Date(at).toISOString(), id };
}

export default async function ActivityPage({ params, searchParams }: PageProps<"/app/[tenant]/settings/activity">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAccess(slug, "activity.view");
  const sp = await searchParams;
  const area = parseActivityArea(sp.area);
  const cursor = parseCursor(sp.before);

  // RLS limits this to owners and managers of this business.
  const supabase = await createClient();
  let query = supabase
    .from("activity_log")
    .select("id, actor_email, summary, entity_type, entity_id, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PER_PAGE + 1);
  if (area) query = query.like("action", `${area}.%`);
  if (cursor) query = query.or(`created_at.lt."${cursor.at}",and(created_at.eq."${cursor.at}",id.lt.${cursor.id})`);

  const [{ data, error }, settings] = await Promise.all([
    query,
    supabase.from("booking_settings").select("timezone").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  if (error) throw error;
  if (settings.error) throw settings.error;
  const timeZone = settings.data?.timezone ?? "Europe/London";

  const rows = data.slice(0, PER_PAGE);
  const last = rows[rows.length - 1];
  const older = data.length > PER_PAGE && last ? `${last.created_at}~${last.id}` : null;

  const base = appUrl(`/${slug}/settings/activity`);
  const href = (q: { area?: ActivityArea | null; before?: string | null }) => {
    const search = new URLSearchParams();
    if (q.area) search.set("area", q.area);
    if (q.before) search.set("before", q.before);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const entityHref = (type: string | null, id: string | null) => {
    if (!id) return null;
    if (type === "booking") return appUrl(`/${slug}/bookings/${id}`);
    if (type === "customer") return appUrl(`/${slug}/customers/${id}`);
    return null;
  };
  const chip =
    "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by area" className="flex flex-wrap gap-2">
          <Link href={href({})} aria-current={!area ? "page" : undefined} className={cn(chip, !area && "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background")}>
            All
          </Link>
          {areas.map((a) => (
            <Link
              key={a}
              href={href({ area: a })}
              aria-current={area === a ? "page" : undefined}
              className={cn(chip, area === a && "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background")}
            >
              {ACTIVITY_AREAS[a]}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">Kept for {ACTIVITY_RETENTION_MONTHS} months. Entries can&apos;t be edited or removed.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState>{cursor || area ? "Nothing to show here." : "Nothing yet. Changes made in your dashboard will appear here from now on."}</EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {rows.map((r) => {
            const link = entityHref(r.entity_type, r.entity_id);
            return (
              <li key={r.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4 sm:px-6">
                <span className="min-w-0">
                  <span className="font-medium">{r.summary}</span>
                  {link && (
                    <Link href={link} className="ml-2 text-muted-foreground underline underline-offset-4 hover:text-foreground">
                      View
                    </Link>
                  )}
                  <span className="block truncate text-muted-foreground">{r.actor_email ?? "Removed login"}</span>
                </span>
                <time dateTime={r.created_at} className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(r.created_at, timeZone)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      {(cursor || older) && (
        <div className="flex flex-wrap gap-2">
          {cursor && (
            <Link href={href({ area })} className={buttonVariants({ variant: "outline" })}>
              Back to newest
            </Link>
          )}
          {older && (
            <Link href={href({ area, before: older })} className={buttonVariants({ variant: "outline" })}>
              Older
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
