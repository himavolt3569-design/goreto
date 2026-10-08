import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { PencilSimpleIcon } from "@/components/ui/icons";
import { MediaFrame, type MediaImage } from "@/components/ui/media-frame";

export type ReviewableProductView = { slug: string; title: string; image: MediaImage | null; deliveredLabel: string };

/** "Ready to review": delivered products the customer hasn't reviewed yet. */
export function ReviewableProducts({ products }: { products: ReviewableProductView[] }) {
  return (
    <ul aria-label="Ready to review" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <li key={product.slug} className="flex">
          <Card className="flex w-full items-center gap-4 p-4">
            {/* Decorative: the product title sits right beside it. */}
            <MediaFrame image={product.image} sizes="64px" className="size-16 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 flex-col">
                <h3 className="truncate text-body font-medium text-neutral-900">{product.title}</h3>
                <p className="text-small text-neutral-500">{product.deliveredLabel}</p>
              </div>
              <Link
                href={`/account/reviews/${product.slug}`}
                aria-label={`Write a review of ${product.title}`}
                className={buttonClasses({ variant: "secondary", size: "md", className: "w-fit" })}
              >
                <PencilSimpleIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                Write a review
              </Link>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
