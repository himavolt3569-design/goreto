"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import {
  ArticleIcon,
  ChartBarIcon,
  CoatHangerIcon,
  CopyIcon,
  CreditCardIcon,
  CubeIcon,
  FileTextIcon,
  GearSixIcon,
  HouseIcon,
  ImageIcon,
  LockSimpleIcon,
  PackageIcon,
  QuestionIcon,
  SealPercentIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
  UserIcon,
  type Icon,
} from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { ADMIN_NAV, isNavItemActive, type AdminNavIcon } from "@/features/admin/nav";
import { cn } from "@/lib/utils/cn";

export const NAV_ICONS: Record<AdminNavIcon, Icon> = {
  dashboard: HouseIcon,
  analytics: ChartBarIcon,
  products: CubeIcon,
  categories: CopyIcon,
  inventory: PackageIcon,
  media: ImageIcon,
  orders: FileTextIcon,
  payments: CreditCardIcon,
  coupons: SealPercentIcon,
  customers: UserIcon,
  reviews: StarIcon,
  ar: CoatHangerIcon,
  promotions: TagIcon,
  content: ArticleIcon,
  staff: LockSimpleIcon,
  delivery: TruckIcon,
  settings: GearSixIcon,
  support: QuestionIcon,
};

export type SidebarNavProps = {
  /** Hrefs this user may open (computed on the server from their permissions). */
  allowedHrefs: readonly string[];
  onNavigate?: () => void;
};

/** Topic-grouped admin navigation; the current section is highlighted and exposed via aria-current. */
export function SidebarNav({ allowedHrefs, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const baseId = useId();
  const [intent, setIntent] = useState<ReadonlySet<string>>(() => new Set());
  const allowed = new Set(allowedHrefs);
  const groups = ADMIN_NAV.map((group) => ({ ...group, items: group.items.filter((item) => allowed.has(item.href)) })).filter(
    (group) => group.items.length > 0,
  );

  function showIntent(href: string) {
    setIntent((current) => (current.has(href) ? current : new Set(current).add(href)));
  }

  return (
    <nav aria-label="Admin" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p id={`${baseId}-${group.label.toLowerCase()}`} className="px-3 text-small font-medium uppercase tracking-wide text-neutral-500">
            {group.label}
          </p>
          <ul aria-labelledby={`${baseId}-${group.label.toLowerCase()}`} className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const ItemIcon = NAV_ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // Admin pages are dynamic, so Next skips them by default. Once the pointer or
                    // focus reaches a link, prefetch the whole page with its data so the click is instant.
                    prefetch={intent.has(item.href)}
                    onMouseEnter={() => showIntent(item.href)}
                    onFocus={() => showIntent(item.href)}
                    onTouchStart={() => showIntent(item.href)}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-body transition-colors",
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
      ))}
    </nav>
  );
}
