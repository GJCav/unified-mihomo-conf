package output

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"compose/rulesets/internal/build"
)

func Write(ctx context.Context, result build.Result, dir, binary string) error {

	temp, err := os.MkdirTemp("", "rule-text-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temp)
	for _, set := range result.RuleSets {
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
			if custom || kind == "classical" {
				if err := os.WriteFile(filepath.Join(temp, stem+".txt"), []byte(payload), 0644); err != nil {
					return err
				}
				continue
			}
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
	}
	data, err := json.MarshalIndent(result.RuleSets, "", "  ")
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
