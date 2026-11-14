"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import type { SenderRecord, SenderStatus } from "@leadgen/core/email/senders";
import { checkSenderAction, removeSenderAction } from "@/app/app/[tenant]/settings/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Field, SaveForm, type Action } from "../form-kit";
import { DnsRecords } from "./general-forms";

// Settings → Notifications: the address the business's emails come from, on
// its own domain, and the DNS records that prove it can send from it. The page
// keys this on the address, so a check of one address never shows on another.

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
  const verified = current === "verified";

  return (
    <div className="grid gap-5">
      {sender && (
        <div className="grid gap-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid min-w-0 gap-1.5">
              <p className="truncate font-mono text-sm font-medium">{sender.address}</p>
              <div>
                <Badge tone={verified ? "success" : "warning"}>
                  {verified ? "Verified · emails go out from this address" : "Waiting for DNS · nothing is sent from it yet"}
                </Badge>
              </div>
            </div>
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                {!verified && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await checkSenderAction(slug);
                        if (r.status) setStatus(r.status);
                        if (r.status === "verified") toast.success(`Verified. Your emails now come from ${sender.address}`);
                        setMessage(r.message ?? (r.status === "verified" ? undefined : "Not verified yet. DNS changes can take up to an hour to show."));
                      })
                    }
                  >
                    <RefreshCw /> {pending ? "Checking…" : "Check DNS"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={async () => {
                    const confirmed = await askToConfirm({
                      title: `Stop sending from ${sender.address}?`,
                      description: "Customers won't get any emails until you set up an address again.",
                      confirmLabel: "Stop sending",
                      destructive: true,
                    });
                    if (!confirmed) return;
                    startTransition(async () => {
                      const { message } = await removeSenderAction(slug);
                      if (message) toast.error(message);
                      else toast.success("Sending address removed");
                    });
                  }}
                >
                  <Trash2 /> Remove
                </Button>
              </div>
            )}
          </div>

          {!verified && sender.records.length > 0 && (
            <DnsRecords
              intro={`Add these records where you manage ${sender.domain}'s DNS (your domain registrar, or Cloudflare), then press Check DNS. They sit alongside your existing email, so mail to your inbox keeps working.`}
              records={sender.records}
            />
          )}

          {!verified && (message ?? sender.checkError) && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {message ?? sender.checkError}
            </p>
          )}
        </div>
      )}

      {!readOnly && (
        <SaveForm action={action} submitLabel={sender ? "Change address" : "Set up address"} resetOnSave savedText="Saved. Now add the DNS records shown.">
          {(errors) => (
            <Field
              label={sender ? "Use a different address" : "Your email address"}
              name="address"
              error={errors.address}
              hint={sender ? "Replaces the one above once you save." : undefined}
              className="max-w-md"
            >
              <Input
                name="address"
                type="email"
                inputMode="email"
                placeholder="e.g. hello@yourbusiness.co.uk"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
          )}
        </SaveForm>
      )}
    </div>
  );
}
