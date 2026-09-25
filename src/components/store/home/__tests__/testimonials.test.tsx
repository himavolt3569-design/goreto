import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initials, Testimonials } from "../testimonials";

describe("Testimonials", () => {
  it("shows decorative initials when a review has no photo", () => {
    render(
      <Testimonials
        testimonials={[
          { id: "r-1", quote: "Lovely finish.", authorName: "Priya S.", authorLabel: "Verified Customer" },
        ]}
      />,
    );
    expect(screen.getByText("Lovely finish.")).toBeInTheDocument();
    expect(screen.getByText("Priya S.")).toBeInTheDocument();
    const badge = screen.getByText("PS");
    expect(badge).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders nothing without testimonials", () => {
    const { container } = render(<Testimonials testimonials={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("initials", () => {
  it("takes up to two letters from the name", () => {
    expect(initials("Priya S.")).toBe("PS");
    expect(initials("Dolma")).toBe("D");
    expect(initials("  anil  kumar  thapa ")).toBe("AK");
  });
});
