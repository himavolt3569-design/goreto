import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productCountLabel } from "@/components/store/category/category-card";
import { CategorySortControl } from "@/components/store/category/category-sort";
import { HeroBanner } from "@/components/store/hero-banner";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { ProductGrid } from "@/components/store/product-grid";
import { buttonClasses } from "@/components/ui/button";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ArrowRightIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCategoryBySlug, getCategoryProducts } from "@/features/catalog/categories";
import { parseCategorySort } from "@/features/catalog/category-sort";

// Renders per request (it reads searchParams); the catalog data itself is
// cached for 60s inside getCategoryBySlug / getCategoryProducts.

export async function generateMetadata({
  params,
}: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return { title: category.title, description: category.description };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const sort = parseCategorySort((await searchParams).sort);
  const products = await getCategoryProducts(category.slug, sort);

  const { hero } = category;
  return (
    <>
      {hero ? (
        <HeroBanner
          titleId="category-title"
          eyebrow={hero.eyebrow || undefined}
          title={hero.title}
          text={hero.text || undefined}
          image={hero.image}
          priority
          actions={
            products.length > 0 ? (
              <Link href="#products" className={buttonClasses({ variant: "primary" })}>
                Shop now
                <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              </Link>
            ) : undefined
          }
        />
      ) : null}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-8">
        <div className="flex flex-col gap-6">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Categories", href: "/categories" },
              ...(category.parent
                ? [{ label: category.parent.title, href: `/categories/${category.parent.slug}` }]
                : []),
              { label: category.title },
            ]}
          />
          {/* With a hero, the banner carries the page heading. */}
          {hero ? null : (
            <SectionHeading
              as="h1"
              eyebrow="Category"
              title={category.title}
              description={category.description}
            />
          )}
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-8">
            <p className="text-body-lg text-neutral-700">No products in {category.title} yet.</p>
            <Link href="/categories" className={buttonClasses({ variant: "text", size: "md" })}>
              Browse all categories
            </Link>
          </div>
        ) : (
          <section id="products" aria-label={`${category.title} products`} className="flex scroll-mt-24 flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body text-neutral-500">{productCountLabel(products.length)}</p>
              <CategorySortControl value={sort} />
            </div>

            <ProductGrid products={products} />
          </section>
        )}
      </div>
    </>
  );
}
