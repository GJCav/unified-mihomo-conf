package output

import (
	"compose/rulesets/internal/build"
	"compose/rulesets/internal/rules"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestClassicalValidation(t *testing.T) {
	bin := os.Getenv("MIHOMO_BIN")
	if bin == "" {
		bin, _ = exec.LookPath("mihomo")
	}
	for _, tc := range []struct {
		name    string
		lines   []string
		wantErr string
	}{
		{"empty", nil, ""},
		{"asn", []string{"IP-ASN,123,no-resolve"}, ""},
		{"invalidASN", []string{"IP-ASN,invalid"}, "invalid IP-ASN"},
		{"invalidLogical", []string{"DOMAIN,example.org", "AND,((INVALID,foo),(NETWORK,TCP))"}, "loaded 1 of 2"},
		{"mixed", []string{"DOMAIN,example.org", "IP-ASN,123"}, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if bin == "" && (tc.name == "invalidLogical" || tc.name == "mixed") {
				t.Skip("mihomo required")
			}
			dir := t.TempDir()
			result := build.Result{RuleSets: []build.RuleSet{{Name: "custom-direct"}, {Name: "custom-proxy", Rules: rules.Collection{Classical: tc.lines}}}}
			err := Write(context.Background(), result, dir, bin, Stats{})
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("expected %q, got %v", tc.wantErr, err)
				}
				files, err := os.ReadDir(dir)
				if err != nil || len(files) != 0 {
					t.Fatalf("output after failure: %v %v", files, err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			data, err := os.ReadFile(filepath.Join(dir, "custom-proxy.classical.txt"))
			if err != nil || string(data) != strings.Join(tc.lines, "\n")+"\n" {
				t.Fatalf("unexpected output %q, %v", data, err)
			}
			statsBytes, err := os.ReadFile(filepath.Join(dir, "stats.json"))
			if err != nil {
				t.Fatal(err)
			}
			var stats Stats
			if err = json.Unmarshal(statsBytes, &stats); err != nil {
				t.Fatal(err)
			}
			artifact := stats.RuleSets[1].Files[1]
			if artifact.Name != "custom-proxy.classical.txt" || artifact.Count != len(tc.lines) || artifact.Bytes != len(data) || artifact.SHA256 != fmt.Sprintf("%x", sha256.Sum256(data)) {
				t.Fatalf("invalid file descriptor: %+v", artifact)
			}

		})
	}
}
