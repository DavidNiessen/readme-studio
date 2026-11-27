import {
  ACTION_REF,
  assetRepository,
  describeCron,
  layoutPresets,
  normalizeConfig,
  palettePresets,
  parseConfig,
  presetConfig,
  SCHEDULES,
  serializeConfig,
  widgetList,
  type DesignKind,
  type Mode,
} from "@readme-studio/core";
import {
  AlertTriangle,
  Check,
  Download,
  UploadCloud,
  FileJson,
  FileText,
  FolderGit2,
  FolderOpen,
  ImageDown,
  LayoutTemplate,
  Link2,
  Moon,
  Palette,
  Plus,
  Redo2,
  Search,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Pause,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PresetThumb } from "../components/PresetThumb";
import { Button, CodeBlock, CopyButton, Dialog, Field, Kbd, MOD, Segmented, Select, TextInput, ToggleRow, cn, copyText, useConfirm, useToast } from "../components/ui";
import { assetsZip, download, projectFiles, projectZip } from "../lib/export";
import { shareUrl } from "../lib/share";
import { deleteDesign, loadDesigns, type SavedDesign } from "../lib/storage";
import { designFromReadme } from "../github/design";
import { parseRepo } from "../github/repo";
import { useStudio } from "../state/store";
import { openedMessage, openFailure, openRepository } from "./github/openRepo";
import { suggestedRepo } from "./github/SaveToGitHub";
import { webPlatform } from "./github/webPlatform";
import { useStudioHost } from "./host";

// ---------------------------------------------------------------- export

function ExportDialog() {
  const { dialog, openDialog, config, data, commit } = useStudio();
  const toast = useToast();
  const [file, setFile] = useState(0);
  const [pat, setPat] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  // lets the branch field be empty while typing; falls back to the saved branch on blur
  const [branchDraft, setBranchDraft] = useState<string | null>(null);
  const open = dialog === "export";
  const files = useMemo(() => (open ? projectFiles(config, data, { profileToken: pat }) : []), [open, config, data, pat]);
  const out = config.output;
  const setOut = (patch: Partial<typeof out>) => commit((c) => ({ ...c, output: { ...c.output, ...patch } }));
  const repo = assetRepository(config);
  const isProject = config.kind === "project";
  const slugName = (isProject ? config.project.repo.split("/")[1] : config.profile.login) || "readme";
  return (
    <Dialog
      open={open}
      onClose={() => openDialog(null)}
      width={760}
      title={isProject ? "Export your project README" : "Export your profile README"}
      subtitle={`Everything ${isProject ? config.project.repo : "your profile repository"} needs: the design, a scheduled workflow and the README.`}
      footer={
        <>
          <span className="muted" style={{ marginRight: "auto", fontSize: 12 }}>
            Uses <code>{ACTION_REF}</code>
          </span>
          <Button onClick={() => openDialog(null)}>Close</Button>
          <Button
            variant="accent"
            onClick={() => {
              download(`${slugName}-readme-studio.zip`, projectZip(config, data, { profileToken: pat }), "application/zip");
              toast("Project downloaded");
            }}
          >
            <Download /> Download project
          </Button>
        </>
      }
    >
      <div className="steps">
        <div className="step">
          <div>
            <h4>Where it lives</h4>
            <p>
              {isProject ? (
                <>
                  The README goes into <b>{config.project.repo}</b>. Images are force-pushed to a separate branch of that repository so your history stays clean.
                </>
              ) : (
                <>
                  GitHub shows the README of <b>{config.profile.login}/{config.profile.login}</b> on your profile. Images are force-pushed to a separate branch so your history stays clean.
                </>
              )}
            </p>
            <div className="grid-2">
              <Field label="Repository" help={isProject ? "Leave empty for the project repository." : "Leave empty for your profile repository."}>
                <TextInput mono aria-label="Repository" placeholder={isProject ? config.project.repo : `${config.profile.login}/${config.profile.login}`} value={out.repository} onChange={(v) => setOut({ repository: parseRepo(v)?.full ?? v.trim() })} />
              </Field>
              <Field label="Asset branch">
                <TextInput
                  mono
                  aria-label="Asset branch"
                  value={branchDraft ?? out.branch}
                  onChange={(v) => {
                    const clean = v.replace(/[^\w./-]/g, "");
                    setBranchDraft(clean);
                    if (clean) setOut({ branch: clean });
                  }}
                  onBlur={() => setBranchDraft(null)}
                />
              </Field>
            </div>
          </div>
        </div>
        <div className="step">
          <div>
            <h4>How often it refreshes</h4>
            <p>The workflow re-renders every image with fresh numbers {describeCron(out.schedule)}, and whenever you push a new config.</p>
            <div className="grid-2">
              <Field label="Schedule">
                <Select label="Schedule" value={SCHEDULES.some((s) => s.value === out.schedule) ? out.schedule : "custom"} options={[...SCHEDULES, ...(SCHEDULES.some((s) => s.value === out.schedule) ? [] : [{ value: "custom", label: `Custom: ${out.schedule}` }])]} onChange={(v) => v !== "custom" && setOut({ schedule: v })} />
              </Field>
              <Field label="Colour schemes">
                <Segmented
                  label="Colour schemes"
                  value={out.modes.join(",")}
                  onChange={(v) => setOut({ modes: v.split(",") as Mode[] })}
                  options={[
                    { value: "dark,light", label: "Both" },
                    { value: "dark", label: "Dark" },
                    { value: "light", label: "Light" },
                  ]}
                />
              </Field>
            </div>
            <ToggleRow label="Include the optional PROFILE_TOKEN line" help="Adds private contribution counts when you create that secret." checked={pat} onChange={setPat} />
          </div>
        </div>
        <div className="step">
          <div>
            <h4>The files</h4>
            <p>Download them all as a zip, or copy them one by one into the GitHub web editor.</p>
            <div className="file-tabs" role="tablist">
              {files.map((f, i) => (
                <button key={f.path} type="button" aria-pressed={file === i} onClick={() => setFile(i)}>
                  {f.path}
                </button>
              ))}
            </div>
            {files[file] && (
              <>
                <CodeBlock code={files[file].content} maxHeight={260} />
                <p className="field__help" style={{ marginTop: 6 }}>
                  {files[file].description}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="step">
          <div>
            <h4>Turn it on</h4>
            <p>
              Push the files, then in <b>Settings → Actions → General</b> allow <b>Read and write permissions</b>, and run the <b>readme</b> workflow once from the Actions tab. Assets will be served from{" "}
              <code>
                raw.githubusercontent.com/{repo}/{out.branch}
              </code>
              .
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isProject ? (
                <Button onClick={() => window.open(`https://github.com/${repo}/settings/actions`, "_blank", "noopener")}>
                  <Plus /> Open Actions settings
                </Button>
              ) : (
                <Button onClick={() => window.open(`https://github.com/new?name=${encodeURIComponent(config.profile.login)}&visibility=public`, "_blank", "noopener")}>
                  <Plus /> Create the repository
                </Button>
              )}
              <Button
                disabled={progress !== null}
                onClick={async () => {
                  setProgress("0%");
                  try {
                    const zip = await assetsZip(config, data, (d, t) => setProgress(`${Math.round((d / t) * 100)}%`));
                    download(`${slugName}-assets.zip`, zip, "application/zip");
                  } finally {
                    setProgress(null);
                  }
                }}
              >
                {progress ? <span className="spinner" /> : <ImageDown />} {progress ? `Rendering ${progress}` : "Download static images"}
              </Button>
            </div>
            <p className="field__help" style={{ marginTop: 8 }}>
              Static images are a snapshot of the current preview with a README that references them relatively, for repos where you don't want a workflow.
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- presets

function PresetsDialog() {
  const { dialog, openDialog, replace, config, mode, name, designId } = useStudio();
  const toast = useToast();
  const confirm = useConfirm();
  const [keep, setKeep] = useState(true);
  const [kind, setKind] = useState<DesignKind>(config.kind);
  useEffect(() => {
    if (dialog === "presets") setKind(config.kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);
  return (
    <Dialog
      open={dialog === "presets"}
      onClose={() => openDialog(null)}
      width={1040}
      title="Start from a preset"
      subtitle="Complete designs: theme plus layout. Choosing one replaces this design (you can undo) or starts a new project."
      footer={
        <div style={{ marginRight: "auto" }}>
          <ToggleRow label={kind === "project" ? "Keep my project and profile details" : "Keep my profile details"} checked={keep} onChange={setKeep} />
        </div>
      }
    >
      <div style={{ maxWidth: 260, marginBottom: 16 }}>
        <Segmented<DesignKind>
          label="Preset type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "profile", label: `Profile · ${layoutPresets.filter((p) => (p.kind ?? "profile") === "profile").length}` },
            { value: "project", label: `Project · ${layoutPresets.filter((p) => p.kind === "project").length}` },
          ]}
        />
      </div>
      <div className="preset-grid">
        {layoutPresets.filter((p) => (p.kind ?? "profile") === kind).map((p) => (
          <button
            type="button"
            key={p.id}
            className="preset-card"
            onClick={async () => {
              const fresh = presetConfig(p.id);
              const next = normalizeConfig({ ...fresh, profile: keep ? config.profile : fresh.profile, project: keep ? config.project : fresh.project, output: config.output }).config;
              // a preset replaces every widget and the theme: ask first, unless there is nothing to lose
              // (an empty design, or the sample shown on a first visit that was never saved)
              const widgets = config.layout.reduce((n, r) => n + r.blocks.length, 0);
              const saved = loadDesigns().some((d) => d.id === designId);
              const answer = widgets && saved
                ? await confirm({
                    title: `Replace “${name}” with ${p.name}?`,
                    body: (
                      <p>
                        The preset replaces all {widgets} widgets and the theme of this design. {keep ? "Your profile and project details stay. " : ""}You can undo it with {MOD} Z, or keep this design
                        and start the preset as a new project.
                      </p>
                    ),
                    confirmLabel: "Replace this design",
                    altLabel: "Start a new project",
                  })
                : "confirm";
              if (!answer) return;
              // a new project is the preset as it comes; "keep my details" applies to replacing this one
              if (answer === "alt") replace(fresh, p.name, true);
              else replace(next);
              openDialog(null);
              toast(answer === "alt" ? `Started “${p.name}” as a new project` : `Applied “${p.name}”`);
            }}
          >
            <PresetThumb id={p.id} mode={mode} />
            <div className="preset-meta">
              <h4>{p.name}</h4>
              <p>{p.description}</p>
              <div className="preset-tags">
                {p.tags.map((t) => (
                  <span key={t} className="badge">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- import

type ImportFrom = "config" | "markdown" | "github";

/**
 * Starts a design from something that exists: a readme.config.json, any README's Markdown
 * (pasted or dropped), or a GitHub repository (its design, else its README).
 */
function ImportDialog() {
  const { dialog, openDialog, replace, config } = useStudio();
  const toast = useToast();
  const host = useStudioHost();
  const [from, setFrom] = useState<ImportFrom>("config");
  const [text, setText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [repoText, setRepoText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const open = dialog === "import";

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRepoText(suggestedRepo(useStudio.getState().config));
  }, [open]);

  const done = (msg: string, warn = false) => {
    openDialog(null);
    setText("");
    setMarkdown("");
    setError(null);
    toast(msg, warn ? <AlertTriangle /> : undefined);
  };

  const applyConfig = (raw: string, name?: string) => {
    try {
      const { config, warnings } = parseConfig(raw);
      replace(config, name, true);
      done(warnings.length ? `Imported with ${warnings.length} warning(s)` : "Design imported", warnings.length > 0);
    } catch (e) {
      setError(`That isn't valid JSON: ${(e as Error).message}`);
    }
  };

  const applyMarkdown = (md: string) => {
    const repo = parseRepo(repoText);
    if (!repo) return setError("Enter the repository the README belongs to, as owner/name or a link to it.");
    if (!md.trim()) return setError("Paste some Markdown first.");
    replace(designFromReadme(repo, md), `${repo.full} README`, true);
    done("Started a design from your Markdown");
  };

  const applyGitHub = async () => {
    const repo = parseRepo(repoText);
    if (!repo) return setError("Enter a repository as owner/name or a link to it.");
    setBusy(true);
    setError(null);
    try {
      // the repository's own draft: unsaved changes from last time come back with the reset banner
      const { opened, restored } = await openRepository(repo, host?.github ?? webPlatform);
      if (restored) {
        openDialog(null);
        setError(null);
      } else done(openedMessage(opened));
    } catch (e) {
      setError(openFailure(e, repo.full));
    } finally {
      setBusy(false);
    }
  };

  // a dropped or chosen file goes where its kind belongs
  const readFile = async (f: File) => {
    const body = await f.text();
    if (/\.(md|markdown|mdx|txt)$/i.test(f.name)) {
      setFrom("markdown");
      setMarkdown(body);
    } else applyConfig(body, f.name.replace(/\.json$/, ""));
  };

  const repoField = (label: string, help: string) => (
    <Field label={label} help={help}>
      <TextInput mono aria-label={label} placeholder="owner/name or https://github.com/owner/name" value={repoText} onChange={(v) => setRepoText(v.trim())} />
    </Field>
  );

  return (
    <Dialog
      open={open}
      onClose={() => openDialog(null)}
      title="Import a design"
      subtitle="Start from a Readme Studio config, from any README's Markdown, or from a repository on GitHub."
      width={600}
      footer={
        <>
          <Button onClick={() => openDialog(null)}>Cancel</Button>
          {from === "config" && (
            <Button variant="primary" disabled={!text.trim()} onClick={() => applyConfig(text)}>
              <Upload /> Import
            </Button>
          )}
          {from === "markdown" && (
            <Button variant="primary" disabled={!markdown.trim()} onClick={() => applyMarkdown(markdown)}>
              <Upload /> Import Markdown
            </Button>
          )}
          {from === "github" && (
            <Button variant="primary" disabled={!parseRepo(repoText) || busy} onClick={applyGitHub}>
              <FolderGit2 /> {busy ? "Importing…" : "Import from GitHub"}
            </Button>
          )}
        </>
      }
    >
      <div style={{ marginBottom: 14 }}>
        <Segmented<ImportFrom>
          label="Import from"
          value={from}
          onChange={(v) => {
            setFrom(v);
            setError(null);
          }}
          options={[
            { value: "config", label: "Config", icon: <FileJson /> },
            { value: "markdown", label: "Markdown", icon: <FileText /> },
            { value: "github", label: "GitHub README", icon: <FolderGit2 /> },
          ]}
        />
      </div>
      {from === "github" ? (
        <>
          {repoField("Repository", "owner/name or a link to it. Opens its Readme Studio design when it has one, else its README, split into Markdown blocks under a header.")}
        </>
      ) : (
        <div
          className={cn("drop", over && "is-over")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) readFile(f);
          }}
        >
          {from === "config" ? <FileJson /> : <FileText />}
          <span>{from === "config" ? "Drop readme.config.json here" : "Drop README.md here"}</span>
          <Button size="sm" onClick={() => input.current?.click()}>
            <FolderOpen /> Choose file
          </Button>
          <input
            ref={input}
            type="file"
            accept={from === "config" ? "application/json,.json" : ".md,.markdown,.mdx,.txt,text/markdown,text/plain"}
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) readFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {from === "config" && (
        <Field label="…or paste JSON">
          <textarea className="json-editor" style={{ minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder='{ "profile": { "login": "…" }, … }' />
        </Field>
      )}
      {from === "markdown" && (
        <>
          <Field label="…or paste Markdown" help="Kept word for word, one Markdown block per section, under the header for its kind of README.">
            <textarea className="json-editor" style={{ minHeight: 180 }} value={markdown} onChange={(e) => setMarkdown(e.target.value)} spellCheck={false} placeholder={"# My project\n\nWhat it does…\n\n## Install\n…"} />
          </Field>
          {repoField("Repository it belongs to", "Decides the header (a profile README for owner/owner, a project otherwise) and where relative links point.")}
        </>
      )}
      {error && (
        <div className="warn" style={{ marginTop: 10 }}>
          <AlertTriangle /> {error}
        </div>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- JSON editor

function JsonDialog() {
  const { dialog, openDialog, config, replace } = useStudio();
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => {
    if (dialog === "json") {
      setText(serializeConfig(config));
      setError(null);
      setWarnings([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);
  const validate = (t: string) => {
    setText(t);
    try {
      setWarnings(parseConfig(t).warnings);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Dialog
      open={dialog === "json"}
      onClose={() => openDialog(null)}
      title="Edit config as JSON"
      subtitle="The exact file the action reads. Invalid values are repaired when applied."
      width={760}
      footer={
        <>
          <span className="muted" style={{ marginRight: "auto", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            {error ? (
              <>
                <AlertTriangle style={{ width: 14, color: "var(--danger)" }} /> {error}
              </>
            ) : warnings.length ? (
              <>
                <AlertTriangle style={{ width: 14, color: "var(--warn)" }} /> {warnings[0]}
              </>
            ) : (
              <>
                <Check style={{ width: 14, color: "var(--ok)" }} /> Valid
              </>
            )}
          </span>
          <CopyButton text={text} />
          <Button
            variant="primary"
            disabled={Boolean(error)}
            onClick={() => {
              replace(parseConfig(text).config);
              openDialog(null);
              toast("Config applied");
            }}
          >
            Apply
          </Button>
        </>
      }
    >
      <textarea
        className="json-editor"
        value={text}
        onChange={(e) => validate(e.target.value)}
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const el = e.currentTarget;
            const s = el.selectionStart;
            validate(`${text.slice(0, s)}  ${text.slice(el.selectionEnd)}`);
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          }
        }}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------- shortcuts

function ShortcutsDialog() {
  const { dialog, openDialog } = useStudio();
  const rows: [string, ReactNode][] = [
    ["Command palette", <><Kbd>{MOD}</Kbd><Kbd>K</Kbd></>],
    ["Undo", <><Kbd>{MOD}</Kbd><Kbd>Z</Kbd></>],
    ["Redo", <><Kbd>{MOD}</Kbd><Kbd>⇧</Kbd><Kbd>Z</Kbd></>],
    ["Select several widgets", <><Kbd>{MOD}</Kbd>/<Kbd>⇧</Kbd> click</>],
    ["Select all", <><Kbd>{MOD}</Kbd><Kbd>A</Kbd></>],
    ["Duplicate selected", <><Kbd>{MOD}</Kbd><Kbd>D</Kbd></>],
    ["Delete selected", <Kbd>Del</Kbd>],
    ["Hide / show selected", <Kbd>H</Kbd>],
    ["Move selected up / down", <><Kbd>Alt</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd></>],
    ["Select previous / next", <><Kbd>↑</Kbd><Kbd>↓</Kbd></>],
    ["Extend the selection", <><Kbd>⇧</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd></>],
    ["Reorder widgets", <>drag on the canvas or in the layers</>],
    ["More actions", <>right-click</>],
    ["Deselect", <Kbd>Esc</Kbd>],
    ["Add widget", <Kbd>A</Kbd>],
    ["Toggle dark / light preview", <Kbd>T</Kbd>],
    ["Replay animations", <Kbd>R</Kbd>],
    ["Pause or play animations", <Kbd>P</Kbd>],
    ["Save to GitHub", <><Kbd>{MOD}</Kbd><Kbd>S</Kbd></>],
    ["Export manually", <><Kbd>{MOD}</Kbd><Kbd>E</Kbd></>],
    ["Shortcuts", <Kbd>?</Kbd>],
  ];
  return (
    <Dialog open={dialog === "shortcuts"} onClose={() => openDialog(null)} title="Keyboard shortcuts" width={460}>
      <div className="shortcuts">
        {rows.map(([k, v]) => (
          <FragmentPair key={k} a={k} b={v} />
        ))}
      </div>
    </Dialog>
  );
}

function FragmentPair({ a, b }: { a: string; b: ReactNode }) {
  return (
    <>
      <span>{a}</span>
      <span>{b}</span>
    </>
  );
}

// ---------------------------------------------------------------- designs

function DesignsDialog() {
  const { dialog, openDialog, designId, openDesign, newDesign, name, config } = useStudio();
  const [list, setList] = useState<SavedDesign[]>([]);
  useEffect(() => {
    if (dialog === "designs") setList(loadDesigns());
  }, [dialog]);
  const toast = useToast();
  return (
    <Dialog
      open={dialog === "designs"}
      onClose={() => openDialog(null)}
      title="All projects"
      subtitle="Every README design, saved automatically in this browser."
      width={560}
      footer={
        <>
          <Button
            onClick={() => {
              newDesign(layoutPresets.find((p) => p.kind === "project")?.id ?? "command-center");
              openDialog(null);
              toast("New project design created");
            }}
          >
            <Plus /> New project README
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              newDesign("command-center");
              openDialog(null);
              toast("New profile design created");
            }}
          >
            <Plus /> New profile README
          </Button>
        </>
      }
    >
      <div className="design-list">
        {(list.some((d) => d.id === designId) ? list : [{ id: designId, name, updatedAt: Date.now(), config }, ...list]).map((d) => (
          <div key={d.id} className={cn("design-item", d.id === designId && "is-current")}>
            <div>
              <div className="design-item__name">{d.id === designId ? name : d.name}</div>
              <div className="design-item__meta">
                {d.config.kind === "project" ? d.config.project.repo : "profile"} · {d.config.layout.reduce((a, r) => a + r.blocks.length, 0)} widgets · {palettePresets.find((p) => p.id === d.config.theme.preset)?.name ?? "Custom"} · edited {new Date(d.updatedAt).toLocaleString()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {d.id !== designId && (
                <>
                  <Button size="sm" onClick={() => (openDesign(d), openDialog(null))}>
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => {
                      deleteDesign(d.id);
                      setList(loadDesigns());
                    }}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
              {d.id === designId && <span className="badge badge--accent">open</span>}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- command palette

interface Cmd {
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

function CommandPalette() {
  const s = useStudio();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const open = s.dialog === "palette";
  useEffect(() => {
    if (open) {
      setQ("");
      setI(0);
    }
  }, [open]);
  const cmds: Cmd[] = useMemo(
    () => [
      { group: "Actions", label: "Save to GitHub", icon: <UploadCloud />, run: () => s.openDialog("save") },
      { group: "Actions", label: "Export manually", icon: <Download />, run: () => s.openDialog("export") },
      { group: "Actions", label: "Browse presets", icon: <LayoutTemplate />, run: () => s.openDialog("presets") },
      { group: "Actions", label: "Import design", icon: <Upload />, run: () => s.openDialog("import") },
      { group: "Actions", label: "Edit config as JSON", icon: <FileJson />, run: () => s.openDialog("json") },
      {
        group: "Actions",
        label: "Copy share link",
        icon: <Link2 />,
        run: async () => {
          await copyText(shareUrl(s.config));
          toast("Share link copied");
        },
      },
      { group: "Actions", label: "Undo", icon: <Undo2 />, run: s.undo },
      { group: "Actions", label: "Redo", icon: <Redo2 />, run: s.redo },
      { group: "Actions", label: s.animate ? "Pause animations" : "Play animations", icon: s.animate ? <Pause /> : <Play />, run: () => s.setAnimate(!s.animate) },
      { group: "Actions", label: s.mode === "dark" ? "Preview light mode" : "Preview dark mode", icon: s.mode === "dark" ? <Sun /> : <Moon />, run: () => s.setMode(s.mode === "dark" ? "light" : "dark") },
      ...widgetList.map((w) => ({ group: "Add widget", label: w.title, hint: w.category, icon: <Plus />, run: () => s.add(w.type) })),
      ...palettePresets.map((p) => ({
        group: "Palette",
        label: p.name,
        hint: "palette",
        icon: <Palette />,
        run: () => s.commit((c) => ({ ...c, theme: { ...c.theme, preset: p.id, accent: undefined } })),
      })),
      ...layoutPresets.map((p) => ({ group: "Preset", label: p.name, hint: "replaces layout", icon: <LayoutTemplate />, run: () => s.replace(normalizeConfig({ ...presetConfig(p.id), profile: s.config.profile, project: s.config.project, output: s.config.output }).config) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.mode, s.config],
  );
  const list = cmds.filter((c) => !q || `${c.label} ${c.group} ${c.hint ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const run = (c: Cmd) => {
    s.openDialog(null);
    c.run();
  };
  let lastGroup = "";
  return (
    <Dialog open={open} onClose={() => s.openDialog(null)} title="Command palette" width={560}>
      <div style={{ margin: "-20px -24px" }}>
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 18, top: 18, width: 16, height: 16, color: "var(--faint)" }} />
          <input
            className="cmdk__input"
            style={{ paddingLeft: 44 }}
            placeholder="Search actions, widgets, palettes…"
            value={q}
            data-autofocus
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((x) => Math.min(list.length - 1, x + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              } else if (e.key === "Enter" && list[i]) {
                e.preventDefault();
                run(list[i]);
              }
            }}
            aria-label="Search commands"
          />
        </div>
        <div className="cmdk__list" role="listbox">
          {list.map((c, j) => {
            const head = c.group !== lastGroup ? <div className="cmdk__group">{c.group}</div> : null;
            lastGroup = c.group;
            return (
              <div key={`${c.group}:${c.label}`}>
                {head}
                <button type="button" role="option" className="cmdk__item" aria-selected={j === i} onMouseEnter={() => setI(j)} onClick={() => run(c)} ref={(el) => (j === i ? el?.scrollIntoView({ block: "nearest" }) : undefined)}>
                  {c.icon}
                  <span>{c.label}</span>
                  {c.hint && <span className="muted">{c.hint}</span>}
                </button>
              </div>
            );
          })}
          {!list.length && <div className="empty">Nothing matches “{q}”.</div>}
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Only the open dialog is mounted: each reads much of the store, and mounted while closed they
 * re-rendered (presets, the command list) on every keystroke in the editor.
 */
export function Dialogs() {
  const dialog = useStudio((s) => s.dialog);
  switch (dialog) {
    case "export":
      return <ExportDialog />;
    case "presets":
      return <PresetsDialog />;
    case "import":
      return <ImportDialog />;
    case "json":
      return <JsonDialog />;
    case "shortcuts":
      return <ShortcutsDialog />;
    case "designs":
      return <DesignsDialog />;
    case "palette":
      return <CommandPalette />;
    default:
      return null;
  }
}
