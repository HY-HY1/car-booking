import * as React from "react"
import { cn } from "cn"
import { Input } from "./input"

// A whole number with its unit in the field ("24 hours", "15 miles"), on the
// number keyboard on a phone. The arrows are hidden so the unit has room;
// the arrow keys still step it. className sizes the whole field; everything
// else goes to the input.
function NumberInput({
  className,
  unit,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { unit?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Input
        type="number"
        inputMode="numeric"
        step={1}
        className={cn(
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          unit && "pr-[calc(1.25rem+var(--unit-width))]"
        )}
        style={unit ? ({ "--unit-width": `${unit.length}ch` } as React.CSSProperties) : undefined}
        {...props}
      />
      {unit && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
        >
          {unit}
        </span>
      )}
    </div>
  )
}

export { NumberInput }
