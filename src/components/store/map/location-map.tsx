"use client";

import dynamic from "next/dynamic";
import { MapPinIcon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import type { LocationMapProps } from "./location-map-client";

const LocationMapClient = dynamic(() => import("./location-map-client"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center text-neutral-300">
      <MapPinIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
    </div>
  ),
});

/** Map preview with a single pin. The map itself is supplementary: every value is also in a field or text. */
export function LocationMap({ className, caption, ...props }: LocationMapProps & { className?: string; caption: string }) {
  return (
    <figure className={cn("relative isolate overflow-hidden rounded-md border border-neutral-200 bg-neutral-100", className)}>
      <LocationMapClient {...props} />
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
