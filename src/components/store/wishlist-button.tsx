"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { HeartIcon } from "@/components/ui/icons";
import { ICON_SIZE_XS, ICON_WEIGHT_FILLED, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { removeFromWishlistAction, saveToWishlistAction } from "@/features/wishlist/actions";
import { rememberPendingSave, setSaved, syncWishlistUser, useWishlistStore, type WishlistApi } from "@/features/wishlist/store";
import { cn } from "@/lib/utils/cn";

const MESSAGE_MS = 4000;

async function loadSavedSlugs(): Promise<string[]> {
  const response = await fetch("/api/account/wishlist", { cache: "no-store" });
  if (!response.ok) throw new Error(`Wishlist load failed (${response.status})`);
  const body = (await response.json()) as { slugs?: unknown };
  return Array.isArray(body.slugs) ? body.slugs.filter((slug): slug is string => typeof slug === "string") : [];
}

const wishlistApi: WishlistApi = {
  load: loadSavedSlugs,
  save: saveToWishlistAction,
  remove: removeFromWishlistAction,
};

/**
 * Storefront heart (AGENTS §4.9). Signed in, it saves or removes the product
 * (aria-pressed, filled when saved) and rolls back if the server refuses.
 * Signed out, it opens the Clerk sign-in modal and saves the product once the
 * shopper is signed in. The page itself stays cached: saved state loads in
 * the browser.
 */
export function WishlistButton({ slug, productTitle, className }: { slug: string; productTitle: string; className?: string }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const saved = useWishlistStore((state) => state.slugs.has(slug));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (isLoaded) void syncWishlistUser(isSignedIn ? (userId ?? null) : null, wishlistApi);
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  async function toggle() {
    if (!isLoaded || busy) return;
    const next = !saved;
    setBusy(true);
    setError(null);
    const result = await setSaved(slug, next, wishlistApi);
    setBusy(false);
    if (result.ok) setAnnouncement(next ? `${productTitle} saved to your wishlist.` : `${productTitle} removed from your wishlist.`);
    else setError(result.message);
  }

  const label = `Save ${productTitle} to wishlist`;
  const classes = cn(
    "flex size-9 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:text-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
    saved ? "text-primary-500" : "text-neutral-900",
    className,
  );
  const icon = <HeartIcon aria-hidden="true" size={ICON_SIZE_XS} weight={saved ? ICON_WEIGHT_FILLED : ICON_WEIGHT_OUTLINE} />;

  return (
    <span className="relative flex">
      {isLoaded && !isSignedIn ? (
        <SignInButton mode="modal">
          <button type="button" aria-label={label} onClick={() => rememberPendingSave(slug)} className={classes}>
            {icon}
          </button>
        </SignInButton>
      ) : (
        <button
          type="button"
          aria-label={label}
          aria-pressed={saved}
          aria-disabled={!isLoaded || busy || undefined}
          onClick={() => void toggle()}
          className={classes}
        >
          {icon}
        </button>
      )}
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {error ? (
        <span
          role="alert"
          className="absolute right-0 top-full z-20 mt-2 w-max max-w-48 rounded-sm bg-neutral-900 px-2 py-1 text-small text-white shadow-md"
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}
