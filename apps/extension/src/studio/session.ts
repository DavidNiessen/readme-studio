import { useSyncExternalStore } from "react";
import type { Opened } from "../github/design";
import type { Auth } from "../settings";

/** State of the extension's studio page: which repository is open and who is signed in. */
interface Session {
  opened: Opened | null;
  auth: Auth | null;
}

let state: Session = { opened: null, auth: null };
const listeners = new Set<() => void>();

export function setSession(patch: Partial<Session>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function getSession(): Session {
  return state;
}

export function useSession(): Session {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Messages to the GitHub page when the studio is shown over it. */
export function tellPage(message: { type: "close" } | { type: "saved"; url: string }): void {
  if (window.parent === window) return;
  window.parent.postMessage({ source: "readme-studio", ...message }, "https://github.com");
}
