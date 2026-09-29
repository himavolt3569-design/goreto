"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { ClockCounterClockwiseIcon, FileTextIcon, HouseIcon, ReceiptIcon, type Icon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ACCOUNT_NAV, isAccountNavActive, type AccountNavIcon } from "@/features/account/nav";
import { cn } from "@/lib/utils/cn";

const NAV_ICONS: Record<AccountNavIcon, Icon> = {
  overview: HouseIcon,
  orders: FileTextIcon,
  tracking: ClockCounterClockwiseIcon,
  billing: ReceiptIcon,
};

/**
 * Grouped account navigation. From `lg` it's a sidebar like the admin one;
 * below that, one horizontally scrollable row so the page never scrolls
 * sideways. The current section is exposed with aria-current.
 */
export function AccountNav() {
  const pathname = usePathname();
  const baseId = useId();
  const items = ACCOUNT_NAV.flatMap((group) => group.items);

  return (
    <nav aria-label="Account" className="min-w-0">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {items.map((item) => {
          const active = isAccountNavActive(pathname, item.href);
          const ItemIcon = NAV_ICONS[item.icon];
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-body font-medium transition-colors",
                  active
                    ? "border-primary-200 bg-primary-100 text-primary-600"
                    : "border-neutral-200 bg-white text-neutral-700 hover:text-neutral-900",
                )}
              >
                <ItemIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden flex-col gap-6 lg:flex">
        {ACCOUNT_NAV.map((group) => {
          const labelId = `${baseId}-${group.label.toLowerCase()}`;
          return (
            <div key={group.label} className="flex flex-col gap-1">
              <p id={labelId} className="px-3 text-small font-medium uppercase tracking-wide text-neutral-500">
                {group.label}
              </p>
              <ul aria-labelledby={labelId} className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = isAccountNavActive(pathname, item.href);
                  const ItemIcon = NAV_ICONS[item.icon];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-11 items-center gap-3 rounded-md px-3 text-body transition-colors",
                          active
                            ? "bg-primary-100 font-medium text-primary-600"
                            : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
                        )}
                      >
                        <ItemIcon
                          aria-hidden="true"
                          size={ICON_SIZE_SM}
                          weight={ICON_WEIGHT_OUTLINE}
                          className={active ? "text-primary-500" : "text-neutral-700"}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
