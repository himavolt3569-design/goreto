"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { iconButtonClasses } from "@/components/ui/icon-button";

export type ProductRailProps = {
  title: string;
  titleId: string;
  /** `<li>` items, usually server-rendered product cards. */
  children: ReactNode;
};

const navButton = iconButtonClasses({
  variant: "outline",
  className: "rounded-full shadow-sm disabled:opacity-40",
});

/**
 * Horizontal product row with previous/next buttons that scroll one page.
 * Two cards per page on phones, three on tablets, five on desktop.
 */
export function ProductRail({ title, titleId, children }: ProductRailProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setCanPrev(list.scrollLeft > 1);
    setCanNext(list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    update();
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      list.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function scrollPage(direction: 1 | -1) {
    const list = listRef.current;
    if (!list) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollBy({ left: direction * list.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className="font-display text-h1 text-neutral-900 md:text-display-2">
          {title}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous products"
            disabled={!canPrev}
            onClick={() => scrollPage(-1)}
            className={navButton}
          >
            <CaretLeftIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          </button>
          <button
            type="button"
            aria-label="Next products"
            disabled={!canNext}
            onClick={() => scrollPage(1)}
            className={navButton}
          >
            <CaretRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          </button>
        </div>
      </div>

      {/* Column widths split the row into 2 / 3 / 5 cards after the 16px gaps. */}
      <ul
        ref={listRef}
        className="-m-1 grid snap-x snap-mandatory auto-cols-[calc((100%-1rem)/2)] grid-flow-col gap-4 overflow-x-auto p-1 [scrollbar-width:none] sm:auto-cols-[calc((100%-2rem)/3)] lg:auto-cols-[calc((100%-4rem)/5)] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </div>
  );
}
