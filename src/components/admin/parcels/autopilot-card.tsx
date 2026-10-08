"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { LightningIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { setAutopilotAction } from "@/features/admin/actions/parcels";
import { autopilotState } from "@/features/admin/parcels";
import type { AutopilotStatus } from "@/features/admin/queries/parcels";
import { cn } from "@/lib/utils/cn";
import { ActionMessage } from "../action-forms";
import { SetupChecklist } from "../daraz-dashboard";

/*
 * Autopilot (prompts/goreto-send-and-track.md): one switch over the existing
 * automation settings, with what would stop it from working. Changing it
 * needs settings.manage and delivery.manage; everyone else sees the state.
 */

const STATE_LABELS = { on: "On", off: "Off", partly: "Partly on" } as const;
const STATE_CLASSES = { on: "bg-success-100 text-success-700", off: "bg-neutral-100 text-neutral-700", partly: "bg-warning-100 text-warning-700" } as const;

export function AutopilotCard({ status, canChange }: { status: AutopilotStatus; canChange: boolean }) {
  const [result, formAction, pending] = useActionState(setAutopilotAction, null);
  const autopilot = autopilotState(status);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const checklist = [
    {
      label: "Cash on Delivery is on",
      done: status.codEnabled,
      hint: status.codEnabled ? undefined : "Settings › Checkout. New orders are paused until it's on.",
    },
    {
      label: "Daraz Express is connected",
      done: status.darazConnected,
      hint: status.darazConnected ? undefined : "Waiting for the Daraz keys. Other couriers still work.",
    },
    {
      label: "A courier books through Daraz",
      done: status.darazCourier,
      hint: status.darazCourier ? undefined : "Delivery & Courier › Daraz Express › tick “Booked through the Daraz Express API”.",
    },
    {
      label: "Daraz pickup details are filled in",
      done: status.darazSetupMissing.length === 0,
      hint: status.darazSetupMissing.length === 0 ? undefined : `Daraz Express › Setup. Missing: ${status.darazSetupMissing.join(", ")}.`,
    },
    {
      label: "Every parcel has a weight",
      done: status.unweighedVariants === 0 || status.usualWeightGrams !== null,
      hint:
        status.unweighedVariants === 0
          ? undefined
          : status.usualWeightGrams !== null
            ? `${status.unweighedVariants} products have no weight, so they use the usual ${status.usualWeightGrams} g.`
            : `${status.unweighedVariants} products have no weight. Set a usual parcel weight below.`,
    },
    {
      label: "A fallback courier is chosen",
      done: status.fallbackCourier !== null,
      hint: status.fallbackCourier ? `${status.fallbackCourier}, when a delivery option's own courier is switched off.` : "Optional. Settings › Courier on accept.",
    },
  ];

  return (
    <Card className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="flex flex-wrap items-center gap-2 text-h2 text-neutral-900">
            <LightningIcon aria-hidden="true" size={24} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
            Autopilot{" "}
            <span className={cn("rounded-full px-3 py-1 text-small font-medium", STATE_CLASSES[autopilot.state])}>{STATE_LABELS[autopilot.state]}</span>
          </h2>
          <p className="text-body text-neutral-500">
            {autopilot.state === "on"
              ? "New orders are accepted, sent to the right courier and booked with Daraz without anyone pressing a button."
              : autopilot.state === "partly"
                ? `Some steps are automatic (${autopilot.on.join(", ")}), others wait for you (${autopilot.off.join(", ")}).`
                : "New orders wait for you here. Turn Autopilot on to accept and send them automatically."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="text-h3 text-neutral-900">When it&rsquo;s on</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-neutral-700">
            <li>Every new order, from the website or typed in here, is accepted straight away.</li>
            <li>It goes to the courier of the delivery option the customer chose, or the fallback courier.</li>
            <li>Daraz Express parcels are booked automatically. You print the label when you pack.</li>
            <li>Other couriers: tap Send on WhatsApp in the list. A free WhatsApp link can&rsquo;t send by itself.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-h3 text-neutral-900">Ready?</h3>
          <SetupChecklist items={checklist} />
        </div>
      </div>

      {canChange ? (
        <form action={formAction} className="flex flex-col gap-4 border-t border-neutral-100 pt-6 md:flex-row md:items-end">
          <Field
            label="Usual parcel weight (g)"
            hint="Used when a product has no weight saved. Daraz weighs parcels at pickup."
            error={errors.usualWeightGrams}
            className="md:w-72"
          >
            {(control) => (
              <Input {...control} name="usualWeightGrams" defaultValue={status.usualWeightGrams?.toString() ?? ""} inputMode="numeric" maxLength={6} autoComplete="off" placeholder="e.g. 500" />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            {autopilot.state === "on" ? (
              <>
                <Button type="submit" name="enabled" value="on" variant="secondary" disabled={pending}>
                  Save weight
                </Button>
                <Button type="submit" name="enabled" value="off" variant="tertiary" disabled={pending}>
                  Turn off Autopilot
                </Button>
              </>
            ) : (
              <>
                <Button type="submit" name="enabled" value="on" disabled={pending} leadingIcon={<LightningIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}>
                  {autopilot.state === "partly" ? "Turn on fully" : "Turn on Autopilot"}
                </Button>
                {autopilot.state === "partly" ? (
                  <Button type="submit" name="enabled" value="off" variant="tertiary" disabled={pending}>
                    Turn off
                  </Button>
                ) : null}
              </>
            )}
          </div>
          <ActionMessage state={result} className="md:pb-3" />
        </form>
      ) : (
        <p className="border-t border-neutral-100 pt-6 text-small text-neutral-500">Only the owner, or staff with settings and delivery access, can change Autopilot.</p>
      )}
    </Card>
  );
}
