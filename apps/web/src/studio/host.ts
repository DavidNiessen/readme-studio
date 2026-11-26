import { createContext, useContext, type ReactNode } from "react";
import type { StudioConfig } from "@readme-studio/core";
import type { GitHubPlatform } from "../github/platform";

/**
 * Lets another surface embed the studio unchanged: the browser extension opens a repository's
 * design inside GitHub and saves it back there. The website passes no host and keeps its own
 * URL-driven loading, export and navigation.
 */
export interface StudioHost {
  /** Short name of where the studio runs, shown in the top bar (e.g. "DavidNiessen/soundwave"). */
  context?: string;
  /**
   * Loads the design to edit when the studio opens. Replaces the website's `#/studio?…` loading.
   * With a `source` (e.g. "github:owner/repo") the studio keeps one draft per source: reopening
   * brings back unsaved changes instead of the committed design.
   */
  open?: () => Promise<{ config: StudioConfig; name: string; warnings?: string[]; source?: string; message?: string } | null>;
  /**
   * Shown instead of the editor when `open` fails (a private repository, a 404), so the studio
   * never shows an unrelated design in its place. `retry` runs `open` again, e.g. after signing in.
   * Without it the studio explains GitHub errors itself (sign in for a private repository, 404).
   */
  failed?: (error: unknown, retry: () => void) => ReactNode;
  /** Extra actions for the top bar, placed before Save to GitHub. */
  actions?: ReactNode;
  /**
   * How Save to GitHub signs in, stores the sign-in and reaches GitHub's editor on this surface.
   * The website's (token only, clipboard for the editor) when left out.
   */
  github?: GitHubPlatform;
  /** Dialogs or panels the host renders next to the studio's own. */
  overlays?: ReactNode;
  /** Shown as a close button: hands control back to the host (e.g. returns to the GitHub page). */
  onClose?: () => void;
  /** Absolute URL of the website, for links that would otherwise route inside the app. */
  siteUrl?: string;
}

export const StudioHostContext = createContext<StudioHost | null>(null);

export function useStudioHost(): StudioHost | null {
  return useContext(StudioHostContext);
}
