import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { seedCollections } from "@/test/fixtures/catalog";
import { CollectionCarousel } from "../collection-carousel";

function activeSlideTitle() {
  // Inactive slides are aria-hidden, so only the active heading is exposed.
  return screen.getByRole("heading", { level: 3 }).textContent;
}

describe("CollectionCarousel", () => {
  it("exposes a labelled carousel with the first slide active", () => {
    render(<CollectionCarousel collections={seedCollections} />);
    expect(screen.getByRole("region", { name: "Featured collections" })).toHaveAttribute(
      "aria-roledescription",
      "carousel",
    );
    expect(activeSlideTitle()).toBe(seedCollections[0].title);
    expect(
      screen.getByRole("button", { name: `Show collection 1: ${seedCollections[0].title}` }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("moves with next/previous and wraps around", () => {
    render(<CollectionCarousel collections={seedCollections} />);
    fireEvent.click(screen.getByRole("button", { name: "Next collection" }));
    expect(activeSlideTitle()).toBe(seedCollections[1].title);

    fireEvent.click(screen.getByRole("button", { name: "Previous collection" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous collection" }));
    expect(activeSlideTitle()).toBe(seedCollections[seedCollections.length - 1].title);
  });

  it("jumps to a slide from its dot", () => {
    render(<CollectionCarousel collections={seedCollections} />);
    const third = screen.getByRole("button", {
      name: `Show collection 3: ${seedCollections[2].title}`,
    });
    fireEvent.click(third);
    expect(activeSlideTitle()).toBe(seedCollections[2].title);
    expect(third).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("link", { name: /Explore the Collection/ }),
    ).toHaveAttribute("href", `/collections/${seedCollections[2].slug}`);
  });

  it("renders nothing without collections", () => {
    const { container } = render(<CollectionCarousel collections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
