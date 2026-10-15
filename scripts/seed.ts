/**
 * Seed the database from the existing Markdown sources in src/content/blog.
 * Idempotent: re-running updates existing rows by slug (ON DUPLICATE KEY UPDATE).
 *
 * Run with: `npm run seed` (after migrate / after the DB container is healthy).
 * The .md files are intentionally kept in the repo as the seed data source.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { pool } from '../src/lib/db';
import { upsertFromMarkdown } from '../src/lib/articles';

async function main(): Promise<void> {
  const dir = path.resolve('src/content/blog');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md'));

  let count = 0;
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const { data, content } = matter(raw);
    const slug = file.replace(/\.md$/i, '');
    await upsertFromMarkdown({ slug, data, content });
    count += 1;
    console.log(`✓ ${slug}`);
  }
  console.log(`\nSeeded ${count} article(s).`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
