import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DIARY_VIEWS, stepDate, type DiaryView } from "@leadgen/core/booking/diary";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";

const NAMES: Record<DiaryView, string> = { day: "Day", week: "Week" };

export function diaryHref(slug: string, view: DiaryView, date: string, job?: string, resource?: string) {
  const params = new URLSearchParams({ view, date });
  if (resource) params.set("resource", resource);
  if (job) params.set("job", job);
  return appUrl(`/${slug}/diary?${params}`);
}

// Day / Week, stepping through them, and back to today. All plain links, so
// where you are is in the address and survives a refresh.
export function DiaryControls({
  slug,
  view,
  date,
  today,
  label,
  resource,
}: {
  slug: string;
  view: DiaryView;
  date: string;
  today: string;
  label: string;
  // The van picked in the week view, kept as you move around.
  resource?: string;
}) {
  const step = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground";
  // Switching view keeps the date you're looking at.
  const href = (v: DiaryView, d: string) => diaryHref(slug, v, d, undefined, resource);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Diary view" className="flex gap-1 rounded-xl bg-muted p-1">
        {DIARY_VIEWS.map((v) => (
          <Link
            key={v}
            href={href(v, date)}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              v === view && "bg-background text-foreground shadow-sm",
            )}
          >
            {NAMES[v]}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1">
        <Link href={href(view, stepDate(view, date, -1))} aria-label={view === "week" ? "Previous week" : "Previous day"} className={step}>
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-40 text-center text-sm font-medium">{label}</span>
        <Link href={href(view, stepDate(view, date, 1))} aria-label={view === "week" ? "Next week" : "Next day"} className={step}>
          <ChevronRight className="size-4" />
        </Link>
        <Link
          href={href(view, today)}
          className="ml-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Today
        </Link>
      </div>
    </div>
  );
}

// Which van or bay the week view shows: all of them, or one.
export function ResourceFilter({
  slug,
  view,
  date,
  resources,
  current,
}: {
  slug: string;
  view: DiaryView;
  date: string;
  resources: { id: string; name: string }[];
  current?: string;
}) {
  const pill = "rounded-lg px-3 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <nav aria-label="Van or bay" className="mb-4 flex flex-wrap gap-1">
      <Link
        href={diaryHref(slug, view, date)}
        aria-current={!current ? "page" : undefined}
        className={cn(pill, !current && "bg-muted text-foreground")}
      >
        All
      </Link>
      {resources.map((r) => (
        <Link
          key={r.id}
          href={diaryHref(slug, view, date, undefined, r.id)}
          aria-current={current === r.id ? "page" : undefined}
          className={cn(pill, current === r.id && "bg-muted text-foreground")}
        >
          {r.name}
        </Link>
      ))}
    </nav>
  );
}
