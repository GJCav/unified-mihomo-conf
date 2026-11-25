package build

import (
	"net/netip"

	"strings"
	"testing"

	"compose/rulesets/internal/rules"
)

func TestVerifyAssertionsUsesPriorityAndFallback(t *testing.T) {
	t.Parallel()
	lanRule, err := rules.SuffixDomain("local")
	if err != nil {
		t.Fatal(err)
	}
	usRule, err := rules.SuffixDomain("openai.com")
	if err != nil {
		t.Fatal(err)
	}
	cfg := Config{
		Priority: []string{"lan", "us", "global"},
		Fallback: "global",
		Assertions: []Assertion{
			{Domain: "router.local", RuleSet: "lan"},
			{Domain: "api.openai.com", RuleSet: "us"},
			{Domain: "unknown.example", RuleSet: "global"},
		},
	}
	built := Result{RuleSets: []RuleSet{
		{Name: "lan", Rules: rules.Collection{Domains: rules.DomainSet{lanRule}}},
		{Name: "us", Rules: rules.Collection{Domains: rules.DomainSet{usRule}}},
		{Name: "global"},
	}}
	if err := verifyAssertions(cfg, built); err != nil {
		t.Fatal(err)
	}
}

func TestVerifyAssertionsSupportsExclusiveIPMembership(t *testing.T) {
	t.Parallel()
	tailnetPrefix := netip.MustParsePrefix("100.64.0.0/10")
	cfg := Config{
		Priority:   []string{"tailnet", "lan"},
		Fallback:   "lan",
		Assertions: []Assertion{{IP: "100.64.0.1", RuleSet: "tailnet", Exclusive: true}},
	}
	built := Result{RuleSets: []RuleSet{
		{Name: "tailnet", Rules: rules.Collection{Prefixes: rules.PrefixSet{tailnetPrefix}}},
		{Name: "lan"},
	}}
	if err := verifyAssertions(cfg, built); err != nil {
		t.Fatal(err)
	}
	built.RuleSets[1].Rules = rules.Collection{Prefixes: rules.PrefixSet{tailnetPrefix}}
	if err := verifyAssertions(cfg, built); err == nil || !strings.Contains(err.Error(), "expected exclusive membership") {
		t.Fatalf("got error %v, expected exclusive-membership failure", err)
	}
}

func TestVerifyAssertionsUsesDestinationPortAndPreservesFallback(t *testing.T) {
	t.Parallel()
	port, err := rules.NewClassical("DST-PORT", "7844")
	if err != nil {
		t.Fatal(err)
	}
	globalDomain, err := rules.SuffixDomain("argotunnel.com")
	if err != nil {
		t.Fatal(err)
	}
	cfg := Config{
		Priority: []string{"direct", "global"},
		Fallback: "global",
		Assertions: []Assertion{
			{IP: "198.41.192.7", DestinationPort: 7844, RuleSet: "direct", Exclusive: true},
			{IP: "2606:4700:a0::1", DestinationPort: 7844, RuleSet: "direct", Exclusive: true},
			{Domain: "region1.v2.argotunnel.com", DestinationPort: 7844, RuleSet: "direct"},
			{IP: "198.41.192.7", DestinationPort: 443, RuleSet: "global"},
			{Domain: "api.cloudflare.com", DestinationPort: 443, RuleSet: "global"},
			{Domain: "api.cloudflare.com", RuleSet: "global"},
		},
	}
	built := Result{RuleSets: []RuleSet{
		{Name: "direct", Rules: rules.Collection{Classical: rules.ClassicalSet{port}}},
		{Name: "global", Rules: rules.Collection{Domains: rules.DomainSet{globalDomain}}},
	}}
	if err := verifyAssertions(cfg, built); err != nil {
		t.Fatal(err)
	}
	built.RuleSets[0].Rules = rules.Collection{}
	if err := verifyAssertions(cfg, built); err == nil {
		t.Fatal("missing destination port rule passed tunnel assertions")
	}
	built.RuleSets[0].Rules = rules.Collection{Classical: rules.ClassicalSet{port}}
	built.RuleSets[1].Rules = rules.Collection{Classical: rules.ClassicalSet{port}}
	if err := verifyAssertions(cfg, built); err == nil || !strings.Contains(err.Error(), "expected exclusive membership") {
		t.Fatalf("got %v, want overlapping destination port membership failure", err)
	}
}

func TestProjectTailnetAndDirectExclusions(t *testing.T) {
	earlier := rules.PrefixSet{netip.MustParsePrefix("100.88.0.0/16")}
	later := rules.PrefixSet{netip.MustParsePrefix("100.64.0.0/10")}
	diff := later.Excluding(earlier)
	if diff.Contains(netip.MustParseAddr("100.88.1.1")) || !diff.Contains(netip.MustParseAddr("100.89.1.1")) {
		t.Fatal("incorrect tailnet subtraction")
	}
}
