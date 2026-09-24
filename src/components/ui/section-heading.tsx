import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** Id for the heading so the section can use aria-labelledby. */
  id?: string;
  /** Trailing control, e.g. a "View all" link or filter tabs. */
  action?: ReactNode;
  /** Heading level; use "h1" when the heading is the page title. */
  as?: "h1" | "h2";
  className?: string;
};

/** Eyebrow + Playfair section title + supporting line, as used on the homepage. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  action,
  as: Heading = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <p className="text-small font-semibold uppercase tracking-widest text-primary-500">
          {eyebrow}
        </p>
        <Heading id={id} className="font-display text-h1 md:text-display-2">
          {title}
        </Heading>
        {description ? (
          <p className="text-body md:text-body-lg text-neutral-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
