import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { AddLink, EditLink, EmptyState, PageHeader, Panel, SuccessNotice, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses, numericClasses } from "@/components/admin/admin-ui";
import { CouponStatePill } from "@/components/admin/status-pills";
import { SealPercentIcon } from "@/components/ui/icons";
import { setCouponActiveAction } from "@/features/admin/actions/engagement";
import { requireAdminAccess } from "@/features/admin/auth";
import { couponDiscountLabel } from "@/features/admin/coupon-label";
import { formatCount, formatDate } from "@/features/admin/format";
import { fetchCoupons } from "@/features/admin/queries/engagement";
import { param } from "@/features/admin/url";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Coupons" };

/** Coupons are validated again on the server when an order is placed (AGENTS §11.5). */
export default async function CouponsPage({ searchParams }: PageProps<"/admin/coupons">) {
  await requireAdminAccess("promotions.manage");
  const deleted = param(await searchParams, "deleted") === "1";
  const coupons = await fetchCoupons();

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes shoppers enter at checkout. Turning a coupon off stops new orders from using it; past orders keep their discount."
        actions={<AddLink href="/admin/coupons/new">Add coupon</AddLink>}
      />
      {deleted ? <SuccessNotice>Coupon deleted.</SuccessNotice> : null}
      <Panel title={`${formatCount(coupons.length)} coupons`}>
        {coupons.length === 0 ? (
          <EmptyState icon={SealPercentIcon} title="No coupons yet" description="Add a coupon to offer a discount at checkout." />
        ) : (
          <TableScroll label="Coupons">
            <table className={cn(tableClasses, "min-w-[960px]")}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>Code</th>
                  <th scope="col" className={thClasses}>Discount</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Min. order</th>
                  <th scope="col" className={thClasses}>Valid</th>
                  <th scope="col" className={cn(thClasses, "text-right")}>Used</th>
                  <th scope="col" className={thClasses}>State</th>
                  <th scope="col" className={thClasses}>On</th>
                  <th scope="col" className={thClasses}><span className="sr-only">Actions</span></th>
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
                    <td className={tdClasses}>{couponDiscountLabel(coupon)}</td>
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
                    <td className={cn(tdClasses, "text-right")}>
                      <EditLink href={`/admin/coupons/${coupon.id}/edit`} label={coupon.code} />
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
