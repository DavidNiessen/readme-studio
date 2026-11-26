import { yearProgress } from "../lib/astro";
import { esc, groupDigits } from "../lib/escape";
import { odometer, odometerWidth } from "../lib/odometer";
import { card, label, svg } from "../lib/svg";
import { accentDeep, glyph, type GlyphName } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;

export const STAT_OPTIONS = [
  { value: "year", label: "Contributions this year" },
  { value: "allTime", label: "All-time contributions" },
  { value: "lastYear", label: "Contributions, last 12 months" },
  { value: "current", label: "Current streak" },
  { value: "longest", label: "Longest streak" },
  { value: "prs", label: "Pull requests" },
  { value: "stars", label: "Stars earned" },
  { value: "reviews", label: "Code reviews" },
  { value: "issues", label: "Issues opened" },
  { value: "commits", label: "Commits (last year)" },
  { value: "followers", label: "Followers" },
  { value: "repos", label: "Repositories" },
  { value: "active", label: "Active days" },
  { value: "best", label: "Best day" },
];

interface Tile {
  label: string;
  value: number;
  unit?: string;
  glyph: GlyphName;
  extra?: (x: number, y: number, w: number, h: number) => string;
}

/** Resolve a stat key to a tile; null when the data is unavailable. */
export function statTile(ctx: Ctx, key: string): Tile | null {
  const t = ctx.theme;
  const { data, d } = ctx;
  const weekly = d.weekly.slice(-10);
  const wMax = Math.max(1, ...weekly);
  const last7 = d.days.slice(-7);
  const spark = (x: number, y: number, w: number, h: number) => {
    const bw = 4;
    const gap = 2;
    const x0 = x + w - weekly.length * (bw + gap) - 12;
    return weekly
      .map((v, i) => {
        const bh = Math.max(2, (v / wMax) * 30);
        return `<rect x="${x0 + i * (bw + gap)}" y="${(y + h - 16 - bh).toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="1.5" fill="${i === weekly.length - 1 ? t.accent : t.subtle}" style="transform-origin:bottom;transform-box:fill-box;animation:grow .7s cubic-bezier(.2,.7,.2,1) ${(0.8 + i * 0.04).toFixed(2)}s both"/>`;
      })
      .join("");
  };
  const week = (x: number, y: number, w: number, h: number) =>
    last7
      .map((day, i) => {
        const s = 10;
        const cx = x + w - 7 * (s + 3) - 12 + i * (s + 3);
        return `<rect x="${cx}" y="${y + h - 16 - s}" width="${s}" height="${s}" rx="2.5" fill="${day.count > 0 ? t.heat[Math.max(2, day.level)] : t.heat[0]}" class="fx" style="animation:pop .5s ease ${(1 + i * 0.08).toFixed(2)}s both"/>`;
      })
      .join("");
  const n = (v: number | null | undefined) => (v === null || v === undefined ? null : v);
  switch (key) {
    case "year":
      return { label: `contributions ${ctx.now.year}`, value: data.yearTotal, glyph: "bolt", extra: spark };
    case "allTime":
      return { label: "all-time", value: data.allTimeTotal, glyph: "sigma" };
    case "lastYear":
      return { label: "last 12 months", value: data.lastYearTotal, glyph: "calendar", extra: spark };
    case "current":
      return { label: "current streak", value: d.streaks.current, unit: "d", glyph: "flame", extra: week };
    case "longest":
      return { label: "longest streak", value: d.streaks.longest, unit: "d", glyph: "trophy" };
    case "prs":
      return n(data.totals.pullRequests) === null ? null : { label: "pull requests", value: data.totals.pullRequests!, glyph: "pr" };
    case "stars":
      return n(data.totals.stars) === null ? null : { label: "stars earned", value: data.totals.stars!, glyph: "star" };
    case "reviews":
      return n(data.totals.reviews) === null ? null : { label: "code reviews", value: data.totals.reviews!, glyph: "eye" };
    case "issues":
      return n(data.totals.issues) === null ? null : { label: "issues opened", value: data.totals.issues!, glyph: "issue" };
    case "commits":
      return n(data.totals.commits) === null ? null : { label: "commits", value: data.totals.commits!, glyph: "commit" };
    case "followers":
      return { label: "followers", value: data.followers, glyph: "users" };
    case "repos":
      return { label: "repositories", value: data.repoCount, glyph: "repo" };
    case "active":
      return { label: "active days", value: d.active, glyph: "check", extra: week };
    case "best":
      return d.best ? { label: "best day", value: d.best.count, glyph: "sparkle" } : null;
    default:
      return null;
  }
}

export const stats = defineWidget({
  type: "stats",
  title: "Stats board",
  description: "Rolling odometer counters for your key numbers, with an optional year-progress ring.",
  scope: "profile",
  category: "Stats",
  kind: "svg",
  width: "full",
  needs: ["calendar"],
  defaults: {
    label: "stats · live from github",
    tiles: ["year", "allTime", "current", "longest", "stars", "followers"],
    ring: true,
  },
  fields: [
    { key: "label", label: "Label", type: "text" },
    { key: "tiles", label: "Tiles", type: "checklist", options: STAT_OPTIONS, max: 8, help: "Up to 6 with the ring, 8 without." },
    { key: "ring", label: "Year-progress ring", type: "toggle" },
  ],
  alt: () => "GitHub stats",
  render(ctx, o) {
    const t = ctx.theme;
    const ring = Boolean(o.ring);
    const max = ring ? 6 : 8;
    const keys = (Array.isArray(o.tiles) ? (o.tiles as string[]) : []).slice(0, 12);
    const tiles = keys.map((k) => statTile(ctx, k)).filter((x): x is Tile => x !== null).slice(0, max);
    const cols = ring ? 3 : Math.min(4, Math.max(1, tiles.length));
    const rows = Math.max(1, Math.ceil(tiles.length / cols));
    const gx = 24;
    const gy = o.label ? 50 : 24;
    const gap = 12;
    const areaW = ring ? 582 : W - 48;
    const tw = (areaW - gap * (cols - 1)) / cols;
    const th = 88;
    const H = Math.max(ring ? 250 : 0, gy + rows * th + (rows - 1) * gap + 24);
    const tileMarkup = tiles
      .map((tile, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = gx + col * (tw + gap);
        const y = gy + row * (th + gap);
        const delay = 0.15 + i * 0.1;
        const value = groupDigits(tile.value);
        return `<g class="in" style="animation-delay:${delay.toFixed(2)}s">
<rect x="${x.toFixed(1)}" y="${y}" width="${tw.toFixed(1)}" height="${th}" rx="${Math.max(2, t.radius - 2)}" fill="${t.raised}" stroke="${t.border}"/>
${glyph(tile.glyph, x + 14, y + 13, 15, t.accent)}
<text x="${(x + 36).toFixed(1)}" y="${y + 25}" font-size="10.5" letter-spacing="1" class="m">${esc(tile.label.toUpperCase())}</text>
${odometer(t, value, { x: x + 14, y: y + 66, fontSize: 28, delay: delay + 0.2, heading: true })}
${tile.unit ? `<text x="${(x + 18 + odometerWidth(t, value, 28, true, true)).toFixed(1)}" y="${y + 66}" font-size="15" class="m">${tile.unit}</text>` : ""}
${tile.extra ? tile.extra(x, y, tw, th) : ""}
</g>`;
      })
      .join("\n");

    let ringMarkup = "";
    let css = "";
    let defs = "";
    if (ring) {
      const yp = yearProgress(ctx.now);
      const cx = 708;
      const cy = H / 2 + 17;
      const r = 66;
      const C = 2 * Math.PI * r;
      const ticks = Array.from({ length: 52 }, (_, i) => {
        const a = (i / 52) * 360;
        const done = i / 52 <= yp.fraction;
        return `<line x1="${cx}" y1="${cy - r - 12}" x2="${cx}" y2="${cy - r - (i % 13 === 0 ? 20 : 16)}" stroke="${done ? t.accent : t.subtle}" stroke-width="${i % 13 === 0 ? 2 : 1.2}" transform="rotate(${a.toFixed(1)} ${cx} ${cy})" class="fade" style="animation-delay:${(0.6 + i * 0.015).toFixed(2)}s"/>`;
      }).join("");
      const pct = (yp.fraction * 100).toFixed(1);
      const pctW = odometerWidth(t, pct, 26, true, true);
      css = `
.ring{stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${C.toFixed(1)};animation:ringTo 2.2s cubic-bezier(.2,.7,.2,1) .5s forwards}
@keyframes ringTo{to{stroke-dashoffset:${(C * (1 - yp.fraction)).toFixed(1)}}}
.orb{transform-origin:${cx}px ${cy}px;animation:orb 2.2s cubic-bezier(.2,.7,.2,1) .5s both}
@keyframes orb{from{transform:rotate(0)}to{transform:rotate(${(yp.fraction * 360).toFixed(1)}deg)}}
.sweep{transform-origin:${cx}px ${cy}px;animation:spin 6s linear infinite}`;
      defs = `<linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<linearGradient id="sweepG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset="1" stop-color="${t.accent}" stop-opacity=".35"/></linearGradient>`;
      ringMarkup = `<g class="in" style="animation-delay:.3s">
<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${t.heat[0]}" stroke-width="10"/>
<circle class="ring" cx="${cx}" cy="${cy}" r="${r}" stroke="url(#ringG)" stroke-width="10" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
<g class="orb"><circle cx="${cx}" cy="${cy - r}" r="7" fill="${t.glow}" filter="url(#glow)"/><circle cx="${cx}" cy="${cy - r}" r="3" fill="#fff"/></g>
<g class="sweep loop loop-only"><path d="M${cx} ${cy}L${cx} ${cy - r + 10}A${r - 10} ${r - 10} 0 0 1 ${(cx + (r - 10) * Math.sin(Math.PI / 5)).toFixed(1)} ${(cy - (r - 10) * Math.cos(Math.PI / 5)).toFixed(1)}Z" fill="url(#sweepG)" opacity=".5"/></g>
${ticks}
${odometer(t, pct, { x: cx - 8, y: cy + 8, fontSize: 26, anchor: "middle", delay: 0.6, heading: true })}
<text x="${(cx - 8 + pctW / 2 + 3).toFixed(1)}" y="${cy + 8}" font-size="15" class="m">%</text>
<text x="${cx}" y="${cy + 30}" font-size="10.5" letter-spacing="1" text-anchor="middle" class="m">DAY ${yp.dayOfYear}/${yp.daysInYear}</text>
<text x="${cx}" y="${cy - 22}" font-size="10.5" letter-spacing="1.5" text-anchor="middle" class="a b">${ctx.now.year}</text>
</g>`;
    }
    const body = `${card(t, { width: W, height: H })}
${o.label ? label(t, 24, 30, o.label as string) : ""}
${tileMarkup}
${ringMarkup}`;
    return svg({ width: W, height: H, theme: t, title: "GitHub stats", css, defs, body });
  },
});
