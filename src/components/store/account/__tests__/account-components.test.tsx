import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderTrackingView } from "@/components/store/orders/order-tracking-view";
import type { AccountOrderRow, AccountTrackingEvent } from "@/features/account/queries";
import type { OrderTracking } from "@/features/orders/tracking-model";
import { AccountNav } from "../account-nav";
import { AccountPagination } from "../account-ui";
import { BillingList } from "../billing-list";
import { OrderList } from "../order-list";
import { TrackingFeed } from "../tracking-feed";

let pathname = "/account/orders/GRT2609301234";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const order = (overrides: Partial<AccountOrderRow>): AccountOrderRow => ({
  orderNumber: "GRT2609301234",
  placedAt: "2026-09-30T04:15:00Z",
  status: "shipped",
  paymentStatus: "pending",
  totalPaisa: 249_900,
  itemCount: 2,
  ...overrides,
});

describe("AccountNav", () => {
  it("groups the sections and marks the current one", () => {
    pathname = "/account/orders/GRT2609301234";
    render(<AccountNav />);
    const nav = screen.getByRole("navigation", { name: "Account" });
    // The mobile row and desktop sidebar both render; CSS shows one of them.
    const current = within(nav).getAllByRole("link", { current: "page" });
    expect(current.length).toBeGreaterThan(0);
    expect(current.every((link) => link.textContent === "Orders")).toBe(true);
    expect(within(nav).getByRole("list", { name: "Orders" })).toBeInTheDocument();
  });

  it("lists the wishlist and addresses under Saved", () => {
    pathname = "/account/addresses/new";
    render(<AccountNav />);
    const saved = screen.getByRole("list", { name: "Saved" });
    expect(within(saved).getByRole("link", { name: "Wishlist" })).toHaveAttribute("href", "/account/wishlist");
    expect(within(saved).getByRole("link", { name: "Addresses" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Overview only on /account", () => {
    pathname = "/account";
    render(<AccountNav />);
    const current = screen.getAllByRole("link", { current: "page" });
    expect(current.every((link) => link.textContent === "Overview")).toBe(true);
  });
});

describe("OrderList", () => {
  it("links each order and shows its date, item count, status and total", () => {
    render(<OrderList orders={[order({}), order({ orderNumber: "GRT2609301235", itemCount: 1, status: "delivered" })]} />);
    const list = screen.getByRole("list", { name: "Your orders" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole("link", { name: "Order #GRT2609301234" })).toHaveAttribute("href", "/account/orders/GRT2609301234");
    expect(rows[0]).toHaveTextContent("30 Sep 2026");
    expect(rows[0]).toHaveTextContent("2 items");
    expect(rows[0]).toHaveTextContent("Shipped");
    expect(rows[0]).toHaveTextContent("Rs. 2,499");
    expect(rows[1]).toHaveTextContent("1 item");
    expect(rows[1]).toHaveTextContent("Delivered");
  });
});

describe("TrackingFeed", () => {
  it("names each event and links its order", () => {
    const events: AccountTrackingEvent[] = [
      { orderNumber: "GRT2609301234", status: "out_for_delivery", message: "With the rider", locationLabel: "Lalitpur", occurredAt: "2026-09-30T06:00:00Z" },
      { orderNumber: "GRT2609301235", status: "awaiting_assignment", message: "Order placed. Cash on delivery.", locationLabel: null, occurredAt: "2026-09-29T06:00:00Z" },
    ];
    render(<TrackingFeed events={events} />);
    const items = within(screen.getByRole("list", { name: "Tracking updates" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Out for delivery");
    expect(items[0]).toHaveTextContent("With the rider · Lalitpur");
    expect(within(items[1]!).getByRole("link", { name: "Order #GRT2609301235" })).toHaveAttribute("href", "/account/orders/GRT2609301235");
  });
});

describe("BillingList", () => {
  it("says which total each order counts toward", () => {
    render(
      <BillingList
        orders={[
          order({ orderNumber: "GRT0000000001", status: "delivered", paymentStatus: "collected" }),
          order({ orderNumber: "GRT0000000002", status: "shipped", paymentStatus: "pending" }),
          order({ orderNumber: "GRT0000000003", status: "canceled", paymentStatus: "pending" }),
          order({ orderNumber: "GRT0000000004", status: "delivered", paymentStatus: "refunded" }),
        ]}
      />,
    );
    const rows = within(screen.getByRole("list", { name: "Billing by order" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Paid");
    expect(rows[0]).toHaveTextContent("Counted in billed to date");
    expect(rows[1]).toHaveTextContent("Pay on delivery");
    expect(rows[1]).toHaveTextContent("Counted in pending COD");
    expect(rows[2]).toHaveTextContent("Canceled");
    expect(rows[2]).toHaveTextContent("Not counted");
    expect(rows[3]).toHaveTextContent("Refunded");
    expect(rows[3]).toHaveTextContent("Not counted");
  });
});

describe("AccountPagination", () => {
  it("links to neighbouring pages and hides for a single page", () => {
    const { rerender } = render(<AccountPagination pathname="/account/orders" page={2} pageCount={3} />);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/account/orders");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/account/orders?page=3");
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    rerender(<AccountPagination pathname="/account/orders" page={1} pageCount={1} />);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });
});

describe("OrderTrackingView (account)", () => {
  const tracking: OrderTracking = {
    orderNumber: "GRT2609301234",
    placedAt: "2026-09-30T04:15:00Z",
    status: "pending_confirmation",
    paymentStatus: "pending",
    address: {
      recipientName: "Sita Sharma",
      phoneE164: "+9779812345678",
      provinceName: "Bagmati",
      districtName: "Lalitpur",
      municipalityName: "Lalitpur Metropolitan City",
      ward: 3,
      streetLandmark: "Jhamsikhel",
      postalCode: null,
      latitude: null,
      longitude: null,
    },
    delivery: { serviceName: "Standard", serviceLevel: "standard", courierName: "Pathao", pricePaisa: 10_000, estimatedMinDays: 2, estimatedMaxDays: 4 },
    subtotalPaisa: 239_900,
    discountPaisa: 0,
    deliveryFeePaisa: 10_000,
    totalPaisa: 249_900,
    couponCode: null,
    note: null,
    confirmedAt: null,
    packedAt: null,
    shippedAt: null,
    deliveredAt: null,
    canceledAt: null,
    cancellationReason: null,
    items: [],
    shipment: null,
    events: [],
  };
  const info = { codEnabled: true, returnsWindowDays: 7, supportEmail: null, supportPhoneE164: null };

  it("titles the page for the account and links back to the order list", () => {
    render(<OrderTrackingView order={tracking} trackingLink={null} info={info} variant="account" />);
    expect(screen.getByRole("heading", { level: 1, name: "Order Details" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Orders" })).toHaveAttribute("href", "/account/orders");
    expect(screen.queryByText("Save your tracking link")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue Shopping" })).not.toBeInTheDocument();
  });
});
