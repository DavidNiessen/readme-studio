import { ext } from "./platform";

/** How a design gets back into the repository. */
export type SaveMode = "commit" | "pull-request" | "editor";

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

export interface Auth {
  token: string;
  /** how the token was obtained */
  via: "oauth" | "token";
  login: string;
  /** scopes GitHub reported for the token (classic tokens and OAuth only) */
  scopes: string[];
}

export const DEFAULT_SETTINGS: Settings = { saveMode: "commit", clientId: "", everyRepo: false };

/** The client ID this build ships with, if any. */
export const BUILT_IN_CLIENT_ID: string = (import.meta.env?.VITE_GITHUB_CLIENT_ID as string | undefined) ?? "";

export function clientIdOf(s: Settings): string {
  return s.clientId.trim() || BUILT_IN_CLIENT_ID;
}

export async function loadSettings(): Promise<Settings> {
  const got = (await ext()?.storage.local.get("settings"))?.settings as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(got ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await ext()?.storage.local.set({ settings: next });
  return next;
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
