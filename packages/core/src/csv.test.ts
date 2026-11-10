import { describe, expect, it } from "vitest";
import { parseCsv, penceToPounds, toCsv } from "./csv";

describe("toCsv", () => {
  it("starts with a byte-order mark for Excel", () => {
    expect(toCsv(["a"], [])).toBe("﻿a\r\n");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv(["a"], [['x,"y"\nz']])).toContain('"x,""y""\nz"');
  });

  it("stops a value running as a spreadsheet formula", () => {
    expect(toCsv(["a"], [["=HYPERLINK(1)"]])).toContain("'=HYPERLINK(1)");
    expect(toCsv(["a"], [["@SUM(1)"]])).toContain("'@SUM(1)");
  });

  it("leaves real numbers alone, even negative ones", () => {
    expect(toCsv(["a"], [[-12.5]])).toContain("\r\n-12.5\r\n");
  });

  it("writes blanks for nothing", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toContain("\r\n,\r\n");
  });
});

describe("parseCsv", () => {
  it("reads quotes, commas and line breaks inside quotes", () => {
    expect(parseCsv('name,notes\r\n"Doe, Jo","said ""hi""\nthen left"\r\n')).toEqual([
      ["name", "notes"],
      ["Doe, Jo", 'said "hi"\nthen left'],
    ]);
  });

  it("copes with a byte-order mark, no final line break and blank lines", () => {
    expect(parseCsv("﻿a,b\n\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("reads back what it wrote", () => {
    const rows = [["Doe, Jo", 'a "b"']];
    expect(parseCsv(toCsv(["x", "y"], rows)).slice(1)).toEqual(rows);
  });
});

describe("penceToPounds", () => {
  it("always has two decimal places", () => {
    expect(penceToPounds(1250)).toBe("12.50");
  });
});
