import type { Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

// A job's photos as a grid of squares, each opening full size.
export function PhotoThumbs({ photos, className }: { photos: Photo[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-3 gap-2", className)}>
      {photos.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-lg bg-muted">
          {p.url ? (
            <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-square" aria-label="Open photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
            </a>
          ) : (
            <div className="grid aspect-square place-items-center text-xs text-muted-foreground">Unavailable</div>
          )}
        </li>
      ))}
    </ul>
  );
}
