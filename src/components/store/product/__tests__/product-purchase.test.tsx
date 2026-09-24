import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCartStore } from "@/features/cart/store";
import { seedProducts } from "@/features/catalog/dev-seed";
import { ProductPurchase } from "../product-purchase";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function renderProduct(slug: string) {
  const product = seedProducts.find((candidate) => candidate.slug === slug);
  if (!product) throw new Error(`missing seed product ${slug}`);
  return render(<ProductPurchase product={product} />);
}

function mainImage() {
  return screen.getByRole("img", { name: /beanie/i });
}

describe("ProductPurchase", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ lines: [] });
    push.mockClear();
  });

  it("renders title, stars, price and stock for the default variant", () => {
    renderProduct("beaded-wrist-stack");
    expect(screen.getByRole("heading", { level: 1, name: "Beaded Wrist Stack" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rated 4.8 out of 5 from 120 reviews" })).toBeInTheDocument();
    expect(screen.getByText("Rs. 1,799")).toBeInTheDocument();
    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Tan" })).toBeChecked();
  });

  it("switches price and stock with the variant", () => {
    renderProduct("aviator-sunglasses");
    expect(screen.getByText("Rs. 2,499")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Silver / Grey" }));
    expect(screen.getByText("Rs. 2,299")).toBeInTheDocument();
  });

  it("switches the gallery to the variant's own photos", () => {
    renderProduct("knit-slouch-beanie");
    expect(mainImage()).toHaveAccessibleName("Grey knit beanie worn with a corduroy jacket");
    fireEvent.click(screen.getByRole("radio", { name: "Red" }));
    expect(mainImage()).toHaveAccessibleName("Red knit beanie worn in a forest");
    expect(screen.getByText("Only 4 left")).toBeInTheDocument();
  });

  it("disables purchase for a sold-out variant", () => {
    renderProduct("white-lace-sundress");
    const large = screen.getByRole("radio", { name: "L (sold out)" });
    fireEvent.click(large);
    expect(screen.getByText("Sold Out", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sold out/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buy Now" })).toBeDisabled();
  });

  it("limits quantity to the variant's stock", () => {
    renderProduct("white-lace-sundress");
    fireEvent.click(screen.getByRole("radio", { name: "S" }));
    const increase = screen.getByRole("button", { name: "Increase quantity" });
    fireEvent.click(increase);
    expect(increase).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(2);
  });

  it("adds the selected variant and quantity to the cart", () => {
    renderProduct("knit-slouch-beanie");
    fireEvent.click(screen.getByRole("radio", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

    const [line] = useCartStore.getState().lines;
    expect(line).toMatchObject({
      variantId: "knit-slouch-beanie--red",
      sku: "GRT-KSB-RED",
      variantLabel: "Red",
      quantity: 2,
      unitPricePaisa: 99900,
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Added 2 × Knit Slouch Beanie (Red) to your cart.");
    expect(within(status).getByRole("link", { name: "View cart" })).toHaveAttribute("href", "/cart");
  });

  it("Buy Now adds the line and goes to checkout", () => {
    renderProduct("leather-weekender-bag");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buy Now" }));
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(push).toHaveBeenCalledWith("/checkout");
  });

  it("shows truthful reassurance copy (delivery fees, COD)", () => {
    renderProduct("leather-weekender-bag");
    expect(screen.getByText("Fees shown at checkout")).toBeInTheDocument();
    expect(screen.getByText("Cash on Delivery")).toBeInTheDocument();
    expect(screen.queryByText(/free delivery/i)).not.toBeInTheDocument();
  });
});
