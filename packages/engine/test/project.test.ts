import { describe, expect, it } from "vitest";
import { fetchProjectData, lastPage, normalizeConfig, presetConfig, summarizeNotes, assetRepository, setupGuide, workflowPath } from "@readme-studio/core";

const json = (v: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json", ...(init.headers ?? {}) }, ...init });

describe("project data", () => {
  let activityCalls = 0;
  const fake = (async (input: string | URL) => {
    const u = String(input);
    if (u.endsWith("/repos/mona/aurora"))
      return json({ name: "aurora", full_name: "mona/aurora", owner: { login: "mona" }, description: "Tokens", homepage: "https://aurora.dev", html_url: "https://github.com/mona/aurora", topics: ["css"], license: { spdx_id: "MIT", name: "MIT License" }, default_branch: "main", created_at: "2024-01-01T00:00:00Z", pushed_at: "2026-11-25T00:00:00Z", stargazers_count: 250, forks_count: 12, subscribers_count: 9, watchers_count: 250, open_issues_count: 7, size: 100, language: "TypeScript" });
    if (u.includes("/languages")) return json({ TypeScript: 900, CSS: 100 });
    if (u.includes("/contributors?per_page=1&")) return json([{}], { headers: { link: '<https://api.github.com/x?per_page=1&page=2>; rel="next", <https://api.github.com/x?per_page=1&anon=1&page=17>; rel="last"' } });
    if (u.includes("/contributors"))
      return json([
        { login: "mona", avatar_url: "https://avatars.example/u/1?v=4", contributions: 300, type: "User" },
        { login: "dependabot[bot]", avatar_url: "https://avatars.example/u/2", contributions: 40, type: "Bot" },
        { login: "hubot", avatar_url: "https://avatars.example/u/3?v=4", contributions: 12, type: "User" },
      ]);
    if (u.startsWith("https://avatars.example/")) return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png" } });
    if (u.includes("/stats/commit_activity")) return activityCalls++ === 0 ? new Response("", { status: 202 }) : json(Array.from({ length: 52 }, (_, i) => ({ total: i })));
    if (u.includes("/commits?per_page=1")) return json([{ sha: "abcdef1234567", commit: { message: "feat: x\n\nbody", author: { name: "Mona", date: "2026-11-25T00:00:00Z" } }, author: { login: "mona" } }]);
    if (u.includes("/releases")) return json([{ tag_name: "v1.2.0", name: "", html_url: "https://github.com/mona/aurora/releases/tag/v1.2.0", published_at: "2026-11-01T00:00:00Z", draft: false, prerelease: false, body: "## What's Changed\n* Faster builds by @mona in https://github.com/mona/aurora/pull/1" }, { tag_name: "v1.3.0", name: "", html_url: "", published_at: null, draft: true, prerelease: false, body: "" }]);
    if (u.includes("/search/issues")) return json({ total_count: u.includes("is%3Amerged") ? 40 : u.includes("is%3Apr") ? 2 : u.includes("is%3Aclosed") ? 30 : 5 });
    if (u.includes("/actions/runs")) return json({ workflow_runs: [{ name: "ci", status: "completed", conclusion: "success", html_url: "https://github.com/mona/aurora/actions/runs/1" }] });
    if (u.includes("/milestones")) return json([{ title: "v2", open_issues: 3, closed_issues: 7, due_on: "2027-01-01T00:00:00Z", html_url: "", state: "open" }]);
    if (u.includes("/stargazers")) return json([{ starred_at: "2024-02-01T00:00:00Z" }, { starred_at: "2024-03-01T00:00:00Z" }], { headers: { link: '<https://api.github.com/x?per_page=100&page=3>; rel="last"' } });
    if (u.includes("api.npmjs.org")) return json({ downloads: Array.from({ length: 365 }, (_, i) => ({ day: `d${i}`, downloads: 10 })) });
    if (u.includes("registry.npmjs.org")) return json({ version: "1.2.0" });
    return new Response("nope", { status: 404 });
  }) as typeof fetch;

  it("reads a repository through REST, embedding avatars and skipping bots and drafts", async () => {
    const p = await fetchProjectData({ repo: "mona/aurora", fetch: fake, packages: { npm: "aurora" } });
    expect(p).toMatchObject({ fullName: "mona/aurora", stars: 250, forks: 12, watchers: 9, license: "MIT", openIssues: 5, closedIssues: 30, openPulls: 2, mergedPulls: 40, contributorCount: 17 });
    expect(p.contributors.map((c) => c.login)).toEqual(["mona", "hubot"]);
    expect(p.contributors[0].avatar).toBe("data:image/png;base64,iVBORw==");
    expect(p.commitWeeks).toHaveLength(52);
    expect(p.lastCommit).toMatchObject({ message: "feat: x", sha: "abcdef1" });
    expect(p.releases.map((r) => r.tag)).toEqual(["v1.2.0"]);
    expect(p.releaseNotes["v1.2.0"]).toBe("Faster builds by @mona in");
    expect(p.ci?.status).toBe("passing");
    expect(p.milestones[0]).toMatchObject({ title: "v2", open: 3, closed: 7, dueOn: "2027-01-01" });
    expect(p.starHistory.at(-1)?.stars).toBe(250);
    expect(p.downloads[0]).toMatchObject({ registry: "npm", lastWeek: 70, lastMonth: 300, version: "1.2.0" });
    expect(p.languages[0].name).toBe("TypeScript");
  });

  it("prefers full releases and reads the build from the project's own workflow", async () => {
    const rel = (tag: string, day: number, prerelease: boolean) => ({ tag_name: tag, name: "", html_url: `https://github.com/mona/aurora/releases/tag/${tag}`, published_at: `2026-11-${day}T00:00:00Z`, draft: false, prerelease, body: "" });
    const run = (name: string, path: string, status: string, conclusion: string | null, event = "push") => ({ name, path, event, status, conclusion, html_url: `https://github.com/mona/aurora/actions/${name}` });
    const with_ = (releases: unknown[], runs: unknown[]) =>
      (async (input: string | URL) => {
        const u = String(input);
        if (u.includes("/releases")) return json(releases);
        if (u.includes("/actions/runs")) return json({ workflow_runs: runs });
        return fake(input);
      }) as typeof fetch;
    // both names the README's workflow has had are skipped: readme-studio.yml now, readme.yml before
    // Dependabot's runs (event "dynamic") are skipped too: their names are whole PR titles
    const runs = [run("npm_and_yarn in / for @types/node, vite - Update #1733184849", "dynamic/dependabot/dependabot-updates", "completed", "success", "dynamic"), run("Readme Studio", ".github/workflows/readme-studio.yml", "in_progress", null), run("readme", ".github/workflows/readme.yml", "completed", "failure"), run("profile", ".github/workflows/profile.yml", "completed", "success"), run("Pre-release", ".github/workflows/prerelease.yml", "completed", "failure")];

    const mixed = await fetchProjectData({ repo: "mona/aurora", fetch: with_([rel("v1.5.1-108", 23, true), rel("v1.5.1", 22, false), rel("v1.5.0", 21, false)], runs), avatars: 0 });
    expect(mixed.releases.map((r) => r.tag)).toEqual(["v1.5.1", "v1.5.0"]);
    // the README's own (running) workflow is skipped by default; the next run is the build
    expect(mixed.ci).toMatchObject({ name: "profile", status: "passing" });

    const only = await fetchProjectData({ repo: "mona/aurora", fetch: with_([rel("v0.1.0-3", 23, true), rel("v0.1.0-2", 22, true)], runs), avatars: 0, skipWorkflow: ".github/workflows/profile.yml" });
    expect(only.releases.map((r) => r.tag)).toEqual(["v0.1.0-3", "v0.1.0-2"]);
    expect(only.ci).toMatchObject({ name: "Pre-release", status: "failing" });

    expect(workflowPath("mona/aurora/.github/workflows/readme.yml@refs/heads/main")).toBe(".github/workflows/readme.yml");
    expect(workflowPath(undefined)).toBeUndefined();
  });

  it("parses Link headers and summarises release notes", () => {
    expect(lastPage('<https://x?page=2>; rel="next", <https://x?page=9>; rel="last"')).toBe(9);
    expect(lastPage(null)).toBe(1);
    expect(summarizeNotes("## Highlights\n- **New** [docs](https://x)\n```js\ncode\n```\n**Full Changelog**: https://x")).toBe("Highlights · New docs");
  });
});

describe("project config", () => {
  it("normalises the project block and targets the project repository", () => {
    const { config } = normalizeConfig({ kind: "project", profile: { login: "mona" }, project: { repo: "https://github.com/mona/aurora.git", packages: { npm: " aurora " } } });
    expect(config.kind).toBe("project");
    expect(config.project.repo).toBe("mona/aurora");
    expect(config.project.packages.npm).toBe("aurora");
    expect(assetRepository(config)).toBe("mona/aurora");
    expect(setupGuide(config)).toContain("github.com/mona/aurora");
    expect(normalizeConfig({ kind: "nope" }).config.kind).toBe("profile");
    expect(presetConfig("command-center").kind).toBe("profile");
  });
});
