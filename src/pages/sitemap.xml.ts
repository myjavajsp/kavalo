import type { APIContext } from 'astro';
import { listAll } from '../lib/articles';
import { CATEGORIES } from '../site';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Custom sitemap: static routes + every published article slug from the DB.
 * Replaces @astrojs/sitemap, which can't discover SSR dynamic routes.
 */
export async function GET(context: APIContext) {
  const base = (
    process.env.SITE_URL ||
    context.site?.toString() ||
    'https://kavalo.top'
  ).replace(/\/$/, '');

  const staticRoutes = [
    '/',
    '/blog/',
    '/corgi/gear/',
    '/how-we-test/',
    '/affiliate-disclosure/',
    '/privacy-policy/',
    '/returns-and-refunds/',
    ...CATEGORIES.map((c) => `/blog/category/${c.slug}/`),
  ];

  const posts = await listAll(false);
  const articleRoutes = posts.map((p) => `/blog/${p.slug}/`);

  const urls = [...staticRoutes, ...articleRoutes];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(`${base}${u}`)}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
