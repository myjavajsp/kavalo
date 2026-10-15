/**
 * Apply scripts/schema.sql to the configured MySQL database.
 * Used for non-Docker setups; in Docker the same file is mounted into
 * /docker-entrypoint-initdb.d and runs automatically on first start.
 *
 * Run with: `npm run migrate` (after copying .env from .env.example).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/lib/db';

async function main(): Promise<void> {
  const sqlPath = path.resolve('scripts/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  // Split into individual statements (schema.sql has no embedded semicolons).
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const conn = await pool.getConnection();
  try {
    for (const stmt of statements) {
      await conn.query(stmt);
      console.log(`✓ ${stmt.slice(0, 70).replace(/\s+/g, ' ')}`);
    }
    console.log(`\nApplied ${statements.length} statement(s).`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
