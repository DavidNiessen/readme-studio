import { iconData, type IconData } from "../icons/data";

export interface Icon {
  id: string;
  title: string;
  inner: string;
  viewBox: string;
  /** brand colour, or null for multi-colour icons that keep their own colours */
  color: string | null;
}

export function hasIcon(id: string): boolean {
  return id in iconData;
}

function toIcon(id: string, d: IconData): Icon {
  return { id, title: d.t, inner: d.b, viewBox: d.v, color: d.c === "multi" ? null : d.c };
}

/** Icon by id; unknown ids get the generic code glyph. */
export function icon(id: string): Icon {
  const key = id.toLowerCase().replace(/[^a-z0-9]/g, "");
  const d = iconData[id] ?? iconData[key] ?? iconData.code;
  return toIcon(iconData[id] ? id : iconData[key] ? key : "code", d);
}

export function iconList(): Icon[] {
  return Object.entries(iconData).map(([id, d]) => toIcon(id, d));
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
