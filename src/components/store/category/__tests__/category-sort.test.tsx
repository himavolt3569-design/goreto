import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategorySortControl } from "../category-sort";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/categories/hats",
}));

describe("CategorySortControl", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("has a visible label and shows the current sort", () => {
    render(<CategorySortControl value="price-desc" />);
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveTextContent("Price: High to Low");
  });

  it("writes the chosen sort to the URL", () => {
    render(<CategorySortControl value="featured" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Price: Low to High" }));
    expect(replace).toHaveBeenCalledWith("/categories/hats?sort=price-asc", { scroll: false });
  });

  it("leaves the default order out of the URL", () => {
    render(<CategorySortControl value="price-asc" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Featured" }));
    expect(replace).toHaveBeenCalledWith("/categories/hats", { scroll: false });
  });
});
