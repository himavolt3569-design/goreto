import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "./icon";
import { MediaFrame, type MediaImage } from "./media-frame";

export type LookbookCardProps = {
  title: string;
  description?: string;
  href: string;
  image?: MediaImage | null;
  className?: string;
};

/** Editorial card: full-bleed image, dark scrim, title and arrow CTA. */
export function LookbookCard({
  title,
  description,
  href,
  image,
  className,
}: LookbookCardProps) {
  return (
    <article
      className={cn(
        "group relative isolate flex aspect-video overflow-hidden rounded-lg shadow-sm",
        className,
      )}
    >
      <MediaFrame image={image} sizes="(min-width: 1024px) 33vw, 100vw" className="absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-neutral-900/80 via-neutral-900/40 to-transparent"
      />
      <div className="mt-auto flex w-full items-end justify-between gap-4 p-4">
        <div className="flex flex-col gap-1 text-white">
          <h3 className="font-display text-h2 font-bold">
            <Link
              href={href}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-white"
            >
              {title}
            </Link>
          </h3>
          {description ? <p className="text-small text-white/90">{description}</p> : null}
        </div>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 transition-transform group-hover:translate-x-1"
        >
          <ArrowRightIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
        </span>
      </div>
    </article>
  );
}
