/** Period-over-period change for KPI cards. Never colour-only: callers render the text too. */
export type Change =
  | { kind: "new" }
  | { kind: "flat" }
  | { kind: "change"; direction: "up" | "down"; percent: number };

export function percentChange(current: number, previous: number): Change {
  if (previous === 0) return current === 0 ? { kind: "flat" } : { kind: "new" };
  const ratio = ((current - previous) / previous) * 100;
  const percent = Math.round(Math.abs(ratio) * 10) / 10;
  if (percent === 0) return { kind: "flat" };
  return { kind: "change", direction: ratio > 0 ? "up" : "down", percent };
}

/** "12.5%" / "New" / "0%". */
export function formatChange(change: Change): string {
  switch (change.kind) {
    case "new":
      return "New";
    case "flat":
      return "0%";
    case "change":
      return `${change.percent.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    default: {
      const unreachable: never = change;
      return unreachable;
    }
  }
}

/** Screen-reader sentence, e.g. "up 12.5% vs last month". */
export function describeChange(change: Change, compareLabel: string): string {
  switch (change.kind) {
    case "new":
      return `new ${compareLabel.replace(/^vs /, "since ")}`;
    case "flat":
      return `no change ${compareLabel}`;
    case "change":
      return `${change.direction} ${formatChange(change)} ${compareLabel}`;
    default: {
      const unreachable: never = change;
      return unreachable;
    }
  }
}
