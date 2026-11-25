import "server-only";
import { headers } from "next/headers";
import { hitRateLimit } from "@leadgen/core/api/rate-limit";

// Limits on the public booking page's server actions, so a script can't use
// them to send email from a business's domain, run up its photo-check bill,
// hold its diary or guess its promo codes. Counted in the database
// (api_rate_limit_hit), so they hold across server instances.
//
// Each action has a limit per visitor (by IP address) and one per business,
// both counted per window. Real customers come nowhere near either.
type Limit = { perVisitor: number; perBusiness: number; windowSeconds: number };

const HOUR = 3600;
const DAY = 86_400;

export const LIMITS = {
  // Each one emails the customer and alerts the owner.
  book: { perVisitor: 5, perBusiness: 60, windowSeconds: HOUR },
  lead: { perVisitor: 10, perBusiness: 100, windowSeconds: HOUR },
  // Each one alerts the owner and lands under Leads.
  enquiry: { perVisitor: 5, perBusiness: 50, windowSeconds: HOUR },
  // Every photo check is a paid call to Claude, so the business cap is daily.
  assess: { perVisitor: 10, perBusiness: 60, windowSeconds: DAY },
  photo: { perVisitor: 40, perBusiness: 400, windowSeconds: DAY },
  promo: { perVisitor: 20, perBusiness: 200, windowSeconds: HOUR },
  // Reads, but each one is a database round trip (and a postcode lookup).
  lookup: { perVisitor: 300, perBusiness: 5000, windowSeconds: HOUR },
  // Each one lands in the owner's privacy requests.
  privacy: { perVisitor: 5, perBusiness: 30, windowSeconds: DAY },
} satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

export const TOO_MANY = "You've tried that a lot just now. Please wait a while and try again.";

// The visitor's IP address. On Vercel, x-forwarded-for is set by Vercel's
// edge from the connection itself (any value the visitor sent is replaced),
// so it can be trusted there. Behind another host it may need changing.
export async function visitorIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// True if this visitor and this business are both under the limit, counting
// this attempt. If the counter can't be reached, it lets the attempt through
// (hitRateLimit), so a database hiccup doesn't stop real bookings.
export async function withinLimit(name: LimitName, tenantId: string): Promise<boolean> {
  const { perVisitor, perBusiness, windowSeconds } = LIMITS[name];
  const ip = await visitorIp();
  // The visitor first, so one script that's already refused doesn't use up
  // the business's allowance and lock its real customers out.
  const visitor = await hitRateLimit(`booking:${name}:ip:${ip}`, perVisitor, windowSeconds);
  if (!visitor.allowed) {
    console.warn(`[limits] ${name} refused for a visitor`, { tenantId, ip });
    return false;
  }
  const business = await hitRateLimit(`booking:${name}:tenant:${tenantId}`, perBusiness, windowSeconds);
  if (!business.allowed) {
    console.warn(`[limits] ${name} refused: the business is at its limit`, { tenantId });
    return false;
  }
  return true;
}
