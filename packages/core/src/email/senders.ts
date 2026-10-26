import { z } from "zod";
import { baseDomain } from "../settings/domains";

// The address a business's emails come from, on its own domain
// (Settings → Notifications). The domain is verified with the email provider
// through DNS records the owner adds; until then its customers' emails aren't
// sent. No database or network access: senders-server.ts does that.

// Free mail services: the owner can't add DNS records to these, so an
// address on one can never be verified.
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "aol.com",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "talktalk.net",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.co.uk",
]);

export function domainOfAddress(address: string) {
  return address.slice(address.lastIndexOf("@") + 1);
}

export function senderAddressSchema(base = baseDomain()) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter an email address like hello@yourbusiness.co.uk."))
    .refine((a) => a.length <= 254, "That address is too long.")
    .refine(
      (a) => !FREE_MAIL.has(domainOfAddress(a)),
      "Use an address on your own domain. Gmail, iCloud and other free addresses can't be sent from by other services.",
    )
    .refine((a) => {
      const d = domainOfAddress(a);
      return d !== base && !d.endsWith(`.${base}`) && !d.endsWith(".vercel.app") && !d.endsWith(".localhost");
    }, "That's one of our addresses. Use your own domain.");
}

export type SenderStatus = "pending" | "verified" | "failed";

// A DNS record as the owner adds it. `host` is the name without the domain
// on the end, which most DNS providers want; `fullName` is the whole name.
export type SenderRecord = { type: string; host: string; fullName: string; value: string; priority?: number };

// Resend gives names relative to the domain ("resend._domainkey", "send").
type ProviderRecord = { type?: unknown; name?: unknown; value?: unknown; priority?: unknown };

export function senderRecords(domain: string, records: unknown): SenderRecord[] {
  if (!Array.isArray(records)) return [];
  return (records as ProviderRecord[]).flatMap((r) => {
    if (typeof r.type !== "string" || typeof r.name !== "string" || typeof r.value !== "string") return [];
    const host = r.name === "@" || r.name === "" || r.name === domain ? "@" : r.name.replace(new RegExp(`\\.${domain.replace(/\./g, "\\.")}$`), "");
    return [
      {
        type: r.type,
        host,
        fullName: host === "@" ? domain : `${host}.${domain}`,
        value: r.value,
        ...(typeof r.priority === "number" && { priority: r.priority }),
      },
    ];
  });
}

// The provider's word for a domain's state, as ours.
export function senderStatusOf(providerStatus: string): SenderStatus {
  if (providerStatus === "verified") return "verified";
  if (providerStatus === "failed") return "failed";
  // not_started, pending, temporary_failure: still waiting on DNS.
  return "pending";
}
