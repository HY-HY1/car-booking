import { afterEach, describe, expect, it, vi } from "vitest";
import { createLeadSchema } from "./api/query";
import { manageLinkExpired, signConfirmedKey, verifyConfirmedKey } from "./booking/manage-rules";
import { refuseUnlessCron } from "./cron-auth";
import { addressHasLink, looksLikeLink } from "./customer-fields";
import { firstName, textToHtml, unlinked } from "./email/compose";
import { signOptInToken, signUnsubscribeToken, verifyOptInToken, verifyUnsubscribeToken } from "./privacy/rules";
import { isHuman } from "./turnstile";

// The fixes from the 17 Nov 2026 audit that can be checked without a database.

describe("names with links in them (H1)", () => {
  it.each([
    "https://evil.example/pay-now Smith",
    "http://x.co",
    "www.evil.com",
    "evil.com Smith",
    "pay.me",
    "sam@evil.com",
    "Sam evil.co.uk",
  ])("spots %j", (name) => expect(looksLikeLink(name)).toBe(true));

  it.each(["Sam Smith", "Mary-Jane O'Neill", "J. R. Hartley", "Dr. Jones", "Zoë St John", "McDonald"])("lets %j through", (name) =>
    expect(looksLikeLink(name)).toBe(false),
  );

  it("addresses only refuse the unmistakable parts", () => {
    expect(addressHasLink("12 St.Ives Road, TR26 1AB")).toBe(false);
    expect(addressHasLink("12 High St www.evil.com")).toBe(true);
    expect(addressHasLink("https://evil.example")).toBe(true);
  });

  it("an old name with a link greets them as 'there', and never becomes a link", () => {
    expect(firstName("https://evil.example/pay-now Smith")).toBe("there");
    expect(firstName("Sam Smith")).toBe("Sam");
    expect(textToHtml(`Hi ${firstName("https://evil.example/pay-now Smith")},`)).not.toContain("<a ");
  });

  it("customer-typed text with an address can't be turned into a link", () => {
    const html = textToHtml(`At ${unlinked("1 Road https://evil.example/x")}`);
    expect(html).not.toContain("<a ");
    expect(unlinked("1 High Street, BS1 4DJ")).toBe("1 High Street, BS1 4DJ");
  });

  it("the API refuses a lead whose name is a link", () => {
    expect(createLeadSchema.safeParse({ name: "https://evil.example", email: "a@b.co" }).success).toBe(false);
    expect(createLeadSchema.safeParse({ name: "Sam", email: "a@b.co" }).success).toBe(true);
  });
});

describe("marketing opt-in links (M2)", () => {
  const id = "11111111-2222-4333-8444-555555555555";

  it("round-trips, and can't be swapped for an unsubscribe token or another customer", async () => {
    const token = await signOptInToken("secret", id);
    expect(await verifyOptInToken("secret", token)).toEqual({ customerId: id });
    expect(await verifyOptInToken("other", token)).toBeNull();
    expect(await verifyOptInToken("secret", token.replace(id, "11111111-2222-4333-8444-666666666666"))).toBeNull();
    expect(await verifyUnsubscribeToken("secret", token)).toBeNull();
    expect(await verifyOptInToken("secret", await signUnsubscribeToken("secret", id, "email"))).toBeNull();
  });
});

describe("confirmation page key and link expiry (L9)", () => {
  const tenant = "t1";
  const booking = "11111111-2222-4333-8444-555555555555";

  it("only the key for this booking and business works", async () => {
    const key = await signConfirmedKey("secret", tenant, booking);
    expect(await verifyConfirmedKey("secret", tenant, booking, key)).toBe(true);
    expect(await verifyConfirmedKey("secret", "t2", booking, key)).toBe(false);
    expect(await verifyConfirmedKey("secret", tenant, booking, "")).toBe(false);
  });

  it("manage links stop 90 days after the booking ends", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    expect(manageLinkExpired("2026-05-01T12:00:00Z", now)).toBe(false);
    expect(manageLinkExpired("2026-02-01T12:00:00Z", now)).toBe(true);
  });
});

describe("scheduled jobs' secret (L11)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const call = (auth?: string) => new Request("https://x/api/jobs/emails", { headers: auth ? { authorization: auth } : {} });

  it("refuses without the secret, and answers 404 when none is set", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(refuseUnlessCron(call())?.status).toBe(401);
    expect(refuseUnlessCron(call("Bearer wrong"))?.status).toBe(401);
    expect(refuseUnlessCron(call("Bearer s3cret"))).toBeNull();
    vi.stubEnv("CRON_SECRET", "");
    expect(refuseUnlessCron(call("Bearer "))?.status).toBe(404);
  });
});

describe("bot check (H1)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is off without a secret", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(await isHuman(undefined)).toBe(true);
  });

  it("with a secret, needs a token Cloudflare accepts", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await isHuman(null)).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: false, "error-codes": ["invalid-input-response"] })));
    expect(await isHuman("bad")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true })));
    expect(await isHuman("good")).toBe(true);
  });
});
