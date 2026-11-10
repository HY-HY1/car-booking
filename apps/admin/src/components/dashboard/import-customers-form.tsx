"use client";

import { useActionState } from "react";
import type { ImportState } from "@/app/app/[tenant]/customers/import/actions";
import { Button } from "@/components/ui/button";

export function ImportCustomersForm({ action }: { action: (state: ImportState, formData: FormData) => Promise<ImportState> }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(action, {});

  return (
    <form action={formAction} className="grid gap-3">
      <input name="file" type="file" accept=".csv,text/csv" required aria-label="CSV file" className="text-sm" />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-destructive">
          {state.error}
        </p>
      )}
      {state.added !== undefined && (
        <div role="status" className="grid gap-1">
          <p className="font-medium">
            {state.added} added, {state.alreadyHad} already on file.
          </p>
          {state.skipped && state.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer text-muted-foreground">{state.skipped.length} lines skipped</summary>
              <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                {state.skipped.slice(0, 200).map((s) => (
                  <li key={s.line}>
                    Line {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
