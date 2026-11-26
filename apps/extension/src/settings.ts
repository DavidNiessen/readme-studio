import type { Auth, SaveMode } from "@readme-studio/web/github";
import { ext } from "./platform";

export type { Auth, SaveMode };

export interface Settings {
  /** what the save dialog starts with */
  saveMode: SaveMode;
  /**
   * Client ID of a GitHub OAuth App with device flow enabled, for "Sign in with GitHub".
   * Builds can bake one in (VITE_GITHUB_CLIENT_ID); this overrides it.
   */
  clientId: string;
  /** Offer "Design README" on every repository, not only profile repositories and ones with a design. */
  everyRepo: boolean;
}

export const DEFAULT_SETTINGS: Settings = { saveMode: "commit", clientId: "", everyRepo: true };

/** Raised when a default changes meaning; older stored values of those settings are dropped. */
const SETTINGS_VERSION = 2;

/** The client ID this build ships with, if any. */
export const BUILT_IN_CLIENT_ID: string = (import.meta.env?.VITE_GITHUB_CLIENT_ID as string | undefined) ?? "";

export function clientIdOf(s: Settings): string {
  return s.clientId.trim() || BUILT_IN_CLIENT_ID;
}

type Stored = Partial<Settings> & { v?: number };

/**
 * Stored settings, upgraded: before version 2 every setting was written whenever any changed,
 * so a stored `everyRepo: false` was usually the old default rather than a choice.
 */
export function upgradeSettings(stored: Stored | undefined): Partial<Settings> {
  if (!stored) return {};
  const { v, ...rest } = stored;
  if ((v ?? 1) < 2) delete rest.everyRepo;
  return rest;
}

export async function loadSettings(): Promise<Settings> {
  const got = (await ext()?.storage.local.get("settings"))?.settings as Stored | undefined;
  return { ...DEFAULT_SETTINGS, ...upgradeSettings(got) };
}

/** Stores only what the user changed, so later defaults still reach them. */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const api = ext();
  const stored = upgradeSettings((await api?.storage.local.get("settings"))?.settings as Stored | undefined);
  const next = { ...stored, ...patch };
  await api?.storage.local.set({ settings: { ...next, v: SETTINGS_VERSION } });
  return { ...DEFAULT_SETTINGS, ...next };
}

export async function loadAuth(): Promise<Auth | null> {
  return ((await ext()?.storage.local.get("auth"))?.auth as Auth | undefined) ?? null;
}

export async function saveAuth(auth: Auth | null): Promise<void> {
  const api = ext();
  if (!api) return;
  if (auth) await api.storage.local.set({ auth });
  else await api.storage.local.remove("auth");
}
