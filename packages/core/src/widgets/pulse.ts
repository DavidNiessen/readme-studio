import { lastDays } from "../data/derive";
import { esc, num } from "../lib/escape";
import { card, fitSize, fitText, label, svg, textWidth } from "../lib/svg";
import { niceDate } from "./contrib";
import { defineWidget } from "./types";

const W = 840;
const H = 190;

/** ECG trace: one heartbeat per day, QRS amplitude proportional to contributions. */
export function ecgPoints(counts: number[], x0: number, x1: number, base: number, amp: number): [number, number][] {
  const max = Math.max(1, ...counts);
  const step = (x1 - x0) / Math.max(1, counts.length);
  const pts: [number, number][] = [[x0, base]];
  counts.forEach((c, i) => {
    const x = x0 + i * step;
    if (c <= 0) {
      pts.push([x + step, base]);
      return;
    }
    const h = 6 + (c / max) * amp;
    pts.push(
      [x + step * 0.18, base],
      [x + step * 0.26, base - h * 0.12], // P wave
      [x + step * 0.34, base],
      [x + step * 0.42, base + h * 0.14], // Q
      [x + step * 0.5, base - h], // R
      [x + step * 0.58, base + h * 0.3], // S
      [x + step * 0.66, base],
      [x + step * 0.8, base - h * 0.18], // T wave
      [x + step * 0.92, base],
      [x + step, base],
    );
  });
  if (!counts.length) pts.push([x1, base]);
  return pts;
}

export function polyLength(pts: [number, number][]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

const HEART = "M8 14s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 14 6c0 4.4-6 8-6 8Z";

export const pulse = defineWidget({
  type: "pulse",
  title: "Heartbeat",
  description: "Your recent contributions drawn as an ECG trace, one heartbeat per day, with a glowing pulse running along it.",
  category: "Activity",
  kind: "svg",
  width: "full",
  needs: ["calendar"],
  defaults: { days: "90", label: "heartbeat · last {days} days", bpm: true },
  fields: [
    {
      key: "days",
      label: "Window",
      type: "segmented",
      options: [
        { value: "30", label: "30 d" },
        { value: "60", label: "60 d" },
        { value: "90", label: "90 d" },
        { value: "180", label: "180 d" },
      ],
    },
    { key: "label", label: "Label", type: "text", help: "{days} is replaced with the window length." },
    { key: "bpm", label: "BPM tile", type: "toggle", help: "Average contributions per week, shown as a heart rate." },
  ],
  alt: (_ctx, o) => `contribution heartbeat over the last ${Number(o.days) || 90} days`,
  href: (ctx) => `https://github.com/${ctx.profile.login}`,
  render(ctx, o) {
    const t = ctx.theme;
    const n = [30, 60, 90, 180].includes(Number(o.days)) ? Number(o.days) : 90;
    const showBpm = o.bpm !== false;
    const days = lastDays(ctx.d.days, n);
    const counts = days.map((d) => d.count);
    const x0 = 24;
    const x1 = showBpm ? 640 : W - 24;
    const base = 132;
    const pts = ecgPoints(counts, x0, x1, base, 72);
    const d = `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}`;
    const len = Math.max(1, polyLength(pts));
    const total = counts.reduce((a, b) => a + b, 0);
    const avg = total / Math.max(1, counts.length);
    const bpm = num(avg * 7, 1);
    const seg = len * 0.18;
    const cycle = Math.round(4 + n / 30);
    const flat = total === 0;
    const full = t.motion === "full";
    const css = `
.trace{stroke-dasharray:${len.toFixed(0)};stroke-dashoffset:${len.toFixed(0)};animation:draw 3.2s linear .3s forwards}
.head{stroke-dasharray:${seg.toFixed(0)} ${(len - seg + 40).toFixed(0)};stroke-dashoffset:${seg.toFixed(0)};animation:headRun ${cycle}s linear 3.5s infinite;opacity:0}
@keyframes headRun{0%{stroke-dashoffset:${seg.toFixed(0)};opacity:1}100%{stroke-dashoffset:${(-len).toFixed(0)};opacity:1}}
.heart{transform-box:fill-box;transform-origin:center;animation:beat 1.1s ease-in-out infinite}
@keyframes beat{0%,100%{transform:scale(1)}15%{transform:scale(1.25)}30%{transform:scale(.95)}45%{transform:scale(1.12)}}`;
    const dark = t.name === "dark";
    const defs = `<pattern id="ecg" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" stroke="${t.accent}" stroke-opacity="${dark ? 0.09 : 0.08}"/></pattern>
<pattern id="ecg5" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" stroke="${t.accent}" stroke-opacity="${dark ? 0.18 : 0.14}"/></pattern>
<clipPath id="paper"><rect x="16" y="44" width="${x1 - x0 + 16}" height="${H - 56}" rx="${Math.min(8, t.radius)}"/></clipPath>`;
    const headColor = dark ? "#fff" : t.glow;
    const dot =
      full && !flat
        ? `<circle r="4" fill="${headColor}" filter="url(#glow)" opacity="0" class="loop-only">
  <animateMotion dur="${cycle}s" begin="3.5s" repeatCount="indefinite" path="${d}" calcMode="linear"/>
  <set attributeName="opacity" to="1" begin="3.5s"/>
</circle>`
        : "";
    const first = days[0]?.date;
    const last = days[days.length - 1]?.date;
    const peak = days.reduce<(typeof days)[number] | null>((b, x) => (!b || x.count > b.count ? x : b), null);
    const lbl = String(o.label ?? "").replace(/\{days\}/g, String(n));
    const summary = flat ? "flatline · no contributions in this window" : `${total} contributions · peak ${peak!.count} on ${niceDate(peak!.date)}`;
    const summaryMax = W - 48 - (lbl ? textWidth(t, lbl.toUpperCase(), 12, { bold: true, letterSpacing: 2 }) + 40 : 0);

    let tile = "";
    if (showBpm) {
      const tx = x1 + 24;
      const tw = W - x1 - 48;
      const size = fitSize(t, bpm, 40, tw - 40, 18, { bold: true, heading: true });
      tile = `<g class="in" style="animation-delay:.6s">
<rect x="${tx}" y="44" width="${tw}" height="${H - 64}" rx="${Math.max(2, Math.min(10, t.radius - 2))}" fill="${t.raised}" stroke="${t.border}"/>
<g class="heart loop"><path transform="translate(${tx + 20} 62) scale(1.1)" d="${HEART}" fill="${t.accent}" filter="url(#glow)"/></g>
<text x="${tx + 46}" y="76" font-size="10.5" letter-spacing="1" class="m">BPM*</text>
<text x="${tx + 20}" y="122" font-size="${size}" class="t b h">${esc(bpm)}</text>
<text x="${tx + 20}" y="144" font-size="10" class="m">*contributions</text>
<text x="${tx + 20}" y="157" font-size="10" class="m">per week, on average</text>
</g>`;
    }
    const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${summaryMax > 100 ? `<text x="${W - 24}" y="30" font-size="11" text-anchor="end" class="m fade" style="animation-delay:.4s">${esc(fitText(t, summary, 11, summaryMax))}</text>` : ""}
<g clip-path="url(#paper)"><rect x="16" y="44" width="${x1}" height="${H - 56}" fill="url(#ecg)"/><rect x="16" y="44" width="${x1}" height="${H - 56}" fill="url(#ecg5)"/></g>
<path d="M${x0} ${base}H${x1}" stroke="${t.subtle}" stroke-dasharray="3 4"/>
<path class="trace" d="${d}" stroke="${t.accent}" stroke-width="1.6" stroke-linejoin="round"/>
${flat ? "" : `<path class="head loop loop-only" d="${d}" stroke="${headColor}" stroke-width="2.2" stroke-linejoin="round" filter="url(#glow)"/>`}
${dot}
${first ? `<text x="${x0}" y="${H - 14}" font-size="10" class="m">${esc(niceDate(first))}</text>` : ""}
${last ? `<text x="${x1}" y="${H - 14}" font-size="10" text-anchor="end" class="m">${esc(niceDate(last))} · today</text>` : ""}
${tile}`;
    return svg({ width: W, height: H, theme: t, title: `contribution heartbeat, last ${n} days`, css, defs, body });
  },
});
