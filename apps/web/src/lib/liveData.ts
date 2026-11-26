import type { ProfileData, StudioConfig } from "@readme-studio/core";
import { useEffect } from "react";
import type { GitHubPlatform } from "../github/platform";
import { useStudio } from "../state/store";
import { getSession, setSession, useSession } from "../studio/github/session";
import { fetchLive } from "./live";

/**
 * The preview always shows real GitHub data for the design's account or repository. What was
 * fetched is cached per account or repository (IndexedDB), so a design opens with its data at
 * once and refreshes in the background. Signed in, GitHub allows 5,000 requests an hour and the
 * data refreshes every 5 minutes; without a token it is 60 an hour, so every 30. Until anything is
 * fetched, or when GitHub cannot be reached, the sample data stands in, and the studio says so.
 */

export const REFRESH_SIGNED_IN = 5 * 60_000;
export const REFRESH_ANONYMOUS = 30 * 60_000;
const DEBOUNCE = 700;
const KEEP = 40;

const LOGIN = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;

/** The account or repository whose data a design shows, or null when it names none. */
export function dataKey(c: StudioConfig): string | null {
  if (c.kind === "project") return REPO.test(c.project.repo) ? `project:${c.project.repo.toLowerCase()}` : null;
  return LOGIN.test(c.profile.login) ? `profile:${c.profile.login.toLowerCase()}` : null;
}

/** Everything a fetch depends on: data fetched for other settings is out of date. */
function fetchSig(c: StudioConfig, signedIn: boolean): string {
  const feeds = c.layout.flatMap((r) => r.blocks).flatMap((b) => [b.options.feed, b.options.feedUrl].filter((v) => typeof v === "string" && v));
  const l = c.profile.location;
  return JSON.stringify([dataKey(c), l.timezone, l.latitude, l.longitude, feeds, c.kind === "project" ? c.project.packages : null, signedIn]);
}

export const refreshInterval = (signedIn: boolean) => (signedIn ? REFRESH_SIGNED_IN : REFRESH_ANONYMOUS);

// ---------------------------------------------------------------- cache

interface Entry {
  key: string;
  sig: string;
  at: number;
  data: ProfileData;
}

const memory = new Map<string, Entry>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open("readme-studio", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("live", { keyPath: "key" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      // private windows may have no IndexedDB: the cache then lasts as long as the tab
      resolve(null);
    }
  });
  return dbPromise;
}

async function readCache(key: string): Promise<Entry | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const req = d.transaction("live").objectStore("live").get(key);
      req.onsuccess = () => {
        const e = (req.result as Entry | undefined) ?? null;
        if (e) memory.set(key, e);
        resolve(e);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeCache(e: Entry): Promise<void> {
  memory.set(e.key, e);
  const d = await db();
  if (!d) return;
  try {
    const store = d.transaction("live", "readwrite").objectStore("live");
    store.put(e);
    // keep the most recent few: project data carries contributor avatars
    const all = store.getAll();
    all.onsuccess = () => {
      const old = (all.result as Entry[]).sort((a, b) => b.at - a.at).slice(KEEP);
      for (const o of old) store.delete(o.key);
    };
  } catch {
    /* a full or unavailable store only costs a refetch */
  }
}

// ---------------------------------------------------------------- loading

const inflight = new Map<string, Promise<void>>();
let timer = 0;

function explain(e: unknown, c: StudioConfig): string {
  const m = e instanceof Error ? e.message : String(e);
  const what = c.kind === "project" ? c.project.repo : `@${c.profile.login}`;
  if (/→ 404|not found/i.test(m)) return `GitHub has no ${c.kind === "project" ? "public repository" : "account"} ${what}`;
  if (/→ (403|429)|rate limit/i.test(m)) return getSession().auth ? "GitHub's rate limit is reached; it resets within the hour" : "GitHub's rate limit is reached. Sign in to GitHub to raise it";
  if (/private/i.test(m)) return m;
  if (e instanceof TypeError) return "GitHub could not be reached";
  return `Could not load ${what}: ${m}`;
}

/** Shows the cached data of the design's account or repository, or the sample until there is some. */
async function showCurrent(): Promise<void> {
  const c = useStudio.getState().config;
  const key = dataKey(c);
  if (!key) {
    if (useStudio.getState().dataKey !== null || useStudio.getState().dataMode !== "sample") useStudio.getState().showSample();
    return;
  }
  if (useStudio.getState().dataKey === key) return;
  const cached = await readCache(key);
  // the design may have moved on while the cache was read
  if (dataKey(useStudio.getState().config) !== key || useStudio.getState().dataKey === key) return;
  if (cached) useStudio.getState().setLive(cached.data, key, cached.at);
  else useStudio.getState().showSample();
}

/** Fetches when the shown data is missing, out of date or older than the refresh interval (or always, when forced). */
async function ensure(force: boolean): Promise<void> {
  const c = useStudio.getState().config;
  const key = dataKey(c);
  if (!key) return;
  const token = getSession().auth?.token ?? "";
  const sig = fetchSig(c, !!token);
  const cached = await readCache(key);
  if (!force && cached && cached.sig === sig && Date.now() - cached.at < refreshInterval(!!token)) return;
  const running = inflight.get(sig);
  if (running) return running;
  const st = useStudio.getState();
  st.setDataStatus({ ...st.dataStatus, state: "loading" });
  const run = fetchLive(c, token)
    .then(async (data) => {
      const at = Date.now();
      await writeCache({ key, sig, at, data });
      if (dataKey(useStudio.getState().config) === key) useStudio.getState().setLive(data, key, at);
    })
    .catch((e) => {
      const now = useStudio.getState();
      if (dataKey(now.config) === key) now.setDataStatus({ ...now.dataStatus, state: "error", message: explain(e, c) });
    })
    .finally(() => inflight.delete(sig));
  inflight.set(sig, run);
  return run;
}

/** Asks for fresh data: now when forced, else once typing has paused. */
export function scheduleLoad(force = false): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void ensure(force), force ? 0 : DEBOUNCE);
}

/**
 * Keeps the preview's data live: mounted once by the studio. Loads the GitHub sign-in so the
 * preview can use it, follows the design's account or repository, and refreshes on a timer while
 * the tab is visible.
 */
export function useLiveData(platform: GitHubPlatform): void {
  const { auth } = useSession();
  useEffect(() => {
    if (getSession().auth) return;
    platform.loadAuth().then((a) => a && !getSession().auth && setSession({ auth: a }));
  }, [platform]);
  const config = useStudio((s) => s.config);
  const shown = useStudio((s) => s.dataKey);
  const key = dataKey(config);
  const sig = fetchSig(config, !!auth);
  useEffect(() => {
    void showCurrent();
    scheduleLoad();
  }, [key, shown, sig]);
  const refresh = useStudio((s) => s.dataRefresh);
  useEffect(() => {
    if (refresh) scheduleLoad(true);
  }, [refresh]);
  useEffect(() => {
    // ensure() skips while the data is fresh, so checking often costs nothing
    const tick = () => document.visibilityState === "visible" && scheduleLoad();
    const t = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
}

/** "just now", "4 min ago", "2 h ago". */
export function ago(at: number, now = Date.now()): string {
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
