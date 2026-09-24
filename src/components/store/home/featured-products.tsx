"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { FEATURED_TABS, filterByTab } from "@/features/catalog/featured-tabs";
import type { HomeProduct } from "@/features/catalog/types";
import { HandbagIcon, HeartIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";
import { buttonClasses } from "@/components/ui/button";
import { ProductCard } from "@/components/ui/product-card";
import { cn } from "@/lib/utils/cn";

export type FeaturedProductsProps = {
  products: HomeProduct[];
  /** Section heading rendered beside the tabs (server-rendered SectionHeading). */
  heading: ReactNode;
};

export function FeaturedProducts({ products, heading }: FeaturedProductsProps) {
  const baseId = useId();
  const [activeKey, setActiveKey] = useState(FEATURED_TABS[0].key);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const previousKey = useRef<string | null>(null);

  const activeIndex = FEATURED_TABS.findIndex((tab) => tab.key === activeKey);
  const activeTab = FEATURED_TABS[activeIndex];
  const visible = filterByTab(products, activeTab);

  // Stagger the cards in when the tab changes. The first render is revealed
  // by the page-level scroll animation instead.
  useGSAP(
    () => {
      const changed = previousKey.current !== null && previousKey.current !== activeKey;
      previousKey.current = activeKey;
      if (!changed || prefersReducedMotion()) return;
      gsap.fromTo(
        "[data-animate]",
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.06 },
      );
    },
    { dependencies: [activeKey], scope: gridRef },
  );

  function focusTab(index: number) {
    const count = FEATURED_TABS.length;
    const next = (index + count) % count;
    setActiveKey(FEATURED_TABS[next].key);
    tabRefs.current[next]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, () => void> = {
      ArrowRight: () => focusTab(activeIndex + 1),
      ArrowLeft: () => focusTab(activeIndex - 1),
      Home: () => focusTab(0),
      End: () => focusTab(FEATURED_TABS.length - 1),
    };
    const handler = keys[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }

  const panelId = `${baseId}-panel`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {heading}
        <div
          role="tablist"
          aria-label="Filter featured products"
          className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1"
        >
          {FEATURED_TABS.map((tab, index) => {
            const selected = tab.key === activeKey;
            return (
              <button
                key={tab.key}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`${baseId}-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveKey(tab.key)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "h-10 shrink-0 rounded-sm px-4 text-body font-medium transition-colors",
                  selected
                    ? "bg-primary-500 text-white"
                    : "text-neutral-700 hover:bg-primary-100 hover:text-neutral-900",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={gridRef}
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeKey}`}
        tabIndex={0}
        className="rounded-lg focus-visible:outline-offset-4"
      >
        {visible.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-8">
            <p className="text-body-lg text-neutral-700">
              No featured {activeTab.key === "all" ? "products" : activeTab.label.toLowerCase()} right
              now.
            </p>
            <Link href={activeTab.href} className={buttonClasses({ variant: "text", size: "md" })}>
              Browse {activeTab.key === "all" ? "the shop" : activeTab.label}
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {visible.map((product) => (
              <li key={product.slug} data-animate="reveal" className="flex">
                <ProductCard
                  title={product.title}
                  href={`/products/${product.slug}`}
                  pricePaisa={product.pricePaisa}
                  image={product.image}
                  className="w-full"
                  wishlistAction={
                    // Wishlist persistence ships with accounts; the control is
                    // present but inert and says so.
                    <button
                      type="button"
                      aria-disabled="true"
                      aria-label={`Save ${product.title} to wishlist (coming soon)`}
                      title="Wishlist coming soon"
                      className="flex size-9 cursor-not-allowed items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm"
                    >
                      <HeartIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
                    </button>
                  }
                  cartAction={
                    <Link
                      href={`/products/${product.slug}`}
                      aria-label={`Choose options for ${product.title}`}
                      className={iconButtonClasses({ variant: "primary", size: "sm" })}
                    >
                      <HandbagIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
