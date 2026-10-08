import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { quoteManualOrderAction, searchOrderVariantsAction } from "@/features/admin/actions/manual-orders";
import { sendNewOrderAction } from "@/features/admin/actions/parcels";
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
      { variantId: "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80", productTitle: "Silver Hoop Earrings", variantTitle: "Gold", sku: "SHE-GLD", pricePaisa: 1, stock: 4, thumbnail: null, weightGrams: null },
    ],
  })),
  quoteManualOrderAction: vi.fn(async () => ({ ok: true, quote })),
  createManualOrderAction: vi.fn(),
}));

vi.mock("@/features/admin/actions/parcels", () => ({ sendNewOrderAction: vi.fn() }));

const address: NepalAddressData = {
  provinces: [{ code: "gandaki", name: "Gandaki Province" }],
  districts: [{ code: "kaski", provinceCode: "gandaki", name: "Kaski" }],
  municipalities: [{ code: "pokhara", districtCode: "kaski", name: "Pokhara Metropolitan City", wardCount: 33, postalCode: "33700" }],
};

beforeEach(() => {
  vi.mocked(quoteManualOrderAction).mockClear();
  vi.mocked(quoteManualOrderAction).mockImplementation(async () => ({ ok: true, quote }));
});

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

describe("ManualOrderForm in Send & track", () => {
  const DARAZ = "0f5e1c1a-1b2c-4d3e-8f40-5a6b7c8d9e01";
  const PATHAO = "0f5e1c1a-1b2c-4d3e-8f40-5a6b7c8d9e02";
  const option = (courierServiceId: string, courierName: string) => ({
    courierServiceId,
    serviceName: "Standard",
    serviceLevel: "standard" as const,
    description: "",
    courierName,
    pricePaisa: 15000,
    estimatedMinDays: 2,
    estimatedMaxDays: 4,
  });
  const withOptions: CheckoutQuote = { ...quote, deliveryOptions: [option(DARAZ, "Daraz Express"), option(PATHAO, "Pathao")] };

  function choose(label: string, name: string) {
    fireEvent.click(screen.getByRole("combobox", { name: new RegExp(label) }));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name }));
  }

  async function fillOrder() {
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "Sita Gurung" } });
    fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: "9812345678" } });
    fireEvent.change(screen.getByLabelText(/Add a product/), { target: { value: "hoop" } });
    fireEvent.click(await screen.findByRole("button", { name: /Choose Silver Hoop Earrings, Gold/ }));
    choose("Province", "Gandaki Province");
    choose("District", "Kaski");
    choose("Municipality", "Pokhara Metropolitan City");
    choose("Ward", "Ward No. 8");
    fireEvent.change(screen.getByLabelText(/Street/), { target: { value: "Lakeside, near the boat stand" } });
  }

  /** The send button once the server quote for the chosen courier has loaded. */
  async function sendButton(courier: string) {
    const button = await screen.findByRole("button", { name: `Save and send to ${courier}` });
    await waitFor(() => expect(button).toBeEnabled());
    return button;
  }

  it("names the courier on the button and asks for a weight only for Daraz", async () => {
    vi.mocked(quoteManualOrderAction).mockImplementation(async () => ({ ok: true, quote: withOptions }));
    render(<ManualOrderForm address={address} canLinkCustomer={false} autoAccept={false} codEnabled send={{ darazServiceIds: [DARAZ], usualWeightGrams: 500, onSent: vi.fn() }} />);
    await fillOrder();

    await sendButton("Daraz Express");
    expect(screen.getByLabelText(/Parcel weight/)).toHaveAttribute("placeholder", "Auto: 500 g");
    expect(screen.getByRole("radio", { name: /Daraz Express · Standard.*Books through Daraz Express/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Pathao/ })).not.toHaveAccessibleName(/Books through Daraz/);
    expect(screen.getByText(/books it with Daraz Express straight away/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Pathao/ }));
    await sendButton("Pathao");
    expect(screen.queryByLabelText(/Parcel weight/)).not.toBeInTheDocument();
    expect(screen.getByText(/tap Send on WhatsApp/)).toBeInTheDocument();
  });

  it("sends the typed weight, hands back the result and starts a fresh order", async () => {
    vi.mocked(quoteManualOrderAction).mockImplementation(async () => ({ ok: true, quote: withOptions }));
    const sent = { ok: true as const, orderId: "0f5e1c1a-1b2c-4d3e-8f40-5a6b7c8d9eff", orderNumber: "GT2610071234", kind: "booked" as const, courierName: "Daraz Express", trackingNumber: "NPDEX1001", message: "Booked" };
    vi.mocked(sendNewOrderAction).mockResolvedValue(sent);
    const onSent = vi.fn();
    render(<ManualOrderForm address={address} canLinkCustomer={false} autoAccept={false} codEnabled send={{ darazServiceIds: [DARAZ], usualWeightGrams: null, onSent }} />);
    await fillOrder();
    fireEvent.change(await screen.findByLabelText(/Parcel weight/), { target: { value: "750" } });
    fireEvent.click(await sendButton("Daraz Express"));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(sent));
    expect(sendNewOrderAction).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Sita Gurung", courierServiceId: DARAZ }), "750");
    await waitFor(() => expect(screen.queryByText("Silver Hoop Earrings")).not.toBeInTheDocument());
    expect(screen.getByLabelText(/Full name/)).toHaveValue("");
  });

  it("shows the weight error from the server next to the field", async () => {
    vi.mocked(quoteManualOrderAction).mockImplementation(async () => ({ ok: true, quote: withOptions }));
    vi.mocked(sendNewOrderAction).mockResolvedValue({ ok: false, message: "Check the highlighted fields.", fieldErrors: { weightGrams: "Enter whole grams from 1 to 100,000" } });
    render(<ManualOrderForm address={address} canLinkCustomer={false} autoAccept={false} codEnabled send={{ darazServiceIds: [DARAZ], usualWeightGrams: null, onSent: vi.fn() }} />);
    await fillOrder();
    fireEvent.change(await screen.findByLabelText(/Parcel weight/), { target: { value: "0" } });
    fireEvent.click(await sendButton("Daraz Express"));
    expect(await screen.findByText("Enter whole grams from 1 to 100,000")).toBeInTheDocument();
  });
});
