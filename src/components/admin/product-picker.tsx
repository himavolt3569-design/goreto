"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Thumb } from "@/components/admin/admin-ui";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import type { ProductSearchResult, PickerProduct } from "@/features/admin/queries/collection-editor";
import { ProductStatusPill } from "./status-pills";

/*
 * Choose one product by name (Media upload, AR asset editor). The search
 * action checks the caller's permission; RLS decides which products appear.
 */

const SEARCH_DELAY_MS = 250;

export function ProductPicker({
  search,
  selected,
  onSelect,
  label = "Product",
  hint = "Type at least 2 letters of a product name. Archived products aren't listed.",
  error,
}: {
  search: (query: string) => Promise<ProductSearchResult>;
  selected: PickerProduct | null;
  onSelect: (product: PickerProduct | null) => void;
  label?: string;
  hint?: string;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const latestQuery = useRef("");
  const resultsId = useId();

  useEffect(() => {
    const term = query.trim();
    latestQuery.current = term;
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const response = await search(term);
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
  }, [query, search]);

  if (selected) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-body font-medium text-neutral-900">{label}</span>
        <div className="flex items-center gap-3 rounded-md border border-neutral-200 px-4 py-2">
          <Thumb src={selected.thumbnail} />
          <span className="min-w-0 flex-1 truncate text-body font-medium text-neutral-900">{selected.title}</span>
          <span className="hidden sm:block">
            <ProductStatusPill status={selected.status} />
          </span>
          <Button variant="tertiary" size="md" onClick={() => onSelect(null)}>
            Change <span className="sr-only">product</span>
          </Button>
        </div>
        {error ? <p className="text-small text-error-700">{error}</p> : null}
      </div>
    );
  }

  const shown = query.trim().length < 2 ? [] : results;

  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint={hint} error={error}>
        {(control) => (
          <SearchInput
            {...control}
            value={query}
            autoComplete="off"
            placeholder="Search products"
            aria-controls={resultsId}
            onChange={(event) => setQuery(event.target.value)}
            // Enter would submit the surrounding form.
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        )}
      </Field>
      <div id={resultsId} aria-live="polite" aria-busy={searching || undefined}>
        {searchError ? <p className="text-small text-error-700">{searchError}</p> : null}
        {query.trim().length >= 2 && !searching && !searchError && shown.length === 0 ? (
          <p className="text-small text-neutral-500">No products match “{query.trim()}”.</p>
        ) : null}
        {shown.length > 0 ? (
          <ul aria-label="Search results" className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {shown.map((product) => (
              <li key={product.id} className="flex items-center gap-3 px-4 py-2">
                <Thumb src={product.thumbnail} />
                <span className="min-w-0 flex-1 truncate text-body font-medium text-neutral-900">{product.title}</span>
                <ProductStatusPill status={product.status} />
                <button type="button" onClick={() => onSelect(product)} className={buttonClasses({ variant: "secondary", size: "md" })}>
                  Choose <span className="sr-only">{product.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
