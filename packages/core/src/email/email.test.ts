import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defaultTemplate, notificationsOf, upgradeLegacyBody } from "../settings/notifications";
import {
  cancelled,
  cleanSenderName,
  customerFooter,
  declined,
  depositRequest,
  formatClock,
  formatDay,
  fromHeader,
  ownerFooter,
  ownerNewBooking,
  passwordReset,
  paymentReceived,
  paymentRequest,
  renderEmail,
  requestReceived,
  safeLinkUrl,
  templateMessage,
  textToHtml,
  tidyAddress,
  type BookingFacts,
  type Composed,
} from "./compose";
import { afterJobDue, jobIntervalMins, leadAlertDue, reminderDue } from "./schedule";
import { parseResendEvent, verifyResendSignature } from "./webhook-rules";

const TZ = "Europe/London";

const facts: BookingFacts = {
  customerName: "Sam Jones",
  businessName: "Shine Detailing",
  service: "Full valet",
  date: "Friday 24 October",
  time: "9:30am",
  address: "12 High Street, BS1 4DJ",
  bookingLink: "https://book.shine.co.uk",
};

const rowsOf = (m: Composed) => Object.fromEntries((m.details ?? []).flatMap((p) => p.rows.map((r) => [r.label, r.value])));

describe("formatting", () => {
  it("writes the day and time in the business's time zone", () => {
    // 08:30 UTC is 09:30 in London during BST.
    const instant = new Date("2026-10-23T08:30:00Z");
    expect(formatDay(instant, TZ)).toBe("Friday 23 October");
    expect(formatClock(instant, TZ)).toBe("9:30am");
    expect(formatClock(new Date("2026-12-01T14:00:00Z"), TZ)).toBe("2pm");
  });

  it("keeps the sender name from breaking the From header", () => {
    expect(cleanSenderName('Shine "Best" <Detailing>\r\nBcc: x')).toBe("Shine Best Detailing Bcc: x");
    expect(fromHeader("Shine Detailing", "bookings@mail.example.com")).toBe('"Shine Detailing" <bookings@mail.example.com>');
    expect(fromHeader('""', "bookings@mail.example.com")).toBe("bookings@mail.example.com");
  });

  it("puts capitals back in an address typed all in lower case", () => {
    expect(tidyAddress("80 springbank way, gl51 0qx")).toBe("80 Springbank Way, GL51 0QX");
    expect(tidyAddress("80 springbank way, GL51 0QX")).toBe("80 Springbank Way, GL51 0QX");
    expect(tidyAddress("12 McDonald Road, BS1 4DJ")).toBe("12 McDonald Road, BS1 4DJ");
  });
});

describe("layout", () => {
  const brand = { name: "Shine Detailing", primaryColor: "#2e2e2e", accentColor: "#facc15" };
  const content = { subject: "Hello", heading: "Hi there", body: "Hello" };

  it("escapes markup and links web addresses", () => {
    const html = textToHtml("Hi <b>Sam</b>\nsee https://book.shine.co.uk/quote.\n\nThanks");
    expect(html).toContain("Hi &lt;b&gt;Sam&lt;/b&gt;<br>");
    expect(html).toContain('<a href="https://book.shine.co.uk/quote" style="color:inherit">https://book.shine.co.uk/quote</a>.');
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("adds the unsubscribe link to both versions of a marketing email", () => {
    const url = "https://book.shine.co.uk/unsubscribe?t=abc.email.sig";
    const { text, html } = renderEmail({ content, audience: "customer", brand, footer: ["Shine Detailing"], unsubscribeUrl: url });
    expect(text).toContain(`Unsubscribe: ${url}`);
    expect(html).toContain(`href="${url}"`);
  });

  it("ignores a brand colour that isn't a hex colour", () => {
    const { html } = renderEmail({ content, audience: "customer", brand: { name: "x", primaryColor: "red;background:url(x)" }, footer: [] });
    expect(html).not.toContain("url(x)");
    expect(html).toContain('bgcolor="#18181b"');
  });

  it("draws the button in the accent colour, for Outlook too, and writes it out in the text version", () => {
    const { text, html } = renderEmail({
      content: { ...content, button: { label: "Pay £40.00", url: "https://buy.stripe.com/abc" } },
      audience: "customer",
      brand,
      footer: [],
    });
    expect(text).toContain("Pay £40.00: https://buy.stripe.com/abc");
    expect(html).toContain('href="https://buy.stripe.com/abc"');
    // Dark text on a light brand colour.
    expect(html).toContain('background:#facc15"><a');
    expect(html).toContain("color:#0a0a0a;text-decoration:none");
    expect(html).toContain('<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"');
    expect(html).toContain('fillcolor="#facc15"');
    // The address written out under it, for when buttons don't work.
    expect(html).toContain("Button not working?");
  });

  it("leaves out a button whose address isn't safe, but keeps local ones for testing", () => {
    for (const url of ["javascript:alert(1)", "http://buy.stripe.com/abc", 'https://x.com/"onclick=1']) {
      const { text, html } = renderEmail({ content: { ...content, button: { label: "Pay", url } }, audience: "customer", brand, footer: [] });
      expect(text, url).not.toContain("Pay:");
      expect(html, url).not.toContain("Pay</a>");
    }
    expect(safeLinkUrl("http://localhost:3001/booking/shine/manage/abc")).toBe(true);
    expect(safeLinkUrl("http://shine.localhost:3001/manage/abc")).toBe(true);
    expect(safeLinkUrl("http://evil.com/localhost")).toBe(false);
  });

  it("shows the details as a table and as lines of text", () => {
    const { text, html } = renderEmail({
      content: {
        ...content,
        details: [
          {
            title: "Payment",
            rows: [
              { label: "Price", value: "£45.00" },
              { label: "Left to pay", value: "£0.00", total: true, badge: "Paid in full" },
            ],
          },
        ],
      },
      audience: "customer",
      brand,
      footer: [],
    });
    expect(text).toContain("PAYMENT\nPrice: £45.00\nLeft to pay: £0.00 (Paid in full)");
    expect(html).toContain(">Left to pay</td>");
    expect(html).toContain("Paid in full</span>");
  });

  it("keeps the email a fixed width in Outlook and gives inboxes a preview", () => {
    const { html } = renderEmail({ content: { ...content, body: "Hi Sam,\n\nYour car is booked in." }, audience: "customer", brand, footer: [] });
    expect(html).toContain('<!--[if mso]><table role="presentation" width="600"');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    // The greeting is skipped in the preview.
    expect(html).toContain('mso-hide:all">Your car is booked in.');
  });

  it("sizes the logo for Outlook when its shape is known", () => {
    const { html } = renderEmail({
      content,
      audience: "customer",
      brand: { ...brand, logo: { url: "https://cdn.example.com/logo.png", width: 400, height: 64 } },
      footer: [],
    });
    expect(html).toContain('width="200" height="32"');
    const { html: plain } = renderEmail({ content, audience: "customer", brand: { ...brand, logo: null }, footer: [] });
    expect(plain).toContain(">Shine Detailing</span>");
  });

  it("frames alerts to the business in the platform's name", () => {
    const { html } = renderEmail({ content, audience: "owner", brand, footer: ownerFooter("Shine Detailing", "https://app.example.com/shine/settings") });
    expect(html).toContain(">Kerbside</td>");
    expect(html).toContain(">Shine Detailing</td>");
    expect(html).not.toContain("Button not working?");
  });
});

describe("messages", () => {
  it("says who an email is from, how to reach them and why they got it", () => {
    const footer = customerFooter(
      { name: "Shine", tagline: "Mobile valeting", websiteUrl: "https://www.shine.co.uk", contactEmail: "hi@shine.co.uk", contactPhone: "07700 900123" },
      "booking",
    );
    expect(footer[0]).toBe("Shine · Mobile valeting");
    expect(footer[1]).toEqual([
      { text: "shine.co.uk", url: "https://www.shine.co.uk" },
      " · ",
      { text: "hi@shine.co.uk", url: "mailto:hi@shine.co.uk" },
      " · ",
      { text: "07700 900123", url: "tel:07700900123" },
    ]);
    expect(footer[2]).toBe("You're getting this because you made a booking with Shine.");
    expect(customerFooter({ name: "Shine" }, "marketing")).toHaveLength(2);
    expect(customerFooter({ name: "Shine" }, "marketing")[1]).toContain("said they could email you");
  });

  it("thanks a customer for a payment, with the receipt and what's left", () => {
    const base = {
      customerName: "Sam Jones",
      businessName: "Shine Detailing",
      description: "Balance for Full valet, 24 Oct",
      amountPence: 4000,
      receiptUrl: "https://pay.stripe.com/receipts/abc",
      booking: { service: "Full valet", date: "Friday 24 October", time: "9:30am" },
    };
    const full = paymentReceived({ ...base, balancePence: 0 });
    expect(full.subject).toBe("Thank you, you're paid in full with Shine Detailing");
    expect(full.body).toContain("Thank you for your payment of £40.");
    expect(rowsOf(full)).toMatchObject({ Booking: "Full valet, Friday 24 October at 9:30am", Paid: "£40.00", "Left to pay": "£0.00" });
    expect(full.details?.[0].rows.at(-1)?.badge).toBe("Paid in full");
    expect(full.button).toEqual({ label: "View your receipt", url: "https://pay.stripe.com/receipts/abc" });

    const part = paymentReceived({ ...base, balancePence: 2000 });
    expect(part.subject).toBe("Thank you for your payment to Shine Detailing");
    expect(rowsOf(part)["Left to pay"]).toBe("£20.00");

    const loose = paymentReceived({ ...base, customerName: null, booking: null, balancePence: null, receiptUrl: null });
    expect(loose.body.startsWith("Hello,")).toBe(true);
    expect(rowsOf(loose)).not.toHaveProperty("Left to pay");
    expect(loose.after).not.toContain("receipt");
    expect(loose.button).toBeUndefined();
  });

  it("asks for a payment, saying which booking it's for when there is one", () => {
    const base = { businessName: "Shine Detailing", description: "Balance for Full valet, 24 Oct", amountPence: 4000, url: "https://buy.stripe.com/abc" };
    const forBooking = paymentRequest({
      ...base,
      customerName: "Sam Jones",
      booking: { service: "Full valet", date: "Friday 24 October", time: "9:30am" },
    });
    expect(forBooking.subject).toBe("Payment request from Shine Detailing: £40");
    expect(forBooking.body).toContain("Hi Sam,");
    expect(forBooking.body).toContain("for your Full valet on Friday 24 October");
    expect(rowsOf(forBooking)).toMatchObject({ For: "Balance for Full valet, 24 Oct", Booking: "Friday 24 October, 9:30am", Amount: "£40.00" });
    expect(forBooking.button).toEqual({ label: "Pay £40.00", url: "https://buy.stripe.com/abc" });

    const loose = paymentRequest({ ...base, customerName: null, booking: null });
    expect(loose.body.startsWith("Hello,")).toBe(true);
    expect(rowsOf(loose)).not.toHaveProperty("Booking");
  });

  it("asks for the deposit with a button to pay it", () => {
    const m = depositRequest(facts, { depositPence: 1500, payUrl: "https://book.shine.co.uk/manage/abc" });
    expect(m.heading).toBe("Secure your booking with a £15.00 deposit");
    expect(m.button).toEqual({ label: "Pay £15.00 deposit", url: "https://book.shine.co.uk/manage/abc" });
    expect(rowsOf(m)).toMatchObject({ Where: "12 High Street, BS1 4DJ", Deposit: "£15.00" });
  });

  it("tells a customer a request isn't booked yet", () => {
    const m = requestReceived(facts);
    expect(m.body).toMatch(/^Hi Sam,/);
    expect(m.body).toContain("It isn't booked until then.");
    expect(rowsOf(m).Service).toBe("Full valet");
  });

  it("mentions the refund only when there was one", () => {
    expect(declined(facts, { reason: null, refundedPence: 2500 }).body).toContain("deposit of £25 has been refunded");
    expect(declined(facts, { reason: "We're away that week.", refundedPence: null }).body).not.toContain("refunded");
    expect(cancelled(facts, { depositPaid: false, refundedPence: 1500 }).body).toContain("refunded £15 of your deposit");
    expect(cancelled(facts, { depositPaid: true, refundedPence: 0 }).body).toContain("we'll be in touch");
    expect(cancelled(facts, { depositPaid: false }).body).not.toContain("deposit");
  });

  it("asks the owner to approve a request, with the customer's details to call", () => {
    const m = ownerNewBooking(
      {
        customerName: "Sam Jones",
        customerEmail: "sam@example.com",
        customerPhone: "+447700900123",
        service: "Full valet",
        date: "Friday 24 October",
        time: "9:30am",
        address: null,
        link: "http://localhost:3001/dashboard/shine/bookings/1",
      },
      { needsApproval: true, pricePence: 8500, depositPaidPence: 2000 },
    );
    expect(m.subject).toBe("Booking request to approve: Full valet, Friday 24 October at 9:30am");
    expect(m.heading).toBe("Sam Jones wants to book Full valet");
    expect(rowsOf(m)).toMatchObject({ When: "Friday 24 October, 9:30am", Price: "£85.00", "Deposit paid": "£20.00" });
    expect(m.details?.[1].rows.find((r) => r.label === "Phone")?.href).toBe("tel:+447700900123");
    expect(m.button?.label).toBe("Approve or decline");
  });

  it("puts an owner's own message inside the details and button its kind carries", () => {
    const confirmation = templateMessage(
      "confirmation",
      { subject: "You're booked in", body: "Hi Sam,\n\nSee you then." },
      { facts, money: { pricePence: 4500, depositPaidPence: 1125 }, buttonUrl: "https://book.shine.co.uk/manage/abc" },
    );
    expect(confirmation.eyebrow).toBe("Booking confirmed");
    expect(rowsOf(confirmation)).toMatchObject({ Service: "Full valet", Price: "£45.00", "Deposit paid": "£11.25", "Left to pay": "£33.75" });
    expect(confirmation.button?.label).toBe("Manage your booking");

    const reminder = templateMessage("reminder", { subject: "See you soon", body: "Hi" }, { facts, buttonUrl: null });
    expect(reminder.heading).toBe("See you on Friday");
    expect(reminder.button).toBeUndefined();

    const review = templateMessage("review_request", { subject: "How did we do?", body: "Hi" }, { buttonUrl: "https://g.page/r/x/review" });
    expect(review.heading).toBe("How did we do?");
    expect(review.details).toBeUndefined();
    expect(review.button).toEqual({ label: "Leave a review", url: "https://g.page/r/x/review" });
  });

  it("reads our old default wording as the new one, and leaves an owner's own alone", () => {
    const old =
      "Hi {customer_name},\n\nThanks for booking {service} with {business_name}. We'll see you on {date} at {time}.\n\nWhere: {address}\n\nIf anything changes, just reply to this email.";
    expect(upgradeLegacyBody("confirmation", old.replace(/\n/g, "\r\n"))).toBe(defaultTemplate("confirmation").body);
    expect(defaultTemplate("confirmation").body).not.toContain("{address}");
    expect(upgradeLegacyBody("confirmation", "Cheers {customer_name}!")).toBe("Cheers {customer_name}!");
    expect(notificationsOf({ messages: { confirmation: { body: old } } }).messages.confirmation.body).toBe(defaultTemplate("confirmation").body);
    expect(notificationsOf({ messages: { reminder: { body: "Where: {address}" } } }).messages.reminder.body).toBe("Where: {address}");
  });
});

describe("schedule", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);
  const longAgo = new Date("2026-11-01T00:00:00Z");

  it("sends a reminder inside the window, not before, when the job runs every 15 minutes", () => {
    expect(reminderDue({ startsAt: hours(23), createdAt: hours(-72) }, 24, now, 15)).toBe(true);
    expect(reminderDue({ startsAt: hours(25), createdAt: hours(-72) }, 24, now, 15)).toBe(false);
    expect(reminderDue({ startsAt: hours(-1), createdAt: hours(-72) }, 24, now, 15)).toBe(false);
  });

  it("sends a daily job's reminder on the run nearest its time, which may be the day before", () => {
    // Daily at 7am: "24 hours before" a 9am job tomorrow goes now, 26 hours ahead.
    const seven = new Date("2026-11-10T07:00:00Z");
    const nineTomorrow = new Date("2026-11-11T09:00:00Z");
    expect(reminderDue({ startsAt: nineTomorrow, createdAt: longAgo }, 24, seven, 1440)).toBe(true);
    // A job the day after isn't due yet.
    expect(reminderDue({ startsAt: new Date("2026-11-12T09:00:00Z"), createdAt: longAgo }, 24, seven, 1440)).toBe(false);
    // A "2 hours before" reminder waits for the morning of the job.
    expect(reminderDue({ startsAt: nineTomorrow, createdAt: longAgo }, 2, seven, 1440)).toBe(false);
  });

  it("reads the job's interval from the environment, defaulting to daily", () => {
    expect(jobIntervalMins(undefined)).toBe(1440);
    expect(jobIntervalMins("15")).toBe(15);
    expect(jobIntervalMins("nonsense")).toBe(1440);
  });

  it("skips the reminder when the booking was made inside the window", () => {
    expect(reminderDue({ startsAt: hours(5), createdAt: hours(-1) }, 24, now, 15)).toBe(false);
  });

  it("sends after-job messages once due, for a week", () => {
    expect(afterJobDue(hours(-73), 3, now)).toBe(true);
    expect(afterJobDue(hours(-71), 3, now)).toBe(false);
    expect(afterJobDue(hours(-24 * 11), 3, now)).toBe(false);
  });

  it("waits 30 minutes before an enquiry alert", () => {
    expect(leadAlertDue(new Date(now.getTime() - 20 * 60_000), now)).toBe(false);
    expect(leadAlertDue(new Date(now.getTime() - 40 * 60_000), now)).toBe(true);
    expect(leadAlertDue(hours(-49), now)).toBe(false);
  });
});

describe("passwordReset", () => {
  it("carries the link as a button, written out underneath for when buttons don't work", () => {
    const url = "https://app.example.com/reset-password?token=abc";
    const email = passwordReset(url);
    expect(email.button?.url).toBe(url);
    expect(email.after).toContain("ignore this email");
    const { text, html } = renderEmail({ content: email, audience: "platform", brand: { name: "Kerbside" }, footer: [] });
    expect(text).toContain(url);
    expect(html).toContain("Button not working?");
  });
});

describe("resend webhooks", () => {
  const key = Buffer.from("a-test-signing-key");
  const secret = `whsec_${key.toString("base64")}`;
  const body = JSON.stringify({
    type: "email.bounced",
    data: { email_id: "e1", to: ["sam@example.com"], bounce: { type: "Permanent", subType: "General", message: "No such user" } },
  });
  const sign = (id: string, ts: string, raw: string) => `v1,${createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64")}`;

  it("accepts Resend's signature and refuses anything else", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const headers = { id: "msg_1", timestamp: ts, signature: `v1,bogus ${sign("msg_1", ts, body)}` };
    expect(verifyResendSignature(secret, body, headers)).toBe(true);
    expect(verifyResendSignature(secret, `${body} `, headers)).toBe(false);
    expect(verifyResendSignature(secret, body, { ...headers, signature: "v1,bogus" })).toBe(false);
    // Too old to trust.
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifyResendSignature(secret, body, { id: "msg_1", timestamp: old, signature: sign("msg_1", old, body) })).toBe(false);
  });

  it("reads bounces and complaints", () => {
    expect(parseResendEvent(JSON.parse(body))).toEqual({
      kind: "bounced",
      emailId: "e1",
      to: "sam@example.com",
      permanent: true,
      reason: "Permanent: General: No such user",
    });
    expect(parseResendEvent({ type: "email.bounced", data: { email_id: "e2", to: ["x@y.z"], bounce: { type: "Transient" } } })).toMatchObject({
      permanent: false,
    });
    expect(parseResendEvent({ type: "email.complained", data: { email_id: "e3", to: ["x@y.z"] } })).toEqual({
      kind: "complained",
      emailId: "e3",
      to: "x@y.z",
    });
    expect(parseResendEvent({ type: "email.delivered", data: { email_id: "e4" } })).toBeNull();
  });
});
