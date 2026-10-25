import { describe, expect, it } from "vitest";
import { assistantOf } from "./assistant";
import { dnsRecords, hasSubdomain, customHostnameSchema } from "./domains";
import {
  askingFormSchema,
  assistantFormSchema,
  depositFormSchema,
  generalFormSchema,
  parseNotificationsForm,
  parsePolicyForm,
  parseRefundForm,
  privacyExtrasFormSchema,
} from "./forms";
import { notificationsOf, renderTemplate, unknownFields } from "./notifications";
import { DEFAULT_POLICY, policyLines, policyOf, refundAdvice, type CancellationPolicy } from "./policy";
import { questionsOf } from "./questions";

const START = "2026-11-10T10:00:00Z";
const hoursBefore = (h: number) => new Date(new Date(START).getTime() - h * 3_600_000);

describe("cancellation policy", () => {
  it("reads {} as no policy", () => {
    expect(policyOf({})).toBeNull();
    expect(policyOf(DEFAULT_POLICY)).toEqual(DEFAULT_POLICY);
  });

  it("refunds in full before the cut-off and keeps the deposit after", () => {
    expect(refundAdvice(DEFAULT_POLICY, { startsAt: START, depositPaidPence: 2000 }, hoursBefore(48))).toMatchObject({
      kind: "full",
      refundPence: 2000,
    });
    expect(refundAdvice(DEFAULT_POLICY, { startsAt: START, depositPaidPence: 2000 }, hoursBefore(2))).toMatchObject({
      kind: "none",
      refundPence: 0,
    });
  });

  it("keeps only the late fee", () => {
    const policy: CancellationPolicy = { ...DEFAULT_POLICY, late_fee: { type: "fixed", value_pence: 500 } };
    expect(refundAdvice(policy, { startsAt: START, depositPaidPence: 2000 }, hoursBefore(1))).toMatchObject({
      kind: "partial",
      refundPence: 1500,
    });
    // A fee bigger than the deposit keeps all of it.
    expect(refundAdvice({ ...policy, late_fee: { type: "fixed", value_pence: 5000 } }, { startsAt: START, depositPaidPence: 2000 }, hoursBefore(1))).toMatchObject({
      kind: "none",
      refundPence: 0,
    });
  });

  it("gives no advice without a policy or a paid deposit", () => {
    expect(refundAdvice(null, { startsAt: START, depositPaidPence: 2000 })).toBeNull();
    expect(refundAdvice(DEFAULT_POLICY, { startsAt: START, depositPaidPence: 0 })).toBeNull();
  });

  it("describes itself to customers", () => {
    expect(policyLines(DEFAULT_POLICY, true)).toEqual([
      "You can cancel or change your booking up to 24 hours before the appointment.",
      "Cancel in time and your deposit is refunded in full.",
      "Cancel later than that, or miss the appointment, and the deposit is kept.",
    ]);
    expect(policyLines({ ...DEFAULT_POLICY, cutoff_hours: 48, reschedule_cutoff_hours: 24 }, false)).toEqual([
      "You can cancel up to 2 days before the appointment, and change the time up to 24 hours before.",
    ]);
  });

  it("keeps the refund rules when the cut-offs are saved, and the reverse", () => {
    const current: CancellationPolicy = { ...DEFAULT_POLICY, late_fee: { type: "none" } };
    const cut = parsePolicyForm({ policy_enabled: "on", cutoff_hours: "48", reschedule_cutoff_hours: "12", note: "" }, current);
    expect(cut.success && cut.data).toEqual({ ...current, cutoff_hours: 48, reschedule_cutoff_hours: 12, note: undefined });

    const off = parsePolicyForm({ cutoff_hours: "48", reschedule_cutoff_hours: "12", note: "" }, current);
    expect(off.success && off.data).toEqual({});

    const refund = parseRefundForm({ refund_before_cutoff: "full", late_fee_type: "fixed", late_fee_amount: "£7.50" }, DEFAULT_POLICY);
    expect(refund.success && refund.data).toEqual({ ...DEFAULT_POLICY, late_fee: { type: "fixed", value_pence: 750 } });

    const missing = parseRefundForm({ refund_before_cutoff: "full", late_fee_type: "fixed", late_fee_amount: "" }, DEFAULT_POLICY);
    expect(missing.success).toBe(false);
  });
});

describe("questions", () => {
  it("asks everything not switched off", () => {
    const q = questionsOf({ heard_from: false, nonsense: true });
    expect(q.heard_from).toBe(false);
    expect(q.registration).toBe(true);
    expect(questionsOf("garbage").notes).toBe(true);
  });

  it("reads the form's checkboxes", () => {
    const parsed = askingFormSchema.safeParse({ approval_mode: "manual", min_photos: "2", photos_required: "on", q_notes: "on" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({ approval_mode: "manual", min_photos: 2, photos_required: true });
    expect(parsed.data.questions.notes).toBe(true);
    expect(parsed.data.questions.registration).toBe(false);
  });
});

describe("general form", () => {
  it("normalises phone and VAT", () => {
    const parsed = generalFormSchema.safeParse({
      name: " Shine ",
      contact_email: "Hello@Shine.co.uk",
      contact_phone: "07700 900123",
      trade: "valeting",
      timezone: "Europe/London",
      vat_registered: "on",
      vat_number: "123 4567 89",
    });
    expect(parsed.success && parsed.data).toEqual({
      tenant: { name: "Shine", contact_email: "hello@shine.co.uk", contact_phone: "+447700900123", trade: "valeting", vat_number: "GB123456789" },
      timezone: "Europe/London",
    });
  });

  it("drops the VAT number when not registered and rejects a bad one", () => {
    const base = { name: "Shine", contact_email: "", contact_phone: "", trade: "detailing", timezone: "Europe/London" };
    const off = generalFormSchema.safeParse({ ...base, vat_number: "GB123456789" });
    expect(off.success && off.data.tenant.vat_number).toBeNull();
    const bad = generalFormSchema.safeParse({ ...base, vat_registered: "on", vat_number: "12" });
    expect(bad.success).toBe(false);
  });
});

describe("deposit form", () => {
  it("accepts the full price", () => {
    expect(depositFormSchema.parse({ deposit_type: "full", deposit_fixed: "" })).toEqual({ type: "full" });
    expect(depositFormSchema.parse({ deposit_type: "fixed", deposit_fixed: "20" })).toEqual({ type: "fixed", value_pence: 2000 });
    expect(depositFormSchema.safeParse({ deposit_type: "percent", deposit_percent: "0", deposit_fixed: "" }).success).toBe(false);
  });
});

describe("notifications", () => {
  it("fills in defaults for missing settings", () => {
    const n = notificationsOf({ messages: { reminder: { hours_before: 48 } } });
    expect(n.messages.reminder.hours_before).toBe(48);
    expect(n.messages.reminder.enabled).toBe(true);
    expect(n.messages.review_request.enabled).toBe(false);
    expect(n.channels).toEqual({ email: true, sms: false });
    expect(notificationsOf(null).alerts.new_booking).toBe(true);
  });

  it("renders templates and spots unknown fields", () => {
    expect(renderTemplate("Hi {customer_name}, see you {date}{oops}", { customer_name: "Sam", date: "Friday" })).toBe(
      "Hi Sam, see you Friday",
    );
    expect(unknownFields("{customer_name} {custmer_name}")).toEqual(["custmer_name"]);
  });

  const form = () => {
    const input: Record<string, string> = {
      channel_email: "on",
      sender_name: "",
      reply_to: "",
      reminder_hours_before: "24",
      follow_up_days_after: "3",
      review_request_days_after: "1",
      review_url: "",
      alerts_new_booking: "on",
      alerts_email: "",
    };
    for (const k of ["confirmation", "reminder", "follow_up", "review_request"]) {
      input[`${k}_enabled`] = "on";
      input[`${k}_subject`] = "Hi {customer_name}";
      input[`${k}_body`] = "See you on {date}.";
    }
    return input;
  };

  it("needs a review link to send review requests", () => {
    const result = parseNotificationsForm(form());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["review_url"]);
  });

  it("saves a full set and rejects unknown fields", () => {
    const ok = parseNotificationsForm({ ...form(), review_url: "g.page/r/abc/review" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.messages.review_request.review_url).toBe("https://g.page/r/abc/review");
      expect(ok.data.alerts).toMatchObject({ new_lead: false, new_booking: true });
    }
    const bad = parseNotificationsForm({ ...form(), review_url: "https://x.co", reminder_body: "On {when}" });
    expect(bad.success).toBe(false);
  });
});

describe("assistant", () => {
  it("defaults to off, quoting", () => {
    expect(assistantOf({})).toMatchObject({ enabled: false, mode: "quote", max_quote_pence: null });
  });

  it("parses the form", () => {
    const parsed = assistantFormSchema.parse({
      enabled: "on",
      mode: "book",
      tone: "professional",
      sign_off: "",
      follow_up_enabled: "on",
      first_after_hours: "2",
      gap_days: "1",
      max_attempts: "2",
      handoff_over_price: "300",
      handoff_keywords: "Complaint, lease return,complaint",
      max_quote: "",
    });
    expect(parsed.handoff).toEqual({ over_price_pence: 30000, low_confidence: false, asks_for_human: true, keywords: ["complaint", "lease return"] });
    expect(parsed.max_quote_pence).toBeNull();
    expect(assistantOf(parsed)).toEqual(parsed);
  });
});

describe("privacy extras", () => {
  it("allows blanks", () => {
    expect(privacyExtrasFormSchema.parse({ privacy_policy_url: "", marketing_consent_text: "", photo_retention_days: "" })).toEqual({
      privacy_policy_url: null,
      marketing_consent_text: null,
      photo_retention_days: null,
    });
    expect(privacyExtrasFormSchema.safeParse({ privacy_policy_url: "", marketing_consent_text: "", photo_retention_days: "3" }).success).toBe(false);
  });
});

describe("custom domains", () => {
  it("needs a subdomain of someone else's domain", () => {
    const schema = customHostnameSchema("ascnd.app");
    expect(schema.parse(" Book.Shine.co.uk ")).toBe("book.shine.co.uk");
    expect(schema.safeParse("shine.co.uk").success).toBe(false);
    expect(schema.safeParse("shine.ascnd.app").success).toBe(false);
    expect(hasSubdomain("book.shine.com")).toBe(true);
    expect(hasSubdomain("shine.com")).toBe(false);
  });

  it("lists the records with and without the domain", () => {
    const [cname, txt] = dnsRecords("book.shine.co.uk", "abc");
    expect(cname).toMatchObject({ type: "CNAME", host: "book", fullName: "book.shine.co.uk" });
    expect(txt).toMatchObject({ type: "TXT", host: "_booking-verify.book", value: "abc" });
  });
});
