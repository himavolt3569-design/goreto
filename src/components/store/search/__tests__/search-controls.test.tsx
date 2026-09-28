import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchParams } from "@/features/search/params";
import { ActiveFilters, activeFilterChips } from "../active-filters";
import { SearchPagination } from "../pagination";
import { SearchFilters } from "../search-filters";
import { SearchSortControl } from "../search-sort";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
// next/form needs the app router; a plain GET form is enough for markup checks.
vi.mock("next/form", () => ({
  default: ({ action, ...props }: ComponentProps<"form"> & { action: string }) => (
    <form method="get" action={action} {...props} />
  ),
}));

const base: SearchParams = {
  q: "hoops",
  category: null,
  minRupees: null,
  maxRupees: null,
  sort: "relevance",
  page: 1,
};

describe("SearchSortControl", () => {
  beforeEach(() => replace.mockClear());

  it("offers relevance only with a query", () => {
    const { unmount } = render(<SearchSortControl params={base} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    expect(screen.getByRole("option", { name: "Relevance" })).toBeInTheDocument();
    unmount();

    render(<SearchSortControl params={{ ...base, q: "", sort: "featured" }} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    expect(screen.queryByRole("option", { name: "Relevance" })).not.toBeInTheDocument();
  });

  it("keeps the filters and returns to page 1", () => {
    render(<SearchSortControl params={{ ...base, category: "earrings", maxRupees: 3000, page: 3 }} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Price: Low to High" }));
    expect(replace).toHaveBeenCalledWith("/search?q=hoops&category=earrings&max=3000&sort=price-asc", {
      scroll: false,
    });
  });

  it("carries the other params for the no-JavaScript submit", () => {
    const { container } = render(<SearchSortControl params={{ ...base, minRupees: 100 }} />);
    const hidden = [...container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map(
      (input) => `${input.name}=${input.value}`,
    );
    expect(hidden).toEqual(["q=hoops", "min=100"]);
  });
});

describe("SearchFilters", () => {
  const options = [
    { value: "", label: "All categories" },
    { value: "jewelry", label: "Jewelry", depth: 0 as const },
    { value: "earrings", label: "Earrings", depth: 1 as const, context: "Jewelry" },
  ];

  it("labels every control and prefills the current filters", () => {
    render(
      <SearchFilters
        params={{ ...base, category: "earrings", minRupees: 500, maxRupees: 2000 }}
        categoryOptions={options}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent("Earrings");
    expect(screen.getByRole("textbox", { name: "Minimum price in rupees" })).toHaveValue("500");
    expect(screen.getByRole("textbox", { name: "Maximum price in rupees" })).toHaveValue("2000");
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute("href", "/search?q=hoops");
  });

  it("hides Clear all without filters and keeps the query", () => {
    const { container } = render(<SearchFilters params={base} categoryOptions={options} />);
    expect(screen.queryByRole("link", { name: "Clear all" })).not.toBeInTheDocument();
    expect(container.querySelector<HTMLInputElement>("input[type=hidden][name=q]")?.value).toBe("hoops");
    expect(container.querySelector("input[type=hidden][name=sort]")).toBeNull();
  });
});

describe("ActiveFilters", () => {
  it("links each chip to the results without that filter", () => {
    const params = { ...base, category: "earrings", minRupees: 1000, maxRupees: 5000 };
    render(<ActiveFilters chips={activeFilterChips(params, "Earrings")} />);
    const list = screen.getByRole("list", { name: "Active filters" });
    expect(within(list).getByRole("link", { name: "Remove filter: Earrings" })).toHaveAttribute(
      "href",
      "/search?q=hoops&min=1000&max=5000",
    );
    expect(within(list).getByRole("link", { name: "Remove filter: From Rs. 1,000" })).toHaveAttribute(
      "href",
      "/search?q=hoops&category=earrings&max=5000",
    );
    expect(within(list).getByRole("link", { name: "Remove filter: Up to Rs. 5,000" })).toBeInTheDocument();
  });

  it("renders nothing without filters", () => {
    const { container } = render(<ActiveFilters chips={activeFilterChips(base, undefined)} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SearchPagination", () => {
  it("links to the neighbouring pages", () => {
    render(<SearchPagination params={{ ...base, page: 2 }} pageCount={3} />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/search?q=hoops");
    expect(within(nav).getByRole("link", { name: "Next" })).toHaveAttribute("href", "/search?q=hoops&page=3");
    expect(nav).toHaveTextContent("Page 2 of 3");
  });

  it("disables Previous on the first page", () => {
    render(<SearchPagination params={base} pageCount={2} />);
    expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.getByText("Previous").closest("[aria-disabled]")).toBeInTheDocument();
  });

  it("renders nothing for a single page or a page past the end", () => {
    const { container, rerender } = render(<SearchPagination params={base} pageCount={1} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SearchPagination params={{ ...base, page: 9 }} pageCount={2} />);
    expect(container).toBeEmptyDOMElement();
  });
});
