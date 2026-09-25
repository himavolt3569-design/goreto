import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { seedFeaturedProducts } from "@/test/fixtures/catalog";
import { FeaturedProducts } from "../featured-products";

function renderFeatured(products = seedFeaturedProducts) {
  return render(<FeaturedProducts products={products} heading={<h2>Handpicked</h2>} />);
}

function panelLinks() {
  return within(screen.getByRole("tabpanel"))
    .getAllByRole("link")
    .filter((link) => !link.getAttribute("aria-label"));
}

describe("FeaturedProducts", () => {
  it("shows every featured product under All", () => {
    renderFeatured();
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
    expect(panelLinks()).toHaveLength(seedFeaturedProducts.length);
  });

  it("filters the grid when a tab is clicked", () => {
    renderFeatured();
    fireEvent.click(screen.getByRole("tab", { name: "Bags" }));
    expect(screen.getByRole("tab", { name: "Bags" })).toHaveAttribute("aria-selected", "true");
    expect(panelLinks().map((link) => link.textContent)).toEqual(["Leather Weekender Bag"]);
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Bags");
  });

  it("moves between tabs with arrow, Home and End keys (roving tabindex)", () => {
    renderFeatured();
    const all = screen.getByRole("tab", { name: "All" });
    fireEvent.keyDown(all, { key: "ArrowRight" });
    const dresses = screen.getByRole("tab", { name: "Dresses" });
    expect(dresses).toHaveAttribute("aria-selected", "true");
    expect(dresses).toHaveFocus();
    expect(all).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(dresses, { key: "End" });
    expect(screen.getByRole("tab", { name: "Accessories" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Accessories" }), { key: "ArrowRight" });
    expect(all).toHaveFocus();
  });

  it("links card actions to the product page instead of a fake quick add", () => {
    renderFeatured();
    expect(
      screen.getByRole("link", { name: "Choose options for White Lace Sundress" }),
    ).toHaveAttribute("href", "/products/white-lace-sundress");
    expect(
      screen.getByRole("button", { name: "Save White Lace Sundress to wishlist (coming soon)" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("shows an empty state when a tab has no products", () => {
    renderFeatured(seedFeaturedProducts.filter((p) => p.categorySlug !== "jewelry"));
    fireEvent.click(screen.getByRole("tab", { name: "Jewelry" }));
    expect(screen.getByText(/No featured jewelry right now/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse Jewelry" })).toHaveAttribute(
      "href",
      "/categories/jewelry",
    );
  });
});
