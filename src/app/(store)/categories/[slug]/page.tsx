import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productCountLabel } from "@/components/store/category/category-card";
import { CategorySortControl } from "@/components/store/category/category-sort";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { ChooseOptionsLink, WishlistSoonButton } from "@/components/store/product-card-actions";
import { buttonClasses } from "@/components/ui/button";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCategoryBySlug, getCategoryProducts } from "@/features/catalog/categories";
import { parseCategorySort } from "@/features/catalog/category-sort";

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-col gap-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Categories", href: "/categories" },
            { label: category.title },
          ]}
        />
        <SectionHeading
          as="h1"
          eyebrow="Category"
          title={category.title}
          description={category.description}
        />
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-8">
          <p className="text-body-lg text-neutral-700">No products in {category.title} yet.</p>
          <Link href="/categories" className={buttonClasses({ variant: "text", size: "md" })}>
            Browse all categories
          </Link>
        </div>
      ) : (
        <section aria-label={`${category.title} products`} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body text-neutral-500">{productCountLabel(products.length)}</p>
            <CategorySortControl value={sort} />
          </div>

          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {products.map((product) => (
              <li key={product.slug} className="flex">
                <ProductCard
                  title={product.title}
                  href={`/products/${product.slug}`}
                  pricePaisa={product.pricePaisa}
                  image={product.image}
                  rating={product.rating ?? undefined}
                  className="w-full"
                  wishlistAction={<WishlistSoonButton productTitle={product.title} />}
                  cartAction={<ChooseOptionsLink slug={product.slug} title={product.title} />}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
