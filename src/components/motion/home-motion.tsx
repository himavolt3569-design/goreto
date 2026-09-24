"use client";

import { useRef, type ReactNode } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "./gsap";

/**
 * Homepage motion layer. Wraps server-rendered sections and animates their
 * `[data-animate]` targets:
 *  - "hero" / "hero-media" / "hero-device": entrance timeline on load;
 *  - "reveal": fade-up once when scrolled into view (batched + staggered).
 * Targets are hidden by CSS only while JS is present (see globals.css); with
 * reduced motion nothing animates and CSS shows everything immediately.
 */
export function HomeMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      document.documentElement.classList.add("motion-ready");

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const q = (selector: string) => gsap.utils.toArray<HTMLElement>(selector, root);
        const device = q("[data-animate='hero-device']");

        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .fromTo(
            q("[data-animate='hero-media']"),
            { autoAlpha: 0, scale: 1.04 },
            { autoAlpha: 1, scale: 1, duration: 1.1 },
            0,
          )
          .fromTo(
            q("[data-animate='hero']"),
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 },
            0.1,
          )
          .fromTo(
            device,
            { autoAlpha: 0, y: 48, rotate: 3 },
            { autoAlpha: 1, y: 0, rotate: 0, duration: 0.9 },
            0.35,
          )
          // Gentle idle float once the device has landed.
          .to(device, { y: -8, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1 });

        ScrollTrigger.batch(q("[data-animate='reveal']"), {
          start: "top 90%",
          once: true,
          onEnter: (batch) => {
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 24 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.6,
                ease: "power2.out",
                stagger: 0.08,
                overwrite: true,
              },
            );
          },
        });
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
