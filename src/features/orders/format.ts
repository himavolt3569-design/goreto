/*
 * Customer-facing dates in Nepal time (AGENTS §15.2), in the reference's
 * style: "18 Mar 2025, 10:24 AM".
 */

const TIMEZONE = "Asia/Kathmandu";

// en-US parts in day-month-year order: "18 Mar 2025" (en-GB would print "Sept").
function dayMonth(timeZone: string, withYear: boolean) {
  const format = new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  return {
    format(date: Date): string {
      const parts = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
      return withYear ? `${parts.day} ${parts.month} ${parts.year}` : `${parts.day} ${parts.month}`;
    },
  };
}

const dayFormat = dayMonth(TIMEZONE, true);
const shortDayFormat = dayMonth(TIMEZONE, false);
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });
// Calendar dates (YYYY-MM-DD) are already Nepal days; format them without shifting.
const calendarFormat = dayMonth("UTC", true);
const calendarShortFormat = dayMonth("UTC", false);

export function formatOrderDateTime(iso: string): string {
  const date = new Date(iso);
  return `${dayFormat.format(date)}, ${timeFormat.format(date)}`;
}

/** "18 Mar 2025" for a timestamp, in Nepal time. */
export function formatNepalDate(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** "18 Mar, 10:24 AM" for stepper labels. */
export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  return `${shortDayFormat.format(date)}, ${timeFormat.format(date)}`;
}

function calendarDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** "21 Mar 2025". */
export function formatCalendarDate(day: string): string {
  return calendarFormat.format(calendarDate(day));
}

/** "21 Mar 2025 – 23 Mar 2025", or one date when both are the same. */
export function formatCalendarRange(from: string, to: string): string {
  return from === to ? formatCalendarDate(from) : `${formatCalendarDate(from)} – ${formatCalendarDate(to)}`;
}

/** "21 Mar" or "21 Mar – 23 Mar" for compact stepper hints. */
export function formatShortCalendarRange(from: string, to: string): string {
  const start = calendarShortFormat.format(calendarDate(from));
  return from === to ? start : `${start} – ${calendarShortFormat.format(calendarDate(to))}`;
}
