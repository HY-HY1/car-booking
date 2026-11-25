import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

// Five stars, filled to the rating: 4.6 fills 60% of the fifth. Sized by
// the font size; the rating is said in words wherever it's shown.
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="relative inline-flex">
          <Star className="size-[1em] fill-current opacity-25" strokeWidth={0} />
          <span className="absolute inset-0 overflow-hidden" style={{ width: `${Math.max(0, Math.min(1, rating - n + 1)) * 100}%` }}>
            <Star className="size-[1em] fill-current" strokeWidth={0} />
          </span>
        </span>
      ))}
    </span>
  );
}
