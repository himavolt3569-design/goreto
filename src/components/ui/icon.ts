import type { IconWeight } from "./icons";

/**
 * Icon conventions (Design System §06). Phosphor is the single icon family.
 * Import icons from "@/components/ui/icons" (the curated set), never from the
 * package barrel.
 * "bold" renders ~2px strokes at 20–24px, matching the outline spec;
 * "fill" is reserved for selected/active states.
 */
export const ICON_SIZE = 24;
export const ICON_SIZE_SM = 20;
export const ICON_SIZE_XS = 16;

export const ICON_WEIGHT_OUTLINE: IconWeight = "bold";
export const ICON_WEIGHT_FILLED: IconWeight = "fill";
