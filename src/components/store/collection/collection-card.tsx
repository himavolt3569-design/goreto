import Link from "next/link";
import { productCountLabel } from "@/components/store/category/category-card";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MediaFrame } from "@/components/ui/media-frame";
import type { CollectionSummary } from "@/features/catalog/types";

/**
 * `/collections` card. As in `CategoryCard`, the title link is stretched over
 * the card and the photo is decorative: the title names the card.
 */
export function CollectionCard({ collection }: { collection: CollectionSummary }) {
  const image = collection.image ? { ...collection.image, alt: "" } : null;
  return (
    <Card interactive className="group relative flex w-full flex-col overflow-hidden">
      <MediaFrame
        image={image}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="aspect-4/3 w-full"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        {collection.eyebrow ? (
          <p className="text-small font-semibold uppercase tracking-widest text-primary-500">
            {collection.eyebrow}
          </p>
        ) : null}
        <h2 className="text-h3 text-neutral-900">
          <Link
            href={`/collections/${collection.slug}`}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary-500"
          >
            {collection.title}
          </Link>
        </h2>
        {collection.description ? (
          <p className="line-clamp-2 text-body text-neutral-500">{collection.description}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <p className="text-small text-neutral-500">{productCountLabel(collection.productCount)}</p>
          <ArrowRightIcon
            aria-hidden="true"
            size={ICON_SIZE_XS}
            weight={ICON_WEIGHT_OUTLINE}
            className="shrink-0 text-neutral-500 transition-colors group-hover:text-primary-500"
          />
        </div>
      </div>
    </Card>
  );
}
