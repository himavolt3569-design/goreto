import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productCountLabel } from "@/components/store/category/category-card";
import { CategorySortControl } from "@/components/store/category/category-sort";
import { CollectionBanner } from "@/components/store/collection-banner";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { ProductGrid } from "@/components/store/product-grid";
import { buttonClasses } from "@/components/ui/button";
import { parseCategorySort } from "@/features/catalog/category-sort";
import { getCollectionBySlug, getCollectionProducts } from "@/features/catalog/collections";

// Renders per request (it reads searchParams); the collection data itself is
// cached for 60s inside getCollectionBySlug / getCollectionProducts.

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.title,
    description: collection.description || undefined,
    openGraph: collection.image
      ? { images: [{ url: collection.image.src, alt: collection.image.alt }] }
      : undefined,
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const sort = parseCategorySort((await searchParams).sort);
  const products = await getCollectionProducts(collection.slug, sort);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Collections", href: "/collections" },
            { label: collection.title },
          ]}
        />
        <CollectionBanner
          collection={collection}
          headingLevel="h1"
          priority
          className="overflow-hidden rounded-xl bg-primary-100"
        />
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-8">
          <p className="text-body-lg text-neutral-700">No products in {collection.title} yet.</p>
          <Link href="/collections" className={buttonClasses({ variant: "text", size: "md" })}>
            Browse all collections
          </Link>
        </div>
      ) : (
        <section aria-label={`${collection.title} products`} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body text-neutral-500">{productCountLabel(products.length)}</p>
            <CategorySortControl value={sort} />
          </div>

          <ProductGrid products={products} />
        </section>
      )}
    </div>
  );
}
