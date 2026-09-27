import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowCounterClockwiseIcon, HeadsetIcon, MoneyIcon, TruckIcon, type Icon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { picsumImage } from "@/lib/media/picsum";
import { cn } from "@/lib/utils/cn";

/*
 * Reassurance blocks from the checkout and tracking references. The copy is
 * kept true: payment is Cash on Delivery (no "secure transactions" claim),
 * and the returns window comes from store settings.
 */

type Assurance = { icon: Icon; title: string; caption: string };

export function checkoutAssurances(returnsWindowDays: number): Assurance[] {
  return [
    { icon: MoneyIcon, title: "Cash on Delivery", caption: "Pay when your order arrives" },
    { icon: ArrowCounterClockwiseIcon, title: "Easy Returns", caption: `${returnsWindowDays}-day returns` },
    { icon: TruckIcon, title: "Verified Delivery", caption: "Courier partners across Nepal" },
  ];
}

export function trackingAssurances(returnsWindowDays: number): Assurance[] {
  return [
    { icon: MoneyIcon, title: "Cash on Delivery", caption: "Pay at your door" },
    { icon: ArrowCounterClockwiseIcon, title: "Easy Returns", caption: `${returnsWindowDays}-day returns` },
    { icon: HeadsetIcon, title: "Help Center", caption: "We're here to help" },
  ];
}

export function AssuranceTiles({ items, className }: { items: Assurance[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-3 divide-x divide-primary-200", className)}>
      {items.map(({ icon: ItemIcon, title, caption }) => (
        <li key={title} className="flex flex-col items-center gap-2 px-2 text-center">
          <ItemIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} className="text-primary-500" />
          <span className="text-small font-semibold text-neutral-900">{title}</span>
          <span className="text-small text-neutral-500">{caption}</span>
        </li>
      ))}
    </ul>
  );
}

/** "You're in good hands" card with stand-in photography. */
export function GoodHandsCard({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg bg-primary-100", className)}>
      <div className="relative flex min-h-44 items-center">
        <Image
          src={picsumImage(64, 480, 360)}
          alt=""
          fill
          sizes="(min-width: 1024px) 360px, 100vw"
          className="object-cover object-right opacity-90"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-primary-100 via-primary-100/90 to-transparent" />
        <div className="relative flex max-w-60 flex-col gap-2 p-6">
          <p className="font-display text-h2 text-neutral-900">You&rsquo;re in good hands</p>
          <p className="text-body text-neutral-700">
            Quality products, careful delivery and cash on delivery across Nepal.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
