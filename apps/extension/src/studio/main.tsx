import "@readme-studio/web/studio/styles";
import "../extension.css";
import { STUDIO_URL } from "@readme-studio/core";
import Studio from "@readme-studio/web/studio";
import type { StudioHost } from "@readme-studio/web/studio/host";
import { ToastProvider } from "@readme-studio/web/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GitHub } from "../github/api";
import { openDesign } from "../github/design";
import { repoRef } from "../repo";
import { loadAuth } from "../settings";
import { SaveButton, SaveDialog } from "./SaveToGitHub";
import { setSession, tellPage } from "./session";

/**
 * The studio page of the extension. `studio.html#repo=owner/name&ref=branch` opens that
 * repository's design (shown over GitHub by the content script); without a repository it is
 * the same studio as the website, in a browser tab.
 */
const params = new URLSearchParams(location.hash.replace(/^#/, ""));
const repo = repoRef(params.get("repo") ?? "");
const embedded = window.parent !== window;

const host: StudioHost = {
  siteUrl: STUDIO_URL,
  onClose: embedded ? () => tellPage({ type: "close" }) : undefined,
};
if (repo) {
  host.context = repo.full;
  host.actions = <SaveButton />;
  host.overlays = <SaveDialog />;
  host.open = async () => {
    const auth = await loadAuth();
    setSession({ auth });
    const opened = await openDesign(new GitHub(auth?.token ?? null), repo, params.get("ref") ?? undefined);
    setSession({ opened });
    return { config: opened.config, name: opened.name, warnings: opened.warnings };
  };
  document.title = `${repo.full} · Readme Studio`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <Studio host={host} />
    </ToastProvider>
  </StrictMode>,
);
