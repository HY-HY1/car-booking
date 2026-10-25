import { describe, expect, it } from "vitest";
import {
  cleanSenderName,
  declined,
  formatClock,
  formatDay,
  fromHeader,
  ownerNewBooking,
  renderEmail,
  requestReceived,
  textToHtml,
  type BookingFacts,
} from "./compose";
import { afterJobDue, leadAlertDue, reminderDue } from "./schedule";

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
});

describe("layout", () => {
  it("escapes markup and links web addresses", () => {
    const html = textToHtml("Hi <b>Sam</b>\nsee https://book.shine.co.uk/quote.\n\nThanks");
    expect(html).toContain("Hi &lt;b&gt;Sam&lt;/b&gt;<br>");
    expect(html).toContain('<a href="https://book.shine.co.uk/quote" style="color:inherit">https://book.shine.co.uk/quote</a>.');
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("adds the unsubscribe link to both versions of a marketing email", () => {
    const url = "https://book.shine.co.uk/unsubscribe?t=abc.email.sig";
    const { text, html } = renderEmail({ heading: "Shine", body: "Hello", footer: ["Shine Detailing"], unsubscribeUrl: url });
    expect(text).toContain(`Unsubscribe: ${url}`);
    expect(html).toContain(`href="${url}"`);
  });

  it("ignores an accent colour that isn't a hex colour", () => {
    const { html } = renderEmail({ heading: "x", body: "y", footer: [], accentColor: "red;background:url(x)" });
    expect(html).toContain("border-top:4px solid #18181b");
  });
});

describe("messages", () => {
  it("tells a customer a request isn't booked yet", () => {
    const m = requestReceived(facts);
    expect(m.body).toMatch(/^Hi Sam,/);
    expect(m.body).toContain("It isn't booked until then.");
  });

  it("mentions the refund only when there was one", () => {
    expect(declined(facts, { reason: null, refundedPence: 2500 }).body).toContain("deposit of £25 has been refunded");
    expect(declined(facts, { reason: "We're away that week.", refundedPence: null }).body).not.toContain("refunded");
  });

  it("asks the owner to approve a request", () => {
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
    expect(m.body).toContain("Deposit paid: £20");
  });
});

describe("schedule", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

  it("sends a reminder inside the window, not before", () => {
    expect(reminderDue({ startsAt: hours(23), createdAt: hours(-72) }, 24, now)).toBe(true);
    expect(reminderDue({ startsAt: hours(25), createdAt: hours(-72) }, 24, now)).toBe(false);
    expect(reminderDue({ startsAt: hours(-1), createdAt: hours(-72) }, 24, now)).toBe(false);
  });

  it("skips the reminder when the booking was made inside the window", () => {
    expect(reminderDue({ startsAt: hours(5), createdAt: hours(-1) }, 24, now)).toBe(false);
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
