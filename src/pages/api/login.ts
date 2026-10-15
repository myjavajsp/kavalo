import type { APIRoute } from 'astro';
import { json } from '../../middleware';
import { setAuthCookie, signSession, verifyPassword } from '../../lib/auth';

/** POST /api/login — verify the admin password and issue a session cookie. */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    if (!verifyPassword(password)) {
      return json({ ok: false, message: 'Invalid credentials' }, 401);
    }
    const token = signSession();
    setAuthCookie(cookies, token);
    return json({ ok: true }, 200);
  } catch {
    return json({ ok: false, message: 'Server error' }, 500);
  }
};
