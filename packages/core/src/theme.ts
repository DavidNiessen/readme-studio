import { adjust, isHex, mix, toHsl, fromHsl } from "./lib/color";

export type Mode = "dark" | "light";
export const MODES: Mode[] = ["dark", "light"];

export type Texture = "dots" | "grid" | "lines" | "none";
export type Motion = "full" | "subtle" | "off";

/** Colour tokens every widget draws with. */
export interface Palette {
  /** page / outer background (what GitHub shows around cards) */
  bg: string;
  /** card surface */
  card: string;
  /** raised element on a card */
  raised: string;
  border: string;
  text: string;
  muted: string;
  subtle: string;
  accent: string;
  /** brighter accent used for highlights and glows */
  glow: string;
  /** secondary accent for charts and contrast details */
  accent2: string;
  /** contribution heat scale, level 0..4 */
  heat: [string, string, string, string, string];
}

export const PALETTE_KEYS: (keyof Omit<Palette, "heat">)[] = ["bg", "card", "raised", "border", "text", "muted", "subtle", "accent", "glow", "accent2"];

export interface ThemeSettings {
  /** palette preset id */
  preset: string;
  /** when set, palettes are generated from this accent instead of the preset */
  accent?: string;
  /** per-mode token overrides on top of the preset */
  overrides?: { dark?: Partial<Palette>; light?: Partial<Palette> };
  /** body font id */
  font: string;
  /** display/heading font id */
  headingFont: string;
  /** card corner radius in px */
  radius: number;
  /** card border width in px (0 = borderless) */
  border: number;
  texture: Texture;
  motion: Motion;
  /** draw card backgrounds (false = transparent cards that blend into GitHub) */
  surface: boolean;
}

export interface Theme extends Palette {
  /** colour scheme of this theme instance */
  name: Mode;
  font: string;
  headingFont: string;
  radius: number;
  border: string;
  borderWidth: number;
  texture: Texture;
  motion: Motion;
  surface: boolean;
}

export const DEFAULT_THEME: ThemeSettings = {
  preset: "crimson",
  font: "jetbrains-mono",
  headingFont: "jetbrains-mono",
  radius: 12,
  border: 1,
  texture: "dots",
  motion: "full",
  surface: true,
};

function heatFrom(card: string, accent: string, glow: string, mode: Mode): Palette["heat"] {
  if (mode === "dark") return [mix(card, "#ffffff", 0.04), mix(card, accent, 0.3), mix(card, accent, 0.55), mix(card, accent, 0.82), glow];
  return ["#ebedf0", mix("#ffffff", accent, 0.28), mix("#ffffff", accent, 0.58), accent, adjust(accent, { l: -0.14 })];
}

/**
 * Build a complete palette from a single accent colour.
 * `tint` is the hue used for the neutrals (defaults to a faint pull toward the accent).
 */
export function deriveFromAccent(accent: string, mode: Mode, tint?: { h: number; s: number }): Palette {
  const a = isHex(accent) ? accent : "#dc2626";
  const ah = toHsl(a);
  const nh = tint?.h ?? ah.h;
  const ns = tint?.s ?? Math.min(0.1, ah.s * 0.12);
  const n = (l: number, s = ns) => fromHsl({ h: nh, s, l });
  if (mode === "dark") {
    const card = n(0.09);
    const glow = fromHsl({ h: ah.h, s: Math.min(1, ah.s + 0.05), l: Math.min(0.72, ah.l + 0.1) });
    return {
      bg: n(0.055),
      card,
      raised: n(0.135),
      border: n(0.16),
      text: n(0.97, ns * 0.5),
      muted: n(0.56, ns * 0.8),
      subtle: n(0.26),
      accent: a,
      glow,
      accent2: fromHsl({ h: ah.h + 40, s: ah.s * 0.8, l: 0.62 }),
      heat: heatFrom(card, a, glow, "dark"),
    };
  }
  const card = n(0.982, ns * 0.6);
  return {
    bg: "#ffffff",
    card,
    raised: n(0.955, ns * 0.6),
    border: n(0.9, ns * 0.6),
    text: n(0.1),
    muted: n(0.45, ns * 0.8),
    subtle: n(0.83, ns * 0.6),
    accent: a,
    glow: adjust(a, { l: -0.1 }),
    accent2: fromHsl({ h: ah.h + 40, s: ah.s * 0.8, l: 0.42 }),
    heat: heatFrom(card, a, a, "light"),
  };
}

export interface PalettePreset {
  id: string;
  name: string;
  description: string;
  dark: Palette;
  light: Palette;
}

type Partialish = Partial<Palette> & { accent: string };

function preset(id: string, name: string, description: string, dark: Partialish, light: Partialish, tint?: { h: number; s: number }): PalettePreset {
  const d = { ...deriveFromAccent(dark.accent, "dark", tint), ...dark };
  const l = { ...deriveFromAccent(light.accent, "light", tint), ...light };
  if (!dark.heat) d.heat = heatFrom(d.card, d.accent, d.glow, "dark");
  if (!light.heat) l.heat = heatFrom(l.card, l.accent, l.glow, "light");
  return { id, name, description, dark: d, light: l };
}

export const palettePresets: PalettePreset[] = [
  preset(
    "crimson",
    "Crimson",
    "Signal red on graphite. The original command-center look.",
    {
      bg: "#0d0d0f",
      card: "#18181b",
      raised: "#242427",
      border: "#27272a",
      text: "#fafafa",
      muted: "#8b8b8f",
      subtle: "#3f3f46",
      accent: "#dc2626",
      glow: "#ef4444",
      accent2: "#f59e0b",
      heat: ["#1e1e20", "#4c1515", "#7f1d1d", "#b91c1c", "#ef4444"],
    },
    {
      bg: "#ffffff",
      card: "#fafafa",
      raised: "#f4f4f5",
      border: "#e4e4e7",
      text: "#18181b",
      muted: "#71717a",
      subtle: "#d4d4d8",
      accent: "#dc2626",
      glow: "#b91c1c",
      accent2: "#d97706",
      heat: ["#ebedf0", "#fecaca", "#f87171", "#dc2626", "#991b1b"],
    },
  ),
  preset(
    "github",
    "GitHub",
    "Native GitHub surfaces with the familiar green graph.",
    {
      bg: "#0d1117",
      card: "#151b23",
      raised: "#1f2630",
      border: "#2a313c",
      text: "#f0f6fc",
      muted: "#9198a1",
      subtle: "#3d444d",
      accent: "#2f81f7",
      glow: "#58a6ff",
      accent2: "#3fb950",
      heat: ["#1b2129", "#033a16", "#196c2e", "#2ea043", "#56d364"],
    },
    {
      bg: "#ffffff",
      card: "#f6f8fa",
      raised: "#eff2f5",
      border: "#d1d9e0",
      text: "#1f2328",
      muted: "#59636e",
      subtle: "#d1d9e0",
      accent: "#0969da",
      glow: "#0550ae",
      accent2: "#1a7f37",
      heat: ["#eff2f5", "#aceebb", "#4ac26b", "#2da44e", "#116329"],
    },
  ),
  preset(
    "paper",
    "Paper",
    "Warm off-white stock and ink-blue accents. Editorial and calm.",
    {
      bg: "#121110",
      card: "#1a1918",
      raised: "#23211f",
      border: "#2c2a27",
      text: "#f2efe9",
      muted: "#9a958c",
      subtle: "#3d3a35",
      accent: "#7aa2ff",
      glow: "#a3bfff",
      accent2: "#e0b070",
    },
    {
      bg: "#ffffff",
      card: "#faf8f3",
      raised: "#f2efe7",
      border: "#e5e0d5",
      text: "#1c1a17",
      muted: "#6f6a60",
      subtle: "#d8d2c4",
      accent: "#2747d0",
      glow: "#1b3299",
      accent2: "#b4651e",
    },
    { h: 40, s: 0.08 },
  ),
  preset(
    "mono",
    "Monochrome",
    "Pure greyscale. Lets typography and motion do the talking.",
    {
      bg: "#0a0a0a",
      card: "#141414",
      raised: "#1f1f1f",
      border: "#262626",
      text: "#fafafa",
      muted: "#8a8a8a",
      subtle: "#3a3a3a",
      accent: "#fafafa",
      glow: "#ffffff",
      accent2: "#a3a3a3",
      heat: ["#1c1c1c", "#3a3a3a", "#6b6b6b", "#a8a8a8", "#f5f5f5"],
    },
    {
      bg: "#ffffff",
      card: "#fafafa",
      raised: "#f2f2f2",
      border: "#e5e5e5",
      text: "#0a0a0a",
      muted: "#6b6b6b",
      subtle: "#d4d4d4",
      accent: "#0a0a0a",
      glow: "#262626",
      accent2: "#737373",
      heat: ["#ededed", "#c7c7c7", "#8f8f8f", "#525252", "#0a0a0a"],
    },
    { h: 0, s: 0 },
  ),
  preset(
    "ember",
    "Ember",
    "Glowing orange on charcoal, like a forge at night.",
    { accent: "#f97316", glow: "#fb923c", accent2: "#facc15" },
    { accent: "#ea580c", accent2: "#ca8a04" },
    { h: 25, s: 0.06 },
  ),
  preset(
    "amber",
    "Amber CRT",
    "Phosphor amber, scanlines optional. Retro terminal energy.",
    { bg: "#0b0904", card: "#14100a", raised: "#1d1810", border: "#2a2215", text: "#ffd78a", muted: "#b08a46", subtle: "#4a3b20", accent: "#ffb000", glow: "#ffc940", accent2: "#ff7a1a" },
    { bg: "#ffffff", card: "#fdf8ec", raised: "#f8efd9", border: "#ecdcb8", text: "#3b2a06", muted: "#8a6a2e", subtle: "#e3cfa2", accent: "#c27c00", glow: "#995f00", accent2: "#c2410c" },
    { h: 40, s: 0.3 },
  ),
  preset(
    "forest",
    "Forest",
    "Moss and canopy greens with soft, earthy neutrals.",
    { accent: "#4ade80", glow: "#86efac", accent2: "#facc15" },
    { accent: "#15803d", accent2: "#a16207" },
    { h: 150, s: 0.08 },
  ),
  preset(
    "ocean",
    "Ocean",
    "Deep navy with a sharp cyan current.",
    { bg: "#060b14", card: "#0c1420", raised: "#131e2e", border: "#1a2739", text: "#e6f1ff", muted: "#7d8fa8", subtle: "#2a3a52", accent: "#22d3ee", glow: "#67e8f9", accent2: "#818cf8" },
    { accent: "#0891b2", accent2: "#4f46e5" },
    { h: 215, s: 0.3 },
  ),
  preset(
    "nord",
    "Nord",
    "Arctic, north-bluish calm from the Nord palette.",
    { bg: "#242933", card: "#2e3440", raised: "#3b4252", border: "#434c5e", text: "#eceff4", muted: "#a3adbf", subtle: "#4c566a", accent: "#88c0d0", glow: "#8fbcbb", accent2: "#ebcb8b" },
    { bg: "#ffffff", card: "#eceff4", raised: "#e5e9f0", border: "#d8dee9", text: "#2e3440", muted: "#5e6779", subtle: "#c5ccd8", accent: "#5e81ac", glow: "#4c6a91", accent2: "#d08770" },
  ),
  preset(
    "gruvbox",
    "Gruvbox",
    "Retro groove: warm, high-legibility contrast.",
    { bg: "#1d2021", card: "#282828", raised: "#32302f", border: "#3c3836", text: "#ebdbb2", muted: "#a89984", subtle: "#504945", accent: "#fe8019", glow: "#fabd2f", accent2: "#b8bb26" },
    { bg: "#ffffff", card: "#fbf1c7", raised: "#f2e5bc", border: "#ebdbb2", text: "#3c3836", muted: "#7c6f64", subtle: "#d5c4a1", accent: "#af3a03", glow: "#9d0006", accent2: "#79740e" },
  ),
  preset(
    "solarized",
    "Solarized",
    "Precision colours for machines and people.",
    { bg: "#00212b", card: "#002b36", raised: "#073642", border: "#0d4150", text: "#eee8d5", muted: "#839496", subtle: "#24505c", accent: "#b58900", glow: "#d0a215", accent2: "#2aa198" },
    { bg: "#ffffff", card: "#fdf6e3", raised: "#eee8d5", border: "#e4dcc4", text: "#073642", muted: "#657b83", subtle: "#d9d0b6", accent: "#268bd2", glow: "#1a6ea8", accent2: "#cb4b16" },
  ),
  preset(
    "tokyo",
    "Tokyo Night",
    "Neon-lit city blues after the last train.",
    { bg: "#16161e", card: "#1a1b26", raised: "#24283b", border: "#292e42", text: "#c0caf5", muted: "#787c99", subtle: "#3b4261", accent: "#7aa2f7", glow: "#7dcfff", accent2: "#bb9af7" },
    { bg: "#ffffff", card: "#e9e9ed", raised: "#e1e2e7", border: "#d0d1d8", text: "#343b58", muted: "#6c6e75", subtle: "#c4c5cc", accent: "#2e7de9", glow: "#1d5fc0", accent2: "#9854f1" },
  ),
  preset(
    "dracula",
    "Dracula",
    "The classic dark theme with candy accents.",
    { bg: "#21222c", card: "#282a36", raised: "#343746", border: "#3c3f51", text: "#f8f8f2", muted: "#9ea8c7", subtle: "#4d5066", accent: "#ff79c6", glow: "#ff92d0", accent2: "#bd93f9" },
    { bg: "#ffffff", card: "#f8f8f2", raised: "#efefe8", border: "#e2e2da", text: "#282a36", muted: "#6272a4", subtle: "#d6d6ce", accent: "#c4307f", glow: "#a01f66", accent2: "#7a4fd6" },
  ),
  preset(
    "mocha",
    "Catppuccin",
    "Soothing pastels: Mocha by night, Latte by day.",
    { bg: "#181825", card: "#1e1e2e", raised: "#313244", border: "#313244", text: "#cdd6f4", muted: "#a6adc8", subtle: "#45475a", accent: "#cba6f7", glow: "#f5c2e7", accent2: "#fab387" },
    { bg: "#ffffff", card: "#eff1f5", raised: "#e6e9ef", border: "#dce0e8", text: "#4c4f69", muted: "#6c6f85", subtle: "#ccd0da", accent: "#8839ef", glow: "#7029d6", accent2: "#fe640b" },
  ),
  preset(
    "rose",
    "Rosé",
    "Soho vibes: muted roses, pine and gold.",
    { bg: "#191724", card: "#1f1d2e", raised: "#26233a", border: "#2a2740", text: "#e0def4", muted: "#908caa", subtle: "#403d52", accent: "#eb6f92", glow: "#ebbcba", accent2: "#f6c177" },
    { bg: "#ffffff", card: "#faf4ed", raised: "#f2e9e1", border: "#e9dfd6", text: "#433f63", muted: "#6e6a88", subtle: "#dfdad9", accent: "#b4637a", glow: "#94475e", accent2: "#ea9d34" },
  ),
  preset(
    "ultraviolet",
    "Ultraviolet",
    "Electric violet and lime for the loud ones.",
    { accent: "#a78bfa", glow: "#c4b5fd", accent2: "#a3e635" },
    { accent: "#7c3aed", accent2: "#4d7c0f" },
    { h: 260, s: 0.12 },
  ),
  preset(
    "sakura",
    "Sakura",
    "Cherry-blossom pink on soft plum.",
    { accent: "#f472b6", glow: "#f9a8d4", accent2: "#fbbf24" },
    { accent: "#db2777", accent2: "#b45309" },
    { h: 330, s: 0.08 },
  ),
];

export function getPalettePreset(id: string): PalettePreset {
  return palettePresets.find((p) => p.id === id) ?? palettePresets[0];
}

function cleanPartial(p: Partial<Palette> | undefined): Partial<Palette> {
  const out: Partial<Palette> = {};
  if (!p) return out;
  for (const k of PALETTE_KEYS) {
    const v = p[k];
    if (isHex(v)) out[k] = v;
  }
  if (Array.isArray(p.heat) && p.heat.length === 5 && p.heat.every(isHex)) out.heat = p.heat;
  return out;
}

/** The palette for a mode, after preset, accent generation and overrides. */
export function resolvePalette(s: ThemeSettings, mode: Mode): Palette {
  const base = s.accent && isHex(s.accent) ? deriveFromAccent(s.accent, mode) : getPalettePreset(s.preset)[mode];
  const ov = cleanPartial(s.overrides?.[mode]);
  // `bg` is the page around the images, i.e. GitHub's own background, unless explicitly overridden
  const merged = { ...base, bg: mode === "dark" ? "#0d1117" : "#ffffff", ...ov };
  // regenerate the heat scale when the accent changed but no explicit heat was given
  if ((ov.accent || ov.card) && !ov.heat) merged.heat = heatFrom(merged.card, merged.accent, merged.glow, mode);
  return merged;
}

export function resolveTheme(s: ThemeSettings, mode: Mode): Theme {
  const p = resolvePalette(s, mode);
  return {
    ...p,
    name: mode,
    font: s.font,
    headingFont: s.headingFont,
    radius: Math.max(0, Math.min(32, s.radius)),
    borderWidth: Math.max(0, Math.min(4, s.border)),
    texture: s.texture,
    motion: s.motion,
    surface: s.surface,
  };
}
