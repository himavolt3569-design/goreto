"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { buildSearchHref, searchSortOptions, type SearchParams } from "@/features/search/params";

/**
 * "Sort by" for `/search`. With JavaScript, changing it replaces the URL in
 * place (back to page 1). Without it, the GET form carries the other params
 * as hidden inputs and the Apply button submits.
 */
export function SearchSortControl({ params }: { params: SearchParams }) {
  const id = useId();
  const router = useRouter();
  const options = searchSortOptions(params.q);

  function onChange(next: string) {
    const sort = options.find((option) => option.value === next)?.value;
    if (sort) router.replace(buildSearchHref(params, { sort }), { scroll: false });
  }

  return (
    <form method="get" action="/search" className="flex items-center gap-3">
      {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
      {params.minRupees !== null ? <input type="hidden" name="min" value={params.minRupees} /> : null}
      {params.maxRupees !== null ? <input type="hidden" name="max" value={params.maxRupees} /> : null}
      <label htmlFor={id} className="shrink-0 text-body text-neutral-500">
        Sort by
      </label>
      <div className="w-52">
        <Select
          // Remount when the URL changes (e.g. Back) so the select follows it.
          key={params.sort}
          id={id}
          name="sort"
          defaultValue={params.sort}
          options={options}
          onValueChange={onChange}
        />
      </div>
      <button
        type="submit"
        className={buttonClasses({ variant: "secondary", size: "md", className: "scripting:hidden" })}
      >
        Apply
      </button>
    </form>
  );
}
