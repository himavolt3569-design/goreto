/* Pure mappers from the review functions' rows to storefront view models. */

export type PublicReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  verified: boolean;
  createdAt: string;
};

export type RatingBar = { stars: 1 | 2 | 3 | 4 | 5; count: number; percent: number };

export type RatingBreakdown = {
  /** Published review count. */
  count: number;
  /** Average to one decimal, or null with no reviews. */
  average: number | null;
  /** Always five bars, 5 stars first. */
  bars: RatingBar[];
};

type ReviewRow = {
  review_id: string;
  rating: number;
  title: string | null;
  body: string;
  author_name: string;
  verified: boolean;
  created_at: string;
};

export function toPublicReview(row: ReviewRow): PublicReview {
  return {
    id: row.review_id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    authorName: row.author_name,
    verified: row.verified,
    createdAt: row.created_at,
  };
}

const STARS = [5, 4, 3, 2, 1] as const;

export function toRatingBreakdown(rows: readonly { rating: number; review_count: number }[]): RatingBreakdown {
  const counts = new Map(rows.map((row) => [row.rating, row.review_count]));
  const count = STARS.reduce((total, stars) => total + (counts.get(stars) ?? 0), 0);
  const sum = STARS.reduce((total, stars) => total + stars * (counts.get(stars) ?? 0), 0);
  return {
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : null,
    bars: STARS.map((stars) => {
      const barCount = counts.get(stars) ?? 0;
      return { stars, count: barCount, percent: count ? Math.round((barCount / count) * 100) : 0 };
    }),
  };
}
