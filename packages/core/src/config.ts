import { isTimeZone } from "./lib/astro";
import { isHex } from "./lib/color";
import { DEFAULT_THEME, MODES, PALETTE_KEYS, type Mode, type Motion, type Texture, type ThemeSettings } from "./theme";
import { FONTS } from "./fonts";
import { getWidget } from "./widgets/registry";
import { palettePresets } from "./theme";

export const CONFIG_VERSION = 1;
export const SCHEMA_URL = "https://readme.niessen.dev/schema.json";

export interface ProfileLink {
  /** icon id (github, linkedin, x, website, mail, …) */
  icon: string;
  label: string;
  url: string;
  /** short handle shown under the label */
  handle: string;
}

export interface Profile {
  /** GitHub username the data is fetched for */
  login: string;
  /** display name */
  name: string;
  /** rotating roles / taglines */
  roles: string[];
  bio: string;
  company: string;
  pronouns: string;
  /** YYYY-MM-DD, optional (used by terminal/uptime widgets) */
  birthday: string;
  location: { city: string; latitude: number; longitude: number; timezone: string };
  links: ProfileLink[];
}

export interface Block {
  /** stable id, also the asset file name prefix */
  id: string;
  type: string;
  options: Record<string, unknown>;
  hidden?: boolean;
  /** overrides the widget's default link target ("" = no link) */
  link?: string;
}

export type Align = "center" | "left" | "right";

export interface Row {
  id: string;
  align: Align;
  blocks: Block[];
}

export interface OutputSettings {
  /** branch the rendered assets are pushed to */
  branch: string;
  /** which colour schemes to render */
  modes: Mode[];
  /** owner/repo that hosts the assets; defaults to login/login */
  repository: string;
  /** cron expression used by the generated workflow */
  schedule: string;
}

export type DesignKind = "profile" | "project";

export interface ProjectInfo {
  /** owner/name of the repository the README is for */
  repo: string;
  /** display name (defaults to the repository name) */
  name: string;
  tagline: string;
  /** icon id for the project emblem, or "" for a monogram */
  logo: string;
  homepage: string;
  /** package names used for version and download numbers */
  packages: { npm: string; pypi: string; crates: string };
}

export interface StudioConfig {
  $schema?: string;
  version: number;
  /** what the README is for: a GitHub profile or a project repository */
  kind: DesignKind;
  profile: Profile;
  project: ProjectInfo;
  theme: ThemeSettings;
  layout: Row[];
  output: OutputSettings;
}

export const DEFAULT_PROFILE: Profile = {
  login: "octocat",
  name: "Mona Octocat",
  roles: ["Software Engineer", "Open-source tinkerer", "Coffee-driven developer"],
  bio: "I build calm, fast software and the tools around it.",
  company: "",
  pronouns: "",
  birthday: "",
  location: { city: "San Francisco", latitude: 37.77, longitude: -122.42, timezone: "America/Los_Angeles" },
  links: [
    { icon: "github", label: "GitHub", url: "https://github.com/octocat", handle: "@octocat" },
    { icon: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/", handle: "in/octocat" },
    { icon: "website", label: "Website", url: "https://github.blog", handle: "github.blog" },
  ],
};

export const DEFAULT_PROJECT: ProjectInfo = {
  repo: "octocat/aurora",
  name: "",
  tagline: "A tiny, fast design-token compiler for multi-brand UI kits.",
  logo: "",
  homepage: "",
  packages: { npm: "", pypi: "", crates: "" },
};

export const DEFAULT_OUTPUT: OutputSettings = { branch: "output", modes: ["dark", "light"], repository: "", schedule: "17 2 * * *" };

// ------------------------------------------------------------ helpers

let counter = 0;
/** Short random id for rows. */
export function uid(prefix = "r"): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 1e4).toString(36)}${counter.toString(36)}`;
}

/** A unique, file-name-safe block id like `stats` or `stats-2`. */
export function nextBlockId(type: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  const base = slug(type);
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}-${i}`)) return `${base}-${i}`;
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "block"
  );
}

export function allBlocks(c: Pick<StudioConfig, "layout">): Block[] {
  return c.layout.flatMap((r) => r.blocks);
}

/** owner/repo hosting the assets (and the README). */
export function assetRepository(c: StudioConfig): string {
  if (c.output.repository.trim()) return c.output.repository.trim();
  return c.kind === "project" ? c.project.repo : `${c.profile.login}/${c.profile.login}`;
}

/** Display name of the project: explicit name, else the repository name. */
export function projectName(p: ProjectInfo): string {
  return p.name.trim() || p.repo.split("/")[1] || p.repo;
}

export function assetBase(c: StudioConfig): string {
  return `https://raw.githubusercontent.com/${assetRepository(c)}/${c.output.branch}`;
}

// ------------------------------------------------------------ normalisation

export interface Normalized {
  config: StudioConfig;
  warnings: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, d: string, max = 500): string => (typeof v === "string" ? v.slice(0, max) : d);
const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

function normProfile(v: unknown, w: string[]): Profile {
  const p = isObj(v) ? v : {};
  const d = DEFAULT_PROFILE;
  const loc = isObj(p.location) ? p.location : {};
  let tz = str(loc.timezone, d.location.timezone, 64);
  if (!isTimeZone(tz)) {
    w.push(`Unknown time zone "${tz}", using UTC.`);
    tz = "UTC";
  }
  const login = str(p.login, d.login, 39).trim().replace(/^@/, "");
  return {
    login: /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login) ? login : d.login,
    name: str(p.name, d.name, 80),
    roles: Array.isArray(p.roles) ? p.roles.filter((r): r is string => typeof r === "string").map((r) => r.slice(0, 80)).slice(0, 12) : d.roles,
    bio: str(p.bio, "", 400),
    company: str(p.company, "", 80),
    pronouns: str(p.pronouns, "", 30),
    birthday: /^\d{4}-\d{2}-\d{2}$/.test(str(p.birthday, "")) ? str(p.birthday, "") : "",
    location: {
      city: str(loc.city, "", 60),
      latitude: num(loc.latitude, d.location.latitude, -90, 90),
      longitude: num(loc.longitude, d.location.longitude, -180, 180),
      timezone: tz,
    },
    links: Array.isArray(p.links)
      ? p.links.filter(isObj).slice(0, 16).map((l) => ({ icon: str(l.icon, "website", 40), label: str(l.label, "", 40), url: str(l.url, "", 300), handle: str(l.handle, "", 60) }))
      : d.links,
  };
}

function normTheme(v: unknown): ThemeSettings {
  const t = isObj(v) ? v : {};
  const d = DEFAULT_THEME;
  const fontIds = FONTS.map((f) => f.id);
  const overrides: ThemeSettings["overrides"] = {};
  if (isObj(t.overrides)) {
    for (const m of MODES) {
      const o = t.overrides[m];
      if (!isObj(o)) continue;
      const clean: Obj = {};
      for (const k of PALETTE_KEYS) if (isHex(o[k])) clean[k] = o[k];
      if (Array.isArray(o.heat) && o.heat.length === 5 && o.heat.every(isHex)) clean.heat = o.heat;
      if (Object.keys(clean).length) overrides[m] = clean;
    }
  }
  return {
    preset: oneOf(t.preset, palettePresets.map((p) => p.id), d.preset),
    accent: isHex(t.accent) ? t.accent : undefined,
    overrides,
    font: oneOf(t.font, fontIds, d.font),
    headingFont: oneOf(t.headingFont, fontIds, oneOf(t.font, fontIds, d.headingFont)),
    radius: num(t.radius, d.radius, 0, 32),
    border: num(t.border, d.border, 0, 4),
    texture: oneOf<Texture>(t.texture, ["dots", "grid", "lines", "none"], d.texture),
    motion: oneOf<Motion>(t.motion, ["full", "subtle", "off"], d.motion),
    surface: typeof t.surface === "boolean" ? t.surface : d.surface,
  };
}

/** Fill missing options from widget defaults and drop values of the wrong type. */
export function normOptions(type: string, v: unknown): Record<string, unknown> {
  const def = getWidget(type);
  const given = isObj(v) ? v : {};
  if (!def) return { ...given };
  const out: Record<string, unknown> = {};
  for (const [k, dv] of Object.entries(def.defaults)) {
    const gv = given[k];
    if (gv === undefined) out[k] = structuredClone(dv);
    else if (Array.isArray(dv)) out[k] = Array.isArray(gv) ? gv : structuredClone(dv);
    else if (dv !== null && typeof dv === "object") out[k] = isObj(gv) ? gv : structuredClone(dv);
    else out[k] = typeof gv === typeof dv ? gv : dv;
  }
  return out;
}

function normLayout(v: unknown, w: string[]): Row[] {
  if (!Array.isArray(v)) return [];
  const ids = new Set<string>();
  const rows: Row[] = [];
  for (const r of v) {
    if (!isObj(r)) continue;
    const blocks: Block[] = [];
    for (const b of Array.isArray(r.blocks) ? r.blocks : []) {
      if (!isObj(b)) continue;
      const type = str(b.type, "", 40);
      if (!getWidget(type)) {
        w.push(`Skipped unknown widget type "${type}".`);
        continue;
      }
      let id = slug(str(b.id, type, 40));
      if (ids.has(id)) id = nextBlockId(id, ids);
      ids.add(id);
      const block: Block = { id, type, options: normOptions(type, b.options) };
      if (b.hidden === true) block.hidden = true;
      if (typeof b.link === "string") block.link = b.link.slice(0, 300);
      blocks.push(block);
    }
    if (!blocks.length) continue;
    rows.push({ id: str(r.id, "", 40) || uid(), align: oneOf<Align>(r.align, ["center", "left", "right"], "center"), blocks });
  }
  return rows;
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

function normProject(v: unknown, login: string): ProjectInfo {
  const p = isObj(v) ? v : {};
  const d = DEFAULT_PROJECT;
  const pk = isObj(p.packages) ? p.packages : {};
  const repo = str(p.repo, "", 140).trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
  const pkg = (x: unknown) => str(x, "", 214).trim();
  return {
    repo: REPO_RE.test(repo) ? repo : `${login || "octocat"}/aurora`,
    name: str(p.name, d.name, 80),
    tagline: str(p.tagline, d.tagline, 200),
    logo: str(p.logo, d.logo, 40),
    homepage: str(p.homepage, d.homepage, 300),
    packages: { npm: pkg(pk.npm), pypi: pkg(pk.pypi), crates: pkg(pk.crates) },
  };
}

function normOutput(v: unknown): OutputSettings {
  const o = isObj(v) ? v : {};
  const d = DEFAULT_OUTPUT;
  const modes = Array.isArray(o.modes) ? MODES.filter((m) => (o.modes as unknown[]).includes(m)) : d.modes;
  const branch = str(o.branch, d.branch, 100).trim();
  const schedule = str(o.schedule, d.schedule, 60).trim();
  const repo = str(o.repository, "", 140).trim();
  return {
    branch: /^[\w./-]+$/.test(branch) ? branch : d.branch,
    modes: modes.length ? modes : d.modes,
    repository: /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : "",
    schedule: schedule.split(/\s+/).length === 5 ? schedule : d.schedule,
  };
}

/** Validate and complete any (possibly hand-edited or older) config. Never throws. */
export function normalizeConfig(raw: unknown): Normalized {
  const warnings: string[] = [];
  const c = isObj(raw) ? raw : {};
  if (!isObj(raw)) warnings.push("Config is not an object; using defaults.");
  const profile = normProfile(c.profile, warnings);
  const config: StudioConfig = {
    $schema: SCHEMA_URL,
    version: CONFIG_VERSION,
    kind: oneOf<DesignKind>(c.kind, ["profile", "project"], "profile"),
    profile,
    project: normProject(c.project, profile.login),
    theme: normTheme(c.theme),
    layout: normLayout(c.layout, warnings),
    output: normOutput(c.output),
  };
  return { config, warnings };
}

/** Parse JSON text into a normalised config; throws on invalid JSON only. */
export function parseConfig(text: string): Normalized {
  return normalizeConfig(JSON.parse(text));
}

export function serializeConfig(c: StudioConfig): string {
  return `${JSON.stringify({ ...c, $schema: SCHEMA_URL }, null, 2)}\n`;
}
