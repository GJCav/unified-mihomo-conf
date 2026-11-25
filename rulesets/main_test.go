package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPublishedNotices(t *testing.T) {
	for _, repo := range []string{"", "owner/rules"} {
		t.Setenv("GITHUB_SERVER_URL", "https://example.org")
		t.Setenv("GITHUB_REPOSITORY", repo)
		t.Setenv("GITHUB_SHA", "abc")
		dir := t.TempDir()
		if err := publishNotices(dir); err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(filepath.Join(dir, "NOTICE"))
		if err != nil {
			t.Fatal(err)
		}
		source := "local build"
		if repo != "" {
			source = "https://example.org/owner/rules/tree/abc"
		}
		for _, want := range []string{source, "Yifan Gao", "V2Ray", "Felix Yan", "2024 liblaf", "Sukka", "CC0", "filtered, merged and converted"} {
			if !strings.Contains(string(data), want) {
				t.Errorf("missing %s", want)
			}
		}
		data, err = os.ReadFile(filepath.Join(dir, "AGPL-3.0.txt"))
		if err != nil || string(data) != string(license) {
			t.Fatal("license missing or incomplete")
		}
	}
}

func TestIANARegistryHost(t *testing.T) {
	data, err := os.ReadFile("rulesets.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, family := range []string{"ipv4", "ipv6"} {
		prefix := "https://www.iana.org/assignments/iana-" + family + "-special-registry/"
		if !strings.Contains(string(data), prefix) {
			t.Errorf("missing canonical registry URL for %s", family)
		}
	}
}
