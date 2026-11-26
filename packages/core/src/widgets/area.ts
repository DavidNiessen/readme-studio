import { monthName } from "../lib/astro";
import { esc, groupDigits } from "../lib/escape";
import { card, f, svg, textWidth } from "../lib/svg";
import { dl, header, optBool, optPick, optStr, shortDate } from "./kit-d";
import { onAccent } from "./parts";
import { defineWidget } from "./types";

const W = 840;
const X0 = 60;
const X1 = W - 28;

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** Catmull-Rom spline as cubic Béziers, with control points clamped to the plot band (no dips below zero). */
function smoothPath(pts: [number, number][], yMin: number, yMax: number): string {
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("");
  const c = (v: number) => Math.min(yMax, Math.max(yMin, v));
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const k = 1 / 6;
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = c(p1[1] + (p2[1] - p0[1]) * k);
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = c(p2[1] - (p3[1] - p1[1]) * k);
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

export const area = defineWidget({
  type: "area",
  title: "Contribution trend",
  description: "Weekly contributions as a smooth area chart that draws itself on, with your average and peak week marked.",
  category: "Activity",
  kind: "svg",
  width: "full",
  needs: ["calendar"],
  defaults: { label: "contribution trend", weeks: "26", smooth: true, average: true, peak: true, points: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "weeks",
      label: "Range",
      type: "segmented",
      options: [
        { value: "12", label: "12 weeks" },
        { value: "26", label: "26 weeks" },
        { value: "52", label: "52 weeks" },
      ],
    },
    { key: "smooth", label: "Smooth curve", type: "toggle" },
    { key: "average", label: "Average line", type: "toggle" },
    { key: "peak", label: "Peak marker", type: "toggle" },
    { key: "points", label: "Week dots", type: "toggle", help: "Dots on each week (12 and 26 week ranges)." },
  ],
  alt: (_ctx, o) => `Weekly contributions over the last ${o.weeks} weeks`,
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = optStr(o.label);
    const n = Number(optPick(String(o.weeks), ["12", "26", "52"], "26"));
    const weeks = ctx.data.weeks.slice(-n);
    const vals = weeks.map((w) => w.reduce((a, d) => a + d.count, 0));
    const total = vals.reduce((a, b) => a + b, 0);
    const mean = vals.length ? total / vals.length : 0;
    const vmax = Math.max(0, ...vals);
    // headroom above the peak so its marker never collides with the top edge
    const want = Math.max(4, vmax * 1.2);
    const step = niceStep(want / 4);
    const top = Math.max(step * 3, Math.ceil(want / step) * step);
    const Y0 = lbl ? 64 : 36;
    const Y1 = Y0 + 136;
    const H = Y1 + 46;
    const xs = (i: number) => (vals.length <= 1 ? (X0 + X1) / 2 : X0 + (i / (vals.length - 1)) * (X1 - X0));
    const ys = (v: number) => Y1 - (v / top) * (Y1 - Y0);
    const pts: [number, number][] = vals.map((v, i) => [xs(i), ys(v)]);
    const smooth = optBool(o.smooth, true);
    const line = pts.length ? (smooth ? smoothPath(pts, Y0, Y1) : pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("")) : "";
    const areaD = pts.length ? `${line}L${f(pts[pts.length - 1][0])} ${Y1}L${f(pts[0][0])} ${Y1}Z` : "";

    // grid + y labels
    const grid: string[] = [];
    for (let v = 0; v <= top + 1e-9; v += step) {
      const y = ys(v);
      grid.push(`<path d="M${X0} ${f(y)}H${X1}" stroke="${t.border}"${v ? ' stroke-dasharray="2 4"' : ""}/>`);
      grid.push(`<text x="${X0 - 12}" y="${f(y + 3.5)}" font-size="10" text-anchor="end" class="m">${esc(groupDigits(v))}</text>`);
    }
    // month labels at the first week of each month, skipping crowded ones
    const months: string[] = [];
    let lastM = -1;
    let lastX = -1e9;
    weeks.forEach((w, i) => {
      const d = w[w.length - 1] ?? w[0];
      if (!d) return;
      const m = Number(d.date.slice(5, 7));
      if (m !== lastM) {
        const x = xs(i);
        const txt = monthName(m);
        if (x - lastX > 44 && x + textWidth(t, txt, 10.5) / 2 < X1 + 10 && (lastM !== -1 || n <= 12 || Number(d.date.slice(8)) <= 7)) {
          months.push(`<path d="M${f(x)} ${Y1}v4" stroke="${t.subtle}"/><text x="${f(x)}" y="${Y1 + 18}" font-size="10.5" text-anchor="middle" class="m">${txt}</text>`);
          lastX = x;
        }
        lastM = m;
      }
    });

    let avgLine = "";
    if (optBool(o.average, true) && total > 0) {
      const y = ys(mean);
      const txt = `avg ${mean >= 10 ? Math.round(mean) : mean.toFixed(1)}/wk`;
      const tw = textWidth(t, txt, 10.5, { bold: true }) + 14;
      avgLine = `<g class="fade" style="${dl(1.6)}"><path d="M${X0} ${f(y)}H${X1}" stroke="${t.accent2}" stroke-width="1.2" stroke-dasharray="5 4"/>
<rect x="${f(X0 + 6)}" y="${f(y - 9)}" width="${f(tw)}" height="18" rx="9" fill="${t.card}" stroke="${t.accent2}"/>
<text x="${f(X0 + 6 + tw / 2)}" y="${f(y + 3.8)}" font-size="10.5" text-anchor="middle" class="a2 b">${esc(txt)}</text></g>`;
    }
    let peak = "";
    const pi = vals.indexOf(vmax);
    if (optBool(o.peak, true) && vmax > 0 && pi >= 0) {
      const [px, py] = pts[pi];
      const date = weeks[pi][0]?.date ?? "";
      const txt = `peak ${groupDigits(vmax)} · wk of ${shortDate(date)}`;
      const tw = textWidth(t, txt, 11, { bold: true }) + 20;
      const bx = Math.min(Math.max(px - tw / 2, X0), X1 - tw);
      const above = py - 34 > Y0 - 22;
      const by = above ? py - 34 : py + 14;
      peak = `<g class="in" style="${dl(2)}">
<path d="M${f(px)} ${f(above ? py - 14 : py + 14)}V${f(py)}" stroke="${t.glow}" stroke-dasharray="2 2"/>
<rect x="${f(bx)}" y="${f(by)}" width="${f(tw)}" height="20" rx="10" fill="${t.accent}"/>
<text x="${f(bx + tw / 2)}" y="${f(by + 13.8)}" font-size="11" text-anchor="middle" fill="${onAccent(t)}" class="b">${esc(txt)}</text>
<circle cx="${f(px)}" cy="${f(py)}" r="9" stroke="${t.glow}" stroke-width="1.5" class="fx loop" style="animation:ping 2s ease-out 2.4s infinite"/>
<circle cx="${f(px)}" cy="${f(py)}" r="4.5" fill="${t.card}" stroke="${t.glow}" stroke-width="2.5"/>
</g>`;
    }
    const dots =
      optBool(o.points, true) && n <= 26 && total > 0
        ? pts
            .map(
              (p, i) =>
                i === pi && peak
                  ? ""
                  : `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="2.6" fill="${t.card}" stroke="${t.accent}" stroke-width="1.6" class="fx" style="animation:pop .4s ease ${(0.6 + (i / Math.max(1, pts.length)) * 1.6).toFixed(2)}s both"/>`,
            )
            .join("")
        : "";
    const last = pts[pts.length - 1];
    const endDot =
      last && !(pi === pts.length - 1 && peak)
        ? `<g class="fade" style="${dl(2.2)}"><circle cx="${f(last[0])}" cy="${f(last[1])}" r="7" fill="${t.glow}" opacity=".35" class="loop" style="animation:pulse 1.8s ease-in-out infinite"/><circle cx="${f(last[0])}" cy="${f(last[1])}" r="3.5" fill="${t.glow}"/></g>`
        : "";
    const empty = total === 0 ? `<text x="${(X0 + X1) / 2}" y="${(Y0 + Y1) / 2}" font-size="13" text-anchor="middle" class="m">No contributions in this range yet</text>` : "";
    const right = `${groupDigits(total)} in ${n} weeks${total > 0 ? ` · this week ${groupDigits(vals[vals.length - 1] ?? 0)}` : ""}`;
    const dark = t.name === "dark";
    const css = `
.ln{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 2.2s cubic-bezier(.45,.05,.25,1) .4s forwards}
.rev{transform-box:fill-box;transform-origin:left;animation:growX 2.2s cubic-bezier(.45,.05,.25,1) .4s both}
@keyframes ping{0%{transform:scale(.6);opacity:1}100%{transform:scale(2.2);opacity:0}}`;
    const defs = `<linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="${dark ? 0.42 : 0.3}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>
<linearGradient id="lineG" gradientUnits="userSpaceOnUse" x1="${X0}" y1="0" x2="${X1}" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.glow}"/></linearGradient>
<clipPath id="revC"><rect class="rev" x="${X0 - 8}" y="${Y0 - 30}" width="${X1 - X0 + 16}" height="${Y1 - Y0 + 31}"/></clipPath>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, right) : ""}
<g class="fade" style="${dl(0.1)}">${grid.join("")}${months.join("")}</g>
${total > 0 ? `<path d="${areaD}" fill="url(#areaG)" clip-path="url(#revC)"/>` : ""}
${line ? `<path d="${line}" pathLength="1" stroke="url(#lineG)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="ln"/>` : ""}
${dots}
${avgLine}
${endDot}
${peak}
${empty}`;
    return svg({ width: W, height: H, theme: t, title: `Weekly contributions over the last ${n} weeks`, css, defs, body });
  },
});
