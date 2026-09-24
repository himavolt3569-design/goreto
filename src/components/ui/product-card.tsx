import Link from "next/link";
import type { ReactNode } from "react";
import { formatNpr } from "@/lib/money/format";
import { cn } from "@/lib/utils/cn";
import { Badge, type BadgeTone } from "./badge";
import { MediaFrame, type MediaImage } from "./media-frame";
import { Rating } from "./rating";

export type ProductCardProps = {
  title: string;
  href: string;
  pricePaisa: number;
  image?: MediaImage | null;
  badge?: { tone: BadgeTone; label: string };
  rating?: { value: number; count?: number };
  /** Top-right action, e.g. a wishlist toggle. */
  wishlistAction?: ReactNode;
  /** Price-row action, e.g. an add-to-cart IconButton. */
  cartAction?: ReactNode;
  layout?: "vertical" | "horizontal";
  className?: string;
};

/**
 * Product card (Design System §12). The title link is stretched over the card
 * so the whole surface navigates; action slots sit above it.
 */
export function ProductCard({
  title,
  href,
  pricePaisa,
  image,
  badge,
  rating,
  wishlistAction,
  cartAction,
  layout = "vertical",
  className,
}: ProductCardProps) {
  const horizontal = layout === "horizontal";

  return (
    <article
      className={cn(
        "group relative flex rounded-lg border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md",
        horizontal ? "flex-row gap-4 p-3" : "flex-col overflow-hidden",
        className,
      )}
    >
      <MediaFrame
        image={image}
        sizes={horizontal ? "96px" : "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"}
        className={horizontal ? "size-24 shrink-0 rounded-sm" : "aspect-square w-full"}
      />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2",
          horizontal ? "py-1" : "p-3",
        )}
      >
        {badge ? (
          <Badge tone={badge.tone} size="sm" className="self-start">
            {badge.label}
          </Badge>
        ) : null}

        <h3 className="text-body font-medium text-neutral-900">
          <Link
            href={href}
            className="line-clamp-2 after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary-500"
          >
            {title}
          </Link>
        </h3>

        {rating ? <Rating value={rating.value} count={rating.count} /> : null}

        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="text-h3 font-semibold text-neutral-900">
            {formatNpr(pricePaisa)}
          </p>
          {cartAction ? <div className="relative z-10">{cartAction}</div> : null}
        </div>
      </div>

      {wishlistAction ? (
        <div className="absolute right-2 top-2 z-10">{wishlistAction}</div>
      ) : null}
    </article>
  );
}
