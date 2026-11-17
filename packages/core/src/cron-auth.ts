import { createHash, timingSafeEqual } from "node:crypto";

// For the scheduled jobs (/api/jobs/*): the caller must send
// "Authorization: Bearer $CRON_SECRET", as Vercel Cron and the database's
// pg_cron caller do. Returns the response to send if it doesn't, or null to
// carry on. Compared in constant time, so the secret can't be worked out a
// character at a time from how long a wrong guess takes.
export function refuseUnlessCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 404 });
  const sent = request.headers.get("authorization") ?? "";
  // Hashed first so both sides are the same length, as timingSafeEqual needs.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(digest(sent), digest(`Bearer ${secret}`))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
