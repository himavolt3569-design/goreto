import { paisaToRupeesInput } from "@/lib/money/parse";

/*
 * Pure builders for EPIS request bodies (docs/couriers/daraz.md §6), from
 * the order's immutable snapshot (AGENTS §26.11) and the store's Daraz
 * account settings. Money stays integer paisa until it becomes Daraz's
 * rupee strings here.
 */

export type DeliveryOption = "standard" | "economy";
export type PhoneFormat = "national" | "e164";

export type BookingAccount = {
  platformName: string;
  externalSellerId: string;
  pickupWarehouseCode: string | null;
  originName: string;
  originPhoneE164: string;
  originEmail: string | null;
  originAddressDetails: string;
  originDarazAddressId: string | null;
  originLatitude: number | null;
  originLongitude: number | null;
  undeliverableOption: "RETURN" | "SCRAP";
  phoneFormat: PhoneFormat;
  declareInsurance: boolean;
  defaultItemCategory: string | null;
};

export type BookingOrder = {
  orderNumber: string;
  createdAt: string;
  totalPaisa: number;
  subtotalPaisa: number;
  discountPaisa: number;
  contactEmail: string | null;
  customerNote: string | null;
  address: {
    recipientName: string;
    phoneE164: string;
    streetLandmark: string;
    ward: number | null;
    municipalityName: string;
    districtName: string;
    provinceName: string;
    latitude: number | null;
    longitude: number | null;
  };
  /** From daraz_locations when Daraz has given us its id for the municipality. */
  darazAddressId: string | null;
  items: { id: string; title: string; variant: string | null; sku: string | null; quantity: number; unitPricePaisa: number; lineTotalPaisa: number }[];
};

export type BookingOptions = {
  deliveryOption: DeliveryOption;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  openBox: boolean;
  deliveryNote: string | null;
};

export type ConsignmentParams = Record<string, unknown> & {
  externalOrderId: string;
  payment: { totalAmount: string; currency: "NPR"; paymentType: "COD"; insuranceAmount?: string };
};

export type WarehouseParams = Record<string, unknown> & { warehouseCode: string; type: "NORMAL" | "RETURN" };

/** "+9779812345678" -> "9812345678" (national) or unchanged (e164). */
export function darazPhone(e164: string, format: PhoneFormat = "national"): string {
  if (format === "e164") return e164;
  return e164.replace(/^\+977/, "").replace(/\D/g, "");
}

export function rupees(paisa: number): string {
  return paisaToRupeesInput(paisa);
}

/** Centimetres with at most one decimal, as text. */
function cm(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function point(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null ? { latitude: String(latitude), longitude: String(longitude) } : undefined;
}

/**
 * The order-level discount spread over items in proportion to their line
 * totals, in whole paisa; the rounding remainder goes to the last item. Daraz
 * uses paid prices for loss/damage claims.
 */
export function paidUnitPrices(order: Pick<BookingOrder, "items" | "subtotalPaisa" | "discountPaisa">): number[] {
  const discount = Math.min(order.discountPaisa, order.subtotalPaisa);
  if (discount <= 0 || order.subtotalPaisa <= 0) return order.items.map((item) => item.unitPricePaisa);
  let allocated = 0;
  return order.items.map((item, index) => {
    const share = index === order.items.length - 1 ? discount - allocated : Math.floor((discount * item.lineTotalPaisa) / order.subtotalPaisa);
    allocated += share;
    return Math.max(0, Math.floor((item.lineTotalPaisa - share) / item.quantity));
  });
}

export function addressDetails(address: Pick<BookingOrder["address"], "streetLandmark" | "ward" | "municipalityName" | "districtName" | "provinceName">): string {
  return [
    address.streetLandmark,
    address.ward ? `Ward ${address.ward}` : null,
    address.municipalityName,
    address.districtName,
    address.provinceName,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Goods value after discount: what a lost parcel is worth, without our delivery fee. */
export function goodsValuePaisa(order: Pick<BookingOrder, "subtotalPaisa" | "discountPaisa">): number {
  return Math.max(0, order.subtotalPaisa - Math.min(order.discountPaisa, order.subtotalPaisa));
}

/**
 * The create-package / consign body. `reference` is Daraz's dedupe key
 * (externalOrderId): the order number, or "<order>-R<n>" after a cancellation.
 */
export function buildConsignment(order: BookingOrder, account: BookingAccount, options: BookingOptions, reference: string): ConsignmentParams {
  const paid = paidUnitPrices(order);
  const note = [options.deliveryNote, order.customerNote].filter(Boolean).join(" · ").slice(0, 250) || undefined;

  return {
    packageType: "Sales_order",
    externalOrderId: reference,
    platformOrderCreationTime: Date.parse(order.createdAt),
    dangerousGood: false,
    deliveryOption: options.deliveryOption,
    items: order.items.map((item, index) => ({
      id: item.id,
      name: [item.title, item.variant].filter(Boolean).join(" - ").slice(0, 200),
      sku: item.sku ?? undefined,
      category: account.defaultItemCategory ?? undefined,
      quantity: item.quantity,
      unitPrice: rupees(item.unitPricePaisa),
      paidPrice: rupees(paid[index]!),
    })),
    shipper: {
      externalSellerId: account.externalSellerId,
      platformName: account.platformName,
      externalWarehouseCode: account.pickupWarehouseCode ?? undefined,
    },
    origin: {
      name: account.originName,
      phone: darazPhone(account.originPhoneE164, account.phoneFormat),
      email: account.originEmail ?? undefined,
      address: { id: account.originDarazAddressId ?? undefined, details: account.originAddressDetails, type: "work" },
      geoLocation: point(account.originLatitude, account.originLongitude),
    },
    destination: {
      name: order.address.recipientName,
      phone: darazPhone(order.address.phoneE164, account.phoneFormat),
      email: order.contactEmail ?? undefined,
      address: {
        id: order.darazAddressId ?? undefined,
        city: order.address.municipalityName,
        details: addressDetails(order.address),
        type: "home",
      },
      geoLocation: point(order.address.latitude, order.address.longitude),
    },
    payment: {
      totalAmount: rupees(order.totalPaisa),
      currency: "NPR",
      paymentType: "COD",
      ...(account.declareInsurance ? { insuranceAmount: rupees(goodsValuePaisa(order)) } : {}),
    },
    dimWeight: {
      weight: String(Math.round(options.weightGrams)),
      length: cm(options.lengthCm),
      width: cm(options.widthCm),
      height: cm(options.heightCm),
    },
    options: {
      openBox: options.openBox,
      deliveryNote: note,
      partnerOrderId: order.orderNumber,
      undeliverableOption: account.undeliverableOption,
    },
  };
}

/** packages/update: after ready-to-ship, where the rider now goes. */
export function buildPackageUpdate(input: {
  packageCode: string;
  receiverName: string;
  receiverPhoneE164: string;
  details: string | null;
  darazAddressId: string | null;
  deliveryNote: string | null;
  phoneFormat: PhoneFormat;
}): Record<string, unknown> {
  return {
    packageCode: input.packageCode,
    receiverName: input.receiverName,
    receiverPhone: darazPhone(input.receiverPhoneE164, input.phoneFormat),
    deliveryNote: input.deliveryNote ?? undefined,
    receiverAddress: input.details ? { id: input.darazAddressId ?? undefined, details: input.details, type: "home" } : undefined,
  };
}

/** estimate_shipping_fee: what DEX will charge the store for this parcel. */
export function buildFeeEstimate(input: {
  account: Pick<BookingAccount, "platformName" | "externalSellerId" | "originDarazAddressId" | "originLatitude" | "originLongitude" | "declareInsurance">;
  destinationAddressId: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  weightGrams: number;
  deliveryOption: DeliveryOption;
  goodsValuePaisa: number;
}): Record<string, unknown> {
  return {
    externalSellerId: input.account.externalSellerId,
    platformName: input.account.platformName,
    fromAddressId: input.account.originDarazAddressId ?? undefined,
    toAddressId: input.destinationAddressId ?? undefined,
    chargeFactor: {
      packageType: "Sales_order",
      deliveryOption: input.deliveryOption,
      paymentType: "COD",
      weight: String(Math.round(input.weightGrams)),
      insuranceAmount: input.account.declareInsurance ? rupees(input.goodsValuePaisa) : undefined,
    },
    fromLocation: point(input.account.originLatitude, input.account.originLongitude),
    toLocation: point(input.destinationLatitude, input.destinationLongitude),
  };
}

/** delivery_options: needs Daraz location ids for both ends. */
export function buildDeliveryOptionsQuery(input: {
  account: BookingAccount;
  order: BookingOrder;
  options: Pick<BookingOptions, "weightGrams" | "lengthCm" | "widthCm" | "heightCm">;
  reference: string;
}): Record<string, unknown> | null {
  const { account, order, options } = input;
  if (!account.originDarazAddressId || !order.darazAddressId) return null;
  return {
    externalOrderId: input.reference,
    packageType: "Sales_order",
    shipper: { externalSellerId: account.externalSellerId, platformName: account.platformName, externalWarehouseCode: account.pickupWarehouseCode ?? undefined },
    origin: { id: account.originDarazAddressId, details: account.originAddressDetails },
    destination: { id: order.darazAddressId, details: addressDetails(order.address) },
    fromLocation: point(account.originLatitude, account.originLongitude),
    toLocation: point(order.address.latitude, order.address.longitude),
    dimWeight: { weight: String(Math.round(options.weightGrams)), length: cm(options.lengthCm), width: cm(options.widthCm), height: cm(options.heightCm) },
    payment: { totalAmount: rupees(order.totalPaisa), currency: "NPR", paymentType: "COD" },
  };
}

export type WarehouseInput = {
  platformName: string;
  externalSellerId: string;
  kind: "pickup" | "return";
  warehouseCode: string;
  warehouseName: string;
  contactName: string;
  phoneE164: string;
  phoneFormat: PhoneFormat;
  email: string | null;
  darazAddressId: string;
  addressDetails: string;
  solutionCodes: string[];
};

export function buildWarehouse(input: WarehouseInput): WarehouseParams {
  return {
    externalSellerId: input.externalSellerId,
    platformName: input.platformName,
    warehouseCode: input.warehouseCode,
    warehouseName: input.warehouseName,
    contactName: input.contactName,
    phone: darazPhone(input.phoneE164, input.phoneFormat),
    email: input.email ?? undefined,
    type: input.kind === "pickup" ? "NORMAL" : "RETURN",
    address: { id: input.darazAddressId, details: input.addressDetails },
    solutionCodes: input.solutionCodes,
  };
}
