/**
 * The toolbar button: on a GitHub repository it opens the studio over the page, anywhere else
 * the studio opens in a tab.
 */
import { requireExt } from "./platform";
import { repoFromUrl } from "./repo";

const api = requireExt();

api.action.onClicked.addListener(async (tab) => {
  const repo = tab.url ? repoFromUrl(tab.url) : null;
  if (repo && tab.id !== undefined) {
    try {
      await api.tabs.sendMessage(tab.id, { type: "open-studio" });
      return;
    } catch {
      // the page was open before the extension was installed: no content script yet
    }
  }
  await api.tabs.create({ url: api.runtime.getURL(repo ? `studio.html#repo=${encodeURIComponent(repo.full)}` : "studio.html") });
});
