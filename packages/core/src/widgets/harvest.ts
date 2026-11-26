import { esc, groupDigits } from "../lib/escape";
import { odometerWidth } from "../lib/odometer";
import { card, f, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { TNUM, dl, header, optBool, optPick, optStr, shortDate } from "./kit-d";
import { defineWidget } from "./types";

const W = 840;
const CELL = 11;
const STEP = 14;
const GX = 58;
/** loop length in seconds */
const P = 12;
/** first column is collected at this time; one column every DT seconds */
const T0 = 0.9;
const SPEEDS = { calm: 0.13, brisk: 0.1 } as const;
/** grid regrows from this time, in a quick left-to-right wave */
const REGROW = 8.2;
const PARK = W - 26;

const pc = (s: number) => `${Math.max(0, Math.min(100, (s / P) * 100)).toFixed(2)}%`;

/** A rolling counter whose digits tally up during the sweep and reset at the end of each loop. */
function tally(t: Theme, value: string, xRight: number, y: number, size: number, start: number, end: number): { svg: string; css: string; w: number } {
  const adv = textWidth(t, "0", size, { bold: true, heading: true });
  const chars = [...value];
  const advOf = (c: string) => (c === " " ? adv * 0.45 : /\d/.test(c) ? adv : textWidth(t, c, size, { bold: true, heading: true }));
  const width = chars.reduce((a, c) => a + advOf(c), 0);
  const x0 = xRight - width;
  const lineH = size * 1.25;
  const digits = chars.filter((c) => /\d/.test(c)).length;
  const cols: string[] = [];
  const css: string[] = [];
  let x = x0;
  let di = 0;
  for (const c of chars) {
    if (/\d/.test(c)) {
      const loops = Math.max(0, digits - 1 - di);
      const d = Number(c);
      const n = loops * 10 + d;
      const strip = Array.from({ length: n + 1 }, (_, k) => `<text x="${f(x)}" y="${f(y + k * lineH)}" font-size="${size}" class="t b h">${k % 10}</text>`).join("");
      const Y = f(n * lineH);
      css.push(`@keyframes tl${di}{0%,${pc(start)}{transform:translateY(0);animation-timing-function:cubic-bezier(.35,0,.65,1)}${pc(end)},${pc(P - 0.5)}{transform:translateY(-${Y}px)}${pc(P - 0.3)},100%{transform:translateY(0)}}`);
      cols.push(`<g class="loop" style="transform:translateY(-${Y}px);animation:tl${di} ${P}s linear infinite">${strip}</g>`);
      di++;
    } else if (c !== " ") {
      cols.push(`<text x="${f(x)}" y="${f(y)}" font-size="${size}" class="t b h">${esc(c)}</text>`);
    }
    x += advOf(c);
  }
  css.push(`@keyframes tfade{0%,${pc(P - 0.6)}{opacity:1}${pc(P - 0.45)},${pc(P - 0.2)}{opacity:0}100%{opacity:1}}`);
  return {
    w: width,
    css: css.join("\n"),
    svg: `<clipPath id="tclip"><rect x="${f(x0 - 2)}" y="${f(y - size * 0.95)}" width="${f(width + 4)}" height="${f(lineH)}"/></clipPath><g clip-path="url(#tclip)"><g class="loop" style="animation:tfade ${P}s linear infinite">${cols.join("")}</g></g>`,
  };
}

function drone(t: Theme, dy: number, beamBottom: number, beam: boolean): string {
  return `${
    beam
      ? `<path d="M-5 ${dy + 5}H5L13 ${beamBottom}H-13Z" fill="url(#beamG)"/><path d="M0 ${dy + 6}V${beamBottom}" stroke="${t.glow}" stroke-width="1.2" opacity=".7"/>`
      : ""
  }
<g class="bob loop">
<path d="M-15 ${dy - 6}H-5M5 ${dy - 6}H15" stroke="${t.muted}" stroke-width="1.6" stroke-linecap="round" class="rotor loop"/>
<path d="M-10 ${dy - 6}V${dy - 3}M10 ${dy - 6}V${dy - 3}" stroke="${t.muted}" stroke-width="1.4"/>
<rect x="-12" y="${dy - 4}" width="24" height="9" rx="4.5" fill="${t.raised}" stroke="${t.accent}" stroke-width="1.4"/>
<circle cx="0" cy="${dy + 0.5}" r="2.6" fill="${t.glow}" filter="url(#glow)"/>
</g>`;
}

export const harvest = defineWidget({
  type: "harvest",
  title: "Contribution harvester",
  description: "A scanner drone glides over your contribution graph, harvesting every lit cell into a running tally before the grid regrows.",
  category: "Activity",
  kind: "svg",
  width: "full",
  needs: ["calendar"],
  defaults: { label: "contribution harvest", speed: "calm", beam: true, legend: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "speed",
      label: "Drone speed",
      type: "segmented",
      options: [
        { value: "calm", label: "Calm" },
        { value: "brisk", label: "Brisk" },
      ],
    },
    { key: "beam", label: "Scanner beam", type: "toggle" },
    { key: "legend", label: "Legend & summary", type: "toggle" },
  ],
  alt: () => "A drone harvesting the contribution graph",
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = optStr(o.label);
    const weeks = ctx.data.weeks.slice(-53);
    const animate = t.motion === "full";
    const dt = SPEEDS[optPick(o.speed, ["calm", "brisk"], "calm")];
    const beam = optBool(o.beam, true);
    const legend = optBool(o.legend, true);
    const total = weeks.reduce((a, w) => a + w.reduce((b, d) => b + d.count, 0), 0);
    const active = weeks.reduce((a, w) => a + w.filter((d) => d.count > 0).length, 0);

    const GY = 92;
    const H = GY + 7 * STEP + (legend ? 46 : 22);
    const dy = GY - 20;
    const beamBottom = GY + 7 * STEP - 2;

    // ---------------------------------------------------------- counter
    const totalStr = groupDigits(total);
    const cSize = 26;
    const cY = 44;
    const counter = animate ? tally(t, totalStr, W - 24, cY, cSize, T0, T0 + (weeks.length - 1) * dt + 0.6) : null;
    const cW = counter ? counter.w : odometerWidth(t, totalStr, cSize, true, true);
    const counterSvg = `${counter ? counter.svg : `<text x="${W - 24}" y="${cY}" font-size="${cSize}" text-anchor="end" class="t b h">${esc(totalStr)}</text>`}
<text x="${f(W - 24 - cW - 10)}" y="${cY}" font-size="11" text-anchor="end" class="m">harvested</text>`;
    const tx = W - 24 - cW / 2;
    const ty = cY - cSize * 0.35;

    // ---------------------------------------------------------- cells
    const sockets: string[] = [];
    const lit: string[] = [];
    const parts: string[] = [];
    const colCss: string[] = [];
    weeks.forEach((w, c) => {
      const Tc = T0 + c * dt;
      const Rc = REGROW + c * 0.022;
      if (animate) {
        colCss.push(
          `@keyframes h${c}{0%,${pc(Tc - 0.04)}{transform:scale(1);opacity:1}${pc(Tc + 0.06)}{transform:scale(1.35);opacity:1}${pc(Tc + 0.3)},${pc(Rc)}{transform:scale(0);opacity:0}${pc(Rc + 0.32)}{transform:scale(1.18);opacity:1}${pc(Rc + 0.5)},100%{transform:scale(1);opacity:1}}.c${c}{animation:h${c} ${P}s linear infinite}.p${c}{animation-delay:${Tc.toFixed(2)}s}`,
        );
      }
      w.forEach((day) => {
        const x = GX + c * STEP;
        const y = GY + day.weekday * STEP;
        sockets.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5"/>`);
        if (day.count > 0) {
          lit.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${t.heat[day.level || 1]}"${animate ? ` class="fx loop c${c}"` : ""}/>`);
          if (animate) {
            const cx = x + CELL / 2;
            const cy = y + CELL / 2;
            parts.push(`<g class="px p${c}" style="--dx:${f(tx - cx)}px"><circle class="py p${c}" style="--dy:${f(ty - cy)}px" cx="${f(cx)}" cy="${f(cy)}" r="${day.level >= 3 ? 2.8 : 2.2}"/></g>`);
          }
        }
      });
    });

    // ---------------------------------------------------------- drone path
    const tStart = T0 + ((-30 - (GX + CELL / 2)) / STEP) * dt;
    const tEnd = T0 + ((W + 30 - (GX + CELL / 2)) / STEP) * dt;
    const droneCss = `@keyframes fly{0%,${pc(Math.max(0, tStart))}{transform:translateX(${f(-30 - PARK)}px)}${pc(tEnd)},100%{transform:translateX(${f(W + 30 - PARK)}px)}}`;

    const css = animate
      ? `${TNUM}
.drone{animation:fly ${P}s linear infinite}
${droneCss}
.bob{animation:bob 1.4s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
.rotor{transform-box:fill-box;transform-origin:center;animation:rotor .18s linear infinite}
@keyframes rotor{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.35)}}
.px{opacity:0;animation:px ${P}s linear infinite}
.py{fill:${t.glow};animation:py ${P}s linear infinite}
@keyframes px{0%{opacity:0;transform:translateX(0);animation-timing-function:cubic-bezier(.6,0,.9,.6)}1%{opacity:1}7%{opacity:1;transform:translateX(var(--dx))}7.6%,100%{opacity:0;transform:translateX(var(--dx))}}
@keyframes py{0%{transform:translateY(0);animation-timing-function:cubic-bezier(.1,.5,.4,1)}7%,100%{transform:translateY(var(--dy))}}
${colCss.join("\n")}
${counter?.css ?? ""}
.ping{transform-box:fill-box;transform-origin:center;animation:hping ${P}s ease-out infinite}
@keyframes hping{0%,${pc(T0 + 0.6)}{opacity:0;transform:scale(.6)}${pc(T0 + 0.8)}{opacity:.7}${pc(T0 + (weeks.length - 1) * dt + 1.2)}{opacity:.25;transform:scale(1)}${pc(T0 + (weeks.length - 1) * dt + 1.8)},100%{opacity:0;transform:scale(1.4)}}`
      : TNUM;
    const defs = `<linearGradient id="beamG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.name === "dark" ? 0.4 : 0.3}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></linearGradient>
<clipPath id="hclip"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${t.radius}"/></clipPath>`;

    const dayLabels = (
      [
        [1, "Mon"],
        [3, "Wed"],
        [5, "Fri"],
      ] as const
    )
      .map(([r, l]) => `<text x="${GX - 10}" y="${GY + r * STEP + 9}" font-size="10" text-anchor="end" class="m">${l}</text>`)
      .join("");
    const best = ctx.d.best;
    const foot = legend
      ? `<text x="${GX}" y="${H - 18}" font-size="11" class="m fade" style="${dl(0.8)}">${
          total > 0
            ? `${groupDigits(active)} active days · ${weeks.length} weeks scanned${best && best.count > 0 ? ` · richest cell <tspan class="t b">${best.count}</tspan> on ${esc(shortDate(best.date))}` : ""}`
            : "Nothing to harvest yet · the drone will be back after your next contribution"
        }</text>
<text x="${W - 140}" y="${H - 18.5}" font-size="10.5" text-anchor="end" class="m">less</text>${t.heat
          .map((c, i) => `<rect x="${W - 132 + i * 14}" y="${H - 28}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c}"/>`)
          .join("")}<text x="${W - 58}" y="${H - 18.5}" font-size="10.5" class="m">more</text>`
      : "";
    const droneSvg = animate
      ? `<g clip-path="url(#hclip)"><g transform="translate(${PARK} 0)"><g class="drone loop loop-only">${drone(t, dy, beamBottom, beam)}</g></g></g>`
      : `<g transform="translate(${PARK} 0)" class="fade" style="${dl(0.6)}">${drone(t, dy, beamBottom, false)}</g>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
<g class="in tn" style="${dl(0.2)}">${counterSvg}</g>
${animate ? `<circle cx="${f(tx)}" cy="${f(ty)}" r="20" fill="${t.accent}" opacity="0" filter="url(#softglow)" class="ping loop loop-only"/>` : ""}
${dayLabels}
<g fill="${t.heat[0]}" class="fade" style="${dl(0.1)}">${sockets.join("")}</g>
<g class="fade" style="${dl(0.2)}">${lit.join("")}</g>
${droneSvg}
${animate ? `<g class="loop-only">${parts.join("")}</g>` : ""}
${foot}`;
    return svg({ width: W, height: H, theme: t, title: "A drone harvesting the contribution graph", css, defs, body });
  },
});
