import * as React from "react"
import { cn } from "cn"

type ChoiceProps = Omit<React.ComponentProps<"input">, "type"> & {
  // Styles the label around the box, when there is one.
  labelClassName?: string
}

// With children it's a whole labelled row. Without, just the box, for a table
// cell or anywhere the label lives elsewhere (give it an aria-label).
function Choice({
  type,
  className,
  labelClassName,
  children,
  ...props
}: ChoiceProps & { type: "checkbox" | "radio" }) {
  const box = (
    <input
      type={type}
      data-slot={type}
      className={cn(
        "size-4 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        children != null && "mt-0.5",
        className
      )}
      {...props}
    />
  )
  if (children == null) return box
  return (
    <label className={cn("flex items-start gap-2 text-sm pointer-coarse:py-1.5 has-disabled:cursor-not-allowed has-disabled:opacity-60", labelClassName)}>
      {box}
      <span className="min-w-0">{children}</span>
    </label>
  )
}

function Checkbox(props: ChoiceProps) {
  return <Choice type="checkbox" {...props} />
}

function Radio(props: ChoiceProps) {
  return <Choice type="radio" {...props} />
}

export { Checkbox, Radio }
