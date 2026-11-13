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
        tone === "warning" ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100" : "bg-muted/40",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} aria-hidden />
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

const METHOD_STYLE = {
  GET: "bg-emerald-600",
  POST: "bg-blue-600",
  DELETE: "bg-red-600",
} as const;

// An endpoint's method and full URL, and the scope a key needs to call it.
export function Endpoint({ method, path, scope }: { method: keyof typeof METHOD_STYLE; path: string; scope?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
      <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold text-white", METHOD_STYLE[method])}>{method}</span>
      <span className="order-last min-w-0 basis-full break-all sm:order-none sm:basis-0 sm:flex-1">{path}</span>
      {scope && (
        <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
          scope <span className="text-foreground">{scope}</span>
        </span>
      )}
    </div>
  );
}

export type Param = { name: string; type: string; required?: boolean; text: ReactNode };

// Query parameters or body fields: name, type, required or not, what it does.
export function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Name</th>
            <th scope="col" className="px-3 py-2 font-medium">Type</th>
            <th scope="col" className="px-3 py-2 font-medium">Required</th>
            <th scope="col" className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {params.map((p) => (
            <tr key={p.name} className="align-top">
              <td className="px-3 py-2 font-mono text-[13px] whitespace-nowrap">{p.name}</td>
              <td className="px-3 py-2 font-mono text-[13px] whitespace-nowrap text-muted-foreground">{p.type}</td>
              <td className="px-3 py-2 whitespace-nowrap">{p.required ? "Yes" : "No"}</td>
              <td className="px-3 py-2 leading-relaxed">{p.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The statuses an endpoint can answer with. Codes link to the overview's list.
export function Statuses({ rows }: { rows: [status: string, when: ReactNode][] }) {
  return <SimpleTable head={["Status", "When"]} rows={rows} />;
}

// Where something is in the dashboard, e.g. <Place>Settings → Integrations</Place>.
export function Place({ children }: { children: ReactNode }) {
  return <strong className="font-medium">{children}</strong>;
}
