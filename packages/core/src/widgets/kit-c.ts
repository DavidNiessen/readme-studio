/** Small helpers shared by the batch-C content widgets. */
import { contrast, isHex } from "../lib/color";
import { hasIcon, icon, iconSvg } from "../lib/icons";
import { esc } from "../lib/escape";
import { textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { glyph, glyphs, type GlyphName } from "./parts";

/** Option value as a trimmed string (anything else → fallback). */
export function str(v: unknown, d = ""): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : d;
}

/** Option value as a finite number clamped to [lo, hi]. */
export function numOpt(v: unknown, d: number, lo = -Infinity, hi = Infinity): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
}

/** Option value as an array of plain objects. */
export function items(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x)) : [];
}

/** Option value as an array of non-empty strings. */
export function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
}

/** One of a fixed set of values. */
export function pick<T extends string>(v: unknown, list: readonly T[], d: T): T {
  return list.includes(v as T) ? (v as T) : d;
}

export function isGlyph(id: string): id is GlyphName {
  return Object.prototype.hasOwnProperty.call(glyphs, id);
}

/** True when the id names either a line glyph or a brand icon. */
export function hasMark(id: string): boolean {
  return !!id && (isGlyph(id) || hasIcon(id) || hasIcon(id.toLowerCase().replace(/[^a-z0-9]/g, "")));
}

/**
 * Draw a line glyph (pin, briefcase, …) or a brand icon (github, rust, …) in a size×size box.
 * `color` "brand" keeps the brand colour, made legible against `bg`.
 */
export function mark(t: Theme, id: string, x: number, y: number, size: number, color: string, bg = t.card, extra = ""): string {
  if (!hasMark(id)) return "";
  if (isGlyph(id)) return glyph(id, x, y, size, color === "brand" ? t.accent : color, extra);
  let c = color;
  if (color === "brand") {
    const b = icon(id).color;
    c = b && contrast(b, bg) >= 1.7 ? b : t.text;
  }
  return iconSvg(id, x, y, size, c, extra);
}

/**
 * A hero emblem: a line glyph or a brand icon painted with `paint` (a colour or a gradient url)
 * in a size×size box. The icon picker offers both kinds, so both must draw.
 */
export function emblemMark(id: string, x: number, y: number, size: number, paint: string): string {
  if (isGlyph(id)) return glyph(id, x, y, size, paint);
  const em = icon(hasIcon(id) ? id : id.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${em.viewBox}">${em.inner.replace(/fill="currentColor"/g, `fill="${paint}"`)}</svg>`;
}

/** User colour override, or the fallback when empty/invalid. */
export function colorOr(v: unknown, d: string): string {
  return isHex(v) ? (v as string) : d;
}

/** Initials for a monogram ("Mona Octocat" → "MO"). */
export function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join("").toUpperCase();
  return ([...parts[0]][0] + [...parts[parts.length - 1]][0]).toUpperCase();
}

/** Fixed-decimal number for attributes. */
export function n1(v: number): string {
  return Number(v.toFixed(1)).toString();
}

/** Semantic status colours that read on both schemes. */
export function statusColor(t: Theme, status: "open" | "busy" | "away"): string {
  const dark = t.name === "dark";
  if (status === "open") return dark ? "#22c55e" : "#16a34a";
  if (status === "busy") return dark ? "#f59e0b" : "#d97706";
  return dark ? "#ef4444" : "#dc2626";
}

/** Centred empty-state hint: a small accent glyph followed by a muted line, measured as one group. */
export function emptyHint(t: Theme, cx: number, baseline: number, g: GlyphName, text: string): string {
  const tw = textWidth(t, text, 13);
  const x0 = cx - (16 + 10 + tw) / 2;
  return `<g class="in" style="animation-delay:.2s">${glyph(g, x0, baseline - 12.5, 16, t.accent)}<text x="${n1(x0 + 26)}" y="${baseline}" font-size="13" class="m">${esc(text)}</text></g>`;
}
