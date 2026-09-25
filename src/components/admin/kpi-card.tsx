import { useId } from "react";
import { ArrowDownIcon, ArrowUpIcon, type Icon } from "@/components/ui/icons";
import { ICON_SIZE, ICON_SIZE_XS, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { areaPath, linePath, seriesPoints } from "@/features/admin/charts";
import { describeChange, formatChange, type Change } from "@/features/admin/metrics";
import { cn } from "@/lib/utils/cn";

const SPARK_WIDTH = 112;
const SPARK_HEIGHT = 48;

/** Trend line with a soft wash under it (decorative; the card states the numbers). */
export function Sparkline({ values }: { values: readonly number[] }) {
  const gradientId = useId();
  if (values.length < 2) return null;
  const points = seriesPoints(values, { width: SPARK_WIDTH, height: SPARK_HEIGHT, padY: 4, fromZero: false });
  return (
    <svg aria-hidden="true" width={SPARK_WIDTH} height={SPARK_HEIGHT} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath(points, SPARK_HEIGHT)} fill={`url(#${gradientId})`} />
      <path d={linePath(points)} fill="none" stroke="var(--color-primary-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type KpiCardProps = {
  label: string;
  value: string;
  icon: Icon;
  change: Change;
  compareLabel: string;
  trend: readonly number[];
};

/** Dashboard KPI card (reference: icon tile, label, value, change vs previous period, sparkline). */
export function KpiCard({ label, value, icon: KpiIcon, change, compareLabel, trend }: KpiCardProps) {
  const up = change.kind === "change" && change.direction === "up";
  const down = change.kind === "change" && change.direction === "down";
  const ChangeIcon = down ? ArrowDownIcon : ArrowUpIcon;

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-500">
          <KpiIcon aria-hidden="true" size={ICON_SIZE} weight={ICON_WEIGHT_OUTLINE} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-body-lg text-neutral-700">{label}</h3>
          <p className="truncate font-display text-h1 font-bold text-neutral-900 xl:text-h2 2xl:text-h1">{value}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
          <span className="sr-only">{describeChange(change, compareLabel)}</span>
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex items-center gap-1 font-semibold",
              up ? "text-success-700" : down ? "text-error-700" : "text-neutral-700",
            )}
          >
            {change.kind === "change" ? <ChangeIcon size={ICON_SIZE_XS} weight={ICON_WEIGHT_OUTLINE} /> : null}
            {formatChange(change)}
          </span>
          <span aria-hidden="true" className="text-small text-neutral-500">
            {compareLabel}
          </span>
        </p>
        <Sparkline values={trend} />
      </div>
    </Card>
  );
}
