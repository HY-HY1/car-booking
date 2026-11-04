"use client";

import { useActionState, useEffect, useRef } from "react";
import { CONTACT_TOPICS, type ContactTopic } from "@leadgen/core/marketing/contact-topics";
import { sendContact, type ContactState } from "@/app/(marketing)/(site)/contact/actions";

const label = "lp-data block text-[11px] tracking-[0.14em] text-(--graphite) uppercase";
const input =
  "mt-2 block w-full border-0 border-b-2 border-(--ink) bg-transparent px-0 py-2 text-lg outline-none placeholder:text-(--graphite)/60 focus:border-(--hi) aria-invalid:border-[#d9430b]";

// The contact form, printed-sheet style, on paper. Sends through a server
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
      <div role="status" className="lp-printed-hi border-2 border-(--paper) bg-(--paper) p-8 text-(--ink) sm:p-10">
        <p className={label}>Message sent</p>
        <p className="lp-display mt-4 text-5xl">Thanks, {state.sent.name}.</p>
        <p className="mt-4 text-lg text-(--graphite)">
          We&apos;ve got your message and we&apos;ll reply to <span className="text-(--ink)">{state.sent.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="lp-printed-hi grid gap-7 border-2 border-(--paper) bg-(--paper) p-6 text-(--ink) sm:p-10">
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
              <span className="flex w-full items-center border-2 border-(--ink) px-3 py-2.5 text-sm font-semibold peer-checked:bg-(--ink) peer-checked:text-(--paper) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--hi)">
                {text}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={e.topic} />
      </fieldset>

      <div className="grid gap-7 sm:grid-cols-2">
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
        <p role="alert" className="border-l-4 border-[#d9430b] pl-4 font-semibold text-[#b8360a]">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-sm text-(--graphite)">
          We only use these details to reply to you. See our{" "}
          <a href={privacyHref} className="text-(--ink) underline decoration-(--hi) decoration-2 underline-offset-4">
            privacy policy
          </a>
          .
        </p>
        <button type="submit" disabled={pending} className="shrink-0 bg-(--hi) px-6 py-3.5 font-semibold text-(--ink) hover:bg-[#ff7140] disabled:opacity-60">
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
    <p id={id} className="mt-2 text-sm font-semibold text-[#b8360a]">
      {message}
    </p>
  );
}
