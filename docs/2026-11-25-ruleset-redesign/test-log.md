# Test log: 静态骨架 + 动态规则集

### 2026-11-25 旧配置基线

开发分支工作树有未提交文件。执行 `npm test -- --run server/golden.test.ts`，7 项通过。

### 2026-11-25 生成器前置检查

通过 curl 对配置中的各上游发起只读请求，均返回 HTTP 200；未执行生成器。使用 sha256sum -c 校验官方 Go 1.26.11 linux-amd64 压缩包，通过。

### 2026-11-25 旧端点基线扩展

两次执行 `npm test -- --run server/golden.test.ts`，首次捕获缺少的文件，第二次只读比较，均为 34 项通过。

### 2026-11-25 生成器移植

在 rulesets 下执行 `/tmp/mihomo-go/go/bin/go test ./...`，首次下载 yaml.v3 因 TLS EOF 失败。用 curl 获取官方模块，指定 GOPROXY=file:///tmp/rr-mod 后重新运行，旧测试对端口和进程规则的预期与计划冲突。调整过滤测试后编译报告缺少 strings 导入，修复后通过。改用 curl 获取上游后，首次编译报告未使用的 io 导入，删除后同一命令通过。
执行 `/tmp/mihomo-go/go/bin/go run . -mihomo /tmp/mh/mihomo`，首次在 Sukka LAN 列表失败；加 GODEBUG=tlsmlkem=0,http2client=0 后在 IANA 失败。改用 curl 后 IANA TLS 失败，完全限定域名重试又在 v2fly 下载时 TLS 失败。尚未验证整套输出。

### 2026-11-25 旧渲染器迁移

执行 `npm test -- --run server/golden.test.ts server/legacy/render.test.ts`。首次 34 个黄金用例通过，12 个单元测试因导入别名错误失败。修正别名后重跑，46 项全部通过。

### 2026-11-25 实际生成与配置检查

- 在 rulesets 中执行 `/tmp/mihomo-go/go/bin/go test ./...` 通过；执行 `/tmp/mihomo-go/go/bin/go run . -mihomo /tmp/mh/mihomo` 两次成功。生成 12 份 provider、stats.json 和 NOTICE，检查 domain、ipcidr 的 MRS 往返一致。custom 初始均为空。Go 测试覆盖 custom 中的域名和保留 no-resolve 的 IP 规则。
- 执行 `MIHOMO_BIN=/tmp/mh/mihomo npm test -- --run server/profile.test.ts`，10 项通过，其中 5 次通过 mihomo -t。每个进程使用独立临时配置目录。
- 执行 `sha256sum /tmp/mh/m.gz`，结果为 223fab877e5795ce780ba39902e5f0b1113c1256ae244a7160f1165e017e9ccc，与官方 v1.19.34 发布记录中 mihomo-linux-amd64-v1.19.34.gz 的摘要一致。
- 首次 `npm run build` 在 node:fs 等 Node 类型处失败。执行 `npm install -D @types/node@24 --ignore-scripts --no-audit --no-fund` 并启用 node 类型后，第二次构建发现 Vite HTTPS 配置不能用布尔值，改为空配置对象。再次 `npm run build` 成功，`MIHOMO_BIN=/tmp/mh/mihomo npm test` 首轮全量 66 项通过，补充路由和骨架一致性断言后 86 项通过。
- 在临时副本中轮流移出 14 个文件并执行 `node rulesets/check-assets.mjs`，每次均非零退出，错误包含缺失文件名；完整目录检查通过。

### 2026-11-25 本地 Worker 运行时

启动已构建 Worker（仅使用占位值）：

```sh
WRANGLER_SEND_METRICS=false node_modules/.bin/wrangler dev --local --config dist/unified_mihomo_conf/wrangler.json --ip 127.0.0.1 --port 19884 --local-protocol https --var BASIC_AUTH_CREDENTIALS:test:test --var MAIN_SUBSCRIPTION_URL:https://subscription.invalid --var PUBLIC_BASE_URL:https://rules.invalid --var DOH_URL:https://dns.invalid/query --var TAILSCALE_CONTROL_URL:https://control.invalid
```

最初直接 curl HTTPS：静态文件为 200、缺失为 404，受保护路由为 403。本地 Wrangler 内部转发协议为 HTTP。用 `curl -ks -H 'X-Forwarded-Proto: https' -o /dev/null -w '%{http_code}' "https://127.0.0.1:19884$route"` 并分别加或不加 `-u test:test` 检查。首次批量检查误用 zsh 的 path 变量，curl 未运行，改用 route 重跑。真实规则文件两种情况均 200，缺失文件均 404。根路径无凭据 401、有凭据 302。v2 页面、auth-context 和 laptop 配置分别是 401/200。全量检查 14 个公开资产及 9 条受保护路径通过。

### 2026-11-25 隔离 DNS、provider 和刷新

执行 `python3 /tmp/rr-verify-dns.py`。使用手机骨架的策略键及实际 provider 声明，保留顺序，用三个不同的回环 UDP 解析器模拟各 DNS 服务。临时目录内启动自己的 mihomo，关闭 TUN，控制器为 127.0.0.1:19886，DNS 端口 19887，mixed-port 19888，本地 HTTP 提供全部规则。通过控制器逐个核对 ruleCount 和下载缓存，结束时只终止测试创建的进程。首次因 ASN 下载失败而缺少 IP-ASN；使用 `curl -fsSL --retry 5 --retry-all-errors --retry-delay 1 https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/GeoLite2-ASN.mmdb -o /tmp/rr-ASN.mmdb` 获取实际数据库并放入测试目录。再次运行 12 个 provider 条数相同；unmatched.invalid 属于实际 direct 集，改用临时后缀重跑。

`dig @127.0.0.1 -p 19887 "$host" +short +time=2 +tries=1`：test.tailscale.gjm20.top → 10.9.0.1，gjm20.top → 10.9.0.2，unmatched.zz-check-dns → 10.9.0.1，host.tailnet → 10.9.0.3。更新临时服务中的 custom-direct 域名并通过隔离实例的 provider 接口刷新后，新域名走 10.9.0.2；未重新导入骨架。未连接实际 Tailscale、国内 DNS 或订阅服务。

### 2026-11-25 保密检查

从 Git HEAD 的两个原始片段在内存中提取敏感字段，遍历工作树普通文件（含 node_modules、dist 和本地运行时缓存，跳过 .git），仅打印匹配文件名，结果为零。线上日志、仓库历史和真实设备验证留待后续阶段。

### 2026-11-25 最终验证

在 rulesets 下执行 `/tmp/mihomo-go/go/bin/go build -o /tmp/rr-generator .`。在临时目录用 `/tmp/rr-generator -out out -mihomo /bin/false` 分别注入无效 Clash 规则、不满足的归属断言和转换器失败，三次均退出 1，均未写入 stats.json。前述实时上游 TLS 失败也均以非零状态结束。加入组合规则的进程及端口过滤后，重跑 `/tmp/mihomo-go/go/bin/go test ./...` 和 `/tmp/mihomo-go/go/bin/go run . -mihomo /tmp/mh/mihomo`，均通过。最终 direct 域名 110628 条、IP 9705 条、classical 19 条；global 对应 18993、465、163 条。

最终从根目录执行：

```sh
MIHOMO_BIN=/tmp/mh/mihomo npm test
npm run build
python3 /tmp/rr-worker-check.py
python3 /tmp/rr-verify-dns.py
(cd rulesets && /tmp/mihomo-go/go/bin/go test ./...)
git diff --check
```

86 项 Vitest 全部通过，包含全部五个 mihomo -t。类型检查和生产构建通过，未提供生产 secret 时 Wrangler 有预期提示。独立本地 Worker 返回的 14 个文件与构建结果逐字节一致；缺失规则为 404，受保护路由和真实 JS/CSS 均要求认证。旧 auth-context 已移除，新端点只包含用户名密码。DNS、计数、动态刷新复测通过。Go 测试和 diff 检查通过，最终保密扫描仍为零匹配。

### 2026-11-25 第一轮修复验证

从根目录执行以下命令。首次修复后四个 Go 包、实时生成、87 项 Vitest、生产构建均通过。收紧 dnsmasq 域名语法并新增 IANA 主机回归后重新执行，全数通过；构建提示本地未提供五项生产绑定。

```sh
(cd rulesets && MIHOMO_BIN=/tmp/mh/mihomo GOPROXY=file:///tmp/rr-mod /tmp/mihomo-go/go/bin/go test ./... && GOPROXY=file:///tmp/rr-mod /tmp/mihomo-go/go/bin/go run . -mihomo /tmp/mh/mihomo)
MIHOMO_BIN=/tmp/mh/mihomo npm test
npm run build
git diff --check
node_modules/.bin/wrangler deploy --help >/tmp/rr-deploy-help
node_modules/.bin/wrangler triggers deploy --help >/tmp/rr-trigger-help
```

实时生成得到 15 个公开文件；stats.json 显示两个 IANA CSV 均来自正常主机名。输出单测使用指定二进制校验混合条目和无效逻辑子规则，并检查失败后目录为空。Worker 回归验证任意旧路径、health 和 v2 路由。帮助命令均成功，只读取参数说明。许可证核对命令如下，五次下载均成功；另核对 https://www.iana.org/help/licensing-terms 。

```sh
for repo in v2fly/domain-list-community felixonmars/dnsmasq-china-list gaoyifan/china-operator-ip SukkaW/Surge liblaf/route-rules; do (curl -fsSL --max-time 20 https://raw.githubusercontent.com/$repo/HEAD/LICENSE -o /tmp/rr-license-${repo%/*}) & done
wait
```

### 第 9 步：本地演练

以下变量对应实际运行目录：`T=/tmp/mihomo-step9.magipEdk`，`D=docs/2026-11-25-ruleset-redesign`。通过 PyPI 的 git-filter-repo 2.47.0 发布 JSON 下载 wheel，在内存计算 SHA256 并与发布元数据比较，相等后才解包；SHA256 为 `2cd04929b9024e83e65db571cbe36aec65ead0cb5f9ec5abe42158654af5ad83`。使用同一 HTTPS 发布渠道提供的校验值，未验证独立签名。

- 准备：`git clone -q --no-local --single-branch --no-tags . "$T/src"`；`git ls-files -co --exclude-standard -z | rsync -a --ignore-missing-args --from0 --files-from=- . "$T/src/"`；`git ls-files -d -z | (cd "$T/src"; xargs -0 -r rm --)`；`git -C "$T/src" add -A`；`git -C "$T/src" commit -qm rehearsal`。临时提交包含受版本管理的改动和未忽略的新文件。
- `"$D/clean-history.sh" "$T/src" HEAD "$T/out" --filter-repo "$T/git_filter_repo.py"`：1 个引用，271 个对象，匹配 0。两库 `git rev-parse 'HEAD^{tree}'` 相同；`git log --format='%an|%ae|%ai|%cn|%ce|%ci'` 输出用 cmp 逐字节比较相同，共 19 个提交（原分支 18 加演练提交 1）。
- 假值试验：`cp "$T/literals" "$T/src/canary"; git -C "$T/src" add canary; git -C "$T/src" commit -q -F "$T/literals"; git -C "$T/src" rm -q canary; git -C "$T/src" commit -qm remove`。临时包装器仅从回调替换表移除假值，验证器仍使用完整表。`"$D/clean-history.sh" "$T/src" HEAD "$T/bad" --literals "$T/literals" --filter-repo "$T/bypass"`：275 个对象，匹配 2，退出 1。`"$D/clean-history.sh" "$T/src" HEAD "$T/good" --literals "$T/literals" --filter-repo "$T/git_filter_repo.py"`：275 个对象，匹配 0，退出 0。
- 清洗副本中 `npm ci` 成功。首次 `go test ./...` 因默认 PATH 找不到 Go 而失败。修正为 `export PATH=/tmp/mihomo-go/go/bin:$PATH`，在副本 rulesets 下 `go test ./...` 四个包通过，`go run . -mihomo /tmp/mh/mihomo` 退出 0。在副本根目录执行 `cp -a /home/jcav/unified-mihomo-config/public/v2/rules/. public/v2/rules/`、`MIHOMO_BIN=/tmp/mh/mihomo npm test`（6 个文件，87 项通过）、`npm run build`（成功）。使用独立测试二进制。
- 加入手册和脚本最终修订后，在临时源分支 final 再次执行 `"$D/clean-history.sh" "$T/src" final "$T/final" --filter-repo "$T/git_filter_repo.py" --literals "$T/literals"`：1 个引用，272 个对象，匹配 0；19 个提交，顶端 tree 及上述身份日期比较仍相同。每次运行均通过源库状态比较。用 `gh run download --help`、`gh run view --help` 和 `node_modules/.bin/wrangler rollback --help` 核实参数；未执行上线操作。
临时源码、旁路失败副本、清洗副本、工具及日志已删除。
