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
