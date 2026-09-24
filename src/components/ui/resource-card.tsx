import Link from "next/link";
import { ArrowSquareOutIcon, FileTextIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE, ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "./icon";
import { MediaFrame, type MediaImage } from "./media-frame";

export type ResourceCardProps = {
  title: string;
  description?: string;
  href: string;
  image?: MediaImage | null;
  /** Small meta items, e.g. ["PDF", "1.2 MB"]. */
  meta?: string[];
  /** Open in a new tab (downloads, external guides). */
  external?: boolean;
  className?: string;
};

export function ResourceCard({
  title,
  description,
  href,
  image,
  meta,
  external = false,
  className,
}: ResourceCardProps) {
  return (
    <article
      className={cn(
        "relative flex gap-4 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <MediaFrame image={image} sizes="96px" className="aspect-square w-24 shrink-0 rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
        <div className="flex items-start gap-2">
          <FileTextIcon
            aria-hidden="true"
            size={ICON_SIZE}
            weight={ICON_WEIGHT_OUTLINE}
            className="shrink-0 text-neutral-700"
          />
          <div className="flex flex-col gap-1">
            <h3 className="text-body font-semibold text-neutral-900">
              <Link
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary-500"
              >
                {title}
                {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
              </Link>
            </h3>
            {description ? (
              <p className="text-small text-neutral-500">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          {meta && meta.length > 0 ? (
            <p className="text-small text-neutral-500">{meta.join(" • ")}</p>
          ) : (
            <span />
          )}
          <ArrowSquareOutIcon
            aria-hidden="true"
            size={ICON_SIZE_SM}
            weight={ICON_WEIGHT_OUTLINE}
            className="text-primary-500"
          />
        </div>
      </div>
    </article>
  );
}
