import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkDarazAction, readyToShipDarazAction } from "@/features/admin/actions/daraz";
import { recordCourierHandoffAction } from "@/features/admin/actions/orders";
import { sendOrderAction } from "@/features/admin/actions/parcels";
import type { AutopilotStatus, ParcelRow } from "@/features/admin/queries/parcels";
import { AutopilotCard } from "../parcels/autopilot-card";
import { ParcelRefresh } from "../parcels/parcel-actions";
import { courierLabel, ParcelList } from "../parcels/parcel-list";
import { SendResultCard } from "../parcels/send-result";

vi.mock("@/features/admin/actions/daraz", () => ({
  bookDarazAction: vi.fn(),
  bulkDarazAction: vi.fn(async () => ({ ok: true, message: "Refreshed 1 order." })),
  cancelDarazBookingAction: vi.fn(),
  createDarazSupportCaseAction: vi.fn(),
  darazFeedbackAction: vi.fn(),
  linkDarazAccountAction: vi.fn(),
  proofOfDeliveryAction: vi.fn(),
  quoteDarazAction: vi.fn(),
  rateDarazSupportCaseAction: vi.fn(),
  readyToShipDarazAction: vi.fn(async () => ({ ok: true, message: "Marked ready to ship. Daraz Express will pick it up." })),
  recordRemittanceAction: vi.fn(),
  deleteRemittanceAction: vi.fn(),
  refreshDarazTrackingAction: vi.fn(),
  saveDarazSettingsAction: vi.fn(),
  saveDarazWarehouseAction: vi.fn(),
  supportCaseDetailAction: vi.fn(),
  testDarazConnectionAction: vi.fn(),
  updateDarazReceiverAction: vi.fn(),
}));
vi.mock("@/features/admin/actions/orders", () => ({ recordCourierHandoffAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/features/admin/actions/parcels", () => ({
  sendOrderAction: vi.fn(async () => ({ kind: "booked", courierName: "Daraz Express", trackingNumber: "NPDEX1001", message: "Booked with Daraz Express." })),
  setAutopilotAction: vi.fn(async () => ({ ok: true, message: "Autopilot is on." })),
}));

const ID = (n: number) => `0f5e1c1a-1b2c-4d3e-8f40-5a6b7c8d9e0${n}`;
const daraz = { name: "Daraz Express", daraz: true, whatsappE164: null };
const pathao = { name: "Pathao", daraz: false, whatsappE164: "+9779801234567" };

const row = (n: number, overrides: Partial<ParcelRow> = {}): ParcelRow => ({
  orderId: ID(n),
  orderNumber: `GT26100700${n}`,
  orderStatus: "confirmed",
  paymentStatus: "pending",
  channel: "whatsapp",
  createdAt: "2026-10-07T04:00:00Z",
  customer: `Customer ${n}`,
  phoneE164: "+9779812345678",
  place: "Pokhara, Ward 8",
  totalPaisa: 249900,
  courierId: "c1",
  courier: daraz,
  routedCourierName: null,
  shipment: { status: "assigned", booked: true, readyToShip: false, needsAction: false },
  handoffSent: true,
  itemsWeighed: true,
  trackingNumber: "NPDEX1001",
  estimatedTo: null,
  lastEvent: { message: "Booked with Daraz Express.", at: "2026-10-07T04:05:00Z" },
  stale: false,
  whatsappHref: null,
  ...overrides,
});

const context = { darazConnected: true, usualWeightGrams: null };

beforeEach(() => vi.clearAllMocks());

describe("ParcelList", () => {
  it("gives every row one next step in plain words", () => {
    render(
      <ParcelList
        rows={[
          row(1, { orderStatus: "pending_confirmation", courier: null, courierId: null, routedCourierName: "Daraz Express", shipment: { status: "awaiting_assignment", booked: false, readyToShip: false, needsAction: false }, handoffSent: false }),
          row(2),
          row(3, { courier: pathao, handoffSent: false, shipment: { status: "assigned", booked: false, readyToShip: false, needsAction: false }, whatsappHref: "https://wa.me/9779801234567?text=hi" }),
          row(4, { orderStatus: "shipped", shipment: { status: "in_transit", booked: true, readyToShip: true, needsAction: true } }),
          row(5, { orderStatus: "delivered", paymentStatus: "collected", shipment: { status: "delivered", booked: true, readyToShip: true, needsAction: false } }),
        ]}
        context={context}
        canWrite
        canManageDelivery
      />,
    );
    const items = within(screen.getByRole("list", { name: "Parcels" })).getAllByRole("listitem", { name: undefined }).filter((item) => item.parentElement?.getAttribute("aria-label") === "Parcels");
    expect(items).toHaveLength(5);

    expect(within(items[0]!).getByText("New order, waiting for you")).toBeInTheDocument();
    expect(within(items[0]!).getByRole("button", { name: "Accept & send to Daraz Express" })).toBeInTheDocument();

    expect(within(items[1]!).getByRole("link", { name: /Print label & call pickup/ })).toHaveAttribute("href", `/admin/daraz/labels?orders=${ID(2)}&type=pdf`);

    expect(within(items[2]!).getByRole("link", { name: /Send on WhatsApp/ })).toHaveAttribute("href", "https://wa.me/9779801234567?text=hi");

    expect(within(items[3]!).getByText("Daraz couldn't deliver it")).toBeInTheDocument();
    expect(within(items[3]!).getByRole("button", { name: "Try again or return" })).toBeInTheDocument();

    expect(within(items[4]!).getByText("Delivered, cash collected")).toBeInTheDocument();
    expect(within(items[4]!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(items[4]!).getAllByText("(done)")).toHaveLength(4);
    expect(within(items[1]!).getAllByText("(done)")).toHaveLength(2);
  });

  it("sends with one click, and calls the pickup alongside the label", async () => {
    render(<ParcelList rows={[row(1, { orderStatus: "pending_confirmation", courier: null, routedCourierName: "Daraz Express", handoffSent: false }), row(2)]} context={context} canWrite canManageDelivery={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept & send to Daraz Express" }));
    await waitFor(() => expect(sendOrderAction).toHaveBeenCalledWith(ID(1)));
    expect(await screen.findByText("Booked with Daraz Express.", { selector: "[role=status]" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Print label & call pickup/ }));
    await waitFor(() => expect(readyToShipDarazAction).toHaveBeenCalled());
    expect(vi.mocked(readyToShipDarazAction).mock.calls[0]![1].get("orderId")).toBe(ID(2));
  });

  it("records the WhatsApp handoff when the link is opened", async () => {
    render(<ParcelList rows={[row(3, { courier: pathao, handoffSent: false, whatsappHref: "https://wa.me/9779801234567?text=hi" })]} context={context} canWrite canManageDelivery={false} />);
    fireEvent.click(screen.getByRole("link", { name: /Send on WhatsApp/ }));
    await waitFor(() => expect(recordCourierHandoffAction).toHaveBeenCalledWith(ID(3)));
  });

  it("says what's missing instead of offering a booking that can't work", () => {
    render(
      <ParcelList
        rows={[
          row(1, { shipment: { status: "assigned", booked: false, readyToShip: false, needsAction: false }, itemsWeighed: false }),
          row(2, { courier: { ...pathao, whatsappE164: null }, handoffSent: false, shipment: { status: "assigned", booked: false, readyToShip: false, needsAction: false } }),
        ]}
        context={context}
        canWrite
        canManageDelivery={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Add the weight" })).toHaveAttribute("href", "/admin/orders/GT261007001");
    expect(screen.getByText(/Ask someone with delivery access to add Pathao/)).toBeInTheDocument();
  });

  it("shows read-only staff the state without action buttons", () => {
    render(<ParcelList rows={[row(1, { orderStatus: "pending_confirmation", courier: null, routedCourierName: "Daraz Express", handoffSent: false }), row(2)]} context={context} canWrite={false} canManageDelivery={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View order" })).toHaveLength(2);
  });
});

describe("courierLabel", () => {
  it("names Daraz when an API courier is called something else", () => {
    expect(courierLabel({ name: "Nepal Can Move", daraz: true })).toBe("Nepal Can Move (Daraz Express)");
    expect(courierLabel({ name: "Daraz Express", daraz: true })).toBe("Daraz Express");
    expect(courierLabel({ name: "Pathao", daraz: false })).toBe("Pathao");
  });
});

describe("ParcelRefresh", () => {
  it("checks stale Daraz parcels once when the page opens", async () => {
    render(<ParcelRefresh staleOrderIds={[ID(1), ID(2)]} openOrderIds={[ID(1), ID(2), ID(3)]} />);
    await waitFor(() => expect(bulkDarazAction).toHaveBeenCalledTimes(1));
    const form = vi.mocked(bulkDarazAction).mock.calls[0]![1];
    expect([form.get("operation"), form.get("orderIds")]).toEqual(["refresh", `${ID(1)},${ID(2)}`]);

    fireEvent.click(await screen.findByRole("button", { name: "Refresh tracking" }));
    await waitFor(() => expect(bulkDarazAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(bulkDarazAction).mock.calls[1]![1].get("orderIds")).toBe(`${ID(1)},${ID(2)},${ID(3)}`);
  });
});

describe("SendResultCard", () => {
  const base = { ok: true as const, orderId: ID(9), orderNumber: "GT2610071234" };

  it("shows the tracking number and the label button after a Daraz booking", () => {
    render(<SendResultCard order={{ ...base, kind: "booked", courierName: "Daraz Express", trackingNumber: "NPDEX1001", message: "Booked" }} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Order #GT2610071234 sent to Daraz Express");
    expect(screen.getByText(/Tracking number NPDEX1001/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Print label & call pickup/ })).toBeInTheDocument();
  });

  it("offers WhatsApp for other couriers and warns when a step needs a person", () => {
    const { unmount } = render(
      <SendResultCard order={{ ...base, kind: "whatsapp", courierName: "Pathao", whatsappHref: "https://wa.me/9779801234567", message: "Accepted for Pathao." }} onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole("link", { name: /Send on WhatsApp/ })).toBeInTheDocument();
    unmount();
    render(<SendResultCard order={{ ...base, kind: "attention", message: "Accepted, but not booked." }} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Accepted, but not booked.");
    expect(screen.getByRole("link", { name: "Open the order" })).toHaveAttribute("href", "/admin/orders/GT2610071234");
  });
});

describe("AutopilotCard", () => {
  const status: AutopilotStatus = {
    autoAcceptWebsite: false,
    autoAcceptWhatsapp: false,
    courierModeAuto: false,
    darazAutoBook: false,
    codEnabled: true,
    fallbackCourier: null,
    darazConnected: false,
    darazCourier: true,
    darazSetupMissing: ["pickup phone"],
    usualWeightGrams: null,
    unweighedVariants: 41,
  };

  it("shows what would stop it and turns it on with the usual weight", () => {
    render(<AutopilotCard status={status} canChange />);
    expect(screen.getByRole("heading", { name: /Autopilot Off/ })).toBeInTheDocument();
    expect(screen.getByText("Waiting for the Daraz keys. Other couriers still work.")).toBeInTheDocument();
    expect(screen.getByText(/Missing: pickup phone/)).toBeInTheDocument();
    expect(screen.getByText("41 products have no weight. Set a usual parcel weight below.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Turn on Autopilot" });
    expect(button).toHaveAttribute("name", "enabled");
    expect(button).toHaveAttribute("value", "on");
    expect(screen.getByLabelText(/Usual parcel weight/)).toHaveAttribute("name", "usualWeightGrams");
  });

  it("says partly on, and offers both directions", () => {
    render(<AutopilotCard status={{ ...status, autoAcceptWebsite: true }} canChange />);
    expect(screen.getByRole("heading", { name: /Partly on/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn on fully" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn off" })).toHaveAttribute("value", "off");
  });

  it("hides the switch from staff who can't change it", () => {
    render(<AutopilotCard status={{ ...status, autoAcceptWebsite: true, autoAcceptWhatsapp: true, courierModeAuto: true, darazAutoBook: true }} canChange={false} />);
    expect(screen.getByRole("heading", { name: /Autopilot On/ })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Only the owner/)).toBeInTheDocument();
  });
});
