package build

import (
	"context"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
)

func TestParseClashPreservesNonMRSRules(t *testing.T) {
	t.Parallel()
	payload := `# comment
DOMAIN,api.example.com
DOMAIN-SUFFIX,example.org
DOMAIN-WILDCARD,*.example.net
DOMAIN-WILDCARD,*.qhimgs?.com
DOMAIN-KEYWORD,openai
DOMAIN-REGEX,^api[0-9]{1,3}\.example\.com$
IP-CIDR,192.0.2.0/24,no-resolve
DST-PORT,7844
PROCESS-NAME,Example
`
	loaded, report, err := parseClash(payload)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := len(loaded.Domains), 3; got != want {
		t.Fatalf("got %d MRS domain rules, expected %d", got, want)
	}
	if got, want := len(loaded.Classical), 3; got != want {
		t.Fatalf("got %d classical rules, expected %d", got, want)
	}
	if got, want := len(loaded.Prefixes), 1; got != want {
		t.Fatalf("got %d IP-CIDR rules, expected %d", got, want)
	}
	if report.Ignored["PROCESS-NAME"] != 1 || report.Ignored["DST-PORT"] != 1 {
		t.Fatalf("unexpected ignored counts: %+v", report.Ignored)
	}
	if loaded.MatchesDomain("unrelated.example") {
		t.Fatal("destination port rule matched an unrelated domain")
	}
	if !loaded.MatchesDomain("api.openai.example") {
		t.Fatal("classical domain matching stopped working beside a port rule")
	}
	if !loaded.MatchesDomain("api42.example.com") || loaded.MatchesDomain("api1234.example.com") {
		t.Fatal("classical regex quantifier was not preserved")
	}
}

func TestParseClashRejectsInvalidDestinationPortAndUnknownKind(t *testing.T) {
	t.Parallel()
	if _, _, err := parseClash("MYSTERY,example.com\n"); err == nil {
		t.Fatal("unknown Clash rule kind did not fail")
	}
}

func TestParseClashPreservesContextualPayloadAndCountsIgnored(t *testing.T) {
	t.Parallel()
	lines := []string{
		"PROCESS-NAME,cloudflared",
		"PROCESS-PATH-REGEX,^/opt/app[0-9]{1,3}$",
		"IP-ASN,13335,no-resolve,src",
		"AND,((NETWORK,UDP),(DST-PORT,7844))",
		"IP-CIDR,192.0.2.0/24,no-resolve,src",
		"IP-CIDR,198.51.100.0/24,SRC",
		"IP-CIDR6,2001:db8::/32,src",
		"SRC-IP-CIDR,198.51.100.0/24",
		"SRC-PORT,1024-65535",
		"NETWORK,UDP",
		"DOMAIN-REGEX,^api[0-9]{1,3}\\.example\\.com$",
	}
	loaded, report, err := parseClash(strings.Join(lines, "\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded.Classical) != len(lines)-3 || report.Ignored["PROCESS-NAME"] != 1 || report.Ignored["PROCESS-PATH-REGEX"] != 1 || report.Ignored["DST-PORT"] != 1 || len(loaded.Prefixes) != 0 {
		t.Fatalf("contextual rules were lost or converted to destination prefixes: %+v %+v", loaded, report)
	}
	if !slices.Equal(loaded.Classical, slices.Concat(lines[2:3], lines[4:])) {
		t.Fatalf("got %v, want %v", loaded.Classical, lines)
	}
	if loaded.MatchesDomain("unrelated.example") {
		t.Fatal("contextual rules matched a domain without connection metadata")
	}
	for _, kind := range []string{"FINAL", "MATCH", "RULE-SET", "SUB-RULE", "URL-REGEX", "USER-AGENT"} {
		ignoredLoaded, ignoredReport, err := parseClash(kind + ",example")
		if err != nil {
			t.Fatalf("%s: %v", kind, err)
		}
		if ignoredReport.Ignored[kind] != 1 || len(ignoredLoaded.Classical) != 0 || len(ignoredLoaded.Domains) != 0 || len(ignoredLoaded.Prefixes) != 0 {
			t.Fatalf("%s was not explicitly counted as ignored: %+v %+v", kind, ignoredLoaded, ignoredReport)
		}
	}
}

func TestParseCIDR(t *testing.T) {
	t.Parallel()
	loaded, report, err := parseCIDR("# Tailscale ranges\n100.64.0.0/10\nfd7a:115c:a1e0::/48\n")
	if err != nil {
		t.Fatal(err)
	}
	if report.InputRules != 2 {
		t.Fatalf("got %d input rules, expected 2", report.InputRules)
	}
	for _, addr := range []netip.Addr{
		netip.MustParseAddr("100.64.0.1"),
		netip.MustParseAddr("fd7a:115c:a1e0::1"),
	} {
		if !loaded.Prefixes.Contains(addr) {
			t.Fatalf("parsed prefixes do not contain %s", addr)
		}
	}
}

func TestLoaderLocalClashFilePreservesPortWithoutMRSEntries(t *testing.T) {
	t.Parallel()
	baseDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(baseDir, "tunnel.txt"), []byte("# Cloudflare Tunnel\nDST-PORT,7844\nDST-PORT,7844\n"), 0600); err != nil {
		t.Fatal(err)
	}
	loader := newSourceLoader("https://unused.invalid/v2fly")
	loaded, report, err := loader.load(context.Background(), baseDir, SourceConfig{Name: "Cloudflare:tunnel", Kind: "clash-file", Path: "tunnel.txt"})
	if err != nil {
		t.Fatal(err)
	}
	if report.InputRules != 2 || len(loaded.Classical) != 0 {
		t.Fatalf("local Clash ingest did not retain and deduplicate port rules: %+v %+v", loaded, report)
	}
	if len(loaded.Domains) != 0 || len(loaded.Prefixes) != 0 || len(report.Fetches) != 0 || report.Ignored["DST-PORT"] != 2 {
		t.Fatalf("local port rules produced MRS entries, fetches or ignored rules: %+v %+v", loaded, report)
	}
	if _, _, err := loader.load(context.Background(), baseDir, SourceConfig{Name: "missing-tunnel", Kind: "clash-file", Path: "missing.txt"}); err == nil || !strings.Contains(err.Error(), "load missing-tunnel:") {
		t.Fatalf("got %v, want named source load error", err)
	}
}

func TestParseV2FlyRuleAttributesAndSelection(t *testing.T) {

	kind, value, attrs, err := parseV2FlyRule("domain:example.com")
	if err != nil || kind != "domain" || value != "example.com" || attrs != "" || !hasV2FlyAttributes(attrs, nil) || hasV2FlyAttributes(attrs, []string{"cn"}) {
		t.Fatalf("untagged rule: got (%q, %q, %q, %v)", kind, value, attrs, err)
	}
	kind, value, attrs, err = parseV2FlyRule("full:firebase-settings.crashlytics.com:@cn,@telemetry")
	if err != nil || kind != "full" || value != "firebase-settings.crashlytics.com" ||
		!hasV2FlyAttributes(attrs, []string{"cn", "telemetry"}) || hasV2FlyAttributes(attrs, []string{"cn", "ads"}) {
		t.Fatalf("multi-tag rule: got (%q, %q, %q, %v)", kind, value, attrs, err)
	}
	for _, bad := range []string{
		"badrule", "domain:", ":example.cn", "domain::@cn",
		"domain:example.cn:@", "domain:example.cn:@cn,@", "domain:example.cn:@,@cn", "domain:example.cn:@cn,ads",
	} {
		if _, _, _, err := parseV2FlyRule(bad); err == nil {
			t.Errorf("malformed V2Fly rule %q did not fail", bad)
		}
	}

	const fixture = `lists:
  - name: alpha
    length: 2
    rules:
      - domain:untagged.alpha.example
      - domain:cn.alpha.example:@cn
  - name: beta
    length: 4
    rules:
      - domain:untagged.beta.example
      - full:multi.beta.example:@cn,@telemetry
      - keyword:tracker:@cn
      - regexp:^api[0-9]+\.example\.com$:@cn
`
	var requests atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		_, _ = w.Write([]byte(fixture))
	}))
	t.Cleanup(server.Close)
	trust := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(trust, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw}), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CURL_CA_BUNDLE", trust)

	loader := newSourceLoader(server.URL)
	named, _, err := loader.load(context.Background(), "", SourceConfig{Name: "v2fly:alpha", Kind: "v2fly", Lists: []string{"alpha"}})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(named.Domains, []string{"+.cn.alpha.example", "+.untagged.alpha.example"}) {
		t.Fatalf("named list rules: got %v", named.Domains)
	}
	allCN, report, err := loader.load(context.Background(), "", SourceConfig{Name: "v2fly:*@cn", Kind: "v2fly", AllLists: true, RequireAttributes: []string{"cn"}})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(allCN.Domains, []string{"+.cn.alpha.example", "multi.beta.example"}) || len(allCN.Classical) != 2 || report.InputRules != 4 {
		t.Fatalf("all_lists @cn: got %+v %+v", allCN, report)
	}
	if _, _, err := loader.load(context.Background(), "", SourceConfig{Name: "v2fly:missing", Kind: "v2fly", Lists: []string{"alpha", "missing"}}); err == nil || !strings.Contains(err.Error(), `V2Fly list "missing" not found`) {
		t.Fatalf("got %v, want missing list error", err)
	}
	if requests.Load() != 1 {
		t.Fatalf("V2Fly document fetched %d times, want 1", requests.Load())
	}
}

func TestFetcherCanceledContextAndParseIANALocalCSV(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	loader := newSourceLoader("https://unused.invalid/v2fly")
	if _, _, err := loader.fetch(ctx, "https://unused.invalid/canceled"); err == nil || strings.Contains(err.Error(), "after 8 attempts") {
		t.Fatalf("canceled error = %v, want direct cancellation error", err)
	}

	csvPayload := "Address Block,Name\n10.0.0.0/8 [RFC1918],Private-Use\n203.0.113.0/24,Documentation\n"
	prefixes, err := parseIANALocalCSV([]byte(csvPayload))
	if err != nil {
		t.Fatal(err)
	}
	if len(prefixes) != 1 || prefixes[0].String() != "10.0.0.0/8" {
		t.Fatalf("parseIANALocalCSV = %v, want [10.0.0.0/8]", prefixes)
	}
}

func TestCustomFiles(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "custom.txt")
	source := SourceConfig{Name: "custom", Kind: "custom-file", Path: "custom.txt"}
	loader := newSourceLoader("")
	for _, payload := range []string{"", "DOMAIN-SUFFIX,demo.invalid\nIP-CIDR,192.0.2.0/24,no-resolve\n"} {
		if err := os.WriteFile(path, []byte(payload), 0600); err != nil {
			t.Fatal(err)
		}
		result, _, err := loader.load(context.Background(), dir, source)
		if err != nil {
			t.Fatal(err)
		}
		if payload == "" {
			if counts(result).Total() != 0 {
				t.Fatal("expected empty custom")
			}
			continue
		}
		if !slices.Equal(result.Domains, []string{"+.demo.invalid"}) || !slices.Equal(result.Classical, []string{"IP-CIDR,192.0.2.0/24,no-resolve"}) {
			t.Fatal(result)
		}
	}
}

func TestDNSMasqMultiDomain(t *testing.T) {
	result, report, err := parseDNSMasq("server=/a.example/b.example/::1")
	if err != nil || report.InputRules != 2 || !slices.Equal(result.Domains, []string{"+.a.example", "+.b.example"}) {
		t.Fatalf("%v %+v %v", result, report, err)
	}
	for _, line := range []string{"server=/a//127.0.0.1", "server=/#/127.0.0.1", "server=/a/b", "address=/a/::1"} {
		if _, _, err := parseDNSMasq(line); err == nil {
			t.Errorf("accepted %q", line)
		}
	}
}

func TestFetchRequiresHTTPS(t *testing.T) {
	var hits atomic.Int32
	plain := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1); w.Write([]byte("unexpected")) }))
	defer plain.Close()
	secure := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, plain.URL, http.StatusFound) }))
	defer secure.Close()
	trust := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(trust, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: secure.Certificate().Raw}), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CURL_CA_BUNDLE", trust)
	for _, url := range []string{plain.URL, secure.URL} {
		if _, _, err := newSourceLoader("").fetchOnce(context.Background(), url); err == nil {
			t.Fatal("accepted HTTP")
		}
	}
	if hits.Load() != 0 {
		t.Fatal("contacted HTTP server")
	}
}
