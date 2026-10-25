import { describe, expect, it } from "vitest";
import { staffFormSchema } from "./rules";

const base = {
  name: " Sam Carter ",
  job_title: "Lead detailer",
  phone: "07700 900123",
  email: "Sam@Example.com",
  notes: "",
  resource_id: "",
  territory_id: "",
  active: "on",
};

describe("staffFormSchema", () => {
  it("tidies a full entry", () => {
    expect(staffFormSchema.parse(base)).toEqual({
      name: "Sam Carter",
      job_title: "Lead detailer",
      phone: "+447700900123",
      email: "sam@example.com",
      notes: null,
      resource_id: null,
      territory_id: null,
      active: true,
    });
  });

  it("needs only a name", () => {
    const out = staffFormSchema.parse({ ...base, job_title: "", phone: "", email: "", active: undefined });
    expect(out).toMatchObject({ phone: null, email: null, job_title: null, active: false });
  });

  it("keeps the van and territory links", () => {
    const id = "6f1d6a52-7a5c-4f43-9d0e-3f6a4b7c8d90";
    expect(staffFormSchema.parse({ ...base, resource_id: id, territory_id: "default" })).toMatchObject({
      resource_id: id,
      territory_id: "default",
    });
  });

  it("rejects bad input, naming the field", () => {
    const field = (patch: object) => {
      const r = staffFormSchema.safeParse({ ...base, ...patch });
      return r.success ? null : String(r.error.issues[0].path[0]);
    };
    expect(field({ name: "  " })).toBe("name");
    expect(field({ phone: "12" })).toBe("phone");
    expect(field({ email: "nope" })).toBe("email");
    expect(field({ resource_id: "van" })).toBe("resource_id");
  });
});
