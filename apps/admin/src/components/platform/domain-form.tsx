"use client";

import { useActionState } from "react";
import { addDomainAction, type AddDomainState } from "@/app/admin/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DomainForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<AddDomainState, FormData>(addDomainAction.bind(null, slug), {});

  return (
    <div className="grid gap-2">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <label htmlFor="new-hostname" className="text-sm font-medium">
            Add another address
          </label>
          <Input id="new-hostname" name="hostname" placeholder="book.theirsite.co.uk" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.added && <p className="text-sm">Added {state.added}. Mark it verified once its DNS is set up.</p>}
    </div>
  );
}
