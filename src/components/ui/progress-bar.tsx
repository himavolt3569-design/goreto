import { useId } from "react";
import { cn } from "@/lib/utils/cn";

export type ProgressBarProps = {
  label: string;
  /** 0–100; clamped. */
  value: number;
  /** Show the "N% complete" caption. */
  showValue?: boolean;
  className?: string;
};

export function ProgressBar({
  label,
  value,
  showValue = true,
  className,
}: ProgressBarProps) {
  const labelId = useId();
  const percent = Math.round(Math.min(100, Math.max(0, value)));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={labelId} className="text-body font-medium text-neutral-900">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <div
          role="progressbar"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200"
        >
          <div
            className="h-full rounded-full bg-primary-500 transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        {showValue ? (
          <span className="shrink-0 text-small text-neutral-500">
            {percent}% complete
          </span>
        ) : null}
      </div>
    </div>
  );
}
