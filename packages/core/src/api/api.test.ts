import { describe, expect, it } from "vitest";
import { buildCatalog } from "./catalog";
import { generateApiKey, hashApiKey, keyFromAuthHeader, looksLikeApiKey } from "./key-format";

describe("API keys", () => {
  it("makes unique, well-formed keys with a short visible prefix", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(looksLikeApiKey(a.key)).toBe(true);
    expect(a.prefix).toBe(a.key.slice(0, 12));
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reads the key from a Bearer header and nothing else", () => {
    const { key } = generateApiKey();
    expect(keyFromAuthHeader(`Bearer ${key}`)).toBe(key);
    expect(keyFromAuthHeader(`bearer ${key}`)).toBe(key);
    expect(keyFromAuthHeader(key)).toBeNull();
    expect(keyFromAuthHeader("Bearer ascnd_short")).toBeNull();
    expect(keyFromAuthHeader("Basic abc")).toBeNull();
    expect(keyFromAuthHeader(null)).toBeNull();
  });
});

describe("buildCatalog", () => {
  const service = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Full valet",
    description: null,
    duration_mins: 180,
    base_price_pence: 8500,
    size_adjustments: { large: { price_pence: 2000, extra_mins: 30 } },
    location_types: ["mobile" as const],
    slug: "full-valet",
    image_path: "t/s/hero.jpg",
    gallery: ["t/s/1.jpg"],
  };
  const addOn = {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Pet hair",
    description: null,
    price_pence: 1550,
    duration_mins: 20,
    service_ids: null,
  };

  it("turns services and add-ons into the public shape", () => {
    const c = buildCatalog({
      businessName: "ASCND",
      bookingUrl: "https://book.example.com",
      imageUrl: (p) => `https://img/${p}`,
      services: [service],
      addOns: [addOn],
    });
    const s = c.services[0];
    expect(c.version).toBe(1);
    expect(s.price).toEqual({
      fromPence: 8500,
      from: "£85",
      bySize: [{ size: "large", label: expect.any(String), extraPence: 2000, extraMins: 30 }],
    });
    expect(s.image).toBe("https://img/t/s/hero.jpg");
    expect(s.gallery).toEqual(["https://img/t/s/1.jpg"]);
    expect(s.pageUrl).toBe("https://book.example.com/services/full-valet");
    expect(s.bookUrl).toBe(`https://book.example.com/quote?service=${service.id}`);
    expect(s.includes).toEqual([]);
    expect(c.addOns[0]).toMatchObject({ price: "£15.50", serviceIds: null });
  });

  it("leaves links out until the business has a booking address", () => {
    const c = buildCatalog({ businessName: "X", bookingUrl: null, imageUrl: (p) => p, services: [service], addOns: [] });
    expect(c.services[0].pageUrl).toBeNull();
    expect(c.services[0].bookUrl).toBeNull();
  });
});
