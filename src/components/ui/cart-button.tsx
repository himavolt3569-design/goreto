import Link from "next/link";
import { ShoppingCartIcon } from "./icons";
import { cn } from "@/lib/utils/cn";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "./icon";
import { iconButtonClasses } from "./icon-button";

export type CartButtonProps = {
  href: string;
  /** Number of items in the cart. Hidden when 0. */
  count: number;
  className?: string;
};

export function CartButton({ href, count, className }: CartButtonProps) {
  const label =
    count === 0 ? "Cart, empty" : `Cart, ${count} ${count === 1 ? "item" : "items"}`;
  const display = count > 99 ? "99+" : String(count);

  return (
    <Link
      href={href}
      aria-label={label}
      className={iconButtonClasses({ variant: "ghost", className: cn("relative", className) })}
    >
      <ShoppingCartIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1 text-small font-semibold text-white"
        >
          {display}
        </span>
      ) : null}
    </Link>
  );
}
