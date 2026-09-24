import Image from "next/image";
import type { ReactNode } from "react";
import {
  CameraIcon,
  Card,
  CubeIcon,
  HandbagIcon,
  ICON_SIZE,
  ICON_WEIGHT_OUTLINE,
  SectionHeading,
} from "@/components/ui";
import { picsumImage } from "@/lib/media/picsum";

const steps: { icon: ReactNode; title: string; description: string }[] = [
  {
    icon: <CubeIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />,
    title: "Choose a Product",
    description: "Browse our collections and select your favorite styles.",
  },
  {
    icon: <CameraIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />,
    title: "Try It On",
    description: "Use AR to see how it looks on you in real time.",
  },
  {
    icon: <HandbagIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />,
    title: "Shop with Confidence",
    description: "Find your perfect style and pay cash on delivery.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-title"
      className="mx-auto grid w-full max-w-7xl gap-8 px-4 pt-12 md:px-8 md:pt-16 lg:grid-cols-12 lg:items-center"
    >
      <div className="relative flex flex-col gap-8 lg:col-span-8">
        <div data-animate="reveal">
          <SectionHeading
            id="how-title"
            eyebrow="How it works"
            title="Try On in 3 Simple Steps"
            description="Experience the future of shopping from the comfort of your home."
          />
        </div>
        <Sparkle />
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} data-animate="reveal" className="flex">
              <Card className="flex w-full items-start gap-3 p-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-500">
                  {step.icon}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-body font-semibold text-neutral-900">
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.title}
                  </span>
                  <span className="text-small text-neutral-500">{step.description}</span>
                </span>
              </Card>
            </li>
          ))}
        </ol>
      </div>

      <div data-animate="reveal" className="relative mx-auto w-full max-w-sm lg:col-span-4 lg:max-w-none">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl shadow-md lg:aspect-[5/4]">
          <Image
            src={picsumImage(832, 640, 520)}
            alt="Shopper in a pale blue blouse browsing a lookbook"
            fill
            sizes="(min-width: 1024px) 33vw, 384px"
            className="object-cover object-top"
          />
        </div>
        <div className="absolute -bottom-4 right-4 aspect-[3/4] w-1/3 overflow-hidden rounded-lg border-4 border-white shadow-lg">
          <Image
            src={picsumImage(628, 240, 320)}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}

/** Decorative accent strokes from the reference. */
function Sparkle() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="absolute right-4 top-4 hidden size-12 text-primary-500 md:block"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M16 4 L24 20" />
      <path d="M40 18 L26 26" />
      <path d="M8 30 L22 34" />
    </svg>
  );
}
