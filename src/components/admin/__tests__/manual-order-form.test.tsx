import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { quoteManualOrderAction, searchOrderVariantsAction } from "@/features/admin/actions/manual-orders";
import type { CheckoutQuote } from "@/features/checkout/quote";
import type { NepalAddressData } from "@/features/delivery/nepal-address";
import { ManualOrderForm } from "../manual-order/manual-order-form";

const VARIANT = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";

const quote: CheckoutQuote = {
  lines: [
    {
      variantId: VARIANT,
      productSlug: "silver-hoops",
      title: "Silver Hoop Earrings",
      variantTitle: "Gold",
      sku: "SHE-GLD",
      image: null,
      unitPricePaisa: 249900,
      quantity: 1,
      availableQuantity: 10,
      lineTotalPaisa: 249900,
      status: "ok",
    },
  ],
  subtotalPaisa: 249900,
  zoneName: null,
  deliveryOptions: [],
  selectedDelivery: null,
  coupon: null,
  discountPaisa: 0,
  deliveryFeePaisa: 0,
  totalPaisa: 249900,
  codEnabled: true,
  codMaxOrderPaisa: null,
};

vi.mock("@/features/admin/actions/manual-orders", () => ({
  searchOrderCustomersAction: vi.fn(async () => ({ ok: true, results: [] })),
  searchOrderVariantsAction: vi.fn(async () => ({
    ok: true,
    results: [
      { variantId: "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80", productTitle: "Silver Hoop Earrings", variantTitle: "Gold", sku: "SHE-GLD", pricePaisa: 1, stock: 4, thumbnail: null },
    ],
  })),
  quoteManualOrderAction: vi.fn(async () => ({ ok: true, quote })),
  createManualOrderAction: vi.fn(),
}));

const address: NepalAddressData = {
  provinces: [{ code: "gandaki", name: "Gandaki Province" }],
  districts: [{ code: "kaski", provinceCode: "gandaki", name: "Kaski" }],
  municipalities: [{ code: "pokhara", districtCode: "kaski", name: "Pokhara Metropolitan City", wardCount: 33, postalCode: "33700" }],
};

beforeEach(() => vi.mocked(quoteManualOrderAction).mockClear());

describe("ManualOrderForm", () => {
  it("asks for a separate WhatsApp number only when it differs from the phone", () => {
    render(<ManualOrderForm address={address} canLinkCustomer={false} autoAccept={false} codEnabled />);
    expect(screen.queryByLabelText(/WhatsApp number/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /WhatsApp is the same number/ }));
    expect(screen.getByLabelText(/WhatsApp number/)).toBeInTheDocument();
  });

  it("offers customer linking only with customers.read", () => {
    const { unmount } = render(<ManualOrderForm address={address} canLinkCustomer={false} autoAccept={false} codEnabled />);
    expect(screen.queryByLabelText(/Existing customer/)).not.toBeInTheDocument();
    unmount();
    render(<ManualOrderForm address={address} canLinkCustomer autoAccept={false} codEnabled />);
    expect(screen.getByLabelText(/Existing customer/)).toBeInTheDocument();
  });

  it("adds a searched item and shows the server's price, not the search hint", async () => {
    render(<ManualOrderForm address={address} canLinkCustomer={false} autoAccept={false} codEnabled />);
    expect(screen.getByRole("button", { name: /Create order/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Add a product/), { target: { value: "hoop" } });
    await waitFor(() => expect(searchOrderVariantsAction).toHaveBeenCalledWith("hoop"));
    fireEvent.click(await screen.findByRole("button", { name: /Choose Silver Hoop Earrings, Gold/ }));

    const items = screen.getByRole("list", { name: "Order items" });
    expect(within(items).getByText("Silver Hoop Earrings")).toBeInTheDocument();
    await waitFor(() => expect(quoteManualOrderAction).toHaveBeenCalledWith(expect.objectContaining({ items: [{ variantId: VARIANT, quantity: 1 }] })));
    expect(await within(items).findByText("Rs. 2,499")).toBeInTheDocument();
    expect(screen.getByText("Cash to collect").nextElementSibling).toHaveTextContent("Rs. 2,499");
  });

  it("says when the order will be auto-accepted, and pauses when COD is off", () => {
    const { unmount } = render(<ManualOrderForm address={address} canLinkCustomer={false} autoAccept codEnabled />);
    expect(screen.getByRole("button", { name: /Create and accept order/ })).toBeInTheDocument();
    expect(screen.getByText(/auto-accept is on/)).toBeInTheDocument();
    unmount();
    render(<ManualOrderForm address={address} canLinkCustomer={false} autoAccept={false} codEnabled={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/turned off in Settings/);
  });
});
