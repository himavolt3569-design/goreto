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

const CART_STORAGE_KEY = "goreto-cart";

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

/** Sets a line's quantity, clamped to 1…maxQuantity. Unknown lines are ignored. */
export function setLineQuantity(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  return lines.map((line) =>
    line.variantId === variantId
      ? { ...line, quantity: Math.max(1, Math.min(Math.trunc(quantity), line.maxQuantity)) }
      : line,
  );
}

/** What the server says about a line right now (from checkout_quote). */
export type LineAvailability = {
  variantId: string;
  unitPricePaisa: number | null;
  /** 0 = can't be bought any more. Already includes the per-line cap. */
  availableQuantity: number;
};

export type CartNotice = {
  variantId: string;
  kind: "removed" | "reduced" | "price_changed";
  text: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Lines the server can price (older carts may hold ids from before the database). */
export function orderableLines(lines: CartLine[]): CartLine[] {
  return lines.filter((line) => UUID.test(line.variantId));
}

function lineName(line: CartLine): string {
  return line.variantLabel ? `${line.title} (${line.variantLabel})` : line.title;
}

/**
 * Applies current prices and stock to the saved cart: drops lines that can't
 * be bought, lowers quantities to what's available, and updates prices.
 * Returns the new lines and a notice per change so the shopper sees why.
 */
export function reconcileLines(
  lines: CartLine[],
  availability: LineAvailability[],
): { lines: CartLine[]; notices: CartNotice[] } {
  const byId = new Map(availability.map((entry) => [entry.variantId, entry]));
  const notices: CartNotice[] = [];
  const next: CartLine[] = [];

  for (const line of lines) {
    const current = byId.get(line.variantId);
    if (!current || current.availableQuantity === 0 || current.unitPricePaisa === null) {
      notices.push({ variantId: line.variantId, kind: "removed", text: `${lineName(line)} is no longer available and was removed.` });
      continue;
    }
    let updated = line;
    if (current.availableQuantity !== line.maxQuantity) {
      updated = { ...updated, maxQuantity: current.availableQuantity };
    }
    if (line.quantity > current.availableQuantity) {
      updated = { ...updated, quantity: current.availableQuantity };
      notices.push({
        variantId: line.variantId,
        kind: "reduced",
        text: `Only ${current.availableQuantity} of ${lineName(line)} ${current.availableQuantity === 1 ? "is" : "are"} available, so we lowered the quantity.`,
      });
    }
    if (current.unitPricePaisa !== line.unitPricePaisa) {
      updated = { ...updated, unitPricePaisa: current.unitPricePaisa };
      notices.push({ variantId: line.variantId, kind: "price_changed", text: `The price of ${lineName(line)} changed.` });
    }
    next.push(updated);
  }

  const changed = next.length !== lines.length || next.some((line, index) => line !== lines[index]);
  return { lines: changed ? next : lines, notices };
}

type CartState = {
  lines: CartLine[];
  /** Returns how many units were actually added (0 when already at the limit). */
  addItem: (line: NewCartLine, quantity: number) => number;
  removeItem: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  /** Applies server availability; returns what changed. */
  reconcile: (availability: LineAvailability[]) => CartNotice[];
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
      setQuantity: (variantId, quantity) => set({ lines: setLineQuantity(get().lines, variantId, quantity) }),
      reconcile: (availability) => {
        const result = reconcileLines(get().lines, availability);
        if (result.lines !== get().lines) set({ lines: result.lines });
        return result.notices;
      },
      clear: () => set({ lines: [] }),
    }),
    {
      name: CART_STORAGE_KEY,
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

/**
 * Keeps this tab's cart in step with other tabs: when another tab saves the
 * cart, reload it from storage. Returns a function that stops listening.
 */
export function syncCartAcrossTabs(): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === CART_STORAGE_KEY) void useCartStore.persist.rehydrate();
  }
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
