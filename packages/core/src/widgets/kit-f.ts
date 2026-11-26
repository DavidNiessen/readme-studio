/** Small helpers shared by the batch-F project content widgets. */
import { projectName } from "../config";
import type { ProjectData } from "../data/types";
import { mix } from "../lib/color";
import { wrapText, type MeasureOptions } from "../lib/svg";
import type { Theme } from "../theme";
import { fillPlaceholders } from "./placeholders";
import type { Ctx } from "./types";

type MetaCtx = Pick<Ctx, "profile" | "data" | "project" | "kind">;

/** Repository data, or undefined when the design has none. */
export function projectData(ctx: Pick<Ctx, "data">): ProjectData | undefined {
  const p = ctx.data?.project;
  return p && typeof p === "object" ? p : undefined;
}

/** owner/name of the project repository ("" when unknown). */
export function repoSlug(ctx: MetaCtx): string {
  const r = (ctx.project?.repo || projectData(ctx)?.fullName || "").trim();
  return /^[\w.-]+\/[\w.-]+$/.test(r) ? r : "";
}

/** https://github.com/owner/name, or the profile when no repository is set. */
export function repoUrl(ctx: MetaCtx): string {
  const r = repoSlug(ctx);
  return r ? `https://github.com/${r}` : `https://github.com/${ctx.profile.login}`;
}

/** A lowercase, registry-safe fallback package name from a display name. */
function pkgSafe(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export interface PkgNames {
  /** display name of the project */
  name: string;
  /** npm / PyPI / crates.io package names, each falling back sensibly */
  npm: string;
  pypi: string;
  crate: string;
  /** repository name, lowercase */
  bin: string;
  repo: string;
  /** "2.4.0" without a leading v, or "" */
  version: string;
  license: string;
}

/** Package names derived from the project settings, the fetched data and the repository name. */
export function pkgNames(ctx: MetaCtx): PkgNames {
  const pi = ctx.project;
  const pd = projectData(ctx);
  const repo = repoSlug(ctx);
  const repoName = repo.split("/")[1] || pd?.name || "";
  const base = pkgSafe(repoName) || pkgSafe(pi ? projectName(pi) : "") || "my-project";
  const dl = (r: string) => pd?.downloads?.find((d) => d && d.registry === r)?.name || "";
  const npm = pi?.packages?.npm?.trim() || dl("npm") || base;
  const pypi = pi?.packages?.pypi?.trim() || dl("pypi") || npm.replace(/^@[^/]+\//, "");
  const crate = pi?.packages?.crates?.trim() || dl("crates") || pypi.replace(/[.]/g, "-");
  const tag = pd?.releases?.find((r) => r && r.tag)?.tag || pd?.downloads?.find((d) => d && d.version)?.version || "";
  const version = tag.replace(/^v(?=\d)/, "");
  return {
    name: (pi ? projectName(pi) : "") || pd?.name || base,
    npm,
    pypi,
    crate,
    bin: base,
    repo: repo || `${ctx.profile.login}/${base}`,
    version,
    license: pd?.license || "",
  };
}

/**
 * Placeholder fill for code and shell commands: only exact project `{token}`s (no inner spaces, so `{ name }`
 * destructuring survives), with package tokens that never come back empty.
 */
export function fillStrict(text: string, ctx: MetaCtx & Partial<Pick<Ctx, "d" | "now">>): string {
  if (typeof text !== "string") return "";
  if (!text.includes("{")) return text;
  const n = pkgNames(ctx);
  const own: Record<string, string> = {
    npm: n.npm,
    pypi: n.pypi,
    crate: n.crate,
    crates: n.crate,
    pkg: n.npm,
    bin: n.bin,
    repo: n.repo,
    project: n.name,
  };
  // only project tokens: `{name}` or `{city}` in an f-string or template must survive
  const passthrough = new Set(["version", "license", "tagline"]);
  return text.replace(/\{([a-z]+)\}/g, (m, key: string) => {
    if (key in own) return own[key];
    return passthrough.has(key) ? fillPlaceholders(m, ctx) : m;
  });
}

// ------------------------------------------------------------ SMIL timelines

/**
 * A discrete SMIL timeline over one looping period. `steps` are [seconds, value] pairs
 * (the first value holds from 0). Returns `values` and `keyTimes` attribute strings.
 */
export function discreteTimeline(period: number, steps: [number, string][]): { values: string; keyTimes: string } {
  const pts: [number, string][] = [];
  for (const [s, v] of steps) {
    let k = Math.max(0, Math.min(1, s / period));
    const prev = pts[pts.length - 1];
    if (prev) {
      if (k <= prev[0]) k = prev[0] + 0.0001;
      if (k >= 1) break;
      if (prev[1] === v) continue;
    } else k = 0;
    pts.push([k, v]);
  }
  if (!pts.length) pts.push([0, "0"]);
  return { values: pts.map((p) => p[1]).join(";"), keyTimes: pts.map((p) => Number(p[0].toFixed(4))).join(";") };
}

/** Linear SMIL timeline (holds where neighbouring values repeat); the last point is pinned to 1. */
export function linearTimeline(period: number, steps: [number, string][]): { values: string; keyTimes: string } {
  const pts: [number, string][] = [];
  for (const [s, v] of steps) {
    let k = Math.max(0, Math.min(1, s / period));
    const prev = pts[pts.length - 1];
    if (!prev) k = 0;
    else if (k <= prev[0]) k = prev[0] + 0.0001;
    if (k > 1) break;
    pts.push([k, v]);
  }
  if (pts.length < 2) pts.push([1, pts[0]?.[1] ?? "0"]);
  pts[pts.length - 1][0] = 1;
  return { values: pts.map((p) => p[1]).join(";"), keyTimes: pts.map((p) => Number(p[0].toFixed(4))).join(";") };
}

// ------------------------------------------------------------ colours and marks

/** A soft fill of a colour on the card (for tinted tiles and bands). */
export function tint(t: Theme, color: string, amount = t.name === "dark" ? 0.16 : 0.1): string {
  return mix(t.card, color, amount);
}

/** Semantic success / warning greens and ambers that read on both schemes. */
export function okColor(t: Theme): string {
  return t.name === "dark" ? "#3fb950" : "#1a7f37";
}
export function warnColor(t: Theme): string {
  return t.name === "dark" ? "#d29922" : "#9a6700";
}

/** Decorative 16×16 line drawings that the shared glyph set lacks. */
export const extraGlyphs = {
  copy: `<rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M10.5 3.5V3a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"/>`,
  file: `<path d="M9 1.5H4.5A1.5 1.5 0 0 0 3 3v10a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13V5.5zM9 1.5v4h4"/>`,
  flag: `<path d="M3 14.5V2m0 .5h8.5l-1.8 3 1.8 3H3"/>`,
  coffee: `<path d="M2.5 6h9v4a3.5 3.5 0 0 1-3.5 3.5H6A3.5 3.5 0 0 1 2.5 10zM11.5 7h1a2 2 0 0 1 0 4h-1.2M5 1.5v2.5M8 1.5v2.5"/>`,
  collective: `<circle cx="8" cy="8" r="6"/><path d="M10.6 5.4a3.6 3.6 0 1 0 0 5.2" /><path d="M12.4 4.6a6 6 0 0 1 0 6.8"/>`,
  beer: `<path d="M3 4.5h7.5V13a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 13zM10.5 6.5h1.2a1.8 1.8 0 0 1 1.8 1.8v1.4a1.8 1.8 0 0 1-1.8 1.8h-1.2M3 4.5a2 2 0 0 1 2-2.5 2.2 2.2 0 0 1 3.3-.3A2 2 0 0 1 10.5 4.5M5.5 7.5v4.5M8 7.5v4.5"/>`,
  box: `<path d="M8 1.5 14 4.5v7L8 14.5 2 11.5v-7zM2 4.5l6 3 6-3M8 7.5v7"/>`,
};

export type ExtraGlyph = keyof typeof extraGlyphs;

export function xglyph(name: ExtraGlyph, x: number, y: number, size: number, color: string, extra = ""): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${extraGlyphs[name]}</svg>`;
}

/** Parse "3-5, 8" into a set of 1-based line numbers (bounded). */
export function lineSet(spec: string, max = 400): Set<number> {
  const out = new Set<number>();
  for (const part of String(spec || "").split(/[,\s]+/)) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part.trim());
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.min(Math.max(a, b), max); i++) if (i >= 1) out.add(i);
  }
  return out;
}

/** GitHub-style heading anchor: lowercase, spaces to dashes, punctuation dropped. */
export function ghSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Word wrap that evens out line lengths (no one-word orphan on the last line) within the same line count. */
export function balancedWrap(t: Theme, text: string, size: number, max: number, maxLines: number, o: MeasureOptions = {}): string[] {
  const lines = wrapText(t, text, size, max, maxLines, o);
  if (lines.length < 2 || lines[lines.length - 1].endsWith("…")) return lines;
  let lo = max * 0.55;
  let hi = max;
  let best = lines;
  for (let k = 0; k < 10; k++) {
    const mid = (lo + hi) / 2;
    const l = wrapText(t, text, size, mid, maxLines, o);
    if (l.length === lines.length && !l[l.length - 1].endsWith("…")) {
      best = l;
      hi = mid;
    } else lo = mid;
  }
  return best;
}
