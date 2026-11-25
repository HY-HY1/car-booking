import { describe, expect, it } from "vitest";
import { MAX_PINNED, MAX_TESTIMONIAL_PHOTOS, parseTestimonialForm, reviewSettingsSchema, testimonialImages, togglePinned } from "./reviews";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = "https://x.supabase.co/a.webp";
const B = "https://x.supabase.co/b.webp";

describe("reviews on the booking page", () => {
  it("reads nothing stored as automatic Google reviews and no testimonials", () => {
    expect(reviewSettingsSchema.parse(undefined)).toEqual({ show: true, pinned: [], testimonials: [] });
  });

  it("drops a broken testimonial or photo rather than all of them", () => {
    const parsed = reviewSettingsSchema.parse({
      show: false,
      pinned: [id(1)],
      testimonials: [
        { name: "Sarah", text: "Brilliant job.", source: "text", avatar_url: A, photos: [{ url: B, label: "After" }, { url: "nope" }] },
        { name: "", text: "x" },
        { name: "Tom", text: "Spotless", source: "pigeon", avatar_url: "not a url" },
      ],
    });
    expect(parsed).toEqual({
      show: false,
      pinned: [id(1)],
      testimonials: [
        { name: "Sarah", text: "Brilliant job.", source: "text", avatar_url: A, photos: [{ url: B, label: "After" }] },
        { name: "Tom", text: "Spotless", photos: [] },
      ],
    });
  });

  it("lists every image the testimonials use", () => {
    expect(testimonialImages([{ name: "S", text: "t", avatar_url: A, photos: [{ url: B }] }, { name: "T", text: "t", photos: [] }])).toEqual([A, B]);
  });

  it("picks and unpicks Google reviews, refusing past the limit", () => {
    expect(togglePinned([id(1)], id(2), true)).toEqual([id(1), id(2)]);
    expect(togglePinned([id(1), id(2)], id(1), false)).toEqual([id(2)]);
    expect(togglePinned([id(1)], id(1), true)).toEqual([id(1)]);
    const full = Array.from({ length: MAX_PINNED }, (_, i) => id(i));
    expect(togglePinned(full, id(99), true)).toBeNull();
  });
});

describe("testimonials form", () => {
  it("keeps ticked rows in order, skipping blank ones", () => {
    expect(
      parseTestimonialForm({
        rows: ["a", "b", "c"],
        names: [" Sarah,  Cheltenham ", "", "Tom"],
        texts: ["Car looks brand new!\r\n\r\n\r\nThank you", "", "Great"],
        sources: ["text", "", "nonsense"],
        genuine: ["a", "c"],
      }),
    ).toEqual({
      testimonials: [
        { name: "Sarah, Cheltenham", text: "Car looks brand new!\n\nThank you", source: "text", avatar: null, photos: [] },
        { name: "Tom", text: "Great", avatar: null, photos: [] },
      ],
    });
  });

  it("keeps saved and new images with labels, ignoring ones from elsewhere", () => {
    const parsed = parseTestimonialForm(
      {
        rows: ["a"],
        names: ["Sarah"],
        texts: ["Lovely"],
        sources: [""],
        genuine: ["a"],
        avatars: ["new:k1"],
        photos: [{ refs: [`saved:${A}`, "saved:https://evil.example/x.png", "new:k2"], labels: ["  Before ", "x", "After"] }],
      },
      new Set([A]),
    );
    expect(parsed.testimonials?.[0]).toEqual({
      name: "Sarah",
      text: "Lovely",
      avatar: { kind: "new", key: "k1" },
      photos: [
        { image: { kind: "saved", url: A }, label: "Before" },
        { image: { kind: "new", key: "k2" }, label: "After" },
      ],
    });
  });

  it("won't save one that isn't confirmed as genuine, half filled, or with too many photos", () => {
    const parsed = parseTestimonialForm({ rows: ["a", "b"], names: ["Sarah", ""], texts: ["Lovely", "No name"], sources: [], genuine: ["b"] });
    expect(parsed.errors).toEqual({
      genuine_0: "Tick to confirm it's a real customer's own words.",
      name_1: "Add who said it, like Sarah, Cheltenham.",
    });
    const many = Array.from({ length: MAX_TESTIMONIAL_PHOTOS + 1 }, (_, i) => `new:p${i}`);
    const tooMany = parseTestimonialForm({ rows: ["a"], names: ["S"], texts: ["T"], sources: [], genuine: ["a"], photos: [{ refs: many, labels: [] }] });
    expect(tooMany.errors?.photos_0).toBeDefined();
  });
});
