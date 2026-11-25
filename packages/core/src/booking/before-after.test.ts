import { describe, expect, it } from "vitest";
import { MAX_PAIRS, beforeAfterSchema, pairPaths, parseBeforeAfterForm } from "./before-after";

describe("before and after photos", () => {
  it("drops a broken pair rather than the service", () => {
    expect(beforeAfterSchema.parse([{ before: "t/s/a.webp", after: "t/s/b.webp", caption: " Pet hair " }, { before: "x" }, "junk"])).toEqual([
      { before: "t/s/a.webp", after: "t/s/b.webp", caption: "Pet hair" },
    ]);
    expect(beforeAfterSchema.parse(undefined)).toEqual([]);
  });

  it("keeps the form's pairs in order, saved photos only if the service has them", () => {
    const fields: Record<string, string> = {
      before_r1: "saved:t/s/a.webp",
      after_r1: "new:k1",
      caption_r1: "  Golf,   heavy pet hair ",
      before_r2: "saved:https://evil.example/x.png",
      after_r2: "",
      before_r3: "",
      after_r3: "",
    };
    const parsed = parseBeforeAfterForm(["r1", "r3"], (n) => fields[n] ?? "", new Set(["t/s/a.webp"]));
    expect(parsed).toEqual({
      pairs: [{ before: { kind: "saved", path: "t/s/a.webp" }, after: { kind: "new", key: "k1" }, caption: "Golf, heavy pet hair" }],
    });
  });

  it("flags a pair missing one of its photos", () => {
    const parsed = parseBeforeAfterForm(["r1"], (n) => (n === "before_r1" ? "new:k1" : ""), new Set());
    expect(parsed.errors).toEqual({ pair_0: "Add an after photo, or remove this pair." });
  });

  it("refuses more than the limit, and lists every photo used", () => {
    const rows = Array.from({ length: MAX_PAIRS + 1 }, (_, i) => `r${i}`);
    expect(parseBeforeAfterForm(rows, (n) => `new:${n.replace("_", "-")}`, new Set()).errors?.pairs).toBeDefined();
    expect(pairPaths([{ before: "a", after: "b" }])).toEqual(["a", "b"]);
  });
});
