import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message = 'Access denied: Insufficient permissions') => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    throw badRequest(field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}

const emptyToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);

/** Optional number that tolerates form values ('' / null become undefined, numeric strings are coerced). */
export const optionalNumber = (schema: z.ZodNumber = z.number()) =>
  z.preprocess(emptyToUndefined, z.coerce.number().pipe(schema).optional());

/** Optional number where an explicit null / '' / 0 clears the value. */
export const clearableNumber = (schema: z.ZodNumber = z.number()) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === 0 || value === '0' ? null : value),
    z.union([z.null(), z.coerce.number().pipe(schema)]).optional()
  );

export const optionalString = (max = 500) =>
  z.preprocess((value) => (value === null ? undefined : value), z.string().trim().max(max).optional());

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Human-friendly sequential identifiers derived from row ids, e.g. ORD-0000123. */
export function formatNumber(prefix: 'ORD' | 'RCP' | 'CART', id: number): string {
  return `${prefix}-${String(id).padStart(7, '0')}`;
}
