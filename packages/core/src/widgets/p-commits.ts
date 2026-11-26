import { monthName } from "../lib/astro";
import { ago, esc, groupDigits } from "../lib/escape";
import { odometer, odometerWidth } from "../lib/odometer";
import { card, f, fitText, svg, textWidth } from "../lib/svg";
import { TNUM, dl, emptyState, header, optPick, optStr } from "./kit-d";
import { mono, noRepo, pdata, repoUrl, smooth, weekStart } from "./kit-e";
import { glyph, onAccent } from "./parts";
import { defineWidget } from "./types";

const W = 840;
const X0 = 24;
const X1 = W - 24;

function wk(d: Date): string {
  return `${monthName(d.getUTCMonth() + 1)} ${d.getUTCDate()}`;
}

export const commitActivity = defineWidget({
  type: "commit-activity",
  title: "Commit activity",
  description: "A year of weekly commits as growing bars, a heat strip or a line, with the busiest week called out and the latest commit underneath.",
  scope: "project",
  category: "Activity",
  kind: "svg",
  width: "full",
  needs: ["project"],
  defaults: { label: "commit activity", style: "bars", last: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "style",
      label: "Style",
      type: "segmented",
      options: [
        { value: "bars", label: "Bars" },
        { value: "heat", label: "Heat strip" },
        { value: "line", label: "Line" },
      ],
    },
    { key: "last", label: "Latest commit", type: "toggle", help: "Message, short hash and time of the newest commit." },
  ],
  alt: (ctx) => {
    const pd = pdata(ctx);
    const total = (pd?.commitWeeks ?? []).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return pd ? `${groupDigits(total)} commits to ${pd.fullName} in the last year` : "commit activity";
  },
  href: (ctx) => {
    const pd = pdata(ctx);
    return `${repoUrl(ctx)}/commits/${pd?.defaultBranch || "main"}`;
  },
  render(ctx, o) {
    const t = ctx.theme;
    const pd = pdata(ctx);
    const lbl = optStr(o.label);
    const top = lbl ? 50 : 24;
    if (!pd) {
      const H = top + 150;
      const body = `${card(t, { width: W, height: H })}${lbl ? header(t, W, lbl) : ""}${noRepo(t, 24, top, W - 48, 126, "Weekly commits")}`;
      return svg({ width: W, height: H, theme: t, title: "commit activity", body });
    }
    const style = optPick(o.style, ["bars", "heat", "line"], "bars");
    const raw = (pd.commitWeeks ?? []).map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0)).slice(-52);
    const vals = raw.length ? raw : [];
    const n = vals.length;
    const total = vals.reduce((a, b) => a + b, 0);
    const avg = n ? total / n : 0;
    const peak = Math.max(0, ...vals);
    const pi = peak > 0 ? vals.lastIndexOf(peak) : -1;
    const lc = o.last === false ? null : pd.lastCommit;
    const mo = mono(t);
    const first = n ? weekStart(ctx.date, 0, n) : null;
    const rangeTxt = first ? `${wk(first)}, ${first.getUTCFullYear()} – today` : "";

    // ------------------------------------------------ figures
    const figY = top + 30;
    const figs: [string, string][] = [
      [groupDigits(total), total === 1 ? "commit this year" : "commits this year"],
      [avg >= 10 ? String(Math.round(avg)) : avg.toFixed(1), "avg per week"],
      [groupDigits(peak), "busiest week"],
    ];
    let fx = X0;
    const figMarkup = figs
      .map(([v, l], i) => {
        const vw = odometerWidth(t, v, 24, true, true);
        const x = fx;
        fx += vw + 8 + textWidth(t, l, 11.5) + 34;
        return `<g class="in" style="${dl(0.15 + i * 0.1)}"><g class="tn">${odometer(t, v, { x, y: figY, fontSize: 24, delay: 0.25 + i * 0.1, heading: true, className: i === 0 ? "t b" : "t b" })}</g><text x="${f(x + vw + 8)}" y="${figY}" font-size="11.5" class="m">${esc(l)}</text>${i < figs.length - 1 ? `<path d="M${f(fx - 17)} ${figY - 16}v18" stroke="${t.border}"/>` : ""}</g>`;
      })
      .join("");

    const chartH = style === "heat" ? 44 : 96;
    const Y0 = figY + (style === "heat" ? 52 : 46);
    const Y1 = Y0 + chartH;
    const footY = Y1 + 34;
    const H = lc ? footY + 48 : Y1 + 44;
    const slot = (X1 - X0) / Math.max(1, n);
    const cx = (i: number) => X0 + (i + 0.5) * slot;

    let chart = "";
    let callout = "";
    const css: string[] = [TNUM, mo.css, `@keyframes ping{0%{transform:scale(.6);opacity:1}100%{transform:scale(2.2);opacity:0}}`];
    let defs = "";
    if (total === 0) {
      chart = emptyState(t, X0, Y0 - 16, X1 - X0, Math.max(76, chartH + 16), "commit", "No commits in the last year", "Weekly totals will chart here.");
    } else {
      const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((v / peak) * 4))));
      if (style === "bars") {
        const bw = Math.max(3, slot - 5);
        chart = vals
          .map((v, i) => {
            const h = Math.max(2, (v / peak) * chartH);
            const isPeak = i === pi;
            const fill = isPeak ? "url(#peakG)" : v === 0 ? t.heat[0] : t.heat[Math.max(1, level(v) - 1)];
            return `<rect x="${f(cx(i) - bw / 2)}" y="${f(Y1 - h)}" width="${f(bw)}" height="${f(h)}" rx="${Math.min(3, bw / 3).toFixed(1)}" fill="${fill}" style="transform-origin:bottom;transform-box:fill-box;animation:grow .7s cubic-bezier(.2,.7,.2,1) ${(0.4 + i * 0.022).toFixed(2)}s both"/>`;
          })
          .join("");
        defs = `<linearGradient id="peakG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${t.accent}"/></linearGradient>`;
      } else if (style === "heat") {
        const cw = slot - 3;
        chart = vals
          .map((v, i) => {
            const isPeak = i === pi;
            return `<rect x="${f(cx(i) - cw / 2)}" y="${Y0}" width="${f(cw)}" height="${chartH}" rx="${Math.min(3, cw / 3).toFixed(1)}" fill="${t.heat[level(v)]}" class="fx" style="animation:pop .45s ease ${(0.3 + i * 0.02).toFixed(2)}s both"/>${isPeak ? `<rect x="${f(cx(i) - cw / 2 - 2)}" y="${Y0 - 2}" width="${f(cw + 4)}" height="${chartH + 4}" rx="4" stroke="${t.text}" stroke-width="1.5" class="fade" style="${dl(1.6)}"/>` : ""}`;
          })
          .join("");
        css.push(`.beam{animation:beam 7s cubic-bezier(.45,0,.55,1) 2.4s infinite}
@keyframes beam{0%{transform:translateX(0);opacity:0}5%{opacity:1}45%{opacity:1}50%{transform:translateX(${X1 - X0 + 60}px);opacity:0}100%{transform:translateX(${X1 - X0 + 60}px);opacity:0}}`);
        defs = `<linearGradient id="beamG" x1="0" x2="1"><stop offset="0" stop-color="${t.glow}" stop-opacity="0"/><stop offset=".9" stop-color="${t.glow}" stop-opacity="${t.name === "dark" ? 0.35 : 0.25}"/><stop offset="1" stop-color="${t.name === "dark" ? "#fff" : t.glow}" stop-opacity=".9"/></linearGradient>
<clipPath id="stripC"><rect x="${X0}" y="${Y0 - 4}" width="${X1 - X0}" height="${chartH + 8}"/></clipPath>`;
        chart += `<g clip-path="url(#stripC)"><g class="beam loop loop-only"><rect x="${X0 - 60}" y="${Y0}" width="60" height="${chartH}" fill="url(#beamG)"/></g></g>`;
      } else {
        const ys = (v: number) => Y1 - (v / (peak * 1.08)) * chartH;
        const pts: [number, number][] = vals.map((v, i) => [cx(i), ys(v)]);
        const line = smooth(pts, Y0 - 6, Y1, (x) => f(x));
        const dark = t.name === "dark";
        defs = `<linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="${dark ? 0.4 : 0.26}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>
<clipPath id="revC"><rect class="rev" x="${X0}" y="${Y0 - 12}" width="${X1 - X0}" height="${chartH + 13}"/></clipPath>`;
        css.push(`.ln{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 2.2s cubic-bezier(.45,.05,.25,1) .4s forwards}
.rev{transform-box:fill-box;transform-origin:left;animation:growX 2.2s cubic-bezier(.45,.05,.25,1) .4s both}`);
        chart = `<path d="${line}L${f(pts[n - 1][0])} ${Y1}L${f(pts[0][0])} ${Y1}Z" fill="url(#areaG)" clip-path="url(#revC)"/>
<path d="${line}" pathLength="1" stroke="${t.accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ln"/>`;
      }
      // baseline + average
      if (style !== "heat") {
        chart = `<path d="M${X0} ${Y1 + 0.5}H${X1}" stroke="${t.border}"/>${chart}`;
        const ay = Y1 - (avg / (style === "line" ? peak * 1.08 : peak)) * chartH;
        chart += `<g class="fade" style="${dl(1.8)}"><path d="M${X0} ${f(ay)}H${X1}" stroke="${t.accent2}" stroke-width="1" stroke-dasharray="4 4" opacity=".8"/></g>`;
      }
      // busiest week callout
      if (pi >= 0) {
        const px = cx(pi);
        const py = style === "heat" ? Y0 : style === "line" ? Y1 - (peak / (peak * 1.08)) * chartH : Y1 - chartH;
        const d = weekStart(ctx.date, pi, n);
        const txt = `busiest · ${groupDigits(peak)} · wk of ${wk(d)}`;
        const tw = textWidth(t, txt, 11, { bold: true }) + 20;
        const bx = Math.min(Math.max(px - tw / 2, X0), X1 - tw);
        const by = py - 34;
        callout = `<g class="in" style="${dl(2)}">
<path d="M${f(px)} ${by + 20}V${f(py - (style === "line" ? 6 : 3))}" stroke="${t.glow}" stroke-dasharray="2 2"/>
<rect x="${f(bx)}" y="${by}" width="${f(tw)}" height="20" rx="10" fill="${t.accent}"/>
<text x="${f(bx + tw / 2)}" y="${by + 13.8}" font-size="11" text-anchor="middle" fill="${onAccent(t)}" class="b">${esc(txt)}</text>
${style === "line" ? `<circle cx="${f(px)}" cy="${f(py)}" r="9" stroke="${t.glow}" stroke-width="1.5" class="fx loop" style="animation:ping 2s ease-out 2.4s infinite"/><circle cx="${f(px)}" cy="${f(py)}" r="4" fill="${t.card}" stroke="${t.glow}" stroke-width="2.2"/>` : ""}
</g>`;
      }
    }

    // month labels
    const months: string[] = [];
    if (n && total > 0) {
      let lastM = -1;
      let lastX = -1e9;
      for (let i = 0; i < n; i++) {
        const d = weekStart(ctx.date, i, n);
        const end = new Date(d.getTime() + 6 * 86_400_000);
        const m = end.getUTCMonth();
        if (m !== lastM) {
          const x = cx(i);
          if (lastM !== -1 && x - lastX > 40 && x < X1 - 14) {
            const txt = m === 0 ? String(end.getUTCFullYear()) : monthName(m + 1);
            months.push(`<text x="${f(x)}" y="${Y1 + 18}" font-size="10.5" text-anchor="middle" class="${m === 0 ? "t b" : "m"}">${txt}</text>`);
            lastX = x;
          }
          lastM = m;
        }
      }
    }

    // ------------------------------------------------ latest commit
    let foot = "";
    if (lc) {
      const sha = (lc.sha || "").slice(0, 7);
      const when = lc.date ? ago(lc.date, ctx.date) : "";
      const meta = [lc.author, when].filter(Boolean).join(" · ");
      const metaW = meta ? textWidth(t, meta, 11.5) : 0;
      const shaW = sha ? mo.measure(sha, 11.5) + 16 : 0;
      const msgX = X0 + 24 + (shaW ? shaW + 10 : 0);
      const msg = fitText(t, (lc.message || "").split("\n")[0], 12.5, X1 - msgX - (metaW ? metaW + 20 : 0));
      const cy = footY + 20;
      foot = `<path d="M${X0} ${footY}H${X1}" stroke="${t.border}" class="fade" style="${dl(1.4)}"/>
<g class="in" style="${dl(1.6)}">
${glyph("commit", X0, cy - 8, 16, t.accent)}
${sha ? `<rect x="${X0 + 24}" y="${cy - 10}" width="${f(shaW)}" height="20" rx="6" fill="${t.raised}" stroke="${t.border}"/><text x="${f(X0 + 24 + shaW / 2)}" y="${cy + 4}" font-size="11.5" text-anchor="middle" class="a mono">${esc(sha)}</text>` : ""}
<text x="${f(msgX)}" y="${cy + 4.5}" font-size="12.5" class="t">${esc(msg)}</text>
${meta ? `<text x="${X1}" y="${cy + 4.5}" font-size="11.5" text-anchor="end" class="m">${esc(meta)}</text>` : ""}
</g>`;
    }

    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, rangeTxt) : ""}
${figMarkup}
${chart}
<g class="fade" style="${dl(0.3)}">${months.join("")}</g>
${callout}
${foot}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css: css.join("\n"), defs, body });
  },
});
