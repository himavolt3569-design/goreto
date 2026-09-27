import { CheckCircleIcon, CheckIcon, HandbagIcon, HouseIcon, PackageIcon, TruckIcon, type Icon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import type { OrderStep, StepKey } from "@/features/orders/stepper";
import { cn } from "@/lib/utils/cn";

const stepIcons: Record<StepKey, Icon> = {
  placed: HandbagIcon,
  confirmed: CheckCircleIcon,
  packed: PackageIcon,
  shipped: TruckIcon,
  out_for_delivery: TruckIcon,
  delivered: HouseIcon,
};

/**
 * Order progress with explicit labels and times (AGENTS §3.9). Horizontal on
 * wide screens, vertical on phones. State is in text too, not only color.
 */
export function OrderStepper({ steps }: { steps: OrderStep[] }) {
  return (
    <ol className="flex flex-col gap-4 md:flex-row md:gap-0">
      {steps.map((step, index) => {
        const StepIcon = stepIcons[step.key];
        const last = index === steps.length - 1;
        const nextDone = steps[index + 1]?.state === "done";
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex gap-4 md:flex-1 md:flex-col md:items-center md:gap-2 md:text-center"
          >
            {/* Connector to the next step: from this disc's edge (2.5rem disc) to the next one's. */}
            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-5 top-10 h-[calc(100%-1.5rem)] w-0.5 md:left-[calc(50%+1.25rem)] md:top-5 md:h-0.5 md:w-[calc(100%-2.5rem)]",
                  nextDone ? "bg-primary-500" : "bg-neutral-200",
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative flex size-10 shrink-0 items-center justify-center rounded-full border-2",
                step.state === "done" && "border-primary-500 bg-primary-500 text-white",
                step.state === "current" && "border-primary-500 bg-white text-primary-500 ring-4 ring-primary-100",
                step.state === "upcoming" && "border-neutral-200 bg-white text-neutral-300",
              )}
            >
              {step.state === "done" ? (
                <CheckIcon size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} />
              ) : (
                <StepIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
              )}
            </span>
            <span className="flex flex-col gap-1 pt-1 md:pt-0">
              <span className={cn("text-body font-semibold", step.state === "upcoming" ? "text-neutral-500" : "text-neutral-900")}>
                {step.label}
                <span className="sr-only">
                  {step.state === "done" ? " (done)" : step.state === "current" ? " (next)" : " (not yet)"}
                </span>
              </span>
              {step.detail ? <span className="text-small text-neutral-500">{step.detail}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
