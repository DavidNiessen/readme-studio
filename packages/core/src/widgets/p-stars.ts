import { monthName } from "../lib/astro";
import { esc, groupDigits } from "../lib/escape";
import { odometer, odometerWidth } from "../lib/odometer";
import { card, f, svg, textWidth } from "../lib/svg";
import { TNUM, compact, dl, emptyState, header, optBool, optPick, optStr } from "./kit-d";
import { monotone, niceStep, noRepo, pdata, repoUrl, starsGained } from "./kit-e";
import { onAccent } from "./parts";
import { defineWidget } from "./types";

const W = 840;
const X0 = 64;
const X1 = W - 28;
const DAY = 86_400_000;
const MILESTONES = [10, 50, 100, 500, 1000, 5000, 10_000, 50_000, 100_000, 500_000, 1_000_000];

export const starHistory = defineWidget({
  type: "star-history",
  title: "Star history",
  description: "Cumulative stars over time as a chart that draws itself on, with milestone flags and the stars gained this month.",
  scope: "project",
  category: "Activity",
  kind: "svg",
  width: "full",
  needs: ["project", "stars"],
  defaults: { label: "star history", scale: "linear", milestones: true, fill: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "scale",
      label: "Scale",
      type: "segmented",
      options: [
        { value: "linear", label: "Linear" },
        { value: "log", label: "Log" },
      ],
    },
    { key: "milestones", label: "Milestone flags", type: "toggle", help: "Marks when the project crossed 100, 500, 1k, 5k … stars." },
    { key: "fill", label: "Area fill", type: "toggle" },
  ],
  alt: (ctx) => {
    const pd = pdata(ctx);
    return pd ? `Star history of ${pd.fullName}: ${groupDigits(pd.stars)} stars` : "star history";
  },
  href: (ctx) => `${repoUrl(ctx)}/stargazers`,
  render(ctx, o) {
    const t = ctx.theme;
    const pd = pdata(ctx);
    const lbl = optStr(o.label);
    const top0 = lbl ? 50 : 24;
    if (!pd) {
      const H = top0 + 150;
      const body = `${card(t, { width: W, height: H })}${lbl ? header(t, W, lbl) : ""}${noRepo(t, 24, top0, W - 48, 126, "The star chart")}`;
      return svg({ width: W, height: H, theme: t, title: "star history", body });
    }
    const now = ctx.date.getTime();
    let hist = (pd.starHistory ?? [])
      .filter((p) => p && p.date && Number.isFinite(p.stars) && !Number.isNaN(new Date(p.date).getTime()))
      .map((p) => ({ t: new Date(p.date).getTime(), v: Math.max(0, p.stars) }))
      .sort((a, b) => a.t - b.t);
    const total = Math.max(pd.stars, hist.length ? hist[hist.length - 1].v : 0);
    if (hist.length && hist[hist.length - 1].v < total) hist.push({ t: Math.max(now, hist[hist.length - 1].t), v: total });
    if (hist.length < 2 && total > 0) {
      const born = pd.createdAt ? new Date(pd.createdAt).getTime() : now - 365 * DAY;
      hist = [
        { t: Number.isNaN(born) ? now - 365 * DAY : Math.min(born, now - DAY), v: 0 },
        { t: now, v: total },
      ];
    }
    const log = optPick(o.scale, ["linear", "log"], "linear") === "log";
    const gained = starsGained(pd, 30, ctx.date) ?? 0;

    // --------------------------------------------- headline
    const heroY = top0 + 40;
    const value = groupDigits(total);
    const vw = odometerWidth(t, value, 38, true, true);
    let chipX = 24 + vw + 10 + textWidth(t, "stars", 14) + 16;
    const chipTxt = gained > 0 ? `+${groupDigits(gained)} in the last 30 days` : "no new stars in the last 30 days";
    const chipW = textWidth(t, chipTxt, 11.5, { bold: gained > 0 }) + 22;
    if (chipX + chipW > W - 24) chipX = W - 24 - chipW;
    const born = hist.length ? hist[0].t : now;
    const days = Math.max(1, (now - born) / DAY);
    const perDay = total / days;
    const rightTxt = hist.length ? `since ${monthName(new Date(born).getUTCMonth() + 1)} ${new Date(born).getUTCFullYear()} · ${perDay >= 10 ? Math.round(perDay) : perDay.toFixed(1)} a day` : "";
    const headline = `<g class="in" style="${dl(0.15)}">
<g class="tn">${odometer(t, value, { x: 24, y: heroY, fontSize: 38, delay: 0.25, heading: true })}</g>
<text x="${f(24 + vw + 10)}" y="${heroY}" font-size="14" class="m">${total === 1 ? "star" : "stars"}</text>
</g>
<g class="in" style="${dl(0.5)}">
<rect x="${f(chipX)}" y="${heroY - 17}" width="${f(chipW)}" height="22" rx="11" fill="${gained > 0 ? t.accent : t.raised}" stroke="${gained > 0 ? "none" : t.border}"/>
<text x="${f(chipX + chipW / 2)}" y="${heroY - 2}" font-size="11.5" text-anchor="middle" ${gained > 0 ? `fill="${onAccent(t)}" class="b"` : 'class="m"'}>${esc(chipTxt)}</text>
</g>
${rightTxt && chipX + chipW + 24 + textWidth(t, rightTxt, 11.5) < W - 24 ? `<text x="${W - 24}" y="${heroY - 2}" font-size="11.5" text-anchor="end" class="m fade" style="${dl(0.6)}">${esc(rightTxt)}</text>` : ""}`;

    const Y0 = heroY + 52;
    const Y1 = Y0 + 140;
    const H = Y1 + 44;

    if (total === 0 || hist.length < 2) {
      const body = `${card(t, { width: W, height: H })}${lbl ? header(t, W, lbl) : ""}${headline}${emptyState(t, 24, Y0 - 14, W - 48, Y1 - Y0 + 34, "star", "No stars yet", "The chart starts with the first stargazer.")}`;
      return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css: TNUM, body });
    }

    // --------------------------------------------- scales
    const t0 = hist[0].t;
    const t1 = Math.max(hist[hist.length - 1].t, t0 + DAY);
    const xs = (ts: number) => X0 + ((ts - t0) / (t1 - t0)) * (X1 - X0);
    let ys: (v: number) => number;
    const grid: string[] = [];
    if (log) {
      const decades = Math.max(1, Math.ceil(Math.log10(Math.max(10, total * 1.15))));
      ys = (v) => Y1 - (Math.log10(Math.max(1, v)) / decades) * (Y1 - Y0);
      for (let k = 0; k <= decades; k++) {
        const y = ys(10 ** k);
        grid.push(`<path d="M${X0} ${f(y)}H${X1}" stroke="${t.border}"${k ? ' stroke-dasharray="2 4"' : ""}/><text x="${X0 - 12}" y="${f(y + 3.5)}" font-size="10" text-anchor="end" class="m">${esc(compact(10 ** k))}</text>`);
      }
    } else {
      const step = niceStep((total * 1.12) / 4);
      const topV = Math.max(step * 2, Math.ceil((total * 1.12) / step) * step);
      ys = (v) => Y1 - (v / topV) * (Y1 - Y0);
      for (let v = 0; v <= topV + 1e-9; v += step) {
        const y = ys(v);
        grid.push(`<path d="M${X0} ${f(y)}H${X1}" stroke="${t.border}"${v ? ' stroke-dasharray="2 4"' : ""}/><text x="${X0 - 12}" y="${f(y + 3.5)}" font-size="10" text-anchor="end" class="m">${esc(compact(v))}</text>`);
      }
    }

    // x axis: month ticks at a readable step
    const ticks: string[] = [];
    const d0 = new Date(t0);
    const spanMonths = (t1 - t0) / (30.44 * DAY);
    const stepM = [1, 2, 3, 4, 6, 12, 24].find((s) => spanMonths / s <= 6) ?? 24;
    let m = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1));
    while (m.getUTCMonth() % stepM !== 0) m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1));
    let lastX = -1e9;
    for (; m.getTime() <= t1; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + stepM, 1))) {
      const x = xs(m.getTime());
      const txt = stepM >= 12 || m.getUTCMonth() === 0 ? String(m.getUTCFullYear()) : `${monthName(m.getUTCMonth() + 1)} ${String(m.getUTCFullYear()).slice(2)}`;
      const w = textWidth(t, txt, 10.5);
      if (x - lastX < w + 18 || x + w / 2 > X1 + 8 || x - w / 2 < X0 - 20) continue;
      ticks.push(`<path d="M${f(x)} ${Y1}v4" stroke="${t.subtle}"/><text x="${f(x)}" y="${Y1 + 18}" font-size="10.5" text-anchor="middle" class="m">${esc(txt)}</text>`);
      lastX = x;
    }

    // --------------------------------------------- series
    const pts: [number, number][] = hist.map((p) => [xs(p.t), ys(p.v)]);
    const line = monotone(pts, (n) => f(n));
    const areaD = `${line}L${f(pts[pts.length - 1][0])} ${Y1}L${f(pts[0][0])} ${Y1}Z`;
    const last = pts[pts.length - 1];

    // last-30-days band
    const bandX = Math.max(X0, xs(now - 30 * DAY));
    const band =
      gained > 0 && bandX < X1 - 4
        ? `<g class="fade" style="${dl(2)}"><rect x="${f(bandX)}" y="${Y0}" width="${f(X1 - bandX)}" height="${Y1 - Y0}" fill="${t.accent}" opacity="${t.name === "dark" ? 0.08 : 0.06}"/><path d="M${f(bandX)} ${Y0}V${Y1}" stroke="${t.accent}" stroke-opacity=".45" stroke-dasharray="2 3"/>${X1 - bandX > 34 ? `<text x="${f((bandX + X1) / 2)}" y="${Y1 - 8}" font-size="9.5" letter-spacing="1" text-anchor="middle" class="a b">30D</text>` : ""}</g>`
        : "";

    // milestones: when the curve first reached each round number
    let flags = "";
    if (optBool(o.milestones, true)) {
      const crossed = MILESTONES.filter((v) => v <= total && hist[0].v < v);
      const marks: { v: number; x: number; y: number }[] = [];
      for (const v of crossed) {
        const i = hist.findIndex((p) => p.v >= v);
        if (i <= 0) continue;
        const a = hist[i - 1];
        const b = hist[i];
        const ts = a.t + ((b.t - a.t) * (v - a.v)) / Math.max(1, b.v - a.v);
        marks.push({ v, x: xs(ts), y: ys(v) });
      }
      // keep the biggest milestones that don't crowd each other
      const kept: { v: number; x: number; y: number; w: number }[] = [];
      for (const mk of [...marks].reverse()) {
        const w = textWidth(t, compact(mk.v), 10.5, { bold: true }) + 26;
        if (kept.every((k) => Math.abs(k.x - mk.x) > (k.w + w) / 2 + 6) && kept.length < 5) kept.push({ ...mk, w });
      }
      const fy = Y0 - 20;
      flags = kept
        .sort((a, b) => a.x - b.x)
        .map((k, i) => {
          const d = 1.6 + i * 0.15;
          const bx = Math.min(Math.max(k.x - k.w / 2, X0 - 6), X1 + 6 - k.w);
          return `<g class="in" style="${dl(d)}">
<path d="M${f(k.x)} ${fy + 9}V${f(k.y - 5)}" stroke="${t.glow}" stroke-opacity=".7" stroke-dasharray="2 3"/>
<rect x="${f(bx)}" y="${fy - 9}" width="${f(k.w)}" height="18" rx="9" fill="${t.card}" stroke="${t.accent}"/>
<path d="M${f(bx + 10)} ${fy - 3.5}l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="${t.accent}"/>
<text x="${f(bx + 19)}" y="${fy + 3.8}" font-size="10.5" class="t b">${esc(compact(k.v))}</text>
<circle cx="${f(k.x)}" cy="${f(k.y)}" r="4" fill="${t.card}" stroke="${t.glow}" stroke-width="2"/>
</g>`;
        })
        .join("");
    }

    const dark = t.name === "dark";
    const css = `${TNUM}
.ln{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 2.2s cubic-bezier(.45,.05,.25,1) .4s forwards}
.rev{transform-box:fill-box;transform-origin:left;animation:growX 2.2s cubic-bezier(.45,.05,.25,1) .4s both}
@keyframes ping{0%{transform:scale(.6);opacity:1}100%{transform:scale(2.4);opacity:0}}`;
    const defs = `<linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="${dark ? 0.42 : 0.28}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>
<linearGradient id="lineG" gradientUnits="userSpaceOnUse" x1="${X0}" y1="0" x2="${X1}" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.glow}"/></linearGradient>
<clipPath id="revC"><rect class="rev" x="${X0 - 8}" y="${Y0 - 10}" width="${X1 - X0 + 16}" height="${Y1 - Y0 + 11}"/></clipPath>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
${headline}
<g class="fade" style="${dl(0.1)}">${grid.join("")}${ticks.join("")}</g>
${band}
${optBool(o.fill, true) ? `<path d="${areaD}" fill="url(#areaG)" clip-path="url(#revC)"/>` : ""}
<path d="${line}" pathLength="1" stroke="url(#lineG)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="ln"/>
${flags}
<g class="fade" style="${dl(2.4)}">
<circle cx="${f(last[0])}" cy="${f(last[1])}" r="9" stroke="${t.glow}" stroke-width="1.5" class="fx loop" style="animation:ping 2s ease-out 2.6s infinite"/>
<circle cx="${f(last[0])}" cy="${f(last[1])}" r="4.5" fill="${t.card}" stroke="${t.glow}" stroke-width="2.5"/>
</g>`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
