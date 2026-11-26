/** A GitHub repository, as `owner/name`. */

const NAME = /^[\w.-]+$/;

export interface RepoRef {
  owner: string;
  name: string;
  /** owner/name */
  full: string;
}

export function repoRef(full: string): RepoRef | null {
  const [owner, name, extra] = full.trim().split("/");
  if (!owner || !name || extra !== undefined || !NAME.test(owner) || !NAME.test(name)) return null;
  return { owner, name, full: `${owner}/${name}` };
}

/** A profile README lives in the repository named exactly like its owner. */
export function isProfileRepo(r: RepoRef): boolean {
  return r.owner.toLowerCase() === r.name.toLowerCase();
}

/**
 * A repository from whatever someone pastes: `owner/name`, a github.com URL (with or without
 * https, `.git`, or a path inside the repository), or an SSH remote (`git@github.com:owner/name.git`).
 */
export function parseRepo(text: string): RepoRef | null {
  const t = text.trim().replace(/^git@github\.com:/i, "github.com/");
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)\/([^/?#\s]+)/i.exec(t);
  if (m) return repoRef(`${m[1]}/${m[2].replace(/\.git$/i, "")}`);
  return repoRef(t.replace(/\.git$/i, ""));
}
