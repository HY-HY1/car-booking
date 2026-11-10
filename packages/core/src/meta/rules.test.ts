import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { leadFromFields, leadgenChanges, leadSource, questionLabel, verifyMetaSignature } from "./rules";

describe("verifyMetaSignature", () => {
  const body = '{"object":"page"}';
  const good = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
  it("accepts Meta's signature and nothing else", () => {
    expect(verifyMetaSignature("s3cret", body, good)).toBe(true);
    expect(verifyMetaSignature("other", body, good)).toBe(false);
    expect(verifyMetaSignature("s3cret", body + " ", good)).toBe(false);
    expect(verifyMetaSignature("s3cret", body, null)).toBe(false);
    expect(verifyMetaSignature("s3cret", body, "sha1=abc")).toBe(false);
  });
});

describe("leadgenChanges", () => {
  it("finds new leads and skips everything else", () => {
    expect(
      leadgenChanges({
        object: "page",
        entry: [
          {
            id: "111",
            changes: [
              { field: "leadgen", value: { leadgen_id: "999", page_id: "111", form_id: "55" } },
              { field: "feed", value: { item: "post" } },
              { field: "leadgen", value: { leadgen_id: "not a number" } },
            ],
          },
        ],
      }),
    ).toEqual([{ pageId: "111", leadgenId: "999", formId: "55" }]);
    expect(leadgenChanges({ object: "user", entry: [] })).toEqual([]);
    expect(leadgenChanges(null)).toEqual([]);
  });
});

describe("leadFromFields", () => {
  it("reads the standard questions and keeps every answer", () => {
    const lead = leadFromFields([
      { name: "full_name", values: ["Sam Price"] },
      { name: "email", values: ["Sam@Example.com "] },
      { name: "phone_number", values: ["07700 900123"] },
      { name: "post_code", values: ["gl510qx"] },
      { name: "what_car_do_you_have?", values: ["Golf"] },
    ]);
    expect(lead).toMatchObject({ name: "Sam Price", email: "sam@example.com", phone: "+447700900123", postcode: "GL51 0QX" });
    expect(lead.answers).toContainEqual({ question: "What car do you have?", answer: "Golf" });
  });

  it("copes with first and last names, bad details and nothing at all", () => {
    expect(leadFromFields([{ name: "first_name", values: ["Sam"] }, { name: "last_name", values: ["Price"] }]).name).toBe("Sam Price");
    const bad = leadFromFields([{ name: "email", values: ["nope"] }, { name: "phone_number", values: ["12"] }]);
    expect(bad).toMatchObject({ name: "Lead form enquiry", email: null, phone: null });
  });
});

describe("labels and sources", () => {
  it("names questions and platforms", () => {
    expect(questionLabel("phone_number")).toBe("Phone");
    expect(questionLabel("when_would_you_like_it_done")).toBe("When would you like it done");
    expect(leadSource("ig")).toBe("instagram_lead_form");
    expect(leadSource("fb")).toBe("facebook_lead_form");
    expect(leadSource(null)).toBe("facebook_lead_form");
  });
});
