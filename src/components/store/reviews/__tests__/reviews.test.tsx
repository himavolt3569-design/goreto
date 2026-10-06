import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toRatingBreakdown, type PublicReview } from "@/features/reviews/mappers";
import { ProductReviews } from "../product-reviews";
import { RatingBreakdown } from "../rating-breakdown";
import { ReviewCard } from "../review-card";
import { WriteReviewButton } from "../write-review-button";

const clerk = vi.hoisted(() => ({ signedIn: false }));
vi.mock("@clerk/nextjs", () => ({
  ClerkLoading: () => null,
  Show: ({ when, children }: { when: "signed-in" | "signed-out"; children: ReactNode }) =>
    (when === "signed-in") === clerk.signedIn ? <>{children}</> : null,
  SignInButton: ({ children, forceRedirectUrl }: { children: ReactNode; forceRedirectUrl: string }) => (
    <div data-testid="sign-in" data-redirect={forceRedirectUrl}>
      {children}
    </div>
  ),
}));

beforeEach(() => {
  clerk.signedIn = false;
});

const review: PublicReview = {
  id: "r1",
  rating: 4,
  title: "Soft and warm",
  body: "<b>Not bold</b>\nSecond line",
  authorName: "Priya S.",
  verified: true,
  createdAt: "2026-10-01T06:00:00Z",
};

describe("RatingBreakdown", () => {
  it("labels every bar with its stars and review count as text", () => {
    render(<RatingBreakdown breakdown={toRatingBreakdown([{ rating: 5, review_count: 2 }, { rating: 1, review_count: 1 }])} />);
    const bars = within(screen.getByRole("list", { name: "Reviews by star rating" })).getAllByRole("listitem");
    expect(bars.map((bar) => bar.textContent)).toEqual(["5 stars2 reviews", "4 stars0 reviews", "3 stars0 reviews", "2 stars0 reviews", "1 star1 review"]);
    expect(screen.getByRole("img", { name: "Rated 3.7 out of 5 from 3 reviews" })).toBeInTheDocument();
  });
});

describe("ReviewCard", () => {
  it("shows the review as text with byline, Nepal date and verified state", () => {
    const { container } = render(<ReviewCard review={review} />);
    expect(screen.getByRole("heading", { name: "Soft and warm" })).toBeInTheDocument();
    expect(screen.getByText(/<b>Not bold<\/b>/)).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("Priya S.")).toBeInTheDocument();
    expect(screen.getByText("1 Oct 2026")).toHaveAttribute("dateTime", review.createdAt);
    expect(screen.getByText("Verified purchase")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rated 4.0 out of 5" })).toBeInTheDocument();
  });
});

describe("WriteReviewButton", () => {
  it("opens sign-in when signed out and continues to the write page", () => {
    render(<WriteReviewButton productSlug="wool-shawl" />);
    expect(screen.getByRole("button", { name: "Write a review" })).toBeInTheDocument();
    expect(screen.getByTestId("sign-in")).toHaveAttribute("data-redirect", "/account/reviews/wool-shawl");
  });

  it("links to the write page when signed in", () => {
    clerk.signedIn = true;
    render(<WriteReviewButton productSlug="wool-shawl" />);
    expect(screen.getByRole("link", { name: "Write a review" })).toHaveAttribute("href", "/account/reviews/wool-shawl");
  });
});

describe("ProductReviews", () => {
  it("shows an empty state with the write action when there are no reviews", () => {
    render(<ProductReviews productSlug="wool-shawl" breakdown={toRatingBreakdown([])} latest={[]} />);
    expect(screen.getByRole("region", { name: "Customer reviews" })).toHaveAttribute("id", "reviews");
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write a review" })).toBeInTheDocument();
  });

  it("lists the latest reviews and links to all of them when there are more", () => {
    render(<ProductReviews productSlug="wool-shawl" breakdown={toRatingBreakdown([{ rating: 4, review_count: 7 }])} latest={[review]} />);
    expect(within(screen.getByRole("list", { name: "Latest reviews" })).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "See all 7 reviews" })).toHaveAttribute("href", "/products/wool-shawl/reviews");
  });

  it("has no See all link when every review is shown", () => {
    render(<ProductReviews productSlug="wool-shawl" breakdown={toRatingBreakdown([{ rating: 4, review_count: 1 }])} latest={[review]} />);
    expect(screen.queryByRole("link", { name: /See all/ })).toBeNull();
  });
});
