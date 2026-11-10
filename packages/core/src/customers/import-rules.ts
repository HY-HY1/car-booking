import { z } from "zod";
import { parseCsv } from "../csv";
import { normalizePhone, normalizePostcode } from "../customer-fields";

// Reading a customer list from a spreadsheet. No database access. Marketing
// permission is never imported: a column in someone's spreadsheet isn't proof
// of consent, so everyone comes in opted out.

export const MAX_IMPORT_ROWS = 5000;

export type ImportedCustomer = {
  name: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  postcode: string | null;
  notes: string | null;
};

const HEADERS: Record<string, keyof ImportedCustomer> = {
  name: "name",
  "full name": "name",
  customer: "name",
  email: "email",
  "email address": "email",
  phone: "phone",
  mobile: "phone",
  telephone: "phone",
  "phone number": "phone",
  address: "address_line",
  "address line": "address_line",
  postcode: "postcode",
  "post code": "postcode",
  notes: "notes",
};

export type ParsedImport =
  | { ok: false; message: string }
  | { ok: true; customers: ImportedCustomer[]; skipped: { line: number; reason: string }[] };

export function parseCustomerCsv(text: string): ParsedImport {
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, message: "That file has no customers in it." };
  if (rows.length - 1 > MAX_IMPORT_ROWS) return { ok: false, message: `That's too many at once. Import up to ${MAX_IMPORT_ROWS.toLocaleString("en-GB")}.` };

  const columns = rows[0].map((h) => HEADERS[h.trim().toLowerCase()]);
  if (!columns.includes("name")) return { ok: false, message: "The first line needs a column called name." };
  if (!columns.includes("email") && !columns.includes("phone")) return { ok: false, message: "The first line needs a column called email or phone." };

  const customers: ImportedCustomer[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const get = (key: keyof ImportedCustomer) => {
      const at = columns.indexOf(key);
      return at >= 0 ? (row[at] ?? "").trim() : "";
    };
    const name = get("name");
    const rawEmail = get("email").toLowerCase();
    const rawPhone = get("phone");
    if (!name) return void skipped.push({ line, reason: "No name" });
    const email = rawEmail && z.email().safeParse(rawEmail).success ? rawEmail : null;
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (!email && !phone) return void skipped.push({ line, reason: "No valid email or phone" });

    const keys = [email && `e:${email}`, phone && `p:${phone}`].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) return void skipped.push({ line, reason: "Repeated in this file" });
    keys.forEach((k) => seen.add(k));

    const postcode = get("postcode");
    customers.push({
      name: name.slice(0, 200),
      email,
      phone,
      address_line: get("address_line").slice(0, 300) || null,
      postcode: postcode ? normalizePostcode(postcode) : null,
      notes: get("notes").slice(0, 2000) || null,
    });
  });
  return { ok: true, customers, skipped };
}
