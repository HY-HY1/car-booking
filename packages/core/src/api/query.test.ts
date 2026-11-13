import { describe, expect, it } from "vitest";
import { createLeadSchema, decodeCursor, encodeCursor, parseBookingList, parseCustomerList, parseJob, parseLeadList } from "./query";
import { bookingResource, customerResource, leadResource } from "./resources";
import { cleanScopes } from "./scopes";

const q = (s: string) => new URLSearchParams(s);
const ID = "6d1f0c2a-7b9e-4e1a-9c3d-2f8b5a4e7d10";

describe("cursors", () => {
  it("round-trip the database's own timestamp, microseconds and all", () => {
    const cursor = { after: "2026-11-12T09:41:05.120123+00:00", id: ID };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("refuse anything that isn't one", () => {
    expect(decodeCursor("nonsense")).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify(["not a date", ID])).toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify(["2026-11-12T09:00:00Z", "not-a-uuid"])).toString("base64url"))).toBeNull();
  });
});

describe("list queries", () => {
  it("default to 25 and no filters", () => {
    expect(parseBookingList(q(""), "Europe/London")).toEqual({ ok: true, value: { limit: 25, cursor: null } });
  });

  it("read statuses, dates in the business's time zone, and date-times", () => {
    const r = parseBookingList(q("status=confirmed, completed&from=2026-07-01&to=2026-07-02T12:00:00Z&limit=100"), "Europe/London");
    expect(r).toEqual({
      ok: true,
      value: {
        status: ["confirmed", "completed"],
        // Midnight in London in summer is 23:00 UTC the day before.
        from: "2026-06-30T23:00:00.000Z",
        to: "2026-07-02T12:00:00.000Z",
        limit: 100,
        cursor: null,
      },
    });
  });

  it("name the parameter that's wrong", () => {
    expect(parseBookingList(q("status=held"), "Europe/London")).toMatchObject({ ok: false, param: "status" });
    expect(parseBookingList(q("limit=0"), "Europe/London")).toMatchObject({ ok: false, param: "limit" });
    expect(parseBookingList(q("limit=101"), "Europe/London")).toMatchObject({ ok: false, param: "limit" });
    expect(parseBookingList(q("from=yesterday"), "Europe/London")).toMatchObject({ ok: false, param: "from" });
    expect(parseBookingList(q("cursor=abc"), "Europe/London")).toMatchObject({ ok: false, param: "cursor" });
    expect(parseLeadList(q("updatedSince=2026-11-01"), "Europe/London")).toMatchObject({ ok: false, param: "updatedSince" });
    expect(parseLeadList(q("customerId=1"), "Europe/London")).toMatchObject({ ok: false, param: "customerId" });
  });

  it("tidy customer lookups the way they're stored", () => {
    expect(parseCustomerList(q("email=Sam@Example.com&phone=07700 900123"), "Europe/London")).toMatchObject({
      ok: true,
      value: { email: "sam@example.com", phone: "+447700900123" },
    });
    expect(parseCustomerList(q("phone=12"), "Europe/London")).toMatchObject({ ok: false, param: "phone" });
  });
});

describe("job queries", () => {
  const base = `serviceId=${ID}&sizeClass=large&locationType=mobile`;

  it("read a job, with extras and a tidied postcode", () => {
    expect(parseJob(q(`${base}&addOnIds=${ID},${ID}&postcode=bs78qa`))).toEqual({
      ok: true,
      value: { serviceId: ID, sizeClass: "large", locationType: "mobile", addOnIds: [ID], postcode: "BS7 8QA" },
    });
  });

  it("say which part is missing or wrong", () => {
    expect(parseJob(q("sizeClass=large&locationType=mobile"))).toMatchObject({ ok: false, param: "serviceId" });
    expect(parseJob(q(`serviceId=${ID}&sizeClass=huge&locationType=mobile`))).toMatchObject({ ok: false, param: "sizeClass" });
    expect(parseJob(q(`serviceId=${ID}&sizeClass=large`))).toMatchObject({ ok: false, param: "locationType" });
    expect(parseJob(q(`${base}&addOnIds=x`))).toMatchObject({ ok: false, param: "addOnIds" });
    expect(parseJob(q(`${base}&postcode=nope`))).toMatchObject({ ok: false, param: "postcode" });
  });
});

describe("new enquiries", () => {
  it("need a name and an email or phone", () => {
    expect(createLeadSchema.safeParse({ name: "Sam" }).success).toBe(false);
    expect(createLeadSchema.safeParse({ email: "sam@example.com" }).success).toBe(false);
    const ok = createLeadSchema.safeParse({ name: " Sam ", email: "SAM@example.com", phone: "07700 900123" });
    expect(ok.success && ok.data).toMatchObject({ name: "Sam", email: "sam@example.com", phone: "+447700900123" });
  });

  it("cap the answers", () => {
    const answers = Array.from({ length: 31 }, () => ({ question: "Q", answer: "A" }));
    expect(createLeadSchema.safeParse({ name: "Sam", phone: "07700900123", answers }).success).toBe(false);
  });
});

describe("scopes", () => {
  it("keep known ones in order and never come back empty", () => {
    expect(cleanScopes(["leads:write", "nope", "catalog:read"])).toEqual(["catalog:read", "leads:write"]);
    expect(cleanScopes([])).toEqual(["catalog:read"]);
  });
});

describe("resources", () => {
  it("turn a booking row into the public shape", () => {
    const b = bookingResource({
      id: ID,
      status: "confirmed",
      starts_at: "2026-11-20T09:00:00+00:00",
      ends_at: "2026-11-20T12:00:00+00:00",
      created_at: "2026-11-12T09:41:05.120123+00:00",
      updated_at: "2026-11-12T09:41:05.120123+00:00",
      location_type: "mobile",
      address_line: "1 High St",
      postcode: "BS1 4DJ",
      customer_notes: null,
      price_pence: 12000,
      deposit_pence: 3000,
      deposit_status: "paid",
      source: "booking_page",
      quote_snapshot: { lines: [{ label: "Full valet", amount_pence: 12000 }], needs_inspection: true },
      service: null,
      customer: null,
      vehicle: { make: "VW", model: "Golf", registration: null, size_class: "medium" },
      resource: { id: ID, name: "Van 1" },
      staff: null,
    });
    expect(b).toMatchObject({
      reference: "6D1F0C2A",
      startsAt: "2026-11-20T09:00:00.000Z",
      lines: [{ label: "Full valet", amountPence: 12000 }],
      price: { totalPence: 12000, depositPence: 3000, depositStatus: "paid" },
      vehicle: { sizeClass: "medium" },
      vanOrBay: { id: ID, name: "Van 1" },
      needsInspection: true,
    });
  });

  it("only show the caller's own external ids on leads", () => {
    const row = {
      id: ID,
      status: "new",
      source: "website",
      created_at: "2026-11-12T09:00:00+00:00",
      updated_at: "2026-11-12T09:00:00+00:00",
      quote_snapshot: null,
      form_answers: { form: "Contact", answers: [{ question: "Message", answer: "Hi" }] },
      customer: null,
    };
    expect(leadResource({ ...row, external_id: "api:abc" }).externalId).toBe("abc");
    expect(leadResource({ ...row, external_id: "meta:123" }).externalId).toBeNull();
    expect(leadResource({ ...row, external_id: null }).form).toEqual({ name: "Contact", answers: [{ question: "Message", answer: "Hi" }] });
  });

  it("list a customer's vehicles oldest first", () => {
    const c = customerResource({
      id: ID,
      name: "Sam",
      email: null,
      phone: "+447700900123",
      address_line: null,
      postcode: null,
      source: "website",
      email_marketing: false,
      sms_marketing: false,
      whatsapp_marketing: false,
      created_at: "2026-11-12T09:00:00+00:00",
      updated_at: "2026-11-12T09:00:00+00:00",
      vehicles: [
        { id: "b", make: null, model: null, registration: null, size_class: "large", created_at: "2026-11-02T00:00:00+00:00" },
        { id: "a", make: null, model: null, registration: null, size_class: "small", created_at: "2026-11-01T00:00:00+00:00" },
      ],
    });
    expect(c.vehicles.map((v) => v.id)).toEqual(["a", "b"]);
  });
});
