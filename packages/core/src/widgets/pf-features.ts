import { esc } from "../lib/escape";
import { card, label, svg, wrapText } from "../lib/svg";
import { emptyHint, hasMark, items, mark, n1, pick, str } from "./kit-c";
import { balancedWrap, repoUrl, tint } from "./kit-f";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;
const PAD = 24;
const GAP = 14;

const DEFAULT_FEATURES = [
  { icon: "bolt", title: "Blazing fast", text: "Incremental builds finish in milliseconds, even in monorepos with thousands of files." },
  { icon: "sparkle", title: "Zero config", text: "Sensible defaults out of the box. Reach for a config file only when you need one." },
  { icon: "code", title: "Fully typed", text: "First-class TypeScript types and autocompletion for every option and plugin hook." },
  { icon: "terminal", title: "Friendly CLI", text: "Readable errors, coloured diffs and a watch mode that stays out of your way." },
  { icon: "globe", title: "Runs anywhere", text: "Node, Deno, Bun and the browser, with no native dependencies or install scripts." },
  { icon: "users", title: "Plugin ecosystem", text: "A growing set of community plugins for frameworks, design tools and CI." },
];

export const pfFeatures = defineWidget({
  type: "features",
  title: "Feature grid",
  description: "Your project's highlights as a two- or three-column grid of icon tiles, titles and short descriptions, revealed one by one.",
  scope: "project",
  category: "Content",
  kind: "svg",
  width: "full",
  defaults: {
    label: "why {project}",
    columns: "3",
    style: "cards",
    numbered: false,
    items: DEFAULT_FEATURES,
  },
  fields: [
    { key: "label", label: "Title", type: "text", placeholder: "features", help: PLACEHOLDER_HELP },
    {
      key: "columns",
      label: "Columns",
      type: "segmented",
      options: [
        { value: "2", label: "Two" },
        { value: "3", label: "Three" },
      ],
    },
    {
      key: "style",
      label: "Style",
      type: "segmented",
      options: [
        { value: "cards", label: "Cards" },
        { value: "plain", label: "Plain" },
      ],
    },
    { key: "numbered", label: "Numbered", type: "toggle", help: "Adds 01, 02, … to each feature." },
    {
      key: "items",
      label: "Features",
      type: "list",
      itemLabel: "Feature",
      titleKey: "title",
      max: 9,
      newItem: { icon: "sparkle", title: "New feature", text: "" },
      item: [
        { key: "icon", label: "Icon", type: "icon", help: "A line glyph (bolt, sparkle, code, globe, …) or a brand icon." },
        { key: "title", label: "Title", type: "text", max: 48 },
        { key: "text", label: "Description", type: "text", multiline: true, max: 180 },
      ],
    },
  ],
  alt: (ctx, o) => {
    const list = items(o.items)
      .map((f) => fillPlaceholders(str(f.title), ctx))
      .filter(Boolean);
    const lbl = fillPlaceholders(str(o.label), ctx);
    return list.length ? `${lbl || "Features"}: ${list.join(", ")}` : lbl || "Features";
  },
  href: (ctx) => repoUrl(ctx),
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const feats = items(o.items)
      .map((f) => ({ icon: str(f.icon), title: fill(str(f.title)), text: fill(str(f.text)) }))
      .filter((f) => f.title || f.text)
      .slice(0, 9);
    const lbl = fill(str(o.label));
    const cards = pick(o.style, ["cards", "plain"] as const, "cards") === "cards";
    const top = lbl ? 50 : cards ? PAD : 8;
    const numbered = o.numbered === true;
    let cols = pick(o.columns, ["2", "3"] as const, "3") === "3" ? 3 : 2;
    if (feats.length && feats.length < cols) cols = feats.length;

    if (!feats.length) {
      const H = top + 76;
      const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, PAD, 30, lbl) : ""}
${emptyHint(t, W / 2, top + 34, "sparkle", "Add your project's highlights in the inspector")}`;
      return svg({ width: W, height: H, theme: t, title: "Features", body });
    }

    const gap = cards ? GAP : 0;
    const cw = (W - PAD * 2 - gap * (cols - 1)) / cols;
    const inner = cards ? 20 : 22;
    const stacked = cols === 3 || cw < 330;
    const TILE = 38;
    const anyIcon = feats.some((f) => hasMark(f.icon)) || numbered;
    // text column
    const tx = stacked || !anyIcon ? inner : inner + TILE + 16;
    const textW = cw - tx - inner;
    const tFs = 15;
    const dFs = 12.5;
    const dLh = 18.5;

    const laid = feats.map((f) => {
      const title = f.title ? wrapText(t, f.title, tFs, textW - (numbered && !stacked ? 0 : 0), 2, { bold: true, heading: true }) : [];
      const lines = f.text ? balancedWrap(t, f.text, dFs, textW, 4) : [];
      const headH = stacked && anyIcon ? TILE + 16 : 0;
      const titleH = title.length * 20;
      const h = inner + headH + titleH + (lines.length ? 6 + lines.length * dLh : 0) + inner - 4;
      return { ...f, titleLines: title, lines, h: Math.max(h, !stacked && anyIcon ? inner * 2 + TILE : 0) };
    });
    const rowsN = Math.ceil(laid.length / cols);
    const rowH: number[] = [];
    for (let r = 0; r < rowsN; r++) rowH.push(Math.max(...laid.slice(r * cols, r * cols + cols).map((f) => f.h)));
    const rowGap = cards ? GAP : 0;
    const gridH = rowH.reduce((a, b) => a + b, 0) + rowGap * (rowsN - 1);
    const H = top + gridH + (cards ? PAD : 8);

    const tileR = Math.min(10, Math.max(6, t.radius - 2));
    const cellR = Math.max(4, Math.min(t.radius, 12) - 2);
    const out: string[] = [];
    const period = laid.length * 0.9 + 2;
    let yAcc = top;
    for (let r = 0; r < rowsN; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const f = laid[i];
        if (!f) continue;
        const x = PAD + c * (cw + gap);
        const y = yAcc;
        const h = rowH[r];
        const d = 0.15 + i * 0.09;
        const parts: string[] = [];
        if (cards) parts.push(`<rect x="${n1(x + 0.5)}" y="${n1(y + 0.5)}" width="${n1(cw - 1)}" height="${n1(h - 1)}" rx="${cellR}" fill="${t.raised}" fill-opacity="${t.name === "dark" ? 0.55 : 0.7}" stroke="${t.border}"/>`);
        else {
          if (c > 0) parts.push(`<path d="M${n1(x + 0.5)} ${y + 14}V${n1(y + h - 14)}" stroke="${t.border}"/>`);
          if (r > 0) parts.push(`<path d="M${n1(x + (c > 0 ? 14 : 0))} ${n1(y + 0.5)}H${n1(x + cw - (c < cols - 1 ? 14 : 0))}" stroke="${t.border}"/>`);
        }
        const num = String(i + 1).padStart(2, "0");
        // icon tile
        const hasIcon = hasMark(f.icon);
        const ix = x + inner;
        const iy = y + inner;
        if (hasIcon || numbered) {
          const content = hasIcon
            ? mark(t, f.icon, ix + (TILE - 18) / 2, iy + (TILE - 18) / 2, 18, t.accent, tint(t, t.accent))
            : `<text x="${n1(ix + TILE / 2)}" y="${n1(iy + TILE / 2 + 4.5)}" font-size="13" text-anchor="middle" class="a b">${num}</text>`;
          parts.push(`<g class="fx" style="animation:pop .6s ease ${(d + 0.12).toFixed(2)}s both">
<rect x="${n1(ix)}" y="${n1(iy)}" width="${TILE}" height="${TILE}" rx="${tileR}" fill="${tint(t, t.accent)}" stroke="${t.accent}" stroke-opacity=".35"/>
<rect x="${n1(ix)}" y="${n1(iy)}" width="${TILE}" height="${TILE}" rx="${tileR}" stroke="${t.accent}" stroke-width="1.5" class="ring loop loop-only" style="animation-delay:${(2 + i * 0.9).toFixed(1)}s;animation-duration:${n1(period)}s"/>
${content}</g>`);
        }
        if (numbered && hasIcon) {
          parts.push(`<text x="${n1(x + cw - inner + 2)}" y="${n1(y + inner + 13)}" font-size="11" text-anchor="end" letter-spacing="1" class="s b">${num}</text>`);
        }
        let ty = stacked && (hasIcon || numbered || anyIcon) ? iy + TILE + 16 + 14 : y + inner + 14;
        const textX = x + tx;
        for (const l of f.titleLines) {
          parts.push(`<text x="${n1(textX)}" y="${n1(ty)}" font-size="${tFs}" class="t b h">${esc(l)}</text>`);
          ty += 20;
        }
        ty += f.titleLines.length ? 6 - 20 + dLh : 0;
        for (const l of f.lines) {
          parts.push(`<text x="${n1(textX)}" y="${n1(ty)}" font-size="${dFs}" class="m">${esc(l)}</text>`);
          ty += dLh;
        }
        out.push(`<g class="in" style="animation-delay:${d.toFixed(2)}s">${parts.join("")}</g>`);
      }
      yAcc += rowH[r] + rowGap;
    }

    const css = `
.ring{opacity:0;transform-box:fill-box;transform-origin:center;animation:ring 6s ease-out infinite}
@keyframes ring{0%{opacity:.7;transform:scale(1)}12%{opacity:0;transform:scale(1.45)}100%{opacity:0;transform:scale(1.45)}}`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, PAD, 30, lbl) : ""}
${out.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, body });
  },
});
