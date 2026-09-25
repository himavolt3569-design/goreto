import { STORE_TIMEZONE } from "./date-range";

/* Admin display formatting. Stored timestamps are UTC; staff see Kathmandu time. */

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: STORE_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: STORE_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const countFormat = new Intl.NumberFormat("en-IN");

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFormat.format(new Date(iso)) : "—";
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFormat.format(new Date(iso)) : "—";
}

/** Whole numbers with South Asian grouping, like money: 1,24,580. */
export function formatCount(value: number): string {
  return countFormat.format(value);
}

/** "12 min ago", "3 hours ago", "Yesterday", "5 days ago", then a date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** "Priya Shrestha" -> "Priya S." (as in the reference's Recent Orders). */
export function shortName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Guest";
  const [first, second] = parts;
  return second ? `${first} ${second.charAt(0).toUpperCase()}.` : first!;
}

/** "Asha Shrestha" -> "AS" for avatar fallbacks. */
export function initials(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.charAt(0) ?? "") + (parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "");
}

/** "+9779812345678" -> "+977 981-2345678"; other numbers unchanged. */
export function formatNepalPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const match = /^\+977(9\d{2})(\d{7})$/.exec(e164);
  return match ? `+977 ${match[1]}-${match[2]}` : e164;
}

/** Human label for snake_case enum values: "out_for_delivery" -> "Out for delivery". */
export function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
