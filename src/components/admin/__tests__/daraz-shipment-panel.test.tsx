import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshDarazTrackingAction } from "@/features/admin/actions/daraz";
import type { DarazShipment } from "@/features/admin/queries/daraz";
import { DarazShipmentPanel, type DarazPanelProps } from "../daraz-shipment-panel";

vi.mock("@/features/admin/actions/daraz", () => ({
  bookDarazAction: vi.fn(),
  cancelDarazBookingAction: vi.fn(),
  createDarazSupportCaseAction: vi.fn(),
  darazFeedbackAction: vi.fn(),
  proofOfDeliveryAction: vi.fn(),
  quoteDarazAction: vi.fn(),
  readyToShipDarazAction: vi.fn(),
  refreshDarazTrackingAction: vi.fn(async () => ({ ok: true, message: "Tracking is up to date." })),
  updateDarazReceiverAction: vi.fn(),
}));

const ORDER_ID = "e63365dd-2c34-5efa-88d6-f4c99a6badf0";

const shipment = (overrides: Partial<DarazShipment> = {}): DarazShipment => ({
  id: "s1",
  status: "assigned",
  courierApiProvider: "daraz",
  serviceOption: "standard",
  trackingNumber: null,
  packageCode: null,
  reference: null,
  bookingAttempts: 0,
  providerStatus: null,
  needsAction: false,
  lastMileProvider: null,
  deliveryOption: null,
  firstMileType: null,
  pickupCutoffAt: null,
  bookedAt: null,
  awbPrintedAt: null,
  readyToShipAt: null,
  canceledAt: null,
  syncedAt: null,
  estimatedFrom: null,
  estimatedTo: null,
  package: { weightGrams: null, lengthCm: null, widthCm: null, heightCm: null },
  receiver: null,
  estimatedFeePaisa: null,
  actualFeePaisa: null,
  remittanceId: null,
  ...overrides,
});

const booked = (overrides: Partial<DarazShipment> = {}) =>
  shipment({
    trackingNumber: "NPDEX1001",
    packageCode: "FU-1",
    reference: "GT260101000001",
    bookingAttempts: 1,
    bookedAt: "2026-10-07T04:00:00Z",
    syncedAt: new Date().toISOString(),
    package: { weightGrams: 750, lengthCm: 30, widthCm: 20, heightCm: 10 },
    estimatedFeePaisa: 15_500,
    ...overrides,
  });

const props = (overrides: Partial<DarazPanelProps> = {}): DarazPanelProps => ({
  orderId: ORDER_ID,
  orderNumber: "GT260101000001",
  bookable: true,
  configured: true,
  liveGateway: true,
  setupMissing: [],
  setupHref: "/admin/daraz?tab=setup",
  canWrite: true,
  shipment: shipment(),
  suggestedWeightGrams: 700,
  usualWeightGrams: null,
  defaultOption: "standard",
  defaultOpenBox: false,
  boxPresets: [{ name: "Small", length_cm: 20, width_cm: 15, height_cm: 5 }],
  mappedLocation: false,
  recipient: { name: "Sita Gurung", phoneE164: "+9779812345678", details: "Lakeside, Pokhara" },
  supportCases: [],
  ...overrides,
});

beforeEach(() => vi.mocked(refreshDarazTrackingAction).mockClear());

describe("DarazShipmentPanel", () => {
  it("points to setup until Daraz is connected", () => {
    render(<DarazShipmentPanel {...props({ configured: false })} />);
    expect(screen.getByText(/isn.t connected yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Daraz setup" })).toHaveAttribute("href", "/admin/daraz?tab=setup");
    expect(screen.queryByRole("button", { name: /Book with Daraz/ })).not.toBeInTheDocument();
  });

  it("lists missing setup and offers no booking until it's done", () => {
    render(<DarazShipmentPanel {...props({ setupMissing: ["platform name", "pickup phone"] })} />);
    expect(screen.getByText(/Finish Daraz setup before booking: platform name, pickup phone\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Book with Daraz/ })).not.toBeInTheDocument();
  });

  it("offers booking for an accepted order, and nothing for staff who can only read", () => {
    const { unmount } = render(<DarazShipmentPanel {...props()} />);
    expect(screen.getByRole("button", { name: /Book with Daraz/ })).toBeInTheDocument();
    unmount();
    render(<DarazShipmentPanel {...props({ canWrite: false })} />);
    expect(screen.queryByRole("button", { name: /Book with Daraz/ })).not.toBeInTheDocument();
  });

  it("says when booking isn't possible yet and mentions a canceled booking", () => {
    render(<DarazShipmentPanel {...props({ bookable: false, shipment: shipment({ canceledAt: "2026-10-07T05:00:00Z" }) })} />);
    expect(screen.getByText(/Booking opens once the order is accepted/)).toBeInTheDocument();
    expect(screen.getByText(/previous booking was canceled/)).toBeInTheDocument();
  });

  it("shows a booking with its label, ready-to-ship and cancel actions", () => {
    render(<DarazShipmentPanel {...props({ shipment: booked() })} />);
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("NPDEX1001")).toBeInTheDocument();
    expect(screen.getByText(/Rs\.? ?155.*\(estimate\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Print label/ })).toHaveAttribute("href", `/admin/daraz/labels?orders=${ORDER_ID}&type=pdf`);
    expect(screen.getByRole("link", { name: /Thermal label/ })).toHaveAttribute("href", `/admin/daraz/labels?orders=${ORDER_ID}&type=zpl`);
    expect(screen.getByRole("button", { name: /Ready to ship/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel booking/ })).toBeInTheDocument();
    // Receiver changes go to Daraz only after ready-to-ship.
    expect(screen.queryByRole("button", { name: /Edit delivery details/ })).not.toBeInTheDocument();
  });

  it("asks for a decision after a failed delivery", () => {
    render(<DarazShipmentPanel {...props({ shipment: booked({ status: "exception", needsAction: true, readyToShipAt: "2026-10-07T05:00:00Z" }) })} />);
    expect(screen.getByText("Needs action")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Re-attempt or return/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit delivery details/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel booking/ })).not.toBeInTheDocument();
  });

  it("offers proof of delivery and no label once delivered", () => {
    render(<DarazShipmentPanel {...props({ shipment: booked({ status: "delivered", actualFeePaisa: 14_000 }) })} />);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View proof of delivery/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Print label/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refresh tracking/ })).not.toBeInTheDocument();
  });

  it("refreshes stale tracking once when opened, and not when it's fresh", async () => {
    const { unmount } = render(<DarazShipmentPanel {...props({ shipment: booked({ syncedAt: "2026-10-01T00:00:00Z", status: "in_transit" }) })} />);
    await waitFor(() => expect(refreshDarazTrackingAction).toHaveBeenCalledWith(ORDER_ID));
    expect(await screen.findByText("Tracking is up to date.")).toBeInTheDocument();
    unmount();
    vi.mocked(refreshDarazTrackingAction).mockClear();
    render(<DarazShipmentPanel {...props({ shipment: booked({ status: "in_transit" }) })} />);
    await new Promise((done) => setTimeout(done, 20));
    expect(refreshDarazTrackingAction).not.toHaveBeenCalled();
  });

  it("links the order's support cases", () => {
    render(<DarazShipmentPanel {...props({ shipment: booked(), supportCases: [{ caseId: "991", subject: "Damaged", status: null }] })} />);
    expect(screen.getByRole("link", { name: "#991" })).toHaveAttribute("href", "/admin/daraz?tab=support&case=991");
  });
});
