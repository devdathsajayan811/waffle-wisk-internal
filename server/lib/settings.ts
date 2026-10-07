import type { Queryable } from '../db/index.js';
import { isValidTimeZone } from './time.js';

export async function getBusinessTimeZone(q: Queryable): Promise<string> {
  const row = await q.get<{ timezone: string | null }>('SELECT timezone FROM business_settings WHERE id = 1');
  const timeZone = row?.timezone ?? 'Asia/Kolkata';
  return isValidTimeZone(timeZone) ? timeZone : 'Asia/Kolkata';
}
