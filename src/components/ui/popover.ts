/*
 * Shared dropdown surface (Select lists, menus, date-range panel), so every
 * popover reads as one family: white card, neutral border, 12px radius,
 * shadow-lg, 8px inset. Opens with a short fade/slide via @starting-style;
 * reduced motion shows it instantly.
 */

export const popoverPanelClasses =
  "z-50 rounded-md border border-neutral-200 bg-white p-2 shadow-lg transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none";

/** A 44px row inside a popover. Hover/active use neutral-100; disabled rows stay readable but muted. */
export const popoverItemClasses =
  "flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-body text-neutral-900 outline-none transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none aria-disabled:pointer-events-none aria-disabled:text-neutral-300";
