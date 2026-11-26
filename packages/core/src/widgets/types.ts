import type { DesignKind, Profile, ProjectInfo } from "../config";
import type { Derived } from "../data/derive";
import type { ProfileData } from "../data/types";
import type { LocalDate } from "../lib/astro";
import type { Theme } from "../theme";

export interface Ctx {
  theme: Theme;
  data: ProfileData;
  d: Derived;
  /** wall-clock fields in the profile's time zone */
  now: LocalDate;
  date: Date;
  profile: Profile;
  /** what the README is for */
  kind: DesignKind;
  /** project settings (meaningful when kind is "project") */
  project: ProjectInfo;
  /** GitHub Actions run number, when available */
  run: string | null;
}

// ------------------------------------------------------------ inspector fields

interface FieldBase {
  key: string;
  label: string;
  help?: string;
  /** only show when another option has this value */
  when?: { key: string; is: unknown[] };
}

export type Field =
  | (FieldBase & { type: "text"; placeholder?: string; multiline?: boolean; max?: number; /** visible lines of a multiline field */ rows?: number })
  | (FieldBase & { type: "number"; min: number; max: number; step?: number; unit?: string })
  | (FieldBase & { type: "toggle" })
  | (FieldBase & { type: "select"; options: { value: string; label: string }[] })
  | (FieldBase & { type: "segmented"; options: { value: string; label: string }[] })
  | (FieldBase & { type: "color"; allowTheme?: boolean })
  | (FieldBase & { type: "icon" })
  | (FieldBase & { type: "tags"; placeholder?: string; max?: number })
  | (FieldBase & { type: "checklist"; options: { value: string; label: string }[]; max?: number })
  | (FieldBase & { type: "list"; item: Field[]; itemLabel: string; titleKey: string; max?: number; newItem: Record<string, unknown> });

export type FieldType = Field["type"];

// ------------------------------------------------------------ widget definition

export type WidgetCategory = "Header" | "Identity" | "Stats" | "Activity" | "Projects" | "Content" | "Decoration";

export const CATEGORIES: { id: WidgetCategory; blurb: string }[] = [
  { id: "Header", blurb: "Big opening statements" },
  { id: "Identity", blurb: "Who you are and where to find you" },
  { id: "Stats", blurb: "Numbers that update every night" },
  { id: "Activity", blurb: "Contribution graphs and rhythms" },
  { id: "Projects", blurb: "Repositories, releases and writing" },
  { id: "Content", blurb: "Text, quotes and markdown" },
  { id: "Decoration", blurb: "Dividers, footers and flourishes" },
];

export type WidgetWidth = "full" | "half" | "third";

export interface AssetPart {
  /** suffix appended to the block id for this part's file name */
  key: string;
  alt: string;
  href?: string;
}

export interface GifFrames {
  width: number;
  height: number;
  frames: { svg: string; delay: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Options = Record<string, any>;

export interface WidgetDef<O extends Options = Options> {
  type: string;
  title: string;
  description: string;
  category: WidgetCategory;
  /** svg: animated SVG image; gif: rasterised animation; markdown: emitted as real markdown */
  kind: "svg" | "gif" | "markdown";
  /** suggested width in a row */
  width: WidgetWidth;
  /** which kinds of README the widget suits (default: both) */
  scope?: DesignKind | "any";
  /** fixed-height pills (rendered with height instead of a percentage width) */
  fixedHeight?: number;
  /** data sources the widget reads; drives fetch work in the action */
  needs?: ("calendar" | "repos" | "events" | "weather" | "languages" | "hours" | "releases" | "feed" | "project" | "stars" | "contributors" | "downloads")[];
  defaults: O;
  fields: Field[];
  alt(ctx: Pick<Ctx, "profile" | "data" | "project" | "kind">, o: O): string;
  /** default link target */
  href?(ctx: Pick<Ctx, "profile" | "data" | "project" | "kind">, o: O): string | undefined;
  /** svg markup (kind svg), markdown (kind markdown), or a static preview frame (kind gif) */
  render(ctx: Ctx, o: O): string;
  /** animation frames, for kind gif */
  frames?(ctx: Ctx, o: O): GifFrames;
  /** widgets that emit several images (e.g. one per social link) */
  parts?(ctx: Pick<Ctx, "profile" | "data" | "project" | "kind">, o: O): AssetPart[];
  renderPart?(ctx: Ctx, o: O, key: string): string;
}

/** Identity helper that type-checks a widget declaration. */
/** Whether a widget belongs in the library for a kind of README. */
export function widgetFits(def: Pick<WidgetDef, "scope">, kind: DesignKind): boolean {
  return !def.scope || def.scope === "any" || def.scope === kind;
}

export function defineWidget(def: WidgetDef): WidgetDef {
  return def;
}
