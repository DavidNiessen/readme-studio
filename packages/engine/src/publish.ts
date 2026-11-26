import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";

function git(args: string[], cwd: string, secret?: string): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    const msg = `${err.stderr || err.message}`;
    throw new Error(`git ${args[0]} failed: ${secret ? msg.split(secret).join("***") : msg}`);
  }
}

export interface PublishAssetsOptions {
  dir: string;
  repository: string;
  branch: string;
  token: string;
  message?: string;
  server?: string;
  /** explicit remote URL (tests); defaults to the authenticated https URL */
  remote?: string;
}

/** Force-push the contents of `dir` as a single orphan commit to `branch`. */
export function publishAssets(o: PublishAssetsOptions): void {
  const server = (o.server ?? "https://github.com").replace(/^https?:\/\//, "");
  rmSync(join(o.dir, ".git"), { recursive: true, force: true });
  git(["init", "-q"], o.dir);
  git(["checkout", "-q", "-b", o.branch], o.dir);
  git(["config", "user.name", BOT_NAME], o.dir);
  git(["config", "user.email", BOT_EMAIL], o.dir);
  git(["add", "-A"], o.dir);
  git(["commit", "-q", "-m", o.message ?? `chore(readme-studio): render the README images ${new Date().toISOString().slice(0, 10)}`], o.dir);
  const remote = o.remote ?? `https://x-access-token:${o.token}@${server}/${o.repository}.git`;
  git(["push", "-q", "--force", remote, `${o.branch}:${o.branch}`], o.dir, o.token);
  rmSync(join(o.dir, ".git"), { recursive: true, force: true });
}

export interface CommitReadmeOptions {
  /** generated README */
  source: string;
  /** README path inside the workspace */
  target: string;
  workspace: string;
  message?: string;
  push?: boolean;
}

/** Copy the README into the workspace and commit + push it only when it changed. Returns whether it changed. */
export function commitReadme(o: CommitReadmeOptions): boolean {
  const target = join(o.workspace, o.target);
  const before = existsSync(target) ? readFileSync(target, "utf8") : null;
  const after = readFileSync(o.source, "utf8");
  if (before === after) return false;
  copyFileSync(o.source, target);
  git(["config", "user.name", BOT_NAME], o.workspace);
  git(["config", "user.email", BOT_EMAIL], o.workspace);
  git(["add", o.target], o.workspace);
  git(["commit", "-q", "-m", o.message ?? "chore(readme-studio): update the README [skip ci]"], o.workspace);
  if (o.push !== false) git(["push", "-q"], o.workspace);
  return true;
}
