// Google Business Profile reviews: pure rules, no database or network, so
// client components and tests can use them.

export const REVIEW_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/business.manage"] as const;

// Google's longest reply.
export const REPLY_MAX = 4096;

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export type GoogleReview = {
  name: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment?: string; updateTime?: string };
};

export type ReviewRow = {
  review_name: string;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  rating: number | null;
  comment: string | null;
  reply: string | null;
  reply_updated_at: string | null;
  created_at_google: string;
  updated_at_google: string;
};

// Google adds "(Translated by Google)" with the original after it; the
// original is what the owner should read and answer.
export function originalText(comment: string | undefined) {
  if (!comment) return null;
  const marker = comment.indexOf("(Original)");
  const text = marker >= 0 ? comment.slice(marker + "(Original)".length) : comment.split("(Translated by Google)")[0];
  return text.trim().slice(0, 10_000) || null;
}

export function reviewRow(r: GoogleReview): ReviewRow {
  return {
    review_name: r.name,
    reviewer_name: r.reviewer?.isAnonymous ? null : (r.reviewer?.displayName?.slice(0, 200) ?? null),
    reviewer_photo_url: r.reviewer?.profilePhotoUrl?.startsWith("https://") ? r.reviewer.profilePhotoUrl.slice(0, 1000) : null,
    rating: STARS[r.starRating ?? ""] ?? null,
    comment: originalText(r.comment),
    reply: r.reviewReply?.comment?.slice(0, REPLY_MAX) ?? null,
    reply_updated_at: r.reviewReply?.updateTime ?? null,
    created_at_google: r.createTime,
    updated_at_google: r.updateTime,
  };
}

// Where customers leave a review, from the place id Google gives the location.
export function reviewUrlFor(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function replyProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return "Write your reply.";
  if (t.length > REPLY_MAX) return `Keep it under ${REPLY_MAX.toLocaleString("en-GB")} characters.`;
  return null;
}

// Counts for the top of the Reviews page.
export function reviewSummary(reviews: { rating: number | null; reply: string | null }[]) {
  const byStars = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => r.rating === stars).length }));
  const rated = reviews.filter((r) => r.rating !== null);
  const average = rated.length ? Math.round((rated.reduce((n, r) => n + (r.rating ?? 0), 0) / rated.length) * 10) / 10 : null;
  return { byStars, average, unanswered: reviews.filter((r) => !r.reply).length };
}
