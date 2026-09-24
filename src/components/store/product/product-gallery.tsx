"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CornersOutIcon,
  XIcon,
} from "@/components/ui/icons";
import {
  ICON_SIZE,
  ICON_SIZE_SM,
  ICON_WEIGHT_OUTLINE,
} from "@/components/ui/icon";
import { MediaFrame } from "@/components/ui/media-frame";
import type { ProductMedia } from "@/features/catalog/types";
import { cn } from "@/lib/utils/cn";
import { WishlistSoonButton } from "../product-card-actions";

/** Thumbnails visible in the desktop rail before it scrolls. */
const VISIBLE_THUMBS = 5;

const floatingButton =
  "flex size-11 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm transition-colors hover:bg-neutral-100";

export type ProductGalleryProps = {
  /** Photos for the selected variant, in display order. */
  media: ProductMedia[];
  productTitle: string;
};

/**
 * Thumbnail rail + main image + lightbox. Remount it (via `key`) when the
 * variant's photos change so the selection resets to the first photo.
 */
export function ProductGallery({ media, productTitle }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const railRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);

  const count = media.length;
  // `null` when the variant has no photos: the frame shows its placeholder.
  const active = count > 0 ? media[Math.min(index, count - 1)] : null;

  function show(next: number) {
    setIndex((next + count) % count);
  }

  function onLightboxKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (count < 2) return;
    if (event.key === "ArrowRight") show(index + 1);
    if (event.key === "ArrowLeft") show(index - 1);
  }

  return (
    <div className="flex min-w-0 flex-col-reverse gap-4 lg:flex-row">
      {count > 1 ? (
        <div className="flex flex-col items-center gap-3">
          {/* 528px = five 96px thumbnails and their 12px gaps (reference rail height). */}
          <ul
            ref={railRef}
            aria-label="Product images"
            className="flex w-full snap-x gap-3 overflow-x-auto p-1 lg:max-h-[528px] lg:w-auto lg:snap-y lg:flex-col lg:overflow-y-auto lg:overflow-x-visible"
          >
            {media.map((item, itemIndex) => {
              const selected = item.id === active?.id;
              return (
                <li key={item.id} className="shrink-0 snap-start">
                  <button
                    type="button"
                    aria-label={`Show image ${itemIndex + 1} of ${count}`}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => setIndex(itemIndex)}
                    className={cn(
                      "relative block size-20 overflow-hidden rounded-md border-2 bg-neutral-100 transition-colors lg:size-24",
                      selected
                        ? "border-primary-500"
                        : "border-transparent hover:border-primary-200",
                    )}
                  >
                    <Image
                      src={item.image.src}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          {count > VISIBLE_THUMBS ? (
            <button
              type="button"
              aria-label="Scroll to more images"
              onClick={() =>
                railRef.current?.scrollBy({ top: 108, behavior: "smooth" })
              }
              className={cn(floatingButton, "hidden lg:flex")}
            >
              <CaretDownIcon
                aria-hidden="true"
                size={ICON_SIZE_SM}
                weight={ICON_WEIGHT_OUTLINE}
              />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative min-w-0 flex-1">
        {/* 7:8 matches the reference's portrait product frame. */}
        <MediaFrame
          image={active?.image ?? null}
          priority
          sizes="(min-width: 1280px) 600px, (min-width: 1024px) 45vw, 100vw"
          className="aspect-[7/8] w-full rounded-lg"
        />
        <div className="absolute right-4 top-4">
          <WishlistSoonButton productTitle={productTitle} className="size-11" />
        </div>
        {active ? (
          <button
            ref={expandRef}
            type="button"
            aria-label="View larger image"
            aria-haspopup="dialog"
            onClick={() => dialogRef.current?.showModal()}
            className={cn(floatingButton, "absolute bottom-4 right-4")}
          >
            <CornersOutIcon
              aria-hidden="true"
              size={ICON_SIZE_SM}
              weight={ICON_WEIGHT_OUTLINE}
            />
          </button>
        ) : null}
      </div>

      {/* Native modal dialog: the browser traps focus and closes it on Escape. */}
      {active ? (
        <dialog
          ref={dialogRef}
          aria-label={`${productTitle}, image ${index + 1} of ${count}`}
          onClose={() => expandRef.current?.focus()}
          onKeyDown={onLightboxKeyDown}
          onClick={(event) => {
            // A click on the backdrop lands on the <dialog> element itself.
            if (event.target === event.currentTarget) dialogRef.current?.close();
          }}
          className="m-auto size-full max-h-none max-w-none bg-transparent p-4 backdrop:bg-neutral-900/80 md:p-8"
        >
          <div className="relative mx-auto flex size-full max-w-4xl items-center justify-center">
            <div className="relative size-full overflow-hidden rounded-lg bg-white">
              <Image
                src={active.image.src}
                alt={active.image.alt}
                fill
                sizes="(min-width: 896px) 896px, 100vw"
                className="object-contain"
              />
            </div>
            <button
              type="button"
              aria-label="Close image viewer"
              onClick={() => dialogRef.current?.close()}
              className={cn(floatingButton, "absolute right-4 top-4")}
            >
              <XIcon
                aria-hidden="true"
                size={ICON_SIZE}
                weight={ICON_WEIGHT_OUTLINE}
              />
            </button>
            {count > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => show(index - 1)}
                  className={cn(
                    floatingButton,
                    "absolute left-4 top-1/2 -translate-y-1/2",
                  )}
                >
                  <CaretLeftIcon
                    aria-hidden="true"
                    size={ICON_SIZE_SM}
                    weight={ICON_WEIGHT_OUTLINE}
                  />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => show(index + 1)}
                  className={cn(
                    floatingButton,
                    "absolute right-4 top-1/2 -translate-y-1/2",
                  )}
                >
                  <CaretRightIcon
                    aria-hidden="true"
                    size={ICON_SIZE_SM}
                    weight={ICON_WEIGHT_OUTLINE}
                  />
                </button>
              </>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
