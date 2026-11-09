import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-neutral-200", className)} />;
}

// A customer page while it loads: a heading, then the shape of the content.
export function PageSkeleton({ blocks = ["h-40", "h-24"] }: { blocks?: string[] }) {
  return (
    <main role="status" aria-label="Loading" className="mx-auto grid w-full max-w-xl flex-1 content-start gap-4 px-4 py-10">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      {blocks.map((height, i) => (
        <Skeleton key={i} className={cn("rounded-2xl", height)} />
      ))}
    </main>
  );
}
