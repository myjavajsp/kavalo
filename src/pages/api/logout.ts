import type { APIRoute } from 'astro';
import { json } from '../../middleware';
import { clearAuthCookie } from '../../lib/auth';

/** POST /api/logout — clear the session cookie. */
export const POST: APIRoute = async ({ cookies }) => {
  clearAuthCookie(cookies);
  return json({ ok: true }, 200);
};
