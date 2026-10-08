import { describe, expect, it } from "vitest";
import { toPublicReview, toRatingBreakdown } from "./mappers";

describe("toRatingBreakdown", () => {
  it("fills in all five bars, 5 stars first, with percentages and the average", () => {
    const breakdown = toRatingBreakdown([
      { rating: 5, review_count: 6 },
      { rating: 4, review_count: 3 },
      { rating: 1, review_count: 1 },
    ]);
    expect(breakdown.count).toBe(10);
    expect(breakdown.average).toBe(4.3);
    expect(breakdown.bars).toEqual([
      { stars: 5, count: 6, percent: 60 },
      { stars: 4, count: 3, percent: 30 },
      { stars: 3, count: 0, percent: 0 },
      { stars: 2, count: 0, percent: 0 },
      { stars: 1, count: 1, percent: 10 },
    ]);
  });

  it("has no average and empty bars without reviews", () => {
    const breakdown = toRatingBreakdown([]);
    expect(breakdown).toMatchObject({ count: 0, average: null });
    expect(breakdown.bars.every((bar) => bar.count === 0 && bar.percent === 0)).toBe(true);
  });
});

describe("toPublicReview", () => {
  it("maps the function row to a view model", () => {
    expect(
      toPublicReview({
        review_id: "r1",
        rating: 5,
        title: null,
        body: "Great",
        author_name: "Priya S.",
        verified: true,
        created_at: "2026-10-01T00:00:00Z",
      }),
    ).toEqual({ id: "r1", rating: 5, title: null, body: "Great", authorName: "Priya S.", verified: true, createdAt: "2026-10-01T00:00:00Z" });
  });
});
