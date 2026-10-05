import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoretoPicks } from "@/components/store/home/goreto-picks";
import { HeroBanner } from "@/components/store/hero-banner";
import type { HomeProduct } from "@/features/catalog/types";

// The wishlist heart is covered by its own test; stub its auth and actions here.
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }), SignInButton: () => null }));
vi.mock("@/features/wishlist/actions", () => ({ saveToWishlistAction: vi.fn(), removeFromWishlistAction: vi.fn() }));

const tote: HomeProduct = {
  slug: "canvas-tote",
  title: "Canvas Tote",
  categorySlug: "bags",
  pricePaisa: 99900,
  image: null,
  isPick: true,
};

describe("GoretoPicks", () => {
  it("renders nothing without picks", () => {
    const { container } = render(<GoretoPicks products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists picks with the tick and never says sponsored", () => {
    const { container } = render(<GoretoPicks products={[tote]} />);
    const section = screen.getByRole("region", { name: "Goreto Picks" });
    const item = within(section).getByRole("listitem");
    expect(within(item).getByRole("link", { name: "Canvas Tote" })).toHaveAttribute("href", "/products/canvas-tote");
    expect(within(item).getByRole("img", { name: "Goreto Pick" })).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toContain("sponsor");
  });
});

describe("HeroBanner", () => {
  it("labels the section with its heading and shows the optional parts it gets", () => {
    render(
      <HeroBanner
        titleId="category-title"
        eyebrow="New season"
        title="Summer Dresses"
        image={{ src: "https://example.com/hero.jpg", alt: "Model in a linen dress" }}
      />,
    );
    expect(screen.getByRole("region", { name: "Summer Dresses" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Summer Dresses" })).toBeInTheDocument();
    expect(screen.getByText("New season")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Model in a linen dress" })).toBeInTheDocument();
  });
});
