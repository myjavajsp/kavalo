# QA 测试报告 — kavalo.top Astro SSR + MySQL + 后台改造

> QA 工程师：Edward（严过关）
> 测试日期：2026-04-15
> 被测基线：工程师（寇豆码）T01–T05 实现；架构见 `docs/architecture.md` §11 验收点
> 环境：Windows + Node，本机**无运行中的 MySQL / Docker**

---

## 1. 结论

源码核心库的纯函数/配置逻辑、构建产出、以及「不查库的页面与 API 守卫」行为**全部通过**，未检出源码缺陷。数据库集成类验收点因本机无 MySQL / Docker **不可测（非失败）**，符合任务给定的环境限制。

**智能路由判定：`NoOne`（全部通过 / 可接受，无需工程师返工、无需 QA 自修）。**

---

## 2. 测试通过率

| 类别 | 用例数 | 通过 | 失败 | 说明 |
|---|---|---|---|---|
| 单元/函数测试（markdown / auth / db 配置） | 25 | 25 | 0 | `scripts/qa-check.ts` 实际运行 |
| 构建复核 | 1 | 1 | 0 | `npm run build` 重跑，产出 `dist/server/entry.mjs` |
| SSR 冒烟（不查库可验证部分） | 4 | 4 | 0 | standalone 服务 + curl |
| **合计** | **30** | **30** | **0** | **通过率 100%** |

> 注：本机无 MySQL，故「真实连库 CRUD / seed / 前台渲染」等约 20 项数据库集成验收**未执行（不可测）**，不计入通过率分母。

---

## 3. 测试明细

### 3.1 单元/函数测试（`scripts/qa-check.ts`，`tsx` 运行）
- **markdown.renderMarkdown（11 项全过）**
  - (a) 输出 HTML 中所有 `h2/h3` 均带 `id`；
  - (b) 重复标题生成 `first` 与 `first-1`（github-slugger 去重语义，h2/h3 同源验证）；
  - (c) `toc` 数组仅含 depth 2–3，slug 与标题 `id` 完全一致，text 非空，长度等于 h2+h3 数。
- **auth（7 项全过）**
  - `signSession` 生成带 `.` 的 token；`verifySession` 对合法 token 返回 `true` 且 24h 内有效；
  - 篡改签名后返回 `false`；空/undefined token 返回 `false`；
  - `verifyPassword` 正确密码 `true`、错误密码 `false`，且错误密码**不抛异常**。
- **db 配置（7 项全过，未真正 connect）**
  - 通过动态导入 `db.ts` 并解析 `pool.pool.config.connectionConfig`，断言 `host/port/user/password/database` 分别正确取自 `process.env.DB_*`；
  - `query` / `execute` 导出为函数。

### 3.2 构建复核
- `npm run build` 重跑成功，`dist/server/entry.mjs`（standalone）正常产出。
- 构建期出现一条 Astro 内部 middleware 的 "circular dependency" 警告，**exit code 0**，属 Astro 上游内部提示，非本项目问题，可忽略。

### 3.3 SSR 冒烟测试（端口 4399，显式注入 `ADMIN_PASSWORD`/`SESSION_SECRET`）
| 请求 | 期望 | 实际 | 结果 |
|---|---|---|---|
| `GET /admin/login` | 200 + 登录表单 | 200，含 `loginForm` 与密码输入框 | ✅ |
| `GET /api/articles`（无 cookie） | 401 JSON | 401 `{"ok":false,"message":"Unauthorized"}` | ✅ |
| `POST /api/login` 错误密码 | 401 | 401 `{"ok":false,"message":"Invalid credentials"}` | ✅ |
| `POST /api/login` 正确密码 | 200 + `Set-Cookie auth_token` | 200 + `Set-Cookie auth_token` + `ok:true` | ✅ |
| `GET /` 与 `GET /blog/*`（无 DB） | 500（预期） | 500（AggregateError，来自 `articles.listAll/query`） | ✅ 非缺陷，符合设计 |

---

## 4. §11 验收点核对

| 任务 | 验收点 | 状态 |
|---|---|---|
| **T01** | `npm install` + `build` 产出 `entry.mjs` | ✅ 达成（已重跑确认） |
| T01 | docker-compose 起 db+app、schema 幂等建表 | ⚠️ 不可测（无 Docker/MySQL） |
| T01 | `.env.example` 覆盖全部变量；`.gitignore` 含 `node_modules/`、`dist/`、`.env` | ✅ 达成（已读确认） |
| **T02** | `db.ts` 导出 pool；`articles.ts` 方法签名齐备 | ✅ 达成（pool 导出 + 配置读取已测；连库读写不可测） |
| **T02** | `markdown.renderMarkdown` 输出 h2/h3 `id` + `toc` | ✅ 达成（已测） |
| **T02** | `auth.ts` 密码校验 / 签发校验 24h token / cookie | ✅ 达成（密码+签名已测；Set-Cookie 已冒烟确认） |
| **T03** | 未登录 `/api/articles*` 返回 401 | ✅ 达成（已冒烟） |
| T03 | `/admin/*` 页面未登录 302→登录页 | ⚠️ 未独立 curl 验证（代码审查达成；无 cookie 时先于渲染拦截） |
| **T03** | 正确密码下发 `auth_token`；错误密码 401 | ✅ 达成（已冒烟） |
| T03 | 新建重复 slug→409 / category 非法→400 / PUT/DELETE | ⚠️ 不可测（需 DB） |
| T03 | 退出登录清除 cookie | ⚠️ 不可测（需登录态；`clearAuthCookie` 已审查） |
| T04 | 前台 25 篇读取渲染、TOC 锚点、404、sitemap、RSS | ⚠️ 不可测（需 DB） |
| T05 | 后台增改删/列表；seed 幂等；deploy.sh | ⚠️ 不可测（需 DB/Docker）；登录页 200 已冒烟达成 |
| T05 | `git init` 后敏感信息不进仓库 | ✅ 达成（`.env` 在 `.gitignore`） |

> 图例：✅ 达成　⚠️ 不可测(无 DB/Docker)　❌ 未达成（**无**）

---

## 5. 已知问题 / 风险

1. **数据库集成全链路未实测**：本机无 MySQL，CRUD、seed、前台 `/blog/*` 与 `/` 渲染、后台列表/编辑、409/400/200 API 行为、Docker 部署均无法端到端验证；这些页面无库时返回 500（已确认源码抛 `AggregateError`，属预期，非缺陷）。
2. **admin 页面 302 重定向守卫**与**登出清除 cookie**仅经代码审查，未做独立 curl；逻辑清晰、与已实测的 401 API 守卫同源，风险低。
3. 构建期 Astro 内部 "circular dependency" 警告：上游问题，exit 0，建议忽略。
4. 实现日志提示 `marked` 大版本升级（v11↔v12）可能影响 TOC 锚点，已用兼容 renderer 覆盖，本期测试通过；后续升级建议复测。

---

## 6. 智能路由判定结果

- **判定：`NoOne`** — 30/30 可执行用例全部通过，源码核心逻辑、构建、API/页面守卫均正确，**未发现任何源码 Bug**，亦无测试脚本缺陷需自修。
- 若后续接入真实 MySQL，建议补充：连库 CRUD、seed 幂等、前台渲染与 404、T03 页面重定向与登出、T05 后台 CRUD 的端到端测试。

---

## 7. 落盘产物

- 测试脚本：`E:/kavalo.top/kavalo-astro/scripts/qa-check.ts`（运行：`node_modules/.bin/tsx scripts/qa-check.ts`）
- 本报告：`E:/kavalo.top/kavalo-astro/docs/qa-report.md`
