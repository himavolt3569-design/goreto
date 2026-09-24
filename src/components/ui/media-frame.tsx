import Image from "next/image";
import { ImageIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "./icon";

export type MediaImage = {
  src: string;
  /** Meaningful alt text; use "" for decorative images. */
  alt: string;
};

export type MediaFrameProps = {
  image?: MediaImage | null;
  /** `sizes` hint for next/image so cards never download full originals. */
  sizes: string;
  className?: string;
  priority?: boolean;
};

/**
 * Fills its (positioned, sized) parent with a cover image, or a neutral
 * placeholder when no media exists yet.
 */
export function MediaFrame({ image, sizes, className, priority }: MediaFrameProps) {
  return (
    <div className={cn("relative overflow-hidden bg-neutral-100", className)}>
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-neutral-300"
        >
          <ImageIcon size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        </div>
      )}
    </div>
  );
}
