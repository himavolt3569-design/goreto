import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seedProducts } from "@/test/fixtures/catalog";
import { ProductGallery } from "../product-gallery";

vi.mock("@/components/store/wishlist-button", () => import("@/test/fakes/wishlist-button"));

const aviators = seedProducts.find((product) => product.slug === "aviator-sunglasses");
if (!aviators) throw new Error("missing aviator seed");

describe("ProductGallery", () => {
  it("switches the main image from the thumbnails and marks the current one", () => {
    render(<ProductGallery media={aviators.media} productSlug={aviators.slug} productTitle={aviators.title} />);
    const first = screen.getByRole("button", { name: "Show image 1 of 2" });
    const second = screen.getByRole("button", { name: "Show image 2 of 2" });

    expect(first).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("img", { name: "Woman wearing mirrored aviator sunglasses" }),
    ).toBeInTheDocument();

    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-current", "true");
    expect(first).not.toHaveAttribute("aria-current");
    // Main image and lightbox both show the second photo.
    expect(
      screen.getAllByRole("img", {
        name: "Aviator sunglasses laid out with travel essentials",
        hidden: true,
      }).length,
    ).toBeGreaterThan(0);
  });

  it("plays a video in the main frame with controls and no image viewer", () => {
    const media = [
      ...aviators.media,
      { id: "video-1", kind: "video" as const, image: { src: "https://example.test/clip.mp4", alt: "Aviators turned in the light" }, variantId: null },
    ];
    const { container } = render(<ProductGallery media={media} productSlug={aviators.slug} productTitle={aviators.title} />);
    fireEvent.click(screen.getByRole("button", { name: "Show video 3 of 3" }));

    // The main frame (the closed lightbox holds a second player).
    const player = screen.getAllByLabelText("Aviators turned in the light")[0]!;
    expect(player.tagName).toBe("VIDEO");
    expect(player).toHaveAttribute("controls");
    expect(player).not.toHaveAttribute("autoplay");
    expect(screen.queryByRole("button", { name: "View larger image" })).not.toBeInTheDocument();
    expect(container.querySelector('img[src*="clip.mp4"]')).toBeNull();
  });

  it("hides the thumbnail rail for a single photo", () => {
    const bag = seedProducts.find((product) => product.slug === "leather-weekender-bag");
    if (!bag) throw new Error("missing bag seed");
    render(<ProductGallery media={bag.media} productSlug={bag.slug} productTitle={bag.title} />);
    expect(screen.queryByRole("list", { name: "Product images" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View larger image" })).toBeInTheDocument();
  });

  it("renders a placeholder frame with no viewer when there are no photos", () => {
    render(<ProductGallery media={[]} productSlug="photo-less-product" productTitle="Photo-less product" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View larger image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Product images" })).not.toBeInTheDocument();
  });

  it("shows the wishlist heart over the main image", () => {
    render(<ProductGallery media={aviators.media} productSlug={aviators.slug} productTitle={aviators.title} />);
    expect(screen.getByRole("button", { name: "Save Aviator Sunglasses to wishlist" })).toBeInTheDocument();
  });
});
