import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCartStore } from "@/features/cart/store";
import { EMPTY_ADDRESS } from "@/features/account/address-schema";
import type { NepalAddressData } from "@/features/delivery/nepal-address";
import type { WishlistEntry } from "@/features/wishlist/mappers";
import { AddressCard, type AddressView } from "../address-card";
import { AddressForm } from "../address-form";
import { WishlistGrid } from "../wishlist-grid";

const wishlistActions = vi.hoisted(() => ({ removeWishlistItemAction: vi.fn() }));
vi.mock("@/features/wishlist/actions", () => wishlistActions);

const addressActions = vi.hoisted(() => ({
  saveAddressAction: vi.fn(),
  setDefaultAddressAction: vi.fn(),
  deleteAddressAction: vi.fn(),
}));
vi.mock("@/features/account/address-actions", () => addressActions);

beforeEach(() => {
  useCartStore.setState({ lines: [] });
  wishlistActions.removeWishlistItemAction.mockResolvedValue({ ok: true });
  addressActions.setDefaultAddressAction.mockResolvedValue({ ok: true });
  addressActions.deleteAddressAction.mockResolvedValue({ ok: true });
  addressActions.saveAddressAction.mockResolvedValue({ ok: true });
});

/* ---------- Wishlist ---------- */

const entries: WishlistEntry[] = [
  {
    itemId: "11111111-1111-4111-8111-111111111111",
    savedAt: "2026-09-29T04:00:00Z",
    product: {
      slug: "tote-bag",
      title: "Tote Bag",
      image: null,
      pricePaisa: 249_900,
      priceVaries: false,
      stock: { status: "in_stock", label: "In Stock" },
      purchase: {
        kind: "add",
        line: {
          variantId: "22222222-2222-4222-8222-222222222222",
          productSlug: "tote-bag",
          title: "Tote Bag",
          variantLabel: null,
          sku: "TOTE-1",
          image: null,
          unitPricePaisa: 249_900,
          maxQuantity: 10,
        },
      },
    },
  },
  {
    itemId: "33333333-3333-4333-8333-333333333333",
    savedAt: "2026-09-28T04:00:00Z",
    product: {
      slug: "linen-shirt",
      title: "Linen Shirt",
      image: null,
      pricePaisa: 199_900,
      priceVaries: true,
      stock: { status: "low_stock", label: "Only 2 left" },
      purchase: { kind: "options" },
    },
  },
  { itemId: "44444444-4444-4444-8444-444444444444", savedAt: "2026-09-27T04:00:00Z", product: null },
];

describe("WishlistGrid", () => {
  it("shows price, stock and the right action for each saved product", () => {
    render(<WishlistGrid entries={entries} />);
    const cards = within(screen.getByRole("list", { name: "Saved products" })).getAllByRole("listitem");
    expect(cards).toHaveLength(3);

    expect(within(cards[0]!).getByText("In Stock")).toBeInTheDocument();
    expect(within(cards[0]!).getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();

    expect(within(cards[1]!).getByText("From")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("Only 2 left")).toBeInTheDocument();
    expect(within(cards[1]!).getByRole("link", { name: "Choose options" })).toHaveAttribute("href", "/products/linen-shirt");

    expect(within(cards[2]!).getByText("No longer available")).toBeInTheDocument();
    expect(within(cards[2]!).getByRole("button", { name: "Remove this product from wishlist" })).toBeInTheDocument();
  });

  it("adds a single-variant product to the cart", () => {
    render(<WishlistGrid entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));
    expect(useCartStore.getState().lines).toMatchObject([{ variantId: "22222222-2222-4222-8222-222222222222", quantity: 1 }]);
    expect(screen.getByText("Added Tote Bag to your cart.")).toBeInTheDocument();
  });

  it("removes an item by its row id", async () => {
    render(<WishlistGrid entries={entries} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remove Tote Bag from wishlist" })));
    expect(wishlistActions.removeWishlistItemAction).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });
});

/* ---------- Addresses ---------- */

const address: AddressView = {
  id: "55555555-5555-4555-8555-555555555555",
  label: "Work",
  isDefault: false,
  recipientName: "Sita Sharma",
  phone: "+977 981-2345678",
  lines: ["Thamel Chowk", "Kathmandu Metropolitan City, Ward No. 26", "Kathmandu, Bagmati Province"],
};

describe("AddressCard", () => {
  it("shows the address with edit and default actions", async () => {
    render(<AddressCard address={address} />);
    expect(screen.getByText("Thamel Chowk")).toBeInTheDocument();
    expect(screen.queryByText("Default")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Work address" })).toHaveAttribute(
      "href",
      "/account/addresses/55555555-5555-4555-8555-555555555555/edit",
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Set Work as default" })));
    expect(addressActions.setDefaultAddressAction).toHaveBeenCalledWith(address.id);
  });

  it("marks the default address and hides Set as default", () => {
    render(<AddressCard address={{ ...address, isDefault: true }} />);
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set as default/ })).not.toBeInTheDocument();
  });

  it("asks before deleting and shows a failure", async () => {
    HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
    addressActions.deleteAddressAction.mockResolvedValueOnce({ ok: false, message: "Something went wrong." });
    render(<AddressCard address={address} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Work address" }));
    expect(addressActions.deleteAddressAction).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete address", hidden: true })));
    expect(addressActions.deleteAddressAction).toHaveBeenCalledWith(address.id);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
  });
});

const nepal: NepalAddressData = {
  provinces: [{ code: "bagmati", name: "Bagmati Province" }],
  districts: [{ code: "kathmandu", provinceCode: "bagmati", name: "Kathmandu" }],
  municipalities: [{ code: "kathmandu-metro", districtCode: "kathmandu", name: "Kathmandu Metropolitan City", wardCount: 32, postalCode: "44600" }],
};

const filled = {
  ...EMPTY_ADDRESS,
  recipientName: "Sita Sharma",
  phone: "9812345678",
  provinceCode: "bagmati",
  districtCode: "kathmandu",
  municipalityCode: "kathmandu-metro",
  ward: "26",
  streetLandmark: "Thamel Chowk",
};

describe("AddressForm", () => {
  it("shows inline errors and does not submit an incomplete address", async () => {
    render(<AddressForm addressId={null} defaults={EMPTY_ADDRESS} data={nepal} isOnlyAddress={false} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save address" })));
    expect(screen.getByText("Enter the recipient's full name")).toBeInTheDocument();
    expect(screen.getAllByText("Choose a province").some((node) => node.closest("[id$='-error']"))).toBe(true);
    expect(addressActions.saveAddressAction).not.toHaveBeenCalled();
  });

  it("sets the label from the quick picks and submits the values", async () => {
    render(<AddressForm addressId={null} defaults={filled} data={nepal} isOnlyAddress={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    expect(screen.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("checkbox", { name: /Use as my default address/ }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save address" })));
    await waitFor(() => expect(addressActions.saveAddressAction).toHaveBeenCalled());
    expect(addressActions.saveAddressAction).toHaveBeenCalledWith(null, expect.objectContaining({ label: "Work", makeDefault: true }));
  });

  it("shows server errors on the form and its fields", async () => {
    addressActions.saveAddressAction.mockResolvedValueOnce({
      ok: false,
      message: "Check the area and ward.",
      fieldErrors: { ward: "Choose a ward in this municipality" },
    });
    render(<AddressForm addressId="55555555-5555-4555-8555-555555555555" defaults={filled} data={nepal} isOnlyAddress />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the area and ward.");
    expect(screen.getByText("Choose a ward in this municipality")).toBeInTheDocument();
    expect(addressActions.saveAddressAction).toHaveBeenCalledWith(
      "55555555-5555-4555-8555-555555555555",
      expect.objectContaining({ makeDefault: true }),
    );
  });
});
