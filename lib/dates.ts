// Small date helpers for the calendar grid. No library — date math here is
// simple (day-granularity, no timezones beyond local) so it's not worth a
// dependency.

import type { DateRange } from "./reservations";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Format a Date as YYYY-MM-DD (local). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string as a local Date (midnight). */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const start = addDays(d, diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** All dates in [start, end) as YYYY-MM-DD strings. */
export function datesInRange(range: DateRange): string[] {
  const out: string[] = [];
  let cur = fromISODate(range.start);
  const end = fromISODate(range.end);
  while (cur < end) {
    out.push(toISODate(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

/** A 7-day range starting at the Monday of the week containing `anchor`. */
export function weekRange(anchor: Date): DateRange {
  const start = startOfWeek(anchor);
  return { start: toISODate(start), end: toISODate(addDays(start, 7)) };
}

export function formatDayLabel(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
