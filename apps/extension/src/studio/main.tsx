import "@readme-studio/web/studio/styles";
import "../extension.css";
import { STUDIO_URL } from "@readme-studio/core";
import { GitHub, openDesign, setSession } from "@readme-studio/web/github";
import Studio from "@readme-studio/web/studio";
import type { StudioHost } from "@readme-studio/web/studio/host";
import { useStudio } from "@readme-studio/web/state";
import { ToastProvider } from "@readme-studio/web/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { repoRef } from "../repo";
import { loadAuth } from "../settings";
import { extensionPlatform } from "./githubPlatform";
import { tellPage } from "./page";

/**
 * The studio page of the extension. `studio.html#repo=owner/name&ref=branch` opens that
 * repository's design (shown over GitHub by the content script); without a repository it is
 * the same studio as the website, in a browser tab. Either way Save to GitHub signs in and
 * reaches GitHub's editor the extension's way.
 */
const params = new URLSearchParams(location.hash.replace(/^#/, ""));
const repo = repoRef(params.get("repo") ?? "");
const embedded = window.parent !== window;

// Esc closes the overlay when there is nothing else for it to do (no dialog, no selection).
// Registered for the capture phase so it sees the state before the studio clears a selection.
if (embedded) {
  window.addEventListener(
    "keydown",
    (e) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      const s = useStudio.getState();
      if (e.key === "Escape" && !typing && !s.dialog && !s.selected && !document.querySelector("[role=dialog]")) tellPage({ type: "close" });
    },
    true,
  );
}

const host: StudioHost = {
  siteUrl: STUDIO_URL,
  github: extensionPlatform,
  onClose: embedded ? () => tellPage({ type: "close" }) : undefined,
};
if (repo) {
  host.context = repo.full;
  host.open = async () => {
    const auth = await loadAuth();
    setSession({ auth, opened: null });
    const opened = await openDesign(new GitHub(auth?.token ?? null), repo, params.get("ref") ?? undefined);
    setSession({ opened });
    // one draft per repository: closing the studio keeps unsaved changes for next time
    return {
      config: opened.config,
      name: opened.name,
      warnings: opened.warnings,
      source: `github:${repo.full.toLowerCase()}`,
      message: opened.importedReadme ? `Started from your current ${opened.importedReadme}` : undefined,
    };
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
