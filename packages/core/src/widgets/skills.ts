import { mix } from "../lib/color";
import { esc } from "../lib/escape";
import { card, fitText, label, svg, textWidth } from "../lib/svg";
import { hasMark, items, mark, n1, numOpt, pick, str, emptyHint } from "./kit-c";
import { accentDeep } from "./parts";
import { fillPlaceholders } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;

interface Skill {
  name: string;
  icon: string;
  level: number;
}

export const skills = defineWidget({
  type: "skills",
  title: "Skill meters",
  description: "Your strongest tools as filling bars, segmented blocks or radial gauges, each with its icon and level.",
  scope: "profile",
  category: "Identity",
  kind: "svg",
  width: "full",
  defaults: {
    label: "toolbox",
    style: "bars",
    columns: "2",
    gauges: "6",
    values: true,
    iconColor: "brand",
    items: [
      { name: "TypeScript", icon: "typescript", level: 92 },
      { name: "React", icon: "react", level: 86 },
      { name: "Rust", icon: "rust", level: 68 },
      { name: "Go", icon: "go", level: 74 },
      { name: "PostgreSQL", icon: "postgresql", level: 80 },
      { name: "Docker", icon: "docker", level: 77 },
    ],
  },
  fields: [
    { key: "label", label: "Title", type: "text", placeholder: "toolbox" },
    {
      key: "style",
      label: "Style",
      type: "segmented",
      options: [
        { value: "bars", label: "Bars" },
        { value: "blocks", label: "Blocks" },
        { value: "gauges", label: "Gauges" },
      ],
    },
    {
      key: "columns",
      label: "Columns",
      type: "segmented",
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
      ],
      when: { key: "style", is: ["bars", "blocks"] },
    },
    {
      key: "gauges",
      label: "Gauges per row",
      type: "segmented",
      options: [
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5" },
        { value: "6", label: "6" },
      ],
      when: { key: "style", is: ["gauges"] },
    },
    { key: "values", label: "Show levels", type: "toggle" },
    {
      key: "iconColor",
      label: "Icon colour",
      type: "segmented",
      options: [
        { value: "brand", label: "Brand" },
        { value: "accent", label: "Accent" },
        { value: "text", label: "Text" },
      ],
    },
    {
      key: "items",
      label: "Skills",
      type: "list",
      itemLabel: "Skill",
      titleKey: "name",
      max: 18,
      newItem: { name: "New skill", icon: "code", level: 60 },
      item: [
        { key: "name", label: "Name", type: "text", max: 32 },
        { key: "icon", label: "Icon", type: "icon" },
        { key: "level", label: "Level", type: "number", min: 0, max: 100, step: 1, unit: "%" },
      ],
    },
  ],
  alt: (ctx, o) => {
    const list = items(o.items)
      .map((s) => `${fillPlaceholders(str(s.name), ctx)} ${Math.round(numOpt(s.level, 0, 0, 100))}%`)
      .filter((s) => !s.startsWith(" "));
    return list.length ? `Skills: ${list.join(", ")}` : "Skills";
  },
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const list: Skill[] = items(o.items)
      .map((s) => ({ name: fill(str(s.name)), icon: str(s.icon), level: numOpt(s.level, 0, 0, 100) }))
      .filter((s) => s.name || hasMark(s.icon))
      .slice(0, 18);
    const style = pick(o.style, ["bars", "blocks", "gauges"] as const, "bars");
    const lbl = fill(str(o.label));
    const top = lbl ? 52 : 24;
    const showVal = o.values !== false;
    const iconMode = pick(o.iconColor, ["brand", "accent", "text"] as const, "brand");
    const ink = iconMode === "accent" ? t.accent : iconMode === "text" ? t.text : "brand";
    // dark: deep → glow; light: a softened accent → accent (the deep ramp turns muddy on white)
    const lo = t.name === "dark" ? accentDeep(t) : mix(t.accent, "#ffffff", 0.35);
    const hi = t.name === "dark" ? t.glow : t.accent;
    const defs = `<linearGradient id="skG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${lo}"/><stop offset="1" stop-color="${hi}"/></linearGradient>
<linearGradient id="skR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${t.name === "dark" ? accentDeep(t) : mix(t.accent, "#ffffff", 0.2)}"/></linearGradient>`;
    let css = `
.fillx{transform-box:fill-box;transform-origin:left;animation:growX 1.4s cubic-bezier(.2,.7,.2,1) both}
.sh{animation:skSh 5s ease-in-out infinite}
@keyframes skSh{0%{transform:translateX(-80px)}45%,100%{transform:translateX(${W}px)}}
.seg{animation:segOn .35s ease both}
@keyframes segOn{from{opacity:0;transform:scaleY(.3)}to{opacity:1;transform:none}}`;

    if (!list.length) {
      const H = top + 70;
      const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${emptyHint(t, W / 2, top + 30, "chart", "Add the tools you work with in the inspector")}`;
      return svg({ width: W, height: H, theme: t, title: "Skills", body });
    }

    const out: string[] = [];
    let H: number;
    if (style === "gauges") {
      const per = Math.min(list.length, Number(pick(o.gauges, ["3", "4", "5", "6"] as const, "6")));
      const rows = Math.ceil(list.length / per);
      const cw = (W - 48) / per;
      const ch = 140;
      const r = Math.min(36, cw / 2 - 18);
      const C = 2 * Math.PI * r;
      H = top + rows * ch + 6;
      list.forEach((s, i) => {
        const row = Math.floor(i / per);
        const inRow = Math.min(per, list.length - row * per);
        // centre an incomplete last row
        const x0 = 24 + ((per - inRow) * cw) / 2;
        const cx = x0 + (i % per) * cw + cw / 2;
        const cy = top + row * ch + r + 8;
        const d = 0.2 + i * 0.1;
        const off = C * (1 - s.level / 100);
        css += `@keyframes g${i}{from{stroke-dashoffset:${n1(C)}}to{stroke-dashoffset:${n1(off)}}}`;
        const pct = String(Math.round(s.level));
        const nameMax = cw - 16;
        const hasIc = hasMark(s.icon);
        const nm = fitText(t, s.name, 12.5, nameMax - (hasIc ? 20 : 0), { bold: true });
        const nw = textWidth(t, nm, 12.5, { bold: true }) + (hasIc ? 20 : 0);
        const ny = cy + r + 30;
        const ticks = Array.from({ length: 24 }, (_, k) => {
          const a = (k / 24) * 2 * Math.PI;
          const r1 = r + 7;
          const r2 = r + (k % 6 === 0 ? 11 : 9);
          return `M${n1(cx + r1 * Math.sin(a))} ${n1(cy - r1 * Math.cos(a))}L${n1(cx + r2 * Math.sin(a))} ${n1(cy - r2 * Math.cos(a))}`;
        }).join("");
        out.push(`<g class="in" style="animation-delay:${d.toFixed(2)}s">
<path d="${ticks}" stroke="${t.subtle}" stroke-width="1" stroke-linecap="round"/>
<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" stroke="${t.heat[0]}" stroke-width="7"/>
<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" stroke="url(#skR)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${n1(C)}" stroke-dashoffset="${n1(off)}" transform="rotate(-90 ${n1(cx)} ${n1(cy)})" style="animation:g${i} 1.6s cubic-bezier(.2,.7,.2,1) ${(d + 0.15).toFixed(2)}s both"/>
${
  showVal
    ? `<text x="${n1(cx - (textWidth(t, "%", 10) / 2))}" y="${n1(cy + 6)}" font-size="18" text-anchor="middle" class="t b h">${pct}<tspan font-size="10" class="m" dx="1">%</tspan></text>`
    : hasIc
      ? mark(t, s.icon, cx - 12, cy - 12, 24, ink)
      : ""
}
${hasIc && showVal ? mark(t, s.icon, cx - nw / 2, ny - 11, 14, ink) : ""}
<text x="${n1(cx - nw / 2 + (hasIc && showVal ? 20 : 0))}" y="${n1(ny)}" font-size="12.5" class="t b">${esc(showVal || !hasIc ? nm : nm)}</text>
</g>`);
      });
    } else {
      const cols = Math.min(list.length, Number(pick(o.columns, ["1", "2", "3"] as const, "2")));
      const gap = 36;
      const cw = (W - 48 - gap * (cols - 1)) / cols;
      const nRows = Math.ceil(list.length / cols);
      const rh = 50;
      H = top + nRows * rh + 10;
      list.forEach((s, i) => {
        // row-first, so a short list fills the top row before starting the next
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 24 + col * (cw + gap);
        const y = top + row * rh;
        const d = 0.15 + (row * cols + col) * 0.08;
        const hasIc = hasMark(s.icon);
        const nx = hasIc ? x + 24 : x;
        const val = `${Math.round(s.level)}%`;
        const vw = showVal ? textWidth(t, val, 12, { bold: true }) + 12 : 0;
        const nm = fitText(t, s.name, 13, x + cw - nx - vw, { bold: true });
        const ty = y + 15;
        const by = y + 26;
        const head = `${hasIc ? mark(t, s.icon, x, y + 1, 16, ink) : ""}
<text x="${n1(nx)}" y="${ty}" font-size="13" class="t b">${esc(nm)}</text>
${showVal ? `<text x="${n1(x + cw)}" y="${ty}" font-size="12" text-anchor="end" class="m b">${val}</text>` : ""}`;
        let meter: string;
        if (style === "blocks") {
          const nSeg = cols === 3 ? 14 : 20;
          const sg = 3;
          const sw = (cw - sg * (nSeg - 1)) / nSeg;
          const lit = Math.round((s.level / 100) * nSeg);
          meter = Array.from({ length: nSeg }, (_, k) => {
            const on = k < lit;
            const fillC = on ? (k === lit - 1 ? t.glow : t.accent) : t.heat[0];
            return `<rect x="${n1(x + k * (sw + sg))}" y="${by}" width="${n1(sw)}" height="9" rx="${Math.min(2, sw / 3).toFixed(1)}" fill="${fillC}"${on ? ` class="fx seg" style="animation-delay:${(d + 0.25 + k * 0.04).toFixed(2)}s"` : ""}/>`;
          }).join("");
        } else {
          const fw = Math.max(0, (cw * s.level) / 100);
          meter = `<rect x="${x}" y="${by}" width="${n1(cw)}" height="6" rx="3" fill="${t.heat[0]}"/>
${fw > 0 ? `<clipPath id="sk${i}"><rect x="${x}" y="${by}" width="${n1(fw)}" height="6" rx="3"/></clipPath>
<g clip-path="url(#sk${i})"><rect class="fillx" style="animation-delay:${(d + 0.2).toFixed(2)}s" x="${x}" y="${by}" width="${n1(fw)}" height="6" fill="url(#skG)"/>
<rect class="sh loop loop-only" style="animation-delay:${(2 + i * 0.4).toFixed(2)}s" x="${x - 60}" y="${by}" width="60" height="6" fill="url(#shine)"/></g>
<circle class="fade" style="animation-delay:${(d + 1.2).toFixed(2)}s" cx="${n1(x + Math.max(3, fw - 3))}" cy="${by + 3}" r="2" fill="#fff" opacity=".85"/>` : ""}`;
        }
        out.push(`<g class="in" style="animation-delay:${d.toFixed(2)}s">${head}${meter}</g>`);
      });
    }
    const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${out.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
