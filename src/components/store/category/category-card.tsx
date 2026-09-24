import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MediaFrame } from "@/components/ui/media-frame";
import type { CategorySummary } from "@/features/catalog/types";

export function productCountLabel(count: number): string {
  if (count === 0) return "Coming soon";
  return `${count} ${count === 1 ? "product" : "products"}`;
}

/**
 * `/categories` tile. Like `ProductCard`, the title link is stretched over
 * the card so the whole surface navigates. The photo is decorative: the
 * title names the tile.
 */
export function CategoryCard({ category }: { category: CategorySummary }) {
  return (
    <Card interactive className="group relative flex w-full flex-col overflow-hidden">
      <MediaFrame
        image={category.image}
        sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="aspect-square w-full"
      />
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-h3 text-neutral-900">
            <Link
              href={`/categories/${category.slug}`}
              className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary-500"
            >
              {category.title}
            </Link>
          </h2>
          <p className="text-small text-neutral-500">{productCountLabel(category.productCount)}</p>
        </div>
        <ArrowRightIcon
          aria-hidden="true"
          size={ICON_SIZE_XS}
          weight={ICON_WEIGHT_OUTLINE}
          className="shrink-0 text-neutral-500 transition-colors group-hover:text-primary-500"
        />
      </div>
    </Card>
  );
}
