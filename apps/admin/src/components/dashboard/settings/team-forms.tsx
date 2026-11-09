"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useUnsavedChanges } from "../unsaved-changes";
import { Trash2 } from "lucide-react";
import { ROLE_KEYS, ROLES, type Role } from "@leadgen/core/team/access";
import { changeRoleAction, removeMemberAction, type AddMemberState } from "@/app/app/[tenant]/team/access/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Radio } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";

// Team → Logins & access.

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
  const form = useRef<HTMLFormElement>(null);
  const markSaved = useUnsavedChanges(form);
  useEffect(() => {
    if (!state.errors) markSaved();
  }, [state, markSaved]);

  return (
    <div className="grid gap-4">
      <form ref={form} action={formAction} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" name="email" error={e.email}>
            <Input name="email" type="email" autoComplete="off" />
          </Field>
          <Field label="Name (optional)" name="name" error={e.name}>
            <Input name="name" autoComplete="off" />
          </Field>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Access level</legend>
          {ROLE_KEYS.map((k) => (
            <Radio
              key={k}
              name="role"
              value={k}
              checked={role === k}
              onChange={() => setRole(k)}
            >
              <span>
                {ROLES[k].label}
                <span className="block text-muted-foreground">{ROLES[k].detail}</span>
              </span>
            </Radio>
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
  const who = member.name ?? member.email;

  return (
    <li className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {member.name ?? member.email}
          {isYou && <Badge className="ml-2">You</Badge>}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {member.name && `${member.email} · `}
          {member.lastSeen ? `Last signed in ${member.lastSeen}` : "Hasn't signed in yet"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <>
            <Select
              aria-label={`Access level for ${who}`}
              defaultValue={member.role}
              disabled={pending}
              onChange={async (e) => {
                const next = e.target.value;
                const select = e.target;
                if (
                  isYou &&
                  next !== "owner" &&
                  !(await askToConfirm({
                    title: "Change your own access?",
                    description: "You'll lose the owner's controls, including this page.",
                    confirmLabel: "Change access",
                    destructive: true,
                  }))
                ) {
                  select.value = member.role;
                  return;
                }
                startTransition(async () => {
                  const { message } = await changeRoleAction(slug, member.userId, next);
                  if (message) {
                    toast.error(message);
                    select.value = member.role;
                  } else {
                    toast.success("Access level changed");
                  }
                });
              }}
              className="w-auto"
            >
              {Object.entries(ROLES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={async () => {
                const confirmed = await askToConfirm({
                  title: isYou ? "Remove your own access to this business?" : `Remove ${who}'s access?`,
                  description: isYou
                    ? "You'll be signed out of it."
                    : "They won't be able to open this business any more. Their own account isn't deleted.",
                  confirmLabel: "Remove access",
                  destructive: true,
                });
                if (!confirmed) return;
                startTransition(async () => {
                  const { message } = await removeMemberAction(slug, member.userId);
                  if (message) toast.error(message);
                  else toast.success("Access removed");
                });
              }}
            >
              <Trash2 /> Remove
            </Button>
          </>
        ) : (
          <Badge>{ROLES[member.role]?.label ?? member.role}</Badge>
        )}
      </div>
    </li>
  );
}
