import { GitHub } from "../../github/api";
import { openDesign, RepoUnavailable, TokenRejected, type Opened } from "../../github/design";
import type { GitHubPlatform } from "../../github/platform";
import type { RepoRef } from "../../github/repo";
import { useStudio } from "../../state/store";
import { setSession } from "./session";

/** Each repository keeps one draft, on the website as in the extension. */
export const sourceFor = (repo: RepoRef) => `github:${repo.full.toLowerCase()}`;

/**
 * Opens a repository's design (or its README, or a starter) as that repository's draft: unsaved
 * changes from last time come back, and the studio offers to reset them. Save to GitHub then
 * writes back to it. Throws what `openDesign` throws (private, missing, rate-limited).
 */
export async function openRepository(repo: RepoRef, platform: GitHubPlatform): Promise<{ opened: Opened; restored: boolean }> {
  const auth = await platform.loadAuth();
  setSession({ auth });
  const opened = await openDesign(new GitHub(auth?.token ?? null), repo);
  const { restored } = useStudio.getState().openSource(sourceFor(repo), opened.config, opened.name);
  setSession({ opened });
  return { opened, restored };
}

/** What to say after opening, unless the restored-draft banner says it already. */
export function openedMessage(o: Opened): string {
  if (o.configExists) return `Opened the design in ${o.repo.full}`;
  if (o.importedReadme) return `Started from ${o.repo.full}'s ${o.importedReadme}`;
  return `${o.repo.full} has no README yet: started from a preset`;
}

/** Why a repository could not be opened, in a sentence. */
export function openFailure(e: unknown, full: string): string {
  if (e instanceof TokenRejected) return "GitHub no longer accepts the saved token. Sign in again under Save to GitHub.";
  if (e instanceof RepoUnavailable && e.rateLimited) return "GitHub is limiting requests without signing in. Add a token under Save to GitHub, or try again later.";
  if (e instanceof RepoUnavailable) return e.signedIn ? `${full} was not found, or your token cannot see it.` : `${full} was not found. If it is private, add a token under Save to GitHub first.`;
  return (e as Error)?.message ?? String(e);
}
