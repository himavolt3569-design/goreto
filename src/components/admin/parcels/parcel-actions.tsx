"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ArrowsClockwiseIcon, PaperPlaneTiltIcon, PrinterIcon, TruckIcon, WhatsappLogoIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import type { ActionResult } from "@/features/admin/auth";
import { bulkDarazAction, readyToShipDarazAction } from "@/features/admin/actions/daraz";
import { recordCourierHandoffAction } from "@/features/admin/actions/orders";
import { sendOrderAction } from "@/features/admin/actions/parcels";
import { ActionMessage } from "../action-forms";

/*
 * The buttons on Send & track rows (prompts/goreto-send-and-track.md). Each
 * calls a server action that checks permission and re-reads the order; the
 * page refreshes itself afterwards, so the row moves on to its next step.
 */

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

/** Accept & send, or Book with Daraz: the same one-click send as a new order. */
export function SendButton({ orderId, label, booking = false }: { orderId: string; label: string; booking?: boolean }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <Button
        variant="primary"
        loading={pending}
        leadingIcon={booking ? <TruckIcon {...iconProps} /> : <PaperPlaneTiltIcon {...iconProps} />}
        onClick={() =>
          startTransition(async () => {
            const outcome = await sendOrderAction(orderId).catch(() => ({ kind: "error" as const, message: "Couldn't reach the server. Try again." }));
            setResult(outcome.kind === "booked" || outcome.kind === "whatsapp" ? { ok: true, message: outcome.message } : { ok: false, message: outcome.message });
          })
        }
      >
        {label}
      </Button>
      <ActionMessage state={result} className="max-w-xs lg:text-right" />
    </div>
  );
}

/**
 * Opens the Daraz label and, in the same click, tells Daraz the parcel is
 * ready for pickup. The link opens straight away (no popup blocker); the
 * ready-to-ship call runs alongside it.
 */
export function PrintAndPickupButton({ orderId }: { orderId: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  function callPickup() {
    const data = new FormData();
    data.set("orderId", orderId);
    startTransition(async () => setResult(await readyToShipDarazAction(null, data).catch(() => ({ ok: false as const, message: "Couldn't reach the server. Try again." }))));
  }
  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <a
        href={`/admin/daraz/labels?orders=${orderId}&type=pdf`}
        target="_blank"
        rel="noopener"
        onClick={callPickup}
        aria-busy={pending || undefined}
        className={buttonClasses({ variant: "primary", size: "md" })}
      >
        <PrinterIcon {...iconProps} />
        Print label &amp; call pickup
        <span className="sr-only"> (opens the label PDF in a new tab)</span>
      </a>
      <ActionMessage state={result} className="max-w-xs lg:text-right" />
    </div>
  );
}

/** Opens the courier's WhatsApp with the order details and records the handoff. */
export function WhatsappSendButton({ orderId, href, courierName }: { orderId: string; href: string; courierName: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => startTransition(async () => setResult(await recordCourierHandoffAction(orderId)))}
        className={buttonClasses({ variant: "primary", size: "md" })}
      >
        <WhatsappLogoIcon {...iconProps} />
        Send on WhatsApp
        <span className="sr-only"> to {courierName} (opens WhatsApp in a new tab)</span>
      </a>
      <ActionMessage state={result && !result.ok ? result : null} className="max-w-xs lg:text-right" />
    </div>
  );
}

function refreshForm(orderIds: readonly string[]): FormData {
  const data = new FormData();
  data.set("operation", "refresh");
  data.set("orderIds", orderIds.join(","));
  return data;
}

/**
 * Keeps Daraz tracking fresh: once when the page opens (parcels not synced
 * for 15 minutes, at most 10), and on demand for every open Daraz parcel on
 * the page.
 */
export function ParcelRefresh({ staleOrderIds, openOrderIds }: { staleOrderIds: readonly string[]; openOrderIds: readonly string[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);
  const staleKey = staleOrderIds.slice(0, 10).join(",");

  useEffect(() => {
    if (started.current || !staleKey) return;
    started.current = true;
    setChecking(true);
    startTransition(async () => {
      // Quiet unless something failed: the rows themselves show what changed.
      const outcome = await bulkDarazAction(null, refreshForm(staleKey.split(","))).catch(() => null);
      setChecking(false);
      if (outcome && !outcome.ok) setResult(outcome);
    });
  }, [staleKey]);

  if (openOrderIds.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-1 md:items-end">
      <Button
        variant="tertiary"
        loading={pending}
        leadingIcon={<ArrowsClockwiseIcon {...iconProps} />}
        onClick={() => startTransition(async () => setResult(await bulkDarazAction(null, refreshForm(openOrderIds.slice(0, 25))).catch(() => ({ ok: false as const, message: "Couldn't reach the server. Try again." }))))}
      >
        {checking ? "Checking Daraz…" : "Refresh tracking"}
      </Button>
      {checking ? (
        <p role="status" className="text-small text-neutral-500">
          Checking Daraz for updates…
        </p>
      ) : (
        <ActionMessage state={result} className="max-w-sm md:text-right" />
      )}
    </div>
  );
}
