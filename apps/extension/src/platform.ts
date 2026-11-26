/**
 * The slice of the WebExtension API the extension uses, typed once. Firefox exposes it as
 * `browser`, Chromium as `chrome`; both return promises in Manifest V3.
 */
interface Event<A extends unknown[]> {
  addListener(cb: (...args: A) => unknown): void;
  removeListener(cb: (...args: A) => unknown): void;
}

export interface Tab {
  id?: number;
  url?: string;
}

export interface ExtensionApi {
  runtime: {
    id: string;
    getURL(path: string): string;
    sendMessage(message: unknown): Promise<unknown>;
    openOptionsPage(): Promise<void>;
    onMessage: Event<[unknown, { tab?: Tab; url?: string }, (response?: unknown) => void]>;
  };
  storage: {
    local: {
      get(keys: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    onChanged: Event<[Record<string, { newValue?: unknown; oldValue?: unknown }>, string]>;
  };
  tabs: {
    create(props: { url: string }): Promise<Tab>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
  action: { onClicked: Event<[Tab]> };
  permissions?: {
    contains(p: { origins: string[] }): Promise<boolean>;
    request(p: { origins: string[] }): Promise<boolean>;
  };
}

/** The browser's extension API, or null outside an extension (tests, the website). */
export function ext(): ExtensionApi | null {
  const g = globalThis as { browser?: ExtensionApi; chrome?: ExtensionApi };
  const api = g.browser ?? g.chrome;
  return api?.runtime?.id ? api : null;
}

export function requireExt(): ExtensionApi {
  const api = ext();
  if (!api) throw new Error("Not running inside the Readme Studio extension");
  return api;
}

/** Hosts the extension talks to; Firefox asks the user to grant them. */
export const HOSTS = ["https://github.com/*", "https://api.github.com/*", "https://raw.githubusercontent.com/*"];
