import Link from "next/link";
import { CaretRightIcon } from "@/components/ui/icons";
import { ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";

export type BreadcrumbItem = { label: string; href?: string };

/** Trail of links; the last item is the current page. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-small text-neutral-500">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !current ? (
                <Link
                  href={item.href}
                  className="rounded-xs transition-colors hover:text-primary-500"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={current ? "page" : undefined}
                  className={current ? "font-medium text-neutral-900" : undefined}
                >
                  {item.label}
                </span>
              )}
              {current ? null : (
                <CaretRightIcon aria-hidden="true" size={12} weight={ICON_WEIGHT_OUTLINE} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
