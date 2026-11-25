// @vitest-environment happy-dom
import { createApp } from "vue";
import { expect, it, vi } from "vitest";
import App from "./App.vue";

it("refreshes credentials on Console re-entry and returns to Overview when re-entry fails", async () => {
  history.replaceState(null, "", "/v2/");
  const contexts = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ username: "test", password: "first" }),
    )
    .mockResolvedValueOnce(
      Response.json({ username: "test", password: "rotated" }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", (url: string) =>
    url === "/v2/auth-context"
      ? contexts()
      : Promise.resolve(new Response(null, { status: 404 })),
  );
  const root = document.createElement("div");
  const app = createApp(App);
  try {
    app.mount(root);
    expect(document.title).toBe("Unified Mihomo Config");
    for (const password of ["first", "rotated"]) {
      root.querySelector<HTMLButtonElement>(".action")!.click();
      await vi.waitFor(() =>
        expect(root.querySelector('[aria-label="Show password"]')).toBeTruthy(),
      );
      root
        .querySelector<HTMLButtonElement>('[aria-label="Show password"]')!
        .click();
      await vi.waitFor(() =>
        expect(root.querySelector("code.url")?.textContent).toContain(
          "//test:" + password + "@",
        ),
      );
      expect(document.title).toBe("Console · Unified Mihomo Config");
      root
        .querySelector<HTMLButtonElement>('nav[aria-label="View"] button')!
        .click();
      await vi.waitFor(() => expect(root.querySelector("code.url")).toBeNull());
    }
    root.querySelector<HTMLButtonElement>(".action")!.click();
    await vi.waitFor(() =>
      expect(root.querySelector('a[href="/v2/sign-in"]')).toBeTruthy(),
    );
    expect(root.querySelector("code.url")).toBeNull();
    expect(document.title).toBe("Unified Mihomo Config");
    expect(contexts).toHaveBeenCalledTimes(3);
  } finally {
    app.unmount();
    vi.unstubAllGlobals();
  }
});

it("illustrates the laptop skeleton without requesting credentials", async () => {
  history.replaceState(null, "", "/v2/");
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  const root = document.createElement("div"),
    app = createApp(App);
  try {
    app.mount(root);
    const figure = root.querySelector("figure.anatomy")!;
    expect(figure.querySelector(".anatomy-head")?.textContent).toContain(
      "profiles/laptop.yaml",
    );
    expect(figure.querySelector(".anatomy-head")?.textContent).toContain(
      "Abridged",
    );
    expect(figure.querySelectorAll(".ln")).toHaveLength(42);
    expect(
      Array.from(figure.querySelectorAll(".ln[data-marker]"), (el) => [
        el.getAttribute("data-marker"),
        el.getAttribute("data-zone"),
      ]),
    ).toEqual([
      ["1", "static"],
      ["2", "secret"],
      ["3", "rules"],
    ]);
    expect(
      Array.from(figure.querySelectorAll("mark"), (el) => el.textContent),
    ).toEqual(["{{{doh_url}}}", "{{{doh_url}}}", "{{{subscription}}}"]);
    expect(
      Array.from(root.querySelectorAll(".zone-tag"), (el) => el.textContent),
    ).toEqual([
      "Public · in Git",
      "Private · Console only",
      "Public · refreshed every 24h",
    ]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/v2/rules/stats.json",
    ]);
  } finally {
    app.unmount();
    vi.unstubAllGlobals();
  }
});
