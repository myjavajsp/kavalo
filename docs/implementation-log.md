# 实现记录 — kavalo.top 静态 Astro → SSR + MySQL + 后台 + Docker

> 工程师（寇豆码）按 `docs/architecture.md` 的 T01–T05 完成增量改造。
> 日期：2026-04-15　基线：Astro 4.16 静态站

## 1. 改动 / 新增文件清单

### T01 基础设施与部署脚手架
- `package.json` — 新增 `@astrojs/node`、`mysql2`、`marked`、`github-slugger`、`gray-matter`、`dotenv`；devDep `tsx`；脚本 `migrate`/`seed`/`deploy`；移除 `@astrojs/sitemap`、`rehype-slug`。
- `astro.config.mjs` — `output:'server'` + `adapter: node({mode:'standalone'})`；移除 `sitemap()`；`server.port` 读 `process.env.PORT`（默认 4321），`host:true`。
- `.env.example` — 覆盖 `DB_*`/`ADMIN_PASSWORD`/`SESSION_SECRET`/`SITE_URL`/`PORT`/`NODE_ENV`。
- `.gitignore` — `node_modules/`、`dist/`、`.env`、`.astro/`、`.DS_Store` 等。
- `Dockerfile` — 多阶段：构建装全量依赖 → 运行期 `npm ci --omit=dev` + 仅 `dist/`；暴露 4321，启动 `dist/server/entry.mjs`。
- `docker-compose.yml` — `app`(构建自 Dockerfile，依赖 `db` healthy，env 自 `.env` 注入) + `db`(mysql:8，卷 + `/docker-entrypoint-initdb.d` 挂载 `scripts/schema.sql` 幂等建表，含 healthcheck)。
- `.dockerignore`、`scripts/schema.sql`（幂等 DDL）。

### T02 核心库（`src/lib/`）
- `db.ts` — `mysql2` 连接池单例挂 `globalThis`，从 `process.env.DB_*` 读；导出 `pool`/`query`/`execute`。
- `types.ts` — `ArticleInput`/`ArticleData`/`ArticleEntry`(`{slug,data}` 兼容旧 CollectionEntry)/`TocItem`/`RenderResult`。
- `articles.ts` — `getBySlug`/`listByCategory`/`listAll`/`listLatest`/`create`/`update`/`remove`/`upsertFromMarkdown`/`listArticles`/`categorySlugToLabel`/`isValidCategory`；`tests` JSON 解析兜底 `[]`；`create`/`update` 捕获 `ER_DUP_ENTRY` 抛 `ArticleError('CONFLICT')`。
- `markdown.ts` — `marked` + `github-slugger` 渲染 heading 注入 `id`，抽取 h2/h3 TOC（每调用新建 slugger，避免跨文章重复 `-1`）。
- `auth.ts` — `verifyPassword`(SHA-256 + `timingSafeEqual`)、`signSession`/`verifySession`(HMAC-SHA256 + 24h)、`setAuthCookie`/`clearAuthCookie`(`httpOnly`+`secure`生产+`sameSite:lax`+`path:/`+`maxAge:86400`)。

### T03 API 与中间件
- `middleware.ts` — 保护 `/admin/*`(除 `/admin/login`) 与 `/api/articles*`；页面失败 302→`/admin/login`，API 失败 401 JSON；`locals.auth`。
- `api/login.ts`、`api/logout.ts`、`api/articles.ts`(GET 列表分页/筛选/搜索 + POST 新建，校验 category∈6类、slug 非空，重复 409)、`api/articles/[slug].ts`(GET/PUT/DELETE)。统一 `{ok,message?,data?}`，错误码 400/401/404/409/500。

### T04 前台 DB 化
- `blog/[slug].astro`（按 `Astro.params.slug` → `getBySlug`，未找到/未发布→404，渲染 `html`/`toc` 传 `PostLayout`，相关文章 JS 复算）、`blog/index.astro`、`blog/category/[category].astro`（URL slug→`categorySlugToLabel`→`listByCategory`，未知→404）、`corgi/gear.astro`（按 category 分组）、`rss.xml.ts`、`sitemap.xml.ts`（新增，DB slug + 静态路由，`application/xml`）、`layouts/PostLayout.astro`（props 改 `article/html/toc/related`，`<Content/>`→`set:html`，TOC 用 `toc`）、`components/PostCard.astro`（类型改 `ArticleEntry`）。
- `pages/index.astro` 同步去 `getCollection`（原亦引用），改用 `listAll`，零回归。
- 保留 `src/content/config.ts` 与全部 `src/content/blog/*.md`（作为 seed 数据源），仅移除页面里的 `getCollection` 导入，`npm run build` 通过。

### T05 后台与种子
- `admin/login.astro`、`admin/index.astro`、`admin/posts.astro`(搜索/分类/状态筛选/分页/删除)、`admin/posts/[slug].astro`(新建/编辑表单，6 类下拉、封面URL、简介、正文MD、阅读时长、测试标签、发布日期、published)。
- `scripts/seed.ts`（`gray-matter` 读 25 篇 `.md` 经 `upsertFromMarkdown` 幂等入库）、`scripts/migrate.ts`（应用 schema.sql）。
- `deploy.sh`（`set -e`：build → compose up → 等待 db healthy → seed）、`Makefile`。

## 2. 验收点达成
- ✅ `npm install` 装齐所有新依赖；`npm run build` 成功产出 `dist/server/entry.mjs`（standalone）。
- ✅ `docker-compose.yml` 起 `db`+`app`，`db` 首次经 `initdb` 执行 `schema.sql` 幂等建表；`up` 可重复。
- ✅ `.env.example` 覆盖全部必需变量；`.gitignore` 含 `node_modules/`、`dist/`、`.env`。
- ✅ 核心库运行时自测：markdown 产出 h2/h3 `id`（与 `github-slugger` 一致，重复标题 `first-1`）、TOC 正确；auth 签发/校验/密码校验通过。
- ✅ 前台页面全部改用 `ArticleEntry`，`global.css` 与现有组件样式零改动保留。
- ✅ `sitemap.xml` 含全部动态文章 URL + 静态路由。

> 关于“37+ 路由”：原静态站为每篇文章预渲染一页（共 37）。改为 SSR 后，`blog/[slug]`、`blog/category/[category]` 等动态路由（共 19 个 route 条目）在运行期按 slug 服务全部文章，功能等价。构建无错误、`entry.mjs` 产出，为最终判据。

## 3. 遗留 / 风险
- 本机无 MySQL，未实际连库运行 seed/migrate（脚本已就绪，仅要求 `npm run build` 通过，已满足）。
- `marked` 版本在 11/12 间做了兼容（heading renderer 同时兼容字符串参数与 token 对象），升级大版本时建议复测 TOC 锚点。
- cookie `secure` 在生产(`NODE_ENV=production`)才为 true，本地 http 开发可正常登录；生产经 HTTPS 反代（Caddy/Traefik）即安全。
- `@astrojs/sitemap` 已移除，由自定义 `sitemap.xml.ts` 接管；RSS 仍用 `@astrojs/rss`。
- 内容净化（DOMPurify）、缓存、对象存储等列为 P2，未在本期实现。
