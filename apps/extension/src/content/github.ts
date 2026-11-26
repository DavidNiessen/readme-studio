/**
 * Runs on github.com. On a repository page it adds an "Edit README" button that opens the
 * studio over the page, and on GitHub's file editor it fills in a design saved with
 * "GitHub editor". Everything it adds lives in a shadow root, so GitHub's styles and ours
 * never meet.
 */
import { fillEditor, isFresh, pendingKey, type PendingEdit } from "../github/editor";
import { ext } from "../platform";
import { editorPage, isProfileRepo, repoFromDocument, type RepoRef } from "../repo";
import type { Settings } from "../settings";

const api = ext();
const HOST_ID = "readme-studio-extension";

const STYLE = `
:host { all: initial; }
.pill { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px 9px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); background: #1b1a17; color: #fbfaf7;
  font: 500 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,0,0,.28); transition: transform .15s ease, box-shadow .15s ease; }
.pill:hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(0,0,0,.34); }
.pill:focus-visible { outline: 2px solid #e5532d; outline-offset: 2px; }
.mark { width: 18px; height: 18px; flex: none; }
.overlay { position: fixed; inset: 0; z-index: 2147483001; background: rgba(10,10,10,.5); display: flex; }
.overlay iframe { flex: 1; border: 0; background: #faf9f6; }
.note { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); z-index: 2147483002; max-width: 560px; padding: 12px 16px;
  border-radius: 10px; background: #1b1a17; color: #fbfaf7; font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  box-shadow: 0 12px 32px rgba(0,0,0,.3); }
.note button { margin-left: 10px; background: none; border: 0; color: #f26a45; font: inherit; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .pill { transition: none; } }
`;

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#fbfaf7"/><rect x="7" y="8" width="18" height="3" rx="1.5" fill="#1b1a17"/><rect x="7" y="14.5" width="11" height="3" rx="1.5" fill="#1b1a17" opacity=".55"/><rect x="7" y="21" width="7" height="3" rx="1.5" fill="#e5532d"/></svg>`;

function shadow(): ShadowRoot {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);
  }
  return host.shadowRoot!;
}

// ------------------------------------------------------------- studio overlay

let overlay: HTMLElement | null = null;
let restoreOverflow = "";

function openStudio(repo: RepoRef): void {
  if (!api || overlay) return;
  const root = shadow();
  overlay = document.createElement("div");
  overlay.className = "overlay";
  const frame = document.createElement("iframe");
  frame.title = `Readme Studio: ${repo.full}`;
  frame.allow = "clipboard-write";
  frame.src = `${api.runtime.getURL("studio.html")}#repo=${encodeURIComponent(repo.full)}`;
  overlay.appendChild(frame);
  root.appendChild(overlay);
  restoreOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  frame.focus();
}

function closeStudio(): void {
  overlay?.remove();
  overlay = null;
  document.documentElement.style.overflow = restoreOverflow;
}

window.addEventListener("message", (e) => {
  if (!api || !overlay) return;
  // only the studio page of this extension may close the overlay
  if (e.origin !== new URL(api.runtime.getURL("")).origin) return;
  const msg = e.data as { source?: string; type?: string };
  if (msg?.source === "readme-studio" && msg.type === "close") closeStudio();
});

// --------------------------------------------------------------- the button

const designs = new Map<string, Promise<boolean>>();

/** Whether the repository has a committed design (cached per page load). */
function hasDesign(repo: RepoRef): Promise<boolean> {
  const key = repo.full.toLowerCase();
  if (!designs.has(key)) {
    designs.set(
      key,
      fetch(`https://raw.githubusercontent.com/${repo.full}/HEAD/readme.config.json`, { method: "GET", cache: "no-store" })
        .then((r) => r.ok)
        .catch(() => false),
    );
  }
  return designs.get(key)!;
}

async function settings(): Promise<Partial<Settings>> {
  return ((await api?.storage.local.get("settings"))?.settings as Partial<Settings>) ?? {};
}

let shownFor = "";

async function updateButton(): Promise<void> {
  const repo = repoFromDocument(document, location.href);
  const root = shadow();
  const key = repo ? `${repo.full}|${location.pathname}` : "";
  if (key === shownFor) return;
  shownFor = key;
  root.querySelector(".pill")?.remove();
  if (!repo || editorPage(location.href)) return;
  const [has, s] = await Promise.all([hasDesign(repo), settings()]);
  if (shownFor !== key) return;
  if (!has && !isProfileRepo(repo) && !s.everyRepo) return;
  const pill = document.createElement("button");
  pill.className = "pill";
  pill.type = "button";
  // parsed rather than assigned to innerHTML: nothing dynamic ever reaches markup
  pill.append(document.importNode(new DOMParser().parseFromString(MARK, "image/svg+xml").documentElement, true));
  const label = document.createElement("span");
  label.textContent = has ? "Edit README" : "Design README";
  pill.append(label);
  pill.title = has ? `Edit ${repo.full}'s README in Readme Studio` : `Design a README for ${repo.full} in Readme Studio`;
  pill.addEventListener("click", () => openStudio(repo));
  root.appendChild(pill);
}

// ------------------------------------------------- GitHub editor hand-over

function note(text: string, action?: { label: string; run: () => void }): void {
  const root = shadow();
  root.querySelector(".note")?.remove();
  const el = document.createElement("div");
  el.className = "note";
  el.setAttribute("role", "status");
  el.textContent = text;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.addEventListener("click", action.run);
    el.appendChild(b);
  }
  root.appendChild(el);
  setTimeout(() => el.remove(), 12000);
}

async function fillPendingEdit(): Promise<void> {
  const page = editorPage(location.href);
  if (!api || !page || page.mode !== "edit") return;
  const key = pendingKey(page.repo.full, page.path);
  const pending = (await api.storage.local.get(key))[key] as PendingEdit | undefined;
  if (!isFresh(pending)) return;
  // GitHub renders the editor after the page; wait for it for up to 15 seconds
  for (let i = 0; i < 60; i++) {
    if (fillEditor(document, pending.text)) {
      await api.storage.local.remove(key);
      note("Readme Studio filled in the new design. Review the change, then commit it.");
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  note("Readme Studio could not reach GitHub's editor.", {
    label: "Copy the design",
    run: () => navigator.clipboard.writeText(pending.text).then(() => note("Copied. Select all in the editor and paste.")),
  });
}

// ----------------------------------------------------------------- wiring

if (api) {
  api.runtime.onMessage.addListener((msg) => {
    if ((msg as { type?: string })?.type !== "open-studio") return;
    const repo = repoFromDocument(document, location.href);
    if (repo) openStudio(repo);
  });
  const refresh = () => {
    void updateButton();
    void fillPendingEdit();
  };
  refresh();
  // GitHub navigates without page loads (Turbo and React routes)
  document.addEventListener("turbo:load", refresh);
  window.addEventListener("popstate", refresh);
  let last = location.href;
  setInterval(() => {
    if (location.href !== last) {
      last = location.href;
      refresh();
    }
  }, 800);
}
