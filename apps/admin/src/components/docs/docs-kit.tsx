import type { ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Small building blocks shared by the docs pages.

export function DocTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="mb-2 text-sm font-medium text-muted-foreground">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
      {children && <div className="mt-3 text-lg text-muted-foreground [&_p]:mt-0">{children}</div>}
    </header>
  );
}

export function Callout({ tone = "note", title, children }: { tone?: "note" | "warning"; title?: string; children: ReactNode }) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "mt-5 flex gap-3 rounded-lg border p-4 text-sm",
        tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-muted/40",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warning" ? "text-amber-600" : "text-muted-foreground")} aria-hidden />
      <div className="min-w-0 [&_p:first-child]:mt-0 [&_p]:mt-2">
        {title && <p className="font-medium">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export type Field = { name: string; type: string; text: ReactNode };

// A table of fields in a request or response: name, type, what it means.
export function FieldTable({ fields }: { fields: Field[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Field</th>
            <th scope="col" className="px-3 py-2 font-medium">Type</th>
            <th scope="col" className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {fields.map((f) => (
            <tr key={f.name} className="align-top">
              <td className="px-3 py-2 font-mono text-[13px] whitespace-nowrap">{f.name}</td>
              <td className="px-3 py-2 font-mono text-[13px] whitespace-nowrap text-muted-foreground">{f.type}</td>
              <td className="px-3 py-2 leading-relaxed">{f.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A simple two-or-more column table for settings and the like.
export function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td key={j} className={cn("px-3 py-2 leading-relaxed", j === 0 && "font-medium")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Endpoint({ method, path }: { method: "GET"; path: string }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white">{method}</span>
      <span className="break-all">{path}</span>
    </p>
  );
}

// Where something is in the dashboard, e.g. <Place>Settings → API</Place>.
export function Place({ children }: { children: ReactNode }) {
  return <strong className="font-medium">{children}</strong>;
}
