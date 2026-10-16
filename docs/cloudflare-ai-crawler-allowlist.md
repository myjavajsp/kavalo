# Cloudflare 放行 AI 爬虫规则（kavalo.top）

> 实测基线（2026-10-16）：被 Cloudflare 拦截的**只有 Anthropic 系爬虫**——
> `ClaudeBot` → 403、`anthropic-ai` → 403；
> 其余 `GPTBot / ChatGPT-User / PerplexityBot / Google-Extended / CCBot / Applebot-Extended` 全部 200，普通浏览器也 200。
> 结论：**不是整站拦截，而是「只针对 Anthropic 爬虫」的封锁**。修复点在 Cloudflare 后台，与站点代码 / robots.txt 无关（robots 已全开）。

根因通常二者之一：
1. **WAF 自定义规则**里有一条针对 `ClaudeBot` / `anthropic` 的 Block 规则；或
2. **Bot Management 的「AI Bots（AI 爬虫）按家控制」**把 Claude / Anthropic 设成了 Block，而其余家是 Allow。

两处都查一下最稳。下面两种修复法任选，推荐「方法一 + 方法二」双保险。

---

## 方法一（优先）：AI Bots 按家控制里放行 Claude

在 **kavalo.top** 这个域下操作（不是账户级）：

1. 左侧展开 **kavalo.top** 域 → **安全性（Security）** → **设置（Settings）**。
   - 对应后台路径：`/458cb659cf719ea8c682a7d6ab0daef8/kavalo.top/security/settings`
2. 向下滚动找到 **AI Bots（AI 爬虫）** 区块，里面会列出 ChatGPT / Claude 等各家爬虫，每项可 Allow / Block。
3. 确认 **Claude（Anthropic）** 那一项是 **Allow**。若显示 Block，改成 Allow 并保存。

> 这一处正是「只拦 Anthropic、其余放行」最可能的源头。改完通常 ClaudeBot 立即变 200。

---

## 方法二（兜底，最稳）：WAF 自定义 Allow 规则

1. 左侧 **应用程序安全（Application Security）** → **WAF** → **自定义规则（Custom Rules）**。
   - 对应后台路径：`/458cb659cf719ea8c682a7d6ab0daef8/application-security/waf`
2. 点 **创建规则（Create rule）**，填写：
   - **规则名称**：`Allow AI search crawlers`
   - **匹配条件（When incoming requests match…）**：
     - 字段：`User Agent`
     - 运算符：`matches regex`
     - 值（已含忽略大小写，覆盖 Anthropic 两家 UA）：
       ```
       (?i)(GPTBot|ChatGPT-User|PerplexityBot|Google-Extended|CCBot|ClaudeBot|Applebot-Extended|anthropic-ai|Omgilibot|Amazonbot)
       ```
   - **执行（Action）**：`Allow`（允许）
   - **排序（关键）**：把这条规则**拖到列表最上方**，确保它在任何「Block / Challenge / Bot Fight」规则**之前**执行（Cloudflare 自定义规则自上而下匹配，Allow 命中即放行，不再往下走到 Block 规则）。
3. **部署 / 保存**。

> 即使方法一的「AI Bots」设置仍残留拦截，这条 WAF Allow 也会优先放行，形成双保险。

---

## 验证（改完务必测）

本地或任意能出网的机器跑：

```bash
for ua in GPTBot ChatGPT-User PerplexityBot Google-Extended CCBot ClaudeBot Applebot-Extended anthropic-ai; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -A "$ua" "https://kavalo.top/blog/airline-approved-small-dog-carriers/")
  echo "$ua -> $code"
done
```

期望：**全部 200**。若 `ClaudeBot` / `anthropic-ai` 仍为 403：
- 检查 WAF Allow 规则是否排在了 Block 规则**之下**（拖到最上）；
- 检查 方法一 的 AI Bots 里 Claude 是否仍为 Block；
- 确认正则里包含 `ClaudeBot` 与 `anthropic-ai`。

---

## 备注

- 这些 UA 均为各 AI 引擎官方公布的爬虫标识（OpenAI、Anthropic、Perplexity、Google、Common Crawl、Apple）。放行它们不会带来垃圾流量，反而提升站点在 AI 答案中的可见性——这正是 GEO 目标。
- 切勿在 `robots.txt` 里对它们设 `Disallow`；当前 robots 已是全开，保持即可。
- 若你提供具有 `#zone:waf:write` / `#account:waf:write` 权限的 Cloudflare API Token，我可以直接用 API 帮你建好这条 WAF Allow 规则，不必手动点后台。
