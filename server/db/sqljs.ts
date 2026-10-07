import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { Database, Queryable, Row, RunResult, SqlParam, normalizeParams } from './types.js';

function loadWasm(): ArrayBuffer | undefined {
  const candidates: string[] = [];
  try {
    candidates.push(createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm'));
  } catch {
    // Bundled environments may not support require.resolve; fall back to cwd.
  }
  candidates.push(path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const buffer = fs.readFileSync(candidate);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    }
  }
  return undefined;
}

/**
 * sql.js keeps the whole database in memory. Writes are persisted by exporting
 * the full image to `filePath` (skipped for ':memory:').
 */
export async function openSqlJs(filePath: string, durable: boolean): Promise<Database> {
  const wasmBinary = loadWasm();
  const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : undefined);
  const inMemory = filePath === ':memory:';

  const raw: SqlJsDatabase =
    !inMemory && fs.existsSync(filePath) ? new SQL.Database(fs.readFileSync(filePath)) : new SQL.Database();

  // export() closes and reopens the database, which resets pragmas.
  const applyPragmas = () => raw.run('PRAGMA foreign_keys = ON');
  applyPragmas();

  const persist = () => {
    if (inMemory) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(raw.export()));
    applyPragmas();
  };

  const all = <T = Row>(sql: string, params?: SqlParam[]): T[] => {
    const stmt = raw.prepare(sql);
    try {
      stmt.bind(normalizeParams(params));
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };

  const run = (sql: string, params?: SqlParam[]): RunResult => {
    raw.run(sql, normalizeParams(params));
    const changes = raw.getRowsModified();
    const res = raw.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = Number(res[0]?.values[0]?.[0] ?? 0);
    return { lastInsertRowid, changes };
  };

  // Single connection: serialize writes so a transaction never interleaves with other requests' writes.
  let lock: Promise<unknown> = Promise.resolve();
  const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = lock.then(fn, fn);
    lock = next.catch(() => undefined);
    return next;
  };

  const txHandle: Queryable = {
    all: async <T = Row>(sql: string, params?: SqlParam[]) => all<T>(sql, params),
    get: async <T = Row>(sql: string, params?: SqlParam[]) => all<T>(sql, params)[0],
    run: async (sql, params) => run(sql, params),
  };

  return {
    kind: 'sqljs',
    durable: durable && !inMemory,
    all: async <T = Row>(sql: string, params?: SqlParam[]) => all<T>(sql, params),
    get: async <T = Row>(sql: string, params?: SqlParam[]) => all<T>(sql, params)[0],
    run: (sql, params) =>
      withLock(async () => {
        const result = run(sql, params);
        persist();
        return result;
      }),
    transaction: (fn) =>
      withLock(async () => {
        raw.run('BEGIN');
        try {
          const result = await fn(txHandle);
          raw.run('COMMIT');
          persist();
          return result;
        } catch (err) {
          raw.run('ROLLBACK');
          throw err;
        }
      }),
  };
}
