import { sameConfig, useStudio } from "@readme-studio/web/state";
import { Button, Dialog, Field, Segmented, TextInput, ToggleRow, useToast } from "@readme-studio/web/ui";
import { ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest, Pencil, RotateCcw, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GitHub } from "../github/api";
import { defaultPrBranch, filesFor, saveDesign, CONFIG_PATH, WORKFLOW_PATH, type SaveResult } from "../github/design";
import { editorUrl, pendingKey, type PendingEdit } from "../github/editor";
import { ext } from "../platform";
import { loadSettings, saveSettings, type SaveMode } from "../settings";
import { AuthPanel } from "./AuthPanel";
import { setSession, tellPage, useSession } from "./session";

let showSaveDialog: (open: boolean) => void = () => {};

/** Top-bar action: opens the save dialog. */
export function SaveButton() {
  const { opened } = useSession();
  return (
    <Button variant="accent" disabled={!opened} onClick={() => showSaveDialog(true)} aria-label="Save to GitHub">
      <UploadCloud /> <span className="hide-sm">Save to GitHub</span>
    </Button>
  );
}

/**
 * Shown while the design differs from what the repository has: the draft survives closing the
 * studio, and Discard goes back to the committed design.
 */
export function DraftNotice() {
  const { opened } = useSession();
  const config = useStudio((s) => s.config);
  const changed = useMemo(() => !!opened && !sameConfig(config, opened.config), [opened, config]);
  if (!opened || !changed) return null;
  return (
    <span className="ext-draft hide-sm" title={opened.configExists ? "Differs from the design in the repository" : "Not saved to the repository yet"}>
      <span className="ext-draft__dot" />
      {opened.configExists ? "Unsaved changes" : "Not saved yet"}
      {opened.configExists && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Discard your changes and load the design committed to ${opened.repo.full}?`)) useStudio.getState().replace(opened.config, opened.name);
          }}
        >
          <RotateCcw size={12} /> Discard
        </button>
      )}
    </span>
  );
}

const MODES: { value: SaveMode; label: string; icon: React.ReactNode; title: string }[] = [
  { value: "commit", label: "Commit", icon: <GitCommitHorizontal />, title: "Commit straight to the branch" },
  { value: "pull-request", label: "Pull request", icon: <GitPullRequest />, title: "Commit to a new branch and open a pull request" },
  { value: "editor", label: "GitHub editor", icon: <Pencil />, title: "Open GitHub's editor with the new file; you commit there" },
];

export function SaveDialog() {
  const toast = useToast();
  const config = useStudio((s) => s.config);
  const { opened, auth } = useSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SaveMode>("commit");
  const [message, setMessage] = useState("docs: update the README design with Readme Studio");
  const [prBranch, setPrBranch] = useState(defaultPrBranch());
  const [addWorkflow, setAddWorkflow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SaveResult | null>(null);
  showSaveDialog = setOpen;

  useEffect(() => {
    if (open) {
      loadSettings().then((s) => setMode(s.saveMode));
      setDone(null);
      setPrBranch(defaultPrBranch());
    }
  }, [open]);

  const needsWorkflow = !!opened && !opened.workflowExists;
  const files = useMemo(() => filesFor({ config, addWorkflow: needsWorkflow && addWorkflow }), [config, needsWorkflow, addWorkflow]);
  if (!opened) return null;
  const usesApi = mode !== "editor";

  // a design read while GitHub's API was rate-limited only knows HEAD; name the branch before writing
  const resolvedBranch = async (gh: GitHub) => {
    if (opened.branch !== "HEAD") return opened.branch;
    const branch = (await gh.repo(opened.repo.full)).defaultBranch;
    setSession({ opened: { ...opened, branch } });
    return branch;
  };

  const pickMode = (m: SaveMode) => {
    setMode(m);
    saveSettings({ saveMode: m });
  };

  const viaEditor = async () => {
    // GitHub's editor takes one file at a time; the workflow opens in a second tab if needed
    const api = ext();
    const [configFile, workflowFile] = files;
    const pending: PendingEdit = { repo: opened.repo.full, branch: await resolvedBranch(new GitHub(auth?.token ?? null)), path: configFile.path, text: configFile.text, at: Date.now() };
    await api?.storage.local.set({ [pendingKey(pending.repo, pending.path)]: pending });
    window.open(editorUrl(pending, opened.configExists), "_blank", "noopener");
    if (workflowFile) window.open(editorUrl({ ...pending, path: workflowFile.path, text: workflowFile.text }, false), "_blank", "noopener");
    toast(workflowFile ? "Opened GitHub's editor for the design and the workflow" : "Opened GitHub's editor: review the change and commit there");
    setOpen(false);
  };

  const viaApi = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const gh = new GitHub(auth.token);
      const result = await saveDesign(gh, {
        repo: opened.repo,
        branch: await resolvedBranch(gh),
        config,
        message: message.trim() || "docs: update the README design",
        addWorkflow: needsWorkflow && addWorkflow,
        target: mode === "pull-request" ? "pull-request" : "commit",
        prBranch,
      });
      setDone(result);
      // the committed design is now this one: the draft has nothing unsaved left
      if (result.kind === "commit") setSession({ opened: { ...opened, config, configExists: true, workflowExists: opened.workflowExists || (needsWorkflow && addWorkflow) } });
      tellPage({ type: "saved", url: result.url, kind: result.kind });
      toast(result.kind === "pull-request" ? "Pull request opened" : "Committed to GitHub");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const branch = opened.branch === "HEAD" ? "the default branch" : opened.branch;
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      width={620}
      icon={<UploadCloud />}
      title="Save to GitHub"
      subtitle={
        <>
          Writes <code>{CONFIG_PATH}</code> to <b>{opened.repo.full}</b>. The readme workflow then renders the images and updates the README.
        </>
      }
      footer={
        done ? (
          <>
            <a className="btn" href={done.url} target="_blank" rel="noopener">
              <ExternalLink /> {done.kind === "pull-request" ? "View pull request" : "View commit"}
            </a>
            <Button variant="accent" onClick={() => setOpen(false)}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            {mode === "editor" ? (
              <Button variant="accent" onClick={viaEditor}>
                <Pencil /> Open GitHub's editor
              </Button>
            ) : (
              <Button variant="accent" disabled={!auth || busy} onClick={viaApi}>
                {mode === "pull-request" ? <GitPullRequest /> : <GitCommitHorizontal />} {busy ? "Saving…" : mode === "pull-request" ? "Open pull request" : "Commit"}
              </Button>
            )}
          </>
        )
      }
    >
      {done ? (
        <p className="ext-done">
          {done.kind === "pull-request"
            ? "The pull request is open. Once it is merged, the readme workflow renders the new design."
            : "Saved. The readme workflow runs on this change; the README updates when it finishes."}
        </p>
      ) : (
        <div className="ext-save">
          <Segmented label="How to save" value={mode} onChange={pickMode} options={MODES} />
          <p className="muted ext-note">
            {mode === "commit" && <>Commits to {branch} with your GitHub account.</>}
            {mode === "pull-request" && <>Commits to a new branch and opens a pull request against {branch}.</>}
            {mode === "editor" && <>No sign-in: GitHub's editor opens with the new file filled in, and you review the diff and commit there.</>}
          </p>
          {usesApi && !auth && <AuthPanel auth={auth} onChange={(a) => setSession({ auth: a })} />}
          {usesApi && auth && (
            <>
              <AuthPanel auth={auth} onChange={(a) => setSession({ auth: a })} />
              <Field label="Commit message">
                <TextInput aria-label="Commit message" value={message} onChange={setMessage} />
              </Field>
              {mode === "pull-request" && (
                <Field label="New branch">
                  <TextInput mono aria-label="New branch" value={prBranch} onChange={(v) => setPrBranch(v.replace(/[^\w./-]/g, ""))} />
                </Field>
              )}
            </>
          )}
          {needsWorkflow && (
            <ToggleRow
              checked={addWorkflow}
              onChange={setAddWorkflow}
              label={`Add ${WORKFLOW_PATH}`}
              help="The repository has no readme workflow yet; without it nothing renders the README."
            />
          )}
          <p className="muted ext-note">
            <GitBranch size={12} /> {files.map((f) => f.path).join(" and ")}
          </p>
        </div>
      )}
    </Dialog>
  );
}
