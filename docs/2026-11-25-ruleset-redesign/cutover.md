# 切换到公开仓库

★ 表示用户执行或当场授权。在可信本机使用 Bash，关闭终端录制及 shell 跟踪。下列仓库名、运行 ID、版本 ID 均需替换。保留原私有仓库和设备的旧配置，直到全部设备验收。

1. ★ 审查通过并授权提交后，在源仓库根目录执行下列命令。核对分支为开发分支、暂存文件都属于本次变更。若有误，在提交前用 `git restore --staged -- <路径>` 撤出。此步无需推送。

   ```bash
   git status --short --branch
   git add -A
   git diff --cached --stat
   git commit -m '完成规则集与配置迁移'
   ```

2. ★ 在同一个本机 shell 中执行。指定校验过的 git-filter-repo 可执行文件。输入真实订阅地址时终端关闭回显，临时文件权限为 0600。核对输出为一个引用、零匹配，再检查只有 main 且没有远端。失败时隔离该临时目录，退出 shell 清理，再从源提交重做。

   ```bash
   set -eu
   set +x
   umask 077
   src=$PWD
   tmp=$(mktemp -d /tmp/mihomo-cutover.XXXXXXXX)
   trap 'rm -rf -- "$tmp"' EXIT
   filter=/path/to/verified/git-filter-repo
   mkdir "$tmp/main"
   IFS= read -rs -p '真实订阅地址：' subscription
   echo
   printf '%s\n' "$subscription" > "$tmp/literals"
   unset subscription
   docs/2026-11-25-ruleset-redesign/clean-history.sh "$src" HEAD "$tmp/main" \
     --filter-repo "$filter" --literals "$tmp/literals"
   rm "$tmp/literals"
   git -C "$tmp/main" for-each-ref --format='%(refname)'
   git -C "$tmp/main" remote
   ```

3. ★ Cloudflare 控制台 → Workers & Pages → 当前 Worker → Deployments，记录当前承载流量的版本 ID。使用现有设备的旧 Import URL 私下刷新，记录 profile、策略组、节点和 DNS 的预期行为。GitHub 旧仓库 → Actions → 部署 workflow → 菜单 → Disable workflow。确认已停用且没有进行中的部署，等已开始的部署结束后复核当前版本。若此时中止，点 Enable workflow 恢复旧部署。

4. ★ GitHub → New repository，输入新仓库名，选择 Public，不初始化 README、许可证或 gitignore。立即在空仓库 Settings → Actions → General → Actions permissions 选择 Disable actions 并保存。Settings → Environments → New environment → `production` → Deployment branches and tags → Selected branches and tags → Add deployment branch rule → Branch → `main`。在该环境的 Environment secrets → Add environment secret 逐一录入：

   `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`BASIC_AUTH_CREDENTIALS`、`MAIN_SUBSCRIPTION_URL`、`DOH_URL`、`TAILSCALE_CONTROL_URL`、`PUBLIC_BASE_URL`。核对七个名称和 main 限制，最后一项须与现有 Worker 自定义域名相符。保持现有认证与服务地址。确认 Actions 已禁用，再执行：

   ```bash
   new_repo='<OWNER>/<NEW_REPOSITORY>'
   git -C "$tmp/main" push "git@github.com:$new_repo.git" refs/heads/main:refs/heads/main
   ```

   在 Branches 核对唯一分支 main，在 Actions 核对没有运行。配置错误可在启用前修正。若发现公开内容泄密，立即限制仓库访问并轮换受影响凭据，删除提交无法撤回已获取的副本。

5. ★ 新仓库 Settings → Actions → General 允许工作流所需的 Actions，保存。Actions → Publish Worker and rules → Run workflow → main → Run workflow。在 Actions 禁用期间推送的 workflow 不会被 GitHub 登记，列表为空时需再向 main 推送一个提交，该推送本身会触发部署。核对 generate 和 deploy 均成功，Cloudflare 上新版本承载流量。部署失败时先检查当前生产版本，必要时按第 9 项回退。

6. ★ 在本机隐私窗口打开公开规则和不存在的规则，用开发者工具 Network 核对前者 200 且内容为规则，后者 401 或 404。全新隐私会话打开 /v2/、/config.yaml、/v2/auth-context 和 /health，未提供认证时均应要求认证。使用原有设备的旧 URL 刷新，检查 /config.yaml 及旧 o=y 链接仍产生预期 YAML。检查 profile、策略组、DNS 和订阅更新。勿粘贴链接到 issue 或日志。检查失败时暂停迁移，按第 9 项回退。

   ★ 获取此运行的日志和解压后的 artifact，在本机逐项隐藏输入敏感值，包括订阅地址、认证密码、DoH 密码、控制服务器主机和部署令牌。输入空行结束；输出只显示匹配次数。非零时停用新部署、限制受影响日志和 artifact 访问并轮换泄露凭据。

   ```bash
   run_id='<RUN_ID>'
   mkdir "$tmp/audit"
   gh run view "$run_id" -R "$new_repo" --log > "$tmp/audit/run.log"
   gh run download "$run_id" -R "$new_repo" -D "$tmp/audit/artifacts"
   python3 - "$tmp/audit" <<'PY'
   import getpass, pathlib, sys
   files = list(pathlib.Path(sys.argv[1]).rglob('*'))
   assert any(p.is_file() for p in files if 'artifacts' in p.parts)
   assert (pathlib.Path(sys.argv[1])/'run.log').stat().st_size
   hits = checked = 0
   while value := getpass.getpass('敏感值（空行结束）：'):
       checked += 1
       hits += sum(p.read_bytes().count(value.encode()) for p in files if p.is_file())
   print(hits)
   sys.exit(not checked or hits != 0)
   PY
   ```

7. ★ 依次迁移 laptop、server、gateway、ipad、phone。每台先保留旧配置，在 /v2/ 选择对应 profile，填入所需参数，导入到现有客户端。逐台验证冷启动、国内外访问、tailnet 和断网重启读取缓存；上一台通过再继续。若单台失败，切回该设备保留的旧配置。

8. ★ 可选轮换 DoH 凭据。先创建新凭据并保留旧凭据，更新 production 环境 DOH_URL，重新运行第 5 项。旧设备刷新，v2 设备重新导入；确认全部解析正常再撤销旧凭据。失败时在旧凭据仍有效时恢复原 secret 并重新部署。

9. ★ 回滚生产时先停用新仓库的部署 workflow 并确认没有进行中的部署。从有部署权限的本机在源仓库根目录执行 `npx wrangler rollback '<OLD_WORKER_VERSION_ID>'`，核实目标并确认。Cloudflare Deployments 应显示旧版本承载全部流量，静态规则随版本回退。验证旧 URL、设备 DNS 与代理；已迁移设备切回保存的配置。需要恢复旧仓库自动部署时，再启用旧 workflow。结束后退出切换 shell，清除临时副本和审计文件。
