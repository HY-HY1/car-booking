import { cloneElement, Fragment, isValidElement, useId, type ReactElement, type ReactNode } from "react"
import { cn } from "cn"
import { Label } from "./label"

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }

// A label, its control, and a hint or error underneath. The control gets its
// id and error state from here; several forms can share a page, so an id is
// made per field unless the control already has one.
function Field({
  label,
  name,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode
  name: string
  hint?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}) {
  const generated = useId()
  // A wrapper can't take the id, so its control has to have id={name} itself.
  const control =
    isValidElement(children) && ![Fragment, "div", "span"].includes(children.type as string)
      ? (children as ReactElement<ControlProps>)
      : null
  const id = control?.props.id ?? `${name}-${generated}`
  const messageId = `${id}-message`
  const described = error || hint ? messageId : control?.props["aria-describedby"]

  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={control ? id : name}>{label}</Label>
      {control
        ? cloneElement(control, {
            id,
            "aria-invalid": error ? true : control.props["aria-invalid"],
            "aria-describedby": described,
          })
        : children}
      {error ? (
        <p id={messageId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export { Field }
