import { pad2, zoneAbbr } from "../lib/astro";
import { esc } from "../lib/escape";
import { cardStroke, fitText, surfaceFill, svg } from "../lib/svg";
import { hash01 } from "./parts";
import { defineWidget } from "./types";

const W = 840;
const H = 130;

function wave(amp: number, len: number, y: number, width: number): string {
  let d = `M0 ${y}`;
  for (let x = 0; x <= width; x += len) d += ` Q${x + len / 4} ${y - amp} ${x + len / 2} ${y} T${x + len} ${y}`;
  return `${d} V${H} H0 Z`;
}

export const footer = defineWidget({
  type: "footer",
  title: "Footer",
  description: "Rolling waves, a date barcode and a build stamp that proves the profile is alive.",
  category: "Decoration",
  kind: "svg",
  width: "full",
  defaults: { message: "rebuilt every night by readme studio", stamp: true, barcode: true, waves: true },
  fields: [
    { key: "message", label: "Message", type: "text" },
    { key: "stamp", label: "Build stamp", type: "toggle", help: "Date, time, run number and data source." },
    { key: "barcode", label: "Date barcode", type: "toggle" },
    { key: "waves", label: "Waves", type: "toggle" },
  ],
  alt: () => "footer",
  render(ctx, o) {
    const t = ctx.theme;
    const n = ctx.now;
    const stamp = `${n.year}-${pad2(n.month)}-${pad2(n.day)}`;
    const bars: string[] = [];
    let x = 24;
    for (let i = 0; x < 214; i++) {
      const w = 1 + Math.floor(hash01(stamp, i) * 3);
      if (i % 2 === 0) bars.push(`<rect x="${x}" y="22" width="${w}" height="34" fill="${t.text}"/>`);
      x += w + 1;
    }
    const css = `.w1{animation:wv 7s linear infinite}.w2{animation:wv 11s linear infinite reverse}.w3{animation:wv 15s linear infinite}
@keyframes wv{to{transform:translateX(-120px)}}`;
    const defs = `<clipPath id="fc"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${t.radius}"/></clipPath>`;
    const run = ctx.run ? ` · run #${ctx.run}` : "";
    const tz = zoneAbbr(ctx.date, ctx.profile.location.timezone);
    const right = o.barcode ? W - 24 : W / 2;
    const anchor = o.barcode ? "end" : "middle";
    const maxW = o.barcode ? 560 : 780;
    const body = `<g clip-path="url(#fc)">
<rect width="${W}" height="${H}" fill="${surfaceFill(t)}"/>
${
  o.waves
    ? `<path class="w3 loop" d="${wave(6, 120, 96, W + 240)}" fill="${t.accent}" opacity=".12"/>
<path class="w2 loop" d="${wave(8, 120, 104, W + 240)}" fill="${t.accent}" opacity=".18"/>
<path class="w1 loop" d="${wave(5, 120, 112, W + 240)}" fill="${t.accent}" opacity=".35"/>`
    : ""
}
</g>
${cardStroke(t, W, H)}
${o.barcode ? `<g class="fade">${bars.join("")}</g><text x="24" y="70" font-size="9.5" letter-spacing="2" class="m">${stamp.replace(/-/g, " ")}</text>` : ""}
<g class="in" style="animation-delay:.3s">
<text x="${right}" y="${o.stamp ? 34 : 44}" font-size="13" text-anchor="${anchor}" class="t b">${esc(fitText(t, o.message as string, 13, maxW, { bold: true }))}</text>
${o.stamp ? `<text x="${right}" y="54" font-size="11" text-anchor="${anchor}" class="m">${esc(fitText(t, `last build ${stamp} ${pad2(n.hour)}:${pad2(n.minute)} ${tz}${run} · ${ctx.data.source} data`, 11, maxW))}</text>` : ""}
</g>`;
    return svg({ width: W, height: H, theme: t, title: "footer", css, defs, body });
  },
});
