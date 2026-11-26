import type { GitHubPlatform } from "@readme-studio/web/github";
import { editorUrl } from "@readme-studio/web/github/editor";
import { requestDeviceCode, waitForToken } from "../github/auth";
import { pendingKey, type PendingEdit } from "../github/editor";
import { ext } from "../platform";
import { clientIdOf, loadAuth, loadSettings, saveAuth, saveSettings } from "../settings";
import { tellPage } from "./page";

/**
 * Saving from the extension: all three ways. The device flow works here because the extension
 * may call github.com directly; GitHub's editor is filled in by the content script.
 */
export const extensionPlatform: GitHubPlatform = {
  loadAuth,
  saveAuth,
  deviceFlow: {
    clientId: async () => clientIdOf(await loadSettings()),
    missingClientId: "Sign-in with GitHub needs an OAuth App client ID in the extension options.",
    request: (clientId) => requestDeviceCode(clientId),
    wait: (clientId, code, o) => waitForToken(clientId, code, o),
  },
  tokenNote: "The token stays in this browser's extension storage.",
  loadSaveMode: async () => (await loadSettings()).saveMode,
  saveSaveMode: async (saveMode) => {
    await saveSettings({ saveMode });
  },
  fillsEditor: true,
  editorNote: "No sign-in: GitHub's editor opens with the new file filled in, and you review the diff and commit there.",
  async openEditor(repo, branch, files) {
    // the content script on the editor page fills in the pending text; one tab per file
    for (const f of files) {
      const pending: PendingEdit = { repo: repo.full, branch, path: f.path, text: f.text, at: Date.now() };
      await ext()?.storage.local.set({ [pendingKey(pending.repo, pending.path)]: pending });
      window.open(editorUrl(pending, f.exists).url, "_blank", "noopener");
    }
    return files.length > 1 ? "Opened GitHub's editor for the design and the workflow" : "Opened GitHub's editor: review the change and commit there";
  },
  onSaved: (result) => tellPage({ type: "saved", url: result.url, kind: result.kind }),
};
