# Artifact action verification

At 4cfac18 with the two workflow edits, queried the latest stable release and commit endpoints with unauthenticated curl. The commands below use the repository name as `a` and the returned tag as `tag`.

```sh
curl -fsSL "https://api.github.com/repos/actions/$a/releases/latest" | jq -r '.tag_name,.body'
curl -fsSL "https://api.github.com/repos/actions/$a/commits/$tag" | jq -er .sha
curl -fsSL --retry 2 "https://raw.githubusercontent.com/$repo/$sha/action.yml" | python3 -c 'import sys,yaml; a=yaml.safe_load(sys.stdin); print(a["runs"]["using"], {k:v for k,v in a.get("inputs",{}).items() if k in ("name","path","if-no-files-found","archive","extract")})'
```

Both old artifact manifests specify node20. Upload v7.0.2 and download v8.0.2 specify node24. Download retains name and path. Upload accepts a directory, honors the supplied name with its default archive setting and supports error for if-no-files-found. Checkout, setup-go and setup-node each specify node24 at their existing pins.

- `python3 -c 'import yaml,sys; [yaml.safe_load(open(p)) for p in sys.argv[1:]]' .github/workflows/{ci,deploy}.yml` passed.
- `git diff --check` passed.
- `MIHOMO_BIN=/tmp/mh/mihomo npm test` passed all 141 tests in 10 files.
- The initial Go command failed because Go was absent from PATH. After `export PATH=/tmp/mihomo-go/go/bin:$PATH`, `go test ./...` in rulesets passed all four packages.
- `go run . -mihomo /tmp/mh/mihomo` in rulesets exited 0.
- `npm run build` at the repository root exited 0.
