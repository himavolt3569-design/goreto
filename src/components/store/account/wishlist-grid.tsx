"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { HandbagIcon, ProhibitIcon, TrashIcon } from "@/components/ui/icons";
import { MediaFrame } from "@/components/ui/media-frame";
import { StatusIndicator } from "@/components/ui/status";
import { rehydrateCart, useCartStore } from "@/features/cart/store";
import { removeWishlistItemAction } from "@/features/wishlist/actions";
import type { WishlistEntry, WishlistProduct } from "@/features/wishlist/mappers";
import { forgetSaved } from "@/features/wishlist/store";
import { formatNpr } from "@/lib/money/format";

const iconProps = { "aria-hidden": true, size: ICON_SIZE_SM, weight: ICON_WEIGHT_OUTLINE } as const;

/**
 * Saved products (AGENTS §4.9) with current price and stock. A product with a
 * single variant goes straight to the cart; one with choices opens its page.
 * Cart prices are a preview: checkout re-prices on the server.
 */
export function WishlistGrid({ entries }: { entries: WishlistEntry[] }) {
  useEffect(() => {
    rehydrateCart();
  }, []);

  return (
    <ul aria-label="Saved products" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => (
        <li key={entry.itemId} className="flex">
          <WishlistCard entry={entry} />
        </li>
      ))}
    </ul>
  );
}

function WishlistCard({ entry }: { entry: WishlistEntry }) {
  const { product } = entry;
  const [message, setMessage] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const name = product?.title ?? "this product";

  function remove() {
    setMessage(null);
    startRemove(async () => {
      const result = await removeWishlistItemAction(entry.itemId).catch(() => ({
        ok: false as const,
        message: "We couldn't update your wishlist. Please try again.",
      }));
      if (result.ok) {
        if (product) forgetSaved(product.slug);
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <Card className="flex w-full flex-col overflow-hidden">
      {product ? (
        <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden="true">
          <MediaFrame image={product.image} sizes="(min-width: 1280px) 20vw, (min-width: 640px) 40vw, 100vw" className="aspect-square w-full" />
        </Link>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-neutral-100 text-neutral-500">
          <ProhibitIcon aria-hidden="true" size={32} weight={ICON_WEIGHT_OUTLINE} />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        {product ? (
          <>
            <h2 className="text-body font-medium text-neutral-900">
              <Link href={`/products/${product.slug}`} className="line-clamp-2 hover:text-primary-500">
                {product.title}
              </Link>
            </h2>
            <p className="text-h3 font-semibold text-neutral-900">
              {product.priceVaries ? <span className="text-body font-normal text-neutral-500">From </span> : null}
              {formatNpr(product.pricePaisa)}
            </p>
            <StatusIndicator status={product.stock.status} label={product.stock.label} />
          </>
        ) : (
          <>
            <h2 className="text-body font-medium text-neutral-900">No longer available</h2>
            <p className="text-body text-neutral-500">This product isn&apos;t on sale any more.</p>
          </>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          {product ? <PurchaseAction product={product} onMessage={setMessage} /> : null}
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove ${name} from wishlist`}
            aria-disabled={removing || undefined}
            disabled={removing}
            className={iconButtonClasses({ variant: "outline", className: product ? "" : "ml-auto" })}
          >
            <TrashIcon {...iconProps} />
          </button>
        </div>
        <p role="status" className="text-small text-neutral-700">
          {message}
        </p>
      </div>
    </Card>
  );
}

function PurchaseAction({ product, onMessage }: { product: WishlistProduct; onMessage: (message: string) => void }) {
  const addItem = useCartStore((state) => state.addItem);
  const { purchase } = product;

  if (purchase.kind === "sold_out") {
    return (
      <Button type="button" variant="tertiary" size="md" disabled className="flex-1">
        Sold out
      </Button>
    );
  }
  if (purchase.kind === "options") {
    return (
      <Link href={`/products/${product.slug}`} className={buttonClasses({ variant: "secondary", size: "md", className: "flex-1" })}>
        Choose options
      </Link>
    );
  }
  return (
    <Button
      type="button"
      variant="primary"
      size="md"
      className="flex-1"
      leadingIcon={<HandbagIcon {...iconProps} />}
      onClick={() => {
        const added = addItem(purchase.line, 1);
        onMessage(added > 0 ? `Added ${product.title} to your cart.` : `Your cart already has the most you can buy of ${product.title}.`);
      }}
    >
      Add to Cart
    </Button>
  );
}
