import Image from "next/image";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { MediaImage } from "@/components/ui/media-frame";
import { cn } from "@/lib/utils/cn";

export type CollectionBannerContent = {
  eyebrow: string;
  title: string;
  description: string;
  image: MediaImage | null;
};

type CollectionBannerProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  collection: CollectionBannerContent;
  /** `h1` on the collection page, `h3` inside the homepage carousel. */
  headingLevel: "h1" | "h3";
  /** e.g. the carousel's "Explore the Collection" link. */
  action?: ReactNode;
  /** Keeps the copy clear of controls overlaid at the bottom (carousel dots). */
  controlsSpace?: boolean;
  /** For the collection page, where the photo is the LCP image. */
  priority?: boolean;
};

/**
 * The collection banner from the homepage reference: copy on the left over
 * the warm surface, the photo filling the right 3/5 with a fade. Without a
 * photo it is copy-only. `data-slide-image` / `data-slide-copy` are the
 * carousel's animation hooks and inert elsewhere.
 */
export function CollectionBanner({
  collection,
  headingLevel: Heading,
  action,
  controlsSpace = false,
  priority = false,
  className,
  ...rest
}: CollectionBannerProps) {
  const { image } = collection;
  return (
    <div
      {...rest}
      className={cn("relative isolate flex flex-col md:flex-row", image && "md:min-h-[320px]", className)}
    >
      {image ? (
        <div className="relative h-48 overflow-hidden md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-3/5">
          <div data-slide-image className="absolute inset-0">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={priority}
              sizes="(min-width: 768px) 60vw, 100vw"
              className="object-cover"
            />
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 hidden w-1/3 bg-linear-to-r from-primary-100 to-transparent md:block"
          />
        </div>
      ) : null}

      <div
        data-slide-copy
        className={cn(
          "relative flex flex-col items-start gap-4 p-6 md:justify-center md:p-12 lg:pl-16",
          image ? "md:max-w-md" : "md:max-w-2xl",
          controlsSpace && "pb-16 md:pb-12",
        )}
      >
        {collection.eyebrow ? (
          <p className="text-small font-semibold uppercase tracking-widest text-primary-500">
            {collection.eyebrow}
          </p>
        ) : null}
        <Heading className="font-display text-h1 md:text-display-2">{collection.title}</Heading>
        {collection.description ? (
          <p className="text-body-lg text-neutral-700">{collection.description}</p>
        ) : null}
        {action}
      </div>
    </div>
  );
}
