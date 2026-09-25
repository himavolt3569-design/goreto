"use client";

import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import {
  BellIcon,
  CaretDownIcon,
  CubeIcon,
  PackageIcon,
  PlusIcon,
  SignOutIcon,
  StarIcon,
  StorefrontIcon,
  UserIcon,
  FileTextIcon,
  WarningCircleIcon,
} from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";
import { Menu, MenuButton, MenuLink, MenuSeparator } from "./menu";

/* Header menus: notifications, quick actions and the profile menu. Items arrive filtered by permission. */

export type AttentionItem = {
  key: "orders" | "reviews" | "low_stock" | "sold_out";
  label: string;
  count: number;
  href: string;
};

const ATTENTION_ICONS = {
  orders: FileTextIcon,
  reviews: StarIcon,
  low_stock: PackageIcon,
  sold_out: WarningCircleIcon,
} as const;

/** `items` is null when the counts couldn't be loaded; the menu says so instead of showing zeros. */
export function NotificationsMenu({ items }: { items: AttentionItem[] | null }) {
  const total = items?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const label =
    items === null
      ? "Notifications: couldn't load"
      : total > 0
        ? `Notifications: ${total} items need attention`
        : "Notifications: nothing needs attention";

  return (
    <Menu
      triggerLabel={label}
      triggerClassName={cn(iconButtonClasses({ variant: "ghost" }), "relative")}
      panelClassName="w-80"
      trigger={
        <>
          <BellIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
          {total > 0 ? (
            <span aria-hidden="true" className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-white bg-primary-500" />
          ) : null}
        </>
      }
      header={
        <div className="px-3 pb-2 pt-1">
          <p className="text-body font-semibold text-neutral-900">Needs attention</p>
          {items === null ? (
            <p className="text-small text-error-700">Couldn&apos;t load notifications. Refresh to try again.</p>
          ) : total === 0 ? (
            <p className="text-small text-neutral-500">You&apos;re all caught up.</p>
          ) : null}
        </div>
      }
    >
      {(items ?? []).map((item) => {
        const ItemIcon = ATTENTION_ICONS[item.key];
        return (
          <MenuLink key={item.key} href={item.href}>
            <ItemIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
            <span className="flex-1">{item.label}</span>
            <span
              className={cn(
                "min-w-8 rounded-full px-2 text-center text-small font-semibold",
                item.count > 0 ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-500",
              )}
            >
              {item.count}
            </span>
          </MenuLink>
        );
      })}
    </Menu>
  );
}

export type QuickAction = { label: string; href: string; icon: "add" | "orders" | "inventory" | "reviews" | "store" };

const QUICK_ACTION_ICONS = { add: CubeIcon, orders: FileTextIcon, inventory: PackageIcon, reviews: StarIcon, store: StorefrontIcon } as const;

export function QuickActionsMenu({ actions }: { actions: QuickAction[] }) {
  return (
    <Menu
      triggerLabel="Quick actions"
      triggerClassName={buttonClasses({ variant: "secondary", size: "md", className: "hidden md:inline-flex" })}
      trigger={
        <>
          <PlusIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          <span>Quick Actions</span>
          <CaretDownIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} />
        </>
      }
    >
      {actions.map((action) => {
        const ActionIcon = QUICK_ACTION_ICONS[action.icon];
        return (
          <MenuLink key={action.href} href={action.href}>
            <ActionIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
            {action.label}
          </MenuLink>
        );
      })}
    </Menu>
  );
}

export type ProfileSummary = { name: string; roleLabel: string; imageUrl: string | null; initials: string };

export function ProfileMenu({ profile }: { profile: ProfileSummary }) {
  return (
    <Menu
      triggerLabel={`Account menu for ${profile.name}`}
      triggerClassName="flex h-11 items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-neutral-100"
      trigger={
        <>
          <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-body font-semibold text-primary-700">
            {profile.imageUrl ? (
              <Image src={profile.imageUrl} alt="" fill sizes="40px" className="object-cover" />
            ) : (
              <span aria-hidden="true">{profile.initials}</span>
            )}
          </span>
          <span className="hidden flex-col xl:flex">
            <span className="text-body font-semibold text-neutral-900">{profile.name}</span>
            <span className="text-small text-neutral-500">{profile.roleLabel}</span>
          </span>
          <CaretDownIcon aria-hidden="true" size={16} weight={ICON_WEIGHT_OUTLINE} className="hidden text-neutral-700 xl:block" />
        </>
      }
      header={
        <div className="px-3 pb-2 pt-1 xl:hidden">
          <p className="text-body font-semibold text-neutral-900">{profile.name}</p>
          <p className="text-small text-neutral-500">{profile.roleLabel}</p>
        </div>
      }
    >
      <MenuLink href="/account">
        <UserIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
        Your account
      </MenuLink>
      <MenuLink href="/">
        <StorefrontIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
        View storefront
      </MenuLink>
      <MenuSeparator />
      <SignOutButton redirectUrl="/">
        <MenuButton keepOpen>
          <SignOutIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="text-neutral-500" />
          Sign out
        </MenuButton>
      </SignOutButton>
    </Menu>
  );
}
