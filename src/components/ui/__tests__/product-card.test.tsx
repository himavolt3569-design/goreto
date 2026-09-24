import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CartButton } from "../cart-button";
import { IconButton } from "../icon-button";
import { ProductCard } from "../product-card";

describe("ProductCard", () => {
  it("renders title link, formatted price, badge and rating", () => {
    render(
      <ProductCard
        title="Pearl Drop Earrings"
        href="/products/pearl-drop-earrings"
        pricePaisa={249900}
        badge={{ tone: "bestseller", label: "Bestseller" }}
        rating={{ value: 4.8, count: 120 }}
      />,
    );
    expect(screen.getByRole("link", { name: "Pearl Drop Earrings" })).toHaveAttribute(
      "href",
      "/products/pearl-drop-earrings",
    );
    expect(screen.getByText("Rs. 2,499")).toBeInTheDocument();
    expect(screen.getByText("Bestseller")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Rated 4.8 out of 5 from 120 reviews" }),
    ).toBeInTheDocument();
  });

  it("renders provided action slots", () => {
    render(
      <ProductCard
        title="Classic Top Handle Bag"
        href="/products/bag"
        pricePaisa={399900}
        cartAction={<IconButton label="Add to cart" icon={<svg aria-hidden="true" />} />}
      />,
    );
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
  });
});

describe("CartButton", () => {
  it("announces the item count", () => {
    render(<CartButton href="/cart" count={3} />);
    expect(screen.getByRole("link", { name: "Cart, 3 items" })).toBeInTheDocument();
  });

  it("describes an empty cart", () => {
    render(<CartButton href="/cart" count={0} />);
    expect(screen.getByRole("link", { name: "Cart, empty" })).toBeInTheDocument();
  });
});
