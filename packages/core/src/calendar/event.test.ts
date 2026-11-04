import { describe, expect, it } from "vitest";
import {
  bookingIdOf,
  busyFromEvents,
  changedInGoogle,
  eventHash,
  eventIdFor,
  hasEvent,
  jobEvent,
  type GoogleEvent,
  type JobFacts,
} from "./event";

const BOOKING = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c";

const facts: JobFacts = {
  bookingId: BOOKING,
  status: "confirmed",
  startsAt: "2026-11-03T09:00:00.000Z",
  endsAt: "2026-11-03T12:00:00.000Z",
  timeZone: "Europe/London",
  service: "Full valet",
  customer: { name: "Sam Taylor", phone: "07700 900123", email: "sam@example.com" },
  vehicle: { make: "Ford", model: "Focus", registration: "AB12 CDE" },
  locationType: "mobile",
  addressLine: "1 High Street",
  postcode: "BS1 4DJ",
  resourceName: "Van 2",
  customerNotes: "  Side gate is open  ",
  quoteSnapshot: {
    answers: {
      access: { water: "yes", power: "no", parking: "driveway" },
      details: { colour: "Blue", handover: "keys_left", concerns: ["pet_hair", "smoke"] },
    },
  },
  pricePence: 12000,
  depositPence: 2000,
  depositStatus: "paid",
  link: "https://example.com/app/shine/bookings/x",
};

describe("eventIdFor", () => {
  it("makes a Google-valid id that's the same every time", () => {
    const id = eventIdFor(BOOKING);
    expect(id).toBe("bk3f2b8c1e9a4d4e7b8c2a1d5e6f7a8b9c");
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(eventIdFor(BOOKING.toUpperCase())).toBe(id);
  });
});

describe("hasEvent", () => {
  it("keeps live and finished jobs, not holds, cancellations or lapsed holds", () => {
    expect(["requested", "confirmed", "completed", "no_show"].every(hasEvent)).toBe(true);
    expect(["held", "cancelled", "expired"].some(hasEvent)).toBe(false);
  });
});

describe("jobEvent", () => {
  it("puts everything the tech needs on the event", () => {
    const e = jobEvent(facts);
    expect(e.summary).toBe("Full valet · Sam Taylor");
    expect(e.location).toBe("1 High Street, BS1 4DJ");
    expect(e.start).toEqual({ dateTime: "2026-11-03T09:00:00.000Z", timeZone: "Europe/London" });
    expect(e.end.dateTime).toBe("2026-11-03T12:00:00.000Z");
    expect(e.description).toContain("Phone: 07700 900123");
    expect(e.description).toContain("Car: Ford Focus (AB12 CDE) Blue");
    expect(e.description).toContain("Van: Van 2");
    expect(e.description).toContain("Handover: Keys left with someone else");
    expect(e.description).toContain("Water: Yes · Power: No · Parking: Driveway");
    expect(e.description).toContain("To look at: Pet hair, Smoke or odours");
    expect(e.description).toContain("Notes: Side gate is open");
    expect(e.description).toContain("Price: £120 · Deposit £20 paid");
    expect(e.description).toContain(`Booking: ${facts.link}`);
    expect(e.extendedProperties.private.bookingId).toBe(BOOKING);
    expect(e.colorId).toBeUndefined();
  });

  it("says when a job is waiting for approval, done or a no-show", () => {
    expect(jobEvent({ ...facts, status: "requested" })).toMatchObject({ summary: "Awaiting approval: Full valet · Sam Taylor", colorId: "5" });
    expect(jobEvent({ ...facts, status: "completed" }).summary).toBe("Done: Full valet · Sam Taylor");
    expect(jobEvent({ ...facts, status: "no_show" }).colorId).toBe("8");
  });

  it("copes with an erased customer and a shop job", () => {
    const e = jobEvent({
      ...facts,
      customer: { name: "Erased customer", phone: null, email: null },
      vehicle: null,
      addressLine: null,
      postcode: "BS1",
      customerNotes: null,
      quoteSnapshot: null,
      locationType: "unit",
      depositPence: 0,
    });
    expect(e.description).not.toMatch(/Phone|Email|Car:|Notes|Deposit/);
    expect(e.description).toContain("At the shop");
    expect(e.location).toBe("BS1");
  });

  it("hashes the same booking the same way, and a change differently", () => {
    const a = eventHash("primary", jobEvent(facts));
    expect(eventHash("primary", jobEvent(facts))).toBe(a);
    expect(eventHash("van2@group.calendar.google.com", jobEvent(facts))).not.toBe(a);
    expect(eventHash("primary", jobEvent({ ...facts, endsAt: "2026-11-03T13:00:00.000Z" }))).not.toBe(a);
  });
});

describe("busyFromEvents", () => {
  const timed = (id: string, extra: Partial<GoogleEvent> = {}): GoogleEvent => ({
    id,
    status: "confirmed",
    start: { dateTime: "2026-11-03T14:00:00Z" },
    end: { dateTime: "2026-11-03T15:00:00Z" },
    ...extra,
  });

  it("counts ordinary events as busy", () => {
    expect(busyFromEvents([timed("dentist")], "Europe/London")).toEqual([
      { event_id: "dentist", starts_at: "2026-11-03T14:00:00.000Z", ends_at: "2026-11-03T15:00:00.000Z" },
    ]);
  });

  it("leaves out our own jobs, deleted, free, declined and working-location events", () => {
    const events = [
      timed("job", { extendedProperties: { private: { bookingId: BOOKING } } }),
      timed("gone", { status: "cancelled" }),
      timed("free", { transparency: "transparent" }),
      timed("declined", { attendees: [{ self: true, responseStatus: "declined" }] }),
      timed("office", { eventType: "workingLocation" }),
      timed("bday", { eventType: "birthday" }),
      timed("someone-else-declined", { attendees: [{ responseStatus: "declined" }, { self: true, responseStatus: "accepted" }] }),
    ];
    expect(busyFromEvents(events, "Europe/London").map((r) => r.event_id)).toEqual(["someone-else-declined"]);
  });

  it("blocks a busy all-day event from midnight to midnight in the calendar's zone", () => {
    const holiday: GoogleEvent = { id: "holiday", start: { date: "2026-07-01" }, end: { date: "2026-07-03" } };
    expect(busyFromEvents([holiday], "Europe/London")).toEqual([
      { event_id: "holiday", starts_at: "2026-06-30T23:00:00.000Z", ends_at: "2026-07-02T23:00:00.000Z" },
    ]);
  });

  it("skips events with no usable times", () => {
    expect(busyFromEvents([{ id: "odd" }, timed("back", { end: { dateTime: "2026-11-03T13:00:00Z" } })], "UTC")).toEqual([]);
  });
});

describe("changedInGoogle", () => {
  const booking = { startsAt: "2026-11-03T09:00:00.000Z", endsAt: "2026-11-03T12:00:00.000Z" };
  const ours = (start: string, end: string, status = "confirmed"): GoogleEvent => ({
    id: "bk1",
    status,
    start: { dateTime: start, timeZone: "Europe/London" },
    end: { dateTime: end },
    extendedProperties: { private: { bookingId: BOOKING } },
  });

  it("is unchanged when the times match, however Google writes them", () => {
    expect(changedInGoogle(ours("2026-11-03T09:00:00Z", "2026-11-03T12:00:00Z"), booking)).toBe(false);
    expect(changedInGoogle(ours("2026-11-03T09:00:00+00:00", "2026-11-03T12:00:00+00:00"), booking)).toBe(false);
    expect(bookingIdOf(ours("2026-11-03T09:00:00Z", "2026-11-03T12:00:00Z"))).toBe(BOOKING);
  });

  it("notices a moved, stretched, all-day or deleted event", () => {
    expect(changedInGoogle(ours("2026-11-03T10:00:00Z", "2026-11-03T13:00:00Z"), booking)).toBe(true);
    expect(changedInGoogle(ours("2026-11-03T09:00:00Z", "2026-11-03T12:30:00Z"), booking)).toBe(true);
    expect(changedInGoogle({ id: "bk1", start: { date: "2026-11-03" }, end: { date: "2026-11-04" } }, booking)).toBe(true);
    expect(changedInGoogle(ours("2026-11-03T09:00:00Z", "2026-11-03T12:00:00Z", "cancelled"), booking)).toBe(true);
  });
});
