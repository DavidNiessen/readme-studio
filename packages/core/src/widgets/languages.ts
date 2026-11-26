import { esc, num } from "../lib/escape";
import { card, fitSize, fitText, label, svg, textWidth } from "../lib/svg";
import { accentDeep } from "./parts";
import { defineWidget } from "./types";

const W = 415;
const EASE = "cubic-bezier(.2,.7,.2,1)";

interface Row {
  name: string;
  color: string;
  bytes: number;
  pct: number;
}

export const languages = defineWidget({
  type: "languages",
  title: "Top languages",
  description: "Your most used languages by bytes of code, as an animated donut, bar list or stacked bar.",
  category: "Stats",
  kind: "svg",
  width: "half",
  needs: ["languages"],
  defaults: { label: "languages", max: 5, style: "donut", hide: [] as string[] },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "style",
      label: "Style",
      type: "segmented",
      options: [
        { value: "donut", label: "Donut" },
        { value: "bars", label: "Bars" },
        { value: "stacked", label: "Stacked" },
      ],
    },
    { key: "max", label: "Languages shown", type: "number", min: 3, max: 10, step: 1, help: "The rest are grouped as Other." },
    { key: "hide", label: "Hide languages", type: "tags", placeholder: "HTML", max: 20 },
  ],
  alt: () => "most used languages",
  href: (ctx) => `https://github.com/${ctx.profile.login}?tab=repositories`,
  render(ctx, o) {
    const t = ctx.theme;
    const fallback = [t.accent, t.glow, t.accent2, accentDeep(t), t.muted, t.subtle];
    const hide = new Set((Array.isArray(o.hide) ? o.hide : []).filter((h): h is string => typeof h === "string").map((h) => h.trim().toLowerCase()));
    const all = ctx.data.languages.filter((l) => l.bytes > 0 && !hide.has(l.name.toLowerCase()));
    const total = all.reduce((a, l) => a + l.bytes, 0) || 1;
    const max = Math.max(3, Math.min(10, Math.round(Number(o.max) || 5)));
    const top = all.slice(0, max);
    const rest = all.slice(max).reduce((a, l) => a + l.bytes, 0);
    const rows: Row[] = [
      ...top.map((l, i) => ({ name: l.name, color: l.color || fallback[i % fallback.length], bytes: l.bytes, pct: (l.bytes / total) * 100 })),
      ...(rest > 0 ? [{ name: "Other", color: t.subtle, bytes: rest, pct: (rest / total) * 100 }] : []),
    ];
    const style = o.style === "bars" || o.style === "stacked" ? o.style : "donut";
    const lbl = String(o.label ?? "");
    const y0 = lbl ? 56 : 28;
    const right = W - 24;
    const pctText = (p: number) => `${num(p, 1)}%`;
    const lead = rows[0];
    let H = 0;
    let content = "";
    let css = "";

    if (style === "donut") {
      const rowH = rows.length <= 6 ? 34 : 26;
      H = Math.max(300, y0 + 26 + rows.length * rowH + 40);
      const cx = 108;
      const cy = Math.round((y0 + H - 36) / 2) + 4;
      const r = 70;
      const C = 2 * Math.PI * r;
      let acc = 0;
      const segs = rows
        .map((l, i) => {
          const frac = l.bytes / total;
          const len = Math.max(0.5, frac * C - (rows.length > 1 ? 3 : 0));
          const start = acc;
          acc += frac * C;
          const d = 0.3 + i * 0.22;
          return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${l.color}" stroke-width="20" stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-start).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" style="--len:${len.toFixed(1)};stroke-dasharray:0 ${C.toFixed(1)};animation:seg .7s ${EASE} ${d.toFixed(2)}s forwards"/>`;
        })
        .join("");
      css = `@keyframes seg{to{stroke-dasharray:var(--len) ${C.toFixed(1)}}}
.spinring{transform-origin:${cx}px ${cy}px;animation:spin 20s linear infinite}`;
      const lx = 214;
      const ly = cy - ((rows.length - 1) * rowH) / 2 - (rowH === 34 ? 4 : 2);
      const legend = rows
        .map((l, i) => {
          const y = ly + i * rowH;
          const pct = pctText(l.pct);
          const pw = textWidth(t, pct, 12);
          const bw = Math.max(3, (l.pct / rows[0].pct) * (right - lx));
          const d = 0.5 + i * 0.12;
          return `<g class="in" style="animation-delay:${d.toFixed(2)}s">
<rect x="${lx}" y="${y - 9}" width="8" height="8" rx="2" fill="${l.color}"/>
<text x="${lx + 16}" y="${y}" font-size="12" class="t b">${esc(fitText(t, l.name, 12, right - lx - 16 - pw - 8, { bold: true }))}</text>
<text x="${right}" y="${y}" font-size="12" text-anchor="end" class="m">${pct}</text>
<rect x="${lx}" y="${y + 7}" width="${right - lx}" height="3" rx="1.5" fill="${t.raised}"/>
<rect x="${lx}" y="${y + 7}" width="${bw.toFixed(1)}" height="3" rx="1.5" fill="${l.color}" style="transform-box:fill-box;transform-origin:left;animation:growX .9s ${EASE} ${(d + 0.2).toFixed(2)}s both"/>
</g>`;
        })
        .join("");
      const centre = lead
        ? `<text x="${cx}" y="${cy - 2}" font-size="24" text-anchor="middle" class="t b h fade" style="animation-delay:1.2s">${num(lead.pct, 0)}%</text>
<text x="${cx}" y="${cy + 18}" font-size="${fitSize(t, lead.name, 11, 96, 8)}" text-anchor="middle" class="m fade" style="animation-delay:1.3s">${esc(fitText(t, lead.name, 8, 96))}</text>`
        : `<text x="${cx}" y="${cy + 4}" font-size="12" text-anchor="middle" class="m">no data</text>`;
      content = `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${t.raised}" stroke-width="20"/>
<g class="spinring loop"><circle cx="${cx}" cy="${cy}" r="${r + 17}" stroke="${t.subtle}" stroke-dasharray="2 9"/></g>
${segs}
${centre}
${rows.length ? legend : `<text x="${lx}" y="${cy - 4}" font-size="12" class="t b">No language data yet</text><text x="${lx}" y="${cy + 14}" font-size="11" class="m">${esc(fitText(t, "push some code to get started", 11, right - lx))}</text>`}`;
    } else if (style === "bars") {
      const rowH = rows.length <= 6 ? 40 : 34;
      const first = y0 + 22;
      H = Math.max(rows.length ? 0 : 180, first + Math.max(1, rows.length) * rowH + 30);
      content = rows.length
        ? rows
            .map((l, i) => {
              const y = first + i * rowH;
              const pct = pctText(l.pct);
              const pw = textWidth(t, pct, 12, { bold: true });
              const bw = Math.max(6, (l.pct / rows[0].pct) * (right - 24));
              const d = 0.2 + i * 0.1;
              return `<g class="in" style="animation-delay:${d.toFixed(2)}s">
<rect x="24" y="${y - 10}" width="8" height="8" rx="2" fill="${l.color}"/>
<text x="40" y="${y - 1}" font-size="12.5" class="t b">${esc(fitText(t, l.name, 12.5, right - 40 - pw - 10, { bold: true }))}</text>
<text x="${right}" y="${y - 1}" font-size="12" text-anchor="end" class="m b">${pct}</text>
<rect x="24" y="${y + 7}" width="${right - 24}" height="8" rx="4" fill="${t.raised}"/>
<rect x="24" y="${y + 7}" width="${bw.toFixed(1)}" height="8" rx="4" fill="${l.color}" style="transform-box:fill-box;transform-origin:left;animation:growX .9s ${EASE} ${(d + 0.15).toFixed(2)}s both"/>
</g>`;
            })
            .join("")
        : `<text x="${W / 2}" y="${first + 30}" font-size="12" text-anchor="middle" class="m">No language data yet</text>`;
    } else {
      const barY = y0 + 4;
      const barH = 14;
      const gap = rows.length > 1 ? 2 : 0;
      const span = right - 24 - gap * Math.max(0, rows.length - 1);
      let x = 24;
      const segs = rows
        .map((l, i) => {
          const w = Math.max(1, (l.bytes / total) * span);
          const s = `<rect x="${x.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" fill="${l.color}" style="transform-box:fill-box;transform-origin:left;animation:growX .6s ${EASE} ${(0.3 + i * 0.12).toFixed(2)}s both"/>`;
          x += w + gap;
          return s;
        })
        .join("");
      const colW = (right - 24) / 2;
      const gy = barY + barH + 32;
      const gridRows = Math.ceil(rows.length / 2);
      const grid = rows
        .map((l, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const gx = 24 + col * colW;
          const y = gy + row * 26;
          const pct = pctText(l.pct);
          const pw = textWidth(t, pct, 11.5);
          return `<g class="in" style="animation-delay:${(0.6 + i * 0.08).toFixed(2)}s">
<circle cx="${gx + 4}" cy="${y - 4}" r="4" fill="${l.color}"/>
<text x="${gx + 14}" y="${y}" font-size="12" class="t b">${esc(fitText(t, l.name, 12, colW - 14 - pw - 18, { bold: true }))}</text>
<text x="${gx + colW - 12}" y="${y}" font-size="11.5" text-anchor="end" class="m">${pct}</text>
</g>`;
        })
        .join("");
      H = Math.max(rows.length ? 0 : 150, gy + Math.max(1, gridRows) * 26 + 22);
      content = `<clipPath id="stk"><rect x="24" y="${barY}" width="${right - 24}" height="${barH}" rx="${barH / 2}"/></clipPath>
<rect x="24" y="${barY}" width="${right - 24}" height="${barH}" rx="${barH / 2}" fill="${t.raised}"/>
<g clip-path="url(#stk)">${segs}</g>
${rows.length ? grid : `<text x="${W / 2}" y="${gy + 4}" font-size="12" text-anchor="middle" class="m">No language data yet</text>`}`;
    }

    const note = rows.length ? `by bytes across ${ctx.data.repoCount} owned repositor${ctx.data.repoCount === 1 ? "y" : "ies"}` : "";
    const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, fitText(t, lbl.toUpperCase(), 12, W - 64, { bold: true, letterSpacing: 2 })) : ""}
${content}
${note ? `<text x="24" y="${H - 18}" font-size="10" class="m">${esc(fitText(t, note, 10, W - 48))}</text>` : ""}`;
    return svg({ width: W, height: H, theme: t, title: "most used languages", css, body });
  },
});
