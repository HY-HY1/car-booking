import type { ConditionCheck } from "@leadgen/core/booking/condition";
import { cn } from "@/lib/utils";

// How the car's condition was worked out from the customer's photos, and
// whether the price still needs confirming once the owner has seen the car.
// Shared by the bookings list, the booking and lead pages and the diary.
export function ConditionNote({
  condition,
  needsInspection,
  size = "sm",
}: {
  condition: ConditionCheck | null;
  needsInspection: boolean;
  size?: "xs" | "sm";
}) {
  if (!condition && !needsInspection) return null;

  const confirm = "Price to be confirmed after seeing the car.";
  const reason =
    condition?.result === "unsure"
      ? "The photos didn't show enough to judge the condition."
      : condition?.result === "failed"
        ? "The photo check didn't run, so the condition wasn't priced."
        : condition?.result === "not_checked"
          ? "No photos, so the condition wasn't priced."
          : null;
  const level = condition?.result === "assessed" && condition.label ? condition.label.split(":")[0] : null;

  return (
    <div className={cn("grid gap-1", size === "xs" && "text-xs")}>
      {level && (
        <p>
          <span className="text-muted-foreground">Condition from photos:</span> <span className="font-medium">{level}</span>
          {condition?.confidence !== null && condition?.confidence !== undefined && (
            <span className="text-muted-foreground"> ({Math.round(condition.confidence * 100)}% sure)</span>
          )}
        </p>
      )}
      {condition?.summary && <p className="text-muted-foreground">&ldquo;{condition.summary}&rdquo;</p>}
      {needsInspection && (
        <p className={cn("rounded-lg bg-amber-50 text-amber-900", size === "xs" ? "px-2 py-1" : "px-3 py-2")}>
          {reason ? `${reason} ${confirm}` : confirm}
        </p>
      )}
    </div>
  );
}
