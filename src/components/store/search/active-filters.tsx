import Link from "next/link";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { XIcon } from "@/components/ui/icons";
import { buildSearchHref, rupeesToPaisa, type SearchParams } from "@/features/search/params";
import { formatNpr } from "@/lib/money/format";

export type FilterChip = { label: string; href: string };

export function activeFilterChips(params: SearchParams, categoryTitle: string | undefined): FilterChip[] {
  const chips: FilterChip[] = [];
  if (params.category) {
    chips.push({ label: categoryTitle ?? params.category, href: buildSearchHref(params, { category: null }) });
  }
  if (params.minRupees !== null) {
    chips.push({
      label: `From ${formatNpr(rupeesToPaisa(params.minRupees)!)}`,
      href: buildSearchHref(params, { minRupees: null }),
    });
  }
  if (params.maxRupees !== null) {
    chips.push({
      label: `Up to ${formatNpr(rupeesToPaisa(params.maxRupees)!)}`,
      href: buildSearchHref(params, { maxRupees: null }),
    });
  }
  return chips;
}

/** Removable pills for the filters in effect; each links to the results without it. */
export function ActiveFilters({ chips }: { chips: readonly FilterChip[] }) {
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Active filters" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.href}>
          <Link
            href={chip.href}
            scroll={false}
            aria-label={`Remove filter: ${chip.label}`}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-primary-200 bg-primary-100 px-3 text-small font-medium text-neutral-900 transition-colors hover:border-primary-400"
          >
            {chip.label}
            <XIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
