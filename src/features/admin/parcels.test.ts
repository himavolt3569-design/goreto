import { describe, expect, it } from "vitest";
import { autopilotState, parcelProgress, parcelStep, stepCopy, type ParcelContext, type ParcelState } from "./parcels";

const daraz = { name: "Daraz Express", daraz: true, whatsappE164: null };
const pathao = { name: "Pathao", daraz: false, whatsappE164: "+9779801234567" };

const parcel = (overrides: Partial<ParcelState> = {}): ParcelState => ({
  orderStatus: "confirmed",
  paymentStatus: "pending",
  courier: daraz,
  routedCourierName: null,
  shipment: { status: "awaiting_assignment", booked: false, readyToShip: false, needsAction: false },
  handoffSent: false,
  itemsWeighed: true,
  ...overrides,
});
const booked = (status: ParcelState["orderStatus"] = "confirmed", shipment: Partial<NonNullable<ParcelState["shipment"]>> = {}) =>
  parcel({ orderStatus: status, handoffSent: true, shipment: { status: "assigned", booked: true, readyToShip: false, needsAction: false, ...shipment } });

const live: ParcelContext = { darazConnected: true, usualWeightGrams: null };

describe("parcelStep", () => {
  it("asks to accept pending orders, naming the routed courier", () => {
    expect(parcelStep(parcel({ orderStatus: "pending_confirmation", courier: null, routedCourierName: "Daraz Express" }), live)).toEqual({ kind: "accept", courierName: "Daraz Express" });
    expect(parcelStep(parcel({ orderStatus: "pending_confirmation", courier: null }), live)).toEqual({ kind: "accept", courierName: null });
  });

  it("books Daraz when connected and weighed, otherwise says what's missing", () => {
    expect(parcelStep(parcel(), live).kind).toBe("book");
    expect(parcelStep(parcel(), { darazConnected: false, usualWeightGrams: 500 }).kind).toBe("daraz_offline");
    expect(parcelStep(parcel({ itemsWeighed: false }), live).kind).toBe("needs_weight");
    expect(parcelStep(parcel({ itemsWeighed: false }), { darazConnected: true, usualWeightGrams: 500 }).kind).toBe("book");
  });

  it("walks a booked Daraz parcel through label, pickup and delivery", () => {
    expect(parcelStep(booked(), live).kind).toBe("print_and_ready");
    expect(parcelStep(booked("confirmed", { readyToShip: true }), live).kind).toBe("awaiting_pickup");
    expect(parcelStep(booked("shipped", { status: "in_transit", readyToShip: true }), live)).toEqual({ kind: "on_the_way", courierName: "Daraz Express" });
    expect(parcelStep(booked("shipped", { status: "out_for_delivery" }), live).kind).toBe("out_for_delivery");
    expect(parcelStep(booked("shipped", { status: "in_transit", needsAction: true }), live).kind).toBe("failed_delivery");
    expect(parcelStep(booked("shipped", { status: "exception" }), live).kind).toBe("failed_delivery");
    expect(parcelStep({ ...booked("delivered", { status: "delivered" }), paymentStatus: "collected" }, live)).toEqual({ kind: "delivered", cashCollected: true });
    expect(parcelStep(booked("shipped", { status: "returned" }), live).kind).toBe("returned");
  });

  it("sends other couriers the order on WhatsApp, or asks for their number", () => {
    expect(parcelStep(parcel({ courier: pathao }), live)).toEqual({ kind: "send_whatsapp", courierName: "Pathao" });
    expect(parcelStep(parcel({ courier: { ...pathao, whatsappE164: null } }), live)).toEqual({ kind: "needs_courier_number", courierName: "Pathao" });
    expect(parcelStep(parcel({ courier: pathao, handoffSent: true, shipment: { status: "assigned", booked: false, readyToShip: false, needsAction: false } }), live)).toEqual({ kind: "sent", courierName: "Pathao" });
    expect(parcelStep(parcel({ courier: pathao, orderStatus: "shipped", handoffSent: true }), live).kind).toBe("on_the_way");
    expect(parcelStep(parcel({ courier: pathao, shipment: { status: "exception", booked: false, readyToShip: false, needsAction: false } }), live).kind).toBe("problem");
  });

  it("handles canceled orders and accepted orders without a courier", () => {
    expect(parcelStep(parcel({ orderStatus: "canceled" }), live).kind).toBe("canceled");
    expect(parcelStep(parcel({ courier: null }), live).kind).toBe("no_courier");
  });
});

describe("stepCopy", () => {
  it("gives a button only when there's something to do", () => {
    expect(stepCopy({ kind: "accept", courierName: "Daraz Express" }).action).toBe("Accept & send to Daraz Express");
    expect(stepCopy({ kind: "print_and_ready" }).action).toBe("Print label & call pickup");
    expect(stepCopy({ kind: "awaiting_pickup" }).action).toBeNull();
    expect(stepCopy({ kind: "delivered", cashCollected: true }).status).toBe("Delivered, cash collected");
    expect(stepCopy({ kind: "returned" }).action).toBe("Open the order");
  });
});

describe("parcelProgress", () => {
  it("counts accepted, sent, on the way and delivered", () => {
    expect(parcelProgress(parcel({ orderStatus: "pending_confirmation" }))).toBe(-1);
    expect(parcelProgress(parcel({ orderStatus: "canceled" }))).toBe(-1);
    expect(parcelProgress(parcel())).toBe(0);
    expect(parcelProgress(booked())).toBe(1);
    expect(parcelProgress(parcel({ courier: pathao, handoffSent: true }))).toBe(1);
    expect(parcelProgress(booked("shipped", { status: "in_transit" }))).toBe(2);
    expect(parcelProgress(booked("delivered", { status: "delivered" }))).toBe(3);
  });
});

describe("autopilotState", () => {
  const all = { autoAcceptWebsite: true, autoAcceptWhatsapp: true, courierModeAuto: true, darazAutoBook: true };

  it("is on only when every switch is on", () => {
    expect(autopilotState(all)).toEqual({ state: "on", on: ["accept website orders", "accept WhatsApp orders", "pick the courier", "book Daraz"], off: [] });
  });

  it("is partly on when some automatic step runs, and names what's off", () => {
    expect(autopilotState({ ...all, darazAutoBook: false })).toMatchObject({ state: "partly", off: ["book Daraz"] });
    expect(autopilotState({ autoAcceptWebsite: false, autoAcceptWhatsapp: false, courierModeAuto: false, darazAutoBook: true }).state).toBe("partly");
  });

  it("is off when nothing is automatic, even with the courier mode on auto", () => {
    expect(autopilotState({ autoAcceptWebsite: false, autoAcceptWhatsapp: false, courierModeAuto: true, darazAutoBook: false }).state).toBe("off");
  });
});
