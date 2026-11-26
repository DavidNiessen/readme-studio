import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchProfileData, parseFeed, presetConfig } from "@readme-studio/core";
import { build, dataNeeds } from "../src/build";
import { commitReadme, publishAssets } from "../src/publish";
import { parseContributionsHtml, parsePinnedHtml } from "../src/scrape";
import { woffToSfnt } from "../src/fonts";

const tmp = () => mkdtempSync(join(tmpdir(), "rs-test-"));

describe("scraping", () => {
  it("parses the contributions calendar", () => {
    const html = `
      <td class="ContributionCalendar-day" data-date="2026-01-04" id="d-0-0" data-level="0"></td>
      <td class="ContributionCalendar-day" data-date="2026-01-05" id="d-0-1" data-level="2"></td>
      <td class="ContributionCalendar-day" data-date="2026-01-11" id="d-1-0" data-level="4"></td>
      <tool-tip for="d-0-0">No contributions on January 4th.</tool-tip>
      <tool-tip for="d-0-1">3 contributions on January 5th.</tool-tip>
      <tool-tip for="d-1-0">1,204 contributions on January 11th.</tool-tip>`;
    const weeks = parseContributionsHtml(html);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].map((d) => d.count)).toEqual([0, 3]);
    expect(weeks[1][0]).toMatchObject({ date: "2026-01-11", count: 1204, level: 4, weekday: 0 });
  });

  it("parses pinned repositories and skips private ones", () => {
    const html = `<li><div class="pinned-item-list-item-content"><a href="/mona/cool-app">cool-app</a>
      <p class="pinned-item-desc color-fg-muted">A &amp; B <b>tool</b></p>
      <span class="repo-language-color" style="background-color: #3178c6"></span><span itemprop="programmingLanguage">TypeScript</span>
      <a href="/mona/cool-app/stargazers"><svg></svg> 1.2k</a><a href="/mona/cool-app/forks"><svg></svg> 34</a></div></li>
      <li><div class="pinned-item-list-item-content"><a href="/mona/secret">secret</a><span> Private </span></div></li>`;
    const pinned = parsePinnedHtml(html);
    expect(pinned).toHaveLength(1);
    expect(pinned[0]).toMatchObject({ name: "cool-app", description: "A & B tool", stars: 1200, forks: 34, language: { name: "TypeScript", color: "#3178c6" } });
  });
});

describe("feeds", () => {
  it("parses RSS and Atom", () => {
    const rss = `<rss><channel><item><title><![CDATA[Hello & welcome]]></title><link>https://x.dev/a</link><pubDate>Tue, 10 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;First post&lt;/p&gt;</description></item></channel></rss>`;
    const atom = `<feed><entry><title>Atom post</title><link href="https://x.dev/b"/><published>2026-11-01T00:00:00Z</published><summary>Sum</summary></entry></feed>`;
    expect(parseFeed(rss)[0]).toMatchObject({ title: "Hello & welcome", url: "https://x.dev/a", summary: "First post" });
    expect(parseFeed(rss)[0].date).toBe("2026-11-10T10:00:00.000Z");
    expect(parseFeed(atom)[0]).toMatchObject({ title: "Atom post", url: "https://x.dev/b", date: "2026-11-01T00:00:00.000Z" });
  });
});

describe("live loader (fake network)", () => {
  const user = { login: "mona", name: "Mona", created_at: "2020-01-01T00:00:00Z", followers: 5, following: 2, public_repos: 2, avatar_url: "", bio: "hi", company: null, location: null, blog: null };
  const repos = [
    { name: "app", owner: { login: "mona" }, description: "d", html_url: "https://github.com/mona/app", stargazers_count: 7, forks_count: 1, fork: false, language: "Rust", created_at: "2025-01-01T00:00:00Z", pushed_at: "2026-11-01T00:00:00Z" },
    { name: "forked", owner: { login: "mona" }, description: "", html_url: "", stargazers_count: 99, forks_count: 0, fork: true, language: null, created_at: "", pushed_at: "" },
    { name: "hidden", owner: { login: "mona" }, description: "", html_url: "", stargazers_count: 99, forks_count: 0, fork: false, private: true, language: null, created_at: "", pushed_at: "" },
  ];
  const events = [
    { type: "PushEvent", public: true, repo: { name: "mona/app" }, created_at: "2026-11-25T10:00:00Z", payload: { size: 2, ref: "refs/heads/main" } },
    { type: "PushEvent", public: false, repo: { name: "mona/secret" }, created_at: "2026-11-25T10:00:00Z", payload: {} },
  ];
  const fake = (async (input: string | URL) => {
    const url = String(input);
    const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith("/users/mona")) return json(user);
    if (url.includes("/users/mona/repos")) return json(repos);
    if (url.includes("/events/public")) return json(events);
    if (url.includes("/releases")) return json([{ tag_name: "v1.0.0", name: "", html_url: "https://github.com/mona/app/releases/v1.0.0", published_at: "2026-11-20T00:00:00Z", draft: false }]);
    if (url.includes("/commits")) return json([]);
    if (url.includes("open-meteo")) return json({ current: { temperature_2m: 4, weather_code: 3, is_day: 1, wind_speed_10m: 10 }, daily: { temperature_2m_max: [6], temperature_2m_min: [1] } });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  it("uses REST + calendar fallback without a token and respects privacy", async () => {
    const d = await fetchProfileData({
      login: "mona",
      fetch: fake,
      location: { latitude: 1, longitude: 2 },
      calendar: async () => [[{ date: "2026-11-22", count: 4, level: 0, weekday: 0 }]],
    });
    expect(d.source).toBe("scrape");
    expect(d.repos.map((r) => r.name)).toEqual(["app"]);
    expect(d.totals.stars).toBe(7);
    expect(d.events).toHaveLength(1);
    expect(d.releases[0].tag).toBe("v1.0.0");
    expect(d.weather?.code).toBe(3);
    expect(d.weeks[0][0].level).toBe(4);
    expect(d.languages[0].color).toBe("#dea584");
  });
});

describe("build", () => {
  it("renders a preset with mock data", async () => {
    const out = tmp();
    const config = presetConfig("command-center", { login: "mona" });
    const res = await build({ config, outDir: out, mock: true, now: new Date("2026-11-26T09:00:00Z") });
    expect(res.errors).toEqual([]);
    expect(existsSync(join(out, "README.md"))).toBe(true);
    expect(existsSync(join(out, "preview.html"))).toBe(true);
    expect(existsSync(join(out, "hero-dark.svg"))).toBe(true);
    expect(existsSync(join(out, "hero-light.svg"))).toBe(true);
    expect(res.readme).toContain("raw.githubusercontent.com/mona/mona/readme-studio/hero-dark.svg");
    expect(dataNeeds(config).weather).toBe(true);
    expect(existsSync(join(out, "skyline-dark.gif"))).toBe(true);
  });

  it("converts WOFF to SFNT for rasterising", () => {
    const woff = readFileSync(join(__dirname, "../../core/assets/fonts/inter-400.woff"));
    const sfnt = woffToSfnt(woff);
    expect(sfnt.readUInt32BE(0)).toBe(0x00010000);
  });
});

describe("publish", () => {
  it("force-pushes assets to a branch and commits the README only when changed", () => {
    const git = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();
    const remote = tmp();
    git(remote, "init", "-q", "--bare");
    const ws = tmp();
    git(ws, "init", "-q", "-b", "main");
    git(ws, "config", "user.email", "t@t");
    git(ws, "config", "user.name", "t");
    writeFileSync(join(ws, "README.md"), "old\n");
    git(ws, "add", ".");
    git(ws, "commit", "-qm", "init");
    git(ws, "remote", "add", "origin", remote);
    git(ws, "push", "-q", "-u", "origin", "main");

    const assets = tmp();
    mkdirSync(join(assets, "sub"), { recursive: true });
    writeFileSync(join(assets, "a-dark.svg"), "<svg/>");
    publishAssets({ dir: assets, repository: "mona/mona", branch: "readme-studio", token: "t", remote });
    expect(git(remote, "ls-tree", "--name-only", "readme-studio")).toContain("a-dark.svg");

    const md = join(tmp(), "README.md");
    writeFileSync(md, "new\n");
    expect(commitReadme({ source: md, target: "README.md", workspace: ws })).toBe(true);
    expect(git(remote, "show", "main:README.md")).toBe("new");
    expect(commitReadme({ source: md, target: "README.md", workspace: ws })).toBe(false);

    // a pull request branch "pages/…" blocks an asset branch "pages": the error says why
    git(ws, "push", "-q", "origin", "main:refs/heads/pages/202611261626");
    const again = tmp();
    writeFileSync(join(again, "a-dark.svg"), "<svg/>");
    expect(() => publishAssets({ dir: again, repository: "mona/mona", branch: "pages", token: "ghs_fake", remote })).toThrow(/branches named "pages\/…"/);
  });
});
