/**
 * Shared data types for the article domain.
 *
 * `ArticleEntry` is deliberately shaped as `{ slug, data }` to mirror Astro's
 * `CollectionEntry<'blog'>` so that existing components (`PostCard`, `PostLayout`)
 * need only a type annotation change and keep working unchanged.
 */

/** Input payload for creating / updating an article (admin form + API). */
export interface ArticleInput {
  slug: string;
  title: string;
  category: string;
  image: string;
  description: string;
  body: string;
  readTime: string;
  tests: string[];
  pubDate: Date;
  published: boolean;
}

/** A fully-hydrated article as stored in / read from the database. */
export interface ArticleData {
  id: number;
  slug: string;
  title: string;
  category: string;
  image: string;
  description: string;
  body: string;
  readTime: string;
  tests: string[];
  pubDate: Date;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Compatible with the old `CollectionEntry<'blog'>` shape. */
export interface ArticleEntry {
  slug: string;
  data: ArticleData;
}

/** A single table-of-contents entry (h2 / h3) with a github-slugger id. */
export interface TocItem {
  depth: 2 | 3;
  slug: string;
  text: string;
}

/** Result of rendering Markdown to HTML plus an extracted TOC. */
export interface RenderResult {
  html: string;
  toc: TocItem[];
}
