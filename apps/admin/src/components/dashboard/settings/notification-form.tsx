"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import {
  CUSTOMER_MESSAGES,
  defaultTemplate,
  renderTemplate,
  SAMPLE_VALUES,
  TEMPLATE_FIELDS,
  type CustomerMessage,
  type NotificationSettings,
} from "@leadgen/core/settings/notifications";
import { customerFooter, renderEmail, templateMessage, type EmailBrand } from "@leadgen/core/email/compose";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, SaveForm, type Action } from "../form-kit";
import { SettingsSection, SettingsStack } from "./section";

// Settings → Notifications: what customers are sent and when, the sender, and
// alerts to the owner. Saved as one, with the Save bar kept in view.

// How the business's customer emails look (branding/email-brand.ts).
type EmailBusiness = EmailBrand;

// The fields inside each message's panel besides its subject and body, so a
// panel opens itself when any of them has a problem.
const MESSAGE_FIELDS: Partial<Record<CustomerMessage, string[]>> = {
  reminder: ["reminder_hours_before"],
  follow_up: ["follow_up_days_after"],
  review_request: ["review_request_days_after", "review_url"],
  quote_follow_up: ["quote_follow_up_days_after"],
};

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
        <SettingsStack>
          <SettingsSection id="sending" title="How messages are sent" description="Email for now. Text messages and WhatsApp are on the way.">
            <div className="grid gap-5">
              <Switch name="channel_email" defaultChecked={settings.channels.email} description="Off stops every email to customers below.">
                Email customers
              </Switch>
              <div className="flex flex-wrap gap-2">
                <Badge>Text message (SMS): coming soon</Badge>
                <Badge>WhatsApp: coming soon</Badge>
              </div>
              <div className="grid gap-4 border-t pt-5 @lg:grid-cols-2">
                <Field label="Sender name" name="sender_name" error={errors.sender_name} hint={`What customers see the email is from. Blank uses ${business.name}.`}>
                  <Input name="sender_name" defaultValue={settings.sender_name ?? ""} placeholder={business.name} maxLength={60} />
                </Field>
                <Field label="Replies go to" name="reply_to" error={errors.reply_to} hint="Blank sends replies to your contact email.">
                  <Input name="reply_to" type="email" inputMode="email" defaultValue={settings.reply_to ?? ""} placeholder="e.g. bookings@yourbusiness.co.uk" />
                </Field>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="messages"
            title="Messages to customers"
            description="Open one to change what it says and when it goes. The preview shows the real email with example details."
            bare
          >
            <div className="grid gap-3">
              <MessageEditor k="confirmation" value={m.confirmation} business={business} errors={errors} />
              <MessageEditor
                k="reminder"
                value={m.reminder}
                business={business}
                errors={errors}
                timing={
                  <Field label="Sent" name="reminder_hours_before" error={errors.reminder_hours_before} className="max-w-60">
                    <NumberInput name="reminder_hours_before" unit="hours before" min={1} max={168} defaultValue={m.reminder.hours_before} />
                  </Field>
                }
              />
              <MessageEditor
                k="follow_up"
                value={m.follow_up}
                business={business}
                errors={errors}
                timing={
                  <Field label="Sent" name="follow_up_days_after" error={errors.follow_up_days_after} className="max-w-60">
                    <NumberInput name="follow_up_days_after" unit="days after" min={1} max={60} defaultValue={m.follow_up.days_after} />
                  </Field>
                }
              />
              <MessageEditor
                k="review_request"
                value={m.review_request}
                business={business}
                errors={errors}
                timing={
                  <div className="grid gap-4 @lg:grid-cols-[14rem_minmax(0,1fr)]">
                    <Field label="Sent" name="review_request_days_after" error={errors.review_request_days_after}>
                      <NumberInput
                        name="review_request_days_after"
                        unit="days after"
                        min={0}
                        max={30}
                        defaultValue={m.review_request.days_after}
                      />
                    </Field>
                    <Field label="Your review link" name="review_url" error={errors.review_url} hint="Google, Facebook or wherever you collect reviews.">
                      <Input
                        name="review_url"
                        type="url"
                        inputMode="url"
                        defaultValue={m.review_request.review_url ?? googleReviewUrl ?? ""}
                        placeholder="e.g. g.page/r/…/review"
                      />
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
                  <Field label="Sent" name="quote_follow_up_days_after" error={errors.quote_follow_up_days_after} className="max-w-60">
                    <NumberInput
                      name="quote_follow_up_days_after"
                      unit="days after"
                      min={1}
                      max={30}
                      defaultValue={m.quote_follow_up.days_after}
                    />
                  </Field>
                }
              />
              <MessageEditor k="rebook_reminder" value={m.rebook_reminder} business={business} errors={errors} />
              <MessageEditor k="slot_opened" value={m.slot_opened} business={business} errors={errors} />
              <p className="px-1 text-sm text-muted-foreground">
                Aftercare, review requests, quote follow-ups and rebooking reminders ask customers back, so they only go to
                customers who ticked the box to hear from you, with an unsubscribe link.
              </p>
              <details className="rounded-lg border px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium">Fields you can use in messages</summary>
                <ul className="mt-3 grid gap-1.5 @lg:grid-cols-2">
                  {Object.entries(TEMPLATE_FIELDS).map(([k, label]) => (
                    <li key={k}>
                      <code className="rounded bg-muted px-1">{`{${k}}`}</code> <span className="text-muted-foreground">{label}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </SettingsSection>

          <SettingsSection
            id="alerts"
            title="Alerts to you"
            description="Booking requests you need to approve, disputes and refunds are always emailed."
          >
            <div className="grid gap-4">
              <Switch name="alerts_new_lead" defaultChecked={settings.alerts.new_lead} description="When someone leaves their details without booking.">
                New enquiry
              </Switch>
              <Switch name="alerts_new_booking" defaultChecked={settings.alerts.new_booking} description="Each time a customer books.">
                New booking
              </Switch>
              <Switch
                name="alerts_cancellation"
                defaultChecked={settings.alerts.cancellation}
                description="When a customer cancels or moves their booking."
              >
                Cancellations and changes
              </Switch>
              <Field label="Send alerts to" name="alerts_email" error={errors.alerts_email} hint="Blank sends them to your login email." className="border-t pt-4 @lg:max-w-md">
                <Input
                  name="alerts_email"
                  type="email"
                  inputMode="email"
                  defaultValue={settings.alerts.email ?? ""}
                  placeholder={ownerEmail ?? "Your login email"}
                />
              </Field>
            </div>
          </SettingsSection>
        </SettingsStack>
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
  const [enabled, setEnabled] = useState(value.enabled);
  const [subject, setSubject] = useState(value.subject);
  const [body, setBody] = useState(value.body);
  const invalid = [`${k}_subject`, `${k}_body`, ...(MESSAGE_FIELDS[k] ?? [])].some((f) => errors[f]);
  // Drawn only while it's open: a closed one has no height to measure.
  const [open, setOpen] = useState(invalid);
  const wording = defaultTemplate(k);
  const isDefault = subject === wording.subject && body === wording.body;

  return (
    // Open when there's an error inside, so it can be seen.
    <details
      className="group rounded-xl bg-card ring-1 ring-foreground/10"
      open={invalid ? true : undefined}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{CUSTOMER_MESSAGES[k].label}</span>
          <span className="block text-sm text-muted-foreground">{CUSTOMER_MESSAGES[k].when}</span>
        </span>
        {invalid && <Badge tone="danger">Check this</Badge>}
        <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</Badge>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-5 border-t px-4 py-5 sm:px-6">
        <Switch name={`${k}_enabled`} checked={enabled} onChange={(e) => setEnabled(e.target.checked)}>
          Send this message
        </Switch>
        {timing}
        <div className="grid gap-5 @4xl:grid-cols-2 @4xl:items-start">
          <div className="grid gap-4">
            <Field label="Subject" name={`${k}_subject`} error={errors[`${k}_subject`]}>
              <Input name={`${k}_subject`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
            </Field>
            <Field label="Message" name={`${k}_body`} error={errors[`${k}_body`]}>
              <Textarea name={`${k}_body`} rows={9} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />
            </Field>
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              disabled={isDefault}
              onClick={async () => {
                const confirmed = await askToConfirm({
                  title: "Go back to our wording?",
                  description: "Your subject and message for this email are replaced with ours. Nothing changes until you save.",
                  confirmLabel: "Use our wording",
                });
                if (!confirmed) return;
                setSubject(wording.subject);
                setBody(wording.body);
              }}
            >
              <RotateCcw /> Reset to our wording
            </Button>
          </div>
          {open && <EmailPreview k={k} subject={subject} body={body} business={business} />}
        </div>
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
  // Follow-ups, review requests and rebooking invites are marketing, so they
  // carry an opt-out; the rest carry the customer's booking details.
  const marketing = k === "follow_up" || k === "review_request" || k === "quote_follow_up" || k === "rebook_reminder";
  const facts = {
    customerName: `${sample.customer_name} Jones`,
    businessName: business.name,
    service: sample.service,
    date: sample.date,
    time: sample.time,
    address: sample.address,
    bookingLink: sample.booking_link,
  };
  const buttonUrl = k === "review_request" ? sample.review_link : marketing ? sample.booking_link : "https://book.example.co.uk/manage";
  const { html } = renderEmail({
    content: templateMessage(
      k,
      { subject: renderTemplate(subject, sample), body: renderTemplate(body, sample) },
      { facts, money: { pricePence: 8500, depositPaidPence: 2000 }, buttonUrl },
    ),
    audience: "customer",
    brand: business,
    footer: customerFooter(business, marketing ? "marketing" : "booking"),
    unsubscribeUrl: marketing ? "https://book.example.co.uk/unsubscribe" : undefined,
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
