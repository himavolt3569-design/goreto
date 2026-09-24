import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, buttonClasses } from "../button";
import { IconButton } from "../icon-button";

describe("Button", () => {
  it("defaults to a non-submitting primary button at 44px", () => {
    render(<Button>Shop Now</Button>);
    const button = screen.getByRole("button", { name: "Shop Now" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("bg-primary-500");
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("rounded-md");
  });

  it("applies variant and size classes", () => {
    const secondary = buttonClasses({ variant: "secondary", size: "md" });
    expect(secondary).toContain("border-primary-500");
    expect(secondary).toContain("px-3");
    expect(buttonClasses({ size: "lg" })).toContain("px-4");
  });

  it("lets className override defaults", () => {
    expect(buttonClasses({ className: "bg-primary-600" })).not.toContain(
      "bg-primary-500 ",
    );
  });

  it("is disabled and busy while loading", () => {
    render(<Button loading>Place Order</Button>);
    const button = screen.getByRole("button", { name: "Place Order" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("respects disabled", () => {
    render(<Button disabled>Shop Now</Button>);
    expect(screen.getByRole("button", { name: "Shop Now" })).toBeDisabled();
  });
});

describe("IconButton", () => {
  it("exposes its label as the accessible name", () => {
    render(<IconButton label="Add to wishlist" icon={<svg aria-hidden="true" />} />);
    expect(screen.getByRole("button", { name: "Add to wishlist" })).toBeInTheDocument();
  });
});
