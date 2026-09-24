import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type NavItemProps = {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Current page: orange label + underline, exposed via aria-current. */
  active?: boolean;
  className?: string;
};

export function NavItem({
  href,
  children,
  icon,
  trailingIcon,
  active = false,
  className,
}: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex h-11 shrink-0 items-center whitespace-nowrap gap-2 rounded-sm px-2 text-body font-medium transition-colors",
        active
          ? "text-primary-500 after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:rounded-full after:bg-primary-500"
          : "text-neutral-700 hover:text-neutral-900",
        className,
      )}
    >
      {icon ? <span aria-hidden="true" className="flex shrink-0">{icon}</span> : null}
      {children}
      {trailingIcon ? <span aria-hidden="true" className="flex shrink-0">{trailingIcon}</span> : null}
    </Link>
  );
}
