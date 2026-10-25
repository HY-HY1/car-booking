// The moment that matters for a new business is the first real enquiry, not
// finishing setup: it's when they see the product working. It's read from the
// leads and bookings already stored, so there's nothing extra to keep in step.
// A test enquiry the owner makes themselves counts too; the data can't tell.

export function earliest(...times: (string | null | undefined)[]) {
  const valid = times.filter((t): t is string => Boolean(t) && !Number.isNaN(Date.parse(t as string)));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// "Same day", "1 day", "5 days": how long a business took to get its first
// enquiry after being created. Whole days, rounded down.
export function timeToFirstEnquiry(createdAt: string, firstEnquiryAt: string) {
  const days = Math.max(0, Math.floor((Date.parse(firstEnquiryAt) - Date.parse(createdAt)) / DAY_MS));
  if (days === 0) return "Same day";
  return days === 1 ? "1 day" : `${days} days`;
}
