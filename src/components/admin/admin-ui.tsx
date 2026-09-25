import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon, type Icon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCount } from "@/features/admin/format";
import { hrefWith, type SearchParams } from "@/features/admin/url";
import { cn } from "@/lib/utils/cn";

/* Server-rendered building blocks shared by admin pages. */

export function PageHeader({
  title,
  description,
  actions,
  display = false,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Playfair display title, as on the dashboard reference. */
  display?: boolean;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow}
        <h1 className={display ? "font-display text-display-2 text-neutral-900" : "text-h1 text-neutral-900"}>{title}</h1>
        {description ? <p className="text-body-lg text-neutral-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1 rounded-xs text-body font-medium text-neutral-500 hover:text-primary-600">
      <CaretLeftIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
      {children}
    </Link>
  );
}

/** Card with a title row; `action` usually a "View All" link. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)} id={id}>
      <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-h2 text-neutral-900">{title}</h2>
          {description ? <p className="text-body text-neutral-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function ViewAllLink({ href, label = "View All" }: { href: string; label?: string }) {
  return (
    <Link href={href} className={buttonClasses({ variant: "text", size: "md", className: "h-8 shrink-0" })}>
      {label}
      <ArrowRightIcon aria-hidden="true" size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
    </Link>
  );
}

/* ---------- Tables ---------- */

/** Horizontal scroll inside the card on small screens; the page itself never scrolls sideways. */
export function TableScroll({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0 overflow-x-auto px-2 pb-2" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export const tableClasses = "w-full min-w-[640px] border-separate border-spacing-0 text-left text-body";
export const theadRowClasses = "[&>th]:bg-neutral-50 [&>th:first-child]:rounded-l-sm [&>th:last-child]:rounded-r-sm";
export const thClasses = "h-10 px-4 text-small font-medium text-neutral-500 whitespace-nowrap";
export const tdClasses = "border-b border-neutral-100 px-4 py-3 align-middle text-neutral-900";
export const numericClasses = "text-right tabular-nums";

/** Small product/order thumbnail (decorative: the row names the item). */
export function Thumb({ src, className, sizes = "48px" }: { src: string | null; className?: string; sizes?: string }) {
  return (
    <span className={cn("relative block size-12 shrink-0 overflow-hidden rounded-sm bg-neutral-100", className)}>
      {src ? <Image src={src} alt="" fill sizes={sizes} className="object-cover" /> : null}
    </span>
  );
}

/* ---------- Empty / stat ---------- */

export function EmptyState({ icon: EmptyIcon, title, description, action }: { icon: Icon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-500">
        <EmptyIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
      </span>
      <p className="text-h3 text-neutral-900">{title}</p>
      {description ? <p className="max-w-md text-body text-neutral-500">{description}</p> : null}
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: StatIcon,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: Icon;
  tone?: "primary" | "success" | "warning" | "error" | "info" | "neutral";
}) {
  const tones = {
    primary: "bg-primary-100 text-primary-500",
    success: "bg-success-100 text-success-700",
    warning: "bg-warning-100 text-warning-700",
    error: "bg-error-100 text-error-700",
    info: "bg-info-100 text-info-700",
    neutral: "bg-neutral-100 text-neutral-700",
  } as const;
  return (
    <Card className="flex items-start gap-4 p-6">
      {StatIcon ? (
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-md", tones[tone])}>
          <StatIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-body text-neutral-500">{label}</p>
        <p className="text-h1 text-neutral-900">{value}</p>
        {hint ? <p className="text-small text-neutral-500">{hint}</p> : null}
      </div>
    </Card>
  );
}

/* ---------- Pagination & filters ---------- */

export function Pagination({
  pathname,
  params,
  page,
  pageCount,
  total,
  noun,
}: {
  pathname: string;
  params: SearchParams;
  page: number;
  pageCount: number;
  total: number;
  noun: string;
}) {
  const linkClasses = buttonClasses({ variant: "tertiary", size: "md" });
  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-neutral-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-body text-neutral-500">
        {formatCount(total)} {noun} · Page {formatCount(page)} of {formatCount(pageCount)}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefWith(pathname, params, { page: page - 1 === 1 ? null : page - 1 })} className={linkClasses} rel="prev">
            <CaretLeftIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
            Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link href={hrefWith(pathname, params, { page: page + 1 })} className={linkClasses} rel="next">
            Next
            <CaretRightIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** GET filter form: works without JavaScript and keeps filters in the URL. */
export function FilterBar({ children, resetHref, hasFilters }: { children: ReactNode; resetHref: string; hasFilters: boolean }) {
  return (
    <form method="get" className="flex flex-col gap-3 px-6 pb-4 md:flex-row md:flex-wrap md:items-end">
      {children}
      <div className="flex gap-2">
        <button type="submit" className={buttonClasses({ variant: "primary", size: "md" })}>
          Apply
        </button>
        {hasFilters ? (
          <Link href={resetHref} className={buttonClasses({ variant: "tertiary", size: "md" })}>
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/** Label + native control for a FilterBar. */
export function FilterField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 md:w-56", className)}>
      <label htmlFor={htmlFor} className="text-small font-medium text-neutral-700">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Tabs as links (sub-pages or filter presets), with aria-current on the active one. */
export function LinkTabs({ tabs, label }: { tabs: { href: string; label: string; active: boolean; count?: number }[]; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-neutral-200">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "relative inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-body font-medium transition-colors",
            tab.active
              ? "text-primary-600 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary-500"
              : "text-neutral-500 hover:text-neutral-900",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className={cn("rounded-full px-2 text-small", tab.active ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-700")}>
              {formatCount(tab.count)}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
