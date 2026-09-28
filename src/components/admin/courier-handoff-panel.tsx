"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { CheckCircleIcon, CopyIcon, WarningCircleIcon, WhatsappLogoIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import type { ActionResult } from "@/features/admin/auth";
import { recordCourierHandoffAction } from "@/features/admin/actions/orders";
import { ActionMessage } from "./action-forms";

export type HandoffState = {
  attempts: number;
  /** Already formatted (Kathmandu time). */
  lastSentLabel: string | null;
  lastSentByName: string | null;
} | null;

/**
 * Hands an accepted order to its courier (worklog §4.0, option 1): a
 * WhatsApp click-to-send link with the message the server built. Opening the
 * link is recorded; WhatsApp can't tell us whether it was delivered, so the
 * panel says "opened", never "delivered". Rendered only for accepted orders
 * with a courier.
 */
export function CourierHandoffPanel({
  orderId,
  courierName,
  courierEditHref,
  whatsappHref,
  message,
  handoff,
  acceptedAutomatically,
  canSend,
}: {
  orderId: string;
  courierName: string;
  /** Where to add the courier's WhatsApp number (null without delivery.manage). */
  courierEditHref: string | null;
  /** Null when the courier has no dispatch WhatsApp number. */
  whatsappHref: string | null;
  message: string;
  handoff: HandoffState;
  acceptedAutomatically: boolean;
  /** orders.write: may send and record. */
  canSend: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const sent = handoff !== null && handoff.attempts > 0;

  function recordSend() {
    // The link opens WhatsApp in a new tab; the record runs alongside it.
    startTransition(async () => setResult(await recordCourierHandoffAction(orderId)));
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setResult({ ok: false, message: "Couldn't copy. Select the message below and copy it by hand." });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {sent ? (
        <p className="flex items-start gap-2 text-body text-neutral-900">
          <CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-success-700" />
          <span>
            Opened in WhatsApp for {courierName}
            {handoff.lastSentLabel ? ` · ${handoff.lastSentLabel}` : ""}
            {handoff.lastSentByName ? ` by ${handoff.lastSentByName}` : ""}
            {handoff.attempts > 1 ? ` · ${handoff.attempts} times` : ""}.
            <span className="block text-small text-neutral-500">Check the chat to confirm the courier received it.</span>
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2 text-body text-neutral-900">
          <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
          <span>
            {acceptedAutomatically ? "Accepted automatically. " : ""}
            Ready to send to {courierName}. Not sent yet.
          </span>
        </p>
      )}

      {whatsappHref ? (
        canSend ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={recordSend}
            className={buttonClasses({ variant: sent ? "secondary" : "primary", size: "lg", className: "w-full" })}
          >
            <WhatsappLogoIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            {sent ? "Send again on WhatsApp" : `Send to ${courierName} on WhatsApp`}
            <span className="sr-only"> (opens WhatsApp in a new tab)</span>
          </a>
        ) : null
      ) : (
        <p role="status" className="flex items-start gap-2 rounded-md bg-warning-100 px-4 py-3 text-body text-neutral-900">
          <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
          <span>
            {courierName} has no dispatch WhatsApp number.{" "}
            {courierEditHref ? (
              <Link href={courierEditHref} className="rounded-xs font-medium text-primary-600 underline">
                Add it to the courier
              </Link>
            ) : (
              "Ask someone who manages delivery to add it"
            )}
            , or copy the message and send it another way.
          </span>
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-small font-medium text-neutral-700" id={`handoff-message-${orderId}`}>
            Message
          </span>
          <button type="button" onClick={copyMessage} className={buttonClasses({ variant: "text", size: "md" })}>
            <CopyIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
            {copied ? "Copied" : "Copy message"}
          </button>
        </div>
        <pre
          aria-labelledby={`handoff-message-${orderId}`}
          className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-4 font-sans text-small text-neutral-700"
        >
          {message}
        </pre>
      </div>

      <span className="sr-only" aria-live="polite">
        {copied ? "Message copied." : ""}
      </span>
      <ActionMessage state={result} />
    </div>
  );
}
