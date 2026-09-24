"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register once per client bundle. Import gsap from here, never from "gsap"
// directly, so plugins are always registered before use.
gsap.registerPlugin(useGSAP, ScrollTrigger);

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/** True when animation should be skipped (reduced motion, or no matchMedia e.g. tests). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return !window.matchMedia(MOTION_OK).matches;
}

export { gsap, ScrollTrigger, useGSAP };
