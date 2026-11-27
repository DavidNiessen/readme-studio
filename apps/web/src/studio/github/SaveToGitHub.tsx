import { Check, Copy, Download, ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest, Pencil, RotateCcw, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StudioConfig } from "@readme-studio/core";
import { Button, Dialog, Field, Segmented, TextInput, ToggleRow, copyText, useConfirm, useToast } from "../../components/ui";
import { GitHub } from "../../github/api";
import { CONFIG_PATH, defaultPrBranch, filesFor, inspectRepo, RepoUnavailable, saveDesign, TokenRejected, WORKFLOW_PATH, type SaveResult, type SaveTarget } from "../../github/design";
import type { GitHubPlatform, SaveMode } from "../../github/platform";
import { parseRepo } from "../../github/repo";
import { sameConfig, useStudio } from "../../state/store";
import { AuthPanel } from "./AuthPanel";
import { getSession, setSession, useSession } from "./session";
import { editorUrl } from "../../github/editor";

/** Top-bar action: opens the save dialog. */
export function SaveButton() {
  const openDialog = useStudio((s) => s.openDialog);
  return (
    <Button variant="accent" onClick={() => openDialog("save")} aria-label="Save to GitHub">
      <UploadCloud /> <span className="hide-sm">Save to GitHub</span>
    </Button>
  );
}

/**
 * Shown while a design opened from a repository differs from what the repository has: the draft
 * survives closing the studio, and Reset goes back to the repository's design (undoable).
 */
/**
 * Whether the design differs from what its repository holds. While this tab has the repository
 * open, that is the session's copy; after a reload, the saved draft's base (what it started from,
 * or last saved), so the notice survives reloading.
 */
export function useDraftChanges(): { repo: string; committed: StudioConfig; configExists: boolean } | null {
  const { opened } = useSession();
  const config = useStudio((s) => s.config);
  const source = useStudio((s) => s.source);
  const base = useStudio((s) => s.base);
  return useMemo(() => {
    const fromSource = source?.startsWith("github:") ? source.slice("github:".length) : null;
    const repo = opened?.repo.full ?? fromSource;
    const committed = opened?.config ?? (fromSource ? base : null);
    if (!repo || !committed || sameConfig(config, committed)) return null;
    return { repo, committed, configExists: opened ? opened.configExists : true };
  }, [opened, config, source, base]);
}

/** Asks, then puts the design back to what the repository holds (one undoable step). */
export function useResetDraft(): () => Promise<void> {
  const confirm = useConfirm();
  const draft = useDraftChanges();
  return async () => {
    if (!draft) return;
    const ok = await confirm({
      title: "Reset your changes?",
      body: <p>{draft.configExists ? `This goes back to the design committed to ${draft.repo}.` : `This starts again from what ${draft.repo} has.`} You can undo it with Ctrl/⌘ Z.</p>,
      confirmLabel: "Reset changes",
    });
    if (ok) useStudio.getState().resetToSource(draft.committed);
  };
}

export function DraftNotice() {
  const draft = useDraftChanges();
  const reset = useResetDraft();
  if (!draft) return null;
  return (
    <span className="draft-notice hide-sm" title={draft.configExists ? `Differs from the design in ${draft.repo}` : "Not saved to the repository yet"}>
      <span className="draft-notice__dot" />
      <span className="draft-notice__label">{draft.configExists ? "Unsaved changes" : "Not saved yet"}</span>
      <button type="button" title="Undo with Ctrl/⌘ Z" onClick={() => void reset()}>
        <RotateCcw size={12} /> Reset
      </button>
    </span>
  );
}

const MODES: { value: SaveMode; label: string; icon: React.ReactNode; title: string }[] = [
  { value: "commit", label: "Commit", icon: <GitCommitHorizontal />, title: "Commit straight to the branch" },
  { value: "pull-request", label: "Pull request", icon: <GitPullRequest />, title: "Commit to a new branch and open a pull request" },
  { value: "editor", label: "GitHub editor", icon: <Pencil />, title: "Open GitHub's editor with the new file; you commit there" },
];

/** The repository a design without one belongs in: the project's, or the owner's profile repository. */
export function suggestedRepo(c: StudioConfig): string {
  if (c.kind === "project" && c.project.repo) return c.project.repo;
  return c.profile.login ? `${c.profile.login}/${c.profile.login}` : "";
}

type Check = { state: "idle" } | { state: "checking" } | { state: "ok"; target: SaveTarget } | { state: "error"; error: unknown };

/** Mounted only while open: it reads the design, so it would re-render on every edit. */
export function SaveDialog({ platform }: { platform: GitHubPlatform }) {
  const open = useStudio((s) => s.dialog === "save");
  return open ? <SaveDialogBody platform={platform} /> : null;
}

function SaveDialogBody({ platform }: { platform: GitHubPlatform }) {
  const toast = useToast();
  const config = useStudio((s) => s.config);
  const open = useStudio((s) => s.dialog === "save");
  const openDialog = useStudio((s) => s.openDialog);
  const { opened, auth } = useSession();
  const [mode, setMode] = useState<SaveMode>("commit");
  const [repoText, setRepoText] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [message, setMessage] = useState("docs: update the README design with Readme Studio");
  const [prBranch, setPrBranch] = useState(defaultPrBranch());
  const [addWorkflow, setAddWorkflow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SaveResult | null>(null);
  const close = () => openDialog(null);

  // a fresh start each time the dialog opens; not when a save updates the session, or the
  // confirmation of that save would vanish the moment it appears
  useEffect(() => {
    if (!open) return;
    platform.loadSaveMode().then(setMode);
    platform.loadAuth().then((a) => setSession({ auth: a }));
    setDone(null);
    setPrBranch(defaultPrBranch());
  }, [open, platform]);
  const hasOpened = !!opened;
  useEffect(() => {
    if (open && !hasOpened) setRepoText(suggestedRepo(useStudio.getState().config));
  }, [open, hasOpened]);

  // a design opened from a repository saves back there; otherwise check the one typed in
  useEffect(() => {
    if (!open || opened) return;
    const repo = parseRepo(repoText);
    if (!repo) {
      setCheck({ state: "idle" });
      return;
    }
    setCheck({ state: "checking" });
    let cancelled = false;
    const t = window.setTimeout(() => {
      inspectRepo(new GitHub(auth?.token ?? null), repo)
        .then((target) => !cancelled && setCheck({ state: "ok", target }))
        .catch((error) => !cancelled && setCheck({ state: "error", error }));
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, opened, repoText, auth]);

  const target: SaveTarget | null = opened ?? (check.state === "ok" ? check.target : null);
  const needsWorkflow = !!target && !target.workflowExists;
  const files = useMemo(() => filesFor({ config, addWorkflow: needsWorkflow && addWorkflow }), [config, needsWorkflow, addWorkflow]);
  const usesApi = mode !== "editor";

  const pickMode = (m: SaveMode) => {
    setMode(m);
    platform.saveSaveMode(m);
  };

  // a repository read while GitHub's API was rate-limited only knows HEAD; name the branch before writing
  const resolvedBranch = async (t: SaveTarget, gh: GitHub) => {
    if (t.branch !== "HEAD") return t.branch;
    try {
      const branch = (await gh.repo(t.repo.full)).defaultBranch;
      if (opened) setSession({ opened: { ...opened, branch } });
      return branch;
    } catch {
      return "HEAD";
    }
  };

  const viaEditor = async () => {
    if (!target) return;
    const branch = await resolvedBranch(target, new GitHub(auth?.token ?? null));
    const [configFile, workflowFile] = files;
    const note = await platform.openEditor(target.repo, branch, [
      { ...configFile, exists: target.configExists },
      ...(workflowFile ? [{ ...workflowFile, exists: false }] : []),
    ]);
    toast(note);
    close();
  };

  const viaApi = async () => {
    if (!auth || !target) return;
    setBusy(true);
    try {
      const gh = new GitHub(auth.token);
      const withWorkflow = needsWorkflow && addWorkflow;
      const result = await saveDesign(gh, {
        repo: target.repo,
        branch: await resolvedBranch(target, gh),
        config,
        message: message.trim() || "docs: update the README design",
        addWorkflow: withWorkflow,
        target: mode === "pull-request" ? "pull-request" : "commit",
        prBranch,
      });
      setDone(result);
      if (result.kind === "commit") {
        // the repository now holds this design: nothing unsaved is left
        if (opened) {
          setSession({ opened: { ...opened, config, configExists: true, workflowExists: opened.workflowExists || withWorkflow } });
          useStudio.getState().rebase(config);
        } else setCheck({ state: "ok", target: { ...target, configExists: true, workflowExists: target.workflowExists || withWorkflow } });
      }
      platform.onSaved?.(result);
      toast(result.kind === "pull-request" ? "Pull request opened" : "Committed to GitHub");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const branch = !target || target.branch === "HEAD" ? "the default branch" : target.branch;
  const repoName = target?.repo.full ?? (parseRepo(repoText)?.full || "a repository");
  return (
    <Dialog
      open={open}
      onClose={close}
      width={620}
      icon={<UploadCloud />}
      title="Save to GitHub"
      subtitle={
        <>
          Writes <code>{CONFIG_PATH}</code> to <b>{repoName}</b>. The readme workflow then renders the images and updates the README.
        </>
      }
      footer={
        done ? (
          <>
            <a className="btn" href={done.url} target="_blank" rel="noopener">
              <ExternalLink /> {done.kind === "pull-request" ? "View pull request" : "View commit"}
            </a>
            <Button variant="accent" onClick={close}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="gh-manual" onClick={() => openDialog("export")} title="Download the files and add them to the repository yourself">
              <Download /> Export manually
            </Button>
            <Button onClick={close}>Cancel</Button>
            {mode === "editor" ? (
              platform.fillsEditor ? (
                <Button variant="accent" disabled={!target} onClick={viaEditor}>
                  <Pencil /> Open GitHub's editor
                </Button>
              ) : null
            ) : (
              <Button variant="accent" disabled={!auth || !target || busy} onClick={viaApi}>
                {mode === "pull-request" ? <GitPullRequest /> : <GitCommitHorizontal />} {busy ? "Saving…" : mode === "pull-request" ? "Open pull request" : "Commit"}
              </Button>
            )}
          </>
        )
      }
    >
      {done ? (
        <p className="gh-done">
          {done.kind === "pull-request"
            ? "The pull request is open. Once it is merged, the readme workflow renders the new design."
            : "Saved. The readme workflow runs on this change; the README updates when it finishes."}
        </p>
      ) : (
        <div className="gh-save">
          {!opened && (
            <Field label="Repository" help={<RepoStatus check={check} login={auth?.login} />}>
              <TextInput mono aria-label="Repository" placeholder="owner/name or a link to it" value={repoText} onChange={(v) => setRepoText(v.trim())} />
            </Field>
          )}
          <Segmented label="How to save" value={mode} onChange={pickMode} options={MODES} />
          <p className="muted gh-note">
            {mode === "commit" && <>Commits to {branch} with your GitHub account.</>}
            {mode === "pull-request" && <>Commits to a new branch and opens a pull request against {branch}.</>}
            {mode === "editor" && platform.editorNote}
          </p>
          {mode === "editor" && !platform.fillsEditor && target && <EditorSteps target={target} files={files} />}
          {usesApi && <AuthPanel platform={platform} auth={auth} onChange={(a) => setSession({ auth: a })} />}
          {usesApi && auth && (
            <>
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
          <p className="muted gh-note">
            <GitBranch size={12} /> {files.map((f) => f.path).join(" and ")}
          </p>
        </div>
      )}
    </Dialog>
  );
}

function RepoStatus({ check, login }: { check: Check; login?: string }) {
  if (check.state === "idle") return <>The repository the README belongs to, as owner/name or a link to it.</>;
  if (check.state === "checking") return <>Checking…</>;
  if (check.state === "ok") {
    const t = check.target;
    return (
      <>
        {t.branch === "HEAD" ? "Found" : <>Found, default branch {t.branch}</>}. {t.configExists ? "It has a design, which this replaces." : "No design yet."}
      </>
    );
  }
  const e = check.error;
  if (e instanceof TokenRejected) return <span className="gh-error">GitHub no longer accepts the saved sign-in. Sign out and sign in again.</span>;
  if (e instanceof RepoUnavailable && e.rateLimited && !e.signedIn) return <span className="gh-error">GitHub is limiting requests without signing in. Sign in to check this repository.</span>;
  if (e instanceof RepoUnavailable && e.rateLimited) return <span className="gh-error">GitHub is limiting requests for now. Try again in a few minutes.</span>;
  if (e instanceof RepoUnavailable && !e.signedIn) return <span className="gh-error">Not found. If it is private, sign in with an account or token that can see it.</span>;
  if (e instanceof RepoUnavailable) return <span className="gh-error">Not found, or {login ?? "your account"} cannot see it.</span>;
  return <span className="gh-error">{(e as Error)?.message ?? String(e)}</span>;
}

/**
 * Saving through GitHub's editor from a web page, one file at a time. A web page cannot type
 * into github.com, and a long file does not fit in the link that would fill it in, so each file
 * gets a Copy and an Open button: both run on the user's own click, which is what browsers
 * require for the clipboard and for a new tab.
 */
function EditorSteps({ target, files }: { target: SaveTarget; files: { path: string; text: string }[] }) {
  const [branch, setBranch] = useState(target.branch);
  const [copied, setCopied] = useState<string | null>(null);
  // a repository read without the API only knows HEAD; GitHub's editor needs the branch's name
  useEffect(() => {
    if (target.branch !== "HEAD") return setBranch(target.branch);
    new GitHub(getSession().auth?.token ?? null)
      .repo(target.repo.full)
      .then((r) => setBranch(r.defaultBranch))
      .catch(() => setBranch("main"));
  }, [target]);
  return (
    <ol className="gh-steps">
      {files.map((f) => {
        const exists = f.path === CONFIG_PATH ? target.configExists : f.path === WORKFLOW_PATH ? target.workflowExists : false;
        const link = editorUrl({ repo: target.repo.full, branch, path: f.path, text: f.text }, exists);
        return (
          <li key={f.path}>
            <div className="gh-steps__file">
              <code>{f.path}</code>
              <span className="muted">
                {link.prefilled ? "opens filled in" : exists ? "replace its text with the copied one" : "too long for the link: copy it, then paste it in"}
              </span>
            </div>
            <div className="gh-steps__actions">
              {!link.prefilled && (
                <Button
                  size="sm"
                  onClick={async () => {
                    if (await copyText(f.text)) setCopied(f.path);
                  }}
                >
                  {copied === f.path ? <Check /> : <Copy />} {copied === f.path ? "Copied" : "Copy"}
                </Button>
              )}
              <a className="btn btn--sm btn--accent" href={link.url} target="_blank" rel="noopener">
                <ExternalLink /> Open in GitHub
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
