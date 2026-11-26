import { DEFAULT_OUTPUT, DEFAULT_PROFILE, normalizeConfig, type Align, type Profile, type StudioConfig } from "./config";
import { DEFAULT_THEME, type ThemeSettings } from "./theme";

type B = { type: string; id?: string; options?: Record<string, unknown>; link?: string };
type R = B[] | { align: Align; blocks: B[] };

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  theme: Partial<ThemeSettings>;
  rows: R[];
}

export const layoutPresets: LayoutPreset[] = [
  {
    id: "command-center",
    name: "Command Center",
    description: "Everything, animated: hero, live stats, contribution graph and a build-stamped footer.",
    tags: ["dark", "data", "animated"],
    theme: { preset: "crimson", font: "jetbrains-mono", headingFont: "jetbrains-mono", texture: "dots" },
    rows: [[{ type: "hero" }], [{ type: "socials" }], [{ type: "divider" }], [{ type: "stats" }], [{ type: "contrib" }], [{ type: "footer" }]],
  },
];

export function getLayoutPreset(id: string): LayoutPreset {
  return layoutPresets.find((p) => p.id === id) ?? layoutPresets[0];
}

/** A complete, normalised config for a preset, with the given profile fields merged in. */
export function presetConfig(id: string, profile: Partial<Profile> = {}): StudioConfig {
  const p = getLayoutPreset(id);
  const raw = {
    profile: { ...DEFAULT_PROFILE, ...profile },
    theme: { ...DEFAULT_THEME, ...p.theme },
    layout: p.rows.map((r) => (Array.isArray(r) ? { align: "center", blocks: r } : r)),
    output: DEFAULT_OUTPUT,
  };
  return normalizeConfig(raw).config;
}
