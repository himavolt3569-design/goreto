"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  CATEGORY_SORTS,
  DEFAULT_CATEGORY_SORT,
  parseCategorySort,
  type CategorySort,
} from "@/features/catalog/category-sort";

/**
 * "Sort by" select for a category page. With JavaScript, changing it updates
 * `?sort=` in place (the default order is left out of the URL). Without it,
 * the GET form and its Apply button do the same job.
 */
export function CategorySortControl({ value }: { value: CategorySort }) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();

  function onChange(next: CategorySort) {
    const query = next === DEFAULT_CATEGORY_SORT ? "" : `?sort=${next}`;
    router.replace(`${pathname}${query}`, { scroll: false });
  }

  return (
    <form method="get" className="flex items-center gap-3">
      <label htmlFor={id} className="shrink-0 text-body text-neutral-500">
        Sort by
      </label>
      <div className="w-52">
        <Select
          // Remount when the URL changes (e.g. Back) so the select follows it.
          key={value}
          id={id}
          name="sort"
          defaultValue={value}
          options={CATEGORY_SORTS}
          onValueChange={(next) => onChange(parseCategorySort(next))}
        />
      </div>
      <button
        type="submit"
        className={buttonClasses({ variant: "secondary", size: "md", className: "[.js_&]:hidden" })}
      >
        Apply
      </button>
    </form>
  );
}
