import { normalizeConfig, parseConfig, presetConfig, serializeConfig, workflowYaml, type Block, type StudioConfig } from "@readme-studio/core";
import { isProfileRepo, type RepoRef } from "./repo";
import { GitHub, GitHubError } from "./api";

export const CONFIG_PATH = "readme.config.json";
export const WORKFLOW_PATH = ".github/workflows/readme.yml";

/** What the studio knows about the repository it edits. */
export interface Opened extends SaveTarget {
  config: StudioConfig;
  name: string;
  warnings: string[];
  /** the committed config's SHA (null when it does not exist yet, or was read without the API) */
  configSha: string | null;
  /** the README the design was started from, when the repository had no design yet */
  importedReadme: string | null;
}

/** A starting design for a repository without one: a profile preset for `login/login`, a project preset otherwise. */
export function starterFor(repo: RepoRef): StudioConfig {
  if (isProfileRepo(repo)) return { ...presetConfig("command-center", { login: repo.owner, name: repo.owner }), kind: "profile" };
  return { ...presetConfig("oss-library", { login: repo.owner, name: repo.owner }, { repo: repo.full }), kind: "project" };
}

/**
 * Longest section kept in one Markdown block; longer ones are split at paragraphs. Well under the
 * widget's limit, so an imported section can still grow while it is edited.
 */
export const MARKDOWN_MAX = 8000;

/** Top-level sections of a Markdown document, never splitting inside fenced code. */
export function splitSections(md: string, max = MARKDOWN_MAX): string[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const sections: string[][] = [[]];
  let fence: string | null = null;
  for (const line of lines) {
    const f = /^(```|~~~)/.exec(line)?.[1];
    if (f) fence = fence === null ? f : fence === f ? null : fence;
    if (fence === null && /^##\s/.test(line) && sections[sections.length - 1].some((l) => l.trim())) sections.push([]);
    sections[sections.length - 1].push(line);
  }
  const out: string[] = [];
  for (const s of sections.map((x) => x.join("\n").trim()).filter(Boolean)) {
    if (s.length <= max) {
      out.push(s);
      continue;
    }
    // too long for one block: cut at blank lines outside code, as late as possible
    let chunk = "";
    let inFence = false;
    for (const para of s.split(/\n\n/)) {
      const piece = chunk ? `${chunk}\n\n${para}` : para;
      if (piece.length > max && chunk && !inFence) {
        out.push(chunk);
        chunk = para;
      } else chunk = piece;
      if ((para.match(/^(```|~~~)/gm) ?? []).length % 2 === 1) inFence = !inFence;
    }
    if (chunk) out.push(chunk);
  }
  return out;
}

/**
 * A first design for a repository that has a README but no Readme Studio design: the studio's
 * header for its kind (hero and shields, or hero and social links) above the existing README,
 * kept word for word as Markdown blocks, one per section. A leading title that only repeats
 * the repository name is dropped, since the hero shows it.
 */
export function designFromReadme(repo: RepoRef, readme: string): StudioConfig {
  const starter = starterFor(repo);
  let text = readme.replace(/\r\n?/g, "\n").trim();
  const title = /^#\s+(.+?)\s*#*\s*$/m.exec(text.split("\n")[0] ?? "");
  if (title && title[1].replace(/[*_`]/g, "").trim().toLowerCase() === repo.name.toLowerCase()) text = text.split("\n").slice(1).join("\n").trim();
  const header: Block[][] =
    starter.kind === "profile" ? [[{ id: "hero", type: "hero", options: {} }], [{ id: "socials", type: "socials", options: {} }]] : [[{ id: "hero", type: "project-hero", options: {} }], [{ id: "shields", type: "shields", options: {} }]];
  const blocks = splitSections(text).map((section, i): Block => ({ id: i === 0 ? "readme" : `readme-${i + 1}`, type: "markdown", options: { text: section } }));
  const layout = [...header, ...blocks.map((b) => [b])].map((row, i) => ({ id: `r${i}`, align: (row[0].type === "markdown" ? "left" : "center") as "left" | "center", blocks: row }));
  return normalizeConfig({ ...starter, layout }).config;
}

/**
 * GitHub answered 404 for the repository: it does not exist, or it is private and the extension
 * is not signed in (or the account or token has no access to it). GitHub does not say which.
 */
export class RepoUnavailable extends Error {
  constructor(
    readonly repo: RepoRef,
    /** whether the request was made with a token */
    readonly signedIn: boolean,
    /** GitHub's limit for requests without a token was used up, so it could not even be asked */
    readonly rateLimited = false,
  ) {
    super(`${repo.full} was not found`);
  }
}

/** GitHub answered 401: the stored token expired or was revoked. */
export class TokenRejected extends Error {
  constructor() {
    super("GitHub no longer accepts the saved sign-in");
  }
}

/**
 * The branch to read and write: `ref`, else the default branch. Asked even with a ref, since it
 * is how a private repository shows up (404) before any file is read. `limited`: the API was
 * rate-limited, so the branch is HEAD and only raw files can be read.
 */
async function resolveBranch(gh: GitHub, repo: RepoRef, ref?: string): Promise<{ branch: string; limited: boolean }> {
  try {
    const info = await gh.repo(repo.full);
    return { branch: ref ?? info.defaultBranch, limited: false };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) throw new RepoUnavailable(repo, gh.signedIn);
    if (e instanceof GitHubError && e.status === 401 && gh.signedIn) throw new TokenRejected();
    // unauthenticated API calls are rate-limited; raw files still answer on HEAD
    if (!(e instanceof GitHubError) || (e.status !== 403 && e.status !== 429)) throw e;
    return { branch: ref ?? "HEAD", limited: true };
  }
}

async function designFiles(gh: GitHub, repo: RepoRef, branch: string, limited: boolean) {
  return Promise.all([gh.file(repo.full, CONFIG_PATH, branch), gh.file(repo.full, WORKFLOW_PATH, branch)]).catch((e) => {
    if (limited && e instanceof GitHubError && (e.status === 403 || e.status === 429)) throw new RepoUnavailable(repo, gh.signedIn, true);
    throw e;
  });
}

/** Where a save goes, and what is there already. */
export interface SaveTarget {
  repo: RepoRef;
  /** "HEAD" when it could only be read without the API; resolved before writing */
  branch: string;
  configExists: boolean;
  workflowExists: boolean;
}

/** What the save dialog needs to know about a repository the design was not opened from. */
export async function inspectRepo(gh: GitHub, repo: RepoRef): Promise<SaveTarget> {
  const { branch, limited } = await resolveBranch(gh, repo);
  const [config, workflow] = await designFiles(gh, repo, branch, limited);
  return { repo, branch, configExists: !!config, workflowExists: !!workflow };
}

/** Loads the repository's committed design, or a starter design when it has none. */
export async function openDesign(gh: GitHub, repo: RepoRef, ref?: string): Promise<Opened> {
  const { branch, limited } = await resolveBranch(gh, repo, ref);
  const [config, workflow] = await designFiles(gh, repo, branch, limited);
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
      importedReadme: null,
    };
  }
  // no design yet: start from the README the repository already has
  const readme = await gh.readme(repo.full, branch).catch(() => null);
  const imported = readme && readme.text.trim() ? readme : null;
  // without the API, a missing or private repository looks like one without any files
  if (limited && !readme && !workflow) throw new RepoUnavailable(repo, gh.signedIn, true);
  return {
    repo,
    branch,
    config: imported ? designFromReadme(repo, imported.text) : starterFor(repo),
    warnings: [],
    name: `${repo.full} README`,
    configSha: null,
    configExists: false,
    workflowExists: !!workflow,
    importedReadme: imported?.path ?? null,
  };
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
