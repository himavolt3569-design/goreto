import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { productCountLabel } from "@/components/store/category/category-card";
import { Breadcrumbs } from "@/components/store/product/breadcrumbs";
import { ProductGrid } from "@/components/store/product-grid";
import { ActiveFilters, activeFilterChips } from "@/components/store/search/active-filters";
import { SearchPagination } from "@/components/store/search/pagination";
import { SearchFilters } from "@/components/store/search/search-filters";
import { SearchSortControl } from "@/components/store/search/search-sort";
import { buttonClasses } from "@/components/ui/button";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CaretDownIcon, SlidersHorizontalIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  buildSearchHref,
  defaultSearchSort,
  hasActiveFilters,
  parseSearchParams,
  type SearchParams,
} from "@/features/search/params";
import { getSearchCategoryOptions, searchProducts } from "@/features/search/queries";
import { SEARCH_MAX_LENGTH } from "@/lib/validation/search";

// Renders per request (it reads searchParams); results are cached for 60s
// per parameter set inside searchProducts.

function heading(params: SearchParams): { eyebrow: string; title: string; crumb: string } {
  if (params.q) return { eyebrow: "Search", title: `Results for “${params.q}”`, crumb: "Search" };
  if (params.sort === "newest") return { eyebrow: "Shop", title: "New Arrivals", crumb: "New Arrivals" };
  return { eyebrow: "Shop", title: "All Products", crumb: "Shop" };
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const params = parseSearchParams(await searchParams);
  const bare = !params.q && !hasActiveFilters(params) && params.page === 1;
  return {
    title: params.q ? `Search: ${params.q}` : heading(params).title,
    // Query and filter variations are thin duplicates of the listing.
    ...(bare && params.sort === defaultSearchSort("") ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = parseSearchParams(await searchParams);
  const [results, categories] = await Promise.all([searchProducts(params), getSearchCategoryOptions()]);
  const { eyebrow, title, crumb } = heading(params);
  const chips = activeFilterChips(params, params.category ? categories.titleBySlug[params.category] : undefined);
  const filtered = hasActiveFilters(params);
  const pastEnd = results.products.length === 0 && params.page > 1;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 md:px-8">
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: crumb }]} />
        <SectionHeading as="h1" eyebrow={eyebrow} title={title} />

        <Form
          key={params.q}
          action="/search"
          role="search"
          aria-label="Search products"
          className="flex max-w-2xl gap-3"
        >
          <SearchInput
            name="q"
            aria-label="Search products"
            placeholder="Search products..."
            defaultValue={params.q}
            maxLength={SEARCH_MAX_LENGTH}
            autoComplete="off"
          />
          {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
          {params.minRupees !== null ? <input type="hidden" name="min" value={params.minRupees} /> : null}
          {params.maxRupees !== null ? <input type="hidden" name="max" value={params.maxRupees} /> : null}
          {params.sort !== "relevance" && params.sort !== "featured" ? (
            <input type="hidden" name="sort" value={params.sort} />
          ) : null}
          <button type="submit" className={buttonClasses({ variant: "primary", size: "md" })}>
            Search
          </button>
        </Form>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside aria-label="Filters">
          <details className="group rounded-lg border border-neutral-200 bg-white lg:hidden">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-4 text-body font-medium text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 [&::-webkit-details-marker]:hidden">
              <SlidersHorizontalIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              Filters{chips.length > 0 ? ` (${chips.length})` : ""}
              <CaretDownIcon
                aria-hidden="true"
                size={ICON_SIZE_SM}
                weight={ICON_WEIGHT_OUTLINE}
                className="ml-auto transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <div className="border-t border-neutral-200 p-4">
              <SearchFilters params={params} categoryOptions={categories.options} />
            </div>
          </details>
          <div className="hidden flex-col gap-6 lg:flex">
            <h2 className="text-h3 text-neutral-900">Filters</h2>
            <SearchFilters params={params} categoryOptions={categories.options} />
          </div>
        </aside>

        <section aria-label="Search results" className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className="text-body text-neutral-500">
              {results.total === 0 ? "No products" : productCountLabel(results.total)}
            </p>
            {results.total > 0 ? <SearchSortControl params={params} /> : null}
          </div>
          <ActiveFilters chips={chips} />

          {results.products.length > 0 ? (
            <>
              <ProductGrid products={results.products} />
              <SearchPagination params={params} pageCount={results.pageCount} />
            </>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-8">
              {pastEnd ? (
                <>
                  <p className="text-body-lg text-neutral-700">There are no more results on this page.</p>
                  <Link
                    href={buildSearchHref(params, { page: 1 })}
                    className={buttonClasses({ variant: "text", size: "md" })}
                  >
                    Back to page 1
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-body-lg text-neutral-700">
                    {params.q ? `No products match “${params.q}”.` : "No products match these filters."}
                  </p>
                  <p className="text-body text-neutral-500">
                    {filtered
                      ? "Try removing a filter or widening the price range."
                      : "Check the spelling, or try a shorter or more general word."}
                  </p>
                  <div className="flex flex-wrap gap-6">
                    {filtered ? (
                      <Link
                        href={buildSearchHref(params, { category: null, minRupees: null, maxRupees: null })}
                        className={buttonClasses({ variant: "text", size: "md" })}
                      >
                        Clear filters
                      </Link>
                    ) : null}
                    <Link href="/categories" className={buttonClasses({ variant: "text", size: "md" })}>
                      Browse all categories
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
