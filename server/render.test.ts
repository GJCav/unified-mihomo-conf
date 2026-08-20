import { describe, expect, it } from "vitest";
import { PlanError, renderConfiguration } from "./render";

describe("renderConfiguration", () => {
  it("renders a normal server through the gateway", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        general: "basic",
        dns: "basic",
        "proxy-providers": "none",
        "proxy-groups": "none",
        proxies: "gateway",
        gateway_server: "192.168.55.1",
      }),
    );

    expect(yaml).toContain("allow-lan: false");
    expect(yaml).toMatch(/dns:\n(?:  #.*\n)*  enable: true/);
    expect(yaml).toContain('server: "192.168.55.1"');
    expect(yaml).not.toContain("proxy-providers:");
  });

  it("puts Tailnet rules before the common CGNAT bypass", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        general: "basic",
        dns: "basic",
        "proxy-providers": "main",
        "proxy-groups": "main",
        proxies: "tailscale",
        rules: "tailscale",
        tailscale_hostname: "ipad-air",
        tailscale_auth_key: "test-key",
      }),
      "https://example.com/sub?token=test&format=yaml",
    );

    expect(yaml).toContain(
      'url: "https://example.com/sub?token=test&format=yaml"',
    );
    expect(yaml.indexOf("100.88.0.0/16,tailscale")).toBeLessThan(
      yaml.indexOf("100.64.0.0/10,DIRECT"),
    );
  });

  it("rejects a subscription group without a provider", () => {
    expect(() =>
      renderConfiguration(
        new URLSearchParams({
          "proxy-providers": "none",
          "proxy-groups": "main",
        }),
      ),
    ).toThrow(PlanError);
  });

  it("rejects Tailscale rules without the Tailscale proxy", () => {
    expect(() =>
      renderConfiguration(
        new URLSearchParams({
          "proxy-providers": "main",
          "proxy-groups": "main",
          proxies: "none",
          rules: "tailscale",
        }),
      ),
    ).toThrow(PlanError);
  });

  it("renders combinable proxies from the compact schema", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        g: "b",
        d: "b",
        p: "gt",
        r: "b",
        s: "192.168.55.1",
        h: "server-a",
        k: "test-key",
      }),
    );

    expect(yaml).toContain("name: default");
    expect(yaml).toContain("name: tailscale");
  });

  it("renders the TUN snippet from the compact schema", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        g: "b",
        d: "b",
        t: "b",
        p: "g",
        r: "b",
        s: "192.168.55.1",
      }),
    );

    expect(yaml).toContain("tun:\n  enable: true");
    expect(yaml).toContain("  auto-redirect: true");
  });

  it("renders the optional external UI snippet", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        g: "g",
        e: "b",
        d: "n",
        t: "n",
        pp: "m",
        pg: "m",
        r: "b",
      }),
      "https://example.com/subscription",
    );

    expect(yaml).toContain("external-ui: ui");
  });

  it("composes the laptop TUN route exclusion", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        g: "b",
        d: "b",
        t: "be",
        p: "g",
        r: "b",
        s: "192.168.55.1",
      }),
    );

    expect(yaml).toContain("tun:\n  enable: true");
    expect(yaml).toContain("  route-exclude-address:\n    - 100.88.0.0/16");
  });

  it("includes the complete Tsinghua IPv4 and IPv6 rule set", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        g: "b",
        d: "b",
        p: "g",
        r: "h",
        s: "192.168.55.1",
      }),
    );

    expect(yaml).toContain("IP-CIDR,59.66.0.0/16,DIRECT");
    expect(yaml).toContain("IP-CIDR,118.229.0.0/20,DIRECT");
    expect(yaml).toContain("IP-CIDR,183.173.0.0/16,DIRECT");
    expect(yaml).toContain("IP-CIDR6,2001:250:200::/48,DIRECT");
    expect(yaml).toContain("IP-CIDR6,2001:da8:200::/48,DIRECT");
    expect(yaml).toContain("IP-CIDR6,2402:f000::/32,DIRECT");
  });

  it("preserves compact rule order", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        g: "b",
        d: "b",
        pp: "m",
        pg: "m",
        p: "t",
        r: "bt",
        h: "ipad-air",
        k: "test-key",
      }),
      "https://example.com/subscription",
    );

    expect(yaml.indexOf("100.64.0.0/10,DIRECT")).toBeLessThan(
      yaml.indexOf("100.88.0.0/16,tailscale"),
    );
  });

  it("uses the Worker secret and ignores a legacy URL override", () => {
    const yaml = renderConfiguration(
      new URLSearchParams({
        g: "g",
        d: "n",
        t: "n",
        pp: "m",
        pg: "m",
        r: "b",
        u: "https://attacker.example/subscription",
      }),
      "https://provider.example/subscription",
    );

    expect(yaml).toContain('url: "https://provider.example/subscription"');
    expect(yaml).not.toContain("attacker.example");
  });
});
