import { ExternalLink, KeyRound, LogIn, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, CopyButton, Field, TextInput, useToast } from "../../components/ui";
import { GitHub } from "../../github/api";
import type { Auth, DeviceCode, GitHubPlatform } from "../../github/platform";

/**
 * Signing in to GitHub: "Sign in with GitHub" (device flow) where the platform offers it, and a
 * personal access token everywhere.
 */
export function AuthPanel({ platform, auth, onChange }: { platform: GitHubPlatform; auth: Auth | null; onChange: (a: Auth | null) => void }) {
  const toast = useToast();
  const flow = platform.deviceFlow;
  const [clientId, setClientId] = useState("");
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    flow?.clientId().then(setClientId);
    return () => abort.current?.abort();
  }, [flow]);

  const finish = async (value: string, via: Auth["via"]) => {
    const who = await new GitHub(value).user();
    const next: Auth = { token: value, via, login: who.login, scopes: who.scopes };
    await platform.saveAuth(next);
    onChange(next);
    toast(`Signed in as ${who.login}`);
  };

  const signIn = async () => {
    if (!flow) return;
    setBusy(true);
    abort.current = new AbortController();
    try {
      const c = await flow.request(clientId);
      setCode(c);
      window.open(c.verificationUri, "_blank", "noopener");
      const value = await flow.wait(clientId, c, { signal: abort.current.signal });
      await finish(value, "oauth");
    } catch (e) {
      if (!abort.current?.signal.aborted) toast((e as Error).message);
    } finally {
      setCode(null);
      setBusy(false);
    }
  };

  const useToken = async () => {
    setBusy(true);
    try {
      await finish(token.trim(), "token");
      setToken("");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (auth) {
    return (
      <div className="gh-auth gh-auth--in">
        <span>
          Signed in as <b>{auth.login}</b> {auth.via === "token" ? "with a token" : "through GitHub"}
        </span>
        <Button
          size="sm"
          onClick={async () => {
            await platform.saveAuth(null);
            onChange(null);
          }}
        >
          <LogOut /> Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="gh-auth">
      {flow &&
        (code ? (
          <div className="gh-device">
            <p>
              Open{" "}
              <a className="gh-device__link" href={code.verificationUri} target="_blank" rel="noopener">
                github.com/login/device
                <ExternalLink size={12} aria-hidden />
              </a>{" "}
              and enter this code. This window signs in once you have.
            </p>
            <div className="gh-device__code">
              <code>{code.userCode}</code>
              <CopyButton text={code.userCode} small />
            </div>
            <Button size="sm" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <Button variant="primary" disabled={!clientId || busy} onClick={signIn} title={clientId ? undefined : flow.missingClientId}>
              <LogIn /> Sign in with GitHub
            </Button>
            {!clientId && <p className="muted gh-note">{flow.missingClientId} A token works right away.</p>}
          </>
        ))}
      <Field
        label={flow ? "Or use a personal access token" : "Personal access token"}
        help={
          <>
            Fine-grained: Contents and Workflows read & write on the repository. Classic: <code>public_repo</code> (or <code>repo</code> for private repositories) and <code>workflow</code>.{" "}
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">
              Create one
            </a>
            . {platform.tokenNote}
          </>
        }
      >
        <div className="gh-row">
          <TextInput mono type="password" aria-label="Personal access token" placeholder="github_pat_…" value={token} onChange={setToken} autoComplete="off" />
          <Button disabled={!token.trim() || busy} onClick={useToken}>
            <KeyRound /> Use token
          </Button>
        </div>
      </Field>
    </div>
  );
}
