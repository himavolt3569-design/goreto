/*
 * Admin date ranges (AGENTS §15.2): store days are Asia/Kathmandu calendar
 * dates, passed around as "YYYY-MM-DD" strings and to SQL as `date`. All
 * arithmetic here is on whole days in UTC so the host timezone never matters.
 */

export const STORE_TIMEZONE = "Asia/Kathmandu";

/** The SQL functions refuse longer spans (admin_assert_range). */
const MAX_SPAN_DAYS = 800;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const kathmanduDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const rangeLabelFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const monthFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" });

/** Today's date in Kathmandu. */
export function todayInKathmandu(now: Date = new Date()): string {
  return kathmanduDate.format(now);
}

function toUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = toUtc(value);
  return !Number.isNaN(date.getTime()) && fromUtc(date) === value;
}

export function addDays(day: string, days: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Inclusive number of days from `from` to `to`. */
export function daySpan(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
}

function startOfMonth(day: string, monthOffset = 0): string {
  const date = toUtc(day);
  return fromUtc(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1)));
}

function endOfMonth(day: string, monthOffset = 0): string {
  const date = toUtc(day);
  return fromUtc(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset + 1, 0)));
}

export type RangePreset = "this_month" | "last_month" | "last_7" | "last_30" | "last_90" | "this_year";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_7", label: "Last 7 days" },
  { value: "last_30", label: "Last 30 days" },
  { value: "last_90", label: "Last 90 days" },
  { value: "this_year", label: "This year" },
];

export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  switch (preset) {
    case "this_month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "last_month":
      return { from: startOfMonth(today, -1), to: endOfMonth(today, -1) };
    case "last_7":
      return { from: addDays(today, -6), to: today };
    case "last_30":
      return { from: addDays(today, -29), to: today };
    case "last_90":
      return { from: addDays(today, -89), to: today };
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    default: {
      const unreachable: never = preset;
      return unreachable;
    }
  }
}

export type ResolvedRange = {
  from: string;
  to: string;
  /** Comparison period: the previous calendar month/year, or the same number of days before. */
  prevFrom: string;
  prevTo: string;
  /** "vs last month" / "vs last year" / "vs previous period". */
  compareLabel: string;
  /** "Sep 1, 2026 – Sep 30, 2026". */
  label: string;
  /** The preset this range equals, if any (for the picker's selected state). */
  preset: RangePreset | null;
};

const isCalendarMonth = (from: string, to: string) =>
  from === startOfMonth(from) && to === endOfMonth(from);

const isCalendarYear = (from: string, to: string) =>
  from.endsWith("-01-01") && to === `${from.slice(0, 4)}-12-31`;

export function formatRangeLabel(from: string, to: string): string {
  return `${rangeLabelFormat.format(toUtc(from))} – ${rangeLabelFormat.format(toUtc(to))}`;
}

export function formatDayShort(day: string): string {
  return shortDayFormat.format(toUtc(day));
}

export function formatDayLong(day: string): string {
  return rangeLabelFormat.format(toUtc(day));
}

export function formatMonthShort(day: string): string {
  return monthFormat.format(toUtc(day));
}

/**
 * Reads `from`/`to` search params. Anything missing or invalid falls back to
 * the current Kathmandu month, the dashboard default.
 */
export function resolveRange(
  params: { from?: string | string[]; to?: string | string[] },
  today: string = todayInKathmandu(),
): ResolvedRange {
  const rawFrom = Array.isArray(params.from) ? params.from[0] : params.from;
  const rawTo = Array.isArray(params.to) ? params.to[0] : params.to;

  let { from, to } = presetRange("this_month", today);
  if (isIsoDate(rawFrom) && isIsoDate(rawTo) && rawFrom <= rawTo && daySpan(rawFrom, rawTo) <= MAX_SPAN_DAYS) {
    from = rawFrom;
    to = rawTo;
  }

  let prevFrom: string;
  let prevTo: string;
  let compareLabel: string;
  if (isCalendarMonth(from, to)) {
    prevFrom = startOfMonth(from, -1);
    prevTo = endOfMonth(from, -1);
    compareLabel = "vs last month";
  } else if (isCalendarYear(from, to)) {
    const year = Number(from.slice(0, 4)) - 1;
    prevFrom = `${year}-01-01`;
    prevTo = `${year}-12-31`;
    compareLabel = "vs last year";
  } else {
    const span = daySpan(from, to);
    prevTo = addDays(from, -1);
    prevFrom = addDays(from, -span);
    compareLabel = "vs previous period";
  }
  // A range still in progress is compared with the same number of elapsed
  // days of the previous period, not the whole of it.
  if (from <= today && today < to) {
    const elapsedEnd = addDays(prevFrom, daySpan(from, today) - 1);
    if (elapsedEnd < prevTo) prevTo = elapsedEnd;
  }

  const preset =
    RANGE_PRESETS.find(({ value }) => {
      const candidate = presetRange(value, today);
      return candidate.from === from && candidate.to === to;
    })?.value ?? null;

  return { from, to, prevFrom, prevTo, compareLabel, label: formatRangeLabel(from, to), preset };
}

/* ---------- Revenue chart windows ---------- */

export type RevenueWindow = "7d" | "30d" | "90d" | "12m";

export const REVENUE_WINDOWS: { value: RevenueWindow; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "12m", label: "Last 12 Months" },
];

export type ResolvedRevenueWindow = {
  window: RevenueWindow;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  bucket: "day" | "month";
  compareLabel: string;
};

export function resolveRevenueWindow(
  raw: string | string[] | undefined,
  today: string = todayInKathmandu(),
): ResolvedRevenueWindow {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const window = REVENUE_WINDOWS.some((option) => option.value === value) ? (value as RevenueWindow) : "30d";

  if (window === "12m") {
    const from = startOfMonth(today, -11);
    return {
      window,
      from,
      to: today,
      prevFrom: startOfMonth(today, -23),
      prevTo: addDays(from, -1),
      bucket: "month",
      compareLabel: "from the previous 12 months",
    };
  }

  const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
  const from = addDays(today, -(days - 1));
  return {
    window,
    from,
    to: today,
    prevFrom: addDays(from, -days),
    prevTo: addDays(from, -1),
    bucket: "day",
    compareLabel: `from the previous ${days} days`,
  };
}
