/**
 * Global auth middleware.
 *
 * Protects:
 *   - every `/admin/*` page except `/admin/login`  → redirect to login
 *   - every `/api/articles*` endpoint                → 401 JSON
 * `/api/login` and `/api/logout` are intentionally public.
 *
 * On success we set `locals.auth = true` so downstream pages/endpoints can
 * trust the request is authenticated.
 */
import { defineMiddleware } from 'astro/middleware';
import { getAuthToken, verifySession } from './lib/auth';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, locals } = context;
  locals.auth = false;

  const path = url.pathname;

  // Permanent 301 redirects for consolidated / renamed articles (SEO hygiene).
  // When an article is merged into a canonical slug, keep the old slug alive here
  // so backlinks — and any lingering MySQL row — never 404.
  const PERMANENT_REDIRECTS: Record<string, string> = {
    '/blog/get-dog-to-drink-on-hot-walks': '/blog/how-to-get-small-dog-to-drink-hot-walks/',
  };
  const redirectTarget = PERMANENT_REDIRECTS[path.replace(/\/+$/, '')];
  if (redirectTarget) {
    return context.redirect(redirectTarget, 301);
  }

  const isAdminPage = path.startsWith('/admin') && path !== '/admin/login';
  const isArticlesApi = path.startsWith('/api/articles');

  if (isAdminPage || isArticlesApi) {
    const token = getAuthToken(cookies);
    const authorized = verifySession(token);
    if (authorized) {
      locals.auth = true;
    } else if (isArticlesApi) {
      return json({ ok: false, message: 'Unauthorized' }, 401);
    } else {
      // Page guard: send the browser to the login screen.
      return context.redirect('/admin/login');
    }
  }

  return next();
});

export { json };
