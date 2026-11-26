/**
 * Markdown in a README is written relative to its repository: `docs/shot.png`,
 * `CONTRIBUTING.md`, `#install`. On GitHub those resolve against the repo; in the
 * studio they would resolve against the studio itself (broken images, links that
 * replace the editor). This points them at the repository the design belongs to.
 */

const ATTR = /\b(src|href|srcset)\s*=\s*(["'])(.*?)\2/gi;

/** True for URLs that already say where they go: a scheme (https:, data:, mailto:) or protocol-relative. */
function isAbsolute(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}

/** `./docs/../img/a.png` → `img/a.png`; `..` above the root is dropped (the README sits at the root). */
function normalizePath(path: string): string {
  const out: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}

/** Resolve one URL found in the README against `owner/name`. */
export function repoUrl(url: string, repo: string, kind: "image" | "link"): string {
  const u = url.trim();
  if (!u || isAbsolute(u)) return url;
  // README anchors: GitHub's rendered README, at that heading
  if (u.startsWith("#")) return `https://github.com/${repo}${u}`;
  const cut = u.search(/[?#]/);
  const path = normalizePath(cut < 0 ? u : u.slice(0, cut));
  const rest = cut < 0 ? "" : u.slice(cut);
  return kind === "image" ? `https://raw.githubusercontent.com/${repo}/HEAD/${path}${rest}` : `https://github.com/${repo}/blob/HEAD/${path}${rest}`;
}

/**
 * Rewrite every src/srcset/href in rendered README HTML to point into `repo`, and open
 * links in a new tab so the studio stays open.
 */
export function resolveRepoLinks(html: string, repo: string): string {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return html;
  const resolved = html.replace(ATTR, (_m, attr: string, q: string, value: string) => {
    const name = attr.toLowerCase();
    if (name === "srcset") {
      const list = value
        .split(",")
        .map((entry) => {
          const [src, ...desc] = entry.trim().split(/\s+/);
          return [repoUrl(src, repo, "image"), ...desc].join(" ");
        })
        .join(", ");
      return `${attr}=${q}${list}${q}`;
    }
    return `${attr}=${q}${repoUrl(value, repo, name === "src" ? "image" : "link")}${q}`;
  });
  return resolved.replace(/<a\b(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noopener noreferrer"');
}
