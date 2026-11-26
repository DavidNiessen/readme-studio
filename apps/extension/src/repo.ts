/** Where on GitHub the user is, worked out from the URL and the page's own metadata. */
import { isProfileRepo, repoRef, type RepoRef } from "@readme-studio/web/github/repo";

export { isProfileRepo, repoRef, type RepoRef };

/** First path segments that are GitHub pages, not users or organisations. */
const RESERVED = new Set([
  "about", "account", "apps", "codespaces", "collections", "contact", "copilot", "customer-stories", "dashboard",
  "enterprise", "events", "explore", "features", "gist", "issues", "login", "logout", "marketplace", "new",
  "notifications", "orgs", "organizations", "pricing", "pulls", "search", "security", "settings", "signup",
  "site", "sponsors", "stars", "team", "topics", "trending", "users",
]);

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

const README_FILE = /^readme(\.(md|markdown|mdx|mkdn|rst|txt|adoc|asciidoc|org))?$/i;

/**
 * Pages where the README is what you are looking at: the repository's overview (`/owner/repo`,
 * or a branch's root `/owner/repo/tree/<branch>`) and a README file's own page
 * (`/owner/repo/blob/<branch>/…/README.md`). The corner button shows only there.
 */
export function isReadmeSurface(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.hostname !== "github.com" || !repoFromUrl(url)) return false;
  const rest = u.pathname.split("/").filter(Boolean).slice(2);
  if (rest.length === 0) return true;
  if (rest[0] === "tree") return rest.length === 2;
  if (rest[0] === "blob") return rest.length >= 3 && README_FILE.test(decodeURIComponent(rest[rest.length - 1]));
  return false;
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
