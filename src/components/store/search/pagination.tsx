import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { CaretLeftIcon, CaretRightIcon } from "@/components/ui/icons";
import { buildSearchHref, type SearchParams } from "@/features/search/params";

/** Previous / Next links with "Page x of y". Renders nothing when one page holds everything. */
export function SearchPagination({ params, pageCount }: { params: SearchParams; pageCount: number }) {
  if (pageCount <= 1 || params.page > pageCount) return null;
  const previous = params.page > 1 ? buildSearchHref(params, { page: params.page - 1 }) : null;
  const next = params.page < pageCount ? buildSearchHref(params, { page: params.page + 1 }) : null;
  const classes = buttonClasses({ variant: "tertiary", size: "md" });
  const caretLeft = <CaretLeftIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />;
  const caretRight = <CaretRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      {previous ? (
        <Link href={previous} rel="prev" className={classes}>
          {caretLeft}
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={classes}>
          {caretLeft}
          Previous
        </span>
      )}
      <p className="text-body text-neutral-500">
        Page {params.page} of {pageCount}
      </p>
      {next ? (
        <Link href={next} rel="next" className={classes}>
          Next
          {caretRight}
        </Link>
      ) : (
        <span aria-disabled="true" className={classes}>
          Next
          {caretRight}
        </span>
      )}
    </nav>
  );
}
