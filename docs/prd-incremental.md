# 增量 PRD — kavalo.top 静态 Astro 博客升级为动态全栈

> 版本：v0.1（增量需求，基于现有 Astro 4.16 静态站）
> 作者：许清楚（产品经理）
> 日期：2025-10-15

---

## 1. 项目信息

| 项 | 内容 |
|---|---|
| 文档语言 | 中文 |
| 技术栈（实际，非默认模板） | Astro 4.16 + `@astrojs/node`（SSR, `output:'server'`）+ MySQL 8 + Docker / docker-compose |
| 项目名称 | `kavalo_astro_fullstack` |
| 工程根目录 | `E:/kavalo.top/kavalo-astro`（npm run build 当前产出 37 页，25 篇文章） |
| 线上参考 | `E:/kavalo.top/mirror`（样式/结构基准，需零回归） |

### 原始需求复述
将现有静态 Astro 博客升级为 **SSR + MySQL 全栈动态站**：文章数据运行时从 MySQL 读取，移除 content collections 作为文章数据源（保留 `site.ts` 导航/分类配置）。通过 Docker 自托管于 VPS，单一管理员密码鉴权（环境变量 `ADMIN_PASSWORD` + httpOnly cookie）。交付后台 CRUD、前台页面 DB 化改造、RSS 动态生成，以及 Dockerfile / docker-compose / .env.example / 一键部署脚本 / git 初始化。

---

## 2. 产品定义

### 产品目标（正交）
- **G1 动态化**：文章数据由 MySQL 实时驱动，发布/编辑即生效，彻底摆脱「改 Markdown → git commit → 重新 build」流程。
- **G2 零回归**：前台文章/列表/分类/hub/RSS 在视觉、路由、SEO（sitemap/RSS）、交互上与现有静态站一致；**保留 `global.css` 与既有组件样式**。
- **G3 可运维**：单一 Docker 镜像 + compose + 一键脚本完成「构建 → 起服 → 建表/迁移/存量播种」，所有敏感配置走环境变量。

### 用户故事
1. 作为站点主理人（管理员），我希望在网页后台新建/编辑/删除文章，以便不用每次提交 Markdown 文件即可更新内容。
2. 作为站点主理人，我希望博客以动态方式运行在 VPS 上，以便新文章即时生效、无需全站重建。
3. 作为读者，我希望文章页/列表/分类/hub/RSS 与升级前外观行为一致，以便无 UX 与 SEO 倒退。
4. 作为运维者，我希望一条命令完成构建、起服与数据库迁移，以便在 VPS 上可复现地部署。
5. 作为读者，我希望文章加载保持流畅，以便 SSR 化不带来明显性能下降。

---

## 3. 技术规范

### 3.1 MySQL 文章表结构（需求级规格，非 DDL 代码）

| 字段 | 类型/约束 | 对应现有字段 | 说明 |
|---|---|---|---|
| `id` | BIGINT UNSIGNED, 自增, 主键 | — | 内部主键 |
| `slug` | VARCHAR(255), **唯一索引** | `post.slug` | URL 标识；唯一冲突需处理（见待确认） |
| `title` | VARCHAR(255), NOT NULL | `title` | 标题 |
| `category` | VARCHAR(64), NOT NULL, 索引 | `category` | 建议约束为 6 个已知分类之一 |
| `image` | VARCHAR(512) | `image` | 封面图 URL（外链或站内 `/images/...`） |
| `description` | TEXT | `description` | 简介/摘要 |
| `body` | **LONGTEXT**, NOT NULL | 文章正文 Markdown | 运行时渲染为 HTML |
| `read_time` | VARCHAR(32) | `readTime`（如 "5 min read"） | 可空；建议保留自由文本 |
| `tests` | JSON | `tests`（标签数组） | 存标签数组，如 `["leak test","pull test"]` |
| `pub_date` | DATETIME, NOT NULL, 索引 | `pubDate` | 发布日期 |
| `status` | ENUM('draft','published') | — | **草稿/发布状态（P2，待确认是否纳入 v1）** |
| `created_at` | DATETIME, 默认 CURRENT_TIMESTAMP | — | 创建时间 |
| `updated_at` | DATETIME, 默认 CURRENT_TIMESTAMP ON UPDATE | — | 更新时间 |

索引：`UNIQUE(slug)`、`INDEX(category)`、`INDEX(pub_date)`。

### 3.2 需求池（P0/P1/P2）

#### P0 — Must have
- [ ] **架构切换**：Astro 改为 SSR（`@astrojs/node` 适配器，`output:'server'`）；`astro.config.mjs` 增加 node 适配器集成。
- [ ] **数据库建表与迁移**：提供初始化 SQL（建表 + 索引）；迁移脚本幂等，可重复执行。
- [ ] **存量播种**：将现有 25 篇 `.md`（frontmatter + 正文）迁移写入 MySQL，slug/字段一一对应，迁移不丢数据。
- [ ] **前台文章页 SSR**：`[slug].astro` 运行时按 slug 从 DB 取文章并渲染（替代 `getCollection` + `post.render()`）。
- [ ] **前台列表/分类/hub 页 DB 化**：`blog/index.astro`、`blog/category/[category]`、`corgi/gear.astro` 改为从 DB 查询（按 pubDate 倒序 / 按 category 过滤）。
- [ ] **RSS 动态生成**：`rss.xml.ts` 改为从 DB 取最新文章生成（保留现有字段映射）。
- [ ] **后台鉴权**：登录页校验 `ADMIN_PASSWORD`（环境变量）；登录成功下发 **httpOnly cookie**；受保护路由校验 cookie。
- [ ] **后台文章 CRUD**：列表、新建、编辑（标题/分类/封面图/简介/正文 Markdown/阅读时长/测试标签/发布日期）、删除。
- [ ] **退出登录**：清除 cookie 的 logout 入口。
- [ ] **样式零回归**：保留 `global.css` 与现有组件样式；后台可复用前台设计语言，不引入与站点调性冲突的 UI 库。
- [ ] **工程化交付**：`Dockerfile`、`docker-compose.yml`（Node 服务 + MySQL + 初始化 SQL + 数据卷挂载）、`.env.example`、`deploy.sh`（构建→起 compose→执行迁移）、`git init` + `.gitignore`。

#### P1 — Should have
- [ ] **运行时 Markdown 渲染 + TOC**：在 SSR 侧渲染 Markdown 为 HTML，并提取 h2/h3 生成「In this guide」目录（替代 `post.render()` 的 `Content`/`headings`）。
- [ ] **slug 唯一约束与冲突处理**：新建/编辑时校验唯一；冲突策略明确（拒绝/自动后缀）。
- [ ] **后台列表增强**：分页、按分类筛选、按标题搜索、显示发布状态与时间。
- [ ] **迁移幂等与可重跑**：重复执行 deploy 不重复建表/重复播种（如 `INSERT IGNORE` 或存在性判断）。
- [ ] **图片处理策略**：封面图外链 vs 上传落盘 / 对象存储的明确方案（见待确认）。

#### P2 — Nice to have
- [ ] **草稿/发布状态字段**：编辑态可存草稿、择机发布（需先确认是否纳入 v1）。
- [ ] **Markdown 编辑器实时预览**：后台写作区支持分栏预览。
- [ ] **缓存层**：对 DB 查询结果做短时缓存以降低 SSR 延迟。
- [ ] **操作审计**：记录文章增删改操作人与时间。
- [ ] **多管理员 / 角色**：当前单一密码，未来可扩展。

---

## 4. 后台 UI 设计稿（功能布局，非实现代码）

**整体风格**：沿用站点极简、卡片化、长背短腿柯基主题语言；后台为独立 `/admin` 路由，与读者前台视觉一致但不干扰前台。

```
┌─────────────────────────────────────────────┐
│  kavalo admin            [退出登录]          │  ← 顶部条（登录后常驻）
├─────────────────────────────────────────────┤
│ 侧栏:  文章列表 | 新建文章                  │
│                                             │
│ 主区（文章列表 /admin/posts）：              │
│  [搜索框] [分类下拉] [状态下拉]             │
│  ┌─────────────────────────────────────┐   │
│  │ ☑ 标题            分类      发布日期  │   │
│  │  Best Mesh Harness harness  2025-..  │ ✎ 🗑│
│  │  ...（分页）                        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│ 主区（编辑/新建 /admin/posts/edit/[slug]）： │
│  标题 [________________]                     │
│  分类 [下拉: 6 类]  发布日期 [date]          │
│  阅读时长 [______]  封面图URL [________]     │
│  测试标签 [tag][tag][+添加]                  │
│  简介 [________________]                     │
│  正文(Markdown) [             | 预览 ]       │  ← 分栏：左编辑右预览(P2)
│  [保存草稿][发布/更新][取消]                │
└─────────────────────────────────────────────┘

登录页 /admin/login：
  kavalo admin
  密码 [____________]  [登录]
  （错误提示不泄露是否为用户名错误）
```

**路由规划**
- `/admin/login` — 登录（POST 校验 `ADMIN_PASSWORD`，成功设 httpOnly cookie）
- `/admin/posts` — 列表（需鉴权，未登录跳登录）
- `/admin/posts/new` — 新建
- `/admin/posts/edit/[slug]` — 编辑
- `/admin/logout` — 退出

---

## 5. 待确认问题（Open Questions）

1. **渲染策略**：已确认「文章页运行时从 MySQL 读取」（SSR 直连），但需确认是否引入**缓存层**以缓解 DB 压力与首屏延迟（影响 P1 缓存需求与 P0 性能目标 G3/故事5）。
2. **slug 冲突处理**：新建/编辑产生重复 slug 时，是**拒绝提交**还是**自动追加后缀**（如 `-2`）？唯一索引已定，但冲突 UX 待定。
3. **草稿/发布状态字段**：v1 是否需要 `status` 字段支持草稿？当前需求偏「发布即生效」，若不需要则表结构去除 `status`，简化为纯发布态。
4. **存量 25 篇播种方式**：迁移脚本是从 `src/content/blog/*.md` 解析 frontmatter 自动导入，还是提供一次性 seed 数据？需明确脚本在部署流程中的触发时机。
5. **Markdown 运行时渲染方案**：`post.render()` 绑定 content collections，DB 内容需另选渲染路径（如 `marked` + 自定义标题提取）。需架构师确认具体方案，PRD 仅定义为 P1 需求。
6. **封面图存储**：`image` 目前为 URL 字符串。后台上传图片落盘位置（挂载卷目录 / 对象存储 / 纯外链）需定，影响 Docker 卷设计与后台表单。
7. **category 约束**：`category` 是自由文本还是限定为 `site.ts` 的 6 个已知分类？建议后端校验以防脏数据。
8. **cookie 安全**：httpOnly 已定；是否需要签名/加密 token 防篡改？是否需要短暂过期？建议补充 `SESSION_SECRET` 环境变量。
9. **sitemap 集成**：现有 `@astrojs/sitemap` 在 SSR 下行为需确认（动态路由是否仍自动收录），避免 SEO 回归。

---

## 6. 验收口径（摘要）
- 25 篇文章全部可从 DB 读取并正确渲染，前台 5 类页面（文章/列表/分类/hub/RSS）+ sitemap 视觉与路由零回归。
- 后台管理员可完成文章增删改查，未登录无法访问受保护路由。
- 一条 `deploy.sh` 可在空白 VPS 上完成构建、起服、建表、存量播种；配置仅通过 `.env`。
- 所有敏感信息（密码、secret）不进仓库，`git init` 后 `.gitignore` 已覆盖 `node_modules`、`.env`、`dist`。
