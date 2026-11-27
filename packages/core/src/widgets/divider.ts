import { svg } from "../lib/svg";
import { defineWidget } from "./types";

const W = 840;

export const divider = defineWidget({
  type: "divider",
  title: "Divider",
  description: "A thin animated separator between sections: comet, pulse, wave, dashes or a fading line.",
  category: "Decoration",
  kind: "svg",
  width: "full",
  defaults: { style: "comet", ornament: true },
  fields: [
    {
      key: "style",
      label: "Style",
      type: "select",
      options: [
        { value: "comet", label: "Comet trail" },
        { value: "pulse", label: "Heartbeat pulse" },
        { value: "wave", label: "Sine wave" },
        { value: "dashes", label: "Marching dashes" },
        { value: "line", label: "Fading hairline" },
      ],
    },
    { key: "ornament", label: "Centre ornament", type: "toggle" },
  ],
  alt: () => "divider",
  render(ctx, o) {
    const t = ctx.theme;
    const H = o.style === "wave" || o.style === "pulse" ? 40 : 28;
    const mid = H / 2;
    const defs = `<linearGradient id="cometG" x1="0" x2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset=".85" stop-color="${t.glow}"/><stop offset="1" stop-color="${t.name === "dark" ? "#fff" : t.glow}"/></linearGradient>
<linearGradient id="lineG" x1="0" x2="1"><stop offset="0" stop-color="${t.border}" stop-opacity="0"/><stop offset=".5" stop-color="${t.subtle}"/><stop offset="1" stop-color="${t.border}" stop-opacity="0"/></linearGradient>
<linearGradient id="fadeA" x1="0" x2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>`;
    let css = `.tick{animation:pulse 2.4s ease-in-out infinite}`;
    let line = "";
    switch (o.style) {
      case "pulse": {
        let d = `M0 ${mid}`;
        for (let x = 0; x < W; x += 140) d += ` H${x + 50} l8 -12 l10 24 l8 -18 l6 6 H${x + 140}`;
        css += `.ekg{stroke-dasharray:240 ${W * 2};animation:ekg 3.2s linear infinite}@keyframes ekg{from{stroke-dashoffset:240}to{stroke-dashoffset:-${W * 1.6}}}`;
        line = `<path d="${d}" stroke="${t.border}" stroke-width="1.2" fill="none"/><path class="ekg loop loop-only" d="${d}" stroke="${t.glow}" stroke-width="2" fill="none" filter="url(#glow)" stroke-linecap="round" stroke-linejoin="round"/>`;
        break;
      }
      case "wave": {
        let d = `M-60 ${mid}`;
        for (let x = -60; x < W + 120; x += 60) d += ` q15 -9 30 0 t30 0`;
        css += `.wv{animation:wv 4s linear infinite}@keyframes wv{to{transform:translateX(60px)}}`;
        line = `<path d="${d}" stroke="url(#lineG)" stroke-width="1"/><g class="wv loop"><path d="${d}" stroke="url(#fadeA)" stroke-width="1.6" fill="none"/></g>`;
        break;
      }
      case "dashes":
        css += `.march{animation:march 1.2s linear infinite}@keyframes march{to{stroke-dashoffset:-16}}`;
        line = `<path class="march loop" d="M0 ${mid}H${W}" stroke="url(#lineG)" stroke-width="2" stroke-dasharray="8 8"/>`;
        break;
      case "line":
        css += `.grow{transform-box:fill-box;transform-origin:center;animation:growX 1.4s cubic-bezier(.2,.7,.2,1) both}`;
        line = `<rect class="grow" x="0" y="${mid - 0.5}" width="${W}" height="1" fill="url(#lineG)"/><rect class="grow" x="${W / 2 - 120}" y="${mid - 0.75}" width="240" height="1.5" fill="url(#fadeA)"/>`;
        break;
      default:
        css += `.comet{animation:comet 5s cubic-bezier(.6,0,.4,1) infinite}@keyframes comet{0%{transform:translateX(-160px)}100%{transform:translateX(${W + 40}px)}}`;
        line = `<rect x="0" y="${mid - 0.5}" width="${W}" height="1" fill="url(#lineG)"/><g class="comet loop loop-only"><rect x="0" y="${mid - 1}" width="140" height="2" rx="1" fill="url(#cometG)" filter="url(#glow)"/></g>`;
    }
    const ornament = o.ornament
      ? `<rect x="${W / 2 - 34}" y="${mid - 6}" width="68" height="12" fill="${t.surface ? t.bg : t.bg}"/>${Array.from({ length: 3 }, (_, i) => {
          const x = W / 2 - 16 + i * 16;
          return `<rect class="tick loop" style="animation-delay:${i * 0.3}s" x="${x - 3}" y="${mid - 3}" width="6" height="6" rx="1.5" transform="rotate(45 ${x} ${mid})" fill="${i === 1 ? t.accent : t.subtle}"/>`;
        }).join("")}`
      : "";
    return svg({ width: W, height: H, theme: t, title: "divider", css, defs, body: line + ornament, fonts: false });
  },
});
