"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ROLE_KEYS, ROLES, type Role } from "@leadgen/core/team/access";
import { changeRoleAction, removeMemberAction, type AddMemberState } from "@/app/app/[tenant]/settings/team/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fieldClass } from "../form-kit";

// Settings → Team & access.

export function AddMemberForm({
  action,
  loginUrl,
}: {
  action: (state: AddMemberState, formData: FormData) => Promise<AddMemberState>;
  loginUrl: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [role, setRole] = useState<Role>("staff");
  const e = state.errors ?? {};

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="member-email">Email</Label>
            <Input id="member-email" name="email" type="email" autoComplete="off" aria-invalid={e.email ? true : undefined} />
            {e.email && <p className="text-sm text-destructive">{e.email}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="member-name">Name (optional)</Label>
            <Input id="member-name" name="name" autoComplete="off" />
            {e.name && <p className="text-sm text-destructive">{e.name}</p>}
          </div>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Access level</legend>
          {ROLE_KEYS.map((k) => (
            <label key={k} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="role"
                value={k}
                checked={role === k}
                onChange={() => setRole(k)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                {ROLES[k].label}
                <span className="block text-muted-foreground">{ROLES[k].detail}</span>
              </span>
            </label>
          ))}
          {e.role && <p className="text-sm text-destructive">{e.role}</p>}
        </fieldset>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Give access"}
          </Button>
          {state.message && <p className="text-sm text-destructive">{state.message}</p>}
        </div>
      </form>

      {state.added && (
        <div role="status" className="grid gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          {state.added.tempPassword ? (
            <>
              <p>
                {state.added.email} can now sign in at {loginUrl} with this temporary password. It&apos;s shown once:
                send it to them privately, and ask them to change it under Settings → Account.
              </p>
              <CopyText value={state.added.tempPassword} label="temporary password" />
            </>
          ) : (
            <p>
              {state.added.email} already has an account, so they sign in with their own password at {loginUrl}. They&apos;ll
              see this business when they do.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function MemberRow({
  slug,
  member,
  isYou,
  canManage,
}: {
  slug: string;
  member: { userId: string; email: string; name: string | null; role: Role; lastSeen: string | null };
  isYou: boolean;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const who = member.name ?? member.email;

  return (
    <li className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {member.name ?? member.email}
          {isYou && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">You</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {member.name && `${member.email} · `}
          {member.lastSeen ? `Last signed in ${member.lastSeen}` : "Hasn't signed in yet"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <>
            <select
              aria-label={`Access level for ${who}`}
              defaultValue={member.role}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.value;
                const select = e.target;
                if (isYou && next !== "owner" && !confirm("Change your own access? You'll lose the owner's controls, including this page.")) {
                  select.value = member.role;
                  return;
                }
                startTransition(async () => {
                  const result = await changeRoleAction(slug, member.userId, next);
                  setMessage(result.message);
                  if (result.message) select.value = member.role;
                });
              }}
              className={cn(fieldClass, "h-8 w-auto")}
            >
              {Object.entries(ROLES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => {
                const text = isYou
                  ? "Remove your own access to this business? You'll be signed out of it."
                  : `Remove ${who}'s access? They won't be able to open this business any more. Their own account isn't deleted.`;
                if (!confirm(text)) return;
                startTransition(async () => setMessage((await removeMemberAction(slug, member.userId)).message));
              }}
            >
              <Trash2 /> Remove
            </Button>
          </>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{ROLES[member.role]?.label ?? member.role}</span>
        )}
      </div>
      {message && <p className="text-sm text-destructive sm:col-span-2">{message}</p>}
    </li>
  );
}
