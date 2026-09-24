import Link from "next/link";
import { HandbagIcon, HeartIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

/**
 * Wishlist persistence ships with accounts; the heart is present but inert
 * and says so, rather than silently doing nothing.
 */
export function WishlistSoonButton({
  productTitle,
  className,
}: {
  productTitle: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label={`Save ${productTitle} to wishlist (coming soon)`}
      title="Wishlist coming soon"
      className={cn(
        "flex size-9 cursor-not-allowed items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm",
        className,
      )}
    >
      <HeartIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
    </button>
  );
}

/**
 * Card "cart" action. Adding from a card would skip the variant choice, so it
 * opens the product page to choose options instead.
 */
export function ChooseOptionsLink({ slug, title }: { slug: string; title: string }) {
  return (
    <Link
      href={`/products/${slug}`}
      aria-label={`Choose options for ${title}`}
      className={iconButtonClasses({ variant: "primary", size: "sm" })}
    >
      <HandbagIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
    </Link>
  );
}
