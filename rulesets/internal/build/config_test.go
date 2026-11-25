package build

import (
	"testing"
)

func TestValidateSource(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name   string
		source SourceConfig
		valid  bool
	}{
		{"cidr-file/local", SourceConfig{Kind: "cidr-file", Path: "sources/tailnet.ipcidr.txt"}, true},
		{"cidr-file/parent", SourceConfig{Kind: "cidr-file", Path: "../tailnet.ipcidr.txt"}, false},
		{"clash-file/local", SourceConfig{Kind: "clash-file", Path: "sources/cloudflared.classical.txt"}, true},
		{"clash-file/missing path", SourceConfig{Kind: "clash-file"}, false},
		{"clash-file/parent", SourceConfig{Kind: "clash-file", Path: "../cloudflared.txt"}, false},
		{"clash-file/nested parent", SourceConfig{Kind: "clash-file", Path: "sources/../../cloudflared.txt"}, false},
		{"clash-file/absolute", SourceConfig{Kind: "clash-file", Path: "/tmp/cloudflared.txt"}, false},
		{"clash-file/remote url", SourceConfig{Kind: "clash-file", Path: "sources/cloudflared.txt", URL: "https://example.com/rules"}, false},
		{"clash-file/selection", SourceConfig{Kind: "clash-file", Path: "sources/cloudflared.txt", AllLists: true}, false},
		{"clash-file/require attributes", SourceConfig{Kind: "clash-file", Path: "sources/cloudflared.txt", RequireAttributes: []string{"cn"}}, false},
		{"v2fly/named lists", SourceConfig{Kind: "v2fly", Lists: []string{"cn"}}, true},
		{"v2fly/all lists", SourceConfig{Kind: "v2fly", AllLists: true}, true},
		{"v2fly/all lists with attribute", SourceConfig{Kind: "v2fly", AllLists: true, RequireAttributes: []string{"cn"}}, true},
		{"v2fly/missing selection", SourceConfig{Kind: "v2fly"}, false},
		{"v2fly/lists and all_lists", SourceConfig{Kind: "v2fly", Lists: []string{"cn"}, AllLists: true}, false},
		{"v2fly/empty attribute", SourceConfig{Kind: "v2fly", AllLists: true, RequireAttributes: []string{""}}, false},
		{"v2fly/prefixed attribute", SourceConfig{Kind: "v2fly", AllLists: true, RequireAttributes: []string{"@cn"}}, false},
		{"v2fly/comma in attribute", SourceConfig{Kind: "v2fly", AllLists: true, RequireAttributes: []string{"cn,ads"}}, false},
		{"v2fly/whitespace attribute", SourceConfig{Kind: "v2fly", AllLists: true, RequireAttributes: []string{" cn "}}, false},
		{"clash/require attributes", SourceConfig{Kind: "clash", URL: "https://example.com/rules.txt", RequireAttributes: []string{"cn"}}, false},
		{"iana-local/require attributes", SourceConfig{Kind: "iana-local", URLs: []string{"https://example.com/a.csv"}, RequireAttributes: []string{"cn"}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateSource(tc.source); (err == nil) != tc.valid {
				t.Fatalf("validateSource(%+v) = %v, want valid=%t", tc.source, err, tc.valid)
			}
		})
	}
}
