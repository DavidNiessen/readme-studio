import { readFileSync } from "node:fs";

/**
 * The branch this run is on and the repository's default branch, read from the
 * Actions environment. `defaultBranch` is null when the event payload does not say.
 */
export function runBranches(env: NodeJS.ProcessEnv = process.env, read: (path: string) => string = (p) => readFileSync(p, "utf8")): { ref: string; defaultBranch: string | null } {
  const ref = env.GITHUB_REF_TYPE === "tag" ? "" : (env.GITHUB_REF_NAME ?? "");
  let defaultBranch: string | null = null;
  if (env.GITHUB_EVENT_PATH) {
    try {
      const payload = JSON.parse(read(env.GITHUB_EVENT_PATH)) as { repository?: { default_branch?: unknown } };
      if (typeof payload.repository?.default_branch === "string" && payload.repository.default_branch) defaultBranch = payload.repository.default_branch;
    } catch {
      /* no readable payload: fall through */
    }
  }
  return { ref, defaultBranch };
}

/**
 * Why this run must not publish, or null when it may. Only the default branch
 * publishes: assets live on one shared branch, so a run on a feature branch would
 * overwrite the images the default branch's README points at. When the default
 * branch is unknown, publishing is allowed (the behaviour before this check).
 */
export function publishBlocker(event: string, b: { ref: string; defaultBranch: string | null }): string | null {
  if (event === "pull_request" || event === "pull_request_target") return "pull request";
  if (!b.defaultBranch) return null;
  if (b.ref !== b.defaultBranch) return `not the default branch (${b.ref || "a tag"}; ${b.defaultBranch} publishes)`;
  return null;
}
