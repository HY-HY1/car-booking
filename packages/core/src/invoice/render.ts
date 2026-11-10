import { formatPence } from "../booking/config";
import { formatDate } from "../dates";

// A customer invoice as a self-contained page: both the dashboard and the
// customer's own booking page serve it, and the browser prints it to PDF. No
// database access. Everything from the database is escaped.

export type Invoice = {
  number: number;
  reference: string;
  issuedAt: string;
  jobDate: string;
  timeZone: string;
  business: { name: string; legalName: string | null; email: string | null; phone: string | null; vatNumber: string | null };
  customer: { name: string; address: string | null };
  lines: { label: string; amount_pence: number }[];
  totalPence: number;
  paidPence: number;
};

export const invoiceNumberLabel = (n: number) => `INV-${String(n).padStart(6, "0")}`;

// UK VAT at the standard rate, taken as included in the price charged.
export const vatIncluded = (totalPence: number) => Math.round(totalPence / 6);

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function invoiceHtml(inv: Invoice) {
  const seller = inv.business.legalName || inv.business.name;
  const balance = Math.max(0, inv.totalPence - inv.paidPence);
  const row = (label: string, value: string, strong = false) =>
    `<tr${strong ? ' class="strong"' : ""}><td>${esc(label)}</td><td class="n">${esc(value)}</td></tr>`;
  const number = invoiceNumberLabel(inv.number);

  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Invoice ${esc(number)}</title>
<style>
body{font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;background:#f4f4f5;margin:0;padding:24px 16px}
main{max-width:680px;margin:0 auto;background:#fff;border-radius:8px;padding:32px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:13px;color:#71717a;margin:0 0 4px;font-weight:600}
.top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:24px;margin-bottom:28px}
table{width:100%;border-collapse:collapse;margin:20px 0}td{padding:8px 0;border-bottom:1px solid #e4e4e7}
.n{text-align:right;white-space:nowrap;padding-left:16px}.strong td{font-weight:600}.muted{color:#71717a;font-size:13px}
button{font:inherit;padding:10px 18px;border-radius:6px;border:1px solid #d4d4d8;background:#fff;cursor:pointer;margin:16px auto 0;display:block}
@media print{body{background:#fff;padding:0}main{padding:0}button{display:none}}
</style></head><body><main>
<div class="top"><div><h1>Invoice</h1><div>${esc(number)}</div><div class="muted">Booking ${esc(inv.reference)}</div></div>
<div><strong>${esc(seller)}</strong>${inv.business.legalName && inv.business.legalName !== inv.business.name ? `<div class="muted">Trading as ${esc(inv.business.name)}</div>` : ""}
${inv.business.email ? `<div class="muted">${esc(inv.business.email)}</div>` : ""}${inv.business.phone ? `<div class="muted">${esc(inv.business.phone)}</div>` : ""}
${inv.business.vatNumber ? `<div class="muted">VAT number ${esc(inv.business.vatNumber)}</div>` : ""}</div></div>
<div class="top"><div><h2>Billed to</h2><div>${esc(inv.customer.name)}</div>${inv.customer.address ? `<div class="muted">${esc(inv.customer.address)}</div>` : ""}</div>
<div><h2>Invoice date</h2><div>${esc(formatDate(inv.issuedAt, inv.timeZone))}</div><h2 style="margin-top:8px">Date of work</h2><div>${esc(formatDate(inv.jobDate, inv.timeZone))}</div></div></div>
<table>${inv.lines.map((l) => row(l.label, formatPence(l.amount_pence))).join("")}
${row("Total", formatPence(inv.totalPence), true)}
${inv.business.vatNumber ? row("Of which VAT at 20%", formatPence(vatIncluded(inv.totalPence))) : ""}
${row("Paid", formatPence(inv.paidPence))}${row("Left to pay", formatPence(balance), true)}</table>
<p class="muted">${balance === 0 ? "Paid in full. Thank you." : "Thank you for your business."}</p>
</main><button type="button" onclick="window.print()">Print or save as PDF</button></body></html>`;
}
