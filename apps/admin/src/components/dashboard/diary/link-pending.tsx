"use client";

import { useLinkStatus } from "next/link";

// Inside a job's link: a pulse while its panel is on the way from the server.
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="pointer-events-none absolute inset-0 animate-pulse bg-foreground/10" /> : null;
}
