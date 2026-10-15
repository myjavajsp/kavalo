/**
 * Runtime Markdown rendering.
 *
 * Replaces the old content-collections `post.render()` so we can render article
 * bodies fetched from MySQL on the fly. We use `marked` with a custom heading
 * renderer that injects `id`s via `github-slugger` — the same algorithm
 * `rehype-slug` used — so existing TOC anchors keep working without changes.
 */
import { Marked, Renderer } from 'marked';
import GithubSlugger from 'github-slugger';
import type { RenderResult, TocItem } from './types';

/** Strip the most common Markdown markers so a heading slug/text reads clean. */
function plainText(input: string): string {
  return input
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/^#+\s*/g, '')
    .trim();
}

// A fresh slugger + renderer per render keeps slug de-duplication scoped to a
// single document (avoids cross-article "slug-1" bleed) and avoids shared
// mutable state across concurrent requests.
function buildRenderer(slugger: GithubSlugger, toc: TocItem[]): Renderer {
  const renderer = new Renderer();
  // Defensive signature handles both marked v11 (string args) and v12+
  // (token object) so the dependency version can float within the major.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer.heading = function (this: any, arg1: any, level?: number): string {
    let depth: number;
    let rawText: string;
    let inlineTokens: unknown[] | undefined;
    if (arg1 && typeof arg1 === 'object') {
      // marked >= 12 token shape
      depth = arg1.depth;
      rawText = arg1.text;
      inlineTokens = arg1.tokens;
    } else {
      // marked <= 11 string shape
      rawText = String(arg1);
      depth = level ?? 2;
    }
    const text = inlineTokens
      ? this.parser.parseInline(inlineTokens)
      : rawText;
    const clean = plainText(rawText);
    const slug = slugger.slug(clean);
    if (depth === 2 || depth === 3) {
      toc.push({ depth: depth as 2 | 3, slug, text: clean });
    }
    return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
  } as unknown as Renderer['heading'];
  return renderer;
}

/** Render Markdown to HTML and extract an h2/h3 table of contents. */
export function renderMarkdown(body: string): RenderResult {
  const slugger = new GithubSlugger();
  const toc: TocItem[] = [];
  const renderer = buildRenderer(slugger, toc);
  const marked = new Marked({ renderer, gfm: true, breaks: false });
  const html = marked.parse(body ?? '') as string;
  return { html, toc };
}
