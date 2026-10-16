/**
 * JSON-LD structured-data builders for GEO.
 *
 * Every value comes from real site config (ORG / PERSON in site.ts) or real
 * article data — nothing is invented. Where a real value is not yet known
 * (author name, social profiles), the field is omitted or gated behind a
 * config flag, so no placeholder ever ships as if it were fact.
 */
import type { ArticleEntry } from './types';
import { ORG, PERSON } from '../site';

export interface Faq {
  q: string;
  a: string;
}

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

/** Full Organization node — self-contained, stable @id across the whole site. */
export function organizationNode(siteUrl: string) {
  const base = trimSlash(siteUrl);
  const id = `${base}/#organization`;
  return {
    '@type': 'Organization',
    '@id': id,
    name: ORG.name,
    url: `${base}/`,
    logo: { '@type': 'ImageObject', '@id': id, url: ORG.logo },
    email: ORG.email,
    description: ORG.description,
    ...(ORG.sameAs.length > 0 ? { sameAs: ORG.sameAs } : {}),
  };
}

/** Author node: named Person once configured, else a reference to the Organization. */
export function authorNode(siteUrl: string) {
  const base = trimSlash(siteUrl);
  if (PERSON.name && PERSON.name.trim().length > 0) {
    return {
      '@type': 'Person',
      '@id': `${base}/#person`,
      name: PERSON.name,
      ...(PERSON.jobTitle ? { jobTitle: PERSON.jobTitle } : {}),
      ...(PERSON.description ? { description: PERSON.description } : {}),
      ...(PERSON.url ? { url: PERSON.url } : {}),
      ...(PERSON.sameAs.length > 0 ? { sameAs: PERSON.sameAs } : {}),
    };
  }
  return { '@id': `${base}/#organization` };
}

/** WebSite node (home page + referenced by article pages). */
export function websiteNode(siteUrl: string) {
  const base = trimSlash(siteUrl);
  return {
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    url: `${base}/`,
    name: ORG.name,
    description: ORG.description,
    publisher: { '@id': `${base}/#organization` },
  };
}

/** Home page graph: Organization + WebSite. */
export function homeGraph(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationNode(siteUrl), websiteNode(siteUrl)],
  };
}

function abs(siteUrl: string, path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return trimSlash(siteUrl) + (path.startsWith('/') ? path : `/${path}`);
}

/** Strip the little markdown that appears inside bold FAQ lines. */
function cleanInline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
}

/**
 * Extract FAQ Q&A pairs from a markdown body's `## FAQ` section.
 * Articles use a consistent `**Question?** Answer.` one-line pattern.
 * Returns [] when there is no FAQ section — caller then omits FAQPage.
 */
export function extractFaqs(body: string): Faq[] {
  if (!body) return [];
  const lines = body.split(/\r?\n/);
  const faqs: Faq[] = [];
  let inFaq = false;
  const qa = /^\*\*(.+?)\*\*\s+(.+)$/;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{2,}\s*FAQ/i.test(line)) {
      inFaq = true;
      continue;
    }
    if (inFaq && /^#{1,}\s+/.test(line)) break; // next heading ends the FAQ section
    if (!inFaq) continue;
    const m = line.match(qa);
    if (m) faqs.push({ q: cleanInline(m[1]), a: cleanInline(m[2]) });
  }
  return faqs;
}

function toISO(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

function breadcrumbNode(pageUrl: string, trail: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: t.url,
    })),
  };
}

/** Article page graph: Organization + WebSite + Article + WebPage + Breadcrumb (+ FAQ). */
export function articleGraph(siteUrl: string, article: ArticleEntry, pageUrl: string) {
  const base = trimSlash(siteUrl);
  const d = article.data;
  const graph: unknown[] = [organizationNode(siteUrl), websiteNode(siteUrl)];

  graph.push({
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    isPartOf: { '@id': `${base}/#website` },
    headline: d.title,
    description: d.description,
    ...(d.image ? { image: abs(siteUrl, d.image) } : {}),
    datePublished: toISO(d.pubDate),
    dateModified: toISO(d.updatedAt ?? d.pubDate),
    author: authorNode(siteUrl),
    publisher: { '@id': `${base}/#organization` },
    mainEntityOfPage: { '@id': pageUrl },
    articleSection: d.category,
    inLanguage: 'en',
    // §7.4 隐式标识扩展字段：AI 辅助状态 / 服务方 / 内容 id（标准 JSON-LD 无原生字段，用 kavalo: 前缀扩展）。
    'kavalo:aiAssisted': d.aiAssisted ?? false,
    ...(d.aiProvider ? { 'kavalo:aiProvider': d.aiProvider } : {}),
    'kavalo:contentId': d.slug,
  });

  graph.push({
    '@type': 'WebPage',
    '@id': pageUrl,
    url: pageUrl,
    name: d.title,
    isPartOf: { '@id': `${base}/#website` },
    inLanguage: 'en',
  });

  graph.push(
    breadcrumbNode(pageUrl, [
      { name: 'Home', url: `${base}/` },
      { name: 'Journal', url: `${base}/blog/` },
      { name: d.title, url: pageUrl },
    ]),
  );

  const faqs = extractFaqs(d.body);
  if (faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
