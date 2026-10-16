/**
 * Apply scripts/schema.sql to the configured MySQL server.
 *
 * This script intentionally connects WITHOUT a default database so it can run
 * `CREATE DATABASE` first (schemas that boot-strap an empty server). The app's
 * runtime pool (src/lib/db.ts) always selects the database, so it must already
 * exist — migrate.ts is what brings it into being.
 *
 * Run with: `npm run migrate` (after copying .env from .env.example).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

async function main(): Promise<void> {
  const sqlPath = path.resolve('scripts/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  // Split into individual statements (schema.sql has no embedded semicolons).
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    charset: 'utf8mb4',
  });

  const conn = await pool.getConnection();
  try {
    for (const stmt of statements) {
      await conn.query(stmt);
      console.log(`✓ ${stmt.slice(0, 70).replace(/\s+/g, ' ')}`);
    }

    // Idempotent R1 upgrade: add AI-label columns to the existing `articles`
    // table only if they are missing (production DB predates these columns).
    const aiColumns = [
      { name: 'ai_assisted', def: 'TINYINT(1) NOT NULL DEFAULT 0' },
      { name: 'ai_provider', def: 'VARCHAR(128) DEFAULT NULL' },
      { name: 'affiliate', def: 'TINYINT(1) NOT NULL DEFAULT 0' },
    ];
    for (const col of aiColumns) {
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = 'kavalo' AND TABLE_NAME = 'articles' AND COLUMN_NAME = ?`,
        [col.name],
      );
      if (rows.length === 0) {
        await conn.query(
          `ALTER TABLE kavalo.articles ADD COLUMN ${col.name} ${col.def}`,
        );
        console.log(`✓ added column articles.${col.name}`);
      } else {
        console.log(`• column articles.${col.name} already present`);
      }
    }

    console.log(`\nApplied ${statements.length} statement(s).`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
