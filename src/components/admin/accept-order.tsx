"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { fieldControlClasses } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CheckCircleIcon, WarningCircleIcon, XCircleIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { acceptOrderAction, transitionOrderAction } from "@/features/admin/actions/orders";
import type { AcceptPreview } from "@/features/admin/queries/orders";
import { cn } from "@/lib/utils/cn";
import { FormDialog } from "./action-forms";

const SOURCE_TEXT = {
  service: "the courier of the customer’s delivery service",
  default: "the store’s default courier",
} as const;

/**
 * Accept or reject a pending order (worklog §4.0). Accepting confirms it and
 * assigns the courier; only then can it be sent to that courier. In auto
 * mode the rule's courier is preselected, in manual mode staff choose. The
 * database re-checks the permission and the courier.
 */
export function AcceptRejectOrder({
  orderId,
  preview,
  couriers,
}: {
  orderId: string;
  preview: AcceptPreview;
  couriers: { id: string; name: string }[];
}) {
  const suggested = preview.mode === "auto" && preview.courier && couriers.some((courier) => courier.id === preview.courier!.id) ? preview.courier : null;
  const [courierId, setCourierId] = useState(suggested?.id ?? "");
  const options = couriers.map((courier) => ({ value: courier.id, label: courier.name }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-neutral-700">
        This order is waiting for acceptance. Nothing is sent to a courier until it&rsquo;s accepted.
      </p>
      <div className="flex flex-wrap gap-2">
        <FormDialog
          action={acceptOrderAction}
          hidden={{ orderId }}
          title="Accept this order?"
          description="The order is confirmed and assigned to the courier below. You can then send it to them on WhatsApp."
          triggerLabel="Accept order"
          triggerVariant="primary"
          triggerIcon={<CheckCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          submitLabel="Accept order"
        >
          {(state) => (
            <>
              {suggested ? (
                <p className="rounded-md bg-neutral-50 px-4 py-3 text-body text-neutral-700">
                  Picked automatically: <span className="font-medium text-neutral-900">{suggested.name}</span>, {SOURCE_TEXT[suggested.source]}.
                  You can choose another courier.
                </p>
              ) : preview.mode === "auto" ? (
                <p role="status" className="flex items-start gap-2 rounded-md bg-warning-100 px-4 py-3 text-body text-neutral-900">
                  <WarningCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-warning-700" />
                  No active courier matches this order automatically. Choose one to accept it.
                </p>
              ) : null}
              <Field label="Courier" required error={state && !state.ok ? state.fieldErrors?.courierId : undefined}>
                {(control) => (
                  <Select
                    {...control}
                    name="courierId"
                    value={courierId}
                    onValueChange={setCourierId}
                    required
                    placeholder="Choose a courier"
                    options={options}
                  />
                )}
              </Field>
              {couriers.length === 0 ? (
                <p className="text-small text-error-700">There are no active couriers. Add or turn one on in Delivery → Couriers first.</p>
              ) : null}
            </>
          )}
        </FormDialog>

        <FormDialog
          action={transitionOrderAction}
          hidden={{ orderId, status: "canceled" }}
          title="Reject this order?"
          description="The order is canceled, its items go back into stock and no courier is told about it."
          triggerLabel="Reject order"
          triggerIcon={<XCircleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          submitLabel="Reject order"
          submitVariant="primary"
        >
          {(state) => (
            <Field label="Reason" required error={state && !state.ok ? state.fieldErrors?.reason : undefined}>
              {(control) => (
                <textarea
                  {...control}
                  name="reason"
                  required
                  maxLength={300}
                  rows={3}
                  className={cn(fieldControlClasses, "h-auto py-3")}
                  placeholder="e.g. Customer couldn't be reached on WhatsApp."
                />
              )}
            </Field>
          )}
        </FormDialog>
      </div>
    </div>
  );
}
