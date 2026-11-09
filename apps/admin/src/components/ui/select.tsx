import * as React from "react"
import { cn } from "cn"
import { controlClass } from "./control"

// A native dropdown, so phones get their own picker. The arrow is drawn in
// globals.css ([data-slot="select"]).
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        controlClass,
        "h-11 cursor-pointer appearance-none py-1 pr-8 [&>option]:bg-popover [&>option]:text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Select }
