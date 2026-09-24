import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  buttonClasses,
  CameraIcon,
  CornersOutIcon,
  CubeIcon,
  ICON_SIZE,
  ICON_SIZE_SM,
  ICON_SIZE_XS,
  ICON_WEIGHT_OUTLINE,
  ShieldCheckIcon,
  TruckIcon,
} from "@/components/ui";
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

const mockupThumbs = [26, 628, 823];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-primary-100">
      {/* 560px min height (off the spacing scale) matches the reference hero band. */}
      <div className="relative z-10 mx-auto grid max-w-7xl px-4 md:px-8 lg:min-h-[560px] lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-6 py-12 lg:py-16">
          <p
            data-animate="hero"
            className="text-small font-semibold uppercase tracking-widest text-primary-500"
          >
            Fashion meets innovation
          </p>
          <h1
            id="hero-title"
            data-animate="hero"
            className="max-w-md font-display text-display-2 md:text-display-1"
          >
            See It On You Before You Buy
          </h1>
          <p data-animate="hero" className="max-w-md text-body-lg text-neutral-700">
            Try on jewelry, bags and more with AR. Discover styles you love, shop with
            confidence, and express your unique style.
          </p>
          <div data-animate="hero" className="flex flex-wrap gap-4">
            <Link href="#featured" className={buttonClasses({ variant: "primary" })}>
              Shop Now
              <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            </Link>
            <Link href="/try-on" className={buttonClasses({ variant: "secondary" })}>
              <CubeIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              Try in AR
            </Link>
          </div>
          <ul className="mt-2 grid gap-4 sm:grid-cols-3 sm:gap-6">
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
        </div>

        <div className="hidden items-center justify-end lg:flex">
          <ArMockup />
        </div>
      </div>

      {/* Portrait: in flow below the copy on small screens, bleeds right on desktop. */}
      <div
        data-animate="hero-media"
        className="relative aspect-[4/3] md:aspect-[16/9] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[46%]"
      >
        <Image
          src={picsumImage(1027, 1000, 1100)}
          alt="Model with soft curls in warm studio light"
          fill
          sizes="(min-width: 1024px) 46vw, 100vw"
          loading="eager"
          fetchPriority="high"
          className="object-cover object-[center_35%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-primary-100 to-transparent lg:inset-y-0 lg:right-auto lg:h-auto lg:w-2/5 lg:bg-linear-to-r"
        />
      </div>
    </section>
  );
}

/** Decorative phone preview of the try-on experience; the whole card links to the AR hub. */
function ArMockup() {
  return (
    <Link
      href="/try-on"
      aria-label="Preview AR try-on"
      data-animate="hero-device"
      className="group relative flex w-60 flex-col gap-3 rounded-xl border-4 border-white bg-white/80 p-2 shadow-xl xl:mr-8 xl:w-64"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
        <Image
          src={picsumImage(64, 400, 540)}
          alt=""
          fill
          sizes="256px"
          className="object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm"
        >
          <CornersOutIcon size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm"
        >
          <CameraIcon size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
        </span>
      </div>
      <div aria-hidden="true" className="grid grid-cols-3 gap-2">
        {mockupThumbs.map((id) => (
          <div key={id} className="relative aspect-square overflow-hidden rounded-sm border border-neutral-200">
            <Image src={picsumImage(id, 120, 120)} alt="" fill sizes="80px" className="object-cover" />
          </div>
        ))}
      </div>
      <span className="flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white text-body font-medium text-primary-500 transition-colors group-hover:bg-primary-100">
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center rounded-xs bg-primary-500 text-white"
        >
          <ArrowRightIcon size={12} weight={ICON_WEIGHT_OUTLINE} />
        </span>
        Try in AR
      </span>
    </Link>
  );
}
