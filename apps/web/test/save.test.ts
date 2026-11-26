import { presetConfig } from "@readme-studio/core";
import { describe, expect, it } from "vitest";
import { GitHub } from "../src/github/api";
import { CONFIG_PATH, saveDesign, WORKFLOW_PATH } from "../src/github/design";
import { repoRef } from "../src/github/repo";

/** A fake GitHub that records every write. */
function fakeGitHub(opts: { moveFails?: boolean; existing?: Record<string, string> } = {}) {
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  const http = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const path = url.pathname;
    if (method !== "GET") writes.push({ method, path, body });
    if (path.endsWith("/git/ref/heads/main")) return json({ object: { sha: "base" } });
    if (path.includes("/contents/")) {
      const file = decodeURIComponent(path.split("/contents/")[1]);
      const text = opts.existing?.[file];
      return text === undefined ? json({ message: "Not Found" }, 404) : json({ content: btoa(text), sha: "s" });
    }
    if (path.endsWith("/git/commits/base")) return json({ tree: { sha: "tree0" } });
    if (path.endsWith("/git/trees")) return json({ sha: "tree1" });
    if (path.endsWith("/git/commits")) return json({ sha: "c1", html_url: "https://github.com/mona/aurora/commit/c1" });
    if (path.endsWith("/git/refs/heads/main")) return opts.moveFails ? json({ message: "Update is not a fast forward" }, 422) : json({});
    if (path.endsWith("/git/refs")) return json({}, 201);
    if (path.endsWith("/pulls")) return json({ html_url: "https://github.com/mona/aurora/pull/7", number: 7 }, 201);
    return json({ message: `unexpected ${method} ${path}` }, 500);
  }) as typeof fetch;
  return { gh: new GitHub("token", http), writes };
}

const repo = repoRef("mona/aurora")!;
const config = { ...presetConfig("oss-library", { login: "mona" }, { repo: "mona/aurora" }), kind: "project" as const };

describe("saving to GitHub", () => {
  it("commits the config and the workflow together, in one commit", async () => {
    const { gh, writes } = fakeGitHub();
    const r = await saveDesign(gh, { repo, branch: "main", config, message: "docs: design", addWorkflow: true, target: "commit" });
    expect(r).toEqual({ url: "https://github.com/mona/aurora/commit/c1", kind: "commit" });
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual(["POST /repos/mona/aurora/git/trees", "POST /repos/mona/aurora/git/commits", "PATCH /repos/mona/aurora/git/refs/heads/main"]);
    expect((writes[0].body.tree as { path: string }[]).map((t) => t.path)).toEqual([CONFIG_PATH, WORKFLOW_PATH]);
    expect(writes[2].body).toEqual({ sha: "c1", force: false });
  });

  it("opens a pull request from one commit, and leaves out unchanged files", async () => {
    const { gh, writes } = fakeGitHub({ existing: { [WORKFLOW_PATH]: "" } });
    const r = await saveDesign(gh, { repo, branch: "main", config, message: "docs: design", addWorkflow: false, target: "pull-request", prBranch: "readme-studio-1" });
    expect(r.kind).toBe("pull-request");
    expect((writes[0].body.tree as { path: string }[]).map((t) => t.path)).toEqual([CONFIG_PATH]);
    expect(writes.find((w) => w.path.endsWith("/git/refs"))?.body).toEqual({ ref: "refs/heads/readme-studio-1", sha: "c1" });
  });

  it("refuses to overwrite a branch that moved on", async () => {
    const { gh } = fakeGitHub({ moveFails: true });
    await expect(saveDesign(gh, { repo, branch: "main", config, message: "m", addWorkflow: false, target: "commit" })).rejects.toThrow(/changed while saving/);
  });
});
