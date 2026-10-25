"use client";

import { useActionState } from "react";
import { addMemberAction, type AddMemberState } from "@/app/admin/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyText } from "./copy-text";
import { selectClass } from "./field";

export function MemberForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<AddMemberState, FormData>(addMemberAction.bind(null, slug), {});

  return (
    <div className="grid gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <label htmlFor="member-email" className="text-sm font-medium">
            Add a person
          </label>
          <Input id="member-email" name="email" type="email" placeholder="name@example.com" required />
        </div>
        <select name="role" defaultValue="owner" aria-label="Role" className={`${selectClass} w-28`}>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="staff">Office</option>
          <option value="technician">Technician</option>
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.added && (
        <div className="grid gap-2 rounded-lg border p-3 text-sm">
          <p>
            {state.added.alreadyMember ? `${state.added.email} was already on this business.` : `${state.added.email} added.`}
          </p>
          {state.added.tempPassword ? (
            <>
              <p className="text-xs text-muted-foreground">
                New login created. Temporary password, shown only now:
              </p>
              <CopyText value={state.added.tempPassword} label="temporary password" />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">They already had an account, so their password is unchanged.</p>
          )}
        </div>
      )}
    </div>
  );
}
