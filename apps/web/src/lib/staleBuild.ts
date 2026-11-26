/**
 * A page opened before a deploy still names the old build's files; once the deploy replaces
 * them, opening a part of the app that loads on demand (the docs, the presets) fails with a 404.
 * Reloading picks up the new build. The guard keeps a build that is really broken from
 * reloading in a loop: one reload per minute at most.
 */
const KEY = "rs:stale-reload";

export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/** `import()` that reloads onto the new build when the old file is gone. */
export function loadPage<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((e: unknown) => {
      // never resolves while the page reloads, so nothing flashes an error first
      if (reloadForNewBuild()) return new Promise<T>(() => {});
      throw e;
    });
}

/** Vite reports a failed preload (a chunk or its stylesheet) with this event. */
export function watchStaleBuild(): void {
  window.addEventListener("vite:preloadError", (e) => {
    if (reloadForNewBuild()) e.preventDefault();
  });
}
