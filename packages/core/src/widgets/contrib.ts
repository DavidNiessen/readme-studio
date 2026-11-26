import { monthName } from "../lib/astro";
import { esc, groupDigits } from "../lib/escape";
import { card, label, svg, textWidth } from "../lib/svg";
import { onAccent } from "./parts";
import { defineWidget } from "./types";

const W = 840;
const CELL = 11;
const STEP = 14;
const GX = 58;

export function niceDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${monthName(m)} ${d}`;
}

export const contrib = defineWidget({
  type: "contrib",
  title: "Contribution graph",
  description: "Your last 12 months as an animated heatmap with a scanning beam, best-day callout and weekly totals.",
  scope: "profile",
  category: "Activity",
  kind: "svg",
  width: "full",
  needs: ["calendar"],
  defaults: {
    label: "contributions · last 12 months",
    shape: "rounded",
    weekly: true,
    callout: true,
    beam: true,
    legend: true,
  },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "shape",
      label: "Cell shape",
      type: "segmented",
      options: [
        { value: "rounded", label: "Rounded" },
        { value: "square", label: "Square" },
        { value: "circle", label: "Dots" },
      ],
    },
    { key: "weekly", label: "Weekly totals", type: "toggle" },
    { key: "callout", label: "Best-day callout", type: "toggle" },
    { key: "beam", label: "Scanning beam", type: "toggle" },
    { key: "legend", label: "Legend", type: "toggle" },
  ],
  alt: () => "animated contribution graph",
  render(ctx, o) {
    const t = ctx.theme;
    const weeks = ctx.data.weeks.slice(-53);
    const best = ctx.d.best;
    const GY = o.callout ? 84 : 62;
    const gridW = weeks.length * STEP;
    const by = GY + 7 * STEP + 44;
    const H = (o.weekly ? by : GY + 7 * STEP) + (o.legend || o.weekly ? 46 : 24);
    const rx = o.shape === "square" ? 1 : o.shape === "circle" ? CELL / 2 : 2.5;
    const cells: string[] = [];
    let bestPos: [number, number] | null = null;
    weeks.forEach((w, c) => {
      w.forEach((day) => {
        const r = day.weekday;
        const x = GX + c * STEP;
        const y = GY + r * STEP;
        const delay = 0.2 + (c + r * 2) * 0.016;
        if (best && day.date === best.date && best.count > 0) bestPos = [x + CELL / 2, y + CELL / 2];
        cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="${rx}" fill="${t.heat[day.level]}" class="fx" style="animation:pop .45s ease ${delay.toFixed(2)}s both"/>`);
      });
    });
    const months: string[] = [];
    let lastMonth = -1;
    weeks.forEach((w, c) => {
      if (!w.length) return;
      const m = Number(w[0].date.slice(5, 7));
      if (m !== lastMonth) {
        if (c < weeks.length - 2 && (lastMonth !== -1 || w[0].date.slice(8) <= "07")) {
          months.push(`<text x="${GX + c * STEP}" y="${GY - 10}" font-size="10.5" class="m fade" style="animation-delay:${(0.2 + c * 0.016).toFixed(2)}s">${monthName(m)}</text>`);
        }
        lastMonth = m;
      }
    });
    const dayLabels = (
      [
        [1, "Mon"],
        [3, "Wed"],
        [5, "Fri"],
      ] as const
    )
      .map(([r, l]) => `<text x="${GX - 10}" y="${GY + r * STEP + 9}" font-size="10" text-anchor="end" class="m">${l}</text>`)
      .join("");

    const weekly = weeks.map((w) => w.reduce((a, d) => a + d.count, 0));
    const wMax = Math.max(1, ...weekly);
    const bars = o.weekly
      ? weekly
          .map((v, c) => {
            const h = Math.max(1.5, (v / wMax) * 34);
            return `<rect x="${GX + c * STEP}" y="${(by - h).toFixed(1)}" width="${CELL}" height="${h.toFixed(1)}" rx="2" fill="${v === wMax ? t.accent : t.subtle}" style="transform-origin:bottom;transform-box:fill-box;animation:grow .6s cubic-bezier(.2,.7,.2,1) ${(1.2 + c * 0.012).toFixed(2)}s both"/>`;
          })
          .join("")
      : "";
    const legend = o.legend
      ? `<text x="${W - 140}" y="${H - 18.5}" font-size="10.5" text-anchor="end" class="m">less</text>${t.heat
          .map((c, i) => `<rect x="${W - 132 + i * 14}" y="${H - 28}" width="${CELL}" height="${CELL}" rx="${rx}" fill="${c}"/>`)
          .join("")}<text x="${W - 58}" y="${H - 18.5}" font-size="10.5" class="m">more</text>`
      : "";

    let callout = "";
    if (o.callout && bestPos && best) {
      const [bx, bY] = bestPos as [number, number];
      const text = `best day · ${best.count} on ${niceDate(best.date)}`;
      const tw = textWidth(t, text, 11, { bold: true }) + 20;
      const left = Math.min(Math.max(bx - tw / 2, GX), GX + gridW - tw);
      callout = `<g class="in" style="animation-delay:2.4s">
<circle cx="${bx}" cy="${bY}" r="9" stroke="${t.glow}" stroke-width="1.5" class="fx loop" style="animation:ping 1.8s ease-out 2.4s infinite"/>
<rect x="${bx - 7.5}" y="${bY - 7.5}" width="15" height="15" rx="4" stroke="${t.text}" stroke-width="1.5"/>
<path d="M${bx} ${bY - 9}V${GY - 22}" stroke="${t.glow}" stroke-dasharray="2 2"/>
<rect x="${left.toFixed(1)}" y="${GY - 42}" width="${tw.toFixed(1)}" height="20" rx="10" fill="${t.accent}"/>
<text x="${(left + tw / 2).toFixed(1)}" y="${GY - 28.5}" font-size="11" text-anchor="middle" fill="${onAccent(t)}" class="b">${esc(text)}</text>
</g>`;
    }

    const css = `
@keyframes ping{0%{transform:scale(.6);opacity:1}100%{transform:scale(2.2);opacity:0}}
.beam{animation:beam 7s cubic-bezier(.45,0,.55,1) 2s infinite}
@keyframes beam{0%{transform:translateX(0);opacity:0}5%{opacity:1}45%{opacity:1}50%{transform:translateX(${gridW + 40}px);opacity:0}100%{transform:translateX(${gridW + 40}px);opacity:0}}`;
    const defs = `<linearGradient id="beamG" x1="0" x2="1"><stop offset="0" stop-color="${t.glow}" stop-opacity="0"/><stop offset=".9" stop-color="${t.glow}" stop-opacity="${t.name === "dark" ? 0.35 : 0.25}"/><stop offset="1" stop-color="${t.name === "dark" ? "#fff" : t.glow}" stop-opacity=".9"/></linearGradient>
<clipPath id="gridClip"><rect x="${GX - 4}" y="${GY - 4}" width="${gridW + 8}" height="${7 * STEP + 8}"/></clipPath>`;
    const total = groupDigits(ctx.data.lastYearTotal);
    const body = `${card(t, { width: W, height: H })}
${o.label ? label(t, 24, 30, o.label as string) : ""}
<text x="${W - 24}" y="30" font-size="12" text-anchor="end" class="m fade"><tspan class="t b" font-size="14">${total}</tspan> in the last year · <tspan class="t b" font-size="14">${ctx.d.active}</tspan> active days</text>
${months.join("")}
${dayLabels}
${cells.join("")}
${o.beam ? `<g clip-path="url(#gridClip)"><g class="beam loop loop-only"><rect x="${GX - 60}" y="${GY - 4}" width="60" height="${7 * STEP + 8}" fill="url(#beamG)"/></g></g>` : ""}
${callout}
${
  o.weekly
    ? `<path d="M${GX} ${by + 0.5}H${GX + gridW - 3}" stroke="${t.border}"/>
${bars}
<text x="${GX - 10}" y="${by - 2}" font-size="10" text-anchor="end" class="m">wk</text>
<text x="${GX}" y="${H - 18}" font-size="10.5" class="m">weekly totals · peak <tspan class="a b">${wMax}</tspan></text>`
    : ""
}
${legend}`;
    return svg({ width: W, height: H, theme: t, title: "animated contribution graph", css, defs, body });
  },
});
