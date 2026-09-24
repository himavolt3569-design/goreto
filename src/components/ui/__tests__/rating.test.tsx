import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Rating } from "../rating";

describe("Rating", () => {
  it("compact: one star with value and count", () => {
    render(<Rating value={4.7} count={98} />);
    const rating = screen.getByRole("img", { name: "Rated 4.7 out of 5 from 98 reviews" });
    expect(rating).toHaveTextContent("4.7(98)");
  });

  it("stars: five stars filled to the average", () => {
    const { container } = render(<Rating variant="stars" value={4.8} count={120} />);
    const rating = screen.getByRole("img", { name: "Rated 4.8 out of 5 from 120 reviews" });
    expect(rating).toHaveTextContent("(120 reviews)");
    const fills = [...container.querySelectorAll("[data-fill]")].map((node) =>
      node.getAttribute("data-fill"),
    );
    expect(fills).toEqual(["1.00", "1.00", "1.00", "1.00", "0.80"]);
  });

  it("stars: singular review", () => {
    render(<Rating variant="stars" value={5} count={1} />);
    expect(screen.getByRole("img")).toHaveTextContent("(1 review)");
  });
});
