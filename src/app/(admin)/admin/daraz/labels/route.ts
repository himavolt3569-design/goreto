import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { NextRequest } from "next/server";
import { authorizeAdmin } from "@/features/admin/auth";
import { darazLabelSchema } from "@/features/admin/daraz-forms";
import { logDarazCall } from "@/features/admin/daraz-log";
import { fetchBookingContext, PROVIDER } from "@/features/admin/queries/daraz";
import { adminDb } from "@/features/admin/queries/shared";
import { describeDarazError } from "@/lib/courier/daraz/client";
import { darazConfig } from "@/lib/courier/daraz/config";
import { printAwb } from "@/lib/courier/daraz/epis";

/*
 * Daraz shipping labels (AWB) for one or many orders:
 * /admin/daraz/labels?orders=<id>,<id>&type=pdf|zpl. Daraz's label links
 * expire after 5 minutes, so the server fetches each label right away and
 * returns one merged PDF (or one ZPL file) to print. Orders that couldn't be
 * labelled are listed on a first page instead of failing the whole batch.
 */

export const maxDuration = 60;

const MAX_LABEL_BYTES = 5 * 1024 * 1024;

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!response.ok) throw new Error(`label download failed (HTTP ${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_LABEL_BYTES) throw new Error("label file is too large");
  return bytes;
}

export async function GET(req: NextRequest) {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return new Response("You don't have permission to print labels.", { status: auth.reason === "unauthenticated" ? 401 : 403 });

  const parsed = darazLabelSchema.safeParse({ orders: req.nextUrl.searchParams.get("orders") ?? "", type: req.nextUrl.searchParams.get("type") ?? "pdf" });
  if (!parsed.success) return new Response(parsed.error.issues[0]?.message ?? "Choose the orders to label.", { status: 400 });
  const config = darazConfig();
  if (!config) return new Response("Daraz Express isn't connected yet.", { status: 503 });

  const { orders, type } = parsed.data;
  const labels: { orderNumber: string; bytes: Uint8Array }[] = [];
  const skipped: string[] = [];

  for (const orderId of orders) {
    const context = await fetchBookingContext(orderId);
    const shipment = context?.shipment;
    if (!context || !shipment?.packageCode) {
      skipped.push(`${context ? `#${context.orderNumber}` : orderId}: not booked with Daraz`);
      continue;
    }
    const result = await printAwb(config, shipment.packageCode, type);
    await logDarazCall("awb", orderId, result);
    if (!result.ok) {
      skipped.push(`#${context.orderNumber}: ${describeDarazError(result.error)}`);
      continue;
    }
    try {
      labels.push({ orderNumber: context.orderNumber, bytes: await download(result.data.url) });
      await adminDb().rpc("admin_mark_awb_printed", { p_order_id: orderId, p_provider: PROVIDER });
    } catch (error) {
      skipped.push(`#${context.orderNumber}: ${error instanceof Error ? error.message : "label download failed"}`);
    }
  }

  if (labels.length === 0) {
    return new Response(`No labels could be printed.\n\n${skipped.join("\n")}`, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const filename = labels.length === 1 ? `daraz-label-${labels[0]!.orderNumber}` : `daraz-labels-${labels.length}`;

  if (type === "zpl") {
    const text = labels.map((label) => new TextDecoder().decode(label.bytes)).join("\n");
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `inline; filename="${filename}.zpl"`, "Cache-Control": "no-store" } });
  }

  const merged = await PDFDocument.create();
  if (skipped.length > 0) {
    const font = await merged.embedFont(StandardFonts.Helvetica);
    const page = merged.addPage([288, 432]);
    page.drawText("Not printed", { x: 20, y: 400, size: 14, font, color: rgb(0.06, 0.09, 0.16) });
    skipped.slice(0, 20).forEach((line, index) => {
      page.drawText(line.slice(0, 60), { x: 20, y: 376 - index * 16, size: 8, font, color: rgb(0.2, 0.25, 0.33) });
    });
  }
  for (const label of labels) {
    try {
      const source = await PDFDocument.load(label.bytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
    } catch {
      skipped.push(`#${label.orderNumber}: Daraz sent a label that isn't a PDF`);
    }
  }
  const bytes = await merged.save();
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}.pdf"`, "Cache-Control": "no-store" },
  });
}
