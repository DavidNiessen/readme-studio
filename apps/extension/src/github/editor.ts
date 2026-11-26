/**
 * Saving through GitHub's own web editor: no sign-in in the extension. The studio stores the
 * new file as a "pending edit" and opens the editor page; the content script on that page puts
 * the text into the editor, and the user reviews the diff and commits on GitHub.
 */

export interface PendingEdit {
  repo: string;
  branch: string;
  path: string;
  text: string;
  /** ms epoch; edits older than PENDING_TTL are ignored */
  at: number;
}

export const PENDING_TTL = 15 * 60 * 1000;

export const pendingKey = (repo: string, path: string) => `pending:${repo.toLowerCase()}:${path}`;

const encPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/**
 * The editor URL for a file. A new file can carry its whole text in `value`; an existing file
 * opens in the editor and is filled in by the content script.
 */
export function editorUrl(e: Pick<PendingEdit, "repo" | "branch" | "path" | "text">, exists: boolean): string {
  const branch = encodeURIComponent(e.branch);
  if (exists) return `https://github.com/${e.repo}/edit/${branch}/${encPath(e.path)}`;
  const slash = e.path.lastIndexOf("/");
  const dir = slash >= 0 ? `/${encPath(e.path.slice(0, slash))}` : "";
  const q = new URLSearchParams({ filename: e.path.slice(slash + 1), value: e.text });
  return `https://github.com/${e.repo}/new/${branch}${dir}?${q.toString()}`;
}

export function isFresh(e: PendingEdit | undefined, now = Date.now()): e is PendingEdit {
  return !!e && now - e.at < PENDING_TTL;
}

/**
 * Replaces the text of GitHub's code editor (CodeMirror) the way a user would: select all,
 * then insert. Returns false when no editor is found or the text did not take, so the caller
 * can fall back to the clipboard.
 */
export function fillEditor(doc: Document, text: string): boolean {
  const editor = doc.querySelector<HTMLElement>('.cm-content[contenteditable="true"]');
  if (!editor) {
    const area = doc.querySelector<HTMLTextAreaElement>("textarea#code-editor, textarea.file-editor-textarea, textarea[name='value']");
    if (!area) return false;
    area.focus();
    area.select();
    if (!doc.execCommand("insertText", false, text)) {
      area.value = text;
      area.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return area.value === text;
  }
  editor.focus();
  doc.execCommand("selectAll");
  doc.execCommand("insertText", false, text);
  const now = editor.innerText.replace(/ /g, " ").trim();
  return now.length > 0 && Math.abs(now.length - text.trim().length) <= Math.max(16, text.length * 0.02);
}
