import type { Client, InStatement, ResultSet, Transaction } from '@libsql/client';
import { Database, Queryable, Row, SqlParam, normalizeParams } from './types.js';

function toRows<T>(rs: ResultSet): T[] {
  return rs.rows.map((row) => {
    const obj: Row = {};
    rs.columns.forEach((column, i) => {
      const value = row[i];
      obj[column] = typeof value === 'bigint' ? Number(value) : value;
    });
    return obj as T;
  });
}

function statement(sql: string, params?: SqlParam[]): InStatement {
  return { sql, args: normalizeParams(params) };
}

function queryable(executor: Client | Transaction): Queryable {
  return {
    all: async <T = Row>(sql: string, params?: SqlParam[]) => toRows<T>(await executor.execute(statement(sql, params))),
    get: async <T = Row>(sql: string, params?: SqlParam[]) =>
      toRows<T>(await executor.execute(statement(sql, params)))[0],
    run: async (sql, params) => {
      const rs = await executor.execute(statement(sql, params));
      return { lastInsertRowid: Number(rs.lastInsertRowid ?? 0), changes: rs.rowsAffected };
    },
  };
}

/** Turso / libSQL. Remote URLs use the fetch-based client so no native binary is needed on Vercel. */
export async function openLibsql(url: string, authToken?: string): Promise<Database> {
  const { createClient } = url.startsWith('file:')
    ? await import('@libsql/client')
    : await import('@libsql/client/web');
  const client = createClient({ url, authToken });
  await client.execute('PRAGMA foreign_keys = ON');

  const base = queryable(client);
  return {
    kind: 'libsql',
    durable: true,
    ...base,
    transaction: async (fn) => {
      const tx = await client.transaction('write');
      try {
        const result = await fn(queryable(tx));
        await tx.commit();
        return result;
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.close();
      }
    },
  };
}
