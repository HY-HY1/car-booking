import { describe, expect, it } from "vitest";
import { canEditBooking, editBookingFormSchema, editedPostcode, extraCarFormSchema, extraCarLabel, repeatDates } from "./edit-rules";

const id = "11111111-1111-4111-8111-111111111111";
const form = {
  service_id: id,
  size_class: "medium",
  add_on_ids: "",
  address_line: " 1 High St ",
  postcode: "BS1 4DJ",
  resource_id: id,
  staff_id: "",
  price: "£45.50",
  duration_mins: "90",
};

describe("canEditBooking", () => {
  it("allows live bookings only", () => {
    expect(canEditBooking("confirmed")).toBe(true);
    expect(canEditBooking("requested")).toBe(true);
    for (const s of ["held", "cancelled", "completed", "no_show", "expired"]) expect(canEditBooking(s)).toBe(false);
  });
});

describe("editBookingFormSchema", () => {
  it("keeps the typed price and length", () => {
    expect(editBookingFormSchema.parse(form)).toMatchObject({ pricePence: 4550, durationMins: 90, staffId: null, addressLine: "1 High St" });
  });

  it("uses the price list when asked to recalculate", () => {
    expect(editBookingFormSchema.parse({ ...form, recalculate: "on" })).toMatchObject({ pricePence: null, durationMins: null });
  });

  it("refuses a bad price or length", () => {
    expect(editBookingFormSchema.safeParse({ ...form, price: "free" }).success).toBe(false);
    expect(editBookingFormSchema.safeParse({ ...form, duration_mins: "5" }).success).toBe(false);
  });
});

describe("editedPostcode", () => {
  it("cleans up a mobile job's postcode", () => {
    expect(editedPostcode("mobile", "bs14dj", "X")).toBe("BS1 4DJ");
  });

  it("refuses a postcode that isn't one", () => {
    expect(editedPostcode("mobile", "nope", "X")).toBeNull();
  });

  it("leaves a job at the unit alone", () => {
    expect(editedPostcode("unit", "", "BS2 0AA")).toBe("BS2 0AA");
  });
});

describe("extraCarFormSchema", () => {
  const car = { make: "Ford", model: "Focus", registration: "ab12 cde", size_class: "", price: "30", extra_mins: "45" };

  it("reads a car", () => {
    expect(extraCarFormSchema.parse(car)).toMatchObject({ registration: "AB12CDE", size_class: null, price: 3000, extra_mins: 45 });
  });

  it("needs something to say which car", () => {
    expect(extraCarFormSchema.safeParse({ ...car, make: "", model: "", registration: "" }).success).toBe(false);
  });

  it("names the car on the bill", () => {
    expect(extraCarLabel({ make: "Ford", model: "Focus", registration: null })).toBe("Extra car: Ford Focus");
    expect(extraCarLabel({ make: null, model: null, registration: "AB12CDE" })).toBe("Extra car: AB12CDE");
  });
});

describe("repeatDates", () => {
  it("gives the dates after the first", () => {
    expect(repeatDates("2026-11-10", 4, 3)).toEqual(["2026-12-08", "2027-01-05"]);
  });

  it("gives none for a single booking", () => {
    expect(repeatDates("2026-11-10", 4, 1)).toEqual([]);
  });
});
