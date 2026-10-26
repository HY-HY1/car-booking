"use client";

import { cloneElement, useId, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// The pieces the dashboard's editors are built from: a form that saves
// through a server action and shows its errors, collapsible rows, and labelled
// fields. Used by the pricing and booking-settings editors.

export type Action = (formData: FormData) => Promise<SaveState>;

export const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";


export type Errors = Record<string, string | undefined>;

export function SaveForm({
  action,
  readOnly,
  resetOnSave,
  onSaved,
  submitLabel = "Save",
  savedText = "Saved. Customers see this now.",
  extra,
  sticky,
  children,
}: {
  action: Action;
  readOnly?: boolean;
  resetOnSave?: boolean;
  onSaved?: () => void;
  submitLabel?: string;
  // What "Saved" says: settings customers don't see yet say so.
  savedText?: string;
  extra?: React.ReactNode;
  // Keep the save buttons in view at the bottom of long forms.
  sticky?: boolean;
  children: (errors: Errors) => React.ReactNode;
}) {
  const [state, setState] = useState<SaveState>({});
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      noValidate
      className="grid gap-5"
      // Clear "Saved" as soon as anything changes again.
      onChange={() => state.saved && setState({})}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          let result: SaveState;
          try {
            result = await action(formData);
          } catch (error) {
            // The request itself failed (offline, or the host turned it away,
            // e.g. images over its size limit). Say so and keep what was typed,
            // rather than dropping into the page's error screen.
            console.error("Save failed", error);
            setState({ message: "Couldn't save. Check your connection and try again; if you added images, try smaller ones." });
            return;
          }
          setState(result);
          if (result.saved) {
            if (resetOnSave) form.current?.reset();
            onSaved?.();
          }
        });
      }}
    >
      <fieldset disabled={readOnly || pending} className="grid gap-5">
        {children(state.errors ?? {})}
      </fieldset>
      {!readOnly && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3",
            sticky && "sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          )}
        >
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          {extra}
          <p role="status" className="text-sm">
            {state.message ? (
              <span className="text-destructive">{state.message}</span>
            ) : state.errors ? (
              <span className="text-destructive">Check the highlighted fields.</span>
            ) : state.saved && !pending ? (
              <span className="text-muted-foreground">{savedText}</span>
            ) : null}
          </p>
        </div>
      )}
    </form>
  );
}

export function Row({
  title,
  summary,
  hidden,
  children,
}: {
  title: string;
  summary: string;
  hidden: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className={cn("font-medium", hidden && "text-muted-foreground")}>{title}</span>
          {hidden && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Hidden</span>}
          <span className="block truncate text-sm text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-4">{children}</div>
    </details>
  );
}

export function AddRow({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
    );
  }
  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium">{label}</h3>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </div>
      {children(() => setOpen(false))}
    </div>
  );
}

export function DeleteButton({ what, note, action }: { what: string; note?: string; action: () => Promise<SaveState> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        className="text-destructive"
        onClick={() => {
          if (!confirm(`Delete ${what}? ${note ?? `Past bookings keep their prices. To stop offering it for now, untick "Show on booking page" instead.`}`)) return;
          startTransition(async () => setError((await action()).message));
        }}
      >
        <Trash2 /> {pending ? "Deleting…" : "Delete"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </>
  );
}

export function Check({
  name,
  label,
  value,
  defaultChecked,
}: {
  name: string;
  label: string;
  value?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="size-4 accent-primary" />
      {label}
    </label>
  );
}

export function FirstError({ errors, prefix }: { errors: Errors; prefix: string }) {
  const first = Object.entries(errors).find(([k, v]) => k.startsWith(prefix) && v)?.[1];
  return first ? <p className="text-sm text-destructive">{first}</p> : null;
}

export function Field({
  label,
  name,
  error,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  className?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  // Several forms share a page, so ids are made unique per field instance.
  const id = `${name}-${useId()}`;
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${id}-error` : undefined,
      })}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
