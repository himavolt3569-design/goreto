"use client";

import { useEffect, useSyncExternalStore } from "react";
import { rehydrateCart, useCartStore, type CartLine } from "./store";

function subscribeToHydration(onChange: () => void): () => void {
  return useCartStore.persist.onFinishHydration(onChange);
}

/**
 * The saved cart plus whether it has loaded yet, so pages can tell "empty"
 * from "not loaded" (the server render and first client render are empty).
 */
export function useHydratedCart(): { lines: CartLine[]; hydrated: boolean } {
  const lines = useCartStore((state) => state.lines);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );

  // The header already keeps the cart in sync across tabs.
  useEffect(() => {
    rehydrateCart();
  }, []);

  return { lines, hydrated };
}
