"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { MagnifyingGlassIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { fieldControlClasses } from "@/components/ui/input";
import { SEARCH_MAX_LENGTH } from "@/features/admin/search-input";
import { cn } from "@/lib/utils/cn";

const noopSubscribe = () => () => {};

/**
 * Admin header search: a plain GET form to /admin/search (works without JS).
 * ⌘K / Ctrl K focuses it from anywhere in the admin.
 */
export function HeaderSearch({ defaultValue = "", className }: { defaultValue?: string; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Platform hint: server and first paint say "Ctrl K"; Apple devices then show "⌘K".
  const shortcut = useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K",
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form action="/admin/search" method="get" role="search" className={cn("relative flex items-center", className)}>
      <MagnifyingGlassIcon
        aria-hidden="true"
        size={ICON_SIZE_SM}
        weight={ICON_WEIGHT_OUTLINE}
        className="pointer-events-none absolute left-4 text-neutral-500"
      />
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={defaultValue}
        maxLength={SEARCH_MAX_LENGTH}
        autoComplete="off"
        enterKeyHint="search"
        aria-label="Search products, orders and customers"
        aria-keyshortcuts="Control+K Meta+K"
        placeholder="Search products, orders, customers..."
        className={cn(fieldControlClasses, "pl-12 pr-20")}
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-3 hidden rounded-xs border border-neutral-200 bg-neutral-50 px-2 py-1 font-sans text-small font-medium text-neutral-500 sm:block"
      >
        {shortcut}
      </kbd>
    </form>
  );
}
