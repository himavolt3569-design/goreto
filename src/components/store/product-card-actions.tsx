import Link from "next/link";
import { HandbagIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";

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
