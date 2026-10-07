export type Row = Record<string, any>;
export type SqlParam = string | number | null | boolean | undefined;

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

export interface Queryable {
  all<T = Row>(sql: string, params?: SqlParam[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: SqlParam[]): Promise<T | undefined>;
  run(sql: string, params?: SqlParam[]): Promise<RunResult>;
}

export interface Database extends Queryable {
  readonly kind: 'sqljs' | 'libsql';
  /** False when data lives on instance-local storage that is discarded on restart. */
  readonly durable: boolean;
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

export function normalizeParams(params: SqlParam[] = []): Array<string | number | null> {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}
