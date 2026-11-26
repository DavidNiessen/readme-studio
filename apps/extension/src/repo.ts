/** Where on GitHub the user is, worked out from the URL and the page's own metadata. */

/** First path segments that are GitHub pages, not users or organisations. */
const RESERVED = new Set([
  "about", "account", "apps", "codespaces", "collections", "contact", "copilot", "customer-stories", "dashboard",
  "enterprise", "events", "explore", "features", "gist", "issues", "login", "logout", "marketplace", "new",
  "notifications", "orgs", "organizations", "pricing", "pulls", "search", "security", "settings", "signup",
  "site", "sponsors", "stars", "team", "topics", "trending", "users",
]);

const NAME = /^[\w.-]+$/;

export interface RepoRef {
  owner: string;
  name: string;
  /** owner/name */
  full: string;
}

export function repoRef(full: string): RepoRef | null {
  const [owner, name, extra] = full.split("/");
  if (!owner || !name || extra !== undefined || !NAME.test(owner) || !NAME.test(name)) return null;
  return { owner, name, full: `${owner}/${name}` };
}

/** The repository a github.com URL belongs to, if any. */
export function repoFromUrl(url: string): RepoRef | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname !== "github.com") return null;
  const [owner, name] = u.pathname.split("/").filter(Boolean);
  if (!owner || !name || RESERVED.has(owner.toLowerCase())) return null;
  return repoRef(`${owner}/${name.replace(/\.git$/, "")}`);
}

/**
 * The repository of the current page. GitHub marks repository pages with
 * `octolytics-dimension-repository_nwo`; the URL is the fallback.
 */
export function repoFromDocument(doc: Document, url: string): RepoRef | null {
  const nwo = doc.querySelector<HTMLMetaElement>('meta[name="octolytics-dimension-repository_nwo"]')?.content;
  return (nwo && repoRef(nwo)) || repoFromUrl(url);
}

/** A profile README lives in the repository named exactly like its owner. */
export function isProfileRepo(r: RepoRef): boolean {
  return r.owner.toLowerCase() === r.name.toLowerCase();
}

/** GitHub's web editor page for a file: `/owner/name/edit/branch/path` or `/new/branch?filename=`. */
export function editorPage(url: string): { repo: RepoRef; mode: "edit" | "new"; branch: string; path: string } | null {
  const u = new URL(url);
  if (u.hostname !== "github.com") return null;
  const [owner, name, mode, branch, ...rest] = u.pathname.split("/").filter(Boolean);
  const repo = owner && name ? repoRef(`${owner}/${name}`) : null;
  if (!repo || (mode !== "edit" && mode !== "new") || !branch) return null;
  const path = mode === "edit" ? rest.join("/") : [...rest, u.searchParams.get("filename") ?? ""].filter(Boolean).join("/");
  return { repo, mode, branch, path };
}
