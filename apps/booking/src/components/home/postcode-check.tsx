"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleX, Search } from "lucide-react";
import { checkAreaAction } from "@/app/sites/[tenant]/quote/actions";

// "Do we cover your postcode?": the same check the booking form runs. A yes
// leads into the booking form with the postcode already filled in.

type Result = { ok: true; postcode: string } | { ok: false; outside: boolean; message: string; postcode: string };

export function PostcodeCheck({ quoteUrl, contactHref }: { quoteUrl: string; contactHref: string | null }) {
  const [postcode, setPostcode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = postcode.trim().toUpperCase();
          if (!value) return;
          startTransition(async () => {
            try {
              const r = await checkAreaAction(value);
              setResult(r.ok ? { ok: true, postcode: value } : { ok: false, outside: r.code === "outside_area", message: r.message, postcode: value });
            } catch {
              setResult({ ok: false, outside: false, message: "We couldn't check that just now. Please try again.", postcode: value });
            }
          });
        }}
      >
        <label htmlFor="cover-postcode" className="sr-only">
          Your postcode
        </label>
        <input
          id="cover-postcode"
          value={postcode}
          onChange={(e) => {
            setPostcode(e.target.value);
            setResult(null);
          }}
          autoComplete="postal-code"
          autoCapitalize="characters"
          placeholder="Enter your postcode"
          maxLength={10}
          className="h-12 min-w-0 flex-1 rounded-full border border-neutral-300 bg-surface px-5 text-base uppercase outline-none placeholder:normal-case placeholder:text-neutral-400 focus-visible:border-neutral-500 focus-visible:ring-3 focus-visible:ring-neutral-300/60"
        />
        <button
          type="submit"
          disabled={pending || !postcode.trim()}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-brand px-5 font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-60"
        >
          <Search className="size-4" aria-hidden />
          {pending ? "Checking…" : "Check"}
        </button>
      </form>

      <div role="status" aria-live="polite">
        {result?.ok && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-600/25 bg-emerald-50 px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-900">
              <CircleCheck className="size-5 shrink-0 text-emerald-600" aria-hidden />
              Good news, we cover {result.postcode}.
            </p>
            <Link
              href={`${quoteUrl}?postcode=${encodeURIComponent(result.postcode)}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900 underline-offset-4 hover:underline"
            >
              Book now <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
        {result && !result.ok && (
          <div className="flex items-start gap-2 rounded-2xl border bg-surface px-4 py-3 text-sm text-neutral-700">
            <CircleX className="mt-0.5 size-5 shrink-0 text-neutral-400" aria-hidden />
            <p>
              {result.outside ? (
                <>
                  Sorry, {result.postcode} is outside the area we usually cover.{" "}
                  {contactHref ? (
                    <a href={contactHref} className="font-medium text-neutral-900 underline underline-offset-4">
                      Get in touch
                    </a>
                  ) : (
                    "Get in touch"
                  )}{" "}
                  and we&apos;ll see what we can do.
                </>
              ) : (
                result.message
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
