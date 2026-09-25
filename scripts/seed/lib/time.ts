/**
 * Time helpers. Rows store UTC ISO strings; the simulation reasons in Nepal
 * time (UTC+05:45, no DST) because store hours and customer habits are local.
 */

const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const NPT_OFFSET = (5 * 60 + 45) * MINUTE;

/** Build a UTC timestamp from a Nepal wall-clock time (month is 1-based). */
export function npt(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) - NPT_OFFSET;
}

/** The fixed "now" every generated row is relative to: 24 Sep 2026, 12:00 NPT. */
export const NOW = npt(2026, 9, 24, 12, 0);

/** First day of trading in the seed. */
export const STORE_LAUNCH = npt(2025, 9, 15, 0, 0);

export type NptParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday (Saturday is Nepal's weekend). */
  weekday: number;
};

export function nptParts(ms: number): NptParts {
  const date = new Date(ms + NPT_OFFSET);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    weekday: date.getUTCDay(),
  };
}

/** Midnight NPT of the day containing `ms`. */
export function nptStartOfDay(ms: number): number {
  const parts = nptParts(ms);
  return npt(parts.year, parts.month, parts.day);
}

/** Same Nepal calendar day as `ms`, at the given local time. */
export function atNptTime(ms: number, hour: number, minute = 0): number {
  return nptStartOfDay(ms) + hour * HOUR + minute * MINUTE;
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** `YYYY-MM-DD` of the Nepal calendar day. */
export function nptDate(ms: number): string {
  const { year, month, day } = nptParts(ms);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `YYMMDD` of the Nepal calendar day, used in order and tracking numbers. */
export function nptCompactDate(ms: number): string {
  return nptDate(ms).slice(2).replaceAll("-", "");
}

export function minutes(count: number): number {
  return count * MINUTE;
}
