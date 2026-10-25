import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PERIODS, type Period } from "@leadgen/core/stats/periods";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";

const NAMES: Record<Period, string> = { day: "Day", week: "Week", month: "Month", year: "Year" };

// Day / Week / Month / Year, and stepping back through earlier ones. All plain
// links, so the choice is in the address and survives a refresh or a share.
export function PeriodControls({
  slug,
  period,
  offset,
  label,
}: {
  slug: string;
  period: Period;
  offset: number;
  label: string;
}) {
  const base = appUrl(`/${slug}`);
  const href = (p: Period, n: number) => `${base}?period=${p}${n > 0 ? `&n=${n}` : ""}`;
  const step = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Period" className="flex gap-1 rounded-xl bg-muted p-1">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={href(p, 0)}
            aria-current={p === period ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              p === period && "bg-background text-foreground shadow-sm",
            )}
          >
            {NAMES[p]}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1">
        <Link href={href(period, offset + 1)} aria-label="Earlier" className={step}>
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-36 text-center text-sm font-medium">{label}</span>
        {offset > 0 ? (
          <Link href={href(period, offset - 1)} aria-label="Later" className={step}>
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span aria-hidden className={cn(step, "pointer-events-none opacity-30")}>
            <ChevronRight className="size-4" />
          </span>
        )}
        {offset > 0 && (
          <Link href={href(period, 0)} className="ml-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            Now
          </Link>
        )}
      </div>
    </div>
  );
}
