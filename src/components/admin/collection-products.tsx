"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Thumb } from "@/components/admin/admin-ui";
import { buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { ArrowDownIcon, ArrowUpIcon, PackageIcon, PlusIcon, XIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { searchCollectionProductsAction } from "@/features/admin/actions/collections";
import { MAX_COLLECTION_PRODUCTS } from "@/features/admin/catalog-forms";
import type { CollectionProduct, PickerProduct } from "@/features/admin/queries/collection-editor";
import { ProductStatusPill } from "./status-pills";

/*
 * The products in a collection, in display order. Staff search by name to
 * add products, and reorder or remove them; the list is submitted as the
 * hidden `productIds` field and saved with the collection in one transaction.
 */

const SEARCH_DELAY_MS = 250;

export function CollectionProducts({ initial, error }: { initial: CollectionProduct[]; error?: string }) {
  const [products, setProducts] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [announcement, setAnnouncement] = useState("");
  const latestQuery = useRef("");
  const resultsId = useId();

  useEffect(() => {
    const term = query.trim();
    latestQuery.current = term;
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const response = await searchCollectionProductsAction(term);
        if (latestQuery.current !== term) return; // A newer search is on its way.
        if (response.ok) {
          setResults(response.products);
          setSearchError(null);
        } else {
          setResults([]);
          setSearchError(response.message);
        }
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const listed = new Set(products.map((product) => product.id));
  const available = query.trim().length < 2 ? [] : results.filter((product) => !listed.has(product.id));
  const full = products.length >= MAX_COLLECTION_PRODUCTS;

  function add(product: PickerProduct) {
    setProducts((current) => (current.some((item) => item.id === product.id) ? current : [...current, product]));
    setAnnouncement(`${product.title} added. ${products.length + 1} products.`);
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= products.length) return;
    const next = [...products];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setProducts(next);
    setAnnouncement(`${nameOf(products[index]!)} moved to position ${target + 1}.`);
  }

  function remove(index: number) {
    const product = products[index]!;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setAnnouncement(`${nameOf(product)} removed.`);
  }

  return (
    <div className="flex flex-col gap-6">
      <input type="hidden" name="productIds" value={products.map((product) => product.id).join(",")} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="flex flex-col gap-2">
        <Field
          label="Add products"
          hint={full ? `A collection holds at most ${MAX_COLLECTION_PRODUCTS} products.` : "Type at least 2 letters of a product name. Archived products aren't listed."}
        >
          {(control) => (
            <SearchInput
              {...control}
              value={query}
              disabled={full}
              autoComplete="off"
              placeholder="Search products"
              aria-controls={resultsId}
              onChange={(event) => setQuery(event.target.value)}
              // Enter would submit the collection form.
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
          )}
        </Field>
        <div id={resultsId} aria-live="polite" aria-busy={searching || undefined}>
          {searchError ? <p className="text-small text-error-700">{searchError}</p> : null}
          {query.trim().length >= 2 && !searching && !searchError && available.length === 0 ? (
            <p className="text-small text-neutral-500">No other products match “{query.trim()}”.</p>
          ) : null}
          {available.length > 0 ? (
            <ul aria-label="Search results" className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
              {available.map((product) => (
                <li key={product.id} className="flex items-center gap-3 px-4 py-2">
                  <Thumb src={product.thumbnail} />
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-neutral-900">{product.title}</span>
                  <ProductStatusPill status={product.status} />
                  <button type="button" aria-label={`Add ${product.title}`} onClick={() => add(product)} disabled={full} className={buttonClasses({ variant: "secondary", size: "md" })}>
                    <PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                    Add
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-error-100 px-4 py-3 text-body text-error-700">
          {error}
        </p>
      ) : null}

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-neutral-300 px-6 py-12 text-center">
          <PackageIcon aria-hidden="true" size={32} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
          <p className="text-body font-medium text-neutral-900">No products yet</p>
          <p className="text-body text-neutral-500">Search above to add products. Only active products are shown to shoppers.</p>
        </div>
      ) : (
        <ol aria-label="Products in this collection" className="flex flex-col gap-2">
          {products.map((product, index) => {
            const name = nameOf(product);
            return (
              <li key={product.id} className="flex items-center gap-3 rounded-md border border-neutral-200 px-4 py-2">
                <span className="w-8 shrink-0 text-small tabular-nums text-neutral-500">{index + 1}.</span>
                <Thumb src={product.thumbnail} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium text-neutral-900">{name}</span>
                  {product.title === null ? <span className="text-small text-neutral-500">You can&apos;t see this product&apos;s details. It stays in the collection.</span> : null}
                </span>
                {product.status ? <span className="hidden sm:block"><ProductStatusPill status={product.status} /></span> : null}
                <div className="flex shrink-0">
                  <button type="button" aria-label={`Move ${name} earlier`} disabled={index === 0} onClick={() => move(index, -1)} className={iconButtonClasses({ variant: "ghost", size: "sm" })}>
                    <ArrowUpIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${name} later`}
                    disabled={index === products.length - 1}
                    onClick={() => move(index, 1)}
                    className={iconButtonClasses({ variant: "ghost", size: "sm" })}
                  >
                    <ArrowDownIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                  </button>
                  <button type="button" aria-label={`Remove ${name}`} onClick={() => remove(index)} className={iconButtonClasses({ variant: "ghost", size: "sm" })}>
                    <XIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function nameOf(product: CollectionProduct): string {
  return product.title ?? "Hidden product";
}
