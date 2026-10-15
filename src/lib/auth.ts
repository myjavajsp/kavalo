/**
 * Admin authentication: password check, signed session cookie, and helpers to
 * set/clear the cookie via Astro's `cookies` API. Uses only Node's built-in
 * `crypto` — no extra dependencies.
 *
 * Session token = base64url(payload) + '.' + HMAC-SHA256(payload, SESSION_SECRET)
 * with payload { iat, exp }. Tokens expire after 24h.
 */
import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';

const COOKIE_NAME = 'auth_token';
const SESSION_TTL_SECONDS = 24 * 60 * 60;

/** Fallback secret for local dev only; production must set SESSION_SECRET. */
function secret(): string {
  return process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me';
}

/** SHA-256 hex digest (constant-length, so timingSafeEqual never throws). */
function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time password comparison against ADMIN_PASSWORD. */
export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  const a = Buffer.from(sha256(input), 'utf8');
  const b = Buffer.from(sha256(expected), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function base64urlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64urlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', secret()).update(data, 'utf8').digest('base64url');
}

/** Create a signed session token with a 24h expiry. */
export function signSession(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + SESSION_TTL_SECONDS };
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const sig = hmac(payloadB64);
  return `${payloadB64}.${sig}`;
}

/** Verify a session token's signature and expiry. */
export function verifySession(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = hmac(payloadB64);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const payload = JSON.parse(base64urlDecode(payloadB64)) as {
      iat: number;
      exp: number;
    };
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

/** Read the auth token from an AstroCookies instance, if present. */
export function getAuthToken(cookies: AstroCookies): string | undefined {
  return cookies.get(COOKIE_NAME)?.value;
}

/** Issue the httpOnly session cookie. */
export function setAuthCookie(cookies: AstroCookies, token: string): void {
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    // `secure` over HTTPS only; in local http dev we keep it false so the
    // cookie is actually stored by the browser.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Clear the session cookie (logout). */
export function clearAuthCookie(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}
