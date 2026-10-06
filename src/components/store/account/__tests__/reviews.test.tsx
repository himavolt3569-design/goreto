import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountReviewList, type AccountReviewView } from "../account-review-list";
import { ReviewForm } from "../review-form";
import { ReviewableProducts } from "../reviewable-products";

const reviewActions = vi.hoisted(() => ({ submitReviewAction: vi.fn(), deleteReviewAction: vi.fn() }));
vi.mock("@/features/reviews/actions", () => reviewActions);

// jsdom has no modal dialogs.
Object.assign(HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) {
    this.open = true;
  },
  close(this: HTMLDialogElement) {
    this.open = false;
  },
});

beforeEach(() => {
  reviewActions.submitReviewAction.mockReset().mockResolvedValue({ ok: true });
  reviewActions.deleteReviewAction.mockReset().mockResolvedValue({ ok: true });
});

const EMPTY = { rating: "", title: "", body: "" };

describe("ReviewForm", () => {
  it("offers five labelled star radios in a named group", () => {
    render(<ReviewForm productSlug="wool-shawl" defaults={EMPTY} isEdit={false} />);
    const group = screen.getByRole("group", { name: /Your rating/ });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(within(group).getByRole("radio", { name: "5 stars, Excellent" })).toBeInTheDocument();
  });

  it("shows inline errors and doesn't submit an incomplete review", async () => {
    render(<ReviewForm productSlug="wool-shawl" defaults={EMPTY} isEdit={false} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit review" })));
    expect(screen.getByText("Choose a star rating")).toBeInTheDocument();
    expect(screen.getByText("Write at least 10 characters")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "1 star, Poor" })).toHaveAccessibleDescription("Choose a star rating");
    expect(reviewActions.submitReviewAction).not.toHaveBeenCalled();
  });

  it("counts characters and submits the chosen rating", async () => {
    render(<ReviewForm productSlug="wool-shawl" defaults={EMPTY} isEdit={false} />);
    fireEvent.click(screen.getByRole("radio", { name: "4 stars, Very good" }));
    fireEvent.change(screen.getByLabelText(/Your review/), { target: { value: "Warm and well made." } });
    expect(screen.getByText(/19 \/ 2000/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit review" })));
    expect(reviewActions.submitReviewAction).toHaveBeenCalledWith("wool-shawl", { rating: "4", title: "", body: "Warm and well made." });
  });

  it("prefills an edit and shows a server failure", async () => {
    reviewActions.submitReviewAction.mockResolvedValue({ ok: false, message: "You can review this product once an order with it has been delivered to you." });
    render(<ReviewForm productSlug="wool-shawl" defaults={{ rating: "5", title: "Lovely", body: "Really lovely shawl." }} isEdit />);
    expect(screen.getByRole("radio", { name: "5 stars, Excellent" })).toBeChecked();
    expect(screen.getByText(/Editing a review sends it for checking again/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("once an order with it has been delivered"));
  });
});

const ownReview: AccountReviewView = {
  id: "11111111-1111-4111-8111-111111111111",
  rating: 3,
  title: null,
  body: "Okay for the price.",
  status: "rejected",
  dateLabel: "Written 1 Oct 2026",
  product: { title: "Wool Shawl", slug: "wool-shawl", isActive: true },
};

describe("AccountReviewList", () => {
  it("shows a customer-safe status and the edit link", () => {
    render(<AccountReviewList reviews={[ownReview]} />);
    expect(screen.getByText("Not published")).toBeInTheDocument();
    expect(screen.getByText("It didn't meet our review guidelines.")).toBeInTheDocument();
    expect(screen.queryByText(/reject/i)).toBeNull();
    expect(screen.getByRole("link", { name: "Edit your review of Wool Shawl" })).toHaveAttribute("href", "/account/reviews/wool-shawl");
  });

  it("hides Edit and the product link for a product no longer on sale", () => {
    render(<AccountReviewList reviews={[{ ...ownReview, product: { ...ownReview.product, isActive: false } }]} />);
    expect(screen.queryByRole("link", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Wool Shawl" })).toBeNull();
  });

  it("deletes only after confirming, and reports a failure", async () => {
    reviewActions.deleteReviewAction.mockResolvedValue({ ok: false, message: "That review wasn't found." });
    render(<AccountReviewList reviews={[ownReview]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete your review of Wool Shawl" }));
    expect(reviewActions.deleteReviewAction).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete review", hidden: true })));
    expect(reviewActions.deleteReviewAction).toHaveBeenCalledWith(ownReview.id);
    expect(screen.getByRole("alert")).toHaveTextContent("That review wasn't found.");
  });
});

describe("ReviewableProducts", () => {
  it("links each delivered product to its write page", () => {
    render(<ReviewableProducts products={[{ slug: "wool-shawl", title: "Wool Shawl", image: null, deliveredLabel: "Delivered 2 Oct 2026" }]} />);
    expect(screen.getByText("Delivered 2 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Write a review of Wool Shawl" })).toHaveAttribute("href", "/account/reviews/wool-shawl");
  });
});
