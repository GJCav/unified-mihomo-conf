package main

import (
	"compose/rulesets/internal/build"
	"compose/rulesets/internal/output"
	"context"
	_ "embed"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

func run() error {
	dir := flag.String("out", "../public/v2/rules", "output directory")
	binary := flag.String("mihomo", "mihomo", "mihomo binary")
	flag.Parse()
	cfg, err := build.LoadConfig("rulesets.json")
	if err != nil {
		return err
	}
	result, err := build.Run(context.Background(), cfg)
	if err != nil {
		return err
	}
	stats, err := metadata(cfg)
	if err != nil {
		return err
	}
	if err = output.Write(context.Background(), result, *dir, *binary, stats); err != nil {
		return err
	}
	return publishNotices(*dir, stats)
}

//go:embed NOTICE
var notice string

//go:embed AGPL-3.0.txt
var license []byte

func metadata(cfg build.Config) (output.Stats, error) {
	generatedAt := time.Now().UTC().Truncate(time.Second)
	if epoch, ok := os.LookupEnv("SOURCE_DATE_EPOCH"); ok {
		seconds, err := strconv.ParseInt(epoch, 10, 64)
		if err != nil {
			return output.Stats{}, fmt.Errorf("SOURCE_DATE_EPOCH: %w", err)
		}
		generatedAt = time.Unix(seconds, 0).UTC()
	}
	stats := output.Stats{SchemaVersion: 2, GeneratedAt: generatedAt, Priority: cfg.Priority, Fallback: cfg.Fallback, Upstreams: cfg.Upstreams, LicenseFiles: []string{"NOTICE", "AGPL-3.0.txt"}}
	host, repo, sha := os.Getenv("GITHUB_SERVER_URL"), os.Getenv("GITHUB_REPOSITORY"), os.Getenv("GITHUB_SHA")
	if host != "" && repo != "" && sha != "" {
		stats.Build = &output.BuildInfo{Repository: host + "/" + repo, Commit: sha}
	}
	return stats, nil
}
func publishNotices(dir string, stats output.Stats) error {
	source := "local build"
	if stats.Build != nil {
		source = stats.Build.Repository + "/tree/" + stats.Build.Commit
	}
	text := fmt.Sprintf("%s\nSukka rules filtered, merged and converted on %s (UTC). Corresponding source: %s\n", notice, stats.GeneratedAt.Format(time.RFC3339), source)
	if err := os.WriteFile(filepath.Join(dir, "AGPL-3.0.txt"), license, 0644); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "NOTICE"), []byte(text), 0644)
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
