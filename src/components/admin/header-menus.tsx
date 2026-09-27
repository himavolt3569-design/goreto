"use client";

import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import {
  CaretDownIcon,
  CubeIcon,
  FileTextIcon,
  PackageIcon,
  PlusIcon,
  SignOutIcon,
  StarIcon,
  StorefrontIcon,
  UserIcon,
  WhatsappLogoIcon,
} from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { Menu, MenuButton, MenuLink, MenuSeparator } from "./menu";

/*
 * Header menus: quick actions and the profile menu (the notification bell is
 * notifications-menu.tsx). Items arrive filtered by permission.
 */

export type QuickAction = { label: string; href: string; icon: "add" | "whatsapp" | "orders" | "inventory" | "reviews" | "store" };

const QUICK_ACTION_ICONS = {
  add: CubeIcon,
  whatsapp: WhatsappLogoIcon,
  orders: FileTextIcon,
  inventory: PackageIcon,
  reviews: StarIcon,
  store: StorefrontIcon,
} as const;

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
