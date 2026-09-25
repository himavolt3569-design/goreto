"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { fieldControlClasses, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TruckIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { addShipmentEventAction, assignCourierAction, markRefundedAction, transitionOrderAction } from "@/features/admin/actions/orders";
import {
  canAddTrackingEvent,
  canAssignCourier,
  canCancel,
  canRefund,
  forwardTransition,
  TRANSITION_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/features/admin/order-transitions";
import { cn } from "@/lib/utils/cn";
import { ActionForm, FormDialog, SubmitButton } from "./action-forms";

const TRACKING_STATUS_OPTIONS = [
  { value: "in_transit", label: "In transit" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "exception", label: "Delivery issue" },
];

const FORWARD_HINTS: Partial<Record<OrderStatus, string>> = {
  shipped: "The parcel has left with the assigned courier.",
  delivered: "The customer has the parcel and paid cash on delivery.",
};

/**
 * Next steps for an order. Only the transitions the state machine allows are
 * offered; the database re-validates each one.
 */
export function OrderActions({
  orderId,
  status,
  paymentStatus,
  hasCourier,
  couriers,
  currentCourierId,
  currentTracking,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  hasCourier: boolean;
  couriers: { id: string; name: string }[];
  currentCourierId: string | null;
  currentTracking: string | null;
}) {
  const next = forwardTransition(status);
  const needsCourier = next === "shipped" && !hasCourier;
  const reasonId = useId();

  const nothingToDo = !next && !canCancel(status) && !canAssignCourier(status) && !canAddTrackingEvent(status) && !canRefund(status, paymentStatus);
  if (nothingToDo) {
    return <p className="text-body text-neutral-500">This order is complete. There are no further steps.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {next ? (
        <ActionForm action={transitionOrderAction} hidden={{ orderId, status: next }} className="flex flex-col gap-2">
          {needsCourier ? (
            <Button size="lg" disabled className="w-full">
              {TRANSITION_LABELS[next]}
            </Button>
          ) : (
            <SubmitButton size="lg" className="w-full">
              {TRANSITION_LABELS[next]}
            </SubmitButton>
          )}
          {needsCourier ? (
            <p className="text-small text-warning-700">Assign a courier before marking the order shipped.</p>
          ) : FORWARD_HINTS[next] ? (
            <p className="text-small text-neutral-500">{FORWARD_HINTS[next]}</p>
          ) : null}
        </ActionForm>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canAssignCourier(status) ? (
          <FormDialog
            action={assignCourierAction}
            hidden={{ orderId }}
            title={hasCourier ? "Change courier" : "Assign courier"}
            description="The customer's purchased delivery service is kept on the order."
            triggerLabel={hasCourier ? "Change courier" : "Assign courier"}
            triggerIcon={<TruckIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            submitLabel="Save courier"
          >
            {(state) => (
              <>
                <Field label="Courier" required error={state && !state.ok ? state.fieldErrors?.courierId : undefined}>
                  {(control) => (
                    <Select
                      {...control}
                      name="courierId"
                      defaultValue={currentCourierId ?? ""}
                      required
                      placeholder="Choose a courier"
                      options={couriers.map((courier) => ({ value: courier.id, label: courier.name }))}
                    />
                  )}
                </Field>
                <Field
                  label="Tracking number"
                  hint="Optional. Letters, digits and dashes."
                  error={state && !state.ok ? state.fieldErrors?.trackingNumber : undefined}
                >
                  {(control) => <Input {...control} name="trackingNumber" defaultValue={currentTracking ?? ""} maxLength={64} autoComplete="off" />}
                </Field>
              </>
            )}
          </FormDialog>
        ) : null}

        {canAddTrackingEvent(status) ? (
          <FormDialog
            action={addShipmentEventAction}
            hidden={{ orderId }}
            title="Add tracking update"
            description="Customers see this message on their tracking page. Only add what the courier has actually reported."
            triggerLabel="Add tracking update"
            submitLabel="Add update"
          >
            {(state) => (
              <>
                <Field label="Status" required>
                  {(control) => (
                    <Select {...control} name="status" defaultValue="in_transit" options={TRACKING_STATUS_OPTIONS} />
                  )}
                </Field>
                <Field label="Message for the customer" required error={state && !state.ok ? state.fieldErrors?.message : undefined}>
                  {(control) => (
                    <textarea
                      {...control}
                      name="message"
                      required
                      maxLength={280}
                      rows={3}
                      className={cn(fieldControlClasses, "h-auto py-3")}
                      placeholder="e.g. Out for delivery with a Pathao rider."
                    />
                  )}
                </Field>
                <Field label="Location" hint="Optional, e.g. Pokhara hub." error={state && !state.ok ? state.fieldErrors?.location : undefined}>
                  {(control) => <Input {...control} name="location" maxLength={120} />}
                </Field>
              </>
            )}
          </FormDialog>
        ) : null}

        {canRefund(status, paymentStatus) ? (
          <FormDialog
            action={markRefundedAction}
            hidden={{ orderId }}
            title="Mark payment refunded?"
            description="Use this after the customer has been refunded in person. Returned items are not restocked automatically; inspect them and adjust Inventory."
            triggerLabel="Mark refunded"
            submitLabel="Mark refunded"
          >
            <p className="text-body text-neutral-700">This changes the payment status from Collected to Refunded.</p>
          </FormDialog>
        ) : null}

        {canCancel(status) ? (
          <FormDialog
            action={transitionOrderAction}
            hidden={{ orderId, status: "canceled" }}
            title="Cancel this order?"
            description={
              status === "shipped"
                ? "The parcel will be recorded as returned to the store. Items go back into stock."
                : "Items go back into stock and the COD payment is marked failed."
            }
            triggerLabel="Cancel order"
            submitLabel="Cancel order"
          >
            {(state) => (
              <Field label="Reason" required error={state && !state.ok ? state.fieldErrors?.reason : undefined} id={reasonId}>
                {(control) => (
                  <textarea
                    {...control}
                    name="reason"
                    required
                    maxLength={300}
                    rows={3}
                    className={cn(fieldControlClasses, "h-auto py-3")}
                    placeholder="e.g. Customer asked to cancel by phone."
                  />
                )}
              </Field>
            )}
          </FormDialog>
        ) : null}
      </div>
    </div>
  );
}
