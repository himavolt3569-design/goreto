import Link from "next/link";
import { PlayIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE, ICON_WEIGHT_FILLED } from "./icon";
import { MediaFrame, type MediaImage } from "./media-frame";

export type VideoCardProps = {
  title: string;
  description?: string;
  /** Destination that plays the video (page or dialog route). */
  href: string;
  poster?: MediaImage | null;
  /** Display duration, e.g. "0:28". */
  duration?: string;
  /** Shows the "Now Playing" pill; only set when the video really is playing. */
  isPlaying?: boolean;
  className?: string;
};

export function VideoCard({
  title,
  description,
  href,
  poster,
  duration,
  isPlaying = false,
  className,
}: VideoCardProps) {
  return (
    <article
      className={cn(
        "group relative isolate flex aspect-video overflow-hidden rounded-lg shadow-sm",
        className,
      )}
    >
      <MediaFrame image={poster} sizes="(min-width: 1024px) 33vw, 100vw" className="absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-neutral-900/70 via-neutral-900/10 to-transparent"
      />

      {isPlaying ? (
        <span className="absolute left-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-white px-2 text-small font-medium text-primary-700">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary-500" />
          Now Playing
        </span>
      ) : null}

      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-900 shadow-md transition-transform group-hover:scale-105"
      >
        <PlayIcon size={ICON_SIZE} weight={ICON_WEIGHT_FILLED} />
      </span>

      <div className="mt-auto flex w-full items-end justify-between gap-4 p-4 text-white">
        <div className="flex flex-col gap-1">
          <h3 className="text-h3 font-semibold">
            <Link
              href={href}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-white"
            >
              {title}
              <span className="sr-only">, play video</span>
            </Link>
          </h3>
          {description ? <p className="text-small text-white/90">{description}</p> : null}
        </div>
        {duration ? (
          <span className="shrink-0 rounded-xs bg-neutral-900/70 px-2 py-1 text-small font-medium">
            <span className="sr-only">Duration </span>
            {duration}
          </span>
        ) : null}
      </div>
    </article>
  );
}
