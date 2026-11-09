"use client";

import { useActionState } from "react";
import { REQUEST_KINDS } from "@leadgen/core/privacy/rules";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { submitRequestAction, type RequestState } from "./actions";

export function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(submitRequestAction, {});

  if (state.done) {
    return (
      <p className="mt-6 rounded-xl border bg-white p-4">
        Thanks, we&apos;ve got your request. We&apos;ll reply within one month, and we may contact you
        first to check it&apos;s really you.
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 grid gap-4">
      <Field label="What would you like to do?" error={state.errors?.kind}>
        <Select name="kind" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {Object.entries(REQUEST_KINDS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Your name" error={state.errors?.name}>
        <Input name="name" required autoComplete="name" />
      </Field>
      <Field label="The email you booked with" error={state.errors?.email}>
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Anything else we should know (optional)" error={state.errors?.details}>
        <Textarea name="details" rows={4} maxLength={2000} />
      </Field>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-accent px-6 font-medium text-accent-fg disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
