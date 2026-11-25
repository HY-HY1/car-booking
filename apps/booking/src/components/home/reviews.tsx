import { ArrowUpRight } from "lucide-react";
import { MAX_SHOWN, TESTIMONIAL_SOURCES, type Testimonial } from "@leadgen/core/branding/reviews";
import type { PublicReviews } from "@leadgen/core/reviews/sync";
import { cn } from "@/lib/cn";
import { container } from "@/components/site";
import { ReviewCards, type ReviewCardData } from "./review-cards";
import { Stars } from "./stars";

// The business's Google rating and a few of its good recent reviews, once
// it has connected Google (Settings → Integrations). Quoted as Google has
// them, with the reviewer's first name and initial.

const ratingText = (average: number) => average.toFixed(1);
const reviewsText = (total: number) => `${total.toLocaleString("en-GB")} Google review${total === 1 ? "" : "s"}`;

// In the hero, first of the points under the buttons.
export function RatingLine({ reviews }: { reviews: PublicReviews }) {
  const content = (
    <>
      <Stars rating={reviews.average} className="text-amber-400 [font-size:0.95rem]" />
      <span>
        <span className="font-semibold">{ratingText(reviews.average)}</span> from {reviewsText(reviews.total)}
      </span>
    </>
  );
  const className = "inline-flex items-center gap-2";
  const label = `Rated ${ratingText(reviews.average)} out of 5 from ${reviewsText(reviews.total)}`;
  return reviews.link ? (
    <a href={reviews.link} target="_blank" rel="noopener" aria-label={label} className={cn(className, "underline-offset-4 hover:underline")}>
      {content}
    </a>
  ) : (
    <span aria-label={label} className={className}>
      {content}
    </span>
  );
}

// What customers say: the Google reviews (picked by the owner on the
// Reviews page, or the newest good ones) with the Google rating, then the
// testimonials the owner added. Testimonials say where they came from and
// carry no stars, so they're never taken for Google reviews. White cards on
// a wash of the brand; each opens a bigger view with its photos.
export function Reviews({ reviews, testimonials }: { reviews: PublicReviews | null; testimonials: Testimonial[] }) {
  const google = (reviews?.featured ?? []).slice(0, MAX_SHOWN);
  const others = testimonials.slice(0, MAX_SHOWN - google.length);
  if (!google.length && !others.length) return null;
  const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
  const cards: ReviewCardData[] = [
    ...google.map((r) => ({
      key: `google-${r.id}`,
      kind: "google" as const,
      text: r.text,
      name: r.name,
      detail: `Google review · ${monthYear.format(new Date(r.date))}`,
      rating: r.rating,
      photos: [],
    })),
    ...others.map((t, i) => ({
      key: `testimonial-${i}`,
      kind: "testimonial" as const,
      text: t.text,
      name: t.name,
      detail: t.source ? TESTIMONIAL_SOURCES[t.source] : null,
      avatarUrl: t.avatar_url,
      photos: t.photos,
    })),
  ];
  return (
    <section aria-labelledby="reviews-title" className="bg-wash py-14 sm:py-20">
      <div className={cn(container, "grid gap-10")}>
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <h2 id="reviews-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            What customers say
          </h2>
          {reviews && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-3">
                <p className="text-4xl leading-none font-semibold tracking-tight tabular-nums">{ratingText(reviews.average)}</p>
                <div className="grid gap-1">
                  <Stars rating={reviews.average} className="text-base text-amber-400" />
                  <p className="text-xs text-neutral-600">{reviewsText(reviews.total)}</p>
                </div>
              </div>
              {reviews.link && (
                <a
                  href={reviews.link}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex w-fit items-center gap-1 border-b border-current/30 pb-0.5 text-sm font-medium transition hover:border-current"
                >
                  Read them all on Google <ArrowUpRight className="size-4" aria-hidden />
                </a>
              )}
            </div>
          )}
        </div>
        <ReviewCards cards={cards} />
      </div>
    </section>
  );
}
