"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check as CheckIcon, ChevronDown, Plus, Trash2, X } from "lucide-react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { useChangeTracking } from "./unsaved-changes";

// The pieces the dashboard's editors are built from: a form that saves
// through a server action and shows its errors, collapsible rows, and labelled
// fields. Used by the pricing and booking-settings editors.

export type Action = (formData: FormData) => Promise<SaveState>;

export type Errors = Record<string, string | undefined>;

// How the forms in one part of the dashboard behave. Settings turns on
// requireChanges (Save stays off until something's changed, and says when
// it's saved) and the footer look (a divided row: status left, buttons right).
const SaveFormStyle = createContext({ requireChanges: false, footer: false });

export function SaveFormDefaults({
  requireChanges = false,
  footer = false,
  children,
}: {
  requireChanges?: boolean;
  footer?: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ requireChanges, footer }), [requireChanges, footer]);
  return <SaveFormStyle.Provider value={value}>{children}</SaveFormStyle.Provider>;
}

export function SaveForm({
  action,
  readOnly,
  resetOnSave,
  onSaved,
  submitLabel = "Save",
  savedText = "Saved. Customers see this now.",
  extra,
  sticky,
  alwaysEnabled,
  danger,
  children,
}: {
  action: Action;
  readOnly?: boolean;
  // A form that adds something: it starts empty and is emptied again once
  // saved, so it's never "unchanged" and Save is always on.
  resetOnSave?: boolean;
  onSaved?: () => void;
  submitLabel?: string;
  // What "Saved" says: settings customers don't see yet say so.
  savedText?: string;
  extra?: React.ReactNode;
  // Keep the save buttons in view at the bottom of long forms.
  sticky?: boolean;
  // Save is on even with nothing changed (what's showing is a valid choice
  // that hasn't been saved yet, like a pre-picked option).
  alwaysEnabled?: boolean;
  // Saving deletes or ends something: a red button.
  danger?: boolean;
  children: (errors: Errors) => React.ReactNode;
}) {
  const style = useContext(SaveFormStyle);
  const [state, setState] = useState<SaveState>({});
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const { markSaved, changed } = useChangeTracking(form, !readOnly);
  // "Saved" shows from a save until the next edit.
  const [savedShown, setSavedShown] = useState(false);
  // Read once the save has finished: while it's going, the fields are disabled
  // and a form leaves disabled fields out.
  const justSaved = useRef(false);
  useEffect(() => {
    if (pending || !justSaved.current) return;
    justSaved.current = false;
    markSaved();
  }, [pending, markSaved]);

  const needsChange = style.requireChanges && !resetOnSave && !alwaysEnabled;
  const canSave = !pending && (!needsChange || changed);
  const status = state.message ? (
    <span className="text-destructive">{state.message}</span>
  ) : state.errors ? (
    <span className="text-destructive">Check the highlighted fields.</span>
  ) : changed && needsChange ? (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <span aria-hidden className="size-2 rounded-full bg-amber-500" /> Unsaved changes
    </span>
  ) : savedShown && !changed ? (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> Saved
    </span>
  ) : null;

  return (
    <form
      ref={form}
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
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
            toast.success(savedText);
            if (resetOnSave) form.current?.reset();
            justSaved.current = true;
            setSavedShown(true);
            onSaved?.();
          }
        });
      }}
    >
      <fieldset disabled={readOnly || pending} className="grid min-w-0 gap-5">
        {children(state.errors ?? {})}
      </fieldset>
      {!readOnly &&
        (style.footer ? (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-4 gap-y-3",
              // Long forms: a bar that floats at the bottom of the screen
              // while there's more form below, and settles at the end.
              sticky
                ? "sticky bottom-[calc(var(--bottom-nav)+0.75rem)] z-10 rounded-xl bg-card/95 px-4 py-3 shadow-lg ring-1 ring-foreground/10 backdrop-blur supports-[backdrop-filter]:bg-card/85"
                : "border-t pt-4",
            )}
          >
            <p role="status" className="min-h-5 text-sm">
              {status}
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {extra}
              <Button type="submit" size="lg" variant={danger ? "destructive" : "default"} disabled={!canSave}>
                {pending ? "Saving…" : submitLabel}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-wrap items-center gap-3",
              sticky && "sticky bottom-(--bottom-nav) z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            )}
          >
            <Button type="submit" size="lg" variant={danger ? "destructive" : "default"} disabled={!canSave}>
              {pending ? "Saving…" : submitLabel}
            </Button>
            {extra}
            <p role="status" className="text-sm">
              {status}
            </p>
          </div>
        ))}
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
          {hidden && <Badge className="ml-2">Hidden</Badge>}
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
  return (
    <Button
      type="button"
      variant="destructive"
      size="lg"
      disabled={pending}
      onClick={async () => {
        const confirmed = await askToConfirm({
          title: `Delete ${what}?`,
          description: note ?? `Past bookings keep their prices. To stop offering it for now, untick "Show on booking page" instead.`,
          confirmLabel: "Delete",
          destructive: true,
        });
        if (!confirmed) return;
        startTransition(async () => {
          const { message } = await action();
          if (message) toast.error(message);
          else toast.success(`Deleted ${what}`);
        });
      }}
    >
      <Trash2 /> {pending ? "Deleting…" : "Delete"}
    </Button>
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
    <Checkbox name={name} value={value} defaultChecked={defaultChecked}>
      {label}
    </Checkbox>
  );
}

export function FirstError({ errors, prefix }: { errors: Errors; prefix: string }) {
  const first = Object.entries(errors).find(([k, v]) => k.startsWith(prefix) && v)?.[1];
  return first ? <p className="text-sm text-destructive">{first}</p> : null;
}

export { Field };
