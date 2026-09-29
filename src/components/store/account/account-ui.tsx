import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CaretLeftIcon, CaretRightIcon, type Icon } from "@/components/ui/icons";
import { billingLine, type BillingLine, type PaymentStatus } from "@/features/account/billing";
import type { OrderStatus } from "@/features/orders/tracking-model";
import { cn } from "@/lib/utils/cn";

/* Small building blocks shared by the account pages. */

/** Page title row: h1 plus a one-line description. */
export function AccountPageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-h1 text-neutral-900">{title}</h1>
        {description ? <p className="text-body-lg text-neutral-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AccountEmptyState({
  icon: EmptyIcon,
  title,
  description,
  action,
}: {
  icon: Icon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-500">
        <EmptyIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
      </span>
      <h2 className="text-h3 text-neutral-900">{title}</h2>
      {description ? <p className="max-w-md text-body text-neutral-500">{description}</p> : null}
      {action}
    </Card>
  );
}

const paymentTones: Record<BillingLine["tone"], string> = {
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  error: "bg-error-100 text-error-700",
  neutral: "bg-neutral-100 text-neutral-700",
};

/** Payment state as readable text on a tinted pill (colour is never the only signal). */
export function PaymentStatusPill({ status, paymentStatus }: { status: OrderStatus; paymentStatus: PaymentStatus }) {
  const line = billingLine(status, paymentStatus);
  return (
    <span className={cn("inline-flex h-8 items-center whitespace-nowrap rounded-sm px-3 text-body font-medium", paymentTones[line.tone])}>
      {line.label}
    </span>
  );
}

/** Previous / Next links with "Page x of y". Renders nothing for a single page. */
export function AccountPagination({ pathname, page, pageCount }: { pathname: string; page: number; pageCount: number }) {
  if (pageCount <= 1 || page > pageCount) return null;
  const href = (target: number) => (target === 1 ? pathname : `${pathname}?page=${target}`);
  const classes = buttonClasses({ variant: "tertiary", size: "md" });
  const caretLeft = <CaretLeftIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />;
  const caretRight = <CaretRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={classes}>
          {caretLeft}
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={classes}>
          {caretLeft}
          Previous
        </span>
      )}
      <p className="text-body text-neutral-500">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={classes}>
          Next
          {caretRight}
        </Link>
      ) : (
        <span aria-disabled="true" className={classes}>
          Next
          {caretRight}
        </span>
      )}
    </nav>
  );
}
