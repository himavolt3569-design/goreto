import type { ReactNode } from "react";
import type { Icon } from "./icons";
import { ICON_SIZE, ICON_WEIGHT_OUTLINE } from "./icon";
import { Card } from "./card";
import { cn } from "@/lib/utils/cn";

const tones = {
  primary: "bg-primary-100 text-primary-500",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  error: "bg-error-100 text-error-700",
  info: "bg-info-100 text-info-700",
  neutral: "bg-neutral-100 text-neutral-700",
} as const;

export type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: Icon;
  tone?: keyof typeof tones;
};

/** Stat/KPI card: icon tile, label, value and an optional hint. */
export function StatCard({ label, value, hint, icon: StatIcon, tone = "primary" }: StatCardProps) {
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
