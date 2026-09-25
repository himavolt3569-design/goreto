import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { CouponStatePill } from "@/components/admin/status-pills";
import { SealPercentIcon } from "@/components/ui/icons";
import { setCouponActiveAction } from "@/features/admin/actions/engagement";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatCount, formatDate } from "@/features/admin/format";
import { fetchCoupons, type CouponRow } from "@/features/admin/queries/engagement";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Coupons" };

function discountLabel(coupon: CouponRow): string {
  if (coupon.type === "percentage") {
    const cap = coupon.maxDiscountPaisa ? ` (up to ${formatNpr(coupon.maxDiscountPaisa)})` : "";
    return `${coupon.percentOff}% off${cap}`;
  }
  return `${formatNpr(coupon.amountOffPaisa ?? 0)} off`;
}

/** Coupons are validated again on the server when an order is placed (AGENTS §11.5). */
export default async function CouponsPage() {
  await requireAdminAccess("promotions.manage");
  const coupons = await fetchCoupons();

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes shoppers enter at checkout. Turning a coupon off stops new orders from using it; past orders keep their discount."
      />
      <Panel title={`${formatCount(coupons.length)} coupons`}>
        {coupons.length === 0 ? (
          <EmptyState icon={SealPercentIcon} title="No coupons yet" />
        ) : (
          <TableScroll label="Coupons">
            <table className={cn(tableClasses, "min-w-[880px]")}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>Code</th>
                  <th scope="col" className={thClasses}>Discount</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Min. order</th>
                  <th scope="col" className={thClasses}>Valid</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Used</th>
                  <th scope="col" className={thClasses}>State</th>
                  <th scope="col" className={thClasses}>On</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className={tdClasses}>
                      <span className="flex flex-col">
                        <span className="font-semibold tracking-wide">{coupon.code}</span>
                        {coupon.description ? <span className="text-small text-neutral-500">{coupon.description}</span> : null}
                      </span>
                    </td>
                    <td className={tdClasses}>{discountLabel(coupon)}</td>
                    <td className={cn(tdClasses, numericClasses)}>{coupon.minOrderPaisa ? formatNpr(coupon.minOrderPaisa) : "—"}</td>
                    <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>
                      {formatDate(coupon.startsAt)} – {coupon.endsAt ? formatDate(coupon.endsAt) : "no end"}
                    </td>
                    <td className={cn(tdClasses, numericClasses)}>
                      {formatCount(coupon.timesUsed)}
                      {coupon.usageLimit ? <span className="text-neutral-500"> / {formatCount(coupon.usageLimit)}</span> : null}
                    </td>
                    <td className={tdClasses}>
                      <CouponStatePill state={coupon.state} />
                    </td>
                    <td className={tdClasses}>
                      <ToggleForm action={setCouponActiveAction} id={coupon.id} checked={coupon.isActive} label={`Coupon ${coupon.code} enabled`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </>
  );
}
