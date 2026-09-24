import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MediaImage } from "@/components/ui/media-frame";

/*
 * Shopper cart, persisted in this browser only (AGENTS §8).
 *
 * Lines carry a display snapshot taken when the item was added. Prices and
 * quantities here are a PREVIEW: checkout re-reads prices, stock, discounts and
 * delivery fees on the server and never trusts these values.
 */

export type CartLine = {
  variantId: string;
  productSlug: string;
  title: string;
  /** e.g. "Grey / M"; `null` for products without options. */
  variantLabel: string | null;
  sku: string;
  image: MediaImage | null;
  unitPricePaisa: number;
  quantity: number;
  /** Stepper limit captured at add time (stock and per-line cap). */
  maxQuantity: number;
};

export type NewCartLine = Omit<CartLine, "quantity">;

/**
 * Adds `quantity` of a variant, merging with an existing line and clamping to
 * the line's limit. Returns the new lines and how many units were added.
 */
export function addLine(
  lines: CartLine[],
  line: NewCartLine,
  quantity: number,
): { lines: CartLine[]; added: number } {
  const wanted = Math.max(0, Math.trunc(quantity));
  const existing = lines.find((candidate) => candidate.variantId === line.variantId);
  const current = existing?.quantity ?? 0;
  const next = Math.min(current + wanted, line.maxQuantity);
  const added = Math.max(0, next - current);

  if (added === 0) return { lines, added };

  const updated: CartLine = { ...line, quantity: next };
  return {
    lines: existing
      ? lines.map((candidate) => (candidate.variantId === line.variantId ? updated : candidate))
      : [...lines, updated],
    added,
  };
}

export function countItems(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

type CartState = {
  lines: CartLine[];
  /** Returns how many units were actually added (0 when already at the limit). */
  addItem: (line: NewCartLine, quantity: number) => number;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addItem: (line, quantity) => {
        const result = addLine(get().lines, line, quantity);
        if (result.added > 0) set({ lines: result.lines });
        return result.added;
      },
      removeItem: (variantId) =>
        set({ lines: get().lines.filter((line) => line.variantId !== variantId) }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "goreto-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
      // Rehydrated on mount by <HeaderCart />, so the server render and the
      // first client render agree (empty cart) and no hydration error occurs.
      skipHydration: true,
    },
  ),
);

/** Loads the persisted cart once per page load. Safe to call repeatedly. */
export function rehydrateCart(): void {
  if (!useCartStore.persist.hasHydrated()) {
    void useCartStore.persist.rehydrate();
  }
}
