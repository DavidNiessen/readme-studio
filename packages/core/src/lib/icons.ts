import { iconData, type IconData } from "../icons/data";
import { imageSvg, isImageData } from "./images";

export interface Icon {
  id: string;
  title: string;
  inner: string;
  viewBox: string;
  /** brand colour, or null for multi-colour icons that keep their own colours */
  color: string | null;
}

/** Brands loaded on demand (see loadMoreIcons), added to the built-in ones. */
const more: Record<string, IconData> = {};
let moreVersion = 0;
let moreLoading: Promise<void> | null = null;

const lookup = (id: string): IconData | undefined => iconData[id] ?? more[id];

/**
 * Loads the larger brand set: several hundred more logos. Renderers that may meet them (the
 * action, the CLI, the studio) call this first; a page that only shows built-in designs need not.
 */
export function loadMoreIcons(): Promise<void> {
  moreLoading ??= import("../icons/more").then((m) => {
    Object.assign(more, m.moreIconData);
    moreVersion++;
  });
  return moreLoading;
}

/** True once loadMoreIcons has finished. */
export function moreIconsLoaded(): boolean {
  return moreVersion > 0;
}

/** Changes when more icons arrive, for caches of rendered output. */
export function iconsVersion(): number {
  return moreVersion;
}

export function hasIcon(id: string): boolean {
  return isImageData(id) || lookup(id) !== undefined;
}

/** An uploaded image as an icon: drawn in a 24 box, in its own colours. */
function imageIcon(href: string): Icon {
  return {
    id: href,
    title: "Uploaded image",
    inner: imageSvg(href, 0, 0, 24),
    viewBox: "0 0 24 24",
    color: null,
  };
}

function toIcon(id: string, d: IconData): Icon {
  return { id, title: d.t, inner: d.b, viewBox: d.v, color: d.c === "multi" ? null : d.c };
}

/** Icon by id; unknown ids get the generic code glyph. */
export function icon(id: string): Icon {
  if (isImageData(id)) return imageIcon(id);
  const key = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  const found = lookup(id) ? id : lookup(key) ? key : "code";
  return toIcon(found, lookup(found) ?? iconData.code);
}

export function iconList(): Icon[] {
  return [...Object.entries(iconData), ...Object.entries(more)].sort(([a], [b]) => a.localeCompare(b)).map(([id, d]) => toIcon(id, d));
}

/** Render an icon as a nested <svg> at (x, y). `fill` overrides the brand colour; "brand" keeps it. */
export function iconSvg(id: string, x: number, y: number, size: number, fill?: string, extra = ""): string {
  const i = icon(id);
  const color = fill && fill !== "brand" ? fill : (i.color ?? "#8b8b8f");
  return `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size}" height="${size}" viewBox="${i.viewBox}" color="${color}" ${extra}>${i.inner}</svg>`;
}

/** Brand colours that are too dark/light for a background get swapped for the text colour. */
export function legibleBrand(id: string, bg: string, text: string, lum: (c: string) => number): string {
  const c = icon(id).color;
  if (!c) return text;
  const a = lum(c);
  const b = lum(bg);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio < 1.6 ? text : c;
}
