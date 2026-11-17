"use client";

import { useActionState, useEffect, useRef } from "react";
import { CONTACT_TOPICS, type ContactTopic } from "@leadgen/core/marketing/contact-topics";
import { sendContact, type ContactState } from "@/app/(marketing)/(site)/contact/actions";

const label = "block text-sm font-medium";
const input =
  "mt-2 block w-full rounded-lg border border-(--line) bg-(--bg) px-3.5 py-2.5 outline-none placeholder:text-(--muted)/60 focus:border-(--accent) aria-invalid:border-red-400";

// The contact form, on the dark site (site.css). Sends through a server
// action; the honeypot and the start time keep most bots out.
export function ContactForm({ topic, privacyHref }: { topic: ContactTopic; privacyHref: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, {});
  // When the form appeared, for the too-fast-to-be-human check. Set after
  // load, so the server render stays the same every time.
  const startedAt = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (startedAt.current && !startedAt.current.value) startedAt.current.value = String(Date.now());
  }, []);
  const v = state.values ?? {};
  const e = state.errors ?? {};

  if (state.sent) {
    return (
      <div role="status" className="rounded-xl border border-(--line) bg-(--soft) p-8 sm:p-10">
        <p className="text-sm font-medium text-(--accent)">Message sent</p>
        <p className="mt-3 text-4xl font-semibold tracking-tighter">Thanks, {state.sent.name}.</p>
        <p className="mt-4 text-lg text-(--muted)">
          We&apos;ve got your message and we&apos;ll reply to <span className="text-(--fg)">{state.sent.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-6 rounded-xl border border-(--line) bg-(--soft) p-6 sm:p-8">
      {/* Bots fill this in; people never see it. */}
      <div aria-hidden className="absolute left-[-9999px]">
        <label htmlFor="cf-website">Website</label>
        <input id="cf-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <input ref={startedAt} type="hidden" name="startedAt" defaultValue="" />

      <fieldset>
        <legend className={label}>What&apos;s it about?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(Object.entries(CONTACT_TOPICS) as [ContactTopic, string][]).map(([key, text]) => (
            <label key={key} className="relative flex cursor-pointer">
              <input type="radio" name="topic" value={key} defaultChecked={(v.topic || topic) === key} className="peer sr-only" />
              <span className="flex w-full items-center rounded-lg border border-(--line) bg-(--bg) px-3 py-2.5 text-sm font-medium text-(--muted) peer-checked:border-(--accent) peer-checked:bg-(--accent)/10 peer-checked:text-(--fg) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--accent)">
                {text}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={e.topic} />
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="cf-name" name="name" label="Your name" error={e.name} defaultValue={v.name} autoComplete="name" required />
        <Field id="cf-email" name="email" label="Email" type="email" error={e.email} defaultValue={v.email} autoComplete="email" required />
        <Field id="cf-business" name="business" label="Business name (optional)" error={e.business} defaultValue={v.business} autoComplete="organization" />
        <Field id="cf-phone" name="phone" label="Phone (optional)" type="tel" error={e.phone} defaultValue={v.phone} autoComplete="tel" />
      </div>

      <div>
        <label htmlFor="cf-message" className={label}>
          Message
        </label>
        <textarea
          id="cf-message"
          name="message"
          rows={5}
          required
          defaultValue={v.message}
          aria-invalid={e.message ? true : undefined}
          aria-describedby={e.message ? "cf-message-error" : undefined}
          placeholder="How many vans you run, what you use now, what you'd like to see…"
          className={`${input} resize-y`}
        />
        <FieldError id="cf-message-error" message={e.message} />
      </div>

      {state.error && (
        <p role="alert" className="border-l-4 border-red-400 pl-4 font-medium text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-sm text-(--muted)">
          We only use these details to reply to you. See our{" "}
          <a href={privacyHref} className="text-(--fg) underline underline-offset-4 hover:text-(--accent)">
            privacy policy
          </a>
          .
        </p>
        <button type="submit" disabled={pending} className="site-cta shrink-0 cursor-pointer rounded-full px-6 py-3 font-semibold disabled:opacity-60">
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

function Field({ id, label: text, error, ...props }: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={input}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-sm font-medium text-red-400">
      {message}
    </p>
  );
}
