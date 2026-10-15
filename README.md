# kavalo.top

基于 **Astro 4 + Node (SSR) + MySQL** 的静态镜像重建工程。文章正文存储于 MySQL，后台可在线增删改文章，对外页面为服务端渲染（SSR）的动态站点。

---

## 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Astro 4（`output: 'server'`，`@astrojs/node` standalone 模式） |
| 数据库 | MySQL 8（驱动 `mysql2`） |
| 鉴权 | 单管理员口令 + HMAC-SHA256 签名 httpOnly Cookie（24h 有效） |
| Markdown | 运行时经 `marked` + `github-slugger` 渲染（标题锚点与原 rehype-slug 一致） |
| 部署 | Docker Compose（Node 应用 + MySQL 容器）或裸机 Node 进程 |

---

## 目录与路径

| 路径 | 说明 |
|------|------|
| `/` `/blog` `/[slug]` `/category/[c]` | 对外公开页面 |
| `/rss.xml` `/sitemap.xml` | RSS 与站点地图 |
| `/admin/login` | **后台登录页** |
| `/admin/posts` | **后台文章管理（列表 / 搜索 / 编辑）** |
| `/api/login` `/api/logout` `/api/articles` `/api/articles/[slug]` | 鉴权与文章 CRUD 接口（受中间件保护） |

---

## 一、环境变量

复制模板并按需修改：

```bash
cp .env.example .env
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_HOST` | MySQL 主机 | `localhost` |
| `DB_PORT` | MySQL 端口 | `3306` |
| `DB_USER` | 数据库用户 | `root` |
| `DB_PASSWORD` | 数据库密码 | （空） |
| `DB_NAME` | 数据库名 | `kavalo` |
| `ADMIN_PASSWORD` | **后台管理员登录口令** | `changeme` |
| `SESSION_SECRET` | Cookie 签名密钥（请改成一段长随机串） | — |
| `SITE_URL` | 站点对外地址（RSS / sitemap 使用） | `https://kavalo.top` |
| `PORT` | 应用监听端口 | `4321` |
| `NODE_ENV` | `development` / `production` | `development` |

> `.env` 已被 `.gitignore` 忽略，**不会进入版本库**，请妥善保管。

---

## 二、部署方式

### 方式 A：Docker 一键部署（推荐用于 VPS）

前置：已安装 Docker 与 Docker Compose，且已准备好 `.env`。

```bash
npm install        # 安装本地脚本依赖（tsx 等）
npm run deploy     # 等价于 ./deploy.sh
```

脚本依次完成：构建 → 启动 `db` + `app` 容器 → 等待 MySQL 健康 → 从 Markdown 种子数据写入数据库。
完成后访问 `http://localhost:${PORT}`（默认 `http://localhost:4321`）。

常用命令：

```bash
make up            # 仅启动容器
make down          # 停止并移除容器（保留数据卷）
make build         # 仅重新构建
make migrate       # 手动初始化/同步数据库表结构
make seed          # 手动从 src/content/blog/*.md 重新导入文章
```

> 数据库表结构通过 `scripts/schema.sql`（`CREATE ... IF NOT EXISTS`，可重复执行）在容器首次启动时自动创建，亦可通过 `npm run migrate` 手动执行。

### 方式 B：裸机 / 本地 Node 运行

前置：本地已有 MySQL 8 实例，并已创建数据库 `kavalo`。

```bash
npm install
cp .env.example .env      # 按本地 MySQL 填写 DB_* 与 ADMIN_PASSWORD
npm run migrate           # 初始化表结构
npm run seed              # 可选：从 Markdown 导入初始 25 篇文章
npm run build             # 构建 standalone 产物到 dist/
node dist/server/entry.mjs   # 启动；或直接 npm run dev 进行开发
```

开发模式（热更新）：

```bash
npm run dev               # 监听 :4321，无需构建
```

---

## 三、后台地址与默认账号

- **登录地址：** `http://<你的域名或IP>:<PORT>/admin/login`
  - 本地开发示例：`http://localhost:4321/admin/login`
- **管理后台：** `http://<域名>:<PORT>/admin/posts`（登录后自动跳转）
- **默认账号说明：**
  - 本项目为**单管理员模型**，**无独立用户名**，登录仅需「口令」。
  - 开发环境自动生成的默认口令为：**`kavalo-dev-2026`**
  - 生产部署请务必在 `.env` 中将 `ADMIN_PASSWORD` 与 `SESSION_SECRET` 改为强随机值。

> ⚠️ 安全提醒：部署到公网前，**必须**修改 `.env` 中的 `ADMIN_PASSWORD` 与 `SESSION_SECRET`，否则后台可被任意访问或会话被伪造。

---

## 四、常用脚本汇总

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器（热更新，需 MySQL） |
| `npm run build` | 构建 standalone 产物 |
| `npm run migrate` | 初始化 / 同步数据库表结构 |
| `npm run seed` | 从 `src/content/blog/*.md` 导入文章（幂等，可重复跑） |
| `npm run deploy` | 一键 Docker 部署（构建 + 起容器 + 等库 + 灌种子） |

---

## 五、内容来源说明

- 文章正文存于 MySQL `articles` 表，后台编辑即时生效（无需重新构建）。
- `src/content/blog/*.md` 仅作为**初始种子数据**，通过 `npm run seed` 导入；之后的修改请在后台进行。
- 对外页面（首页 / 文章 / 分类 / RSS / sitemap）均实时读取数据库，改完即见。
