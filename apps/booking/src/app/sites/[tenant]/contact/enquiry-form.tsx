"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { MAX_ENQUIRY_MESSAGE } from "@leadgen/core/enquiry/rules";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { useHumanCheck } from "@/lib/use-human-check";
import { sendEnquiryAction } from "./actions";

// The enquiry form: who they are, what it's about and what they need. On
// success it's replaced by a thank-you that says where the reply will go.

const ELSE = "Something else";

export function EnquiryForm({ businessName, services, privacyUrl }: { businessName: string; services: string[]; privacyUrl: string }) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null);
  const { ref: humanCheckRef, getToken } = useHumanCheck();

  if (sent) {
    return (
      <div role="status" className="grid justify-items-center gap-3 py-8 text-center">
        <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
        <h2 className="text-2xl font-semibold tracking-tight">Thanks, {sent.name.split(" ")[0]}</h2>
        <p className="max-w-sm text-pretty text-neutral-600">
          Your message is with {businessName}. They&apos;ll reply to <span className="font-medium text-neutral-900">{sent.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        setMessage(null);
        start(async () => {
          const result = await sendEnquiryAction(data, await getToken());
          if (result.ok) {
            setSent({ name: data.name.trim(), email: data.email.trim().toLowerCase() });
            return;
          }
          setErrors(result.errors ?? {});
          setMessage(result.message ?? (result.errors ? "Check the highlighted boxes." : null));
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name}>
          <Input name="name" autoComplete="name" maxLength={200} required aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input name="email" type="email" inputMode="email" autoComplete="email" required aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field label={<span>Phone <span className="font-normal text-neutral-500">(optional)</span></span>} error={errors.phone}>
          <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} />
        </Field>
        <Field label={<span>Postcode <span className="font-normal text-neutral-500">(optional)</span></span>} error={errors.postcode}>
          <Input name="postcode" autoComplete="postal-code" maxLength={10} aria-invalid={Boolean(errors.postcode)} />
        </Field>
        <Field label="What's it about?" error={errors.topic}>
          <Select name="topic" defaultValue="">
            <option value="">Choose one</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={ELSE}>{ELSE}</option>
          </Select>
        </Field>
        <Field label={<span>Vehicle <span className="font-normal text-neutral-500">(optional)</span></span>} error={errors.vehicle}>
          <Input name="vehicle" maxLength={100} placeholder="e.g. 2019 VW Golf" />
        </Field>
      </div>
      <Field label="How can they help?" error={errors.message}>
        <Textarea
          name="message"
          rows={6}
          maxLength={MAX_ENQUIRY_MESSAGE}
          required
          aria-invalid={Boolean(errors.message)}
          placeholder="Tell them about the job: what needs doing, the car's condition, and when suits you."
        />
      </Field>

      <div ref={humanCheckRef} className="flex justify-center empty:hidden" />
      {message && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
          {message}
        </p>
      )}
      <div className="grid gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 font-medium text-accent-fg shadow-sm ring-1 ring-black/5 transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {pending ? "Sending…" : "Send enquiry"}
        </button>
        <p className="text-center text-xs text-pretty text-neutral-500">
          {businessName} uses your details only to reply to you. See the{" "}
          <a href={privacyUrl} className="underline underline-offset-2 hover:text-neutral-900">
            privacy notice
          </a>
          .
        </p>
      </div>
    </form>
  );
}
