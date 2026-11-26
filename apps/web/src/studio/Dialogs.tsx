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
  type Mode,
} from "@readme-studio/core";
import {
  AlertTriangle,
  Check,
  Download,
  FileJson,
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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PresetThumb } from "../components/PresetThumb";
import { Button, CodeBlock, CopyButton, Dialog, Field, Kbd, MOD, Segmented, Select, TextInput, ToggleRow, cn, copyText, useToast } from "../components/ui";
import { assetsZip, download, projectFiles, projectZip } from "../lib/export";
import { shareUrl } from "../lib/share";
import { deleteDesign, loadDesigns, type SavedDesign } from "../lib/storage";
import { useStudio } from "../state/store";

// ---------------------------------------------------------------- export

function ExportDialog() {
  const { dialog, openDialog, config, data, commit } = useStudio();
  const toast = useToast();
  const [file, setFile] = useState(0);
  const [pat, setPat] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const open = dialog === "export";
  const files = useMemo(() => (open ? projectFiles(config, data, { profileToken: pat }) : []), [open, config, data, pat]);
  const out = config.output;
  const setOut = (patch: Partial<typeof out>) => commit((c) => ({ ...c, output: { ...c.output, ...patch } }));
  const repo = assetRepository(config);
  return (
    <Dialog
      open={open}
      onClose={() => openDialog(null)}
      width={760}
      title="Export your profile project"
      subtitle="Everything your profile repository needs: the design, a scheduled workflow and the README."
      footer={
        <>
          <span className="muted" style={{ marginRight: "auto", fontSize: 12 }}>
            Uses <code>{ACTION_REF}</code>
          </span>
          <Button onClick={() => openDialog(null)}>Close</Button>
          <Button
            variant="accent"
            onClick={() => {
              download(`${config.profile.login}-readme.zip`, projectZip(config, data, { profileToken: pat }), "application/zip");
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
              GitHub shows the README of <b>{config.profile.login}/{config.profile.login}</b> on your profile. Images are force-pushed to a separate branch so your history stays clean.
            </p>
            <div className="grid-2">
              <Field label="Repository" help="Leave empty for your profile repository.">
                <TextInput mono aria-label="Repository" placeholder={`${config.profile.login}/${config.profile.login}`} value={out.repository} onChange={(v) => setOut({ repository: v.trim() })} />
              </Field>
              <Field label="Asset branch">
                <TextInput mono aria-label="Asset branch" value={out.branch} onChange={(v) => setOut({ branch: v.replace(/[^\w./-]/g, "") || "output" })} />
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
              <Button onClick={() => window.open(`https://github.com/new?name=${encodeURIComponent(config.profile.login)}&visibility=public`, "_blank", "noopener")}>
                <Plus /> Create the repository
              </Button>
              <Button
                disabled={progress !== null}
                onClick={async () => {
                  setProgress("0%");
                  try {
                    const zip = await assetsZip(config, data, (d, t) => setProgress(`${Math.round((d / t) * 100)}%`));
                    download(`${config.profile.login}-assets.zip`, zip, "application/zip");
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
  const { dialog, openDialog, replace, config, mode } = useStudio();
  const toast = useToast();
  const [keep, setKeep] = useState(true);
  return (
    <Dialog
      open={dialog === "presets"}
      onClose={() => openDialog(null)}
      width={1040}
      title="Start from a preset"
      subtitle="Complete designs: theme plus layout. Your profile details carry over, and you can undo."
      footer={
        <div style={{ marginRight: "auto" }}>
          <ToggleRow label="Keep my profile details" checked={keep} onChange={setKeep} />
        </div>
      }
    >
      <div className="preset-grid">
        {layoutPresets.map((p) => (
          <button
            type="button"
            key={p.id}
            className="preset-card"
            onClick={() => {
              const next = normalizeConfig({ ...presetConfig(p.id), profile: keep ? config.profile : presetConfig(p.id).profile, output: config.output }).config;
              replace(next);
              openDialog(null);
              toast(`Applied “${p.name}”`);
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

function ImportDialog() {
  const { dialog, openDialog, replace } = useStudio();
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const apply = (raw: string, name?: string) => {
    try {
      const { config, warnings } = parseConfig(raw);
      replace(config, name, true);
      openDialog(null);
      setText("");
      setError(null);
      toast(warnings.length ? `Imported with ${warnings.length} warning(s)` : "Design imported", warnings.length ? <AlertTriangle /> : undefined);
    } catch (e) {
      setError(`That isn't valid JSON: ${(e as Error).message}`);
    }
  };
  const readFile = async (f: File) => apply(await f.text(), f.name.replace(/\.json$/, ""));
  return (
    <Dialog
      open={dialog === "import"}
      onClose={() => openDialog(null)}
      title="Import a design"
      subtitle="Open a readme.config.json from your profile repository, or paste its contents."
      width={600}
      footer={
        <>
          <Button onClick={() => openDialog(null)}>Cancel</Button>
          <Button variant="primary" disabled={!text.trim()} onClick={() => apply(text)}>
            <Upload /> Import
          </Button>
        </>
      }
    >
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
        <FileJson />
        <span>Drop readme.config.json here</span>
        <Button size="sm" onClick={() => input.current?.click()}>
          <FolderOpen /> Choose file
        </Button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
      </div>
      <Field label="…or paste JSON">
        <textarea className="json-editor" style={{ minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder='{ "profile": { "login": "…" }, … }' />
      </Field>
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
    ["Duplicate widget", <><Kbd>{MOD}</Kbd><Kbd>D</Kbd></>],
    ["Delete widget", <Kbd>Del</Kbd>],
    ["Move widget up / down", <><Kbd>Alt</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd></>],
    ["Select previous / next", <><Kbd>↑</Kbd><Kbd>↓</Kbd></>],
    ["Deselect", <Kbd>Esc</Kbd>],
    ["Add widget", <Kbd>A</Kbd>],
    ["Toggle dark / light preview", <Kbd>T</Kbd>],
    ["Replay animations", <Kbd>R</Kbd>],
    ["Export", <><Kbd>{MOD}</Kbd><Kbd>E</Kbd></>],
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
      title="Your designs"
      subtitle="Saved automatically in this browser."
      width={560}
      footer={
        <Button
          variant="primary"
          onClick={() => {
            newDesign("command-center");
            openDialog(null);
            toast("New design created");
          }}
        >
          <Plus /> New design
        </Button>
      }
    >
      <div className="design-list">
        {(list.some((d) => d.id === designId) ? list : [{ id: designId, name, updatedAt: Date.now(), config }, ...list]).map((d) => (
          <div key={d.id} className={cn("design-item", d.id === designId && "is-current")}>
            <div>
              <div className="design-item__name">{d.id === designId ? name : d.name}</div>
              <div className="design-item__meta">
                {d.config.layout.reduce((a, r) => a + r.blocks.length, 0)} widgets · {palettePresets.find((p) => p.id === d.config.theme.preset)?.name ?? "Custom"} · edited {new Date(d.updatedAt).toLocaleString()}
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
      { group: "Actions", label: "Export project", icon: <Download />, run: () => s.openDialog("export") },
      { group: "Actions", label: "Browse presets", icon: <LayoutTemplate />, run: () => s.openDialog("presets") },
      { group: "Actions", label: "Import config", icon: <Upload />, run: () => s.openDialog("import") },
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
      { group: "Actions", label: s.mode === "dark" ? "Preview light mode" : "Preview dark mode", icon: s.mode === "dark" ? <Sun /> : <Moon />, run: () => s.setMode(s.mode === "dark" ? "light" : "dark") },
      ...widgetList.map((w) => ({ group: "Add widget", label: w.title, hint: w.category, icon: <Plus />, run: () => s.add(w.type) })),
      ...palettePresets.map((p) => ({
        group: "Palette",
        label: p.name,
        hint: "palette",
        icon: <Palette />,
        run: () => s.commit((c) => ({ ...c, theme: { ...c.theme, preset: p.id, accent: undefined } })),
      })),
      ...layoutPresets.map((p) => ({ group: "Preset", label: p.name, hint: "replaces layout", icon: <LayoutTemplate />, run: () => s.replace(normalizeConfig({ ...presetConfig(p.id), profile: s.config.profile, output: s.config.output }).config) })),
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

export function Dialogs() {
  return (
    <>
      <ExportDialog />
      <PresetsDialog />
      <ImportDialog />
      <JsonDialog />
      <ShortcutsDialog />
      <DesignsDialog />
      <CommandPalette />
    </>
  );
}
