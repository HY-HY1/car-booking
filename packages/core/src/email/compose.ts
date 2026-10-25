import { formatPence } from "../booking/config";

// What goes in an email: the wording of the messages owners can't edit, the
// alerts sent to the business, and the plain layout every email is wrapped
// in. Pure: no database, no sending (email/notify.ts does that).

export type Composed = { subject: string; body: string };

// ---------------------------------------------------------------- formatting

// "Friday 24 October", in the business's time zone.
export function formatDay(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone }).format(instant);
}

// "9:30am", "2pm".
export function formatClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).formatToParts(
    instant,
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const minute = get("minute");
  return `${get("hour")}${minute === "00" ? "" : `:${minute}`}${get("dayPeriod").toLowerCase().replace(/\./g, "")}`;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

// A display name that's safe inside "Name <address>": no quotes, angle
// brackets or line breaks, which could break the header or add another.
export function cleanSenderName(name: string) {
  return name.replace(/["<>\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function fromHeader(name: string, address: string) {
  const clean = cleanSenderName(name);
  return clean ? `"${clean}" <${address}>` : address;
}

// ---------------------------------------------------------------- layout

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Escapes first, then turns web addresses into links, so nothing in a
// template or a customer's name can add markup.
function linkify(escaped: string) {
  return escaped.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" style="color:inherit">${url}</a>`);
}

// Blank lines start a paragraph, single line breaks stay line breaks.
export function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${linkify(escapeHtml(p.trim())).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const hexColor = /^#[0-9a-fA-F]{6}$/;

export type Layout = {
  heading: string;
  body: string;
  // Small print under the message: who sent it and why.
  footer: string[];
  accentColor?: string;
  // Marketing only: the one-click opt-out.
  unsubscribeUrl?: string;
};

export function renderEmail({ heading, body, footer, accentColor, unsubscribeUrl }: Layout) {
  const lines = unsubscribeUrl ? [...footer, `Don't want these emails? Unsubscribe: ${unsubscribeUrl}`] : footer;
  const text = `${body.trim()}\n\n--\n${lines.join("\n")}\n`;
  const accent = accentColor && hexColor.test(accentColor) ? accentColor : "#18181b";
  const small = lines
    .map((l) => `<p style="margin:0 0 6px">${linkify(escapeHtml(l))}</p>`)
    .join("");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;border-top:4px solid ${accent}">
<tr><td style="padding:24px 28px 8px;font:600 18px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">${escapeHtml(heading)}</td></tr>
<tr><td style="padding:8px 28px 12px;font:15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#27272a">${textToHtml(body)}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:16px 28px;font:12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#71717a">${small}</td></tr></table>
</td></tr></table>
</body></html>`;
  return { text, html };
}

// ---------------------------------------------------------------- customer messages owners can't edit

export type BookingFacts = {
  customerName: string;
  businessName: string;
  service: string;
  date: string;
  time: string;
  address: string;
  bookingLink: string;
};

const signOff = (f: BookingFacts) => `Thanks,\n${f.businessName}`;

// The business approves each booking itself, so the customer is told it's a
// request, not a booking.
export function requestReceived(f: BookingFacts): Composed {
  return {
    subject: `We've got your booking request: ${f.service}`,
    body: `Hi ${firstName(f.customerName)},\n\nThanks for your request for ${f.service} on ${f.date} at ${f.time}. ${f.businessName} will check it and confirm by email. It isn't booked until then.\n\nWhere: ${f.address}\n\n${signOff(f)}`,
  };
}

export function declined(f: BookingFacts, opts: { reason: string | null; refundedPence: number | null }): Composed {
  const reason = opts.reason ? `\n\n${opts.reason}` : "";
  const refund =
    opts.refundedPence !== null
      ? `\n\nYour deposit of ${formatPence(opts.refundedPence)} has been refunded in full. It can take 5 to 10 days to reach your account.`
      : "";
  return {
    subject: `About your booking request for ${f.date}`,
    body: `Hi ${firstName(f.customerName)},\n\nSorry, ${f.businessName} can't take your booking for ${f.service} on ${f.date} at ${f.time}.${reason}${refund}\n\nYou're welcome to pick another time: ${f.bookingLink}\n\n${signOff(f)}`,
  };
}

export function cancelled(f: BookingFacts, opts: { depositPaid: boolean }): Composed {
  const deposit = opts.depositPaid ? "\n\nIf you paid a deposit, we'll be in touch about it." : "";
  return {
    subject: `Your booking on ${f.date} has been cancelled`,
    body: `Hi ${firstName(f.customerName)},\n\nYour booking for ${f.service} on ${f.date} at ${f.time} has been cancelled.${deposit}\n\nIf this isn't what you expected, just reply to this email. To book another time: ${f.bookingLink}\n\n${signOff(f)}`,
  };
}

// The deposit arrived after the hold ran out and someone else took the time.
export function lateRefund(f: BookingFacts, opts: { amountPence: number }): Composed {
  return {
    subject: `Sorry, that time went before your payment arrived`,
    body: `Hi ${firstName(f.customerName)},\n\nYour deposit for ${f.service} on ${f.date} at ${f.time} came through after the time we were holding for you ran out, and it's since been booked by someone else.\n\nWe've refunded your ${formatPence(opts.amountPence)} in full. It can take 5 to 10 days to reach your account.\n\nSorry about that. You can pick another time here: ${f.bookingLink}\n\n${signOff(f)}`,
  };
}

// ---------------------------------------------------------------- alerts to the business

export type OwnerFacts = {
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  service: string | null;
  date: string | null;
  time: string | null;
  address: string | null;
  // The booking or lead in the dashboard.
  link: string;
};

function contactLines(f: OwnerFacts) {
  return [
    `Customer: ${f.customerName}`,
    f.customerPhone && `Phone: ${f.customerPhone}`,
    f.customerEmail && `Email: ${f.customerEmail}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function jobLine(f: OwnerFacts) {
  return [f.service, f.date && f.time ? `${f.date} at ${f.time}` : f.date].filter(Boolean).join(", ");
}

export function ownerNewBooking(f: OwnerFacts, opts: { needsApproval: boolean; pricePence: number; depositPaidPence: number | null }): Composed {
  const money = [
    `Price: ${formatPence(opts.pricePence)}`,
    opts.depositPaidPence !== null && `Deposit paid: ${formatPence(opts.depositPaidPence)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const where = f.address ? `\nWhere: ${f.address}` : "";
  return opts.needsApproval
    ? {
        subject: `Booking request to approve: ${jobLine(f)}`,
        body: `${f.customerName} has asked to book ${jobLine(f)}. It isn't confirmed until you approve it.${where}\n\n${contactLines(f)}\n${money}\n\nApprove or decline: ${f.link}`,
      }
    : {
        subject: `New booking: ${jobLine(f)}`,
        body: `${f.customerName} has booked ${jobLine(f)}.${where}\n\n${contactLines(f)}\n${money}\n\nView the booking: ${f.link}`,
      };
}

export function ownerCancellation(f: OwnerFacts, opts: { by: string | null }): Composed {
  const by = opts.by ? ` by ${opts.by}` : "";
  return {
    subject: `Cancelled: ${jobLine(f)}`,
    body: `${f.customerName}'s booking for ${jobLine(f)} was cancelled${by}. The time is free again.\n\n${contactLines(f)}\n\nView the booking: ${f.link}`,
  };
}

// Sent once a customer who gave their details hasn't gone on to book.
export function ownerNewLead(f: OwnerFacts, opts: { quotedPence: number | null }): Composed {
  const quoted = opts.quotedPence !== null ? `\nQuoted: ${formatPence(opts.quotedPence)}` : "";
  const what = f.service ? ` about ${f.service}` : "";
  return {
    subject: `New enquiry from ${f.customerName}`,
    body: `${f.customerName} enquired${what} but hasn't booked yet. A quick call or message often wins the job.\n\n${contactLines(f)}${quoted}\n\nSee everything they told us: ${f.link}`,
  };
}

export function ownerDispute(f: OwnerFacts | null, opts: { amountPence: number; link: string }): Composed {
  const about = f ? ` for ${f.customerName}'s booking (${jobLine(f)})` : "";
  return {
    subject: `Payment disputed: ${formatPence(opts.amountPence)}`,
    body: `A customer has disputed a payment of ${formatPence(opts.amountPence)}${about}.\n\nStripe gives you a limited time to respond, so answer it in your Stripe Dashboard soon. Photos, the booking details and the confirmation email all help.\n\n${f ? `View the booking: ${opts.link}` : `Your payments: ${opts.link}`}`,
  };
}

export function ownerLateRefund(f: OwnerFacts): Composed {
  return {
    subject: `Deposit refunded: the time had gone`,
    body: `${f.customerName}'s deposit for ${jobLine(f)} arrived after their hold ran out, and the time had been booked by someone else. We refunded it in full and emailed them to pick another time.\n\n${contactLines(f)}\n\nView the booking: ${f.link}`,
  };
}

export function ownerPaymentProblem(detail: string, link: string): Composed {
  return {
    subject: "A payment needs checking",
    body: `Stripe told us about a payment we couldn't match up:\n\n${detail}\n\nCheck it in your Stripe Dashboard. Your payments: ${link}`,
  };
}
