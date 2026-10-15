import type { APIRoute } from 'astro';
import { json } from '../../middleware';
import {
  ArticleError,
  create,
  isValidCategory,
  listArticles,
} from '../../lib/articles';
import type { ArticleInput } from '../../lib/types';

/** Coerce arbitrary request JSON into an ArticleInput, with validation. */
function buildInput(body: Record<string, unknown>): {
  input?: ArticleInput;
  error?: { message: string; status: number };
} {
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug) {
    return { error: { message: 'slug is required', status: 400 } };
  }
  const category =
    typeof body.category === 'string' ? body.category.trim() : '';
  if (!isValidCategory(category)) {
    return { error: { message: 'invalid category', status: 400 } };
  }
  const tests = Array.isArray(body.tests)
    ? (body.tests as unknown[]).map(String)
    : typeof body.tests === 'string'
      ? body.tests
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  const input: ArticleInput = {
    slug,
    title: typeof body.title === 'string' ? body.title : '',
    category,
    image: typeof body.image === 'string' ? body.image : '',
    description: typeof body.description === 'string' ? body.description : '',
    body: typeof body.body === 'string' ? body.body : '',
    readTime: typeof body.readTime === 'string' ? body.readTime : '',
    tests,
    pubDate: body.pubDate ? new Date(String(body.pubDate)) : new Date(),
    published: body.published === undefined ? true : Boolean(body.published),
  };
  return { input };
}

/** GET /api/articles — filtered + paginated list for the admin UI. */
export const GET: APIRoute = async ({ url }) => {
  try {
    const category = url.searchParams.get('category') || undefined;
    const q = url.searchParams.get('q') || undefined;
    const status = (url.searchParams.get('status') || 'published') as
      | 'published'
      | 'draft'
      | 'all';
    const page = Number(url.searchParams.get('page') || '1');
    const pageSize = Number(url.searchParams.get('pageSize') || '20');
    const result = await listArticles({
      category,
      q,
      status,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    });
    return json({ ok: true, data: { ...result } }, 200);
  } catch {
    return json({ ok: false, message: 'Server error' }, 500);
  }
};

/** POST /api/articles — create a new article. */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = buildInput(body);
    if (error) return json({ ok: false, message: error.message }, error.status);

    const entry = await create(input);
    return json({ ok: true, data: entry }, 201);
  } catch (err) {
    if (err instanceof ArticleError && err.code === 'CONFLICT') {
      return json({ ok: false, message: 'slug already exists' }, 409);
    }
    return json({ ok: false, message: 'Server error' }, 500);
  }
};
