package output

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"compose/rulesets/internal/build"
)

type BuildInfo struct {
	Repository string `json:"repository"`
	Commit     string `json:"commit"`
}
type Stats struct {
	SchemaVersion int                       `json:"schema_version"`
	GeneratedAt   time.Time                 `json:"generated_at"`
	Build         *BuildInfo                `json:"build,omitempty"`
	Priority      []string                  `json:"priority"`
	Fallback      string                    `json:"fallback"`
	Upstreams     map[string]build.Upstream `json:"upstreams"`
	LicenseFiles  []string                  `json:"license_files"`
	RuleSets      []build.RuleSet           `json:"rulesets"`
}

func Write(ctx context.Context, result build.Result, dir, binary string, stats Stats) error {

	temp, err := os.MkdirTemp("", "rule-text-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temp)
	for i := range result.RuleSets {
		set := &result.RuleSets[i]
		custom := strings.HasPrefix(set.Name, "custom-")
		for _, kind := range []string{"domain", "ipcidr", "classical"} {
			lines := []string(set.Rules.Domains)
			switch kind {
			case "ipcidr":
				if custom {
					continue
				}
				lines = set.Rules.Prefixes.Texts()
			case "classical":
				if set.Name == "tailnet" {
					continue
				}
				lines = set.Rules.Classical
			}
			stem := set.Name + "." + kind
			payload := strings.Join(lines, "\n") + "\n"
			if kind == "classical" {
				if err := mihomoCLI(binary).validateClassical(ctx, lines); err != nil {
					return fmt.Errorf("%s: %w", stem, err)
				}
			}
			format := "mrs"
			if custom || kind == "classical" {
				format = "txt"
				if err := os.WriteFile(filepath.Join(temp, stem+".txt"), []byte(payload), 0644); err != nil {
					return err
				}
			} else {
				path := filepath.Join(temp, stem+".input")
				if err := os.WriteFile(path, []byte(payload), 0600); err != nil {
					return err
				}
				target := filepath.Join(temp, stem+".mrs")
				cli := mihomoCLI(binary)
				if kind == "domain" {
					err = cli.convertDomain(ctx, path, target, set.Rules.Domains)
				} else {
					err = cli.convertIPCIDR(ctx, path, target, set.Rules.Prefixes)
				}
				if err != nil {
					return fmt.Errorf("%s: %w", stem, err)
				}
			}
			name := stem + "." + format
			file, err := os.ReadFile(filepath.Join(temp, name))
			if err != nil {
				return err
			}
			set.Files = append(set.Files, build.Artifact{Name: name, Behavior: kind, Format: format, Count: len(lines), Bytes: len(file), SHA256: fmt.Sprintf("%x", sha256.Sum256(file))})
		}
	}
	stats.RuleSets = result.RuleSets
	data, err := json.MarshalIndent(stats, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(temp, "stats.json"), data, 0644); err != nil {
		return err
	}
	files, err := os.ReadDir(temp)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	for _, file := range files {
		name := file.Name()
		if strings.HasSuffix(name, ".input") {
			continue
		}
		payload, err := os.ReadFile(filepath.Join(temp, name))
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(dir, name), payload, 0644); err != nil {
			return err
		}
	}
	return nil
}
