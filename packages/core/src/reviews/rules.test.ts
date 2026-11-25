import { describe, expect, it } from "vitest";
import { featuredReviews, originalText, publicReviewerName, replyProblem, reviewRow, reviewSummary, reviewUrlFor } from "./rules";

describe("reviewRow", () => {
  it("maps Google's review", () => {
    const row = reviewRow({
      name: "accounts/1/locations/2/reviews/3",
      reviewer: { displayName: "Sam P", profilePhotoUrl: "https://lh3.googleusercontent.com/a" },
      starRating: "FOUR",
      comment: "Great job",
      createTime: "2026-11-01T10:00:00Z",
      updateTime: "2026-11-02T10:00:00Z",
      reviewReply: { comment: "Thanks Sam", updateTime: "2026-11-03T10:00:00Z" },
    });
    expect(row).toMatchObject({ reviewer_name: "Sam P", rating: 4, comment: "Great job", reply: "Thanks Sam" });
  });

  it("hides anonymous reviewers, drops odd photo links, and allows a rating with no words", () => {
    const row = reviewRow({
      name: "x",
      reviewer: { displayName: "A Google user", isAnonymous: true, profilePhotoUrl: "http://x" },
      starRating: "FIVE",
      createTime: "2026-11-01T10:00:00Z",
      updateTime: "2026-11-01T10:00:00Z",
    });
    expect(row).toMatchObject({ reviewer_name: null, reviewer_photo_url: null, comment: null, reply: null, rating: 5 });
  });
});

describe("originalText", () => {
  it("keeps the original over Google's translation", () => {
    expect(originalText("Very good (Translated by Google)\n\n(Original)\nMuy bueno")).toBe("Muy bueno");
    expect(originalText("Muy bueno\n\n(Translated by Google)\nVery good")).toBe("Muy bueno");
    expect(originalText("  Plain  ")).toBe("Plain");
    expect(originalText(undefined)).toBeNull();
  });
});

describe("reply and summary", () => {
  it("checks a reply", () => {
    expect(replyProblem("  ")).toMatch(/Write/);
    expect(replyProblem("x".repeat(4097))).toMatch(/under/);
    expect(replyProblem("Thanks!")).toBeNull();
  });

  it("counts stars and unanswered reviews", () => {
    const s = reviewSummary([
      { rating: 5, reply: "Thanks" },
      { rating: 4, reply: null },
      { rating: null, reply: null },
    ]);
    expect(s.average).toBe(4.5);
    expect(s.unanswered).toBe(2);
    expect(s.byStars[0]).toEqual({ stars: 5, count: 1 });
  });

  it("builds the write-a-review link", () => {
    expect(reviewUrlFor("ChIJ abc")).toBe("https://search.google.com/local/writereview?placeid=ChIJ%20abc");
  });
});

describe("publicReviewerName", () => {
  it("shows a first name and initial only", () => {
    expect(publicReviewerName("Sam Peters")).toBe("Sam P.");
    expect(publicReviewerName("  mary ann  smith ")).toBe("mary S.");
    expect(publicReviewerName("Cher")).toBe("Cher");
    expect(publicReviewerName(null)).toBe("Google user");
    expect(publicReviewerName("   ")).toBe("Google user");
  });
});

describe("featuredReviews", () => {
  const row = (id: string, rating: number | null, comment: string | null, date: string) => ({
    review_name: id,
    reviewer_name: "Sam Peters",
    rating,
    comment,
    created_at_google: date,
  });

  it("keeps good reviews with something to say, newest first", () => {
    const out = featuredReviews([
      row("a", 5, "Brilliant job on the car, looks new again.", "2026-10-01T00:00:00Z"),
      row("b", 3, "It was fine but they were late on the day.", "2026-11-01T00:00:00Z"),
      row("c", 5, "Great", "2026-11-02T00:00:00Z"),
      row("d", 4, "Really pleased with the interior clean, thanks.", "2026-11-03T00:00:00Z"),
      row("e", null, "No stars but a long comment here anyway.", "2026-11-04T00:00:00Z"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["d", "a"]);
    expect(out[0]).toMatchObject({ name: "Sam P.", rating: 4 });
  });

  it("stops at the limit", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(String(i), 5, "A lovely thorough job, would book again.", `2026-11-0${i + 1}T00:00:00Z`));
    expect(featuredReviews(rows, 2).map((r) => r.id)).toEqual(["4", "3"]);
  });
});
