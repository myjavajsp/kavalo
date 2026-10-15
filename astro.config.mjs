import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
// SSR + standalone Node adapter. Articles are served dynamically from MySQL,
// so we drop the static sitemap integration and emit our own sitemap.xml.ts.
export default defineConfig({
  site: 'https://kavalo.top',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // The standalone server reads PORT at runtime; fall back to 4321 locally.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 4321,
    host: true,
  },
  // Markdown is rendered at runtime via marked + github-slugger (see src/lib/markdown.ts),
  // keeping heading anchors identical to the old rehype-slug output.
  markdown: {
    rehypePlugins: [],
  },
});
