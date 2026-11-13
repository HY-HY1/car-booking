import { formatPence } from "../booking/config";
import { PRODUCT_NAME } from "../brand";
import { readableOn, visibleOn } from "../branding/colors";
import type { CustomerMessage } from "../settings/notifications";

// What goes in an email: the wording of the messages owners can't edit, the
// alerts sent to the business, and the layout every email is wrapped in.
// Pure: no database, no sending (email/notify.ts does that).
//
// The layout is built for email clients, not browsers: tables for structure,
// inline styles, a fixed-width frame and a drawn button for Outlook on
// Windows, a light design that dark-mode clients can adapt, and a plain-text
// version carrying everything the HTML does.

// ---------------------------------------------------------------- content

// A label and its value in a details box ("Date: Friday 24 October").
// `total` draws a rule above and makes it bold; `href` links the value
// (tel:, mailto: or https: only); `badge` adds a small green tag.
export type DetailRow = { label: string; value: string; href?: string; total?: boolean; badge?: string };
export type DetailPanel = { title?: string; rows: DetailRow[] };
export type EmailButton = { label: string; url: string };

// One email's words. `body` and `after` are plain text: blank lines start a
// paragraph, single line breaks stay. Read top to bottom: eyebrow, heading,
// body, details, button, after.
export type Composed = {
  subject: string;
  // What the inbox shows after the subject. Default: the body's first lines.
  preheader?: string;
  // A small label above the heading, e.g. "Booking confirmed".
  eyebrow?: string;
  heading?: string;
  body: string;
  details?: DetailPanel[];
  // The one thing the email asks the reader to do.
  button?: EmailButton;
  after?: string;
};

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

// Money in a details box: always with pence, so a column of amounts lines up.
export function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(pence / 100);
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

// An address typed in lower case ("80 springbank way, gl51 0qx") with
// capitals put back; the postcode doesn't count, since forms often capitalise
// it for them. Anything else with a capital in it is left as the customer
// wrote it, since they may know better (McDonald, St Ives).
const POSTCODE = /\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/gi;

export function tidyAddress(address: string) {
  const street = address.replace(POSTCODE, "");
  if (street !== street.toLowerCase()) return address;
  return address
    .toLowerCase()
    .replace(/\b([a-z]{1,2}\d[a-z\d]?)\s*(\d[a-z]{2})\b/g, (_, a: string, b: string) => `${a.toUpperCase()} ${b.toUpperCase()}`)
    .replace(/\b([a-z])([a-z']*)/g, (_, first: string, rest: string) => first.toUpperCase() + rest);
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

// ---------------------------------------------------------------- layout helpers

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Escapes first, then turns web addresses into links, so nothing in a
// template or a customer's name can add markup.
function linkify(escaped: string) {
  return escaped.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" style="color:inherit">${url}</a>`);
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Blank lines start a paragraph, single line breaks stay line breaks.
export function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p class="e-body" style="margin:0 0 16px;font:15px/1.6 ${FONT};color:#3f3f46">${linkify(escapeHtml(p.trim())).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// An address a button may open: https anywhere, and plain http only on this
// machine, so local testing shows the same buttons production does.
export function safeLinkUrl(url: string) {
  if (/[\s"<>]/.test(url)) return false;
  if (/^https:\/\/[^/]+/.test(url)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost)(:\d+)?(\/|$)/i.test(url);
}

// Where a value in a details box may link to.
function safeRowHref(href: string) {
  return /^(tel:\+?[\d ]+|mailto:[^\s"<>]+@[^\s"<>]+)$/.test(href) || safeLinkUrl(href);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// A UK postcode kept on one line when an address wraps.
function keepPostcode(escaped: string) {
  return escaped.replace(/\b([A-Z]{1,2}\d[A-Z\d]?) (\d[A-Z]{2})\b/g, "$1&nbsp;$2");
}

function panelHtml(panel: DetailPanel) {
  const title = panel.title
    ? `<tr><td colspan="2" class="e-muted" style="padding:14px 0 2px;font:600 11px/1.4 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:#71717a">${escapeHtml(panel.title)}</td></tr>`
    : "";
  const rows = panel.rows
    .map((row, i) => {
      const rule = row.total ? "border-top:1px solid #e4e4e7;" : i ? "border-top:1px solid #efeff1;" : "";
      const value = keepPostcode(escapeHtml(row.value));
      const linked =
        row.href && safeRowHref(row.href)
          ? `<a href="${escapeHtml(row.href)}" class="e-strong" style="color:#18181b;text-decoration:underline">${value}</a>`
          : value;
      const badge = row.badge
        ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:#dcfce7;color:#166534;font:600 11px/1.5 ${FONT};vertical-align:1px">${escapeHtml(row.badge)}</span>`
        : "";
      return `<tr class="e-row"><td class="e-muted" style="${rule}padding:11px 12px 11px 0;font:14px/1.45 ${FONT};color:#71717a;vertical-align:top;width:36%">${escapeHtml(row.label)}</td><td class="e-strong" style="${rule}padding:11px 0;font:${row.total ? 700 : 500} 14px/1.45 ${FONT};color:#18181b;text-align:right;vertical-align:top">${linked}${badge}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="e-panel" style="margin:4px 0 20px;background:#f8f8f9;border:1px solid #e4e4e7;border-radius:10px"><tr><td style="padding:4px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${title}${rows}</table></td></tr></table>`;
}

function panelText(panel: DetailPanel) {
  const rows = panel.rows.map((r) => `${r.label}: ${r.value}${r.badge ? ` (${r.badge})` : ""}`).join("\n");
  return panel.title ? `${panel.title.toUpperCase()}\n${rows}` : rows;
}

// A button every client draws: Outlook on Windows gets a VML shape, the rest
// a padded link. `fallback` writes the address out underneath.
function buttonHtml(button: EmailButton, colour: string, fallback: boolean) {
  const url = escapeHtml(button.url);
  const label = escapeHtml(button.label);
  const fg = readableOn(colour);
  const width = Math.min(520, Math.round(button.label.length * 9 + 56));
  const drawn = `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:46px;v-text-anchor:middle;width:${width}px" arcsize="18%" stroke="f" fillcolor="${colour}"><w:anchorlock/><center style="color:${fg};font-family:Arial,sans-serif;font-size:15px;font-weight:bold">${label}</center></v:roundrect><![endif]--><!--[if !mso]><!--><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0"><tr><td bgcolor="${colour}" style="border-radius:8px;background:${colour}"><a href="${url}" style="display:inline-block;padding:14px 26px;font:600 15px/1 ${FONT};color:${fg};text-decoration:none;border-radius:8px">${label}</a></td></tr></table><!--<![endif]-->`;
  const spaced = `<div style="margin:8px 0 ${fallback ? 12 : 24}px">${drawn}</div>`;
  if (!fallback) return spaced;
  return `${spaced}<p class="e-muted" style="margin:0 0 22px;font:12px/1.5 ${FONT};color:#a1a1aa">Button not working? Paste this into your browser:<br><a href="${url}" style="color:#71717a;word-break:break-all">${url}</a></p>`;
}

// ---------------------------------------------------------------- layout

// Who an email speaks for. Customer emails wear the business's own look;
// alerts to the business and account emails come from the platform.
export type EmailAudience = "customer" | "owner" | "platform";

// The business, as its emails show it. The logo is the email copy
// (branding.email_logo: a PNG, which every client shows) when there is one.
export type EmailBrand = {
  name: string;
  logo?: { url: string; width?: number; height?: number } | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  tagline?: string | null;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

// A line of small print: plain text, or text with links in it.
export type FooterLine = string | (string | { text: string; url: string })[];

export type Layout = {
  content: Composed;
  audience: EmailAudience;
  brand: EmailBrand;
  footer: FooterLine[];
  // Marketing only: the one-click opt-out.
  unsubscribeUrl?: string;
};

const LOGO_HEIGHT = 32;
const LOGO_MAX_WIDTH = 220;

function logoHtml(brand: EmailBrand, band: string) {
  const fg = readableOn(band);
  const logo = brand.logo;
  if (!logo || !safeLinkUrl(logo.url)) {
    return `<span class="e-brandname" style="font:700 20px/1.2 ${FONT};color:${fg}">${escapeHtml(brand.name)}</span>`;
  }
  // Outlook sizes images by their attributes, so they're set whenever the
  // shape is known.
  let size = `height="${LOGO_HEIGHT}"`;
  let style = `height:${LOGO_HEIGHT}px;width:auto;max-width:${LOGO_MAX_WIDTH}px`;
  if (logo.width && logo.height) {
    let h = LOGO_HEIGHT;
    let w = Math.round((logo.width / logo.height) * h);
    if (w > LOGO_MAX_WIDTH) {
      w = LOGO_MAX_WIDTH;
      h = Math.round((logo.height / logo.width) * w);
    }
    size = `width="${w}" height="${h}"`;
    style = `width:${w}px;height:${h}px`;
  }
  return `<img src="${escapeHtml(logo.url)}" alt="${escapeHtml(brand.name)}" ${size} style="display:block;${style};border:0;outline:none;color:${fg};font:700 20px ${FONT}">`;
}

function footerLineHtml(line: FooterLine) {
  if (typeof line === "string") return linkify(escapeHtml(line));
  return line
    .map((part) =>
      typeof part === "string"
        ? escapeHtml(part)
        : safeRowHref(part.url)
          ? `<a href="${escapeHtml(part.url)}" style="color:#71717a;text-decoration:underline">${escapeHtml(part.text)}</a>`
          : escapeHtml(part.text),
    )
    .join("");
}

function footerLineText(line: FooterLine) {
  if (typeof line === "string") return line;
  return line.map((part) => (typeof part === "string" ? part : part.url.startsWith("mailto:") || part.url.startsWith("tel:") ? part.text : `${part.text} (${part.url})`)).join("");
}

// The inbox preview: the body's opening, without the greeting.
function previewOf(content: Composed) {
  if (content.preheader) return content.preheader;
  const lines = content.body.split(/\n+/).map((l) => l.trim()).filter((l) => l && !/^(hi|hello|dear)\b.*,$/i.test(l));
  return lines.join(" ").slice(0, 140);
}

export function renderEmail({ content, audience, brand, footer, unsubscribeUrl }: Layout) {
  const lines: FooterLine[] = unsubscribeUrl ? [...footer, [{ text: "Unsubscribe from these emails", url: unsubscribeUrl }]] : footer;
  const button = content.button && safeLinkUrl(content.button.url) ? content.button : undefined;
  const isCustomer = audience === "customer";
  const primary = brand.primaryColor && HEX.test(brand.primaryColor) ? brand.primaryColor : "#18181b";
  const accent = brand.accentColor && HEX.test(brand.accentColor) ? brand.accentColor : primary;
  const buttonColour = isCustomer ? accent : "#18181b";

  // ------------------------------------------------ plain text
  const text = `${[
    content.heading,
    content.body.trim(),
    ...(content.details ?? []).map(panelText),
    button && `${button.label}: ${button.url}`,
    content.after?.trim(),
  ]
    .filter(Boolean)
    .join("\n\n")}\n\n--\n${lines
    .map(footerLineText)
    .join("\n")
    .replace(/Unsubscribe from these emails \((.+)\)/, "Unsubscribe: $1")}\n`;

  // ------------------------------------------------ html
  const header = isCustomer
    ? `<tr><td class="e-px" bgcolor="${primary}" style="padding:24px 32px;background:${primary}">${logoHtml(brand, primary)}</td></tr><tr><td bgcolor="${accent}" style="height:3px;line-height:3px;font-size:0;background:${accent}">&nbsp;</td></tr>`
    : `<tr><td class="e-px e-rule" style="padding:22px 32px;border-bottom:1px solid #e4e4e7"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="e-strong" style="font:700 16px/1 ${FONT};color:#18181b">${escapeHtml(PRODUCT_NAME)}</td>${
        audience === "owner" ? `<td class="e-muted" align="right" style="font:500 13px/1 ${FONT};color:#71717a">${escapeHtml(brand.name)}</td>` : ""
      }</tr></table></td></tr>`;

  const eyebrowColour = isCustomer ? visibleOn(accent, "#ffffff", 4.5) : "#71717a";
  const blocks = [
    content.eyebrow &&
      `<p style="margin:0 0 8px;font:600 12px/1.4 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${eyebrowColour}">${escapeHtml(content.eyebrow)}</p>`,
    content.heading &&
      `<h1 class="e-strong e-h1" style="margin:0 0 14px;font:700 24px/1.25 ${FONT};color:#18181b;letter-spacing:-.01em">${escapeHtml(content.heading)}</h1>`,
    textToHtml(content.body),
    ...(content.details ?? []).filter((p) => p.rows.length).map(panelHtml),
    button && buttonHtml(button, buttonColour, audience !== "owner"),
    content.after && textToHtml(content.after),
  ]
    .filter(Boolean)
    .join("\n");

  const small = lines
    .map((l, i) => `<p ${i === 0 ? 'class="e-body" ' : ""}style="margin:0 0 6px;${i === 0 ? "font-weight:600;color:#52525b" : ""}">${footerLineHtml(l)}</p>`)
    .join("");
  // Padding after the preview text, so the inbox doesn't run on into the body.
  const preheader = `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(previewOf(content))}${"&#8199;&#847; ".repeat(60)}</div>`;

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(content.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:separate}
img{-ms-interpolation-mode:bicubic}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
@media (max-width:600px){.e-px{padding-left:22px!important;padding-right:22px!important}.e-h1{font-size:21px!important}.e-outer{padding:12px 8px!important}}
@media (prefers-color-scheme:dark){
.e-page{background:#0b0b0d!important}.e-card{background:#18181b!important;border-color:#27272a!important}
.e-strong{color:#fafafa!important}.e-body{color:#d4d4d8!important}.e-muted{color:#a1a1aa!important}
.e-panel{background:#1f1f23!important;border-color:#2e2e33!important}.e-row td,.e-rule{border-color:#2e2e33!important}}
</style>
</head>
<body class="e-page" style="margin:0;padding:0;background:#f4f4f5">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="e-page" style="background:#f4f4f5"><tr><td align="center" class="e-outer" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="e-card" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden">
${header}
<tr><td class="e-px" style="padding:32px 32px 30px">${blocks}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td class="e-px e-muted" align="center" style="padding:22px 32px 8px;font:12px/1.6 ${FONT};color:#71717a">${small}</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
  return { text, html };
}

// ---------------------------------------------------------------- footers

// The small print under an email to a customer: who it's from, how to reach
// them, and why they got it.
export type EmailReason = "booking" | "marketing" | "payment_link" | "payment_received";

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function customerFooter(brand: EmailBrand, reason: EmailReason): FooterLine[] {
  const why = {
    booking: `You're getting this because you made a booking with ${brand.name}.`,
    marketing: `You're getting this because you booked with ${brand.name} and said they could email you.`,
    payment_link: `You're getting this because ${brand.name} sent you a payment request.`,
    payment_received: `You're getting this because you made a payment to ${brand.name}.`,
  };
  const contact: (string | { text: string; url: string })[] = [];
  const add = (part: { text: string; url: string }) => contact.push(...(contact.length ? [" · ", part] : [part]));
  if (brand.websiteUrl) add({ text: hostOf(brand.websiteUrl), url: brand.websiteUrl });
  if (brand.contactEmail) add({ text: brand.contactEmail, url: `mailto:${brand.contactEmail}` });
  if (brand.contactPhone) add({ text: brand.contactPhone, url: `tel:${brand.contactPhone.replace(/[^\d+]/g, "")}` });
  return [`${brand.name}${brand.tagline ? ` · ${brand.tagline}` : ""}`, ...(contact.length ? [contact] : []), why[reason]];
}

// The small print under an alert to the business.
export function ownerFooter(businessName: string, settingsUrl: string): FooterLine[] {
  return [`${PRODUCT_NAME} alerts for ${businessName}`, [{ text: "Change which alerts you get", url: settingsUrl }]];
}

// ---------------------------------------------------------------- booking details

export type BookingFacts = {
  customerName: string;
  businessName: string;
  service: string;
  date: string;
  time: string;
  address: string;
  bookingLink: string;
};

const signOff = (businessName: string) => `Thanks,\n${businessName}`;

function bookingPanel(f: Pick<BookingFacts, "service" | "date" | "time" | "address">, extra: DetailRow[] = []): DetailPanel {
  return {
    rows: [
      { label: "Service", value: f.service },
      { label: "Date", value: f.date },
      { label: "Time", value: f.time },
      ...(f.address ? [{ label: "Where", value: f.address }] : []),
      ...extra,
    ],
  };
}

// What the booking costs and what's left, when it costs anything.
export function paymentPanel(money: { pricePence: number; depositPaidPence: number }): DetailPanel | null {
  if (money.pricePence <= 0) return null;
  const left = Math.max(0, money.pricePence - money.depositPaidPence);
  return {
    title: "Payment",
    rows: [
      { label: "Price", value: formatMoney(money.pricePence) },
      ...(money.depositPaidPence > 0 ? [{ label: "Deposit paid", value: formatMoney(money.depositPaidPence) }] : []),
      { label: "Left to pay", value: formatMoney(left), total: true, ...(left === 0 && { badge: "Paid in full" }) },
    ],
  };
}

// ---------------------------------------------------------------- messages owners write (Settings → Notifications)

// The rest of an email around an owner's own subject and message: the label,
// heading, booking details and button each kind of message carries.
export type TemplateContext = {
  facts?: BookingFacts;
  money?: { pricePence: number; depositPaidPence: number } | null;
  // The customer's manage link, the booking page or the review link, as the kind needs.
  buttonUrl?: string | null;
};

const TEMPLATE_FRAME: Record<CustomerMessage, { eyebrow?: string; heading?: (f?: BookingFacts) => string; button?: string; details?: boolean }> = {
  confirmation: { eyebrow: "Booking confirmed", heading: () => "You're booked in", button: "Manage your booking", details: true },
  reminder: { eyebrow: "Reminder", heading: (f) => (f ? `See you on ${f.date.split(" ")[0]}` : "See you soon"), button: "Manage your booking", details: true },
  slot_opened: { eyebrow: "Earlier time available", heading: () => "An earlier time has opened up", button: "Move my booking", details: true },
  follow_up: { eyebrow: "Aftercare", button: "Book again" },
  review_request: { eyebrow: "Thank you", button: "Leave a review" },
  quote_follow_up: { button: "Pick a time" },
  rebook_reminder: { button: "Book again" },
};

export function templateMessage(kind: CustomerMessage, rendered: { subject: string; body: string }, ctx: TemplateContext = {}): Composed {
  const frame = TEMPLATE_FRAME[kind];
  const details: DetailPanel[] = [];
  if (frame.details && ctx.facts) {
    details.push(
      kind === "slot_opened"
        ? { rows: [{ label: "Service", value: ctx.facts.service }, { label: "New date", value: ctx.facts.date }, { label: "New time", value: ctx.facts.time }] }
        : bookingPanel(ctx.facts),
    );
    const money = kind === "confirmation" && ctx.money ? paymentPanel(ctx.money) : null;
    if (money) details.push(money);
  }
  return {
    subject: rendered.subject,
    eyebrow: frame.eyebrow,
    heading: frame.heading?.(ctx.facts) ?? rendered.subject,
    body: rendered.body,
    ...(details.length && { details }),
    ...(frame.button && ctx.buttonUrl && { button: { label: frame.button, url: ctx.buttonUrl } }),
  };
}

// ---------------------------------------------------------------- customer messages owners can't edit

// The business approves each booking itself, so the customer is told it's a
// request, not a booking.
export function requestReceived(f: BookingFacts): Composed {
  return {
    subject: `We've got your booking request: ${f.service}`,
    eyebrow: "Request received",
    heading: "We've got your request",
    body: `Hi ${firstName(f.customerName)},\n\nThanks for your request. ${f.businessName} will check it and confirm by email. It isn't booked until then.`,
    details: [bookingPanel(f)],
    after: signOff(f.businessName),
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
    eyebrow: "Booking request",
    heading: "Sorry, we can't take this booking",
    body: `Hi ${firstName(f.customerName)},\n\nSorry, ${f.businessName} can't take your booking for ${f.service} on ${f.date} at ${f.time}.${reason}${refund}`,
    button: { label: "Pick another time", url: f.bookingLink },
    after: `You're welcome to book another time.\n\n${signOff(f.businessName)}`,
  };
}

export function cancelled(f: BookingFacts, opts: { depositPaid: boolean; refundedPence?: number }): Composed {
  const deposit = opts.refundedPence
    ? `\n\nWe've refunded ${formatPence(opts.refundedPence)} of your deposit. It can take 5 to 10 days to reach your account.`
    : opts.depositPaid
      ? "\n\nIf you paid a deposit, we'll be in touch about it."
      : "";
  return {
    subject: `Your booking on ${f.date} has been cancelled`,
    eyebrow: "Booking cancelled",
    heading: "Your booking has been cancelled",
    body: `Hi ${firstName(f.customerName)},\n\nYour booking for ${f.service} on ${f.date} at ${f.time} has been cancelled.${deposit}`,
    details: [bookingPanel(f)],
    button: { label: "Book another time", url: f.bookingLink },
    after: `If this isn't what you expected, just reply to this email.\n\n${signOff(f.businessName)}`,
  };
}

// The customer cancelled it themselves (booking/manage.ts). `refund` is what
// the policy says happens to their deposit (manage-rules.ts refundLine);
// `refunding` when some of it is going back.
export function cancelledByCustomer(f: BookingFacts, opts: { refund: string | null; refunding: boolean }): Composed {
  const when = opts.refunding ? ` ${f.businessName} will send it shortly; it can take 5 to 10 days to reach your account.` : "";
  const refund = opts.refund ? `\n\n${opts.refund}${when}` : "";
  return {
    subject: `You've cancelled your booking on ${f.date}`,
    eyebrow: "Booking cancelled",
    heading: "You've cancelled your booking",
    body: `Hi ${firstName(f.customerName)},\n\nYour booking for ${f.service} on ${f.date} at ${f.time} is cancelled.${refund}`,
    details: [bookingPanel(f)],
    button: { label: "Book another time", url: f.bookingLink },
    after: signOff(f.businessName),
  };
}

// The business asks for the deposit on a booking it's made or confirmed
// itself. The button opens the customer's booking page, which starts a
// fresh Stripe checkout each time, so the link never expires.
export function depositRequest(f: BookingFacts, opts: { depositPence: number; payUrl: string }): Composed {
  const amount = formatMoney(opts.depositPence);
  return {
    subject: `Deposit for your booking on ${f.date}`,
    preheader: `Pay the ${amount} deposit to secure your ${f.service} on ${f.date}.`,
    eyebrow: "Deposit due",
    heading: `Secure your booking with a ${amount} deposit`,
    body: `Hi ${firstName(f.customerName)},\n\nYou're booked in for ${f.service}. To hold your time, please pay the deposit.`,
    details: [bookingPanel(f, [{ label: "Deposit", value: amount, total: true }])],
    button: { label: `Pay ${amount} deposit`, url: opts.payUrl },
    after: `Card payments are handled securely by Stripe.\n\n${signOff(f.businessName)}`,
  };
}

// It moved, by the customer or the business. `from` is the old day and time.
export function rescheduled(f: BookingFacts, opts: { fromDate: string; fromTime: string; manageUrl: string | null }): Composed {
  return {
    subject: `Your booking has moved to ${f.date} at ${f.time}`,
    eyebrow: "Booking moved",
    heading: "Your booking has moved",
    body: `Hi ${firstName(f.customerName)},\n\nYour booking for ${f.service} is now on ${f.date} at ${f.time}. It was ${opts.fromDate} at ${opts.fromTime}.`,
    details: [bookingPanel(f)],
    ...(opts.manageUrl && { button: { label: "Manage your booking", url: opts.manageUrl } }),
    after: signOff(f.businessName),
  };
}

// The deposit arrived after the hold ran out and someone else took the time.
export function lateRefund(f: BookingFacts, opts: { amountPence: number }): Composed {
  return {
    subject: `Sorry, that time went before your payment arrived`,
    eyebrow: "Deposit refunded",
    heading: "Sorry, that time has gone",
    body: `Hi ${firstName(f.customerName)},\n\nYour deposit for ${f.service} on ${f.date} at ${f.time} came through after the time we were holding for you ran out, and it's since been booked by someone else.\n\nWe've refunded your ${formatPence(opts.amountPence)} in full. It can take 5 to 10 days to reach your account.`,
    details: [{ rows: [{ label: "Refunded", value: formatMoney(opts.amountPence), total: true }] }],
    button: { label: "Pick another time", url: f.bookingLink },
    after: `Sorry about that.\n\n${signOff(f.businessName)}`,
  };
}

// The business sent a payment link (Payments → Payment links, or a booking's
// "Email payment link"). `booking` is set when the link is for one.
export function paymentRequest(f: {
  customerName: string | null;
  businessName: string;
  description: string;
  amountPence: number;
  url: string;
  booking: { service: string; date: string; time: string } | null;
}): Composed {
  const amount = formatMoney(f.amountPence);
  const hi = f.customerName ? `Hi ${firstName(f.customerName)},` : "Hello,";
  const forBooking = f.booking ? ` for your ${f.booking.service} on ${f.booking.date}` : "";
  return {
    subject: `Payment request from ${f.businessName}: ${formatPence(f.amountPence)}`,
    preheader: `${amount}${forBooking}. Pay securely by card.`,
    eyebrow: "Payment request",
    heading: `${f.businessName} has sent you a payment request`,
    body: `${hi}\n\nHere's a request for ${amount}${forBooking}. You can pay securely by card with the button below.`,
    details: [
      {
        rows: [
          { label: "For", value: f.description },
          ...(f.booking ? [{ label: "Booking", value: `${f.booking.date}, ${f.booking.time}` }] : []),
          { label: "Amount", value: amount, total: true },
        ],
      },
    ],
    button: { label: `Pay ${amount}`, url: f.url },
    after: `Payments are handled by Stripe. If anything doesn't look right, just reply to this email.\n\n${signOff(f.businessName)}`,
  };
}

// A payment link was paid: thanks, what it was for, what's left on the
// booking (if it's for one) and Stripe's receipt. `balancePence` is null when
// the payment isn't for a booking.
export function paymentReceived(f: {
  customerName: string | null;
  businessName: string;
  description: string | null;
  amountPence: number;
  receiptUrl: string | null;
  booking: { service: string; date: string; time: string } | null;
  balancePence: number | null;
}): Composed {
  const hi = f.customerName ? `Hi ${firstName(f.customerName)},` : "Hello,";
  const paidInFull = f.balancePence === 0;
  const rows: DetailRow[] = [
    ...(f.description ? [{ label: "For", value: f.description }] : []),
    ...(f.booking ? [{ label: "Booking", value: `${f.booking.service}, ${f.booking.date} at ${f.booking.time}` }] : []),
    { label: "Paid", value: formatMoney(f.amountPence) },
    ...(f.balancePence !== null
      ? [{ label: "Left to pay", value: formatMoney(f.balancePence), total: true, ...(paidInFull && { badge: "Paid in full" }) }]
      : []),
  ];
  return {
    subject: paidInFull ? `Thank you, you're paid in full with ${f.businessName}` : `Thank you for your payment to ${f.businessName}`,
    eyebrow: "Payment received",
    heading: paidInFull ? "Thank you, you're all paid up" : "Thank you for your payment",
    body: `${hi}\n\nThank you for your payment of ${formatPence(f.amountPence)}. It's come through safely.`,
    details: [{ rows }],
    ...(f.receiptUrl && { button: { label: "View your receipt", url: f.receiptUrl } }),
    after: `${f.receiptUrl ? "Keep the receipt for your records. " : ""}If you have any questions, just reply to this email.\n\n${signOff(f.businessName)}`,
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

function customerPanel(f: OwnerFacts): DetailPanel {
  return {
    title: "Customer",
    rows: [
      { label: "Name", value: f.customerName },
      ...(f.customerPhone ? [{ label: "Phone", value: f.customerPhone, href: `tel:${f.customerPhone.replace(/[^\d+]/g, "")}` }] : []),
      ...(f.customerEmail ? [{ label: "Email", value: f.customerEmail, href: `mailto:${f.customerEmail}` }] : []),
    ],
  };
}

function whenOf(f: Pick<OwnerFacts, "date" | "time">) {
  return f.date && f.time ? `${f.date}, ${f.time}` : (f.date ?? "");
}

function jobRows(f: OwnerFacts): DetailRow[] {
  return [
    ...(f.service ? [{ label: "Service", value: f.service }] : []),
    ...(f.date ? [{ label: "When", value: whenOf(f) }] : []),
    ...(f.address ? [{ label: "Where", value: f.address }] : []),
  ];
}

// "Full valet, Friday 24 October at 9:30am": the subject line's summary.
function jobLine(f: OwnerFacts) {
  return [f.service, f.date && f.time ? `${f.date} at ${f.time}` : f.date].filter(Boolean).join(", ");
}

export function ownerNewBooking(f: OwnerFacts, opts: { needsApproval: boolean; pricePence: number; depositPaidPence: number | null }): Composed {
  const service = f.service ?? "a job";
  const money: DetailRow[] = [
    { label: "Price", value: formatMoney(opts.pricePence) },
    ...(opts.depositPaidPence !== null ? [{ label: "Deposit paid", value: formatMoney(opts.depositPaidPence) }] : []),
  ];
  const details = [{ rows: [...jobRows(f), ...money] }, customerPanel(f)];
  return opts.needsApproval
    ? {
        subject: `Booking request to approve: ${jobLine(f)}`,
        eyebrow: "Approval needed",
        heading: `${f.customerName} wants to book ${service}`,
        body: "It isn't confirmed until you approve it.",
        details,
        button: { label: "Approve or decline", url: f.link },
      }
    : {
        subject: `New booking: ${jobLine(f)}`,
        eyebrow: "New booking",
        heading: `${f.customerName} booked ${service}`,
        body: "It's confirmed and in your diary.",
        details,
        button: { label: "View booking", url: f.link },
      };
}

// `refund`: the customer cancelled it themselves and paid a deposit, so the
// owner is told what the policy says to give back (they refund it).
export function ownerCancellation(f: OwnerFacts, opts: { by: string | null; refund?: string }): Composed {
  const by = opts.by ? ` by ${opts.by}` : "";
  return {
    subject: `Cancelled: ${jobLine(f)}`,
    eyebrow: "Cancelled",
    heading: `${f.customerName}'s booking was cancelled`,
    body: `It was cancelled${by}. The time is free again.${opts.refund ? `\n\n${opts.refund}` : ""}`,
    details: [{ rows: jobRows(f) }, customerPanel(f)],
    button: { label: "View booking", url: f.link },
  };
}

export function ownerRescheduled(f: OwnerFacts, opts: { fromDate: string; fromTime: string }): Composed {
  return {
    subject: `Moved: ${jobLine(f)}`,
    eyebrow: "Booking moved",
    heading: `${f.customerName} moved their booking`,
    body: "The old time is free again.",
    details: [
      {
        rows: [
          ...(f.service ? [{ label: "Service", value: f.service }] : []),
          { label: "Was", value: `${opts.fromDate}, ${opts.fromTime}` },
          { label: "Now", value: whenOf(f) },
          ...(f.address ? [{ label: "Where", value: f.address }] : []),
        ],
      },
      customerPanel(f),
    ],
    button: { label: "View booking", url: f.link },
  };
}

// Sent once a customer who gave their details hasn't gone on to book.
export function ownerNewLead(f: OwnerFacts, opts: { quotedPence: number | null }): Composed {
  return {
    subject: `New enquiry from ${f.customerName}`,
    eyebrow: "New enquiry",
    heading: `${f.customerName} enquired${f.service ? ` about ${f.service}` : ""}`,
    body: "They haven't booked yet. A quick call or message often wins the job.",
    details: [
      ...(f.service || opts.quotedPence !== null
        ? [
            {
              rows: [
                ...(f.service ? [{ label: "Service", value: f.service }] : []),
                ...(opts.quotedPence !== null ? [{ label: "Quoted", value: formatMoney(opts.quotedPence) }] : []),
              ],
            },
          ]
        : []),
      customerPanel(f),
    ],
    button: { label: "See the enquiry", url: f.link },
  };
}

export function ownerDispute(f: OwnerFacts | null, opts: { amountPence: number; link: string }): Composed {
  return {
    subject: `Payment disputed: ${formatPence(opts.amountPence)}`,
    eyebrow: "Payment disputed",
    heading: `A customer has disputed ${formatMoney(opts.amountPence)}`,
    body: "Stripe gives you a limited time to respond, so answer it in your Stripe Dashboard soon. Photos, the booking details and the confirmation email all help.",
    details: f ? [{ rows: jobRows(f) }, customerPanel(f)] : [],
    button: { label: f ? "View booking" : "Your payments", url: opts.link },
  };
}

export function ownerLateRefund(f: OwnerFacts): Composed {
  return {
    subject: `Deposit refunded: the time had gone`,
    eyebrow: "Deposit refunded",
    heading: `We refunded ${f.customerName}'s deposit`,
    body: "Their deposit arrived after their hold ran out, and the time had been booked by someone else. We refunded it in full and emailed them to pick another time.",
    details: [{ rows: jobRows(f) }, customerPanel(f)],
    button: { label: "View booking", url: f.link },
  };
}

export function ownerPaymentProblem(detail: string, link: string): Composed {
  return {
    subject: "A payment needs checking",
    eyebrow: "Payment problem",
    heading: "A payment needs checking",
    body: `Stripe told us about a payment we couldn't match up:\n\n${detail}\n\nCheck it in your Stripe Dashboard.`,
    button: { label: "Your payments", url: link },
  };
}

// ---------------------------------------------------------------- accounts

export function passwordReset(url: string): Composed {
  return {
    subject: "Reset your password",
    eyebrow: "Your account",
    heading: "Reset your password",
    body: "Use the button below to choose a new password. The link lasts for an hour and works once.",
    button: { label: "Choose a new password", url },
    after: "Didn't ask for this? You can ignore this email. Your password won't change.",
  };
}
