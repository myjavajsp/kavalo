import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { listAll } from '../lib/articles';
import { SITE } from '../site';

export async function GET(context: APIContext) {
  const posts = (await listAll(false)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.pubDate,
      description: p.data.description,
      link: `/blog/${p.slug}/`,
    })),
  });
}
