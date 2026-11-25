import { describe, expect, it } from "vitest";
import { jsonLdText, localBusinessJsonLd } from "./local-business";

describe("local business for search engines", () => {
  it("describes what the business has set, leaving the rest out", () => {
    const data = localBusinessJsonLd({
      name: "ASCND",
      url: "https://ascnd.example/",
      description: " Mobile detailing ",
      telephone: "+447700900123",
      address: { street: "Unit 4, Test Estate", postcode: "M1 1AE" },
      areaServed: ["Cheltenham", "Gloucester"],
      hours: { mon: [["09:00", "17:00"]], sat: [["08:00", "12:00"], ["13:00", "16:00"]] },
      prices: [4500, 29500, 6000],
      website: "https://ascnd.co.uk",
    });
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "AutoWash",
      name: "ASCND",
      url: "https://ascnd.example/",
      description: "Mobile detailing",
      telephone: "+447700900123",
      priceRange: "£45 – £295",
      currenciesAccepted: "GBP",
      address: { "@type": "PostalAddress", streetAddress: "Unit 4, Test Estate", postalCode: "M1 1AE", addressCountry: "GB" },
      areaServed: [
        { "@type": "Place", name: "Cheltenham" },
        { "@type": "Place", name: "Gloucester" },
      ],
      openingHoursSpecification: [
        { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "09:00", closes: "17:00" },
        { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Saturday", opens: "08:00", closes: "12:00" },
        { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Saturday", opens: "13:00", closes: "16:00" },
      ],
      sameAs: ["https://ascnd.co.uk"],
    });
  });

  it("keeps a bare business bare, and escapes text that could end the script", () => {
    expect(localBusinessJsonLd({ name: "Shine", url: "https://x/", prices: [2050] })).toEqual({
      "@context": "https://schema.org",
      "@type": "AutoWash",
      name: "Shine",
      url: "https://x/",
      priceRange: "From £20.50",
      currenciesAccepted: "GBP",
    });
    expect(jsonLdText({ name: "</script><script>alert(1)" })).not.toContain("</script>");
  });
});
