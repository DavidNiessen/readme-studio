/**
 * Saving through GitHub's own web editor: no sign-in in the extension. The studio stores the
 * new file as a "pending edit" and opens the editor page; the content script on that page puts
 * the text into the editor, and the user reviews the diff and commits on GitHub.
 */

export { editorUrl } from "@readme-studio/web/github/editor";

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
