import {
  contrast,
  FONTS,
  getWidget,
  isHex,
  MODES,
  PALETTE_KEYS,
  palettePresets,
  resolvePalette,
  type DesignKind,
  type Mode,
  type Palette,
  type ProfileLink,
  type ProjectInfo,
  type ThemeSettings,
  PLACEHOLDER_HELP,
} from "@readme-studio/core";
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Database,
  Info,
  Link2,
  MapPin,
  Palette as PaletteIcon,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  User,
  Wand2,
  FolderGit2,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ColorSwatchButton } from "../components/ColorPicker";
import { arrayMove, SortableItem, SortableList, SortHandle } from "../components/Sortable";
import { Button, ColorInput, Field, IconButton, Segmented, Select, Slider, Tabs, TextInput, ToggleRow, useToast } from "../components/ui";
import { canJoin, findBlock, setJoin, setRowAlign, updateBlock } from "../lib/layout";
import { parseRepo } from "../github/repo";
import { fetchLive } from "../lib/live";
import { blockActions } from "./blockActions";
import { useStudio, type InspectorTab } from "../state/store";
import { FieldControl, IconPicker } from "./FieldControl";
import { WidgetIcon } from "./icons";

// ---------------------------------------------------------------- block

function BlockPanel() {
  const { config, selected, commit, setOptions, rename, remove, duplicate, move, select } = useStudio();
  const at = selected ? findBlock(config, selected) : null;
  const [idDraft, setIdDraft] = useState<string | null>(null);
  if (!at) {
    return (
      <div className="empty" style={{ paddingTop: 64 }}>
        <SlidersHorizontal />
        <strong>Nothing selected</strong>
        <span>Click a widget on the canvas or in the layers list to edit its options.</span>
      </div>
    );
  }
  const def = getWidget(at.block.type);
  if (!def) return null;
  const b = at.block;
  const values = { ...def.defaults, ...b.options };
  const joinable = canJoin(config, b.id);
  const joined = at.index > 0;
  return (
    <>
      <div className="inspector-head">
        <div className="inspector-head__top">
          <div className="layer__icon">
            <WidgetIcon type={def.type} category={def.category} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="inspector-head__title">{def.title}</div>
            <div className="eyebrow" style={{ fontSize: 10 }}>
              {def.category} · {def.kind === "gif" ? "animated gif" : def.kind === "markdown" ? "markdown" : "animated svg"}
            </div>
          </div>
          <IconButton label="Move up" shortcut="Alt ↑" onClick={() => move(b.id, -1)}>
            <ArrowUp />
          </IconButton>
          <IconButton label="Move down" shortcut="Alt ↓" onClick={() => move(b.id, 1)}>
            <ArrowDown />
          </IconButton>
        </div>
        <p className="inspector-head__desc">{def.description}</p>
      </div>
      <div className="panel__section">
        <div className="subhead">Options</div>
        {def.fields.length === 0 && <p className="field__help">This widget has no options; it follows your theme and profile.</p>}
        {def.type === "markdown" && <MarkdownSummary id={b.id} text={String(values.text ?? "")} />}
        {def.fields
          // Markdown is edited on the canvas, where it renders, not in a box here
          .filter((f) => !(def.type === "markdown" && f.key === "text"))
          .map((f) => (
            <FieldControl key={f.key} field={f} values={values} onChange={(patch) => setOptions(b.id, patch)} />
          ))}
      </div>
      {LINK_WIDGETS.has(b.type) && <LinksEditor />}
      <div className="panel__section">
        <div className="subhead">Placement</div>
        {def.kind !== "markdown" && (
          <ToggleRow
            label="Beside the previous widget"
            help={joinable || joined ? "Share a row, e.g. two half-width cards." : "Not enough room in the previous row."}
            checked={joined}
            onChange={(v) => (v && !joinable ? undefined : commit((c) => setJoin(c, b.id, v)))}
          />
        )}
        <Field label="Row alignment">
          <Segmented
            label="Row alignment"
            value={at.row.align}
            onChange={(a) => commit((c) => setRowAlign(c, b.id, a))}
            options={[
              { value: "left", label: "Left", icon: <AlignLeft /> },
              { value: "center", label: "Center", icon: <AlignCenter /> },
              { value: "right", label: "Right", icon: <AlignRight /> },
            ]}
          />
        </Field>
        {def.kind !== "markdown" && !def.parts && (
          <Field label="Link" help="Where a click on the image goes. Leave empty for the widget's default, or type none.">
            <TextInput
              aria-label="Link"
              value={b.link === undefined ? "" : b.link || "none"}
              placeholder="default"
              onChange={(v) => commit((c) => updateBlock(c, b.id, { link: v === "" ? undefined : v === "none" ? "" : v }), `link:${b.id}`)}
            />
          </Field>
        )}
        <Field label="File name" aside={def.kind === "gif" ? ".gif" : ".svg"} help="Assets are published as <name>-dark and <name>-light.">
          <TextInput
            mono
            aria-label="File name"
            value={idDraft ?? b.id}
            onChange={setIdDraft}
            onBlur={() => {
              if (idDraft !== null) rename(b.id, idDraft);
              setIdDraft(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </Field>
        <ToggleRow label="Hidden" help="Keep it in the design but leave it out of the README." checked={Boolean(b.hidden)} onChange={(v) => commit((c) => updateBlock(c, b.id, { hidden: v || undefined }))} />
      </div>
      <div className="panel__section" style={{ display: "flex", gap: 8 }}>
        <Button size="sm" onClick={() => duplicate(b.id)}>
          <Copy /> Duplicate
        </Button>
        <Button size="sm" onClick={() => select(null)}>
          Done
        </Button>
        <Button size="sm" variant="danger" style={{ marginLeft: "auto" }} onClick={() => remove(b.id)}>
          <Trash2 /> Delete
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- kind + project

function KindSwitch() {
  const { config, commit } = useStudio();
  return (
    <div className="panel__section">
      <Field label="README for" help={config.kind === "project" ? "A repository's README: stars, contributors, releases, install steps." : "Your GitHub profile: the README of your username repository."}>
        <Segmented<DesignKind>
          label="README type"
          value={config.kind}
          onChange={(k) => commit((c) => ({ ...c, kind: k }))}
          options={[
            { value: "profile", label: "Profile", icon: <User /> },
            { value: "project", label: "Project", icon: <FolderGit2 /> },
          ]}
        />
      </Field>
    </div>
  );
}

/**
 * What the data is fetched for: the repository of a project README, the account of a profile
 * README. Everything a README says (names, roles, taglines, logos) is set in its widgets.
 */
function ConnectionSection() {
  const { config, commit } = useStudio();
  const project = config.kind === "project";
  const [repoDraft, setRepoDraft] = useState<string | null>(null);
  const setLogin = (v: string) => commit((c) => ({ ...c, profile: { ...c.profile, login: v.replace(/[^a-z0-9-]/gi, "").slice(0, 39) } }), "login");
  const setRepo = (full: string, owner: string) =>
    // the maintainer follows the repository while it is the repository's owner
    commit((c) => ({ ...c, project: { ...c.project, repo: full }, profile: c.profile.login === c.project.repo.split("/")[0] ? { ...c.profile, login: owner } : c.profile }), "repo");
  return (
    <div className="panel__section">
      <div className="subhead">Connected to</div>
      {project && (
        <Field label="Repository" help="owner/name (or a link to it) of the public repository this README is for. Its stars, contributors, releases and commits feed the project widgets.">
          <TextInput
            mono
            aria-label="Repository"
            placeholder="owner/name"
            value={repoDraft ?? config.project.repo}
            onChange={(v) => {
              setRepoDraft(v);
              const repo = parseRepo(v);
              if (repo) setRepo(repo.full, repo.owner);
            }}
            onBlur={() => setRepoDraft(null)}
          />
        </Field>
      )}
      <Field
        label={project ? "Maintainer" : "GitHub username"}
        help={project ? "The GitHub account behind the project, for sponsor links and the widgets that show a person." : "Your data is fetched for this account. Your profile repository is the one with the same name."}
      >
        <TextInput mono aria-label={project ? "Maintainer's GitHub username" : "GitHub username"} value={config.profile.login} onChange={setLogin} placeholder="octocat" />
      </Field>
    </div>
  );
}

/** Published packages: where version numbers, download counts and install commands come from. */
function PackagesSection() {
  const { config, commit } = useStudio();
  const p = config.project.packages;
  const setPkg = (k: keyof ProjectInfo["packages"], v: string) => commit((c) => ({ ...c, project: { ...c.project, packages: { ...c.project.packages, [k]: v.trim() } } }), `pkg:${k}`);
  return (
    <div className="panel__section">
      <div className="subhead">Packages</div>
      <p className="field__help" style={{ marginBottom: 10 }}>
        Used for version numbers, download counts and install commands. Leave empty if not published.
      </p>
      <Field label="npm">
        <TextInput mono aria-label="npm package" placeholder="@scope/name" value={p.npm} onChange={(v) => setPkg("npm", v)} />
      </Field>
      <div className="grid-2">
        <Field label="PyPI">
          <TextInput mono aria-label="PyPI package" value={p.pypi} onChange={(v) => setPkg("pypi", v)} />
        </Field>
        <Field label="crates.io">
          <TextInput mono aria-label="crates.io crate" value={p.crates} onChange={(v) => setPkg("crates", v)} />
        </Field>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- profile

/** A Markdown block's text at a glance, and the way into the editor on the canvas. */
function MarkdownSummary({ id, text }: { id: string; text: string }) {
  const editMarkdown = useStudio((s) => s.editMarkdown);
  const first = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  return (
    <div className="md-summary">
      <Button variant="primary" onClick={() => editMarkdown(id)}>
        <Pencil /> Edit Markdown
      </Button>
      <p className="field__help">
        Or double-click it on the canvas. {text.length.toLocaleString()} characters{first ? ` · starts “${first.length > 60 ? `${first.slice(0, 60)}…` : first}”` : ""}. {PLACEHOLDER_HELP}
      </p>
    </div>
  );
}

/** Widgets that show the profile's links, and so edit them. */
const LINK_WIDGETS = new Set(["socials", "contact"]);

const LINK_ICONS = ["github", "linkedin", "x", "website", "mail", "mastodon", "bluesky", "youtube", "instagram", "dribbble", "medium", "devto", "discord", "twitch", "stackoverflow", "kofi", "buymeacoffee"];

function TimezoneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return ["UTC", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"];
    }
  }, []);
  const all = zones.includes(value) ? zones : [value, ...zones];
  return <Select label="Time zone" value={value} onChange={onChange} options={["UTC", ...all.filter((z) => z !== "UTC")].map((z) => ({ value: z, label: z.replace(/_/g, " ") }))} />;
}

/** Where the person is: the weather, local time and greetings are fetched and worked out for it. */
function LocationSection() {
  const { config, commit } = useStudio();
  const toast = useToast();
  const p = config.profile;
  const [busy, setBusy] = useState(false);
  const setP = (patch: Partial<typeof p>, key?: string) => commit((c) => ({ ...c, profile: { ...c.profile, ...patch } }), key);
  const setLoc = (patch: Partial<typeof p.location>, key?: string) => setP({ location: { ...p.location, ...patch } }, key);
  const geocode = async () => {
    if (!p.location.city.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(p.location.city)}`);
      const j = (await r.json()) as { results?: { latitude: number; longitude: number; timezone: string; name: string; country: string }[] };
      const hit = j.results?.[0];
      if (!hit) toast(`No place called “${p.location.city}” found`, <AlertTriangle />);
      else {
        setLoc({ latitude: Number(hit.latitude.toFixed(3)), longitude: Number(hit.longitude.toFixed(3)), timezone: hit.timezone || p.location.timezone });
        toast(`Located ${hit.name}, ${hit.country}`, <MapPin />);
      }
    } catch {
      toast("Could not reach the geocoding service", <AlertTriangle />);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel__section">
      <div className="subhead">Location</div>
      <Field label="City" help="Used for the weather, local time, greetings and the city in the hero, about card and terminal.">
        <div className="input-group">
          <TextInput aria-label="City" value={p.location.city} onChange={(v) => setLoc({ city: v }, "city")} onKeyDown={(e) => e.key === "Enter" && geocode()} />
          <Button onClick={geocode} disabled={busy}>
            {busy ? <span className="spinner" /> : <MapPin />} Locate
          </Button>
        </div>
      </Field>
      <Field label="Time zone">
        <TimezoneSelect value={p.location.timezone} onChange={(v) => setLoc({ timezone: v })} />
      </Field>
      <div className="grid-2">
        <Field label="Latitude">
          <input className="input input--mono" type="number" step="0.01" aria-label="Latitude" value={p.location.latitude} onChange={(e) => setLoc({ latitude: Number(e.target.value) }, "lat")} />
        </Field>
        <Field label="Longitude">
          <input className="input input--mono" type="number" step="0.01" aria-label="Longitude" value={p.location.longitude} onChange={(e) => setLoc({ longitude: Number(e.target.value) }, "lon")} />
        </Field>
      </div>
    </div>
  );
}

/**
 * The profile's links, edited from the widgets that show them (social pills, contact card).
 * They belong to the profile, so both widgets always show the same list.
 */
function LinksEditor() {
  const { config, commit } = useStudio();
  const p = config.profile;
  const setP = (patch: Partial<typeof p>, key?: string) => commit((c) => ({ ...c, profile: { ...c.profile, ...patch } }), key);
  const setLink = (i: number, patch: Partial<ProfileLink>) => setP({ links: p.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) }, `link:${i}:${Object.keys(patch)[0]}`);
  return (
      <div className="panel__section">
        <div className="subhead">Links</div>
        <p className="field__help" style={{ marginBottom: 10 }}>
          Shared by the social pills (one clickable image per link) and the contact card: a change here shows in both.
        </p>
        <div className="list-ed">
          <SortableList count={p.links.length} onMove={(from, to) => setP({ links: arrayMove(p.links, from, to) })}>
          {p.links.map((l, i) => (
            <SortableItem className="list-ed__item is-open" key={i} index={i} style={{ padding: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 6, alignItems: "center" }}>
                <SortHandle label={`Reorder ${l.label || l.icon}`} />
                <IconPicker label="Link icon" value={l.icon} onChange={(v) => setLink(i, { icon: v })} allowGlyphs={false} />
                <div style={{ display: "flex" }}>
                  <IconButton size="sm" label="Move up" disabled={i === 0} onClick={() => setP({ links: swap(p.links, i, i - 1) })}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton size="sm" label="Move down" disabled={i === p.links.length - 1} onClick={() => setP({ links: swap(p.links, i, i + 1) })}>
                    <ArrowDown />
                  </IconButton>
                  <IconButton size="sm" label="Remove link" onClick={() => setP({ links: p.links.filter((_, j) => j !== i) })}>
                    <Trash2 />
                  </IconButton>
                </div>
              </div>
              <div className="grid-2">
                <TextInput aria-label="Label" placeholder="Label" value={l.label} onChange={(v) => setLink(i, { label: v })} />
                <TextInput aria-label="Handle" placeholder="@handle" value={l.handle} onChange={(v) => setLink(i, { handle: v })} />
              </div>
              <TextInput mono aria-label="URL" placeholder="https://" value={l.url} onChange={(v) => setLink(i, { url: v })} />
            </SortableItem>
          ))}
          </SortableList>
        </div>
        <Button size="sm" style={{ marginTop: 10 }} onClick={() => setP({ links: [...p.links, { icon: "website", label: "", url: "", handle: "" }] })}>
          <Plus /> Add link
        </Button>
        <p className="field__help" style={{ margin: "12px 0 6px" }}>
          Or start from one of these:
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {LINK_ICONS.filter((ic) => !p.links.some((l) => l.icon === ic))
            .slice(0, 8)
            .map((ic) => (
              <Button
                key={ic}
                size="sm"
                variant="ghost"
                onClick={() => setP({ links: [...p.links, { icon: ic, label: ic === "website" ? "Website" : ic === "mail" ? "Email" : ic[0].toUpperCase() + ic.slice(1), url: ic === "github" ? `https://github.com/${p.login}` : "", handle: "" }] })}
              >
                <Link2 /> {ic}
              </Button>
            ))}
        </div>
      </div>
  );
}

function swap<T>(a: T[], i: number, j: number): T[] {
  if (j < 0 || j >= a.length) return a;
  const n = [...a];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

// ---------------------------------------------------------------- theme

const TOKEN_LABEL: Record<string, string> = {
  bg: "Page",
  card: "Card",
  raised: "Raised",
  border: "Border",
  text: "Text",
  muted: "Muted",
  subtle: "Subtle",
  accent: "Accent",
  glow: "Glow",
  accent2: "Accent 2",
};

function PaletteCard({ id, active, onClick }: { id: string; active: boolean; onClick: () => void }) {
  const p = palettePresets.find((x) => x.id === id)!;
  return (
    <button type="button" className="palette" aria-pressed={active} onClick={onClick} title={p.description}>
      <div className="palette__swatch">
        {MODES.map((m) => (
          <div key={m} className="palette__half" style={{ background: p[m].card }}>
            <i style={{ height: 22, background: p[m].accent }} />
            <i style={{ height: 14, background: p[m].text }} />
            <i style={{ height: 9, background: p[m].muted }} />
            <i style={{ height: 17, background: p[m].heat[3] }} />
          </div>
        ))}
      </div>
      <div className="palette__name">
        <span>{p.name}</span>
      </div>
    </button>
  );
}

function ContrastWarnings({ settings }: { settings: ThemeSettings }) {
  const issues: string[] = [];
  for (const m of MODES) {
    const p = resolvePalette(settings, m);
    if (contrast(p.text, p.card) < 4.5) issues.push(`${m}: text on cards is hard to read (${contrast(p.text, p.card).toFixed(1)}:1)`);
    if (contrast(p.muted, p.card) < 2.5) issues.push(`${m}: muted text nearly disappears (${contrast(p.muted, p.card).toFixed(1)}:1)`);
    if (contrast(p.accent, p.card) < 1.8) issues.push(`${m}: accent blends into the card`);
  }
  if (!issues.length) return null;
  return (
    <div className="warn" style={{ marginTop: 12 }}>
      <AlertTriangle />
      <div>
        {issues.map((i) => (
          <div key={i}>{i}</div>
        ))}
      </div>
    </div>
  );
}

function TokenEditor({ settings, mode, onChange }: { settings: ThemeSettings; mode: Mode; onChange: (k: keyof Palette, v: string | string[] | undefined) => void }) {
  const base = resolvePalette({ ...settings, overrides: {} }, mode);
  const ov = settings.overrides?.[mode] ?? {};
  const cur = resolvePalette(settings, mode);
  return (
    <div className="token-grid">
      {PALETTE_KEYS.map((k) => (
        <div className="token-row" key={k}>
          <span>{TOKEN_LABEL[k]}</span>
          <ColorInput label={`${mode} ${TOKEN_LABEL[k]}`} value={(ov[k] as string) ?? ""} placeholder={base[k] as string} onChange={(v) => onChange(k, v)} onReset={() => onChange(k, undefined)} />
        </div>
      ))}
      <div className="token-row">
        <span>Heat scale</span>
        <div className="heat-row">
          {cur.heat.map((h, i) => (
            <ColorSwatchButton
              key={i}
              label={`${mode} heat level ${i}`}
              value={h}
              onChange={(v) => {
                const next = [...cur.heat];
                next[i] = v;
                onChange("heat", next);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemePanel() {
  const { config, commit, mode } = useStudio();
  const t = config.theme;
  const [tokMode, setTokMode] = useState<Mode>(mode);
  const setT = (patch: Partial<ThemeSettings>, key?: string) => commit((c) => ({ ...c, theme: { ...c.theme, ...patch } }), key);
  const fontOpts = FONTS.map((f) => ({ value: f.id, label: f.name, group: f.category === "mono" ? "Monospace" : f.category === "sans" ? "Sans serif" : "Serif" }));
  const hasOverrides = Object.keys(t.overrides?.dark ?? {}).length + Object.keys(t.overrides?.light ?? {}).length > 0;
  return (
    <>
      <div className="panel__section">
        <div className="subhead">Palette</div>
        <div className="palette-grid">
          {palettePresets.map((p) => (
            <PaletteCard key={p.id} id={p.id} active={!t.accent && t.preset === p.id} onClick={() => setT({ preset: p.id, accent: undefined })} />
          ))}
        </div>
        <Field label="Generate from one colour" help="Builds matching dark and light palettes around any accent.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
            <ColorInput label="Accent" value={t.accent ?? ""} placeholder={resolvePalette(t, "dark").accent} onChange={(v) => setT({ accent: v }, "accent")} onReset={() => setT({ accent: undefined })} />
            <IconButton
              label="Surprise me"
              onClick={() => {
                const h = Math.floor(Math.random() * 360);
                const hex = hslHex(h, 0.72, 0.55);
                setT({ accent: hex });
              }}
            >
              <Wand2 />
            </IconButton>
          </div>
        </Field>
        <ContrastWarnings settings={t} />
      </div>
      <div className="panel__section">
        <div className="subhead">Typography</div>
        <Field label="Body font">
          <Select label="Body font" value={t.font} options={fontOpts} onChange={(v) => setT({ font: v })} />
        </Field>
        <Field label="Display font" help="Names, headlines and big numbers.">
          <Select label="Display font" value={t.headingFont} options={fontOpts} onChange={(v) => setT({ headingFont: v })} />
        </Field>
      </div>
      <div className="panel__section">
        <div className="subhead">Shape & surface</div>
        <Field label="Corner radius" aside="px">
          <Slider label="Corner radius" value={t.radius} min={0} max={28} onChange={(v) => setT({ radius: v }, "radius")} />
        </Field>
        <Field label="Border width" aside="px">
          <Slider label="Border width" value={t.border} min={0} max={3} step={0.5} onChange={(v) => setT({ border: v }, "border")} />
        </Field>
        <Field label="Texture">
          <Segmented
            label="Texture"
            value={t.texture}
            onChange={(v) => setT({ texture: v })}
            options={[
              { value: "dots", label: "Dots" },
              { value: "grid", label: "Grid" },
              { value: "lines", label: "Lines" },
              { value: "none", label: "None" },
            ]}
          />
        </Field>
        <ToggleRow label="Card backgrounds" help="Off makes cards transparent so they blend into GitHub." checked={t.surface} onChange={(v) => setT({ surface: v })} />
      </div>
      <div className="panel__section">
        <div className="subhead">Motion</div>
        <Segmented
          label="Motion"
          value={t.motion}
          onChange={(v) => setT({ motion: v })}
          options={[
            { value: "full", label: "Full" },
            { value: "subtle", label: "Entrances only" },
            { value: "off", label: "Static" },
          ]}
        />
        <p className="field__help" style={{ marginTop: 8 }}>
          {t.motion === "full" ? "Entrance animations plus ambient loops." : t.motion === "subtle" ? "Widgets animate in once, then rest." : "No animation at all: final frames only."} Visitors with reduced motion always get a calm version.
        </p>
      </div>
      <div className="panel__section">
        <div className="subhead">Fine-tune colours</div>
        <Segmented label="Mode" value={tokMode} onChange={setTokMode} options={MODES.map((m) => ({ value: m, label: m === "dark" ? "Dark" : "Light" }))} />
        <div style={{ height: 12 }} />
        <TokenEditor
          settings={t}
          mode={tokMode}
          onChange={(k, v) =>
            commit(
              (c) => {
                const cur = { ...(c.theme.overrides?.[tokMode] ?? {}) } as Record<string, unknown>;
                if (v === undefined || (typeof v === "string" && !isHex(v))) delete cur[k];
                else cur[k] = v;
                return { ...c, theme: { ...c.theme, overrides: { ...c.theme.overrides, [tokMode]: cur } } };
              },
              `tok:${tokMode}:${k}`,
            )
          }
        />
        {hasOverrides && (
          <Button size="sm" variant="ghost" style={{ marginTop: 10 }} onClick={() => setT({ overrides: {} })}>
            <RefreshCw /> Reset all overrides
          </Button>
        )}
      </div>
    </>
  );
}

function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ---------------------------------------------------------------- data

function DataPanel() {
  const { config, data, dataMode, dataStatus, useSample, setLive, setDataStatus } = useStudio();
  const [token, setToken] = useState("");
  const load = async () => {
    setDataStatus({ state: "loading" });
    try {
      const d = await fetchLive(config, token.trim());
      setLive(d);
    } catch (e) {
      setDataStatus({ state: "error", message: (e as Error).message.includes("404") ? config.kind === "project" ? `Repository “${config.project.repo}” not found (or private).` : `GitHub user “${config.profile.login}” not found.` : (e as Error).message.includes("403") ? "GitHub rate limit reached. Add a token or try again later." : (e as Error).message });
    }
  };
  const pr = data.project;
  const rows: [string, string | number][] = config.kind === "project" && pr ? [
    ["source", data.source],
    ["repository", pr.fullName],
    ["stars", pr.stars],
    ["forks", pr.forks],
    ["contributors", pr.contributorCount],
    ["open issues", pr.openIssues],
    ["releases", pr.releases.length],
    ["commits, last year", pr.commitWeeks.reduce((a, b) => a + b, 0)],
    ["ci", pr.ci?.status ?? "n/a"],
  ] : [
    ["source", data.source],
    ["contributions, last year", data.lastYearTotal],
    ["current streak", ""],
    ["repositories", data.repos.length],
    ["followers", data.followers],
    ["languages", data.languages.length],
    ["recent events", data.events.length],
    ["releases", data.releases.length],
    ["weather", data.weather ? `${Math.round(data.weather.temperature)}°` : "n/a"],
  ];
  return (
    <>
      <KindSwitch />
      <ConnectionSection />
      {config.kind === "project" && <PackagesSection />}
      <LocationSection />
      <div className="panel__section">
        <div className="subhead">Preview data</div>
        <Segmented
          label="Data source"
          value={dataMode}
          onChange={(v) => (v === "sample" ? useSample() : load())}
          options={[
            { value: "sample", label: "Sample" },
            { value: "live", label: "Live from GitHub" },
          ]}
        />
        <p className="field__help" style={{ margin: "10px 0 16px" }}>
          {dataMode === "sample"
            ? "Realistic, deterministic sample data, seeded by your username. Nothing leaves your browser."
            : `Public data for ${config.kind === "project" ? config.project.repo : `@${config.profile.login}`}, fetched just now.`}{" "}
          The action always renders with your real numbers.
        </p>
        <Field label="GitHub token (optional)" help="Unlocks your exact contribution calendar in the preview. Kept in memory for this tab only and sent only to api.github.com.">
          <input className="input input--mono" type="password" autoComplete="off" placeholder="github_pat_…" aria-label="GitHub token" value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button onClick={load} disabled={dataStatus.state === "loading"}>
            {dataStatus.state === "loading" ? <span className="spinner" /> : <RefreshCw />} Load {config.kind === "project" ? config.project.repo : `@${config.profile.login}`}
          </Button>
        </div>
        {dataStatus.state === "error" && (
          <div className="warn" style={{ marginTop: 12 }}>
            <AlertTriangle />
            <span>{dataStatus.message}</span>
          </div>
        )}
        {dataMode === "live" && !token && config.kind === "profile" && (
          <div className="note" style={{ marginTop: 12 }}>
            <Info />
            <span>Without a token the browser cannot read your contribution calendar, so the graph widgets show a stand-in. The published README uses the real one.</span>
          </div>
        )}
        <div className="subhead" style={{ marginTop: 24 }}>
          Loaded
        </div>
        <div className="stat-list">
          {rows
            .filter(([k]) => k !== "current streak")
            .map(([k, v]) => (
              <FragmentRow key={k} k={k} v={v} />
            ))}
        </div>
      </div>
    </>
  );
}

function FragmentRow({ k, v }: { k: string; v: string | number }) {
  return (
    <>
      <span>{k}</span>
      <b>{typeof v === "number" ? v.toLocaleString("en-US") : v}</b>
    </>
  );
}

/** Several widgets selected: what they are, and what can be done to all of them at once. */
function SelectionPanel() {
  const { config, selection, select, toggleSelect } = useStudio();
  const blocks = selection.map((id) => findBlock(config, id)?.block).filter((b) => !!b);
  const actions = blockActions(selection).filter((a): a is Exclude<typeof a, "sep"> => a !== "sep");
  return (
    <>
      <div className="inspector-head">
        <div className="inspector-head__top">
          <div>
            <h2 style={{ margin: 0, fontSize: "var(--t-md)" }}>{blocks.length} widgets selected</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "var(--t-xs)" }}>
              Ctrl/⌘-click adds or removes one, Shift-click selects a range. Right-click for the same actions.
            </p>
          </div>
        </div>
      </div>
      <div className="selection-section">
        <div className="selection-actions">
          {actions.map((a) => (
            <Button key={a.label} size="sm" variant={a.danger ? "danger" : "secondary"} disabled={a.disabled} onClick={a.onSelect} title={a.shortcut}>
              {a.icon} {a.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="selection-section">
        <ul className="selection-list">
          {blocks.map((b) => (
            <li key={b.id}>
              <button type="button" className="selection-list__item" onClick={() => select(b.id)} title="Edit only this one">
                <span>{getWidget(b.type)?.title ?? b.type}</span>
                <span className="mono muted">{b.id}</span>
              </button>
              <IconButton size="sm" label="Remove from selection" onClick={() => toggleSelect(b.id)}>
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- shell

export function Inspector() {
  const { tab, setTab, selected, selection } = useStudio();
  const tabs: { value: InspectorTab; label: string; icon: React.ReactNode }[] = [
    ...(selected ? [{ value: "block" as const, label: selection.length > 1 ? `${selection.length} widgets` : "Widget", icon: <SlidersHorizontal /> }] : []),
    { value: "theme", label: "Theme", icon: <PaletteIcon /> },
    { value: "data", label: "Data", icon: <Database /> },
  ];
  const active = tab === "block" && !selected ? "theme" : tab === "data" || tab === "block" ? tab : "theme";
  return (
    <aside className="panel panel--inspector" aria-label="Inspector">
      <Tabs label="Inspector" value={active} onChange={setTab} tabs={tabs} />
      <div className="panel__scroll">
        {active === "block" && (selection.length > 1 ? <SelectionPanel /> : <BlockPanel />)}
        {active === "theme" && <ThemePanel />}
        {active === "data" && <DataPanel />}
      </div>
    </aside>
  );
}
