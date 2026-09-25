import {
  couponSeeds,
  customerNotes,
  failedDeliveryReason,
  festivalNotes,
  preDispatchCancelReasons,
  teejNotes,
  type CouponSeed,
} from "../data/commerce.ts";
import { seedId, sha256Hex } from "../lib/ids.ts";
import { rngFor, type Rng } from "../lib/random.ts";
import {
  DAY,
  HOUR,
  NOW,
  STORE_LAUNCH,
  atNptTime,
  iso,
  minutes,
  npt,
  nptCompactDate,
  nptDate,
  nptParts,
  nptStartOfDay,
} from "../lib/time.ts";
import type {
  AddressSnapshot,
  CouponRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  PaymentStatus,
  SeedLine,
  ShipmentEventRow,
  ShipmentRow,
  ShipmentStatus,
} from "../types.ts";
import { unitPriceAt, type SimProduct, type SimVariant } from "./catalog.ts";
import type { SimRate } from "./delivery.ts";
import { addressSnapshot, pickMunicipality, type Customer, type PersonFactory } from "./people.ts";

/* ---------- Calendar ---------- */

const d = (year: number, month: number, day: number) => npt(year, month, day);

type Window = { from: number; to: number };
const span = (from: number, toInclusive: number): Window => ({ from, to: toInclusive + DAY });
const inWindow = (at: number, range: Window) => at >= range.from && at < range.to;

const DASHAIN_2025 = span(d(2025, 9, 20), d(2025, 10, 1));
const POST_DASHAIN_2025 = span(d(2025, 10, 2), d(2025, 10, 6));
const TIHAR_2025 = span(d(2025, 10, 12), d(2025, 10, 22));
const WINTER_SALE = span(d(2025, 12, 1), d(2025, 12, 15));
const NEW_YEAR_2083 = span(d(2026, 4, 9), d(2026, 4, 14));
const FLASH_SALE = span(d(2026, 7, 10), d(2026, 7, 12));
const TEEJ_2026 = span(d(2026, 8, 25), d(2026, 9, 14));

function demandFor(dayStart: number, dayIndex: number, totalDays: number): number {
  let lambda = 2 + 7 * (dayIndex / totalDays) ** 1.1;
  if (inWindow(dayStart, DASHAIN_2025)) lambda *= 2.1;
  if (inWindow(dayStart, POST_DASHAIN_2025)) lambda *= 0.5;
  if (inWindow(dayStart, TIHAR_2025)) lambda *= 1.7;
  if (inWindow(dayStart, WINTER_SALE)) lambda *= 1.3;
  if (inWindow(dayStart, NEW_YEAR_2083)) lambda *= 1.5;
  if (inWindow(dayStart, FLASH_SALE)) lambda *= 1.6;
  if (inWindow(dayStart, TEEJ_2026)) lambda *= 1.4;
  const { month, weekday } = nptParts(dayStart + 12 * HOUR);
  if (weekday === 6) lambda *= 1.2;
  if (month === 7) lambda *= 0.9;
  return lambda;
}

const HOUR_WEIGHTS: (readonly [number, number])[] = [
  0.2, 0.1, 0.05, 0.05, 0.05, 0.1, 0.3, 0.6, 0.9, 1.1, 1.3, 1.4,
  1.5, 1.5, 1.3, 1.2, 1.2, 1.3, 1.6, 2.0, 2.2, 2.0, 1.3, 0.6,
].map((weight, hour) => [hour, weight] as const);

function seasonalFactor(product: SimProduct, at: number): number {
  const { month } = nptParts(at);
  let factor = 1;
  const winterMonth = month >= 11 || month <= 2;
  const summerMonth = month >= 5 && month <= 8;
  if (product.tags.has("winter")) factor *= winterMonth ? 2 : summerMonth ? 0.35 : 1;
  if (product.tags.has("summer")) factor *= summerMonth ? 1.8 : winterMonth ? 0.4 : 1;
  if (product.tags.has("monsoon")) factor *= month >= 6 && month <= 9 ? 1.8 : 0.7;
  const festiveWindow = inWindow(at, DASHAIN_2025) || inWindow(at, TIHAR_2025);
  if (festiveWindow && (product.tags.has("festive") || product.tags.has("dashain") || product.tags.has("dhaka"))) factor *= 2.5;
  if (inWindow(at, TEEJ_2026) && (product.tags.has("teej") || product.tags.has("pote"))) factor *= 3;
  if (at - product.createdAt < 21 * DAY) factor *= 1.5;
  return factor;
}

/* ---------- Business-hours helpers ---------- */

/** Move `at` into the NPT working window [startHour, endHour), jittered when pushed forward. */
function withinHours(rng: Rng, at: number, startHour: number, endHour: number): number {
  const { hour } = nptParts(at);
  if (hour >= startHour && hour < endHour) return at;
  const base = hour < startHour ? atNptTime(at, startHour) : atNptTime(at + DAY, startHour);
  return base + minutes(rng.int(0, 90));
}

/* ---------- Coupons ---------- */

type SimCoupon = {
  seed: CouponSeed;
  id: string;
  startsAt: number;
  endsAt: number | null;
  used: number;
  usedBy: Map<string, number>;
};

function toDayStart(date: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return npt(year, month, day);
}

function discountFor(coupon: CouponSeed, subtotal: number): number {
  if (coupon.type === "fixed") return Math.min((coupon.amountOff ?? 0) * 100, subtotal);
  const raw = Math.floor((subtotal * (coupon.percentOff ?? 0)) / 100 / 100) * 100;
  return coupon.maxDiscount === undefined ? raw : Math.min(raw, coupon.maxDiscount * 100);
}

/* ---------- Output for later stages ---------- */

export type DeliveredItem = {
  orderItemId: string;
  productId: string;
  deliveredAt: number;
  refunded: boolean;
  town: string;
  transitDays: number;
};

export type SimOrder = {
  id: string;
  customerId: string | null;
  placedAt: number;
  status: OrderStatus;
};

export type OrdersResult = {
  lines: {
    coupons: SeedLine<"coupons">[];
    orders: SeedLine<"orders">[];
    order_items: SeedLine<"order_items">[];
    shipments: SeedLine<"shipments">[];
    shipment_events: SeedLine<"shipment_events">[];
  };
  orders: SimOrder[];
  deliveredItemsByCustomer: Map<string, DeliveredItem[]>;
  lastOrderAtByCustomer: Map<string, number>;
};

type Outcome = "normal" | "cancel_pre_dispatch" | "failed_delivery" | "refunded";

type Milestones = {
  placed: number;
  confirmed: number | null;
  processing: number | null;
  packed: number | null;
  pickedUp: number | null;
  inTransit: number | null;
  outForDelivery: number | null;
  delivered: number | null;
  exception1: number | null;
  secondAttempt: number | null;
  exception2: number | null;
  returned: number | null;
  canceled: number | null;
  refunded: number | null;
};

/* ---------- Simulation ---------- */

export function buildOrders(input: {
  products: SimProduct[];
  customers: Customer[];
  persons: PersonFactory;
  ratesByDistrict: Map<string, SimRate[]>;
}): OrdersResult {
  const rng = rngFor("orders");
  const lines: OrdersResult["lines"] = { coupons: [], orders: [], order_items: [], shipments: [], shipment_events: [] };
  const orders: SimOrder[] = [];
  const deliveredItemsByCustomer = new Map<string, DeliveredItem[]>();
  const lastOrderAtByCustomer = new Map<string, number>();
  const orderCountByCustomer = new Map<string, number>();
  const orderNumbers = new Set<string>();
  const trackingNumbers = new Set<string>();

  const coupons: SimCoupon[] = couponSeeds.map((seed) => ({
    seed,
    id: seedId("coupon", seed.code),
    startsAt: toDayStart(seed.starts),
    endsAt: seed.ends === null ? null : toDayStart(seed.ends) + DAY - 1000,
    used: 0,
    usedBy: new Map(),
  }));

  const customersBySignup = [...input.customers].sort((a, b) => a.signupAt - b.signupAt);
  const sellable = input.products.filter((product) => product.status !== "draft");

  const totalDays = Math.ceil((NOW - STORE_LAUNCH) / DAY);
  let signupCursor = 0;
  const eligibleCustomers: Customer[] = [];

  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex += 1) {
    const dayStart = STORE_LAUNCH + dayIndex * DAY;
    if (dayStart > NOW) break;
    const count = rng.poisson(demandFor(dayStart, dayIndex, totalDays));
    const times = Array.from({ length: count }, () => dayStart + rng.weighted(HOUR_WEIGHTS) * HOUR + minutes(rng.int(0, 59)) + rng.int(0, 59) * 1000)
      .filter((at) => at < NOW - minutes(5))
      .sort((a, b) => a - b);

    for (const placedAt of times) {
      while (signupCursor < customersBySignup.length && customersBySignup[signupCursor]!.signupAt <= placedAt) {
        const customer = customersBySignup[signupCursor]!;
        if (customer.addresses.length > 0) eligibleCustomers.push(customer);
        signupCursor += 1;
      }

      /* Who */
      let customer: Customer | null = null;
      let address: AddressSnapshot | null = null;
      if (eligibleCustomers.length > 0 && rng.chance(0.7)) {
        for (let attempt = 0; attempt < 6 && !address; attempt += 1) {
          const candidate = rng.weighted(eligibleCustomers.map((item) => [item, item.orderWeight] as const));
          const usable = candidate.addresses.filter((item) => item.createdAt <= placedAt);
          if (usable.length === 0) continue;
          const chosen = usable.find((item) => item.isDefault) && rng.chance(0.8) ? usable.find((item) => item.isDefault)! : rng.pick(usable);
          customer = candidate;
          address = chosen.snapshot;
        }
      }
      const guest = customer === null ? input.persons.create() : null;
      if (!address) address = addressSnapshot(rng, pickMunicipality(rng), guest!, rng.chance(0.3));
      const contact = customer ? customer.person : guest!;

      /* What */
      const available = sellable.filter(
        (product) =>
          product.createdAt + HOUR <= placedAt &&
          (product.archivedAt === null || product.archivedAt > placedAt) &&
          product.variants.some((variant) => variant.isActive),
      );
      const lineCount = rng.weighted([[1, 0.6], [2, 0.28], [3, 0.09], [4, 0.03]] as const);
      const chosen: { product: SimProduct; variant: SimVariant; quantity: number }[] = [];
      const used = new Set<string>();
      for (let attempt = 0; chosen.length < lineCount && attempt < 20; attempt += 1) {
        const product = rng.weighted(available.map((item) => [item, item.popularity * seasonalFactor(item, placedAt)] as const));
        if (used.has(product.id)) continue;
        used.add(product.id);
        const variant = rng.weighted(product.variants.filter((item) => item.isActive).map((item) => [item, item.weight] as const));
        const quantity = rng.weighted([[1, 0.88], [2, 0.1], [3, 0.02]] as const);
        chosen.push({ product, variant, quantity });
      }

      const orderNumber = uniqueCode(rng, orderNumbers, () => `GT${nptCompactDate(placedAt)}${String(rng.int(0, 9999)).padStart(4, "0")}`);
      const orderId = seedId("order", orderNumber);

      const itemRows: OrderItemRow[] = chosen.map(({ product, variant, quantity }, index) => {
        const unit = unitPriceAt(product, variant, placedAt);
        return {
          id: seedId("order-item", orderNumber, index + 1),
          order_id: orderId,
          product_id: product.id,
          variant_id: variant.id,
          product_title: product.title,
          variant_title: variant.title,
          sku: variant.sku,
          image_path: product.coverPath,
          unit_price_paisa: unit,
          quantity,
          line_total_paisa: unit * quantity,
          created_at: iso(placedAt),
        };
      });
      const subtotal = itemRows.reduce((sum, row) => sum + row.line_total_paisa, 0);

      /* Coupon */
      const customerKey = customer ? customer.id : contact.email;
      const priorOrders = customer ? (orderCountByCustomer.get(customer.id) ?? 0) : 0;
      let coupon: SimCoupon | null = null;
      for (const candidate of coupons) {
        const { seed } = candidate;
        if (!seed.isActive || seed.uptake <= 0) continue;
        if (placedAt < candidate.startsAt || (candidate.endsAt !== null && placedAt > candidate.endsAt)) continue;
        if (seed.usageLimit !== null && candidate.used >= seed.usageLimit) continue;
        if (seed.minOrder !== undefined && subtotal < seed.minOrder * 100) continue;
        if (seed.perCustomer !== null && (candidate.usedBy.get(customerKey) ?? 0) >= seed.perCustomer) continue;
        if (seed.firstOrderOnly && (!customer || priorOrders > 0)) continue;
        if (rng.chance(seed.uptake)) {
          coupon = candidate;
          break;
        }
      }
      const discount = coupon ? discountFor(coupon.seed, subtotal) : 0;
      if (coupon) {
        coupon.used += 1;
        coupon.usedBy.set(customerKey, (coupon.usedBy.get(customerKey) ?? 0) + 1);
      }

      /* Delivery */
      const rates = input.ratesByDistrict.get(address.district_code);
      if (!rates || rates.length === 0) throw new Error(`No delivery rate for district ${address.district_code}`);
      const levelWeight = { standard: 0.65, express: 0.2, pickup: 0.15 } as const;
      const rate = rng.weighted(rates.map((item) => [item, levelWeight[item.level]] as const));
      const total = subtotal - discount + rate.pricePaisa;

      /* Timeline */
      const outcome = rng.weighted([["normal", 0.88], ["cancel_pre_dispatch", 0.06], ["failed_delivery", 0.03], ["refunded", 0.03]] as const) as Outcome;
      const milestones = planTimeline(rng, placedAt, rate, outcome);
      const seen = (at: number | null) => (at !== null && at <= NOW ? at : null);

      const canceledAt = seen(milestones.canceled);
      const deliveredAt = seen(milestones.delivered);
      const refundedAt = seen(milestones.refunded);
      let status: OrderStatus;
      if (canceledAt !== null) status = "canceled";
      else if (deliveredAt !== null) status = "delivered";
      else if (seen(milestones.pickedUp) !== null) status = "shipped";
      else if (seen(milestones.packed) !== null) status = "packed";
      else if (seen(milestones.processing) !== null) status = "processing";
      else if (seen(milestones.confirmed) !== null) status = "confirmed";
      else status = "pending_confirmation";

      let paymentStatus: PaymentStatus = "pending";
      if (status === "canceled") paymentStatus = "failed";
      else if (status === "delivered") paymentStatus = refundedAt !== null ? "refunded" : "collected";

      const cancellationReason =
        status === "canceled"
          ? outcome === "failed_delivery"
            ? rate.level === "pickup"
              ? "Parcel was not collected from the pickup point; returned to the store."
              : failedDeliveryReason
            : rng.pick(preDispatchCancelReasons)
          : null;

      /* Shipment + events */
      const shipmentId = seedId("shipment", orderNumber);
      const events = shipmentEvents(rate, address, milestones);
      const visibleEvents = events.filter((event) => event.at <= NOW);
      const lastEvent = visibleEvents[visibleEvents.length - 1]!;
      const assignedAt = seen(milestones.packed);
      const trackingNumber =
        assignedAt === null
          ? null
          : uniqueCode(rng, trackingNumbers, () => `${rate.trackingPrefix}${nptCompactDate(assignedAt)}${String(rng.int(0, 9999)).padStart(4, "0")}`);

      visibleEvents.forEach((event, index) => {
        lines.shipment_events.push({
          table: "shipment_events",
          data: {
            id: seedId("shipment-event", orderNumber, index + 1),
            shipment_id: shipmentId,
            status: event.status,
            message: event.message,
            location_label: event.location,
            latitude: null,
            longitude: null,
            source: event.source,
            occurred_at: iso(event.at),
            created_at: iso(Math.min(event.at + minutes(rng.int(0, 20)), NOW)),
          } satisfies ShipmentEventRow,
        });
      });

      lines.shipments.push({
        table: "shipments",
        data: {
          id: shipmentId,
          order_id: orderId,
          courier_id: assignedAt === null ? null : rate.courierId,
          courier_service_id: rate.serviceId,
          tracking_number: trackingNumber,
          status: lastEvent.status,
          estimated_delivery_from: nptDate(placedAt + rate.minDays * DAY),
          estimated_delivery_to: nptDate(placedAt + rate.maxDays * DAY),
          assigned_at: assignedAt === null ? null : iso(assignedAt),
          delivered_at: deliveredAt === null ? null : iso(deliveredAt),
          created_at: iso(placedAt),
          updated_at: iso(lastEvent.at),
        } satisfies ShipmentRow,
      });

      /* Order */
      const note = rng.chance(0.15) ? noteFor(rng, placedAt) : null;
      const trackingSecret = customer ? null : randomToken(rng, 24);
      const stamps = [placedAt, milestones.confirmed, milestones.packed, milestones.pickedUp, deliveredAt, canceledAt, refundedAt, lastEvent.at]
        .map(seen)
        .filter((value): value is number => value !== null);

      lines.orders.push({
        table: "orders",
        data: {
          id: orderId,
          order_number: orderNumber,
          user_id: customer ? customer.id : null,
          contact_name: contact.fullName,
          contact_email: contact.email,
          contact_phone_e164: contact.phone,
          shipping_address: address,
          status,
          payment_method: "cod",
          payment_status: paymentStatus,
          currency: "NPR",
          subtotal_paisa: subtotal,
          discount_paisa: discount,
          delivery_fee_paisa: rate.pricePaisa,
          total_paisa: total,
          courier_service_id: rate.serviceId,
          delivery_snapshot: {
            zone_id: rate.zoneId,
            zone_name: rate.zoneName,
            courier_id: rate.courierId,
            courier_name: rate.courierName,
            courier_service_id: rate.serviceId,
            service_name: rate.serviceName,
            service_level: rate.level,
            price_paisa: rate.pricePaisa,
            estimated_min_days: rate.minDays,
            estimated_max_days: rate.maxDays,
          },
          coupon_id: coupon ? coupon.id : null,
          coupon_code: coupon ? coupon.seed.code : null,
          customer_note: note,
          guest_tracking_hash: trackingSecret === null ? null : sha256Hex(trackingSecret),
          confirmed_at: isoOrNull(seen(milestones.confirmed)),
          packed_at: isoOrNull(seen(milestones.packed)),
          shipped_at: isoOrNull(seen(milestones.pickedUp)),
          delivered_at: isoOrNull(deliveredAt),
          canceled_at: isoOrNull(canceledAt),
          cancellation_reason: cancellationReason,
          payment_collected_at: isoOrNull(deliveredAt),
          refunded_at: isoOrNull(status === "delivered" ? refundedAt : null),
          created_at: iso(placedAt),
          updated_at: iso(Math.max(...stamps)),
        } satisfies OrderRow,
        ...(trackingSecret === null ? {} : { dev: { tracking_secret: trackingSecret } }),
      });
      itemRows.forEach((row) => lines.order_items.push({ table: "order_items", data: row }));

      orders.push({ id: orderId, customerId: customer?.id ?? null, placedAt, status });
      if (customer) {
        orderCountByCustomer.set(customer.id, priorOrders + 1);
        lastOrderAtByCustomer.set(customer.id, placedAt);
        if (deliveredAt !== null) {
          const list = deliveredItemsByCustomer.get(customer.id) ?? [];
          const transitDays = Math.max(1, Math.round((nptStartOfDay(deliveredAt) - nptStartOfDay(placedAt)) / DAY));
          const town = address.municipality_name.replace(/ (Metropolitan City|Sub-Metropolitan City|Rural Municipality|Municipality)$/, "");
          for (const row of itemRows) {
            list.push({
              orderItemId: row.id,
              productId: row.product_id,
              deliveredAt,
              refunded: paymentStatus === "refunded",
              town,
              transitDays,
            });
          }
          deliveredItemsByCustomer.set(customer.id, list);
        }
      }
    }
  }

  /* Coupon rows, with usage counts from the simulation */
  for (const coupon of coupons) {
    const { seed } = coupon;
    const created = Math.min(coupon.startsAt - rng.int(2, 10) * DAY, NOW - DAY);
    lines.coupons.push({
      table: "coupons",
      data: {
        id: coupon.id,
        code: seed.code,
        description: seed.description,
        type: seed.type,
        percent_off: seed.type === "percentage" ? (seed.percentOff ?? null) : null,
        amount_off_paisa: seed.type === "fixed" ? (seed.amountOff ?? 0) * 100 : null,
        min_order_paisa: seed.minOrder === undefined ? null : seed.minOrder * 100,
        max_discount_paisa: seed.maxDiscount === undefined ? null : seed.maxDiscount * 100,
        starts_at: iso(coupon.startsAt),
        ends_at: coupon.endsAt === null ? null : iso(coupon.endsAt),
        usage_limit: seed.usageLimit,
        usage_limit_per_customer: seed.perCustomer,
        times_used: coupon.used,
        is_active: seed.isActive,
        created_at: iso(Math.max(created, STORE_LAUNCH - 10 * DAY)),
        updated_at: iso(Math.max(created, STORE_LAUNCH - 10 * DAY)),
      } satisfies CouponRow,
    });
  }

  // Coupons are listed first in the file even though usage is computed last.
  return { lines, orders, deliveredItemsByCustomer, lastOrderAtByCustomer };
}

/* ---------- Timeline ---------- */

function planTimeline(rng: Rng, placed: number, rate: SimRate, outcome: Outcome): Milestones {
  const confirmed = withinHours(rng, placed + minutes(rng.int(8, 90)), 9, 20);
  const processing = confirmed + minutes(rng.int(15, 120));
  const packed = withinHours(rng, processing + minutes(rng.int(60, 300)), 10, 19);
  const pickedUp = Math.max(withinHours(rng, packed + minutes(rng.int(60, 1200)), 11, 17), packed + minutes(30));
  // Valley parcels go straight from our dispatch centre to the rider.
  const inTransit = rate.zoneSlug === "kathmandu-valley" ? null : pickedUp + minutes(rng.int(180, 600));

  let transitDays = rng.int(rate.minDays, rate.maxDays);
  if (rng.chance(0.08)) transitDays += rng.int(1, 2);
  let outForDelivery = atNptTime(placed + transitDays * DAY, 9, 30) + minutes(rng.int(0, 210));
  const earliest = (inTransit ?? pickedUp) + 2 * HOUR;
  if (outForDelivery <= earliest) outForDelivery = atNptTime(earliest + DAY, 9, 30) + minutes(rng.int(0, 150));

  const base: Milestones = {
    placed,
    confirmed,
    processing,
    packed,
    pickedUp,
    inTransit,
    outForDelivery,
    delivered: null,
    exception1: null,
    secondAttempt: null,
    exception2: null,
    returned: null,
    canceled: null,
    refunded: null,
  };

  if (outcome === "cancel_pre_dispatch") {
    let canceled = placed + minutes(rng.int(20, 30 * 60));
    if (canceled >= packed) canceled = Math.max(placed + minutes(10), packed - minutes(rng.int(10, 60)));
    return {
      ...base,
      confirmed: confirmed < canceled ? confirmed : null,
      processing: processing < canceled ? processing : null,
      packed: null,
      pickedUp: null,
      inTransit: null,
      outForDelivery: null,
      canceled,
    };
  }

  if (outcome === "failed_delivery") {
    if (rate.level === "pickup") {
      const exception1 = outForDelivery + 5 * DAY;
      const returned = withinHours(rng, outForDelivery + 7 * DAY, 11, 16);
      return { ...base, exception1, returned, canceled: returned + minutes(rng.int(30, 120)) };
    }
    const exception1 = outForDelivery + minutes(rng.int(120, 300));
    const secondAttempt = atNptTime(exception1 + DAY, 9, 30) + minutes(rng.int(0, 150));
    const exception2 = secondAttempt + minutes(rng.int(120, 300));
    const returned = atNptTime(exception2 + rng.int(1, 3) * DAY, 11) + minutes(rng.int(0, 300));
    return { ...base, exception1, secondAttempt, exception2, returned, canceled: exception2 + minutes(rng.int(30, 120)) };
  }

  const delivered =
    rate.level === "pickup"
      ? outForDelivery + minutes(rng.int(180, 3 * 24 * 60))
      : outForDelivery + minutes(rng.int(40, 300));
  const refunded = outcome === "refunded" ? atNptTime(delivered + rng.int(2, 6) * DAY, 11) + minutes(rng.int(0, 360)) : null;
  return { ...base, delivered, refunded };
}

type PlannedEvent = {
  at: number;
  status: ShipmentStatus;
  message: string;
  location: string | null;
  source: ShipmentEventRow["source"];
};

function shipmentEvents(rate: SimRate, address: AddressSnapshot, m: Milestones): PlannedEvent[] {
  const town = address.municipality_name;
  const district = address.district_name;
  const pickup = rate.level === "pickup";
  const events: PlannedEvent[] = [
    { at: m.placed, status: "awaiting_assignment", message: "Order received. Waiting for confirmation and courier assignment.", location: null, source: "system" },
  ];
  if (m.packed !== null) {
    events.push({ at: m.packed, status: "assigned", message: `Packed and assigned to ${rate.courierName} (${rate.serviceName}).`, location: "Kathmandu dispatch centre", source: "staff" });
  }
  if (m.pickedUp !== null) {
    events.push({ at: m.pickedUp, status: "picked_up", message: `Picked up by ${rate.courierName} from our Kathmandu dispatch centre.`, location: "Kathmandu dispatch centre", source: "staff" });
  }
  if (m.inTransit !== null) {
    events.push({ at: m.inTransit, status: "in_transit", message: `In transit to the ${rate.courierName} hub for ${district}.`, location: `${district} hub`, source: "courier_manual" });
  }
  if (m.outForDelivery !== null) {
    events.push(
      pickup
        ? { at: m.outForDelivery, status: "out_for_delivery", message: `Ready for collection at the ${rate.courierName} branch in ${district}. Bring your order number.`, location: `${rate.courierName}, ${district} branch`, source: "courier_manual" }
        : { at: m.outForDelivery, status: "out_for_delivery", message: `Out for delivery with a ${rate.courierName} rider.`, location: town, source: "courier_manual" },
    );
  }
  if (m.delivered !== null) {
    events.push(
      pickup
        ? { at: m.delivered, status: "delivered", message: "Collected from the branch. Cash on delivery paid.", location: `${rate.courierName}, ${district} branch`, source: "courier_manual" }
        : { at: m.delivered, status: "delivered", message: "Delivered. Cash on delivery collected.", location: town, source: "courier_manual" },
    );
  }
  if (m.exception1 !== null) {
    events.push(
      pickup
        ? { at: m.exception1, status: "exception", message: "Parcel not collected yet. We've reminded the customer by phone.", location: `${rate.courierName}, ${district} branch`, source: "courier_manual" }
        : { at: m.exception1, status: "exception", message: "Delivery attempt failed: the customer could not be reached. We'll try again tomorrow.", location: town, source: "courier_manual" },
    );
  }
  if (m.secondAttempt !== null) {
    events.push({ at: m.secondAttempt, status: "out_for_delivery", message: "Out for delivery again (second attempt).", location: town, source: "courier_manual" });
  }
  if (m.exception2 !== null) {
    events.push({ at: m.exception2, status: "exception", message: "Second delivery attempt failed. The parcel will be returned to the store.", location: town, source: "courier_manual" });
  }
  if (m.returned !== null) {
    events.push({ at: m.returned, status: "returned", message: "Returned to the Goreto dispatch centre in Kathmandu.", location: "Kathmandu dispatch centre", source: "staff" });
  }
  return events.sort((a, b) => a.at - b.at);
}

/* ---------- Small helpers ---------- */

function isoOrNull(at: number | null): string | null {
  return at === null ? null : iso(at);
}

function uniqueCode(rng: Rng, taken: Set<string>, make: () => string): string {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const code = make();
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
  throw new Error("Could not generate a unique code");
}

function randomToken(rng: Rng, length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let token = "";
  for (let index = 0; index < length; index += 1) token += alphabet[rng.int(0, alphabet.length - 1)];
  return token;
}

function noteFor(rng: Rng, at: number): string {
  if (inWindow(at, DASHAIN_2025) && rng.chance(0.5)) return festivalNotes[0]!;
  if (inWindow(at, TIHAR_2025) && rng.chance(0.5)) return festivalNotes[1]!;
  if (inWindow(at, TEEJ_2026) && rng.chance(0.5)) return teejNotes[0]!;
  return rng.pick(customerNotes);
}
