import { describe, expect, it } from "vitest";
import { buildOrderSteps } from "./stepper";
import type { OrderTracking } from "./tracking-model";

function order(overrides: Partial<OrderTracking> = {}): OrderTracking {
  return {
    orderNumber: "GT250318123456",
    placedAt: "2025-03-18T04:39:00Z",
    status: "pending_confirmation",
    paymentStatus: "pending",
    address: {
      recipientName: "Aarushi Shrestha",
      phoneE164: "+9779841234567",
      provinceName: "Bagmati Province",
      districtName: "Kathmandu",
      municipalityName: "Kathmandu Metropolitan City",
      ward: 26,
      streetLandmark: "Thamel",
      postalCode: "44600",
      latitude: null,
      longitude: null,
    },
    delivery: {
      serviceName: "Standard Delivery",
      serviceLevel: "standard",
      courierName: "Pathao",
      pricePaisa: 10000,
      estimatedMinDays: 3,
      estimatedMaxDays: 5,
    },
    subtotalPaisa: 629800,
    discountPaisa: 0,
    deliveryFeePaisa: 10000,
    totalPaisa: 639800,
    couponCode: null,
    note: null,
    confirmedAt: null,
    packedAt: null,
    shippedAt: null,
    deliveredAt: null,
    canceledAt: null,
    cancellationReason: null,
    items: [],
    shipment: {
      status: "awaiting_assignment",
      trackingNumber: null,
      estimatedFrom: "2025-03-21",
      estimatedTo: "2025-03-23",
      courier: null,
    },
    events: [],
    ...overrides,
  };
}

describe("buildOrderSteps", () => {
  it("marks the placed step done in Nepal time and the next one current", () => {
    const steps = buildOrderSteps(order());
    expect(steps.map((step) => step.state)).toEqual(["done", "current", "upcoming", "upcoming", "upcoming", "upcoming"]);
    // 04:39 UTC = 10:24 in Kathmandu (UTC+05:45).
    expect(steps[0]).toMatchObject({ label: "Order Placed", detail: "18 Mar, 10:24 AM" });
  });

  it("shows expected dates only from the shipment estimate", () => {
    const steps = buildOrderSteps(order());
    expect(steps[4]!.detail).toBe("Expected 21 Mar");
    expect(steps[5]!.detail).toBe("Expected 21 Mar – 23 Mar");
    const noEstimate = buildOrderSteps(order({ shipment: null }));
    expect(noEstimate[5]!.detail).toBeNull();
  });

  it("uses shipment events for out for delivery", () => {
    const steps = buildOrderSteps(
      order({
        status: "shipped",
        confirmedAt: "2025-03-18T05:00:00Z",
        packedAt: "2025-03-18T08:30:00Z",
        shippedAt: "2025-03-19T03:45:00Z",
        events: [{ status: "out_for_delivery", message: "Out for delivery", locationLabel: null, occurredAt: "2025-03-21T03:00:00Z" }],
      }),
    );
    expect(steps.map((step) => step.state)).toEqual(["done", "done", "done", "done", "done", "current"]);
  });

  it("stops progress on a canceled order", () => {
    const steps = buildOrderSteps(order({ status: "canceled", canceledAt: "2025-03-18T06:00:00Z" }));
    expect(steps.filter((step) => step.state === "current")).toEqual([]);
    expect(steps[5]!.detail).toBeNull();
  });
});

describe("date formatting", () => {
  it("uses three-letter months", async () => {
    const { formatCalendarRange, formatOrderDateTime } = await import("./format");
    expect(formatCalendarRange("2026-09-28", "2026-09-29")).toBe("28 Sep 2026 – 29 Sep 2026");
    expect(formatOrderDateTime("2026-09-27T13:16:00Z")).toBe("27 Sep 2026, 7:01 PM");
  });
});
