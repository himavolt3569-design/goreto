"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { TrashIcon } from "@/components/ui/icons";
import { deleteCouponAction } from "@/features/admin/actions/coupons";
import { deleteCourierAction, deleteRateAction, deleteZoneAction } from "@/features/admin/actions/delivery";
import { FormDialog, type AdminAction } from "./action-forms";

/*
 * Delete for coupons, couriers, zones and rates (admin phase 3). Records that
 * are part of order history can't be deleted (the database refuses too);
 * the card says why and points to turning them off instead.
 */

function DangerZone({
  blocked,
  summary,
  action,
  hidden,
  title,
  label,
  children,
}: {
  /** Why it can't be deleted, or null when it can. */
  blocked: ReactNode | null;
  summary: string;
  action: AdminAction;
  hidden: Record<string, string>;
  title: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 border-error-100 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 text-neutral-900">Danger zone</h2>
        <p className="text-body text-neutral-500">{blocked ?? summary}</p>
      </div>
      {blocked ? null : (
        <FormDialog
          action={action}
          hidden={hidden}
          title={`Delete “${title}”?`}
          description="This can't be undone."
          triggerLabel={label}
          triggerIcon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
          submitLabel={label}
        >
          <p className="text-body text-neutral-700">{children}</p>
        </FormDialog>
      )}
    </Card>
  );
}

const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count.toLocaleString("en-IN")} ${many}`);

export function CouponDangerZone({ couponId, code, orderCount }: { couponId: string; code: string; orderCount: number }) {
  return (
    <DangerZone
      blocked={orderCount > 0 ? `${plural(orderCount, "order", "orders")} used this coupon, so it can't be deleted. Turn it off to stop new orders using it.` : null}
      summary="Deleting removes the coupon for good."
      action={deleteCouponAction}
      hidden={{ couponId }}
      title={code}
      label="Delete coupon"
    >
      No orders have used it.
    </DangerZone>
  );
}

export function CourierDangerZone({ courierId, name, serviceCount, shipmentCount }: { courierId: string; name: string; serviceCount: number; shipmentCount: number }) {
  const blocked =
    shipmentCount > 0
      ? `${plural(shipmentCount, "shipment was", "shipments were")} assigned to this courier, so it can't be deleted. Turn it off instead.`
      : serviceCount > 0
        ? "Delete its services first, or turn the courier off."
        : null;
  return (
    <DangerZone blocked={blocked} summary="Deleting removes the courier for good." action={deleteCourierAction} hidden={{ courierId }} title={name} label="Delete courier">
      It has no services or shipments.
    </DangerZone>
  );
}

export function ZoneDangerZone({ zoneId, name, rateCount, districtCount }: { zoneId: string; name: string; rateCount: number; districtCount: number }) {
  return (
    <DangerZone
      blocked={null}
      summary="Past orders keep the zone and fee they were charged."
      action={deleteZoneAction}
      hidden={{ zoneId }}
      title={name}
      label="Delete zone"
    >
      {rateCount === 0 ? "It has no rates." : `Its ${plural(rateCount, "rate is", "rates are")} deleted with it.`}{" "}
      {districtCount > 0 ? `Checkout can't deliver to its ${plural(districtCount, "district", "districts")} until you add them to another zone.` : null}
    </DangerZone>
  );
}

export function RateDangerZone({ rateId, label }: { rateId: string; label: string }) {
  return (
    <DangerZone
      blocked={null}
      summary="Past orders keep the fee they were charged."
      action={deleteRateAction}
      hidden={{ rateId }}
      title={label}
      label="Delete rate"
    >
      Checkout stops offering this service in this zone.
    </DangerZone>
  );
}
