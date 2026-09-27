"use client";

import Link from "next/link";
import { IconButton } from "@/components/ui/icon-button";
import { TrashIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { MediaFrame } from "@/components/ui/media-frame";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useCartStore, type CartLine } from "@/features/cart/store";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";

/**
 * One cart line: photo, name, variant, quantity stepper, remove and line
 * price. Prices come from the saved cart, which the live quote keeps current.
 */
export function CartLineRow({ line, size = "md" }: { line: CartLine; size?: "md" | "lg" }) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const name = line.variantLabel ? `${line.title} (${line.variantLabel})` : line.title;
  const href = `/products/${line.productSlug}`;

  return (
    <li className="flex gap-4 py-4">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className={cn("relative shrink-0 overflow-hidden rounded-md", size === "lg" ? "size-24" : "size-20")}
      >
        <MediaFrame image={line.image} sizes={size === "lg" ? "96px" : "80px"} className="size-full" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={href}
              className="rounded-xs font-display text-body-lg font-semibold text-neutral-900 transition-colors hover:text-primary-500"
            >
              {line.title}
            </Link>
            {line.variantLabel ? <p className="text-body text-neutral-500">{line.variantLabel}</p> : null}
            {size === "lg" ? (
              <p className="text-small text-neutral-500">{formatNpr(line.unitPricePaisa)} each</p>
            ) : null}
          </div>
          <p className="shrink-0 text-body-lg font-semibold text-neutral-900">
            <span className="sr-only">Line total: </span>
            {formatNpr(line.unitPricePaisa * line.quantity)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <QuantityStepper
            value={line.quantity}
            max={Math.max(1, line.maxQuantity)}
            onChange={(quantity) => setQuantity(line.variantId, quantity)}
            label={`Quantity of ${name}`}
          />
          <IconButton
            label={`Remove ${name}`}
            icon={<TrashIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />}
            className="text-error-700 hover:bg-error-100"
            onClick={() => removeItem(line.variantId)}
          />
        </div>
      </div>
    </li>
  );
}

/** Notices from the live quote: removed items, lowered quantities, new prices. */
export function CartNotices({ notices, onDismiss }: { notices: { variantId: string; kind: string; text: string }[]; onDismiss: () => void }) {
  if (notices.length === 0) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-md border border-warning-500/40 bg-warning-100 p-4 text-body text-neutral-900">
      <p className="font-semibold">Your cart was updated</p>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {notices.map((notice) => (
          <li key={`${notice.variantId}-${notice.kind}`}>{notice.text}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onDismiss}
        className="self-start rounded-xs font-medium text-primary-500 underline-offset-4 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}
