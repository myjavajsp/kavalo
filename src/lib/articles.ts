/**
 * Article data-access layer. Everything the rest of the app needs to read and
 * mutate articles lives here — pages, the admin API, and the seed script all go
 * through these functions so the SQL stays in one place.
 */
import mysql from 'mysql2/promise';
import { CATEGORIES } from '../site';
import { execute, query, type ArticleRow } from './db';
import type { ArticleData, ArticleEntry, ArticleInput } from './types';

/** Domain error with a machine-readable code the API layer maps to HTTP. */
export class ArticleError extends Error {
  constructor(
    public readonly code: 'CONFLICT' | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'ArticleError';
  }
}

/** Source object produced when reading a Markdown file during seeding. */
export interface MarkdownSource {
  slug: string;
  data: Record<string, unknown>;
  content: string;
}

/** Query parameters for the admin list endpoint. */
export interface ListQuery {
  category?: string;
  q?: string;
  status?: 'published' | 'draft' | 'all';
  page?: number;
  pageSize?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** mysql2 returns JSON columns as a string; parse safely and default to []. */
function parseTests(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Coerce a Date, ISO string, or `YYYY-MM-DD` to a JS Date (UTC midnight-ish). */
function toSqlDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.length > 0) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Normalise any incoming value to a boolean. */
function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (typeof value === 'number') return value === 1;
  return false;
}

/** Map a raw DB row to the public `ArticleEntry` shape. */
function rowToEntry(row: ArticleRow): ArticleEntry {
  const data: ArticleData = {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    category: row.category,
    image: row.image ?? '',
    description: row.description ?? '',
    body: row.body,
    readTime: row.read_time ?? '',
    tests: parseTests(row.tests),
    pubDate: row.pub_date,
    published: row.published === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return { slug: row.slug, data };
}

/** Detect a MySQL unique-violation error. */
function isDuplicateError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}

/** Build the `ArticleInput` that fully describes an existing row. */
function dataToInput(data: ArticleData): ArticleInput {
  return {
    slug: data.slug,
    title: data.title,
    category: data.category,
    image: data.image,
    description: data.description,
    body: data.body,
    readTime: data.readTime,
    tests: data.tests,
    pubDate: data.pubDate,
    published: data.published,
  };
}

/** Drop `undefined` keys so partial updates don't clobber existing values. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/** Column list used by both INSERT and UPSERT. */
const COLUMNS = [
  'slug',
  'title',
  'category',
  'image',
  'description',
  'body',
  'read_time',
  'tests',
  'pub_date',
  'published',
] as const;

/** Bind values for an `ArticleInput`. */
function bindValues(input: ArticleInput): unknown[] {
  return [
    input.slug,
    input.title,
    input.category,
    input.image ?? null,
    input.description ?? null,
    input.body,
    input.readTime ?? null,
    JSON.stringify(input.tests ?? []),
    toSqlDate(input.pubDate),
    input.published ? 1 : 0,
  ];
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** Fetch a single article by slug. Unpublished only when explicitly asked. */
export async function getBySlug(
  slug: string,
  includeUnpublished = false,
): Promise<ArticleEntry | null> {
  const where = includeUnpublished ? '' : 'AND published = 1';
  const rows = await query<ArticleRow[]>(
    `SELECT * FROM articles WHERE slug = ? ${where} LIMIT 1`,
    [slug],
  );
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

/** Fetch all articles in a category, newest first. */
export async function listByCategory(
  category: string,
  includeUnpublished = false,
): Promise<ArticleEntry[]> {
  const where = includeUnpublished ? '' : 'AND published = 1';
  const rows = await query<ArticleRow[]>(
    `SELECT * FROM articles WHERE category = ? ${where} ORDER BY pub_date DESC`,
    [category],
  );
  return rows.map(rowToEntry);
}

/** Fetch every article, newest first (used by index, hub, RSS, sitemap). */
export async function listAll(includeUnpublished = false): Promise<ArticleEntry[]> {
  const where = includeUnpublished ? '' : 'WHERE published = 1';
  const rows = await query<ArticleRow[]>(
    `SELECT * FROM articles ${where} ORDER BY pub_date DESC`,
  );
  return rows.map(rowToEntry);
}

/** Fetch the N most recent published articles. */
export async function listLatest(limit: number): Promise<ArticleEntry[]> {
  const rows = await query<ArticleRow[]>(
    `SELECT * FROM articles WHERE published = 1 ORDER BY pub_date DESC LIMIT ?`,
    [Math.max(0, limit)],
  );
  return rows.map(rowToEntry);
}

/** Filtered / paginated list for the admin UI. */
export async function listArticles(
  opts: ListQuery = {},
): Promise<{ items: ArticleEntry[]; total: number }> {
  const status = opts.status ?? 'published';
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status === 'published') clauses.push('published = 1');
  else if (status === 'draft') clauses.push('published = 0');
  if (opts.category) {
    clauses.push('category = ?');
    params.push(opts.category);
  }
  if (opts.q) {
    clauses.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const totalRows = await query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM articles ${whereSql}`,
    params,
  );
  const total = Number(totalRows[0]?.total ?? 0);

  const offset = (page - 1) * pageSize;
  const rows = await query<ArticleRow[]>(
    `SELECT * FROM articles ${whereSql} ORDER BY pub_date DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  return { items: rows.map(rowToEntry), total };
}

// ── Writes ─────────────────────────────────────────────────────────────────

/** Insert a new article. Throws `ArticleError('CONFLICT')` on duplicate slug. */
export async function create(input: ArticleInput): Promise<ArticleEntry> {
  try {
    await execute(
      `INSERT INTO articles (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`,
      bindValues(input),
    );
  } catch (err) {
    if (isDuplicateError(err)) {
      throw new ArticleError('CONFLICT', 'slug already exists');
    }
    throw err;
  }
  const created = await getBySlug(input.slug, true);
  if (!created) throw new ArticleError('NOT_FOUND', 'created article not found');
  return created;
}

/** Update an existing article by slug (partial merge). */
export async function update(
  slug: string,
  patch: Partial<ArticleInput>,
): Promise<ArticleEntry> {
  const existing = await getBySlug(slug, true);
  if (!existing) throw new ArticleError('NOT_FOUND', 'article not found');

  const merged: ArticleInput = { ...dataToInput(existing.data), ...stripUndefined(patch) };

  try {
    await execute(
      `UPDATE articles SET
         slug = ?, title = ?, category = ?, image = ?, description = ?,
         body = ?, read_time = ?, tests = ?, pub_date = ?, published = ?
       WHERE slug = ?`,
      [...bindValues(merged), slug],
    );
  } catch (err) {
    if (isDuplicateError(err)) {
      throw new ArticleError('CONFLICT', 'slug already exists');
    }
    throw err;
  }
  const updated = await getBySlug(merged.slug, true);
  if (!updated) throw new ArticleError('NOT_FOUND', 'updated article not found');
  return updated;
}

/** Delete an article by slug. */
export async function remove(slug: string): Promise<void> {
  await execute(`DELETE FROM articles WHERE slug = ?`, [slug]);
}

/**
 * Idempotent insert-or-update used by the seed script. Parses the Markdown
 * frontmatter shape (strings / arrays) into the DB column types.
 */
export async function upsertFromMarkdown(md: MarkdownSource): Promise<void> {
  const title = String(md.data.title ?? md.slug);
  const category = String(md.data.category ?? '');
  const image = md.data.image ? String(md.data.image) : null;
  const description = md.data.description ? String(md.data.description) : '';
  const body = md.content;
  const readTime = md.data.readTime ? String(md.data.readTime) : null;
  const tests = Array.isArray(md.data.tests) ? (md.data.tests as unknown[]) : [];
  const pubDate = toSqlDate(md.data.pubDate);
  const published = md.data.published === undefined ? 1 : toBool(md.data.published) ? 1 : 0;

  const colList = COLUMNS.join(', ');
  const placeholders = COLUMNS.map(() => '?').join(', ');
  const updateList = COLUMNS.map((c) => `${c} = VALUES(${c})`).join(', ');

  await execute(
    `INSERT INTO articles (${colList}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updateList}`,
    [
      md.slug,
      title,
      category,
      image,
      description,
      body,
      readTime,
      JSON.stringify(tests),
      pubDate,
      published,
    ],
  );
}

// ── Category mapping ───────────────────────────────────────────────────────

/** Map a URL category slug (e.g. "backpack-carrier") to its label. */
export function categorySlugToLabel(slug: string): string | null {
  const found = CATEGORIES.find((c) => c.slug === slug);
  return found ? found.label : null;
}

/** The 6 allowed categories (labels), used for validation. */
export const CATEGORY_LABELS: string[] = CATEGORIES.map((c) => c.label);

/** Validate that a category string is one of the 6 known labels. */
export function isValidCategory(category: string): boolean {
  return CATEGORY_LABELS.includes(category);
}
