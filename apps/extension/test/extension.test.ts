import { describe, expect, it } from "vitest";
import { normalizeConfig, serializeConfig } from "@readme-studio/core";
import { GitHub, _private } from "../src/github/api";
import { requestDeviceCode, waitForToken } from "../src/github/auth";
import { CONFIG_PATH, defaultPrBranch, filesFor, openDesign, saveDesign, starterFor, WORKFLOW_PATH } from "../src/github/design";
import { editorUrl, isFresh, PENDING_TTL } from "../src/github/editor";
import { buildManifest, manifestVersion } from "../src/manifest";
import { editorPage, isProfileRepo, repoFromUrl, repoRef } from "../src/repo";

const json = (v: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", ...headers } });

describe("where on GitHub", () => {
  it("finds repositories in URLs and skips GitHub's own pages", () => {
    expect(repoFromUrl("https://github.com/DavidNiessen/soundwave/tree/main/docs")?.full).toBe("DavidNiessen/soundwave");
    expect(repoFromUrl("https://github.com/mona/aurora.git")?.full).toBe("mona/aurora");
    expect(repoFromUrl("https://github.com/settings/profile")).toBeNull();
    expect(repoFromUrl("https://github.com/mona")).toBeNull();
    expect(repoFromUrl("https://gitlab.com/mona/aurora")).toBeNull();
    expect(repoRef("mona/aurora/extra")).toBeNull();
    expect(isProfileRepo(repoRef("Mona/mona")!)).toBe(true);
  });

  it("recognises GitHub's editor pages", () => {
    expect(editorPage("https://github.com/mona/aurora/edit/main/readme.config.json")).toMatchObject({ mode: "edit", branch: "main", path: "readme.config.json" });
    expect(editorPage("https://github.com/mona/aurora/new/main/.github/workflows?filename=readme.yml")).toMatchObject({ mode: "new", path: ".github/workflows/readme.yml" });
    expect(editorPage("https://github.com/mona/aurora/blob/main/README.md")).toBeNull();
  });
});

describe("manifests", () => {
  it("maps release and pre-release versions to store versions", () => {
    expect(manifestVersion("1.0.2")).toEqual({ version: "1.0.2", name: "1.0.2" });
    expect(manifestVersion("1.0.3-42")).toEqual({ version: "1.0.3.42", name: "1.0.3-42" });
    expect(() => manifestVersion("1.0")).toThrow();
    expect(() => manifestVersion("1.0.0-70000")).toThrow();
  });

  it("builds a Chrome service worker and a Firefox background script from one description", () => {
    const chrome = buildManifest("chrome", "1.0.3-42");
    const firefox = buildManifest("firefox", "1.0.3-42");
    expect(chrome).toMatchObject({ manifest_version: 3, version: "1.0.3.42", version_name: "1.0.3-42", background: { service_worker: "background.js" } });
    expect(firefox).toMatchObject({ version: "1.0.3.42", background: { scripts: ["background.js"] }, browser_specific_settings: { gecko: { id: "readme-studio@niessen.dev" } } });
    expect(firefox).not.toHaveProperty("version_name");
    for (const m of [chrome, firefox]) {
      expect(m.host_permissions).toEqual(["https://github.com/*", "https://api.github.com/*", "https://raw.githubusercontent.com/*"]);
      expect(m.web_accessible_resources).toEqual([{ resources: ["studio.html"], matches: ["https://github.com/*"] }]);
    }
  });
});

describe("opening a design", () => {
  const repo = repoRef("mona/aurora")!;
  const committed = serializeConfig({ ...starterFor(repo), theme: { ...starterFor(repo).theme, preset: "ocean" } });

  it("reads the committed design without signing in", async () => {
    const calls: string[] = [];
    const http = (async (u: string | URL) => {
      calls.push(String(u));
      if (String(u).endsWith("/repos/mona/aurora")) return json({ default_branch: "trunk", private: false });
      if (String(u).includes(`/trunk/${CONFIG_PATH}`)) return new Response(committed);
      return new Response("", { status: 404 });
    }) as typeof fetch;
    const o = await openDesign(new GitHub(null, http), repo);
    expect(o).toMatchObject({ branch: "trunk", configExists: true, workflowExists: false, configSha: null });
    expect(o.config.theme.preset).toBe("ocean");
    expect(calls.some((c) => c.startsWith("https://raw.githubusercontent.com/mona/aurora/trunk/"))).toBe(true);
  });

  it("starts a profile or project design when the repository has none, and survives the API rate limit", async () => {
    const http = (async (u: string | URL) => (String(u).startsWith("https://api.github.com") ? json({ message: "rate limit" }, 403) : new Response("", { status: 404 }))) as typeof fetch;
    const profile = await openDesign(new GitHub(null, http), repoRef("mona/mona")!);
    expect(profile).toMatchObject({ branch: "HEAD", configExists: false });
    expect(profile.config.kind).toBe("profile");
    const project = await openDesign(new GitHub(null, http), repo);
    expect(project.config.kind).toBe("project");
    expect(project.config.project.repo).toBe("mona/aurora");
  });
});

describe("saving a design", () => {
  const repo = repoRef("mona/aurora")!;
  const config = normalizeConfig(starterFor(repo)).config;

  function fakeGitHub(existing: Record<string, string>) {
    const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
    const http = (async (u: string | URL, init?: RequestInit) => {
      const url = new URL(String(u));
      const method = init?.method ?? "GET";
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (method !== "GET") writes.push({ method, path: url.pathname, body });
      const file = /\/contents\/(.+)$/.exec(url.pathname)?.[1];
      if (method === "GET" && file) {
        const path = decodeURIComponent(file);
        return path in existing ? json({ content: _private.toBase64(existing[path]), sha: `sha-${path}` }) : json({ message: "Not Found" }, 404);
      }
      if (method === "PUT") return json({ commit: { html_url: `https://github.com/mona/aurora/commit/${writes.length}` } }, 201);
      if (method === "GET" && url.pathname.includes("/git/ref/heads/")) return json({ object: { sha: "base-sha" } });
      if (method === "POST" && url.pathname.endsWith("/git/refs")) return json({}, 201);
      if (method === "POST" && url.pathname.endsWith("/pulls")) return json({ html_url: "https://github.com/mona/aurora/pull/7", number: 7 }, 201);
      return json({ message: "unexpected" }, 500);
    }) as typeof fetch;
    return { gh: new GitHub("t", http), writes };
  }

  it("commits the config with its SHA and adds the workflow when asked", async () => {
    const { gh, writes } = fakeGitHub({ [CONFIG_PATH]: "{}" });
    const r = await saveDesign(gh, { repo, branch: "main", config, message: "docs: design", addWorkflow: true, target: "commit" });
    expect(r.kind).toBe("commit");
    expect(writes.map((w) => [w.method, w.path])).toEqual([
      ["PUT", `/repos/mona/aurora/contents/${CONFIG_PATH}`],
      ["PUT", `/repos/mona/aurora/contents/${WORKFLOW_PATH}`],
    ]);
    expect(writes[0].body).toMatchObject({ branch: "main", sha: `sha-${CONFIG_PATH}`, message: "docs: design" });
    expect(_private.fromBase64(String(writes[0].body.content))).toBe(serializeConfig(config));
    expect(writes[1].body).not.toHaveProperty("sha");
  });

  it("skips unchanged files and opens a pull request from a new branch", async () => {
    const { gh, writes } = fakeGitHub({ [CONFIG_PATH]: serializeConfig(config), [WORKFLOW_PATH]: "old" });
    const r = await saveDesign(gh, { repo, branch: "main", config, message: "docs: design", addWorkflow: false, target: "pull-request", prBranch: "readme-studio/x" });
    expect(r).toEqual({ kind: "pull-request", url: "https://github.com/mona/aurora/pull/7" });
    expect(writes.map((w) => [w.method, w.path])).toEqual([
      ["POST", "/repos/mona/aurora/git/refs"],
      ["POST", "/repos/mona/aurora/pulls"],
    ]);
    expect(writes[0].body).toEqual({ ref: "refs/heads/readme-studio/x", sha: "base-sha" });
    expect(writes[1].body).toMatchObject({ head: "readme-studio/x", base: "main" });
  });

  it("lists the files a save writes and names pull request branches by time", () => {
    expect(filesFor({ config, addWorkflow: false }).map((f) => f.path)).toEqual([CONFIG_PATH]);
    expect(filesFor({ config, addWorkflow: true })[1].text).toContain("DavidNiessen/readme-studio@v1");
    expect(defaultPrBranch(new Date("2026-11-26T13:05:00Z"))).toBe("readme-studio/202611261305");
  });
});

describe("GitHub's editor", () => {
  it("pre-fills new files in the URL and opens existing ones for the content script", () => {
    const e = { repo: "mona/aurora", branch: "main", path: ".github/workflows/readme.yml", text: "name: readme\n" };
    const fresh = new URL(editorUrl(e, false));
    expect(fresh.pathname).toBe("/mona/aurora/new/main/.github/workflows");
    expect(fresh.searchParams.get("filename")).toBe("readme.yml");
    expect(fresh.searchParams.get("value")).toBe("name: readme\n");
    expect(editorUrl({ ...e, path: CONFIG_PATH }, true)).toBe("https://github.com/mona/aurora/edit/main/readme.config.json");
    expect(isFresh({ ...e, at: 0 }, PENDING_TTL - 1)).toBe(true);
    expect(isFresh({ ...e, at: 0 }, PENDING_TTL + 1)).toBe(false);
    expect(isFresh(undefined)).toBe(false);
  });
});

describe("sign in with GitHub (device flow)", () => {
  it("polls until approved and slows down when GitHub asks", async () => {
    const answers = [{ error: "authorization_pending" }, { error: "slow_down", interval: 12 }, { access_token: "gho_x" }];
    const waits: number[] = [];
    const http = (async (u: string | URL) => {
      if (String(u).endsWith("/login/device/code")) return json({ device_code: "dc", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", interval: 5, expires_in: 900 });
      return json(answers.shift());
    }) as typeof fetch;
    const code = await requestDeviceCode("cid", http, 0);
    expect(code).toMatchObject({ userCode: "ABCD-1234", interval: 5, expiresAt: 900_000 });
    const token = await waitForToken("cid", code, { http, now: () => 0, sleep: async (ms) => void waits.push(ms) });
    expect(token).toBe("gho_x");
    expect(waits).toEqual([5000, 5000, 12000]);
  });

  it("explains a disabled device flow and a denied sign-in", async () => {
    const off = (async () => json({ error: "device_flow_disabled" })) as unknown as typeof fetch;
    await expect(requestDeviceCode("cid", off)).rejects.toThrow(/Enable Device Flow/);
    const denied = (async () => json({ error: "access_denied" })) as unknown as typeof fetch;
    const code = { deviceCode: "d", userCode: "u", verificationUri: "", interval: 1, expiresAt: 10_000 };
    await expect(waitForToken("cid", code, { http: denied, now: () => 0, sleep: async () => {} })).rejects.toThrow(/cancelled/);
  });
});
