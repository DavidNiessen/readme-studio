import { Button } from "@readme-studio/web/ui";
import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { RepoUnavailable, TokenRejected } from "../github/design";
import { loadAuth, type Auth } from "../settings";
import { AuthPanel } from "./AuthPanel";

/**
 * What the studio shows when a repository could not be opened. A 404 without a token is most
 * likely a private repository, which signing in can open; with a token it is a plain 404.
 */
export function OpenFailed({ error, retry }: { error: unknown; retry: () => void }) {
  const [auth, setAuth] = useState<Auth | null>(null);
  useEffect(() => {
    loadAuth().then(setAuth);
  }, []);

  if (error instanceof RepoUnavailable && !error.signedIn) {
    return (
      <>
        <h2>Sign in to open {error.repo.full}</h2>
        <p className="muted">
          {error.rateLimited
            ? "GitHub limits requests made without signing in, and that limit is used up for now, so it cannot tell whether this repository is private. Sign in to open it."
            : "GitHub does not show this repository without signing in. It is probably private. Sign in with an account that can see it, or use a token that includes it."}
        </p>
        <AuthPanel
          auth={auth}
          onChange={(next) => {
            setAuth(next);
            if (next) retry();
          }}
        />
      </>
    );
  }

  if (error instanceof TokenRejected) {
    return (
      <>
        <h2>Sign in again</h2>
        <p className="muted">GitHub no longer accepts the saved sign-in: the token expired or was revoked. Sign out, then sign in again or use a new token.</p>
        <AuthPanel
          auth={auth}
          onChange={(next) => {
            setAuth(next);
            retry();
          }}
        />
      </>
    );
  }

  if (error instanceof RepoUnavailable && error.rateLimited) {
    return (
      <>
        <h2>GitHub is limiting requests</h2>
        <p className="muted">GitHub's request limit for this account is used up for now. Try again in a few minutes.</p>
        <Button onClick={retry}>
          <RotateCw /> Try again
        </Button>
      </>
    );
  }

  if (error instanceof RepoUnavailable) {
    return (
      <>
        <span className="studio-gate__code">404</span>
        <h2>{error.repo.full} was not found</h2>
        <p className="muted">
          It does not exist, or {auth ? <b>{auth.login}</b> : "the account you signed in with"} cannot see it. For a private repository, sign in with an account that has access, or use a token that includes it.
        </p>
        <AuthPanel
          auth={auth}
          onChange={(next) => {
            // signing out goes back to the sign-in screen, signing in as someone else tries again
            setAuth(next);
            retry();
          }}
        />
      </>
    );
  }

  return (
    <>
      <h2>Could not open this repository</h2>
      <p className="muted">{error instanceof Error ? error.message : String(error)}</p>
      <Button onClick={retry}>
        <RotateCw /> Try again
      </Button>
    </>
  );
}
