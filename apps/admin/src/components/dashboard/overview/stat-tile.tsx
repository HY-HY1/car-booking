import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { percentChange } from "@leadgen/core/stats/periods";
import { cn } from "@/lib/utils";

// A headline number with how it compares. The change is shown as an arrow and
// words as well as a colour, so it doesn't depend on telling green from red.
export function StatTile({
  label,
  value,
  note,
  current,
  previous,
  comparedWith,
}: {
  label: string;
  value: string;
  note?: string;
  current?: number;
  previous?: number;
  comparedWith?: string;
}) {
  const change = current !== undefined && previous !== undefined ? percentChange(current, previous) : null;

  return (
    <div className="grid content-start gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {change !== null && comparedWith && (
        <p
          className={cn(
            "flex items-center gap-1 text-xs",
            change > 0 ? "text-emerald-700 dark:text-emerald-400" : change < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {change > 0 ? <ArrowUp className="size-3" /> : change < 0 ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
          <span>
            {change === 0 ? "No change" : `${Math.abs(change)}% ${change > 0 ? "up" : "down"}`}
            <span className="text-muted-foreground"> on {comparedWith}</span>
          </span>
        </p>
      )}
    </div>
  );
}
