import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// The customer pages' form controls: all 44px tall, in the business's colours.

export const controlClass =
  "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base outline-none placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, className)} {...props} />;
}

// The arrow is drawn in globals.css ([data-slot="select"]).
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select data-slot="select" className={cn(controlClass, "cursor-pointer appearance-none pr-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "block h-auto py-2.5", className)} {...props} />;
}

export function Checkbox({ children, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" {...props} />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

// A label around its control, with an error underneath.
export function Field({ label, error, children }: { label: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error && <span className="font-normal text-red-600">{error}</span>}
    </label>
  );
}
