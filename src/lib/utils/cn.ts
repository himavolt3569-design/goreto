import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register the Goreto type-scale tokens so `text-body` is treated as a font
// size (not a text color) and correctly overrides/gets overridden.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-1",
            "display-2",
            "h1",
            "h2",
            "h3",
            "body-lg",
            "body",
            "small",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
