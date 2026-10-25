import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOCS_PAGES, docsPath } from "./docs-nav";

describe("docsPath", () => {
  it("maps a /docs path to the page it shows", () => {
    expect(docsPath("/docs")).toBe("/");
    expect(docsPath("/docs/api/keys")).toBe("/api/keys");
    expect(docsPath("/api/keys")).toBe("/api/keys");
    expect(docsPath("/")).toBe("/");
    expect(docsPath("/docsy")).toBe("/docsy");
  });

  it("lists every page once, and each one exists", () => {
    const hrefs = DOCS_PAGES.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      expect(existsSync(path.join(__dirname, "../app/(marketing)/docs", href, "page.tsx")), href).toBe(true);
    }
  });
});
