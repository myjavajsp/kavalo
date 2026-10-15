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
