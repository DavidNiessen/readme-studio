import { esc, groupDigits } from "../lib/escape";
import { odometer } from "../lib/odometer";
import { card, f, fitText, svg, textWidth } from "../lib/svg";
import type { ProjectData } from "../data/types";
import { TNUM, compact, dl, header, optBool, optList, optStr } from "./kit-d";
import { avatar, noRepo, pdata, repoUrl, starsGained, xglyph, type XGlyph } from "./kit-e";
import { accentDeep, glyph, type GlyphName } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;

const TILES = [
  { value: "stars", label: "Stars" },
  { value: "forks", label: "Forks" },
  { value: "watchers", label: "Watchers" },
  { value: "issues", label: "Open issues" },
  { value: "prs", label: "Merged pull requests" },
  { value: "contributors", label: "Contributors" },
  { value: "commits", label: "Commits, last 12 months" },
  { value: "downloads", label: "Weekly downloads" },
];

interface Tile {
  label: string;
  value: number;
  g: GlyphName | `x:${XGlyph}`;
  sub: string;
  /** highlight the sub line in the accent colour */
  hot?: boolean;
  /** small graphic in the tile's bottom-right corner (x, y = tile origin) */
  extra?: (x: number, y: number, w: number, h: number, d0: number) => string;
}

function sparkLine(t: Ctx["theme"], vals: number[], x: number, y: number, w: number, h: number, d0: number, id: string): string {
  if (vals.length < 2) return "";
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const pts = vals.map((v, i) => [x + (i / (vals.length - 1)) * w, y + h - ((v - lo) / span) * h] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("");
  const last = pts[pts.length - 1];
  return `<path d="${line}L${f(x + w)} ${f(y + h)}L${f(x)} ${f(y + h)}Z" fill="url(#${id})" class="fade" style="${dl(d0 + 0.6)}"/>
<path d="${line}" pathLength="1" stroke="${t.accent}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" class="ln" style="${dl(d0 + 0.2)}"/>
<circle cx="${f(last[0])}" cy="${f(last[1])}" r="2.4" fill="${t.glow}" class="fx" style="animation:pop .4s ease ${(d0 + 1.2).toFixed(2)}s both"/>`;
}

function bars(t: Ctx["theme"], vals: number[], x: number, y: number, w: number, h: number, d0: number): string {
  if (!vals.length) return "";
  const max = Math.max(1, ...vals);
  const gap = 2;
  const bw = (w - gap * (vals.length - 1)) / vals.length;
  return vals
    .map((v, i) => {
      const bh = Math.max(2, (v / max) * h);
      return `<rect x="${f(x + i * (bw + gap))}" y="${f(y + h - bh)}" width="${f(bw)}" height="${f(bh)}" rx="1.2" fill="${i === vals.length - 1 ? t.accent : t.subtle}" style="transform-origin:bottom;transform-box:fill-box;animation:grow .6s cubic-bezier(.2,.7,.2,1) ${(d0 + 0.4 + i * 0.035).toFixed(2)}s both"/>`;
    })
    .join("");
}

function tileFor(ctx: Ctx, pd: ProjectData, key: string): Tile | null {
  const t = ctx.theme;
  switch (key) {
    case "stars": {
      const g = starsGained(pd, 30, ctx.date);
      const hist = (pd.starHistory ?? []).map((p) => p.stars).filter((v) => Number.isFinite(v));
      const tail = hist.slice(-14);
      return {
        label: "stars",
        value: pd.stars,
        g: "star",
        sub: g ? `+${groupDigits(g)} in 30 days` : pd.stars ? "no new stars this month" : "be the first to star",
        hot: !!g,
        extra: tail.length >= 2 ? (x, y, w, h, d0) => sparkLine(t, tail, x + w - 78, y + 42, 62, 22, d0, "spk") : undefined,
      };
    }
    case "forks":
      return { label: "forks", value: pd.forks, g: "fork", sub: pd.stars ? `${(Math.round((pd.forks / pd.stars) * 1000) / 10).toString()} per 100 stars` : "" };
    case "watchers":
      return { label: "watchers", value: pd.watchers, g: "eye", sub: "following every change" };
    case "issues":
      return { label: "open issues", value: pd.openIssues, g: "issue", sub: `${groupDigits(pd.closedIssues)} closed` };
    case "prs":
      return { label: "merged prs", value: pd.mergedPulls, g: "x:merge", sub: `${groupDigits(pd.openPulls)} open for review` };
    case "contributors": {
      const top = (pd.contributors ?? []).filter((c) => c && c.login).slice(0, 4);
      return {
        label: "contributors",
        value: pd.contributorCount || top.length,
        g: "users",
        sub: top[0] ? `top: ${top[0].login}` : "",
        extra: top.length
          ? (x, y, w, _h, d0) =>
              top
                .map((c, i) => {
                  const r = 11;
                  const cx = x + w - 16 - r - (top.length - 1 - i) * 18;
                  return avatar(t, c, cx, y + 53, r, `sav${i}`, { ring: t.raised, ringWidth: 2, extra: `class="fx" style="animation:pop .45s ease ${(d0 + 0.5 + i * 0.08).toFixed(2)}s both"` });
                })
                .join("")
          : undefined,
      };
    }
    case "commits": {
      const weeks = (pd.commitWeeks ?? []).filter((v) => Number.isFinite(v));
      const total = weeks.reduce((a, b) => a + b, 0);
      const avg = weeks.length ? total / weeks.length : 0;
      return {
        label: "commits · 12 mo",
        value: total,
        g: "commit",
        sub: total ? `avg ${avg >= 10 ? Math.round(avg) : avg.toFixed(1)} per week` : "quiet year",
        extra: total ? (x, y, w, h, d0) => bars(t, weeks.slice(-12), x + w - 86, y + 40, 70, 26, d0) : undefined,
      };
    }
    case "downloads": {
      const d = (pd.downloads ?? []).find((x) => x && typeof x.lastWeek === "number");
      if (!d) return null;
      const weekly = (d.weekly ?? []).filter((v) => Number.isFinite(v)).slice(-14);
      return {
        label: `${d.registry} · weekly`,
        value: d.lastWeek ?? 0,
        g: "x:download",
        sub: d.lastMonth !== null ? `${compact(d.lastMonth)} this month` : d.name,
        extra: weekly.length >= 2 ? (x, y, w, h, d0) => sparkLine(t, weekly, x + w - 78, y + 42, 62, 22, d0, "spk") : undefined,
      };
    }
    default:
      return null;
  }
}

export const repoStats = defineWidget({
  type: "repo-stats",
  title: "Repository stats",
  description: "Rolling counters for stars, forks, issues, pull requests and contributors, each with a tiny trend, plus an issue-health ring.",
  scope: "project",
  category: "Stats",
  kind: "svg",
  width: "full",
  needs: ["project", "stars", "contributors"],
  defaults: {
    label: "repository · live from github",
    tiles: ["stars", "forks", "contributors", "commits", "prs", "issues"],
    ring: true,
  },
  fields: [
    { key: "label", label: "Label", type: "text" },
    { key: "tiles", label: "Tiles", type: "checklist", options: TILES, max: 8, help: "Up to 6 with the ring, 8 without." },
    { key: "ring", label: "Health ring", type: "toggle", help: "Share of issues closed, with pull requests merged as an inner ring." },
  ],
  alt: (ctx) => {
    const pd = pdata(ctx);
    return pd ? `${pd.fullName}: ${groupDigits(pd.stars)} stars, ${groupDigits(pd.forks)} forks, ${groupDigits(pd.contributorCount)} contributors` : "repository stats";
  },
  href: (ctx) => repoUrl(ctx),
  render(ctx, o) {
    const t = ctx.theme;
    const pd = pdata(ctx);
    const lbl = optStr(o.label);
    const ring = optBool(o.ring, true);
    const gx = 24;
    const gy = lbl ? 50 : 24;
    if (!pd) {
      const H = gy + 150;
      const body = `${card(t, { width: W, height: H })}${lbl ? header(t, W, lbl) : ""}${noRepo(t, 24, gy, W - 48, 126, "Stars, forks and contributors")}`;
      return svg({ width: W, height: H, theme: t, title: "repository stats", body });
    }
    const max = ring ? 6 : 8;
    const tiles = optList(o.tiles)
      .slice(0, 12)
      .map((k) => tileFor(ctx, pd, k))
      .filter((x): x is Tile => x !== null)
      .slice(0, max);
    const cols = ring ? 3 : Math.min(4, Math.max(1, tiles.length <= 4 ? tiles.length : tiles.length === 6 ? 3 : 4));
    const rows = Math.max(1, Math.ceil(tiles.length / cols));
    const gap = 12;
    const areaW = ring ? 582 : W - 48;
    const tw = (areaW - gap * (cols - 1)) / cols;
    const th = 96;
    const H = Math.max(ring ? 270 : 0, gy + rows * th + (rows - 1) * gap + 24);

    const tileMarkup = tiles
      .map((tile, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = gx + col * (tw + gap);
        const y = gy + row * (th + gap);
        const d0 = 0.15 + i * 0.1;
        const value = groupDigits(tile.value);
        const g = tile.g.startsWith("x:") ? xglyph(tile.g.slice(2) as XGlyph, x + 14, y + 13, 15, t.accent) : glyph(tile.g as GlyphName, x + 14, y + 13, 15, t.accent);
        const extraW = tile.extra ? 96 : 0;
        const sub = tile.sub ? fitText(t, tile.sub, 10.5, tw - 28 - (tile.extra && tw < 220 ? 0 : 0)) : "";
        const labelTxt = fitText(t, tile.label.toUpperCase(), 10.5, tw - 50, { letterSpacing: 1 });
        return `<g class="in" style="${dl(d0)}">
<rect x="${f(x)}" y="${y}" width="${f(tw)}" height="${th}" rx="${Math.max(2, t.radius - 2)}" fill="${t.raised}" stroke="${t.border}"/>
${g}
<text x="${f(x + 36)}" y="${y + 25}" font-size="10.5" letter-spacing="1" class="m">${esc(labelTxt)}</text>
<g class="tn">${odometer(t, value, { x: x + 14, y: y + 63, fontSize: textWidth(t, value, 28, { bold: true, heading: true }) > tw - 28 - extraW ? 22 : 28, delay: d0 + 0.2, heading: true })}</g>
${sub ? `<text x="${f(x + 14)}" y="${y + 83}" font-size="10.5" class="${tile.hot ? "a" : "m"}">${esc(sub)}</text>` : ""}
${tile.extra ? tile.extra(x, y, tw, th, d0) : ""}
</g>`;
      })
      .join("\n");

    let ringMarkup = "";
    let css = "";
    if (ring) {
      const cx = 708;
      const cy = gy + 82;
      const r1 = 60;
      const r2 = 45;
      const issuesAll = pd.openIssues + pd.closedIssues;
      const prsAll = pd.mergedPulls + pd.openPulls;
      const fi = issuesAll ? pd.closedIssues / issuesAll : 0;
      const fp = prsAll ? pd.mergedPulls / prsAll : 0;
      const C1 = 2 * Math.PI * r1;
      const C2 = 2 * Math.PI * r2;
      const pct = issuesAll ? `${Math.round(fi * 100)}` : "–";
      const pw = textWidth(t, pct, 26, { bold: true, heading: true });
      const ly = cy + r1 + 34;
      const row = (y: number, color: string, name: string, v: string, d: number) =>
        `<g class="in" style="${dl(d)}"><rect x="${cx - 86}" y="${y - 8}" width="8" height="8" rx="2" fill="${color}"/><text x="${cx - 72}" y="${y}" font-size="11" class="m">${esc(name)}</text><text x="${cx + 86}" y="${y}" font-size="11" text-anchor="end" class="t b">${esc(v)}</text></g>`;
      css = `
.r1{stroke-dasharray:${f(C1)};stroke-dashoffset:${f(C1)};animation:r1 2s cubic-bezier(.2,.7,.2,1) .5s forwards}
@keyframes r1{to{stroke-dashoffset:${f(C1 * (1 - fi))}}}
.r2{stroke-dasharray:${f(C2)};stroke-dashoffset:${f(C2)};animation:r2 2s cubic-bezier(.2,.7,.2,1) .8s forwards}
@keyframes r2{to{stroke-dashoffset:${f(C2 * (1 - fp))}}}
.sweep{transform-origin:${cx}px ${cy}px;animation:spin 8s linear infinite}`;
      ringMarkup = `<g class="in" style="${dl(0.3)}">
<circle cx="${cx}" cy="${cy}" r="${r1}" stroke="${t.heat[0]}" stroke-width="9"/>
<circle cx="${cx}" cy="${cy}" r="${r2}" stroke="${t.heat[0]}" stroke-width="7"/>
${fi > 0 ? `<circle class="r1" cx="${cx}" cy="${cy}" r="${r1}" stroke="url(#ringG)" stroke-width="9" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>` : ""}
${fp > 0 ? `<circle class="r2" cx="${cx}" cy="${cy}" r="${r2}" stroke="${t.accent2}" stroke-width="7" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>` : ""}
<g class="sweep loop loop-only"><circle cx="${cx}" cy="${cy - r1}" r="2" fill="${t.glow}" filter="url(#glow)"/></g>
<text x="${f(cx - (issuesAll ? 7 : 0))}" y="${cy + 6}" font-size="26" text-anchor="middle" class="t b h">${esc(pct)}</text>
${issuesAll ? `<text x="${f(cx - 7 + pw / 2 + 2)}" y="${cy + 6}" font-size="14" class="m">%</text>` : ""}
<text x="${cx}" y="${cy + 24}" font-size="9.5" letter-spacing="1.5" text-anchor="middle" class="m">CLOSED</text>
</g>
${row(ly, t.accent, "issues closed", issuesAll ? `${Math.round(fi * 100)}%` : "–", 0.9)}
${row(ly + 20, t.accent2, "prs merged", prsAll ? `${Math.round(fp * 100)}%` : "–", 1)}`;
    }
    const defs = `<linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="${t.name === "dark" ? 0.35 : 0.22}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>`;
    css += `${TNUM}
.ln{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.4s cubic-bezier(.45,.05,.25,1) forwards}`;
    const right = pd.pushedAt ? "" : "";
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, right) : ""}
${tileMarkup}
${ringMarkup}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
