import { layoutPresets, presetConfig } from "@readme-studio/core";
import { FolderGit2, LayoutTemplate, Upload, User } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, TextInput, useToast } from "../components/ui";
import { parseRepo } from "../github/repo";
import { useStudio } from "../state/store";
import { openedMessage, openFailure, openRepository } from "./github/openRepo";
import { webPlatform } from "./github/webPlatform";

const LOGIN = /^[a-z\d](?:[a-z\d-]{0,38})$/i;

/**
 * The first visit: nothing is saved in this browser yet, so ask what the README is for instead
 * of assuming a profile. Each choice can take the account or repository it is for; a
 * repository brings its current design or README along.
 */
export function Welcome() {
  const { firstRun, setFirstRun, replace, openDialog } = useStudio();
  const toast = useToast();
  const [login, setLogin] = useState("");
  const [repoText, setRepoText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!firstRun) return null;

  const startProfile = () => {
    const l = login.trim().replace(/^@/, "");
    if (l && !LOGIN.test(l)) return setError("That is not a GitHub username.");
    const config = presetConfig("command-center", l ? { login: l } : {});
    replace(config, l ? `${l} profile` : "My profile", true);
    toast(l ? `Started a profile README for ${l}` : "Started a profile README with sample data");
  };

  const startProject = async () => {
    const text = repoText.trim();
    const preset = layoutPresets.find((p) => p.kind === "project")?.id ?? "oss-library";
    if (!text) {
      replace(presetConfig(preset), "My project", true);
      toast("Started a project README with sample data");
      return;
    }
    const repo = parseRepo(text);
    if (!repo) return setError("Enter the repository as owner/name or a link to it.");
    setBusy(true);
    setError(null);
    try {
      // its own design when it has one, else its README, else a starter for it
      const { opened } = await openRepository(repo, webPlatform);
      toast(openedMessage(opened));
    } catch (e) {
      setError(openFailure(e, repo.full));
    } finally {
      setBusy(false);
    }
  };

  const other = (dialog: "import" | "presets") => {
    setFirstRun(false);
    openDialog(dialog);
  };

  return (
    <Dialog
      open
      onClose={() => setFirstRun(false)}
      width={640}
      title="What are you making?"
      subtitle="Pick one to start; you can make the other kind any time from the + next to the project name."
      footer={
        <>
          <Button variant="ghost" onClick={() => other("import")}>
            <Upload /> Import a README or config
          </Button>
          <Button variant="ghost" onClick={() => other("presets")}>
            <LayoutTemplate /> Browse presets
          </Button>
        </>
      }
    >
      <div className="welcome">
        <form
          className="welcome__choice"
          onSubmit={(e) => {
            e.preventDefault();
            startProfile();
          }}
        >
          <User />
          <h3>Profile README</h3>
          <p className="muted">The page on your GitHub profile, from the repository named after you.</p>
          <TextInput mono aria-label="GitHub username" placeholder="your-username (optional)" value={login} onChange={setLogin} />
          <Button type="submit" variant="accent">
            Start a profile README
          </Button>
        </form>
        <form
          className="welcome__choice"
          onSubmit={(e) => {
            e.preventDefault();
            startProject();
          }}
        >
          <FolderGit2 />
          <h3>Project README</h3>
          <p className="muted">The front page of a repository. Its current README is brought in.</p>
          <TextInput mono aria-label="Repository" placeholder="owner/name or link (optional)" value={repoText} onChange={setRepoText} />
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Opening…" : "Start a project README"}
          </Button>
        </form>
      </div>
      {error && <p className="gh-error welcome__error">{error}</p>}
    </Dialog>
  );
}
