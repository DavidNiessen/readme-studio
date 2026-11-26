/** Small helpers shared by the batch-E repository widgets. */
import type { ProjectView } from "./types";
import type { ProjectData, ProfileData, Release } from "../data/types";
import { fontInfo, fontStack, measureText } from "../fonts";
import { fromHsl } from "../lib/color";
import { esc } from "../lib/escape";
import { fitText, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { emptyState } from "./kit-d";
import { hash01, onAccent } from "./parts";

type MetaCtx = { data: ProfileData; project: ProjectView };

/** Repository data, when it has been fetched. */
export function pdata(ctx: { data: ProfileData }): ProjectData | undefined {
  const p = ctx.data?.project;
  return p && typeof p === "object" ? p : undefined;
}

/** https://github.com/owner/name for the README's repository. */
export function repoUrl(ctx: MetaCtx): string {
  const u = pdata(ctx)?.url;
  if (u) return u.replace(/\/$/, "");
  const repo = (ctx.project?.repo || "").trim();
  return repo ? `https://github.com/${repo}` : "https://github.com";
}

/** Homepage, falling back to the repository. */
export function homeUrl(ctx: MetaCtx): string {
  return (ctx.project?.homepage || "").trim() || (pdata(ctx)?.homepage || "").trim() || repoUrl(ctx);
}

/** owner/name label for the repository. */
export function repoSlug(ctx: MetaCtx): string {
  return (ctx.project?.repo || "").trim() || pdata(ctx)?.fullName || "";
}

/** Newest release by publish date. */
export function latestRelease(pd: ProjectData | undefined): Release | undefined {
  const list = (pd?.releases ?? []).filter((r) => r && r.tag);
  return [...list].sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))[0];
}

/** Latest version tag ("v2.4.0"), from releases or the package registry; "" when unknown. */
export function latestTag(pd: ProjectData | undefined): string {
  const tag = latestRelease(pd)?.tag || pd?.downloads?.find((d) => d.version)?.version || "";
  return tag ? (/^\d/.test(tag) ? `v${tag}` : tag) : "";
}

export type CiStatus = "passing" | "failing" | "running" | "unknown";

/** Status colours that read on both schemes (GitHub's own success / danger / attention hues). */
export function ciColor(t: Theme, s: CiStatus): string {
  const dark = t.name === "dark";
  if (s === "passing") return dark ? "#3fb950" : "#1a7f37";
  if (s === "failing") return dark ? "#f85149" : "#cf222e";
  if (s === "running") return dark ? "#d29922" : "#9a6700";
  return t.muted;
}

/** Solid fill for a status chip (deeper, so white text stays legible). */
export function ciFill(t: Theme, s: CiStatus): string {
  const dark = t.name === "dark";
  if (s === "passing") return dark ? "#238636" : "#1a7f37";
  if (s === "failing") return dark ? "#da3633" : "#cf222e";
  if (s === "running") return dark ? "#9e6a03" : "#9a6700";
  return t.subtle;
}

export function ciStatus(pd: ProjectData | undefined): CiStatus {
  const s = pd?.ci?.status;
  return s === "passing" || s === "failing" || s === "running" ? s : "unknown";
}

/** Stars gained in the last `days` days, from the star history (null when there is none). */
export function starsGained(pd: ProjectData | undefined, days: number, now: Date): number | null {
  const h = (pd?.starHistory ?? []).filter((p) => p && p.date && Number.isFinite(p.stars));
  if (!pd || !h.length) return null;
  const cut = now.getTime() - days * 86_400_000;
  const ts = h.map((p) => new Date(p.date).getTime());
  let at: number;
  if (cut <= ts[0]) at = 0;
  else if (cut >= ts[ts.length - 1]) at = h[h.length - 1].stars;
  else {
    let i = 0;
    while (i < ts.length - 1 && ts[i + 1] < cut) i++;
    const span = ts[i + 1] - ts[i] || 1;
    at = h[i].stars + ((h[i + 1].stars - h[i].stars) * (cut - ts[i])) / span;
  }
  return Math.max(0, Math.round(Math.max(pd.stars, h[h.length - 1].stars) - at));
}

/** Avatar is a safe, embeddable data: URI. */
export function isDataImage(s: unknown): s is string {
  return typeof s === "string" && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/.test(s);
}

/** Deterministic monogram colour for a login, with a legible text colour. */
export function monoColor(t: Theme, login: string): { fill: string; ink: string } {
  const h = hash01(login.toLowerCase(), 7) * 360;
  const fill = fromHsl({ h, s: t.name === "dark" ? 0.42 : 0.5, l: t.name === "dark" ? 0.36 : 0.6 });
  return { fill, ink: onAccent(t, fill) };
}

/** Initials for a login ("linus-t" → "LT", "octocat" → "OC"). */
export function loginInitials(login: string): string {
  const parts = login.replace(/\[bot\]$/, "").split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join("").toUpperCase();
  return ([...parts[0]][0] + [...parts[1]][0]).toUpperCase();
}

/**
 * Monospace text for commands and hashes. Uses the theme font when it is a mono face,
 * otherwise the system mono stack (measured with a 0.6 em advance, which mono faces share).
 */
export function mono(t: Theme): { family: string; measure: (text: string, size: number, bold?: boolean) => number; css: string } {
  const own = fontInfo(t.font).category === "mono";
  const id = own ? t.font : "jetbrains-mono";
  const family = own ? fontStack(t.font) : "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
  return { family, measure: (text, size, bold = false) => measureText(text, size, id, bold ? 700 : 400), css: `.mono{font-family:${family}}` };
}

/** Extra 16px line glyphs used by repository widgets (same drawing rules as parts.glyph). */
export const xglyphs = {
  scale: `<path d="M8 2v12M4.5 14h7M3 4.5h10M8 2.8 3 4.5m5-1.7 5 1.7M3 4.5 1.2 9a1.9 1.9 0 0 0 3.6 0zM13 4.5 11.2 9a1.9 1.9 0 0 0 3.6 0z"/>`,
  download: `<path d="M8 2v8m-3.5-3.5L8 10l3.5-3.5M2.5 11v1.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V11"/>`,
  pulse: `<path d="M1.5 8.5h3l1.8-4.5 3.2 8 1.8-3.5h3.2"/>`,
  merge: `<circle cx="4" cy="3.5" r="1.8"/><circle cx="4" cy="12.5" r="1.8"/><circle cx="12" cy="9" r="1.8"/><path d="M4 5.3v5.4M4 5.5c0 2.5 2.5 3.5 6.2 3.5"/>`,
  copy: `<rect x="5.5" y="5.5" width="8.5" height="8.5" rx="1.8"/><path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/>`,
  shield: `<path d="M8 1.5 13.5 3.5v4.2c0 3.3-2.3 5.7-5.5 6.8-3.2-1.1-5.5-3.5-5.5-6.8V3.5z"/><path d="m5.5 8 1.8 1.8L10.8 6"/>`,
  x: `<path d="m4.5 4.5 7 7m0-7-7 7"/>`,
};

export type XGlyph = keyof typeof xglyphs;

export function xglyph(name: XGlyph, x: number, y: number, size: number, color: string, extra = ""): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${xglyphs[name]}</svg>`;
}

/** Empty state used when no repository data has been fetched yet. */
export function noRepo(t: Theme, x: number, y: number, w: number, h: number, what: string): string {
  return emptyState(t, x, y, w, h, "repo", "No repository data yet", `${what} will appear after the first build.`);
}

/** Muted text fitted to a width (escaped). */
export function fitted(t: Theme, text: string, size: number, max: number, bold = false): string {
  return esc(fitText(t, text, size, max, { bold }));
}

/** Width of a measured string. */
export function tw(t: Theme, text: string, size: number, bold = false, letterSpacing = 0): number {
  return textWidth(t, text, size, { bold, letterSpacing });
}

/** Release date of a week index (0 = oldest of `n` weeks ending this week) as a Date. */
export function weekStart(now: Date, i: number, n: number): Date {
  const d = new Date(now.getTime());
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() - (n - 1 - i) * 7);
  return d;
}

/** Nice axis step (1, 2, 2.5, 5 × 10^k). */
export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** Catmull-Rom spline through points, control points clamped to [yMin, yMax]. */
export function smooth(pts: [number, number][], yMin: number, yMax: number, f: (n: number) => string): string {
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("");
  const c = (v: number) => Math.min(yMax, Math.max(yMin, v));
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const k = 1 / 6;
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(c(p1[1] + (p2[1] - p0[1]) * k))} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(c(p2[1] - (p3[1] - p1[1]) * k))} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/**
 * One contributor avatar centred at (cx, cy): the embedded data: image clipped to a circle
 * (or rounded square), or a monogram in a colour derived from the login.
 * `id` must be unique within the SVG; `ring` draws a hairline in the given colour.
 */
export function avatar(
  t: Theme,
  c: { login: string; avatar: string },
  cx: number,
  cy: number,
  r: number,
  id: string,
  o: { shape?: "circle" | "rounded"; ring?: string; ringWidth?: number; extra?: string } = {},
): string {
  const sq = o.shape === "rounded";
  const rr = sq ? Math.max(3, r * 0.42) : r;
  const box = (extra: string) =>
    sq
      ? `<rect x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" rx="${rr.toFixed(1)}" ${extra}/>`
      : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" ${extra}/>`;
  const ring = o.ring ? box(`stroke="${o.ring}" stroke-width="${o.ringWidth ?? 1}"`) : "";
  if (isDataImage(c.avatar)) {
    return `<g ${o.extra ?? ""}><clipPath id="${id}">${box("")}</clipPath>${box(`fill="${t.raised}"`)}<image href="${esc(c.avatar.replace(/\s+/g, ""))}" x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>${ring}</g>`;
  }
  const { fill, ink } = monoColor(t, c.login || "?");
  const ini = r < 14 ? [...loginInitials(c.login || "?")][0] : loginInitials(c.login || "?");
  const fs = r * (ini.length > 1 ? 0.72 : 0.9);
  return `<g ${o.extra ?? ""}>${box(`fill="${fill}"`)}<text x="${cx.toFixed(1)}" y="${(cy + fs * 0.35).toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="middle" fill="${ink}" class="b">${esc(ini)}</text>${ring}</g>`;
}

/** Monotone cubic (Fritsch–Carlson) path: never overshoots, so cumulative series never dip. */
export function monotone(pts: [number, number][], f: (n: number) => string): string {
  const n = pts.length;
  if (n < 3) return pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("");
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0] || 1e-6);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1e-6));
  }
  const tg: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  tg.push(m[n - 2]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f(pts[i][0] + h)} ${f(pts[i][1] + tg[i] * h)} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - tg[i + 1] * h)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`;
  }
  return d;
}
