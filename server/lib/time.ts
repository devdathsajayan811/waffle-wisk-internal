import type { SqlParam } from '../db/types.js';

/**
 * Timestamps are stored in UTC using SQLite's canonical `YYYY-MM-DD HH:MM:SS`
 * format (what CURRENT_TIMESTAMP produces), so string comparison orders them
 * correctly. Day boundaries ("today", custom date ranges) are computed in the
 * business timezone and converted back to UTC.
 */

const DB_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function toDbTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** Converts a stored UTC timestamp to ISO-8601 with an explicit Z so clients parse it as UTC. */
export function dbTimestampToIso(value: string): string {
  return DB_TIMESTAMP.test(value) ? `${value.replace(' ', 'T')}Z` : value;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds (positive east of UTC). */
function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallClockAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight for the given calendar date in `timeZone`. */
function localMidnightUtc(year: number, monthIndex: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, monthIndex, day);
  const firstPass = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(firstPass), timeZone));
}

function localDateParts(date: Date, timeZone: string) {
  const local = new Date(date.getTime() + offsetMs(date, timeZone));
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

/** Start of the business day `daysAgo` days before `now`. */
export function startOfBusinessDay(timeZone: string, daysAgo = 0, now = new Date()): Date {
  const { year, month, day } = localDateParts(now, timeZone);
  return localMidnightUtc(year, month, day - daysAgo, timeZone);
}

/** SQLite date modifier (e.g. '+330 minutes') that shifts UTC timestamps into the business timezone. */
export function sqliteOffsetModifier(timeZone: string, now = new Date()): string {
  const minutes = Math.round(offsetMs(now, timeZone) / 60000);
  return `${minutes >= 0 ? '+' : ''}${minutes} minutes`;
}

export type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all';

export interface ResolvedRange {
  from?: string;
  to?: string;
}

/**
 * Resolves a named range or a custom `YYYY-MM-DD` start/end pair (inclusive, in
 * the business timezone) into UTC bounds: `from <= created_at < to`.
 */
export function resolveDateRange(
  timeZone: string,
  options: { range?: DateRange; startDate?: string; endDate?: string },
  now = new Date()
): ResolvedRange {
  const { range, startDate, endDate } = options;
  switch (range) {
    case 'today':
      return { from: toDbTimestamp(startOfBusinessDay(timeZone, 0, now)) };
    case 'yesterday':
      return {
        from: toDbTimestamp(startOfBusinessDay(timeZone, 1, now)),
        to: toDbTimestamp(startOfBusinessDay(timeZone, 0, now)),
      };
    case '7days':
      return { from: toDbTimestamp(startOfBusinessDay(timeZone, 6, now)) };
    case '30days':
      return { from: toDbTimestamp(startOfBusinessDay(timeZone, 29, now)) };
    case 'all':
      return {};
  }

  const parse = (value: string) => value.split('-').map(Number) as [number, number, number];
  const result: ResolvedRange = {};
  if (startDate) {
    const [y, m, d] = parse(startDate);
    result.from = toDbTimestamp(localMidnightUtc(y, m - 1, d, timeZone));
  }
  if (endDate) {
    const [y, m, d] = parse(endDate);
    result.to = toDbTimestamp(localMidnightUtc(y, m - 1, d + 1, timeZone));
  }
  return result;
}

/** Appends `AND column >= ? AND column < ?` for the resolved range. */
export function rangeClause(column: string, range: ResolvedRange, params: SqlParam[]): string {
  let sql = '';
  if (range.from) {
    sql += ` AND ${column} >= ?`;
    params.push(range.from);
  }
  if (range.to) {
    sql += ` AND ${column} < ?`;
    params.push(range.to);
  }
  return sql;
}
