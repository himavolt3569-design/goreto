import Image from "next/image";
import Link from "next/link";
import type { HomeCategory } from "@/features/catalog/types";
import {
  ArrowRightIcon,
  buttonClasses,
  DotsThreeIcon,
  ICON_SIZE,
  ICON_SIZE_XS,
  ICON_WEIGHT_OUTLINE,
  SectionHeading,
} from "@/components/ui";

const itemClasses =
  "group flex w-20 shrink-0 snap-start flex-col items-center gap-2 rounded-md text-center xl:w-24";
const circleClasses =
  "relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-primary-100 ring-1 ring-neutral-200 transition-shadow group-hover:shadow-md group-hover:ring-primary-300 xl:size-24";

export function CategoryRail({ categories }: { categories: HomeCategory[] }) {
  return (
    <section
      aria-labelledby="categories-title"
      className="mx-auto w-full max-w-7xl px-4 pt-12 md:px-8 md:pt-16"
    >
      <SectionHeading
        id="categories-title"
        eyebrow="Shop by category"
        title="Find What You Love"
        description="Explore our curated collections designed for your everyday style."
        action={
          <Link href="/categories" className={buttonClasses({ variant: "text", size: "md" })}>
            View All Categories
            <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
          </Link>
        }
      />

      {categories.length === 0 ? (
        <p className="mt-8 text-body text-neutral-500">Categories are coming soon.</p>
      ) : (
        <ul
          aria-label="Categories"
          className="relative -mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:scroll-px-8 md:px-8 xl:mx-0 xl:justify-between xl:overflow-visible xl:px-0"
        >
          {categories.map((category) => (
            <li key={category.slug} data-animate="reveal" className="shrink-0">
              <Link href={`/categories/${category.slug}`} className={itemClasses}>
                <span className={circleClasses}>
                  {category.image ? (
                    <Image
                      src={category.image.src}
                      alt={category.image.alt}
                      fill
                      sizes="96px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                </span>
                <span className="text-body text-neutral-700 group-hover:text-neutral-900">
                  {category.title}
                </span>
              </Link>
            </li>
          ))}
          <li data-animate="reveal" className="shrink-0">
            <Link href="/categories" className={itemClasses}>
              <span className={circleClasses}>
                <DotsThreeIcon
                  aria-hidden="true"
                  size={ICON_SIZE}
                  weight={ICON_WEIGHT_OUTLINE}
                  className="text-neutral-900"
                />
              </span>
              <span className="text-body text-neutral-700 group-hover:text-neutral-900">
                More<span className="sr-only"> categories</span>
              </span>
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}
