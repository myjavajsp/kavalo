/**
 * Seed the database from the existing Markdown sources in src/content/blog.
 * Idempotent: re-running updates existing rows by slug (ON DUPLICATE KEY UPDATE).
 *
 * Run with: `npm run seed` (after migrate / after the DB container is healthy).
 * The .md files are intentionally kept in the repo as the seed data source.
 *
 * Limit scope for a safe, targeted re-sync:
 *   npm run seed -- --slug=foo
 *   npm run seed -- --slug=foo,bar
 *   npm run seed -- --slug=foo --slug=bar
 * When --slug is given, only the matching .md files are upserted, so unrelated
 * rows are never rewritten (e.g. posts edited out-of-band in the admin UI).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { parseArgs } from 'node:util';
import { pool } from '../src/lib/db';
import { upsertFromMarkdown } from '../src/lib/articles';

/** Build the slug allow-list from `--slug` flags (single, repeated, or comma-separated). */
function resolveSlugFilter(): Set<string> | null {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { slug: { type: 'string', multiple: true } },
    allowPositionals: true,
  });
  const raw = values.slug ?? [];
  const slugs = raw
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return slugs.length > 0 ? new Set(slugs) : null;
}

async function main(): Promise<void> {
  const slugFilter = resolveSlugFilter();
  const dir = path.resolve('src/content/blog');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md'));

  let count = 0;
  for (const file of files) {
    const slug = file.replace(/\.md$/i, '');
    if (slugFilter && !slugFilter.has(slug)) continue;
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const { data, content } = matter(raw);
    await upsertFromMarkdown({ slug, data, content });
    count += 1;
    console.log(`✓ ${slug}`);
  }

  if (slugFilter && count === 0) {
    console.warn(
      `⚠ No matching .md found for slug filter: ${[...slugFilter].join(', ')}`,
    );
  }
  const scope = slugFilter ? ` (filtered to ${[...slugFilter].join(', ')})` : '';
  console.log(`\nSeeded ${count} article(s)${scope}.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
