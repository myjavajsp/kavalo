import type { APIRoute } from 'astro';
import { json } from '../../../middleware';
import {
  ArticleError,
  getBySlug,
  isValidCategory,
  remove,
  update,
} from '../../../lib/articles';
import type { ArticleInput } from '../../../lib/types';

/** GET /api/articles/[slug] — fetch one article (full, incl. unpublished). */
export const GET: APIRoute = async ({ params }) => {
  try {
    const slug = params.slug ?? '';
    const entry = await getBySlug(slug, true);
    if (!entry) return json({ ok: false, message: 'Not found' }, 404);
    return json({ ok: true, data: entry }, 200);
  } catch {
    return json({ ok: false, message: 'Server error' }, 500);
  }
};

/** PUT /api/articles/[slug] — update (partial) an existing article. */
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const slug = params.slug ?? '';
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Partial<ArticleInput> = {};
    if (typeof body.slug === 'string') patch.slug = body.slug.trim();
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.category === 'string') {
      if (!isValidCategory(body.category.trim())) {
        return json({ ok: false, message: 'invalid category' }, 400);
      }
      patch.category = body.category.trim();
    }
    if (typeof body.image === 'string') patch.image = body.image;
    if (typeof body.description === 'string') patch.description = body.description;
    if (typeof body.body === 'string') patch.body = body.body;
    if (typeof body.readTime === 'string') patch.readTime = body.readTime;
    if (body.tests !== undefined) {
      patch.tests = Array.isArray(body.tests)
        ? (body.tests as unknown[]).map(String)
        : typeof body.tests === 'string'
          ? body.tests.split(',').map((t) => t.trim()).filter(Boolean)
          : [];
    }
    if (body.pubDate !== undefined) patch.pubDate = new Date(String(body.pubDate));
    if (body.published !== undefined) patch.published = Boolean(body.published);

    const entry = await update(slug, patch);
    return json({ ok: true, data: entry }, 200);
  } catch (err) {
    if (err instanceof ArticleError && err.code === 'NOT_FOUND') {
      return json({ ok: false, message: 'Not found' }, 404);
    }
    if (err instanceof ArticleError && err.code === 'CONFLICT') {
      return json({ ok: false, message: 'slug already exists' }, 409);
    }
    return json({ ok: false, message: 'Server error' }, 500);
  }
};

/** DELETE /api/articles/[slug] — remove an article. */
export const DELETE: APIRoute = async ({ params }) => {
  try {
    const slug = params.slug ?? '';
    await remove(slug);
    return json({ ok: true }, 200);
  } catch {
    return json({ ok: false, message: 'Server error' }, 500);
  }
};
