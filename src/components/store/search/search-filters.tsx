import Form from "next/form";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  buildSearchHref,
  defaultSearchSort,
  hasActiveFilters,
  type SearchParams,
} from "@/features/search/params";

/**
 * Category and price filters as a GET form (works without JavaScript; with
 * it, `next/form` navigates client-side). The query and a non-default sort
 * ride along as hidden inputs; a new filter always starts at page 1.
 */
export function SearchFilters({
  params,
  categoryOptions,
}: {
  params: SearchParams;
  categoryOptions: readonly SelectOption[];
}) {
  return (
    // Keyed by the URL so the uncontrolled fields reset after navigation.
    <Form key={buildSearchHref(params)} action="/search" className="flex flex-col gap-6">
      {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {params.sort !== defaultSearchSort(params.q) ? (
        <input type="hidden" name="sort" value={params.sort} />
      ) : null}

      <Field label="Category">
        {(control) => (
          <Select
            {...control}
            name="category"
            defaultValue={params.category ?? ""}
            options={categoryOptions}
          />
        )}
      </Field>

      <fieldset className="flex flex-col">
        <legend className="mb-2 text-body font-medium text-neutral-900">Price (Rs.)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum price in rupees" hideLabel>
            {(control) => (
              <Input
                {...control}
                name="min"
                inputMode="numeric"
                pattern="[0-9,]*"
                placeholder="Min"
                defaultValue={params.minRupees ?? ""}
              />
            )}
          </Field>
          <Field label="Maximum price in rupees" hideLabel>
            {(control) => (
              <Input
                {...control}
                name="max"
                inputMode="numeric"
                pattern="[0-9,]*"
                placeholder="Max"
                defaultValue={params.maxRupees ?? ""}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClasses({ variant: "primary", size: "md" })}>
          Apply filters
        </button>
        {hasActiveFilters(params) ? (
          <Link
            href={buildSearchHref(params, { category: null, minRupees: null, maxRupees: null })}
            className={buttonClasses({ variant: "text", size: "md" })}
          >
            Clear all
          </Link>
        ) : null}
      </div>
    </Form>
  );
}
