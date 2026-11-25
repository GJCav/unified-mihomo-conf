# Plan: 静态骨架 + 动态规则集

Status: approved（第 2 版，2026-11-25 用户批准）

## Goal and background

设备扫码导入一次配置骨架，之后通过 mihomo `rule-providers` 自动获取规则更新，不再
反复下载整个配置。GitHub Actions 每日直接从上游拉取、合并规则，随 Worker 一起部署到
Cloudflare。旧 Import URL 保持可用，新功能放在 `/v2/`。项目转为公开。

## Requirements

1. 加 `nameserver-policy`：中国域名用 101.6.6.6、阿里、腾讯公共 DNS；其余域名继续用现有带凭据的 DoH。
2. 规则直接从各上游拉取，不下载参考项目（liblaf/route-rules）生成的规则集。每日至少一次，由 GitHub Actions 完成。
3. 生成的规则集不提交到 git，作为 Worker 静态资源上传到 Cloudflare，终端从 Worker 域名下载。
4. 配置分为静态骨架和动态规则集。v2 每个 profile 一份骨架：gateway、server、laptop、ipad、phone，不再拼接 snippet。
5. 旧 URL 全部保持兼容；新 URL 在 `/v2/` 下；`/` 默认重定向到 `/v2/` 的新 UI。
6. 分组顺序：tailnet → custom → direct → global → fallback（`MATCH,default`）。custom 拆为 `custom-proxy` 和
   `custom-direct`，都为空。tailnet 从现有规则迁移；direct 合并参考项目 direct 的上游；global 合并其 us 和 global 的上游。
7. 每组拆为 `.domain.mrs`、`.ipcidr.mrs`、`.classical.txt`。
8. v2 保留二维码下载骨架和 Basic Auth；规则集公开，不需认证。
9. 新建公开仓库，推送清洗后的历史；旧仓库私有归档。提交作者邮箱保持不变。
10. 规则 URL 前缀（Worker 域名）由用户填写在 GitHub secret 中，不写仓库名。
11. 生成出错时表现为 GitHub Action 失败。不判断“规则异常减少”。

保密（不得出现在仓库、历史、CI 日志、构建产物、规则集中）：

- **代理订阅地址：严格保密**
- DoH 凭据、Tailscale 控制服务器地址、Basic Auth 凭据、Tailscale auth key、Cloudflare token

可公开：Worker 域名、gjm20.top、tailnet 网段等其他内容。

## Out of scope

- 参考项目的规则浏览网页。
- 网络模型、profile 种类、代理组结构、Basic Auth 机制。
- gateway 的 `external-controller` 密码和 DNS 块（用户确认不改）。
- 更新旧 URL 的规则内容。旧 URL 冻结，只保证兼容。

## Acceptance criteria

1. 旧 Import URL（`/?…&o=y`、`/config.yaml?…`，含紧凑、完整单词和 `r=b` 形式）的输出与改动前逐字节相同；
   DoH 和控制服务器地址改由 secret 注入，填入原值后相同。
2. `/` 及不带 `o=y` 的旧页面链接重定向到 `/v2/`，不携带原查询参数。
3. 五个 v2 骨架用占位 secret 渲染后都通过 `mihomo -t`。
4. 规则重新部署后，设备不重新导入即可获得新规则；向 custom 源文件加规则不需改骨架。
5. 规则文件无需认证；不存在的规则文件返回非 2xx，绝不返回 HTML 200。其他路径仍需认证。
6. 上游下载、解析、断言、mrs 往返校验任一失败，job 失败且不部署，线上版本不变。
7. 命中 direct 域名集的查询发往三个国内 DNS，其余发往 DoH；phone 含 Tailnet DNS 策略，ipad 不含。
8. 公开仓库的文件、全部历史、CI 日志和 artifact 中搜不到任何保密项。订阅地址只出现在认证后的骨架里。
9. `npm test`、`npm run build`、`go test ./...` 通过。

## Design

### 目录

```text
profiles/{gateway,server,laptop,ipad,phone}.yaml   v2 完整骨架，只含占位符
rulesets/                                          Go 生成器、rulesets.json、sources/
server/legacy/ + snippet/                          冻结的旧渲染器和片段
server/ src/                                       Worker 和 v2 页面
public/v2/rules/                                   生成物，gitignore
.github/workflows/{ci,deploy}.yml
```

### 规则生成

- 移植参考项目（MIT，保留版权声明）的生成器代码和测试，删除网页和发布分支部分。只复用代码和上游清单。
- 各上游直接从原地址下载。不带入参考项目作者手工维护的文件，只保留官方文档列出的
  `+.tailscale.com`、`+.tailscale.io`。
- 过滤 `PROCESS-NAME`、`DST-PORT`，计入报告。保留 `IP-ASN`。
- direct 加本地文件，放入现有全部手写 DIRECT 域名和清华网段，`optional_if_covered`。实测上游目前缺 7 个：
  usenix.org、dblp.com、bing.com、alipayeshop.com、wechatos.net、ubuntu.com、crychic.uk。
- 现有 `proxy-websites` 中的 gstatic 等按上游处理（部分走 direct），不保留手写规则。
- direct 排除 tailnet；global 排除 tailnet、direct。IP 精确相减；域名只删除被前组完整覆盖的规则，
  部分重叠（direct 的 `+.gjm20.top` 与 tailnet 的 `+.tailscale.gjm20.top`）由规则顺序和 DNS 策略顺序决定。`100.64.0.0/10` 中除 `100.88.0.0/16` 外仍归 direct。
- 断言只覆盖本地源可保证的归属，加 `claude.ai`、`github.com` 归 global，避免上游正常变动造成失败。
- `custom-proxy`、`custom-direct` 各固定输出 `.domain.txt` 和 `.classical.txt`（`format: text`），可为空；
  IP 规则写在 classical 中。mihomo 无法生成空 mrs。
- 另输出 `stats.json` 和 `NOTICE`（上游来源与许可证，含 AGPL-3.0 的 SukkaW/Surge）。骨架引用的文件缺失即失败。

### 规则顺序

```yaml
- RULE-SET,tailnet-domain,<TAILNET>
- RULE-SET,tailnet-ipcidr,<TAILNET>,no-resolve
- RULE-SET,custom-proxy-domain,default
- RULE-SET,custom-proxy-classical,default
- RULE-SET,custom-direct-domain,DIRECT
- RULE-SET,custom-direct-classical,DIRECT
- RULE-SET,direct-domain,DIRECT
- RULE-SET,direct-classical,DIRECT
- RULE-SET,global-domain,default
- RULE-SET,global-classical,default
- RULE-SET,global-ipcidr,default,no-resolve
- RULE-SET,direct-ipcidr,DIRECT
- MATCH,default
```

`<TAILNET>` 在 ipad、phone 为 `tailscale`，其余为 `DIRECT`。`direct-ipcidr` 会解析域名，保留现有 `GEOIP,CN`
的效果。`geox-url` 只留 `asn`，指向 jsDelivr 的 `GeoLite2-ASN.mmdb`（已确认存在）。实测该下载失败时只跳过
这一条规则，不影响启动和同组其他规则。

### 规则的托管与下载

- URL 为 `{{{public_base_url}}}/v2/rules/<file>`，`proxy: DIRECT`，`interval: 86400`，各有唯一 `path` 作本地缓存。
  显式写 `proxy: DIRECT`，不依赖默认行为：实测 mihomo 的内部下载（ASN 数据库）按路由规则走，
  首次启动时会落到 `MATCH`，即依赖代理。ASN 下载本身失败无害，见上。
- Cloudflare 直接提供文件，不经过 Worker：`run_worker_first: ["/*", "!/v2/rules/*"]`。无需认证，不占用
  Worker 请求额度和限流（每台设备启动时下载约 11 个文件，同一出口 IP 的多台设备可能触发 60 次/分钟限流）。
- `not_found_handling` 改为 `none`。实测 mihomo 会把 200 的 HTML 当成文本规则解析，而 401 会被拒绝并保留旧规则；
  因此不能沿用 SPA 回退。缺失文件应落到 Worker 并返回 401/404，实现时验证。

### DNS（server、laptop、ipad、phone）

- `default-nameserver`：三个国内 IP。`nameserver`：`{{{doh_url}}}`。
- `nameserver-policy` 按顺序：phone 的 `'+.tailnet': ts://tailscale`；
  `rule-set:tailnet-domain,custom-proxy-domain` → DoH；
  `rule-set:custom-direct-domain,direct-domain` → `101.6.6.6`、`223.5.5.5`、`119.29.29.29`（普通 UDP）。
- 不设 `proxy-server-nameserver`，节点域名解析维持现状。gateway 维持无 `dns` 块。

### Worker 路由

| 路径 | 认证 | 行为 |
| --- | --- | --- |
| `/v2/rules/*` | 否 | 静态规则文件 |
| `/v2/` | 是 | 新 UI，`?profile=<id>` 加所需参数 |
| `/v2/config/<profile>.yaml` | 是 | v2 骨架，参数仅 `s`（server）、`h` 和 `k`（ipad、phone） |
| `/v2/auth-context` | 是 | 用户名和密码，用于 Import URL；不返回任何其他 secret |
| `/config.yaml`，或 `/v2/` 以外任意路径带 `o=y` | 是 | 冻结的旧渲染器（`/health` 优先，与旧版一致） |
| `/` 其他情况 | 是 | 302 到 `/v2/`，丢弃查询参数 |
| `/health` | 是 | 不变 |

- 旧片段中的 DoH 地址和控制服务器地址改为占位符，从 secret 注入。旧设备定期刷新时会自动拿到轮换后的值。
- 新旧渲染器互不依赖。v2 的 profile 列表和所需参数只在一个共享模块定义。
- 新页面只剩 profile 选择、所需参数、Import URL、二维码、预览。30 天缓存保留。

### 订阅地址

- 只存于 GitHub environment secret 和 Worker secret，只在渲染骨架时注入。
- 移出 `/auth-context`，页面不再显示该字段。mihomo 需要它，所以认证后的骨架和预览中必然存在。
- 错误信息、日志、测试、artifact 不含其值；响应保持 `private, no-store`。
- 已检查现有历史：URL 只有示例域名，没有真实订阅地址。清洗后再用真实值搜索一次（由用户在本地提供，不进日志）。

### CI 和 secrets

| Workflow | 触发 | Job |
| --- | --- | --- |
| `ci.yml` | pull_request | 测试、构建；`contents: read`，无 secret |
| `deploy.yml` | 推送 main、每日、手动 | `generate` → `deploy` |

- `generate`：运行 Go 测试和生成器，上传 artifact。接触上游内容，无 secret。
- `deploy`：下载规则到 `public/v2/rules/`，测试、构建、上传并发布。使用限 main 的 `production` environment。
- GitHub secrets 是唯一来源：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`BASIC_AUTH_CREDENTIALS`、
  `MAIN_SUBSCRIPTION_URL`、`DOH_URL`、`TAILSCALE_CONTROL_URL`、`PUBLIC_BASE_URL`。
- 后五项写入临时文件，用 `wrangler versions upload --secrets-file` 与代码同版本上传后删除。已确认 4.124.0 支持。
- `wrangler.jsonc` 的 custom domain 保留（用户确认 Worker 域名可公开），须与 `PUBLIC_BASE_URL` 一致。
- Action 固定到 commit SHA；mihomo 固定版本并校验 SHA256；不用 `pull_request_target`。
- 规则不在 git 中，所以推送 main 也会重新生成；上游不可用时该次部署失败，线上保持旧版本。
- 公开仓库 60 天无活动会停用定时任务，而规则不再产生提交。`deploy.yml` 末尾加一步重新启用自身
  （仅该 job 有 `actions: write`），效果需观察；停用后客户端继续用最后的规则。

### Where the two proposals differed

| Topic | Opus | Neon | Decision and reason |
| --- | --- | --- | --- |
| 生成器 | 移植 Go | TypeScript 重写 | Go。参考实现有测试且在持续运行 |
| 规则托管 | raw + 代理 | jsDelivr + 直连 | 用户决定：Worker 静态资源，直连下载 |
| 规则保存 | `rules` 分支 | `rules` 分支 | 用户决定：不进 git |
| 缩水保护 | 20% | 20% 加下限 | 用户决定：不做 |
| 旧 URL | 410 | 410 | 用户决定：保持兼容 |
| tailnet 规则范围 | 所有 profile | 仅 ipad、phone | 所有。direct 已扣除 tailnet，否则会落到 `MATCH,default` |
| custom | 单组 | 指出须先定出站 | 拆两组（用户同意） |
| custom 文件 | 三个 | 两个 | 两个 |
| 手写直连规则 | 补 7 个 | 迁移部分 | 全部迁移且 `optional_if_covered` |
| IP 规则顺序 | global 先 | direct 先 | global 先且 no-resolve，命中时少一次解析 |
| 进程类规则 | 全部过滤 | 只去掉作者个人的 | 全部过滤 |
| 节点域名 DNS | 维持 | 国内 DNS | 维持 |
| secrets 上传 | `--secrets-file` | `secret bulk` | 前者，代码与 secret 同一版本 |
| `/auth-context` | 未提 | 不返回新 secret | Neon，并移除订阅地址 |
| 历史 | filter-repo | 单一提交 | filter-repo，符合用户要求 |

## Compatibility and migration

旧设备不受影响，可随时重新扫码迁移到 v2，没有期限。不迁移的设备继续使用旧的静态规则。

切换顺序（★ 需用户执行或当场授权）：

1. 在开发分支完成实现、审查、验收。
2. 全新 clone 上用 git-filter-repo 替换 DoH 凭据和控制服务器地址，保留作者邮箱，只保留 `main`，扫描全部历史。
   两项都从 `109bbb8` 引入。本地 `refs/t3/*` 不得推送。
3. ★ 停用旧仓库的部署 workflow。
4. ★ 创建公开仓库，禁用 Actions，配置 environment 和 secrets，推送清洗后的 `main`。
5. ★ 启用 Actions，手动运行 `deploy.yml`。
6. 核对旧 URL 输出、规则文件、未认证访问。
7. ★ 先迁移 laptop，再 server、gateway、ipad、phone。
8. 建议：★ 轮换 DoH 凭据。更新 secret 并部署后，旧设备刷新、v2 设备重新导入。

回滚：用 wrangler 回到旧 Worker 版本；旧 URL 在新旧版本中都可用。规则有问题时同样回滚版本，规则随版本回退。

## Affected files

- 移动：`server/render.ts` 及测试到 `server/legacy/`；`snippet/` 冻结，只替换两处占位符
- 新增：`profiles/`、`rulesets/`、v2 渲染器和共享 profile 模块、`.github/workflows/ci.yml`
- 修改：`server/index.ts`、`src/`、`index.html`、`vite.config.ts`、`wrangler.jsonc`、`.dev.vars.example`、
  `.gitignore`、`deploy.yml`、`README.md`、`AGENTS.md` 的项目规则
- 许可证：`rulesets/` 保留参考项目 MIT 声明

## Steps

1. 改动前生成旧 URL 的黄金输出（占位 secret）作为测试。
2. 生成器：移植、裁剪、过滤、custom、断言、测试。
3. 旧渲染器：移动、注入 secret，通过黄金测试。
4. 五个骨架和 v2 渲染器；一致性测试；`mihomo -t`。
5. Worker 路由、静态资源配置、v2 页面（Vite 输出到 `/v2/`）。
6. Workflow：ci、deploy。
7. 文档：README、AGENTS.md 项目规则、`.dev.vars.example`。
8. 独立审查、决策、修复。
9. 历史清洗脚本和演练（只在临时 clone 中）。
10. 按上面的顺序切换。

## Test plan

- Go：移植的测试；`100.64.0.0/10` 减 `100.88.0.0/16`；空 custom；过滤；上游失败时非零退出。
- 从各上游实际生成一次，检查断言和条数；不与参考项目的产物比较。
- Vitest：黄金输出、路由表每一行、重定向、认证、`/auth-context` 内容、五个 profile 渲染与转义、骨架一致性。
- 本地 Workers 运行时：规则文件无需认证、缺失文件非 2xx、`/v2/` 资源路径正确。
- mihomo：固定版本 `-t`；隔离实例从本地服务加载所有 provider，核对条数和 DNS 分流。
- 保密扫描：工作树、历史、artifact、CI 日志。
- 设备（用户）：冷启动、国内外访问、tailnet、断网重启后使用缓存。

## Risks

- `run_worker_first` 负向规则下缺失文件的行为，文档未说明，须在本地运行时和线上各验证一次。
- 冷启动和 DNS 分流以真实设备为准；本机运行着系统 mihomo，网络测试可能受影响。
- Worker 域名在国内直连的可达性决定规则更新；不可达时使用本地缓存。
- direct 不只含中国域名，其中的学术站点和 Google @cn 域名会用国内 DNS 解析。
- 101.6.6.6 在校外的可用性未验证；并发查询，单个失败影响有限。
- 定时任务 60 天停用的规避方式未经验证。
- iOS 客户端内存：参考项目同类最大文件 533 KB，另有 9 MB 的 ASN.mmdb，需实机确认。

## Open questions

无。以下理解已随批准确认：

1. 不带 `o=y` 的旧页面链接重定向到 `/v2/`，旧编辑页面移除。
2. 未提出异议的 `PROCESS-NAME`、`DST-PORT` 过滤照做。
3. 订阅地址不再显示在页面字段中，但仍在认证后的骨架里。

## Plan changes

- 2026-11-25 第 2 版：按用户反馈改为规则随 Worker 部署、保留旧 URL、`/v2/` 路径、不做缩水保护、保留 IP-ASN、
  custom 拆分为空、gstatic 按上游、邮箱不变、域名前缀入 secret、订阅地址严格保密、只从原上游拉取。
- 2026-11-25 批准后：实施中发现 direct 的 `+.gjm20.top` 覆盖 tailnet 的 `+.tailscale.gjm20.top`，而域名 mrs
  无法扣除子树，后者会被国内 DNS 解析。在 `nameserver-policy` 中把 `rule-set:tailnet-domain` 放在 direct 之前并
  指向 DoH，保持现有解析方式。已用隔离 mihomo 和三个模拟 DNS 验证优先级，phone 的 `+.tailnet` 仍优先。
- 2026-11-25 审查第 1 轮：旧 Worker 在任意路径接受 `o=y`，路由表改为与其一致。
