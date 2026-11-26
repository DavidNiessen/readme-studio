/** Small helpers shared by the batch-D data widgets. */
import { monthName } from "../lib/astro";
import { esc } from "../lib/escape";
import { fitText, label, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { glyph, type GlyphName } from "./parts";

/** Option value as a trimmed string (anything else → fallback). */
export function optStr(v: unknown, d = ""): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : d;
}

/** Option value as a finite number clamped to [lo, hi]. */
export function optNum(v: unknown, d: number, lo = -Infinity, hi = Infinity): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
}

/** One of a fixed set of values. */
export function optPick<T extends string>(v: unknown, list: readonly T[], d: T): T {
  return list.includes(v as T) ? (v as T) : d;
}

/** Option value as an array of non-empty strings. */
export function optList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => optStr(x)).filter(Boolean) : [];
}

/** Toggle with a default for missing values. */
export function optBool(v: unknown, d: boolean): boolean {
  return typeof v === "boolean" ? v : d;
}

/** "Mar 4" from YYYY-MM-DD. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${monthName(m)} ${d}` : "";
}

/** "Mar 4, 2025" from YYYY-MM-DD. */
export function longDate(iso: string): string {
  const [y] = iso.split("-").map(Number);
  const s = shortDate(iso);
  return s && y ? `${s}, ${y}` : s;
}

/** Date range that drops the repeated year: "Mar 4 – Apr 2, 2026" / "Dec 28, 2025 – Jan 3, 2026". */
export function dateRange(a: string, b: string, today?: string): string {
  if (!a || !b) return "";
  const end = today && b === today ? "today" : null;
  if (a === b) return end ? "today" : longDate(a);
  if (end) return `${a.slice(0, 4) === today!.slice(0, 4) ? shortDate(a) : longDate(a)} – today`;
  if (a.slice(0, 4) === b.slice(0, 4)) return `${shortDate(a)} – ${shortDate(b)}, ${a.slice(0, 4)}`;
  return `${longDate(a)} – ${longDate(b)}`;
}

/** 1234 → "1.2k", 12500 → "12.5k", 1_200_000 → "1.2M". */
export function compact(n: number): string {
  const a = Math.abs(n);
  const f = (v: number, u: string) => `${Number(v.toFixed(v < 10 ? 1 : 0))}${u}`;
  if (a >= 1e6) return f(n / 1e6, "M");
  if (a >= 1e3) return f(n / 1e3, "k");
  return String(Math.round(n));
}

/** Standard card header: pulsing label on the left, muted summary on the right. */
export function header(t: Theme, width: number, text: string, right = "", rightMax = 0): string {
  const l = text ? label(t, 24, 30, text) : "";
  if (!right) return l;
  const labelW = text ? 16 + textWidth(t, text.toUpperCase(), 12, { bold: true, letterSpacing: 2 }) + 24 : 0;
  const max = rightMax || width - 48 - labelW;
  const r = fitText(t, right, 11.5, max);
  return `${l}<text x="${width - 24}" y="30" font-size="11.5" text-anchor="end" class="m fade" style="animation-delay:.3s">${esc(r)}</text>`;
}

/** A calm, centred empty state inside a dashed well. */
export function emptyState(t: Theme, x: number, y: number, w: number, h: number, g: GlyphName, title: string, sub = ""): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const tt = fitText(t, title, 13, w - 32, { bold: true });
  const ss = sub ? fitText(t, sub, 11, w - 32) : "";
  const top = cy - (ss ? 26 : 18);
  return `<g class="in" style="animation-delay:.2s">
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.max(4, t.radius - 2)}" fill="${t.raised}" fill-opacity=".5" stroke="${t.border}" stroke-dasharray="4 4"/>
${glyph(g, cx - 9, top, 18, t.subtle)}
<text x="${cx}" y="${top + 38}" font-size="13" text-anchor="middle" class="t b">${esc(tt)}</text>
${ss ? `<text x="${cx}" y="${top + 56}" font-size="11" text-anchor="middle" class="m">${esc(ss)}</text>` : ""}
</g>`;
}

/** Tabular figures, so rolling odometer digits sit centred in their fixed-width slots in proportional fonts. */
export const TNUM = ".tn text{font-variant-numeric:tabular-nums}";

/** Inline style for a delayed entrance. */
export function dl(s: number): string {
  return `animation-delay:${s.toFixed(2)}s`;
}

/** Pill: rounded rect with centred text; returns markup and width. */
export function pill(
  t: Theme,
  x: number,
  y: number,
  text: string,
  o: { size?: number; fill?: string; stroke?: string; color?: string; bold?: boolean; padX?: number; h?: number; anchor?: "start" | "end" } = {},
): { svg: string; w: number } {
  const size = o.size ?? 10.5;
  const padX = o.padX ?? 8;
  const h = o.h ?? 18;
  const w = textWidth(t, text, size, { bold: o.bold }) + padX * 2;
  const x0 = o.anchor === "end" ? x - w : x;
  const stroke = o.stroke ? ` stroke="${o.stroke}"` : "";
  return {
    w,
    svg: `<rect x="${x0.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="${h / 2}" fill="${o.fill ?? "none"}"${stroke}/><text x="${(x0 + w / 2).toFixed(1)}" y="${(y + h / 2 + size * 0.36).toFixed(1)}" font-size="${size}" text-anchor="middle" fill="${o.color ?? t.text}"${o.bold ? ' class="b"' : ""}>${esc(text)}</text>`,
  };
}
