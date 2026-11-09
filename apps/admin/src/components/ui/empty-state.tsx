import * as React from "react"
import { cn } from "cn"

// What a list or section shows when there's nothing in it. Compact is for one
// inside a card or a form.
function EmptyState({
  title,
  action,
  compact,
  className,
  children,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "grid justify-items-center gap-2 rounded-xl border border-dashed text-center text-sm text-muted-foreground",
        compact ? "p-4" : "p-8",
        className
      )}
    >
      {title && <p className="font-medium text-foreground">{title}</p>}
      {children && <div>{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export { EmptyState }
