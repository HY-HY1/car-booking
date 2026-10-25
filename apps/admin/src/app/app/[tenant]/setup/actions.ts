"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { requireTenant } from "@/lib/auth";
import { tipsCookieName } from "@/lib/setup-tips";

// "Dismiss" on the Overview's next-steps card. Remembered per browser in a
// cookie, so there's nothing to store for what is only a nudge.
export async function dismissTipsAction(slug: string) {
  await requireTenant(slug);
  (await cookies()).set(tipsCookieName(slug), "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  refresh();
}
