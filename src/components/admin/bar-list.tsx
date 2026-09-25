import { cn } from "@/lib/utils/cn";

export type BarListItem = { label: string; value: number; display: string; hint?: string };

/**
 * Horizontal bars with the value printed at the end (single series, so no
 * legend; every value is readable text, so no tooltip is needed).
 */
export function BarList({ items, label, className }: { items: BarListItem[]; label: string; className?: string }) {
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <ul aria-label={label} className={cn("flex flex-col gap-4", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4 text-body">
            <span className="min-w-0 truncate text-neutral-900">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-neutral-900">
              {item.display}
              {item.hint ? <span className="ml-2 text-small font-normal text-neutral-500">{item.hint}</span> : null}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-primary-500" style={{ width: max > 0 ? `${Math.max(2, (item.value / max) * 100)}%` : "0%" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
