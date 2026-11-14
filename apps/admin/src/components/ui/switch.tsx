import * as React from "react"
import { cn } from "cn"

type SwitchProps = Omit<React.ComponentProps<"input">, "type"> & {
  // A line under the label saying what switching it does.
  description?: React.ReactNode
  labelClassName?: string
}

// An on/off setting. Underneath it's a checkbox (role="switch"), so a form
// posts "on" or nothing, exactly as a checkbox does. With children it's a
// whole row: the label and description on the left, the switch on the right.
// Without, just the switch (give it an aria-label).
function Switch({ className, labelClassName, description, children, ...props }: SwitchProps) {
  const control = (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <input
        type="checkbox"
        role="switch"
        data-slot="switch"
        className="peer h-6 w-10 cursor-pointer appearance-none rounded-full bg-muted-foreground/35 transition-colors outline-none checked:bg-primary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow-sm ring-1 ring-foreground/10 transition-transform peer-checked:translate-x-4"
      />
    </span>
  )
  if (children == null) return control
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60 pointer-coarse:py-1",
        labelClassName
      )}
    >
      <span className="grid min-w-0 gap-0.5">
        <span className="font-medium">{children}</span>
        {description && <span className="text-muted-foreground">{description}</span>}
      </span>
      {control}
    </label>
  )
}

export { Switch }
