"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { SiteLink } from "@/config/site";
import { ListIcon, XIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";

export type MobileNavProps = {
  links: SiteLink[];
  /** Extra panel content above the links (the search form). */
  children?: ReactNode;
};

/** Disclosure menu for the storefront nav below the `lg` breakpoint. */
export function MobileNav({ links, children }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className={iconButtonClasses({ variant: "ghost" })}
      >
        {open ? (
          <XIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        ) : (
          <ListIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        )}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-neutral-200 bg-white shadow-md"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-8">
          <div className="md:hidden">{children}</div>
          <nav aria-label="Main">
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex h-11 items-center rounded-sm px-2 text-body-lg font-medium text-neutral-900 hover:bg-neutral-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="sm:hidden">
                <Link
                  href="/account/wishlist"
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center rounded-sm px-2 text-body-lg font-medium text-neutral-900 hover:bg-neutral-100"
                >
                  Wishlist
                </Link>
              </li>
              <li className="sm:hidden">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center rounded-sm px-2 text-body-lg font-medium text-neutral-900 hover:bg-neutral-100"
                >
                  Account
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
