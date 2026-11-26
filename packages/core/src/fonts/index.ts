import { METRIC_FIRST, metrics } from "./metrics";

export type Weight = 400 | 700;
export type FontCategory = "mono" | "sans" | "serif";

export interface FontInfo {
  id: string;
  name: string;
  category: FontCategory;
  /** CSS fallback chain after the embedded face */
  fallback: string;
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const SERIF = "ui-serif, Georgia, 'Times New Roman', serif";

export const FONTS: FontInfo[] = [
  { id: "jetbrains-mono", name: "JetBrains Mono", category: "mono", fallback: MONO },
  { id: "ibm-plex-mono", name: "IBM Plex Mono", category: "mono", fallback: MONO },
  { id: "fira-code", name: "Fira Code", category: "mono", fallback: MONO },
  { id: "geist-mono", name: "Geist Mono", category: "mono", fallback: MONO },
  { id: "space-mono", name: "Space Mono", category: "mono", fallback: MONO },
  { id: "source-code-pro", name: "Source Code Pro", category: "mono", fallback: MONO },
  { id: "inter", name: "Inter", category: "sans", fallback: SANS },
  { id: "geist-sans", name: "Geist", category: "sans", fallback: SANS },
  { id: "space-grotesk", name: "Space Grotesk", category: "sans", fallback: SANS },
  { id: "manrope", name: "Manrope", category: "sans", fallback: SANS },
  { id: "fraunces", name: "Fraunces", category: "serif", fallback: SERIF },
  { id: "ibm-plex-serif", name: "IBM Plex Serif", category: "serif", fallback: SERIF },
];

export function fontInfo(id: string): FontInfo {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

type FontData = Record<Weight, string>;

const loaders: Record<string, () => Promise<{ default: FontData }>> = {
  "jetbrains-mono": () => import("./data/jetbrains-mono"),
  "ibm-plex-mono": () => import("./data/ibm-plex-mono"),
  "fira-code": () => import("./data/fira-code"),
  "geist-mono": () => import("./data/geist-mono"),
  "space-mono": () => import("./data/space-mono"),
  "source-code-pro": () => import("./data/source-code-pro"),
  inter: () => import("./data/inter"),
  "geist-sans": () => import("./data/geist-sans"),
  "space-grotesk": () => import("./data/space-grotesk"),
  manrope: () => import("./data/manrope"),
  fraunces: () => import("./data/fraunces"),
  "ibm-plex-serif": () => import("./data/ibm-plex-serif"),
};

const registry = new Map<string, FontData>();

/** Register base64 woff2 data for a font (done automatically by loadFonts). */
export function registerFont(id: string, data: FontData): void {
  registry.set(id, data);
}

export function isFontLoaded(id: string): boolean {
  return registry.has(id);
}

/** Load font data so that SVGs can embed it. Unknown ids are ignored. */
export async function loadFonts(ids: Iterable<string>): Promise<void> {
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      if (registry.has(id) || !loaders[id]) return;
      const mod = await loaders[id]();
      registry.set(id, mod.default);
    }),
  );
}

export async function loadAllFonts(): Promise<void> {
  await loadFonts(FONTS.map((f) => f.id));
}

/** The CSS font-family name used inside SVGs for a font id. */
export function familyName(id: string): string {
  return `rs-${fontInfo(id).id}`;
}

export function fontStack(id: string): string {
  const f = fontInfo(id);
  return `${familyName(f.id)}, '${f.name}', ${f.fallback}`;
}

/** @font-face rules embedding the given fonts as data URIs (SVG <img> cannot load external fonts). */
export function fontFaceCss(ids: string[], weights: Weight[] = [400, 700]): string {
  const out: string[] = [];
  for (const id of new Set(ids.map((i) => fontInfo(i).id))) {
    const data = registry.get(id);
    if (!data) continue;
    for (const w of weights) {
      out.push(`@font-face{font-family:${familyName(id)};font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${data[w]}) format('woff2');}`);
    }
  }
  return out.join("");
}

export function isMono(id: string): boolean {
  return fontInfo(id).category === "mono";
}

/**
 * Rendered width of `text` in px from real advance widths.
 * Characters outside Latin-1 fall back to the width of "n".
 */
export function measureText(text: string, size: number, fontId: string, weight: Weight = 400, letterSpacing = 0): number {
  const m = metrics[fontInfo(fontId).id]?.[weight];
  if (!m) return [...text].length * size * 0.6;
  const fallback = m.w["n".charCodeAt(0) - METRIC_FIRST];
  let total = 0;
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 32;
    const i = c - METRIC_FIRST;
    let w = i >= 0 && i < m.w.length ? m.w[i] : -1;
    if (c === 0x2009) w = fallback * 0.4; // thin space
    if (w < 0) w = c > 0x2e80 ? 1000 : fallback; // CJK and emoji are roughly full-width
    total += w;
    n++;
  }
  return (total / 1000) * size + Math.max(0, n - 1) * letterSpacing;
}

/** Vertical metrics as fractions of the font size. */
export function fontVMetrics(fontId: string, weight: Weight = 400): { ascent: number; descent: number } {
  const m = metrics[fontInfo(fontId).id]?.[weight];
  return m ? { ascent: m.asc / 1000, descent: m.desc / 1000 } : { ascent: 0.8, descent: 0.2 };
}
