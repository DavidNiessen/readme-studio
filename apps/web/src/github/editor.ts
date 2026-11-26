/** Links into GitHub's own web editor, for saving without signing in. */

const encPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** GitHub stops accepting a new-file link with its text in `value` somewhere past this length. */
export const MAX_EDITOR_URL = 7000;

/**
 * The editor URL for a file. A new file carries its text in `value` while the link stays short
 * enough; an existing file (or a long new one) opens empty or as committed, and the text is
 * filled in another way (the extension's content script, or the clipboard).
 */
export function editorUrl(e: { repo: string; branch: string; path: string; text: string }, exists: boolean): { url: string; prefilled: boolean } {
  const branch = encodeURIComponent(e.branch);
  if (exists) return { url: `https://github.com/${e.repo}/edit/${branch}/${encPath(e.path)}`, prefilled: false };
  const slash = e.path.lastIndexOf("/");
  const dir = slash >= 0 ? `/${encPath(e.path.slice(0, slash))}` : "";
  const base = `https://github.com/${e.repo}/new/${branch}${dir}?`;
  const full = base + new URLSearchParams({ filename: e.path.slice(slash + 1), value: e.text }).toString();
  if (full.length <= MAX_EDITOR_URL) return { url: full, prefilled: true };
  return { url: base + new URLSearchParams({ filename: e.path.slice(slash + 1) }).toString(), prefilled: false };
}
