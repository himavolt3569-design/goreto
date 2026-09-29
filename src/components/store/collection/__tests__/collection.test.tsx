import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CollectionSummary } from "@/features/catalog/types";
import { CollectionBanner } from "../../collection-banner";
import { CollectionCard } from "../collection-card";

const collection: CollectionSummary = {
  slug: "pashmina-edit",
  eyebrow: "Made in Nepal",
  title: "The Pashmina Edit",
  description: "Chyangra pashmina shawls, hand-woven in Nepal.",
  image: { src: "https://abc.supabase.co/storage/v1/object/public/product-media/collections/p.jpg", alt: "Soft woven wrap" },
  productCount: 12,
};

describe("CollectionCard", () => {
  it("links the title to the collection and shows the count", () => {
    render(<CollectionCard collection={collection} />);
    expect(screen.getByRole("link", { name: "The Pashmina Edit" })).toHaveAttribute(
      "href",
      "/collections/pashmina-edit",
    );
    expect(screen.getByRole("heading", { level: 2, name: "The Pashmina Edit" })).toBeInTheDocument();
    expect(screen.getByText("12 products")).toBeInTheDocument();
    expect(screen.getByText("Made in Nepal")).toBeInTheDocument();
  });

  it("treats the photo as decorative", () => {
    render(<CollectionCard collection={collection} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("says Coming soon for an empty collection", () => {
    render(<CollectionCard collection={{ ...collection, productCount: 0, image: null }} />);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});

describe("CollectionBanner", () => {
  it("renders the heading at the requested level with its photo", () => {
    render(<CollectionBanner collection={collection} headingLevel="h1" />);
    expect(screen.getByRole("heading", { level: 1, name: "The Pashmina Edit" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Soft woven wrap" })).toBeInTheDocument();
  });

  it("renders copy only without a photo, plus an optional action", () => {
    render(
      <CollectionBanner
        collection={{ ...collection, image: null }}
        headingLevel="h3"
        action={<button type="button">Explore</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("The Pashmina Edit");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore" })).toBeInTheDocument();
  });
});
