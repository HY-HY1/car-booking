"use client";

import { useState, useTransition } from "react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { WEBHOOK_EVENT_KEYS, WEBHOOK_EVENTS } from "@leadgen/core/webhooks/events";
import { formatDateTime } from "@leadgen/core/dates";
import { Field, SaveForm, type Action, type Errors } from "../form-kit";

// Settings → Integrations → Developer: webhooks to the business's own system.

export type WebhookRow = {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  consecutiveFailures: number;
  lastDeliveryAt: string | null;
  lastStatus: number | null;
  recent: {
    id: string;
    eventType: string;
    status: string;
    attempts: number;
    responseStatus: number | null;
    responseBody: string | null;
    createdAt: string;
    nextAttemptAt: string;
  }[];
};

type Props = {
  endpoints: WebhookRow[];
  max: number;
  createAction: (formData: FormData) => Promise<SaveState & { secret?: string }>;
  updateAction: (id: string, formData: FormData) => Promise<SaveState>;
  deleteAction: (id: string) => Promise<{ error?: string }>;
  rollAction: (id: string) => Promise<{ error?: string; secret?: string }>;
  testAction: (id: string) => Promise<{ error?: string; ok?: boolean; detail?: string }>;
  resendAction: (deliveryId: string) => Promise<{ error?: string }>;
};

export function Webhooks(props: Props) {
  const [secret, setSecret] = useState<{ id: string | null; value: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const create: Action = async (formData) => {
    const result = await props.createAction(formData);
    if (result.secret) {
      setSecret({ id: null, value: result.secret });
      setAdding(false);
    }
    return result;
  };

  return (
    <div className="grid gap-4">
      {secret && (
        <div role="status" className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium">Your signing secret. Copy it now: it won&apos;t be shown again.</p>
          <CopyText value={secret.value} label="signing secret" />
          <p className="text-muted-foreground">
            Use it to check each request really came from us (the Webhook-Signature header). Lost it? Make a new one.
          </p>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => setSecret(null)}>
              I&apos;ve saved it
            </Button>
          </div>
        </div>
      )}

      {props.endpoints.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No webhooks yet.</p>
      )}

      <ul className="grid gap-3">
        {props.endpoints.map((e) => (
          <Endpoint key={e.id} endpoint={e} {...props} onSecret={(value) => setSecret({ id: e.id, value })} />
        ))}
      </ul>

      {adding ? (
        <div className="rounded-lg border p-3">
          <SaveForm action={create} submitLabel="Add webhook" savedText="Added." extra={<Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>}>
            {(errors) => <EndpointFields errors={errors} />}
          </SaveForm>
        </div>
      ) : (
        props.endpoints.length < props.max && (
          <div>
            <Button type="button" variant="outline" onClick={() => setAdding(true)}>
              Add a webhook
            </Button>
          </div>
        )
      )}
    </div>
  );
}

function EndpointFields({ errors, endpoint }: { errors: Errors; endpoint?: WebhookRow }) {
  return (
    <div className="grid gap-4">
      <Field label="Send to" name="url" error={errors.url} hint="An https address on your server, Zapier, Make or similar.">
        <Input name="url" type="url" required defaultValue={endpoint?.url} placeholder="https://example.com/webhooks/bookings" />
      </Field>
      <Field label="Name (optional)" name="description" error={errors.description}>
        <Input name="description" defaultValue={endpoint?.description ?? ""} placeholder="Our CRM" maxLength={200} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Send these events</legend>
        {WEBHOOK_EVENT_KEYS.map((key) => (
          <Checkbox key={key} name="events" value={key} defaultChecked={endpoint ? endpoint.events.includes(key) : key !== "booking.updated"}>
            <code className="text-xs">{key}</code>
            <span className="block text-muted-foreground">{WEBHOOK_EVENTS[key]}</span>
          </Checkbox>
        ))}
        {errors.events && <p className="text-sm text-destructive">{errors.events}</p>}
      </fieldset>
      {endpoint && (
        <Checkbox name="active" defaultChecked={endpoint.active}>
          Switched on
        </Checkbox>
      )}
    </div>
  );
}

const STATUS_TONE = { delivered: "success", pending: "warning", failed: "danger" } as const;
const STATUS_LABEL: Record<string, string> = { delivered: "Delivered", pending: "Retrying", failed: "Failed" };

function Endpoint({
  endpoint: e,
  updateAction,
  deleteAction,
  rollAction,
  testAction,
  resendAction,
  onSecret,
}: Props & { endpoint: WebhookRow; onSecret: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const paused = !e.active && e.consecutiveFailures >= 50;

  const run = (fn: () => Promise<void>) => startTransition(fn);

  return (
    <li className="grid gap-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0">
          {e.description && <span className="block font-medium">{e.description}</span>}
          <code className="block break-all text-xs">{e.url}</code>
          <span className="block text-muted-foreground">{e.events.join(", ")}</span>
        </span>
        <Badge tone={!e.active ? "neutral" : e.consecutiveFailures > 0 ? "warning" : "success"}>
          {!e.active ? (paused ? "Paused" : "Off") : e.consecutiveFailures > 0 ? "Failing" : "On"}
        </Badge>
      </div>

      {paused && (
        <p className="text-destructive">
          Paused after {e.consecutiveFailures} failures in a row. Fix your server, then switch it back on.
        </p>
      )}
      {e.active && e.consecutiveFailures > 0 && (
        <p className="text-destructive">
          The last {e.consecutiveFailures === 1 ? "try" : `${e.consecutiveFailures} tries`} didn&apos;t get through
          {e.lastStatus ? ` (your server answered ${e.lastStatus})` : ""}. We keep retrying for a day.
        </p>
      )}

      {editing ? (
        <SaveForm
          action={(fd) => updateAction(e.id, fd)}
          savedText="Saved."
          onSaved={() => setEditing(false)}
          extra={<Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
        >
          {(errors) => <EndpointFields errors={errors} endpoint={e} />}
        </SaveForm>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !e.active}
            onClick={() =>
              run(async () => {
                const r = await testAction(e.id);
                if (r.error) toast.error(r.error);
                else if (r.ok) toast.success(`Test delivered. ${r.detail ?? ""}`);
                else toast.error(`Test didn't get through. ${r.detail ?? ""}`);
              })
            }
          >
            Send a test
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={async () => {
              const ok = await askToConfirm({
                title: "Make a new signing secret?",
                description: "The old one stops working straight away, so update your server as soon as you've copied the new one.",
                confirmLabel: "Make new secret",
              });
              if (!ok) return;
              run(async () => {
                const r = await rollAction(e.id);
                if (r.error) toast.error(r.error);
                else if (r.secret) onSecret(r.secret);
              });
            }}
          >
            New secret
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={async () => {
              const ok = await askToConfirm({
                title: "Delete this webhook?",
                description: "Nothing more is sent to it, and its delivery history goes too.",
                confirmLabel: "Delete",
                destructive: true,
              });
              if (!ok) return;
              run(async () => {
                const r = await deleteAction(e.id);
                if (r.error) toast.error(r.error);
              });
            }}
          >
            Delete
          </Button>
        </div>
      )}

      {e.recent.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">Recent deliveries</summary>
          <ul className="mt-2 grid gap-1.5">
            {e.recent.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-1.5">
                <span className="min-w-0">
                  <code className="text-xs">{d.eventType}</code>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatDateTime(d.createdAt)}
                    {d.responseStatus ? ` · ${d.responseStatus}` : ""}
                    {d.status !== "delivered" && d.responseBody ? ` · ${d.responseBody.slice(0, 120)}` : ""}
                    {d.status === "pending" ? ` · next try ${formatDateTime(d.nextAttemptAt)}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[d.status as keyof typeof STATUS_TONE] ?? "neutral"}>{STATUS_LABEL[d.status] ?? d.status}</Badge>
                  {d.status !== "delivered" && e.active && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const r = await resendAction(d.id);
                          if (r.error) toast.error(r.error);
                          else toast.success("Sent again");
                        })
                      }
                    >
                      Send again
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
