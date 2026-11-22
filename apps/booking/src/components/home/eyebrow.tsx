import { cn } from "@/lib/cn";

// The small label over a section's heading: a short rule and capitals, in the brand colour.
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-3 text-xs font-semibold tracking-[0.14em] text-brand uppercase", className)}>
      <span aria-hidden className="h-px w-8 bg-current" />
      {children}
    </p>
  );
}
