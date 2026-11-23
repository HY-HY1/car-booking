"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { controlClass } from "./control"

// shadcn's Select (Base UI): a dropdown drawn by us, so its list follows the
// dashboard's light or dark theme, and options can show more than text (each
// typeface drawn in itself, say). The native one in select.tsx stays for
// plain lists, where phones' own pickers are handier.
//
// Sits inside <Field> like any control: the id, error state and hint are
// passed on to the trigger. Sends its value with the form under `name`
// (Base UI's hidden input). A null value is sent as blank.

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }

function SelectMenu<Value extends string | null>({
  name,
  value,
  defaultValue,
  onValueChange,
  disabled,
  placeholder,
  renderValue,
  className,
  style,
  children,
  id,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: ControlProps & {
  name?: string
  value?: Value
  defaultValue?: Value
  onValueChange?: (value: Value) => void
  disabled?: boolean
  placeholder?: React.ReactNode
  // What the closed dropdown shows for a value; the raw value if left out.
  renderValue?: (value: Value) => React.ReactNode
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <SelectPrimitive.Root<Value>
      name={name}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      inputRef={input}
      onValueChange={(next) => {
        onValueChange?.(next as Value)
        // The list opens outside the form, so the form never hears the
        // pick; tell it once the hidden input has the new value, so Save
        // and the unsaved-changes warning notice (unsaved-changes.ts).
        requestAnimationFrame(() => input.current?.dispatchEvent(new Event("change", { bubbles: true })))
      }}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cn(
          controlClass,
          "flex h-11 cursor-pointer items-center justify-between gap-2 text-left data-popup-open:border-ring",
          className
        )}
        style={style}
      >
        <SelectPrimitive.Value className="min-w-0 truncate data-placeholder:text-muted-foreground" placeholder={placeholder}>
          {renderValue ? (v: Value) => renderValue(v) : undefined}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronDownIcon className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-50 outline-none" sideOffset={4} alignItemWithTrigger={false}>
          <SelectPrimitive.Popup
            className={cn(
              "max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
            )}
          >
            <SelectPrimitive.List>{children}</SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

function SelectMenuItem({
  value,
  className,
  style,
  children,
}: {
  value: string | null
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        "relative flex min-h-9 cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
    >
      <SelectPrimitive.ItemText className="min-w-0 truncate" style={style}>
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectMenuGroup({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <SelectPrimitive.Group className="not-first:mt-1 not-first:border-t not-first:pt-1">
      <SelectPrimitive.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </SelectPrimitive.GroupLabel>
      {children}
    </SelectPrimitive.Group>
  )
}

export { SelectMenu, SelectMenuGroup, SelectMenuItem }
