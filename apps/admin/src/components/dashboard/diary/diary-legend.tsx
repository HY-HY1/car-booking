import { BOOKING_STATUS } from "@/lib/booking-display";
import { HATCH, JOB_EDGE, JOB_FILL } from "@/lib/diary-display";
import { cn } from "@/lib/utils";

const STATUSES = ["confirmed", "requested", "held", "completed", "no_show"];

// What the colours on the grid mean. A phone doesn't need it: each card there
// says its status in words.
export function DiaryLegend({ google, drive }: { google: boolean; drive: boolean }) {
  return (
    <ul aria-label="Colour key" className="hidden flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground md:flex">
      {STATUSES.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("h-3.5 w-4 rounded-sm border-l-4", JOB_EDGE[status], JOB_FILL[status])} />
          {BOOKING_STATUS[status]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-3.5 w-4 rounded-sm border border-muted-foreground/30"
          style={{ backgroundImage: HATCH }}
        />
        {google ? "Time off or busy in Google Calendar" : "Time off"}
      </li>
      {drive && (
        <>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-3.5 w-4 rounded-sm border border-dashed border-muted-foreground/40 bg-muted/70" />
            Estimated drive
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-3.5 w-4 rounded-sm border border-dashed border-red-400 bg-red-50 dark:bg-red-950/40" />
            Too tight to drive
          </li>
        </>
      )}
    </ul>
  );
}
