"use client";

import { useActionState } from "react";
import { REQUEST_KINDS } from "@leadgen/core/privacy/rules";
import { submitRequestAction, type RequestState } from "./actions";

const input = "h-11 w-full rounded-xl border bg-white px-3 text-base";

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

  const err = (k: string) => state.errors?.[k] && <span className="text-sm text-red-600">{state.errors[k]}</span>;

  return (
    <form action={action} className="mt-6 grid gap-4">
      <label className="grid gap-1 text-sm font-medium">
        What would you like to do?
        <select name="kind" required defaultValue="" className={input}>
          <option value="" disabled>Choose…</option>
          {Object.entries(REQUEST_KINDS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {err("kind")}
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Your name
        <input name="name" required autoComplete="name" className={input} />
        {err("name")}
      </label>
      <label className="grid gap-1 text-sm font-medium">
        The email you booked with
        <input name="email" type="email" required autoComplete="email" className={input} />
        {err("email")}
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Anything else we should know (optional)
        <textarea name="details" rows={4} maxLength={2000} className="w-full rounded-xl border bg-white p-3 text-base" />
        {err("details")}
      </label>
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
