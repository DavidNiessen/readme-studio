import { parseConfig, presetConfig, serializeConfig, workflowYaml, type StudioConfig } from "@readme-studio/core";
import { isProfileRepo, type RepoRef } from "../repo";
import { GitHub, GitHubError } from "./api";

export const CONFIG_PATH = "readme.config.json";
export const WORKFLOW_PATH = ".github/workflows/readme.yml";

/** What the studio knows about the repository it edits. */
export interface Opened {
  repo: RepoRef;
  branch: string;
  config: StudioConfig;
  name: string;
  warnings: string[];
  /** the committed config's SHA (null when it does not exist yet, or was read without the API) */
  configSha: string | null;
  configExists: boolean;
  workflowExists: boolean;
}

/** A starting design for a repository without one: a profile preset for `login/login`, a project preset otherwise. */
export function starterFor(repo: RepoRef): StudioConfig {
  if (isProfileRepo(repo)) return { ...presetConfig("command-center", { login: repo.owner, name: repo.owner }), kind: "profile" };
  return { ...presetConfig("oss-library", { login: repo.owner, name: repo.owner }, { repo: repo.full }), kind: "project" };
}

/** Loads the repository's committed design, or a starter design when it has none. */
export async function openDesign(gh: GitHub, repo: RepoRef, ref?: string): Promise<Opened> {
  let branch = ref;
  if (!branch) {
    try {
      branch = (await gh.repo(repo.full)).defaultBranch;
    } catch (e) {
      // unauthenticated API calls are rate-limited; raw files still answer on HEAD
      if (!(e instanceof GitHubError) || (e.status !== 403 && e.status !== 429)) throw e;
      branch = "HEAD";
    }
  }
  const [config, workflow] = await Promise.all([gh.file(repo.full, CONFIG_PATH, branch), gh.file(repo.full, WORKFLOW_PATH, branch)]);
  if (config) {
    const parsed = parseConfig(config.text);
    return {
      repo,
      branch,
      config: parsed.config,
      warnings: parsed.warnings,
      name: `${repo.full} README`,
      configSha: config.sha,
      configExists: true,
      workflowExists: !!workflow,
    };
  }
  return { repo, branch, config: starterFor(repo), warnings: [], name: `${repo.full} README`, configSha: null, configExists: false, workflowExists: !!workflow };
}

export interface SaveRequest {
  repo: RepoRef;
  /** branch the design was opened from; also the base of a pull request */
  branch: string;
  config: StudioConfig;
  message: string;
  /** also add .github/workflows/readme.yml (only offered when it is missing) */
  addWorkflow: boolean;
  target: "commit" | "pull-request";
  /** branch name for a pull request */
  prBranch?: string;
}

export interface SaveResult {
  url: string;
  kind: "commit" | "pull-request";
}

/** The files a save writes, in order. */
export function filesFor(r: Pick<SaveRequest, "config" | "addWorkflow">): { path: string; text: string }[] {
  const files = [{ path: CONFIG_PATH, text: serializeConfig(r.config) }];
  if (r.addWorkflow) files.push({ path: WORKFLOW_PATH, text: workflowYaml(r.config) });
  return files;
}

export function defaultPrBranch(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return `readme-studio/${stamp}`;
}

/**
 * Writes the design: straight onto the branch, or onto a new branch with a pull request. The
 * config's current SHA is read again just before writing, so a concurrent change fails loudly
 * instead of being overwritten.
 */
export async function saveDesign(gh: GitHub, r: SaveRequest): Promise<SaveResult> {
  const files = filesFor(r);
  let branch = r.branch;
  if (r.target === "pull-request") {
    branch = r.prBranch || defaultPrBranch();
    await gh.createBranch(r.repo.full, branch, await gh.branchSha(r.repo.full, r.branch));
  }
  let commitUrl = "";
  for (const f of files) {
    const current = await gh.file(r.repo.full, f.path, branch);
    if (current?.text === f.text) continue;
    try {
      commitUrl = (await gh.putFile(r.repo.full, { path: f.path, text: f.text, message: r.message, branch, sha: current?.sha })).commitUrl;
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404 && f.path === WORKFLOW_PATH) {
        throw new Error("GitHub refused the workflow file. Sign in again so the extension can update workflows, or add it without the workflow.");
      }
      throw e;
    }
  }
  if (r.target === "pull-request") {
    const pr = await gh.openPullRequest(r.repo.full, {
      head: branch,
      base: r.branch,
      title: r.message,
      body: "Updated with [Readme Studio](https://readme.niessen.dev). The readme workflow renders the images and the README after this is merged.",
    });
    return { url: pr.url, kind: "pull-request" };
  }
  if (!commitUrl) return { url: `https://github.com/${r.repo.full}/blob/${encodeURIComponent(branch)}/${CONFIG_PATH}`, kind: "commit" };
  return { url: commitUrl, kind: "commit" };
}
