import Image from "next/image";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CubeIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import type { ProductTryOn, TryOnMode } from "@/features/catalog/types";
import { cn } from "@/lib/utils/cn";
import { SOFT_SECONDARY } from "./classes";

/** Copy follows the configured modes, so the card never promises a mode that isn't set up. */
export function tryOnDescription(modes: TryOnMode[]): string {
  const live = modes.includes("live");
  const photo = modes.includes("photo");
  if (live && photo) return "Use your camera or upload a photo.";
  if (photo) return "Upload a photo to see it on you.";
  return "Use your camera to see it on you in real time.";
}

const corners = [
  "left-2 top-2 border-l-2 border-t-2 rounded-tl-sm",
  "right-2 top-2 border-r-2 border-t-2 rounded-tr-sm",
  "bottom-2 left-2 border-b-2 border-l-2 rounded-bl-sm",
  "bottom-2 right-2 border-b-2 border-r-2 rounded-br-sm",
];

/** "Try It On in AR" card. Render it only for products with a try-on capability. */
export function TryOnCard({ productSlug, tryOn }: { productSlug: string; tryOn: ProductTryOn }) {
  return (
    <Card className="flex flex-col gap-6 p-4 sm:flex-row sm:items-center md:p-6">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-neutral-100 sm:w-44 md:w-48">
        <Image
          src={tryOn.previewImage.src}
          alt={tryOn.previewImage.alt}
          fill
          sizes="(min-width: 640px) 192px, 100vw"
          className="object-cover"
        />
        {/* Camera-frame corners, as in the reference. */}
        {corners.map((corner) => (
          <span
            key={corner}
            aria-hidden="true"
            className={cn("absolute size-6 border-white", corner)}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <h2 id="try-on-title" className="font-display text-h2 text-neutral-900">
          Try It On in AR
        </h2>
        <p className="text-body text-neutral-500">
          See how it looks on you with our AR try-on. {tryOnDescription(tryOn.modes)}
        </p>
      </div>

      <Link
        href={`/try-on?product=${encodeURIComponent(productSlug)}`}
        className={buttonClasses({
          variant: "secondary",
          className: cn(SOFT_SECONDARY, "h-14 w-full text-h3 sm:w-auto md:min-w-60"),
        })}
      >
        <CubeIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        Try in AR
      </Link>
    </Card>
  );
}
