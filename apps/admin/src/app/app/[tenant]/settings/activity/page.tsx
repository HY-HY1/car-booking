import type { Metadata } from "next";
import Link from "next/link";
import { ACTIVITY_AREAS, ACTIVITY_RETENTION_MONTHS, parseActivityArea, type ActivityArea } from "@leadgen/core/activity/rules";
import { formatDateTime } from "@leadgen/core/dates";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity log" };

const PER_PAGE = 50;
const areas = Object.keys(ACTIVITY_AREAS) as ActivityArea[];

export default async function ActivityPage({ params, searchParams }: PageProps<"/app/[tenant]/settings/activity">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAccess(slug, "activity.view");
  const sp = await searchParams;
  const area = parseActivityArea(sp.area);
  const before = typeof sp.before === "string" && !Number.isNaN(Date.parse(sp.before)) ? sp.before : null;

  // RLS limits this to owners and managers of this business.
  const supabase = await createClient();
  let query = supabase
    .from("activity_log")
    .select("id, actor_email, summary, entity_type, entity_id, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(PER_PAGE + 1);
  if (area) query = query.like("action", `${area}.%`);
  if (before) query = query.lt("created_at", before);

  const [{ data, error }, settings] = await Promise.all([
    query,
    supabase.from("booking_settings").select("timezone").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  if (error) throw error;
  if (settings.error) throw settings.error;
  const timeZone = settings.data?.timezone ?? "Europe/London";

  const rows = data.slice(0, PER_PAGE);
  const older = data.length > PER_PAGE ? rows[rows.length - 1].created_at : null;

  const base = appUrl(`/${slug}/settings/activity`);
  const href = (query: { area?: ActivityArea | null; before?: string | null }) => {
    const search = new URLSearchParams();
    if (query.area) search.set("area", query.area);
    if (query.before) search.set("before", query.before);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  const entityHref = (type: string | null, id: string | null) => {
    if (!id) return null;
    if (type === "booking") return appUrl(`/${slug}/bookings/${id}`);
    if (type === "customer") return appUrl(`/${slug}/customers/${id}`);
    return null;
  };
  const tab = "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted";

  return (
    <div className="grid gap-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Who changed what in your dashboard. Entries can&apos;t be edited or removed, and are kept for {ACTIVITY_RETENTION_MONTHS} months.
      </p>

      <nav aria-label="Filter by area" className="flex flex-wrap gap-1">
        <Link href={href({})} aria-current={!area ? "page" : undefined} className={cn(tab, !area && "bg-muted text-foreground")}>
          All
        </Link>
        {areas.map((a) => (
          <Link key={a} href={href({ area: a })} aria-current={area === a ? "page" : undefined} className={cn(tab, area === a && "bg-muted text-foreground")}>
            {ACTIVITY_AREAS[a]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState>{before || area ? "Nothing to show here." : "Nothing yet. Changes made in your dashboard will appear here from now on."}</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((r) => {
            const link = entityHref(r.entity_type, r.entity_id);
            return (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{r.summary}</span>
                  {link && (
                    <Link href={link} className="ml-2 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      View
                    </Link>
                  )}
                  <span className="block truncate text-muted-foreground">{r.actor_email ?? "Removed login"}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(r.created_at, timeZone)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {(before || older) && (
        <div className="flex gap-4 text-sm">
          {before && (
            <Link href={href({ area })} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Back to newest
            </Link>
          )}
          {older && (
            <Link href={href({ area, before: older })} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Older
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
