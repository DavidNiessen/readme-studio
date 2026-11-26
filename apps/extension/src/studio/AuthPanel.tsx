import { Button, CopyButton, Field, TextInput, useToast } from "@readme-studio/web/ui";
import { ExternalLink, KeyRound, LogIn, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GitHub } from "../github/api";
import { requestDeviceCode, waitForToken, type DeviceCode } from "../github/auth";
import { clientIdOf, loadSettings, saveAuth, type Auth } from "../settings";

/**
 * Signing in to GitHub, shared by the save dialog and the options page: "Sign in with GitHub"
 * (device flow, when a client ID is configured) or a personal access token.
 */
export function AuthPanel({ auth, onChange }: { auth: Auth | null; onChange: (a: Auth | null) => void }) {
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    loadSettings().then((s) => setClientId(clientIdOf(s)));
    return () => abort.current?.abort();
  }, []);

  const finish = async (value: string, via: Auth["via"]) => {
    const who = await new GitHub(value).user();
    const next: Auth = { token: value, via, login: who.login, scopes: who.scopes };
    await saveAuth(next);
    onChange(next);
    toast(`Signed in as ${who.login}`);
  };

  const signIn = async () => {
    setBusy(true);
    abort.current = new AbortController();
    try {
      const c = await requestDeviceCode(clientId);
      setCode(c);
      window.open(c.verificationUri, "_blank", "noopener");
      const value = await waitForToken(clientId, c, { signal: abort.current.signal });
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
      <div className="ext-auth ext-auth--in">
        <span>
          Signed in as <b>{auth.login}</b> {auth.via === "token" ? "with a token" : "through GitHub"}
        </span>
        <Button
          size="sm"
          onClick={async () => {
            await saveAuth(null);
            onChange(null);
          }}
        >
          <LogOut /> Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="ext-auth">
      {code ? (
        <div className="ext-device">
          <p>
            Enter this code on <a href={code.verificationUri} target="_blank" rel="noopener">github.com/login/device <ExternalLink size={12} /></a>, then come back:
          </p>
          <div className="ext-device__code">
            <code>{code.userCode}</code>
            <CopyButton text={code.userCode} small />
          </div>
          <Button size="sm" onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="primary" disabled={!clientId || busy} onClick={signIn} title={clientId ? undefined : "Add an OAuth App client ID in the extension options"}>
          <LogIn /> Sign in with GitHub
        </Button>
      )}
      {!clientId && <p className="muted ext-note">Sign-in with GitHub needs an OAuth App client ID in the options. A token works right away.</p>}
      <Field label="Or use a personal access token" help="Fine-grained: Contents and Workflows read & write on the repository. Classic: public_repo and workflow.">
        <div className="ext-row">
          <TextInput mono type="password" aria-label="Personal access token" placeholder="github_pat_…" value={token} onChange={setToken} autoComplete="off" />
          <Button disabled={!token.trim() || busy} onClick={useToken}>
            <KeyRound /> Use token
          </Button>
        </div>
      </Field>
    </div>
  );
}
