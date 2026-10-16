/**
 * MySQL connection pool singleton.
 *
 * The pool is created lazily and attached to `globalThis` so that Astro's SSR
 * dev server (which reloads modules on every request in some setups) does not
 * open a new pool on each reload. No connection is opened at import time, so the
 * build step never touches the database.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

/** Shape of a raw row from the `articles` table. */
export interface ArticleRow extends mysql.RowDataPacket {
  id: number;
  slug: string;
  title: string;
  category: string;
  image: string | null;
  description: string | null;
  body: string;
  read_time: string | null;
  tests: string | null;
  pub_date: Date;
  published: number;
  ai_assisted: number;
  ai_provider: string | null;
  affiliate: number;
  created_at: Date;
  updated_at: Date;
}

/** Global cache so the pool survives module reloads (HMR / SSR). */
const globalForDb = globalThis as unknown as {
  __kavaloPool?: mysql.Pool;
};

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'kavalo',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });
}

export const pool: mysql.Pool = globalForDb.__kavaloPool ?? createPool();

// Only cache in non-production to avoid leaking state across isolates.
if (process.env.NODE_ENV !== 'production') {
  globalForDb.__kavaloPool = pool;
}

/**
 * Run a SELECT-style query and return the rows.
 * @param sql  SQL with `?` placeholders.
 * @param params  Bound parameters.
 */
export async function query<T extends mysql.RowDataPacket[] = mysql.RowDataPacket[]>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

/**
 * Run an INSERT / UPDATE / DELETE statement.
 * @returns the result header (includes `insertId`, `affectedRows`, …).
 */
export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}
