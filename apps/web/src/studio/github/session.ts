import { useSyncExternalStore } from "react";
import type { Opened } from "../../github/design";
import type { Auth } from "../../github/platform";

/**
 * Saving to GitHub: who is signed in, and the repository the design was opened from (a host
 * such as the browser extension sets it; on the website the save dialog asks for one).
 */
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
