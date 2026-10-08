/**
 * A local stand-in for the Daraz Logistics (EPIS) gateway, for development
 * and demos before Daraz issues real keys (docs/couriers/daraz.md).
 *
 *   npm run daraz:mock                      listens on http://localhost:4010
 *   DARAZ_API_URL=http://localhost:4010     in .env.local, plus any DARAZ_APP_KEY / DARAZ_APP_SECRET
 *
 * It checks request signatures with the same algorithm Daraz uses (so a
 * wrong secret fails here too), answers in Daraz's envelope with string
 * booleans and numbers, and walks parcels through Daraz's statuses: every
 * history lookup after "ready to ship" moves a parcel one step on.
 *
 *   POST /mock/fail/<tracking>     next step is a failed delivery (needs action)
 *   GET  /mock/packages            what the mock holds
 *
 * In-memory only; restart to reset. Never used in production
 * (src/lib/courier/daraz/config.ts refuses http outside development).
 */
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.DARAZ_MOCK_PORT ?? 4010);
const SECRET = process.env.DARAZ_APP_SECRET ?? "";

type Step = { status: string; reasonCode?: string; location: string };
type MockPackage = {
  packageCode: string;
  trackingNumber: string;
  reference: string;
  weightGrams: number;
  readyToShip: boolean;
  canceled: boolean;
  needsAction: boolean;
  failNext: boolean;
  timeline: { status: string; processTime: number; reasonCode?: string; location: string }[];
};

const FORWARD: Step[] = [
  { status: "domestic_pickup_sign_in_success", location: "Kathmandu pickup" },
  { status: "domestic_sc_sign_in_success", location: "Kathmandu sort centre" },
  { status: "domestic_package_stationed_in", location: "Destination hub" },
  { status: "domestic_out_for_delivery", location: "Destination hub" },
  { status: "domestic_delivered", location: "Customer address" },
];
const RETURN_STEPS: Step[] = [
  { status: "on_the_way_back_to_shipper", location: "Destination hub" },
  { status: "domestic_back_to_shipper", location: "Kathmandu pickup" },
];

const packages = new Map<string, MockPackage>(); // by package code
const cases = new Map<string, Record<string, unknown>>();
let counter = 1000;

function sign(path: string, params: Record<string, string>): string {
  const base = path + Object.keys(params).filter((key) => key !== "sign" && params[key] !== "").sort().map((key) => key + params[key]).join("");
  return createHmac("sha256", SECRET).update(base, "utf8").digest("hex").toUpperCase();
}

function reply(res: ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function ok(res: ServerResponse, data?: unknown) {
  reply(res, { code: "0", success: "true", retryable: "false", traceId: `mock-${Date.now()}`, request_id: `mock-${counter}`, ...(data === undefined ? {} : { data }) });
}

function bad(res: ServerResponse, errorCode: string, errorMessage: string, errors: { field: string; errorMessage: string }[] = []) {
  reply(res, { code: "0", success: "false", retryable: "false", traceId: `mock-${Date.now()}`, errorCode, errorMessage, errors });
}

function json<T>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function byTracking(tracking: string | undefined): MockPackage | undefined {
  return [...packages.values()].find((item) => item.trackingNumber === tracking);
}

/** A one-page PDF label, built by hand so the offsets are right. */
function labelPdf(item: MockPackage): Buffer {
  const text = `DEX MOCK LABEL  ${item.trackingNumber}  ${item.reference}`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 288 432] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 12 Tf 20 400 Td (${text}) Tj ET`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function advance(item: MockPackage) {
  if (!item.readyToShip || item.canceled) return;
  const last = item.timeline.at(-1)?.status;
  if (last === "domestic_delivered" || last === "domestic_back_to_shipper" || item.needsAction) return;
  const now = Date.now();
  if (item.failNext) {
    item.failNext = false;
    item.needsAction = true;
    item.timeline.push({ status: "domestic_1st_attempt_failed", reasonCode: "customer_not_reachable", processTime: now, location: "Destination hub" });
    return;
  }
  const returning = item.timeline.some((step) => step.status === "on_the_way_back_to_shipper");
  const path = returning ? RETURN_STEPS : FORWARD;
  const done = item.timeline.filter((step) => path.some((candidate) => candidate.status === step.status)).length;
  const next = path[done];
  if (next) item.timeline.push({ ...next, processTime: now });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname.replace(/^\/rest/, "");

  if (path.startsWith("/labels/")) {
    const item = packages.get(path.slice("/labels/".length).replace(/\.(pdf|zpl)$/, ""));
    if (!item) return reply(res, { error: "not found" }, 404);
    if (path.endsWith(".zpl")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(`^XA^FO40,40^A0N,40,40^FDDEX MOCK ${item.trackingNumber}^FS^XZ\n`);
    }
    res.writeHead(200, { "Content-Type": "application/pdf" });
    return res.end(labelPdf(item));
  }
  if (path === "/mock/packages") return reply(res, [...packages.values()]);
  if (path.startsWith("/mock/fail/") && req.method === "POST") {
    const item = byTracking(decodeURIComponent(path.slice("/mock/fail/".length)));
    if (!item) return reply(res, { error: "not found" }, 404);
    item.failNext = true;
    return reply(res, { ok: true });
  }

  const raw = req.method === "POST" ? await readBody(req) : "";
  const params: Record<string, string> = Object.fromEntries(url.searchParams);
  for (const [key, value] of new URLSearchParams(raw)) params[key] = value;

  if (SECRET && params.sign !== sign(path, params)) {
    return reply(res, { type: "ISV", code: "IncompleteSignature", message: "The request signature does not conform to dazop standards", request_id: "mock-sign" });
  }

  switch (path) {
    case "/logistics/epis/customers/external_relationships_bundle":
      return params.otp ? ok(res) : bad(res, "BAD_REQUEST", "Bad request", [{ field: "$.otp", errorMessage: "otp must not be blank" }]);

    case "/logistics/epis/customers/warehouses": {
      const address = json<{ id?: string }>(params.address);
      if (!address?.id) return bad(res, "BAD_REQUEST", "Bad request", [{ field: "$.address.id", errorMessage: "id must not be blank" }]);
      return ok(res, { convertedAddress: { id: address.id, details: "converted by mock" } });
    }

    case "/logistics/epis/service/delivery_options":
      return ok(res, [
        { deliveryOption: "standard", firstMileDeliveryType: "Pickupp", pickupTargetCutoffTime: String(Date.now() + 6 * 3600_000), lastMileShippingProvider: "NP-DEX" },
        { deliveryOption: "economy", firstMileDeliveryType: "Drop-off", pickupTargetCutoffTime: String(Date.now() + 24 * 3600_000), lastMileShippingProvider: "NP-DEX" },
      ]);

    case "/logistics/epis/estimate_shipping_fee": {
      const factor = json<{ weight?: string }>(params.chargeFactor);
      const weight = Number(factor?.weight ?? 0);
      const delivery = 100 + Math.ceil(Math.max(weight, 1) / 500) * 20;
      return ok(res, [
        { transactionType: "Delivery", transactionName: "Delivery", amount: `${delivery}.0`, taxAmount: "0.0", currency: "NPR" },
        { transactionType: "COD", transactionName: "COD fee", amount: "15.0", taxAmount: "0.0", currency: "NPR" },
      ]);
    }

    case "/logistics/epis/packages":
    case "/logistics/epis/packages/consign": {
      const reference = params.externalOrderId;
      const destination = json<{ phone?: string }>(params.destination);
      const dim = json<{ weight?: string }>(params.dimWeight);
      if (!reference) return bad(res, "BAD_REQUEST", "Bad request", [{ field: "$.externalOrderId", errorMessage: "externalOrderId must not be blank" }]);
      if (!destination?.phone) return bad(res, "BAD_REQUEST", "Bad request", [{ field: "$.destination.phone", errorMessage: "phone must not be blank" }]);
      const existing = [...packages.values()].find((item) => item.reference === reference);
      const item: MockPackage = existing ?? {
        packageCode: `FU-MOCK-${++counter}`,
        trackingNumber: `NPDEX${counter}`,
        reference,
        weightGrams: Number(dim?.weight ?? 0),
        readyToShip: false,
        canceled: false,
        needsAction: false,
        failNext: false,
        timeline: [{ status: "package_ready_to_be_shipped", processTime: Math.floor(Date.now() / 1000), location: "Seller" }],
      };
      packages.set(item.packageCode, item);
      return ok(res, {
        packageCode: item.packageCode,
        trackingNumber: item.trackingNumber,
        minEta: String(Date.now() + 86_400_000),
        maxEta: String(Date.now() + 3 * 86_400_000),
        lastMileShippingProvider: { tplCode: "np-dex", tplName: "NP-DEX", tplSlug: "np-dex" },
        firstMileShippingProvider: { tplCode: "np-dex", tplName: "NP-DEX", tplSlug: "np-dex" },
      });
    }

    case "/logistics/epis/packages/awb": {
      const item = packages.get(params.packageCode ?? "");
      if (!item) return bad(res, "PACKAGE_NOT_FOUND", "Package not found");
      return ok(res, { url: `http://localhost:${PORT}/labels/${item.packageCode}.${params.type === "zpl" ? "zpl" : "pdf"}` });
    }

    case "/logistics/epis/packages/rts": {
      const item = byTracking(params.trackingNumber);
      if (!item) return bad(res, "PACKAGE_NOT_FOUND", "Package not found");
      item.readyToShip = true;
      return ok(res, { packageCode: item.packageCode, trackingNumber: item.trackingNumber });
    }

    case "/logistics/epis/packages/cancel": {
      const item = packages.get(params.packageCode ?? "");
      if (!item) return bad(res, "PACKAGE_NOT_FOUND", "Package not found");
      if (item.timeline.length > 1) return bad(res, "PACKAGE_CANNOT_CANCEL", "The parcel has been picked up");
      item.canceled = true;
      item.timeline.push({ status: "CANCELLED", processTime: Date.now(), location: "Seller" });
      return ok(res);
    }

    case "/logistics/epis/packages/update":
      return packages.has(params.packageCode ?? "") ? ok(res) : bad(res, "PACKAGE_NOT_FOUND", "Package not found");

    case "/logistics/epis/packages/reattempt": {
      const item = packages.get(params.packageCode ?? "");
      if (!item) return bad(res, "PACKAGE_NOT_FOUND", "Package not found");
      item.needsAction = false;
      if (params.feedbackType === "RETURN") item.timeline.push({ ...RETURN_STEPS[0]!, processTime: Date.now() });
      else item.timeline.push({ status: "domestic_redelivery", processTime: Date.now(), location: "Destination hub" });
      return ok(res);
    }

    case "/logistics/epis/packages/history": {
      const item = byTracking(params.trackingNumber);
      if (!item) return bad(res, "PACKAGE_NOT_FOUND", "Package not found");
      advance(item);
      return ok(res, {
        packageCode: item.packageCode,
        trackingNumber: item.trackingNumber,
        status: item.timeline.at(-1)?.status,
        lastMileShippingProvider: "NP-DEX",
        shippingFee: item.timeline.some((step) => step.status === "domestic_delivered") ? `${100 + Math.ceil(Math.max(item.weightGrams, 1) / 500) * 20}.0` : "{}",
        notifyVasFdStorage: String(item.needsAction),
        timeline: item.timeline.map((step) => ({
          ...step,
          processTime: String(step.processTime),
          epod: step.status === "domestic_delivered" ? `http://localhost:${PORT}/labels/${item.packageCode}.pdf` : undefined,
          driverName: "Mock Rider",
        })),
      });
    }

    case "/logistics/epis/xspace/create": {
      const caseId = String(++counter);
      cases.set(caseId, { caseId, subject: params.subject, description: params.description, trackingNumber: params.trackingNumber, status: "open", gmtCreate: Date.now() });
      return ok(res, { caseId });
    }
    case "/logistics/epis/xspace/query":
      return ok(res, { page: { totalRecords: cases.size, pageNo: 1, pageSize: 50 }, content: [...cases.values()] });
    case "/logistics/epis/xspace/detail": {
      const item = cases.get(params.caseId ?? "");
      return item ? ok(res, { ...item, mails: [{ from: "DEX support", content: "We are looking into it." }] }) : bad(res, "CASE_NOT_FOUND", "Case not found");
    }
    case "/logistics/epis/xspace/rate": {
      const item = cases.get(params.caseId ?? "");
      if (!item) return bad(res, "CASE_NOT_FOUND", "Case not found");
      item.ratingStar = Number(params.ratingStar);
      item.status = "closed";
      return ok(res);
    }

    default:
      return reply(res, { type: "ISV", code: "InvalidApiPath", message: `Unknown API ${path}`, request_id: "mock" });
  }
});

server.listen(PORT, () => {
  console.log(`Daraz mock gateway on http://localhost:${PORT}${SECRET ? " (checking signatures)" : " (DARAZ_APP_SECRET unset: signatures not checked)"}`);
});
