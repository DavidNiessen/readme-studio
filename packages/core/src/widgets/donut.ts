import { esc } from "../lib/escape";
import { card, fitSize, fitText, svg, textWidth } from "../lib/svg";
import { dl, header, optBool, optList, optNum, optPick, optStr } from "./kit-d";
import { defineWidget } from "./types";

const W = 415;
const H = 228;

interface Slice {
  name: string;
  color: string;
  share: number;
}

function pct(v: number): string {
  const p = v * 100;
  return `${p >= 99.95 ? "100" : p < 0.1 && p > 0 ? "<0.1" : p.toFixed(1)}%`;
}

export const donut = defineWidget({
  type: "donut",
  title: "Language donut",
  description: "Your languages as a donut that draws itself in, with the top language in the centre and a percentage legend.",
  category: "Stats",
  kind: "svg",
  width: "half",
  needs: ["languages"],
  defaults: { label: "languages", slices: 6, percentages: true, centre: "top", hide: [] },
  fields: [
    { key: "label", label: "Label", type: "text" },
    { key: "slices", label: "Max slices", type: "number", min: 3, max: 8, step: 1, help: "Smaller languages are grouped as Other." },
    { key: "percentages", label: "Show percentages", type: "toggle" },
    {
      key: "centre",
      label: "Centre",
      type: "segmented",
      options: [
        { value: "top", label: "Top language" },
        { value: "count", label: "Language count" },
        { value: "none", label: "Empty" },
      ],
    },
    { key: "hide", label: "Hide languages", type: "tags", placeholder: "e.g. HTML", max: 20 },
  ],
  alt: () => "Most used languages",
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = optStr(o.label);
    const hide = new Set(optList(o.hide).map((s) => s.toLowerCase()));
    const langs = (ctx.data.languages ?? []).filter((l) => l && l.bytes > 0 && !hide.has(l.name.toLowerCase()));
    const total = langs.reduce((a, l) => a + l.bytes, 0);
    const max = optNum(o.slices, 6, 3, 8);
    const sorted = [...langs].sort((a, b) => b.bytes - a.bytes);
    const slices: Slice[] = sorted.slice(0, sorted.length > max ? max - 1 : max).map((l) => ({ name: l.name, color: l.color || t.subtle, share: l.bytes / total }));
    if (sorted.length > max) {
      const rest = sorted.slice(max - 1).reduce((a, l) => a + l.bytes, 0);
      slices.push({ name: `Other (${sorted.length - max + 1})`, color: t.subtle, share: rest / total });
    }
    const showPct = optBool(o.percentages, true);
    const centreMode = optPick(o.centre, ["top", "count", "none"], "top");

    const top = lbl ? 44 : 16;
    const cx = 24 + 78;
    const cy = top + (H - top - 16) / 2;
    const r = 62;
    const sw = 18;
    const C = 2 * Math.PI * r;
    const gap = slices.length > 1 ? 2.2 : 0;
    let acc = 0;
    const arcs = slices
      .map((s, i) => {
        const len = s.share * C;
        const seg = Math.max(0.01, len - gap);
        const rot = (acc / C) * 360 - 90;
        acc += len;
        const d0 = 0.3 + i * 0.12;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${seg.toFixed(2)} ${C.toFixed(2)}" transform="rotate(${rot.toFixed(2)} ${cx} ${cy})" class="arc" style="--l:${seg.toFixed(2)};animation-delay:${d0.toFixed(2)}s"/>`;
      })
      .join("");

    let centre = "";
    if (!slices.length) {
      centre = `<text x="${cx}" y="${cy + 4}" font-size="11.5" text-anchor="middle" class="m">no data</text>`;
    } else if (centreMode === "top") {
      const s = slices[0];
      const p = pct(s.share);
      const size = fitSize(t, p, 22, 2 * (r - sw / 2) - 18, 14, { bold: true, heading: true });
      centre = `<g class="in" style="${dl(0.9)}"><text x="${cx}" y="${cy + 3}" font-size="${size}" text-anchor="middle" class="t b h">${esc(p)}</text>
<text x="${cx}" y="${cy + 21}" font-size="10.5" text-anchor="middle" class="m">${esc(fitText(t, s.name, 10.5, 2 * (r - sw / 2) - 16))}</text></g>`;
    } else if (centreMode === "count") {
      centre = `<g class="in" style="${dl(0.9)}"><text x="${cx}" y="${cy + 6}" font-size="26" text-anchor="middle" class="t b h">${langs.length}</text>
<text x="${cx}" y="${cy + 22}" font-size="10" letter-spacing="1.2" text-anchor="middle" class="m">${langs.length === 1 ? "LANGUAGE" : "LANGUAGES"}</text></g>`;
    }

    const lx = 206;
    const rowH = slices.length > 7 ? 18 : 21;
    const ly = cy - ((slices.length - 1) * rowH) / 2;
    const legend = slices.length
      ? slices
          .map((s, i) => {
            const y = ly + i * rowH;
            const p = showPct ? pct(s.share) : "";
            const pw = p ? textWidth(t, p, 11.5, { bold: true }) + 10 : 0;
            const name = fitText(t, s.name, 12, W - 24 - (lx + 16) - pw);
            return `<g class="in" style="${dl(0.45 + i * 0.08)}">
<rect x="${lx}" y="${(y - 8.5).toFixed(1)}" width="9" height="9" rx="2.5" fill="${s.color}"/>
<text x="${lx + 17}" y="${y.toFixed(1)}" font-size="12" class="${i === 0 ? "t b" : "t"}">${esc(name)}</text>
${p ? `<text x="${W - 24}" y="${y.toFixed(1)}" font-size="11.5" text-anchor="end" class="m${i === 0 ? " b" : ""}">${esc(p)}</text>` : ""}
</g>`;
          })
          .join("")
      : `<g class="in" style="${dl(0.4)}"><text x="${lx}" y="${cy - 4}" font-size="13" class="t b">No language data yet</text><text x="${lx}" y="${cy + 14}" font-size="11" class="m">${esc(fitText(t, "Push some code to public repos.", 11, W - 24 - lx))}</text></g>`;

    const css = `.arc{animation:arcIn 1s cubic-bezier(.3,.7,.2,1) both}@keyframes arcIn{from{stroke-dashoffset:var(--l)}to{stroke-dashoffset:0}}
.spinH{transform-origin:${cx}px ${cy}px;animation:spin 24s linear infinite}`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${t.heat[0]}" stroke-width="${sw}" class="fade"/>
<circle cx="${cx}" cy="${cy}" r="${r + sw / 2 + 6}" stroke="${t.border}" stroke-dasharray="1.5 5" class="spinH loop"/>
${arcs}
${centre}
${legend}`;
    return svg({ width: W, height: H, theme: t, title: "Most used languages", css, body });
  },
});
