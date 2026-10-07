import { config } from '../config.js';
import { openLibsql } from './libsql.js';
import { runMigrations } from './migrations.js';
import { seed } from './seed.js';
import { openSqlJs } from './sqljs.js';
import { Database, Queryable, Row, SqlParam } from './types.js';

export type { Database, Queryable, Row, SqlParam } from './types.js';

let ready: Promise<Database> | null = null;

async function open(): Promise<Database> {
  const database = config.tursoUrl
    ? await openLibsql(config.tursoUrl, config.tursoAuthToken)
    : await openSqlJs(config.databasePath, !config.isVercel);

  if (!database.durable && config.databasePath !== ':memory:') {
    console.error(
      'WARNING: the database is on instance-local storage and will be lost when this serverless instance recycles. Set TURSO_DATABASE_URL.'
    );
  }

  await runMigrations(database);
  await seed(database);
  return database;
}

/** Opens, migrates and seeds the database once per process. */
export function getDatabase(): Promise<Database> {
  if (!ready) {
    ready = open().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export const db: Queryable & Pick<Database, 'transaction'> = {
  all: async <T = Row>(sql: string, params?: SqlParam[]) => (await getDatabase()).all<T>(sql, params),
  get: async <T = Row>(sql: string, params?: SqlParam[]) => (await getDatabase()).get<T>(sql, params),
  run: async (sql, params) => (await getDatabase()).run(sql, params),
  transaction: async (fn) => (await getDatabase()).transaction(fn),
};
