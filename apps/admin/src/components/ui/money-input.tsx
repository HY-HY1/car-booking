import * as React from "react"
import { cn } from "cn"
import { Input } from "./input"

// An amount in pounds, with the £ in the field. className sizes the whole
// field; everything else goes to the input.
function MoneyInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
      >
        £
      </span>
      <Input inputMode="decimal" className="pl-7" {...props} />
    </div>
  )
}

export { MoneyInput }
