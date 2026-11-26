import { copyText } from "../../components/ui";
import { editorUrl } from "../../github/editor";
import type { Auth, GitHubPlatform, SaveMode } from "../../github/platform";
import { getPref, setPref } from "../../lib/storage";

/**
 * Saving from the website. A personal access token is the only sign-in: GitHub's device flow
 * endpoints do not answer web pages, and the web OAuth flow needs a server for its secret.
 * GitHub's editor gets a new file's text through its link, and an existing file's through the
 * clipboard, since a web page cannot type into github.com.
 */
export const webPlatform: GitHubPlatform = {
  async loadAuth() {
    return getPref<Auth | null>("github-auth", null);
  },
  async saveAuth(auth) {
    setPref("github-auth", auth);
  },
  tokenNote: "The token stays in this browser only and is sent to nothing but api.github.com.",
  async loadSaveMode() {
    return getPref<SaveMode>("save-mode", "commit");
  },
  async saveSaveMode(mode) {
    setPref("save-mode", mode);
  },
  editorNote: "No sign-in: GitHub's editor opens in a new tab. A new file arrives filled in; for a file that exists, the design is copied and you paste it over the old text. You review the change and commit on GitHub.",
  async openEditor(repo, branch, files) {
    let copied: string | null = null;
    for (const f of files) {
      const { url, prefilled } = editorUrl({ repo: repo.full, branch, path: f.path, text: f.text }, f.exists);
      // the clipboard holds one text: the design, which matters more than the workflow
      if (!prefilled && copied === null && (await copyText(f.text))) copied = f.path;
      window.open(url, "_blank", "noopener");
    }
    return copied ? `Copied ${copied}. In GitHub's editor, select all, paste, then commit.` : "Opened GitHub's editor: review the change and commit there.";
  },
};
