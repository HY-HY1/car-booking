"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import type { ApiKeyRow } from "@leadgen/core/api/keys";
import { formatDate } from "@leadgen/core/customer-fields";
import type { CreateKeyState } from "@/app/app/[tenant]/settings/api/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Settings → API: make a key (shown once), see which keys exist and when they
// were last used, and revoke them.

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
  const [revokeError, setRevokeError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6">
      <form
        className="grid max-w-md gap-2"
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
        <div className="flex gap-2">
          <Input id="api-key-name" name="name" maxLength={60} placeholder="Main website" required />
          <Button type="submit" disabled={pending}>
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
        <p className="text-sm text-muted-foreground">No keys yet.</p>
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
                  onClick={() => {
                    if (!confirm(`Revoke "${k.name}"? Anything using it will stop getting your product data.`)) return;
                    startTransition(async () => setRevokeError((await revokeAction(k.id)).error));
                  }}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {revokeError && <p className="text-sm text-destructive">{revokeError}</p>}
    </div>
  );
}
