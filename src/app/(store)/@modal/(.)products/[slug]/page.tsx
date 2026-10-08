import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { ProductPurchase } from "@/components/store/product/product-purchase";
import { QUICK_VIEW_TITLE_ID } from "@/components/store/quick-view/ids";
import { getQuickViewProduct } from "@/features/catalog/product-detail";
import { isValidSlug } from "@/features/catalog/slug";

export default async function QuickViewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Validate before the cache so arbitrary slugs never become cache keys.
  const product = isValidSlug(slug) ? await getQuickViewProduct(slug) : null;

  if (!product) {
    return (
      <div className="flex flex-col items-start gap-4 py-8">
        <h2 id={QUICK_VIEW_TITLE_ID} className="text-h2 font-semibold text-neutral-900">
          This product isn&apos;t available any more
        </h2>
        <p className="text-body-lg text-neutral-500">
          It may have been removed or sold out for good. Have a look at the rest of the store.
        </p>
        <Link href="/search" className={buttonClasses({ variant: "primary", size: "md" })}>
          Browse all products
        </Link>
      </div>
    );
  }

  return (
    <ProductPurchase
      variant="quick-view"
      product={{
        slug: product.slug,
        title: product.title,
        badge: product.badge,
        isPick: product.isPick,
        rating: product.rating,
        shortDescription: product.shortDescription,
        basePricePaisa: product.basePricePaisa,
        lowStockThreshold: product.lowStockThreshold,
        options: product.options,
        variants: product.variants,
        media: product.media,
      }}
    />
  );
}
