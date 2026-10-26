"use client";

import { useState, useTransition } from "react";
import { Check, RefreshCw, Trash2 } from "lucide-react";
import type { SenderRecord, SenderStatus } from "@leadgen/core/email/senders";
import { checkSenderAction, removeSenderAction } from "@/app/app/[tenant]/settings/notifications/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Notifications: the address the business's emails come from, on
// its own domain, and the DNS records that prove it can send from it.

export type SenderView = {
  address: string;
  domain: string;
  status: SenderStatus;
  checkError: string | null;
  records: SenderRecord[];
};

export function SenderCard({
  slug,
  sender,
  action,
  readOnly,
}: {
  slug: string;
  sender: SenderView | null;
  action: Action;
  readOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<SenderStatus | null>(null);
  const [message, setMessage] = useState<string>();
  const current = status ?? sender?.status;

  return (
    <div className="grid gap-4">
      {sender && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm">{sender.address}</p>
              <p className="text-xs text-muted-foreground">
                {current === "verified" ? "Verified · emails go out from this address" : "Waiting for DNS · nothing is sent from it yet"}
              </p>
            </div>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                {current !== "verified" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await checkSenderAction(slug);
                        if (r.status) setStatus(r.status);
                        setMessage(r.message ?? (r.status === "verified" ? undefined : "Not verified yet. DNS changes can take up to an hour to show."));
                      })
                    }
                  >
                    <RefreshCw /> {pending ? "Checking…" : "Check DNS"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Stop sending from ${sender.address}? Customers won't get emails until you set up an address again.`)) {
                      startTransition(async () => setMessage((await removeSenderAction(slug)).message));
                    }
                  }}
                >
                  <Trash2 /> Remove
                </Button>
              </div>
            )}
          </div>

          {current !== "verified" && sender.records.length > 0 && (
            <div className="grid gap-2 text-sm">
              <p className="text-muted-foreground">
                Add these records where you manage {sender.domain}&apos;s DNS (your domain registrar, or Cloudflare), then
                press Check DNS. They sit alongside your existing email, so mail to your inbox keeps working.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Type</th>
                      <th className="py-1 pr-3 font-medium">Name / host</th>
                      <th className="py-1 pr-3 font-medium">Value</th>
                      <th className="py-1 font-medium">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sender.records.map((r) => (
                      <tr key={`${r.type}-${r.fullName}`} className="border-t align-top">
                        <td className="py-2 pr-3 font-mono">{r.type}</td>
                        <td className="py-2 pr-3">
                          <CopyText value={r.host} label={`${r.type} name`} />
                          <span className="mt-1 block text-muted-foreground">({r.fullName})</span>
                        </td>
                        <td className="max-w-80 py-2 pr-3">
                          <CopyText value={r.value} label={`${r.type} value`} />
                        </td>
                        <td className="py-2 font-mono">{r.priority ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {status === "verified" && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
              <Check className="size-4" /> Verified. Your emails now come from {sender.address}.
            </p>
          )}
          {current !== "verified" && sender.checkError && !message && (
            <p className="text-sm text-amber-800 dark:text-amber-300">{sender.checkError}</p>
          )}
          {message && (
            <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
              {message}
            </p>
          )}
        </div>
      )}

      {!readOnly && (
        <SaveForm action={action} submitLabel={sender ? "Change address" : "Set up address"} resetOnSave savedText="Saved.">
          {(errors) => (
            <Field label={sender ? "Use a different address" : "Your email address"} name="address" error={errors.address} className="max-w-md">
              <Input name="address" type="email" placeholder="hello@yourbusiness.co.uk" autoComplete="off" />
            </Field>
          )}
        </SaveForm>
      )}
    </div>
  );
}
