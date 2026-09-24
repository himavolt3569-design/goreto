"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import type { HomeCollection } from "@/features/catalog/types";
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const arrowClasses =
  "flex size-10 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md transition-colors hover:bg-primary-100";

/** Manually controlled collection banner (no autoplay, so no motion to pause). */
export function CollectionCarousel({ collections }: { collections: HomeCollection[] }) {
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const previous = useRef<number | null>(null);
  const count = collections.length;

  useGSAP(
    () => {
      const from = previous.current;
      previous.current = active;
      if (from === null || from === active || prefersReducedMotion()) return;

      const slides = gsap.utils.toArray<HTMLElement>("[data-slide]");
      const outgoing = slides[from];
      const incoming = slides[active];
      gsap.fromTo(outgoing, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4, ease: "power1.out" });
      gsap.fromTo(incoming, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power1.out" });
      gsap.fromTo(
        incoming.querySelector("[data-slide-image]"),
        { scale: 1.06 },
        { scale: 1, duration: 0.9, ease: "power2.out" },
      );
      gsap.fromTo(
        incoming.querySelectorAll("[data-slide-copy] > *"),
        { autoAlpha: 0, x: -24 },
        { autoAlpha: 1, x: 0, duration: 0.5, ease: "power2.out", stagger: 0.07, delay: 0.1 },
      );
    },
    { dependencies: [active], scope: rootRef },
  );

  if (count === 0) return null;

  const go = (index: number) => setActive((index + count) % count);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className="relative overflow-hidden rounded-xl bg-primary-100"
    >
      <div aria-live="polite" className="grid">
        {collections.map((collection, index) => {
          const isActive = index === active;
          return (
            <div
              key={collection.slug}
              data-slide
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}: ${collection.title}`}
              aria-hidden={!isActive}
              inert={!isActive}
              className={cn(
                "relative isolate col-start-1 row-start-1 flex min-h-[420px] flex-col md:min-h-[320px] md:flex-row",
                !isActive && "invisible",
              )}
            >
              <div className="relative h-48 overflow-hidden md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-3/5">
                <div data-slide-image className="absolute inset-0">
                  <Image
                    src={collection.image.src}
                    alt={collection.image.alt}
                    fill
                    sizes="(min-width: 768px) 60vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 hidden w-1/3 bg-linear-to-r from-primary-100 to-transparent md:block"
                />
              </div>

              <div
                data-slide-copy
                className="relative flex flex-col items-start gap-4 p-6 pb-16 md:max-w-md md:justify-center md:p-12 md:pb-12 lg:pl-16"
              >
                <p className="text-small font-semibold uppercase tracking-widest text-primary-500">
                  {collection.eyebrow}
                </p>
                <h3 className="font-display text-h1 md:text-display-2">{collection.title}</h3>
                <p className="text-body-lg text-neutral-700">{collection.description}</p>
                <Link
                  href={`/collections/${collection.slug}`}
                  className={buttonClasses({ variant: "primary", className: "mt-2" })}
                >
                  Explore the Collection
                  <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <div className="absolute right-4 top-4 flex gap-2 md:right-6 md:top-1/2 md:-translate-y-1/2 md:flex-col">
            <button
              type="button"
              aria-label="Previous collection"
              onClick={() => go(active - 1)}
              className={arrowClasses}
            >
              <CaretLeftIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            </button>
            <button
              type="button"
              aria-label="Next collection"
              onClick={() => go(active + 1)}
              className={arrowClasses}
            >
              <CaretRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            </button>
          </div>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/90 px-2 shadow-sm">
            {collections.map((collection, index) => (
              <button
                key={collection.slug}
                type="button"
                aria-label={`Show collection ${index + 1}: ${collection.title}`}
                aria-current={index === active ? "true" : undefined}
                onClick={() => go(index)}
                className="group flex size-6 items-center justify-center rounded-full"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    index === active
                      ? "bg-primary-500"
                      : "bg-neutral-300 group-hover:bg-primary-300",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
