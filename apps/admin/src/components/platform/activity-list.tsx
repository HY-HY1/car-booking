import Link from "next/link";
import { ACTIVITY_AREAS, parseActivityArea } from "@leadgen/core/activity/rules";
import { formatDateTime } from "@leadgen/core/dates";
import type { ActivityRow } from "@leadgen/core/platform/overview";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { adminUrl } from "@/lib/urls";

// Lines from businesses' activity logs: who did what, where and when.
export function ActivityList({ rows, showBusiness = true, empty = "Nothing yet." }: { rows: ActivityRow[]; showBusiness?: boolean; empty?: string }) {
  if (rows.length === 0) return <EmptyState compact>{empty}</EmptyState>;
  return (
    <ul className="divide-y">
      {rows.map((a) => {
        const area = parseActivityArea(a.action.split(".")[0]);
        return (
          <li key={a.id} className="grid gap-0.5 py-2.5 text-sm first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {area && <Badge>{ACTIVITY_AREAS[area]}</Badge>}
              <span className="min-w-0">{a.summary}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(a.at)}
              {a.actorEmail && <> · {a.actorEmail}</>}
              {showBusiness && a.tenant && (
                <>
                  {" · "}
                  <Link href={adminUrl(`/businesses/${a.tenant.slug}`)} className="underline-offset-4 hover:underline">
                    {a.tenant.name}
                  </Link>
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
