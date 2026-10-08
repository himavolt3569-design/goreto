"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, XIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import type { NepalAddressData } from "@/features/delivery/nepal-address";
import { ManualOrderForm, type SentOrder } from "../manual-order/manual-order-form";
import { SendResultCard } from "./send-result";

/*
 * The New order part of Send & track (prompts/goreto-send-and-track.md): the
 * WhatsApp order form in send mode, and what happened after Save and send.
 * The parcel then appears at the top of the list below.
 */

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

export function SendDesk({
  address,
  canLinkCustomer,
  codEnabled,
  darazServiceIds,
  usualWeightGrams,
  initiallyOpen,
}: {
  address: NepalAddressData;
  canLinkCustomer: boolean;
  codEnabled: boolean;
  darazServiceIds: readonly string[];
  usualWeightGrams: number | null;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [sent, setSent] = useState<SentOrder | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {sent ? <SendResultCard order={sent} onDismiss={() => setSent(null)} /> : null}

      {open ? (
        <section aria-labelledby="new-order-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="new-order-heading" className="text-h2 text-neutral-900">
              New order
            </h2>
            <Button variant="tertiary" leadingIcon={<XIcon {...iconProps} />} onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <ManualOrderForm
            address={address}
            canLinkCustomer={canLinkCustomer}
            autoAccept={false}
            codEnabled={codEnabled}
            send={{
              darazServiceIds,
              usualWeightGrams,
              onSent: (order) => {
                setSent(order);
                setOpen(false);
              },
            }}
          />
        </section>
      ) : (
        <Button size="lg" leadingIcon={<PlusIcon {...iconProps} />} onClick={() => setOpen(true)} className="w-full sm:w-fit">
          {sent ? "Enter another order" : "New order"}
        </Button>
      )}
    </div>
  );
}
