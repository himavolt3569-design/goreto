"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  HandbagIcon,
  MoneyIcon,
  TruckIcon,
  WarningCircleIcon,
  type Icon,
} from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Rating } from "@/components/ui/rating";
import { StatusIndicator } from "@/components/ui/status";
import { siteConfig, type ProductAssurance } from "@/config/site";
import { rehydrateCart, useCartStore } from "@/features/cart/store";
import type { ProductDetail } from "@/features/catalog/types";
import {
  defaultVariant,
  maxPurchasable,
  mediaForVariant,
  selectOption,
  stockState,
  variantLabel,
  variantPrice,
} from "@/features/catalog/variants";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { SOFT_SECONDARY } from "./classes";
import { OptionSelector } from "./option-selector";
import { ProductGallery } from "./product-gallery";

/** What the purchase area needs; long-form copy stays server-rendered. */
export type ProductPurchaseData = Pick<
  ProductDetail,
  | "slug"
  | "title"
  | "badge"
  | "rating"
  | "shortDescription"
  | "basePricePaisa"
  | "lowStockThreshold"
  | "options"
  | "variants"
  | "media"
>;

const assuranceIcons: Record<ProductAssurance["icon"], Icon> = {
  delivery: TruckIcon,
  returns: ArrowCounterClockwiseIcon,
  cod: MoneyIcon,
};

/**
 * Gallery + product information + purchase controls. Owns the selected
 * variant, so price, stock, photos and the cart line all follow the choice.
 */
export function ProductPurchase({ product }: { product: ProductPurchaseData }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const [variant, setVariant] = useState(() => defaultVariant(product));
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<{ kind: "added" | "limit"; text: string } | null>(null);

  // The header normally loads the saved cart; make sure it has before adding.
  useEffect(() => {
    rehydrateCart();
  }, []);

  const price = variantPrice(product, variant);
  const stock = stockState(variant.stockQuantity, product.lowStockThreshold);
  const maxQuantity = maxPurchasable(variant.stockQuantity);
  const soldOut = maxQuantity === 0;
  const media = mediaForVariant(product.media, variant.id);
  const label = variantLabel(product, variant);

  function onSelect(optionName: string, value: string) {
    const next = selectOption(product, variant, optionName, value);
    setVariant(next);
    setQuantity((current) => Math.max(1, Math.min(current, maxPurchasable(next.stockQuantity))));
    setMessage(null);
  }

  function addToCart(): number {
    const cover = media[0]?.image ?? null;
    return addItem(
      {
        variantId: variant.id,
        productSlug: product.slug,
        title: product.title,
        variantLabel: label,
        sku: variant.sku,
        image: cover,
        unitPricePaisa: price,
        maxQuantity,
      },
      quantity,
    );
  }

  function onAddToCart() {
    const added = addToCart();
    const name = label ? `${product.title} (${label})` : product.title;
    setMessage(
      added > 0
        ? { kind: "added", text: `Added ${added} × ${name} to your cart.` }
        : {
            kind: "limit",
            text: `Your cart already has the maximum of ${maxQuantity} for ${name}.`,
          },
    );
  }

  function onBuyNow() {
    addToCart();
    router.push("/checkout");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
      <ProductGallery
        key={media.map((item) => item.id).join("|")}
        media={media}
        productTitle={product.title}
      />

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3">
          {product.badge ? (
            <Badge tone={product.badge.tone} size="sm" className="self-start">
              {product.badge.label}
            </Badge>
          ) : null}
          <h1 className="font-display text-h1 text-neutral-900 md:text-display-2">
            {product.title}
          </h1>
          {product.rating ? (
            <Rating variant="stars" value={product.rating.value} count={product.rating.count} />
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-h1 font-bold text-neutral-900">
              <span className="sr-only">Price: </span>
              {formatNpr(price)}
            </p>
            <StatusIndicator status={stock.status} label={stock.label} />
          </div>
          <p className="text-body-lg text-neutral-500">{product.shortDescription}</p>
        </div>

        {product.options.map((option) => (
          <OptionSelector
            key={option.name}
            product={product}
            option={option}
            selected={variant}
            onSelect={onSelect}
          />
        ))}

        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={Math.max(1, maxQuantity)}
              disabled={soldOut}
            />
            <Button
              className="flex-1"
              disabled={soldOut}
              onClick={onAddToCart}
              leadingIcon={
                <HandbagIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              }
            >
              {soldOut ? "Sold Out" : "Add to Cart"}
            </Button>
          </div>
          <Button
            variant="secondary"
            fullWidth
            disabled={soldOut}
            onClick={onBuyNow}
            className={SOFT_SECONDARY}
          >
            Buy Now
          </Button>

          <div role="status" aria-live="polite" className="empty:hidden">
            {message ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-neutral-700">
                {message.kind === "added" ? (
                  <CheckCircleIcon
                    aria-hidden="true"
                    size={ICON_SIZE_SM}
                    weight={ICON_WEIGHT_OUTLINE}
                    className="text-success-500"
                  />
                ) : (
                  <WarningCircleIcon
                    aria-hidden="true"
                    size={ICON_SIZE_SM}
                    weight={ICON_WEIGHT_OUTLINE}
                    className="text-warning-500"
                  />
                )}
                {message.text}
                <Link
                  href="/cart"
                  className="font-medium text-primary-500 underline-offset-4 hover:underline"
                >
                  View cart
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-4 border-t border-neutral-200 pt-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-neutral-200">
          {siteConfig.productAssurances.map((item, index) => {
            const AssuranceIcon = assuranceIcons[item.icon];
            return (
              <li
                key={item.title}
                className={cn("flex items-center gap-3", index > 0 && "sm:pl-4", "sm:pr-4")}
              >
                <AssuranceIcon
                  aria-hidden="true"
                  size={ICON_SIZE}
                  weight={ICON_WEIGHT_OUTLINE}
                  className="shrink-0 text-primary-500"
                />
                <span className="flex flex-col">
                  <span className="text-small font-semibold text-neutral-900">{item.title}</span>
                  <span className="text-small text-neutral-500">{item.caption}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
