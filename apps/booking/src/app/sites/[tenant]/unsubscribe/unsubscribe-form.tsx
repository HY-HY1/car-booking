"use client";

import { useActionState } from "react";
import { unsubscribeAction, type UnsubscribeState } from "./actions";

export function UnsubscribeForm({ token, businessName }: { token: string; businessName: string }) {
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(unsubscribeAction, {});

  if (state.done) {
    return (
      <p role="status" className="font-medium">
        You&apos;re unsubscribed. {businessName} won&apos;t send you marketing any more.
      </p>
    );
  }
  return (
    <form action={action} className="not-prose mt-6 grid justify-items-start gap-3">
      <input type="hidden" name="t" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
