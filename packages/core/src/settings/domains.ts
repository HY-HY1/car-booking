import { z } from "zod";
import { normalizeHostname } from "../platform/rules";
import { hostnameOf, routingConfig } from "../urls";

// Custom domains an owner adds in Settings → Booking page, e.g.
// book.shinedetailing.co.uk. The domain goes live once DNS shows two records:
// a CNAME pointing at the booking app, and a TXT record holding the domain's
// token, which proves the owner controls it. No database or network access.

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// Where the CNAME points. On Vercel this is its shared DNS target.
export function cnameTarget() {
  return process.env.BOOKING_CNAME_TARGET || "cname.vercel-dns.com";
}

// The platform's own domain (<slug>.<base> in subdomain mode): a custom
// domain can't be this or under it.
export function baseDomain() {
  return hostnameOf(routingConfig().rootDomain);
}

export const VERIFY_PREFIX = "_booking-verify";

export function customHostnameSchema(base = baseDomain()) {
  return z
    .string()
    .transform(normalizeHostname)
    .refine((h) => HOSTNAME.test(h), "Enter a web address like book.yourbusiness.co.uk.")
    .refine((h) => h !== base && !h.endsWith(`.${base}`), "That's one of our addresses. Enter your own domain.")
    // A CNAME can't sit on a bare domain (yourbusiness.co.uk), only on a
    // name under it. Two labels before a known two-part suffix, or two
    // before anything else, means there's a subdomain.
    .refine((h) => hasSubdomain(h), "Use a subdomain like book.yourbusiness.co.uk: a bare domain can't point here.");
}

const TWO_PART_SUFFIXES = ["co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "co.im", "co.je", "co.gg"];

export function hasSubdomain(hostname: string) {
  const labels = hostname.split(".");
  const twoPart = TWO_PART_SUFFIXES.some((s) => hostname.endsWith(`.${s}`));
  return labels.length >= (twoPart ? 4 : 3);
}

export function newVerificationToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// The two records to add at the domain's DNS provider. Most providers want
// the name without the domain on the end, so both forms are given.
export function dnsRecords(hostname: string, token: string) {
  const labels = hostname.split(".");
  const twoPart = TWO_PART_SUFFIXES.some((s) => hostname.endsWith(`.${s}`));
  const apexLabels = twoPart ? 3 : 2;
  const sub = labels.slice(0, labels.length - apexLabels).join(".");
  return [
    { type: "CNAME", host: sub, fullName: hostname, value: cnameTarget() },
    { type: "TXT", host: `${VERIFY_PREFIX}.${sub}`, fullName: `${VERIFY_PREFIX}.${hostname}`, value: token },
  ];
}
