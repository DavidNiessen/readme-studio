import "@readme-studio/web/studio/styles";
import "../extension.css";
import { LogoMark } from "@readme-studio/web/logo";
import { Button, Field, Segmented, TextInput, ToastProvider, ToggleRow, useToast } from "@readme-studio/web/ui";
import { ShieldCheck } from "lucide-react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ext, HOSTS } from "../platform";
import { BUILT_IN_CLIENT_ID, DEFAULT_SETTINGS, loadAuth, loadSettings, saveSettings, type Auth, type SaveMode, type Settings } from "../settings";
import { AuthPanel } from "@readme-studio/web/studio/github";
import { extensionPlatform } from "../studio/githubPlatform";

function Options() {
  const toast = useToast();
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    loadSettings().then(setS);
    loadAuth().then(setAuth);
    ext()
      ?.permissions?.contains({ origins: HOSTS })
      .then(setGranted)
      .catch(() => {});
  }, []);

  const set = (patch: Partial<Settings>) => {
    setS((cur) => ({ ...cur, ...patch }));
    saveSettings(patch);
  };

  return (
    <main className="ext-options">
      <header>
        <LogoMark size={28} />
        <h1>Readme Studio</h1>
      </header>
      <p className="muted">
        On a GitHub repository, the <b>Edit README</b> button opens the studio over the page. Save writes <code>readme.config.json</code> back, and the repository's readme workflow does the rest.
      </p>

      {!granted && (
        <section>
          <h2>Access to GitHub</h2>
          <p className="muted">Firefox asks before an extension may read github.com. Readme Studio only talks to GitHub.</p>
          <Button
            variant="accent"
            onClick={async () => {
              const ok = (await ext()?.permissions?.request({ origins: HOSTS })) ?? false;
              setGranted(ok);
              toast(ok ? "Access granted" : "Access was not granted");
            }}
          >
            <ShieldCheck /> Allow access to GitHub
          </Button>
        </section>
      )}

      <section>
        <h2>GitHub account</h2>
        <p className="muted">Needed to commit or open pull requests from the studio. Saving through GitHub's own editor works without it.</p>
        <AuthPanel platform={extensionPlatform} auth={auth} onChange={setAuth} />
      </section>

      <section>
        <h2>Saving</h2>
        <Field label="Save with">
          <Segmented<SaveMode>
            label="Default save mode"
            value={s.saveMode}
            onChange={(v) => set({ saveMode: v })}
            options={[
              { value: "commit", label: "Commit" },
              { value: "pull-request", label: "Pull request" },
              { value: "editor", label: "GitHub editor" },
            ]}
          />
        </Field>
        <Field
          label="OAuth App client ID"
          help={
            <>
              For “Sign in with GitHub”: create an OAuth App (Settings → Developer settings), tick <i>Enable Device Flow</i> and paste its client ID.{" "}
              {BUILT_IN_CLIENT_ID ? "Leave empty to use the one this build ships with." : "This build ships without one."}
            </>
          }
        >
          <TextInput mono aria-label="OAuth App client ID" placeholder={BUILT_IN_CLIENT_ID || "Iv1.…"} value={s.clientId} onChange={(v) => set({ clientId: v.trim() })} />
        </Field>
      </section>

      <section>
        <h2>On GitHub</h2>
        <ToggleRow
          checked={s.everyRepo}
          onChange={(v) => set({ everyRepo: v })}
          label="Offer “Design README” on every repository"
          help="On by default. Off: the button shows only on repositories that already have a design, and on your profile repository."
        />
      </section>

      <p className="muted">
        Settings and your GitHub sign-in stay in this browser and are sent only to GitHub.{" "}
        <a href="https://readme.niessen.dev/privacy.html" target="_blank" rel="noopener">
          Privacy policy
        </a>
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <Options />
    </ToastProvider>
  </StrictMode>,
);
