import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Checkout step card: orange step number, serif title, description (checkout reference). */
export function NumberedSection({
  step,
  title,
  titleSuffix,
  description,
  action,
  className,
  children,
}: {
  step: number;
  title: string;
  titleSuffix?: string;
  description: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = `checkout-step-${step}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6", className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-body font-semibold text-white"
          >
            {step}
          </span>
          <div className="flex flex-col gap-1">
            <h2 id={headingId} className="font-display text-h2 text-neutral-900">
              <span className="sr-only">Step {step}: </span>
              {title}
              {titleSuffix ? <span className="text-body-lg font-normal text-neutral-500"> {titleSuffix}</span> : null}
            </h2>
            <p className="text-body text-neutral-500">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
