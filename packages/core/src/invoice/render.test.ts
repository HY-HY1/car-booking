import { describe, expect, it } from "vitest";
import { invoiceHtml, invoiceNumberLabel, vatIncluded, type Invoice } from "./render";

const invoice: Invoice = {
  number: 42,
  reference: "ABC123",
  issuedAt: "2026-11-10T12:00:00Z",
  jobDate: "2026-11-09T09:00:00Z",
  timeZone: "Europe/London",
  business: { name: "Shine", legalName: null, email: "a@shine.co", phone: null, vatNumber: null },
  customer: { name: "Jo <b>Doe</b>", address: "1 High St" },
  lines: [{ label: "Full valet", amount_pence: 12000 }],
  totalPence: 12000,
  paidPence: 2000,
};

describe("invoiceNumberLabel", () => {
  it("pads the number", () => {
    expect(invoiceNumberLabel(42)).toBe("INV-000042");
  });
});

describe("vatIncluded", () => {
  it("is a sixth of a VAT-inclusive price", () => {
    expect(vatIncluded(12000)).toBe(2000);
  });
});

describe("invoiceHtml", () => {
  it("shows the number, totals and what's left", () => {
    const html = invoiceHtml(invoice);
    expect(html).toContain("INV-000042");
    expect(html).toContain("Left to pay");
    expect(html).toContain("£100");
  });

  it("escapes what came from the database", () => {
    const html = invoiceHtml(invoice);
    expect(html).toContain("Jo &lt;b&gt;Doe&lt;/b&gt;");
    expect(html).not.toContain("<b>Doe");
  });

  it("only mentions VAT for a VAT-registered business", () => {
    expect(invoiceHtml(invoice)).not.toContain("VAT");
    const html = invoiceHtml({ ...invoice, business: { ...invoice.business, vatNumber: "GB123456789" } });
    expect(html).toContain("VAT number GB123456789");
    expect(html).toContain("Of which VAT at 20%");
  });
});
