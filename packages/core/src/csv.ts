// Reading and writing CSV, for accountants' exports and customer lists.

// A value a spreadsheet would run as a formula is prefixed so it stays text:
// a customer's name is whatever they typed. Numbers are passed through, so a
// negative amount stays a number.
function field(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  // The byte-order mark makes Excel read it as UTF-8, so £ survives.
  return `﻿${[headers, ...rows].map((r) => r.map(field).join(",")).join("\r\n")}\r\n`;
}

// Rows of fields, handling quotes, commas and line breaks inside quotes.
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        value += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(value);
      value = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(value);
      value = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else {
      value += c;
    }
  }
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

export const penceToPounds = (pence: number) => (pence / 100).toFixed(2);
