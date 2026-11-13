"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import type { ApiKeyRow } from "@leadgen/core/api/keys";
import { API_SCOPES, DEFAULT_SCOPES, SCOPE_KEYS } from "@leadgen/core/api/scopes";
import { formatDate } from "@leadgen/core/dates";
import type { CreateKeyState } from "@/app/app/[tenant]/settings/api/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";

// Settings → Integrations: make a key (shown once) with what it may do, see
// which keys exist and when they were last used, and revoke them.

export function ApiKeys({
  keys,
  createAction,
  revokeAction,
}: {
  keys: ApiKeyRow[];
  createAction: (formData: FormData) => Promise<CreateKeyState>;
  revokeAction: (id: string) => Promise<{ error?: string }>;
}) {
  const [created, setCreated] = useState<CreateKeyState>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6">
      <form
        className="grid max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const formData = new FormData(form);
          startTransition(async () => {
            const result = await createAction(formData);
            setCreated(result);
            if (result.key) form.reset();
          });
        }}
      >
        <Label htmlFor="api-key-name">New key</Label>
        <Input id="api-key-name" name="name" maxLength={60} placeholder="Main website" required />
        <fieldset className="mt-2 grid gap-2">
          <legend className="mb-1 text-sm font-medium">What it can do</legend>
          {SCOPE_KEYS.map((scope) => (
            <Checkbox key={scope} name="scopes" value={scope} defaultChecked={DEFAULT_SCOPES.includes(scope)}>
              <span className="font-medium">{API_SCOPES[scope].label}</span>
              <span className="block text-muted-foreground">{API_SCOPES[scope].detail}</span>
            </Checkbox>
          ))}
          <p className="text-xs text-muted-foreground">
            Only tick what the site or tool needs. Anything with customer details should stay on a server you trust.
          </p>
        </fieldset>
        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Creating…" : "Create key"}
          </Button>
        </div>
        {created.error && <p className="text-sm text-destructive">{created.error}</p>}
      </form>

      {created.key && (
        <div role="status" className="grid gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-medium">Copy your new key now</p>
          <p>It won&apos;t be shown again. Keep it on your website&apos;s server or in its build settings, never in page code visitors can see.</p>
          <CopyText value={created.key} label="API key" />
        </div>
      )}

      {keys.length === 0 ? (
        <EmptyState compact>No keys yet.</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-3">
                <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block font-medium">{k.name}</span>
                  <span className="block text-muted-foreground">
                    <code>{k.prefix}…</code> · made {formatDate(k.created_at)} ·{" "}
                    {k.last_used_at ? `last used ${formatDate(k.last_used_at)}` : "never used"}
                  </span>
                  <span className="block text-muted-foreground">
                    Can: {k.scopes.map((s) => API_SCOPES[s].label.toLowerCase()).join(", ")}
                  </span>
                </span>
              </span>
              {k.revoked_at ? (
                <span className="text-muted-foreground">Revoked {formatDate(k.revoked_at)}</span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={async () => {
                    const confirmed = await askToConfirm({
                      title: `Revoke "${k.name}"?`,
                      description: "Anything using it will stop working straight away.",
                      confirmLabel: "Revoke key",
                      destructive: true,
                    });
                    if (!confirmed) return;
                    startTransition(async () => {
                      const { error } = await revokeAction(k.id);
                      if (error) toast.error(error);
                      else toast.success("Key revoked");
                    });
                  }}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
