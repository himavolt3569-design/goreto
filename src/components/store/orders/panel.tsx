import type { ReactNode } from "react";
import type { Icon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

/** Tracking-page card: orange icon disc, serif title, description (order reference). */
export function OrderPanel({
  icon: PanelIcon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
            <PanelIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-h2 text-neutral-900">{title}</h2>
            {description ? <p className="text-body text-neutral-500">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
