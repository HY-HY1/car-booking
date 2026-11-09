import * as React from "react"
import { cn } from "cn"

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  danger: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  violet: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  accent: "bg-accent text-accent-foreground",
} as const

type BadgeTone = keyof typeof TONES

function Badge({ tone = "neutral", className, ...props }: React.ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
      {...props}
    />
  )
}

export { Badge, type BadgeTone }
