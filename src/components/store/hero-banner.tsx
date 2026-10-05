import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type HeroBannerProps = {
  /** id of the heading, used by the section's aria-labelledby. */
  titleId: string;
  eyebrow?: string;
  title: string;
  text?: string;
  /** Buttons/links under the copy. */
  actions?: ReactNode;
  image: { src: string; alt: string };
  /** The homepage hero is the LCP image; category heroes are too, but stay opt-in. */
  priority?: boolean;
  /** Animate with the homepage entrance timeline (HomeMotion). */
  animated?: boolean;
  className?: string;
};

/**
 * Compact hero band: copy on the left, a photo bleeding off the right edge on
 * desktop and a 16:9 band under the copy on small screens. Shared by the
 * homepage hero and the per-category heroes.
 */
export function HeroBanner({
  titleId,
  eyebrow,
  title,
  text,
  actions,
  image,
  priority = false,
  animated = false,
  className,
}: HeroBannerProps) {
  const copyAnimation = animated ? { "data-animate": "hero" } : {};

  return (
    <section aria-labelledby={titleId} className={cn("relative overflow-hidden bg-primary-100", className)}>
      {/* 280px min height (off the spacing scale): half the original 560px reference band, per client feedback. */}
      <div className="relative z-10 mx-auto grid max-w-7xl px-4 md:px-8 lg:min-h-[280px] lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-4 py-8 lg:py-10">
          {eyebrow ? (
            <p {...copyAnimation} className="text-small font-semibold uppercase tracking-widest text-primary-500">
              {eyebrow}
            </p>
          ) : null}
          <h1 id={titleId} {...copyAnimation} className="max-w-xl font-display text-h1 md:text-display-2">
            {title}
          </h1>
          {text ? (
            <p {...copyAnimation} className="max-w-md text-body text-neutral-700">
              {text}
            </p>
          ) : null}
          {actions ? (
            <div {...copyAnimation} className="flex flex-wrap gap-4">
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <div
        {...(animated ? { "data-animate": "hero-media" } : {})}
        className="relative aspect-[16/9] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[46%]"
      >
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 46vw, 100vw"
          {...(priority ? { loading: "eager", fetchPriority: "high" } as const : {})}
          className="object-cover object-[center_35%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-primary-100 to-transparent lg:inset-y-0 lg:right-auto lg:h-auto lg:w-2/5 lg:bg-linear-to-r"
        />
      </div>
    </section>
  );
}
