import { createContext, useContext, type ReactNode } from "react";
import type { StudioConfig } from "@readme-studio/core";

/**
 * Lets another surface embed the studio unchanged: the browser extension opens a repository's
 * design inside GitHub and saves it back there. The website passes no host and keeps its own
 * URL-driven loading, export and navigation.
 */
export interface StudioHost {
  /** Short name of where the studio runs, shown in the top bar (e.g. "DavidNiessen/soundwave"). */
  context?: string;
  /** Loads the design to edit when the studio opens. Replaces the website's `#/studio?…` loading. */
  open?: () => Promise<{ config: StudioConfig; name: string; warnings?: string[] } | null>;
  /** Primary actions for the top bar, placed before Export (e.g. "Save to GitHub"). */
  actions?: ReactNode;
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
