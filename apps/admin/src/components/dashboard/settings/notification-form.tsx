"use client";

import { useEffect, useRef, useState } from "react";
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
import { customerFooter, renderEmail } from "@leadgen/core/email/compose";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Field, SaveForm, type Action } from "../form-kit";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// Settings → Notifications: what customers are sent and when, the sender, and
// alerts to the owner. Saved as one.

type EmailBusiness = { name: string; contactEmail: string | null; accentColor?: string };

export function NotificationsForm({
  settings,
  business,
  ownerEmail,
  googleReviewUrl,
  action,
  readOnly,
}: {
  settings: NotificationSettings;
  business: EmailBusiness;
  ownerEmail: string | null;
  // From a connected Google Business Profile: filled in when there's no link yet.
  googleReviewUrl?: string | null;
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
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                Text message (SMS) <Badge>Coming soon</Badge>
              </span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                WhatsApp <Badge>Coming soon</Badge>
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sender name" name="sender_name" error={errors.sender_name}>
                <Input name="sender_name" defaultValue={settings.sender_name ?? ""} placeholder={business.name} maxLength={60} />
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
              business={business}
              errors={errors}
            />
            <MessageEditor
              k="reminder"
              value={m.reminder}
              business={business}
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
              business={business}
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
              business={business}
              errors={errors}
              timing={
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Days after the job" name="review_request_days_after" error={errors.review_request_days_after}>
                    <Input name="review_request_days_after" inputMode="numeric" defaultValue={m.review_request.days_after} />
                  </Field>
                  <Field label="Your review link (Google, Facebook…)" name="review_url" error={errors.review_url}>
                    <Input name="review_url" defaultValue={m.review_request.review_url ?? googleReviewUrl ?? ""} placeholder="https://g.page/r/…/review" />
                  </Field>
                </div>
              }
            />
            <MessageEditor
              k="quote_follow_up"
              value={m.quote_follow_up}
              business={business}
              errors={errors}
              timing={
                <Field label="Days after the quote" name="quote_follow_up_days_after" error={errors.quote_follow_up_days_after} className="max-w-56">
                  <Input name="quote_follow_up_days_after" inputMode="numeric" defaultValue={m.quote_follow_up.days_after} />
                </Field>
              }
            />
            <MessageEditor k="rebook_reminder" value={m.rebook_reminder} business={business} errors={errors} />
            <MessageEditor k="slot_opened" value={m.slot_opened} business={business} errors={errors} />
            <p className="text-xs text-muted-foreground">
              Aftercare, review requests, quote follow-ups and rebooking reminders ask customers back, so they only go to
              customers who ticked the box to hear from you, with an unsubscribe link.
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
              <Check name="alerts_cancellation" label="Cancellations and changes" defaultChecked={settings.alerts.cancellation} />
            </div>
            <p className="text-xs text-muted-foreground">
              An enquiry alert comes after someone leaves their details without booking. Booking requests you need to
              approve, disputes and refunds are always emailed.
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
  business,
  errors,
  timing,
}: {
  k: CustomerMessage;
  value: { enabled: boolean; subject: string; body: string };
  business: EmailBusiness;
  errors: Record<string, string | undefined>;
  timing?: React.ReactNode;
}) {
  const [subject, setSubject] = useState(value.subject);
  const [body, setBody] = useState(value.body);
  const invalid = errors[`${k}_subject`] || errors[`${k}_body`];
  // Drawn only while it's open: a closed one has no height to measure.
  const [open, setOpen] = useState(Boolean(invalid));

  return (
    // Open when there's an error inside, so it can be seen.
    <details className="group rounded-xl border bg-card" open={invalid ? true : undefined} onToggle={(e) => setOpen(e.currentTarget.open)}>
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
          <Textarea
            name={`${k}_body`}
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={3000}
          />
        </Field>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="justify-self-start"
          onClick={() => {
            const d = defaultTemplate(k);
            setSubject(d.subject);
            setBody(d.body);
          }}
        >
          Reset to our wording
        </Button>
        {open && <EmailPreview k={k} subject={subject} body={body} business={business} />}
      </div>
    </details>
  );
}

// The real email layout, filled in with example details.
function EmailPreview({
  k,
  subject,
  body,
  business,
}: {
  k: CustomerMessage;
  subject: string;
  body: string;
  business: EmailBusiness;
}) {
  const sample = { ...SAMPLE_VALUES, business_name: business.name };
  // Aftercare and review requests are marketing, so they carry an opt-out;
  // the confirmation and reminder carry the customer's booking link.
  const marketing = k === "follow_up" || k === "review_request";
  const { html } = renderEmail({
    heading: business.name,
    body: renderTemplate(body, sample),
    footer: customerFooter(business, marketing ? "marketing" : "booking"),
    accentColor: business.accentColor,
    unsubscribeUrl: marketing ? "https://book.example.co.uk/unsubscribe" : undefined,
    button: marketing ? undefined : { label: "Manage your booking", url: "https://book.example.co.uk/manage" },
  });

  return (
    <figure className="grid gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">Preview, with example details</figcaption>
      <div className="overflow-hidden rounded-lg border">
        <p className="border-b bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Subject: </span>
          <span className="font-medium">{renderTemplate(subject, sample)}</span>
        </p>
        <EmailFrame html={html} />
      </div>
    </figure>
  );
}

// In a frame so the email's own styles stay out of the dashboard. No scripts
// can run in it, and it's written to directly so it doesn't flash on each key.
function EmailFrame({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const el = frame.current;
    const doc = el?.contentDocument;
    if (!el || !doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    el.style.height = "0";
    el.style.height = `${doc.documentElement.scrollHeight}px`;
  }, [html]);
  return <iframe ref={frame} title="Email preview" sandbox="allow-same-origin" className="pointer-events-none block w-full bg-white" />;
}
