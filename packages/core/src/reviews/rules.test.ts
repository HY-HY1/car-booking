import { describe, expect, it } from "vitest";
import { originalText, replyProblem, reviewRow, reviewSummary, reviewUrlFor } from "./rules";

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
