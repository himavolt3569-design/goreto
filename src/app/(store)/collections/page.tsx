import type { Metadata } from "next";
import Link from "next/link";
import { CollectionCard } from "@/components/store/collection/collection-card";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCollections } from "@/features/catalog/collections";

/** Catalog data is cached and refreshed at most once a minute (ISR). */
export const revalidate = 60;

const DESCRIPTION = "Seasonal edits and staff picks for festivals, cooler days and everyday style.";

export const metadata: Metadata = {
  title: "Collections",
  description: DESCRIPTION,
};

export default async function CollectionsPage() {
  const collections = await getCollections();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Collections" }]} />
        <SectionHeading as="h1" eyebrow="Curated edits" title="Collections" description={DESCRIPTION} />
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-8">
          <p className="text-body-lg text-neutral-700">New collections are coming soon.</p>
          <Link href="/search" className={buttonClasses({ variant: "text", size: "md" })}>
            Shop all products
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {collections.map((collection) => (
            <li key={collection.slug} className="flex">
              <CollectionCard collection={collection} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
