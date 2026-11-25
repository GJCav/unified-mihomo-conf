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
	if err = output.Write(context.Background(), result, *dir, *binary); err != nil {
		return err
	}
	return publishNotices(*dir)
}

//go:embed NOTICE
var notice string

//go:embed AGPL-3.0.txt
var license []byte

func publishNotices(dir string) error {
	source := "local build"
	host, repo, sha := os.Getenv("GITHUB_SERVER_URL"), os.Getenv("GITHUB_REPOSITORY"), os.Getenv("GITHUB_SHA")
	if host != "" && repo != "" && sha != "" {
		source = host + "/" + repo + "/tree/" + sha
	}
	text := fmt.Sprintf("%s\nSukka rules filtered, merged and converted on %s (UTC). Corresponding source: %s\n", notice, time.Now().UTC().Format(time.DateOnly), source)
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
