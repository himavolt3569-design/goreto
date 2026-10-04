import { create } from "zustand";

/*
 * Saved-product state for the storefront hearts (AGENTS §8). Storefront pages
 * are cached for everyone, so the signed-in shopper's saved slugs load in the
 * browser once per Clerk user and live only in memory. The database stays the
 * source of truth: every change goes through a Server Action, and a failed
 * change is rolled back here.
 */

export type WishlistStatus = "idle" | "loading" | "ready" | "error";

export type WishlistChange = { ok: true } | { ok: false; message: string };

export type WishlistApi = {
  load: () => Promise<string[]>;
  save: (slug: string) => Promise<WishlistChange>;
  remove: (slug: string) => Promise<WishlistChange>;
};

type WishlistState = {
  /** Clerk user id the slugs belong to; null when signed out. */
  userId: string | null;
  status: WishlistStatus;
  slugs: ReadonlySet<string>;
  /** Slug a signed-out shopper tried to save; saved once they sign in. */
  pendingSlug: string | null;
};

export const INITIAL_WISHLIST: WishlistState = { userId: null, status: "idle", slugs: new Set(), pendingSlug: null };

export const useWishlistStore = create<WishlistState>()(() => INITIAL_WISHLIST);

function withSlug(slugs: ReadonlySet<string>, slug: string, saved: boolean): ReadonlySet<string> {
  const next = new Set(slugs);
  if (saved) next.add(slug);
  else next.delete(slug);
  return next;
}

/** Remember a save to finish after sign-in (the sign-in modal keeps the page). */
export function rememberPendingSave(slug: string): void {
  useWishlistStore.setState({ pendingSlug: slug });
}

/**
 * Follows the Clerk session: a new user id loads that user's slugs (then
 * finishes any pending save); signing out clears them. Calling it again for
 * the same user does nothing, so every heart can call it.
 */
export async function syncWishlistUser(userId: string | null, api: WishlistApi): Promise<void> {
  const current = useWishlistStore.getState();
  if (current.userId === userId && (current.status === "loading" || current.status === "ready")) return;

  if (!userId) {
    if (current.userId === null && current.status === "idle") return;
    useWishlistStore.setState({ userId: null, status: "idle", slugs: new Set(), pendingSlug: null });
    return;
  }

  useWishlistStore.setState({ userId, status: "loading", slugs: new Set() });
  let slugs: string[];
  try {
    slugs = await api.load();
  } catch {
    if (useWishlistStore.getState().userId === userId) useWishlistStore.setState({ status: "error" });
    return;
  }
  // Ignore a response for a user who has since signed out or switched.
  if (useWishlistStore.getState().userId !== userId) return;
  useWishlistStore.setState({ status: "ready", slugs: new Set(slugs) });

  const pending = useWishlistStore.getState().pendingSlug;
  if (pending) {
    useWishlistStore.setState({ pendingSlug: null });
    if (!slugs.includes(pending)) await setSaved(pending, true, api);
  }
}

/** Optimistically saves or removes, rolling back when the server refuses. */
export async function setSaved(slug: string, saved: boolean, api: WishlistApi): Promise<WishlistChange> {
  const before = useWishlistStore.getState().slugs.has(slug);
  if (before === saved) return { ok: true };

  useWishlistStore.setState((state) => ({ slugs: withSlug(state.slugs, slug, saved) }));
  let result: WishlistChange;
  try {
    result = await (saved ? api.save(slug) : api.remove(slug));
  } catch {
    result = { ok: false, message: "We couldn't update your wishlist. Please try again." };
  }
  if (!result.ok) useWishlistStore.setState((state) => ({ slugs: withSlug(state.slugs, slug, before) }));
  return result;
}

/** Keeps the hearts in step after a removal made elsewhere (the wishlist page). */
export function forgetSaved(slug: string): void {
  useWishlistStore.setState((state) => (state.slugs.has(slug) ? { slugs: withSlug(state.slugs, slug, false) } : state));
}
