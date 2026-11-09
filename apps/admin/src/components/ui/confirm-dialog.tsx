"use client"

import { useEffect, useState } from "react"
import { AlertDialog } from "@base-ui/react/alert-dialog"
import { Button } from "./button"
import { Checkbox, Radio } from "./checkbox"
import { Textarea } from "./textarea"

type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  // Red button, for something that deletes, cancels or can't be undone.
  destructive?: boolean
}

type Option = { label: string; defaultChecked?: boolean }
export type Choice = {
  value: string
  label: string
  // What the button says while this one is picked.
  confirmLabel?: string
  // A line about this one, shown while it's picked.
  note?: string
}
export type Choices = { legend: string; hint?: string; options: Choice[]; defaultValue: string }
type TextField = { label: string; placeholder?: string; maxLength?: number }
type Extras = { option?: Option; choices?: Choices; text?: TextField }
type Answer = { option: boolean; choice: string | null; text: string } | null
type Request = ConfirmOptions & Extras & { resolve: (answer: Answer) => void }

let show: ((request: Request) => void) | null = null

// As askToConfirm, with something to fill in: a tickbox, a pick of one from
// several, or a line of text. Null if they back out, otherwise what they put.
export function askToConfirmWith(options: ConfirmOptions, extras: Extras = {}) {
  return new Promise<Answer>((resolve) => {
    if (show) show({ ...options, ...extras, resolve })
    else resolve(null)
  })
}

// In place of the browser's confirm(): resolves true if they go ahead. Needs
// <ConfirmHost /> on the page (app/app/layout.tsx).
export async function askToConfirm(options: ConfirmOptions) {
  return (await askToConfirmWith(options)) !== null
}

export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null)
  const [open, setOpen] = useState(false)
  const [ticked, setTicked] = useState(false)
  const [choice, setChoice] = useState<string | null>(null)
  const [text, setText] = useState("")
  const picked = request?.choices?.options.find((o) => o.value === choice)

  useEffect(() => {
    show = (next) => {
      setRequest(next)
      setTicked(next.option?.defaultChecked ?? false)
      setChoice(next.choices?.defaultValue ?? null)
      setText("")
      setOpen(true)
    }
    return () => {
      show = null
    }
  }, [])

  function settle(confirmed: boolean) {
    request?.resolve(confirmed ? { option: ticked, choice, text } : null)
    setOpen(false)
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && settle(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup
          // Portalled outside the dashboard, so it asks for the brand colours itself.
          data-brand=""
          className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg transition-all duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
        >
          <div className="grid gap-1.5">
            <AlertDialog.Title className="text-base font-semibold">{request?.title}</AlertDialog.Title>
            {request?.description && (
              <AlertDialog.Description className="text-sm text-muted-foreground">
                {request.description}
              </AlertDialog.Description>
            )}
          </div>
          {request?.choices && (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">{request.choices.legend}</legend>
              {request.choices.hint && <p className="text-sm text-muted-foreground">{request.choices.hint}</p>}
              {request.choices.options.map((o) => (
                <Radio
                  key={o.value}
                  name="confirm-choice"
                  value={o.value}
                  checked={choice === o.value}
                  onChange={() => setChoice(o.value)}
                >
                  {o.label}
                </Radio>
              ))}
              {picked?.note && <p className="text-xs text-muted-foreground">{picked.note}</p>}
            </fieldset>
          )}
          {request?.text && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">{request.text.label}</span>
              <Textarea
                rows={2}
                maxLength={request.text.maxLength}
                placeholder={request.text.placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
          )}
          {request?.option && (
            <Checkbox checked={ticked} onChange={(e) => setTicked(e.target.checked)}>
              {request.option.label}
            </Checkbox>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close render={<Button variant="outline" size="lg" />}>
              {request?.cancelLabel ?? "Go back"}
            </AlertDialog.Close>
            <Button
              type="button"
              size="lg"
              variant={request?.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {picked?.confirmLabel ?? request?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
