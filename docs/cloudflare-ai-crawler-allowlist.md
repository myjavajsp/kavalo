# Cloudflare 放行 AI 爬虫规则（kavalo.top）

> 背景：站点 `robots.txt` 已是 `User-agent: * Allow: /`（全开），但实测 **ClaudeBot 在 Cloudflare 层被 403 拦截**（其余 GPTBot / ChatGPT-User / PerplexityBot / Google-Extended / CCBot / Applebot-Extended 均 200）。
> 说明：拦截发生在 Cloudflare 的 WAF / Bot Management（按 User-Agent 命中），**与站点代码和 robots.txt 无关**，修复点在 Cloudflare 后台。
> 目标：显式放行主流 AI 搜索引擎爬虫，让站点能被 ChatGPT / Claude / Perplexity / Gemini / Apple / Common Crawl 正常抓取与引用。

---

## 方案 A：WAF 自定义规则（推荐，最稳）

1. 登录 Cloudflare 控制台 → 选 `kavalo.top` 站点。
2. 左侧 **Security** → **WAF** → **Custom Rules**。
3. 点 **Create rule**（或「添加规则」），填写：
   - **Rule name**：`Allow AI search crawlers`
   - **When incoming requests match…**（匹配条件）：
     - 字段：`User Agent`
     - 运算符：`matches regex`
     - 值（正则，含忽略大小写）：
       ```
       (?i)^(GPTBot|ChatGPT-User|PerplexityBot|Google-Extended|CCBot|ClaudeBot|Applebot-Extended|anthropic-ai|Omgilibot|Amazonbot)$
       ```
   - **Action**（执行）：`Allow`（允许）
   - **Placement**（关键）：把这条规则**排到任何「Block / Challenge / Bot Fight」规则之上**（规则列表靠上 = 先执行）。
4. **Deploy / 保存**。

> 提示：若站点开启了 **Bot Fight Mode / Super Bot Fight Mode**（Security → Bots），它本身可能拦未知 UA。上述 Allow 规则在它之上即可豁免这些 AI 爬虫。确认 `ClaudeBot` 在 Allow 列表内即可。

---

## 方案 B：反向思路（仅拦已知坏 bot）

若你更想「默认放行、只拦垃圾」，可在 WAF 里只对明确垃圾 UA 设 Block，不必维护 AI 白名单。但对 kavalo 当前症状，**方案 A 更省心**——AI 爬虫 UA 是固定集合，列全即可。

---

## 验证方法（改完务必测）

在本地或任意能出网的机器跑：

```bash
for ua in GPTBot ChatGPT-User PerplexityBot Google-Extended CCBot ClaudeBot Applebot-Extended; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -A "$ua" "https://kavalo.top/blog/airline-approved-small-dog-carriers/")
  echo "$ua -> $code"
done
```

期望：**全部 200**。若 ClaudeBot 仍为 403，检查规则是否排在 Bot Fight 规则之下，或正则是否漏了 `ClaudeBot`。

---

## 备注

- 这些 UA 均为各 AI 引擎官方公布的爬虫标识（OpenAI、Anthropic、Perplexity、Google、Common Crawl、Apple）。放行它们不会带来垃圾流量，反而提升站点在 AI 答案中的可见性——这正是 GEO 的目标。
- 切勿在 `robots.txt` 里对它们设 `Disallow`；当前 robots 已是全开，保持即可。
