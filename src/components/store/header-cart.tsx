"use client";

import { useEffect } from "react";
import { CartButton } from "@/components/ui/cart-button";
import { countItems, rehydrateCart, useCartStore } from "@/features/cart/store";

/** Header cart link with the live item count from the persisted cart. */
export function HeaderCart() {
  const count = useCartStore((state) => countItems(state.lines));

  useEffect(() => {
    rehydrateCart();
  }, []);

  return <CartButton href="/cart" count={count} />;
}
