import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  buttonClasses,
  CubeIcon,
  ICON_SIZE,
  ICON_SIZE_SM,
  ICON_WEIGHT_OUTLINE,
  ShieldCheckIcon,
  TruckIcon,
} from "@/components/ui";
import { HeroBanner } from "@/components/store/hero-banner";
import { features } from "@/config/features";
import { picsumImage } from "@/lib/media/picsum";

const trustItems: { icon: ReactNode; title: string; caption: string }[] = [
  {
    icon: <CubeIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />,
    title: "AR Try-On",
    caption: "See it on you",
  },
  {
    icon: <ShieldCheckIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />,
    title: "Curated Styles",
    caption: "Timeless & trendy",
  },
  {
    icon: <TruckIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />,
    title: "Hassle-Free Shopping",
    caption: "Secure and convenient",
  },
];

/** Homepage hero (§4.1 item 2), at half the reference height per client feedback. */
export function Hero() {
  return (
    <HeroBanner
      titleId="hero-title"
      animated
      priority
      eyebrow="Fashion meets innovation"
      title="See It On You Before You Buy"
      text="Try on jewelry, bags and more with AR. Discover styles you love, shop with confidence, and express your unique style."
      image={{ src: picsumImage(1027, 1000, 1100), alt: "Model with soft curls in warm studio light" }}
      actions={
        <>
          <Link href="#featured" className={buttonClasses({ variant: "primary" })}>
            Shop Now
            <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          </Link>
          {features.arTryOn ? (
            <Link href="/try-on" className={buttonClasses({ variant: "secondary" })}>
              <CubeIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              Try in AR
            </Link>
          ) : null}
        </>
      }
    />
  );
}

/** Short trust/value row (§4.1 item 3), directly under the hero. */
export function HeroTrustStrip() {
  return (
    <section aria-label="Why shop with Goreto" className="border-b border-neutral-200 bg-white">
      <ul className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:grid-cols-3 sm:gap-6 md:px-8">
        {trustItems.map((item) => (
          <li key={item.title} data-animate="hero" className="flex items-center gap-3">
            <span className="flex shrink-0 text-primary-500">{item.icon}</span>
            <span className="flex flex-col">
              <span className="text-small font-semibold text-neutral-900">{item.title}</span>
              <span className="text-small text-neutral-500">{item.caption}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
