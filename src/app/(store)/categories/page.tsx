import type { Metadata } from "next";
import { CategoryCard } from "@/components/store/category/category-card";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCategories } from "@/features/catalog/categories";

/** Catalog data is cached and refreshed at most once a minute (ISR). */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Categories",
  description: "Explore our curated collections designed for your everyday style.",
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Categories" }]} />
        <SectionHeading
          as="h1"
          eyebrow="Shop by category"
          title="All Categories"
          description="Explore our curated collections designed for your everyday style."
        />
      </div>

      {categories.length === 0 ? (
        <p className="text-body text-neutral-500">Categories are coming soon.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {categories.map((category) => (
            <li key={category.slug} className="flex">
              <CategoryCard category={category} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
