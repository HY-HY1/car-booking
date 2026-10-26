"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CUSTOMER_MESSAGES,
  defaultTemplate,
  renderTemplate,
  SAMPLE_VALUES,
  TEMPLATE_FIELDS,
  type CustomerMessage,
  type NotificationSettings,
} from "@leadgen/core/settings/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Field, SaveForm, fieldClass, type Action } from "../form-kit";

// Settings → Notifications: what customers are sent and when, the sender, and
// alerts to the owner. Saved as one.

export function NotificationsForm({
  settings,
  businessName,
  ownerEmail,
  action,
  readOnly,
}: {
  settings: NotificationSettings;
  businessName: string;
  ownerEmail: string | null;
  action: Action;
  readOnly: boolean;
}) {
  const m = settings.messages;
  return (
    <SaveForm action={action} readOnly={readOnly} sticky savedText="Saved.">
      {(errors) => (
        <>
          <section className="grid gap-3">
            <h3 className="font-medium">How messages are sent</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Check name="channel_email" label="Email" defaultChecked={settings.channels.email} />
              <Check name="channel_sms" label="Text message (SMS)" defaultChecked={settings.channels.sms} />
              <span className="text-sm text-muted-foreground">WhatsApp: coming later</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sender name" name="sender_name" error={errors.sender_name}>
                <Input name="sender_name" defaultValue={settings.sender_name ?? ""} placeholder={businessName} maxLength={60} />
              </Field>
              <Field label="Replies go to" name="reply_to" error={errors.reply_to}>
                <Input name="reply_to" type="email" defaultValue={settings.reply_to ?? ""} placeholder="Your contact email" />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Customers see the sender name on emails from your address above.
            </p>
          </section>

          <section className="grid gap-3">
            <h3 className="font-medium">Messages to customers</h3>
            <MessageEditor
              k="confirmation"
              value={m.confirmation}
              businessName={businessName}
              errors={errors}
            />
            <MessageEditor
              k="reminder"
              value={m.reminder}
              businessName={businessName}
              errors={errors}
              timing={
                <Field label="Hours before the appointment" name="reminder_hours_before" error={errors.reminder_hours_before} className="max-w-56">
                  <Input name="reminder_hours_before" inputMode="numeric" defaultValue={m.reminder.hours_before} />
                </Field>
              }
            />
            <MessageEditor
              k="follow_up"
              value={m.follow_up}
              businessName={businessName}
              errors={errors}
              timing={
                <Field label="Days after the job" name="follow_up_days_after" error={errors.follow_up_days_after} className="max-w-56">
                  <Input name="follow_up_days_after" inputMode="numeric" defaultValue={m.follow_up.days_after} />
                </Field>
              }
            />
            <MessageEditor
              k="review_request"
              value={m.review_request}
              businessName={businessName}
              errors={errors}
              timing={
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Days after the job" name="review_request_days_after" error={errors.review_request_days_after}>
                    <Input name="review_request_days_after" inputMode="numeric" defaultValue={m.review_request.days_after} />
                  </Field>
                  <Field label="Your review link (Google, Facebook…)" name="review_url" error={errors.review_url}>
                    <Input name="review_url" defaultValue={m.review_request.review_url ?? ""} placeholder="https://g.page/r/…/review" />
                  </Field>
                </div>
              }
            />
            <p className="text-xs text-muted-foreground">
              Aftercare and review requests ask customers back, so they only go to customers who ticked the box to
              hear from you, with an unsubscribe link.
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Fields you can use in messages</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {Object.entries(TEMPLATE_FIELDS).map(([k, label]) => (
                  <li key={k}>
                    <code className="rounded bg-muted px-1">{`{${k}}`}</code> <span className="text-muted-foreground">{label}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="grid gap-3">
            <h3 className="font-medium">Alerts to you</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Check name="alerts_new_lead" label="New enquiry" defaultChecked={settings.alerts.new_lead} />
              <Check name="alerts_new_booking" label="New booking" defaultChecked={settings.alerts.new_booking} />
              <Check name="alerts_cancellation" label="Cancellation" defaultChecked={settings.alerts.cancellation} />
            </div>
            <p className="text-xs text-muted-foreground">
              An enquiry alert comes 30 minutes after someone leaves their details without booking. Booking requests
              you need to approve, disputes and refunds are always emailed.
            </p>
            <Field label="Send alerts to" name="alerts_email" error={errors.alerts_email} className="max-w-md">
              <Input name="alerts_email" type="email" defaultValue={settings.alerts.email ?? ""} placeholder={ownerEmail ?? "Your login email"} />
            </Field>
          </section>
        </>
      )}
    </SaveForm>
  );
}

function MessageEditor({
  k,
  value,
  businessName,
  errors,
  timing,
}: {
  k: CustomerMessage;
  value: { enabled: boolean; subject: string; body: string };
  businessName: string;
  errors: Record<string, string | undefined>;
  timing?: React.ReactNode;
}) {
  const [subject, setSubject] = useState(value.subject);
  const [body, setBody] = useState(value.body);
  const [preview, setPreview] = useState(false);
  const invalid = errors[`${k}_subject`] || errors[`${k}_body`];
  const sample = { ...SAMPLE_VALUES, business_name: businessName };

  return (
    // Open when there's an error inside, so it can be seen.
    <details className="group rounded-xl border bg-card" open={invalid ? true : undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{CUSTOMER_MESSAGES[k].label}</span>
          <span className="block text-sm text-muted-foreground">{CUSTOMER_MESSAGES[k].when}</span>
        </span>
        <span className="text-xs text-muted-foreground">{value.enabled ? "On" : "Off"}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t px-4 py-4">
        <Check name={`${k}_enabled`} label="Send this message" defaultChecked={value.enabled} />
        {timing}
        <Field label="Subject" name={`${k}_subject`} error={errors[`${k}_subject`]}>
          <Input name={`${k}_subject`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        </Field>
        <Field label="Message" name={`${k}_body`} error={errors[`${k}_body`]}>
          <textarea
            name={`${k}_body`}
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={3000}
            className={fieldClass}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setPreview((p) => !p)}>
            {preview ? "Hide preview" : "Preview"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              const d = defaultTemplate(k);
              setSubject(d.subject);
              setBody(d.body);
            }}
          >
            Reset to our wording
          </Button>
        </div>
        {preview && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{renderTemplate(subject, sample)}</p>
            <p className="mt-2 whitespace-pre-line">{renderTemplate(body, sample)}</p>
          </div>
        )}
      </div>
    </details>
  );
}
