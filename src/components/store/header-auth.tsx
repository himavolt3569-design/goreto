"use client";

import Link from "next/link";
import { ClerkLoading, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { HeartIcon, PackageIcon, UserIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

/** Clerk's user-menu icons render at 16px next to its 14px labels. */
const MENU_ICON_SIZE = 16;

const WISHLIST_HREF = "/account/wishlist";

/*
 * Every in-page auth trigger opens Clerk's modal over the current page. The
 * /sign-in and /sign-up pages remain as fallbacks for protected-route
 * redirects, direct links, and clicks made before Clerk has loaded.
 */

function AccountIcon() {
  return <UserIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />;
}

/**
 * Header auth controls. A Client Component so `<Show>` resolves on the client
 * and the storefront pages stay statically rendered.
 *
 * - Signed out, `xl` and up: "Sign in" + "Sign up" buttons.
 * - Signed out, below `xl`: an account icon that opens sign-in (the mobile
 *   menu also lists both actions).
 * - Signed in: Clerk's user button with account shortcuts.
 */
export function HeaderAuth() {
  return (
    <>
      <ClerkLoading>
        <Link
          href="/sign-in"
          aria-label="Sign in"
          className={iconButtonClasses({ variant: "ghost", className: "hidden sm:inline-flex" })}
        >
          <AccountIcon />
        </Link>
      </ClerkLoading>

      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            aria-label="Sign in"
            className={iconButtonClasses({ variant: "ghost", className: "hidden sm:inline-flex xl:hidden" })}
          >
            <AccountIcon />
          </button>
        </SignInButton>
        <div className="hidden items-center gap-2 xl:ml-2 xl:flex">
          <SignInButton mode="modal">
            <button type="button" className={buttonClasses({ variant: "tertiary", size: "md" })}>
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className={buttonClasses({ variant: "primary", size: "md" })}>
              Sign up
            </button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex size-11 items-center justify-center">
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link
                label="My account"
                href="/account"
                labelIcon={<UserIcon aria-hidden="true" size={MENU_ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />}
              />
              <UserButton.Link
                label="My orders"
                href="/account/orders"
                labelIcon={<PackageIcon aria-hidden="true" size={MENU_ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />}
              />
              <UserButton.Link
                label="Wishlist"
                href={WISHLIST_HREF}
                labelIcon={<HeartIcon aria-hidden="true" size={MENU_ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />}
              />
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </Show>
    </>
  );
}

/**
 * Wishlist heart. Signed in (or before Clerk loads) it links to the wishlist;
 * signed out it opens the sign-in modal and continues to the wishlist after.
 */
export function HeaderWishlist({ className }: { className?: string }) {
  const classes = iconButtonClasses({ variant: "ghost", className });
  const icon = <HeartIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />;
  const link = (
    <Link href={WISHLIST_HREF} aria-label="Wishlist" className={classes}>
      {icon}
    </Link>
  );

  return (
    <>
      <ClerkLoading>{link}</ClerkLoading>
      <Show when="signed-in">{link}</Show>
      <Show when="signed-out">
        <SignInButton
          mode="modal"
          forceRedirectUrl={WISHLIST_HREF}
          signUpForceRedirectUrl={WISHLIST_HREF}
        >
          <button type="button" aria-label="Wishlist (sign in required)" className={classes}>
            {icon}
          </button>
        </SignInButton>
      </Show>
    </>
  );
}

/** Account and wishlist entries for the mobile menu panel. */
export function MobileNavAuthLinks({
  linkClassName,
  onNavigate,
  onOpenModal,
}: {
  linkClassName: string;
  /** Closes the menu after following a link. */
  onNavigate: () => void;
  /** Closes the menu and parks focus on its toggle before a modal opens. */
  onOpenModal: () => void;
}) {
  const buttonClassName = cn(linkClassName, "w-full text-left");

  return (
    <>
      <ClerkLoading>
        <li>
          <Link href="/sign-in" onClick={onNavigate} className={linkClassName}>
            Sign in
          </Link>
        </li>
      </ClerkLoading>
      <Show when="signed-out">
        <li className="sm:hidden">
          <SignInButton
            mode="modal"
            forceRedirectUrl={WISHLIST_HREF}
            signUpForceRedirectUrl={WISHLIST_HREF}
          >
            <button type="button" onClick={onOpenModal} className={buttonClassName}>
              Wishlist
            </button>
          </SignInButton>
        </li>
        <li>
          <SignInButton mode="modal">
            <button type="button" onClick={onOpenModal} className={buttonClassName}>
              Sign in
            </button>
          </SignInButton>
        </li>
        <li>
          <SignUpButton mode="modal">
            <button type="button" onClick={onOpenModal} className={buttonClassName}>
              Create account
            </button>
          </SignUpButton>
        </li>
      </Show>
      <Show when="signed-in">
        <li className="sm:hidden">
          <Link href={WISHLIST_HREF} onClick={onNavigate} className={linkClassName}>
            Wishlist
          </Link>
        </li>
        <li>
          <Link href="/account" onClick={onNavigate} className={linkClassName}>
            My account
          </Link>
        </li>
        <li>
          <Link href="/account/orders" onClick={onNavigate} className={linkClassName}>
            My orders
          </Link>
        </li>
      </Show>
    </>
  );
}
