import { contrast } from "../lib/color";
import { esc } from "../lib/escape";
import { icon } from "../lib/icons";
import { fitText, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { colorOr, hasMark, isGlyph, items, mark, n1, pick, str } from "./kit-c";
import { onAccent } from "./parts";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;
const BH = 28;
const GAP_X = 8;
const GAP_Y = 10;
const FS = 11.5;

type Style = "flat" | "pill" | "outline";

interface Badge {
  icon: string;
  label: string;
  value: string;
  color: string;
  w: number;
  lw: number;
}

function brandColor(t: Theme, id: string): string | null {
  if (!id || isGlyph(id)) return null;
  const c = icon(id).color;
  if (!c) return null;
  // keep the brand colour only when it separates from the card
  return contrast(c, t.card) >= 1.35 ? c : null;
}

export const badges = defineWidget({
  type: "badges",
  title: "Badges",
  description: "A row of shields-style badges drawn right in the image, no third-party service, wrapping neatly across lines.",
  category: "Identity",
  kind: "svg",
  width: "full",
  defaults: {
    style: "flat",
    colors: "accent",
    caps: true,
    align: "center",
    shine: true,
    items: [
      { icon: "typescript", label: "TypeScript", value: "daily", color: "" },
      { icon: "rust", label: "Rust", value: "learning", color: "" },
      { icon: "react", label: "React", value: "since 2017", color: "" },
      { icon: "docker", label: "Docker", value: "shipping", color: "" },
      { icon: "users", label: "Followers", value: "{followers}", color: "" },
      { icon: "star", label: "Stars", value: "{stars}", color: "" },
      { icon: "flame", label: "Streak", value: "{streak} days", color: "" },
    ],
  },
  fields: [
    {
      key: "style",
      label: "Style",
      type: "segmented",
      options: [
        { value: "flat", label: "Flat" },
        { value: "pill", label: "Pill" },
        { value: "outline", label: "Outline" },
      ],
    },
    {
      key: "colors",
      label: "Value colour",
      type: "segmented",
      options: [
        { value: "accent", label: "Accent" },
        { value: "brand", label: "Brand" },
      ],
      help: "Brand uses each icon's own colour; a per-badge colour always wins.",
    },
    { key: "caps", label: "Uppercase labels", type: "toggle" },
    {
      key: "align",
      label: "Alignment",
      type: "segmented",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
    },
    { key: "shine", label: "Shine sweep", type: "toggle" },
    {
      key: "items",
      label: "Badges",
      type: "list",
      itemLabel: "Badge",
      titleKey: "label",
      max: 24,
      newItem: { icon: "code", label: "Label", value: "value", color: "" },
      item: [
        { key: "icon", label: "Icon", type: "icon", help: "Brand icon or line glyph; leave empty for none." },
        { key: "label", label: "Label", type: "text", max: 32 },
        { key: "value", label: "Value", type: "text", max: 32, help: `Optional. ${PLACEHOLDER_HELP}` },
        { key: "color", label: "Colour", type: "color", allowTheme: true, help: "Empty uses the accent." },
      ],
    },
  ],
  alt: (ctx, o) => {
    const list = items(o.items)
      .map((b) => [fillPlaceholders(str(b.label), ctx), fillPlaceholders(str(b.value), ctx)].filter(Boolean).join(": "))
      .filter(Boolean);
    return list.length ? `Badges: ${list.join(", ")}` : "Badges";
  },
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const style = pick(o.style, ["flat", "pill", "outline"] as const, "flat") as Style;
    const caps = o.caps !== false;
    const center = pick(o.align, ["left", "center"] as const, "center") === "center";
    const brand = o.colors === "brand";
    const lOpts = { bold: true, letterSpacing: caps ? 0.8 : 0.2 };
    const vOpts = { bold: true, letterSpacing: caps ? 0.4 : 0.2 };
    const pad = 10;
    let list: Badge[] = items(o.items)
      .slice(0, 24)
      .map((b) => {
        const id = str(b.icon);
        let lab = fill(str(b.label));
        let val = fill(str(b.value));
        const id0 = str(b.icon);
        // a value with nothing on its left becomes a single coloured badge
        if (!lab && !hasMark(id0)) [lab, val] = [val, ""];
        const color = colorOr(b.color, (brand && brandColor(t, id)) || t.accent);
        const ic = hasMark(id) ? id : "";
        const labelText = fitText(t, caps ? lab.toUpperCase() : lab, FS, 260, lOpts);
        const valueText = fitText(t, caps ? val.toUpperCase() : val, FS, 220, vOpts);
        const lw = pad + (ic ? 14 + (labelText ? 6 : 0) : 0) + (labelText ? textWidth(t, labelText, FS, lOpts) : 0) + pad;
        const vw = valueText ? pad + textWidth(t, valueText, FS, vOpts) + pad : 0;
        return { icon: ic, label: labelText, value: valueText, color, w: lw + vw, lw };
      })
      .filter((b) => b.label || b.value || b.icon);
    const empty = !list.length;
    if (empty) {
      const labelText = caps ? "ADD BADGES" : "Add badges";
      const lw = pad + 20 + textWidth(t, labelText, FS, lOpts) + pad;
      list = [{ icon: "tag", label: labelText, value: "", color: t.muted, w: lw, lw }];
    }

    // greedy rows across the full width
    const maxRow = W - 4;
    const rows: Badge[][] = [[]];
    let rw = 0;
    for (const b of list) {
      const cur = rows[rows.length - 1];
      const add = (cur.length ? GAP_X : 0) + Math.min(b.w, maxRow);
      if (cur.length && rw + add > maxRow) {
        rows.push([b]);
        rw = Math.min(b.w, maxRow);
      } else {
        cur.push(b);
        rw += add;
      }
    }
    const H = rows.length * BH + (rows.length - 1) * GAP_Y + 4;
    const r = style === "pill" ? BH / 2 : style === "outline" ? Math.min(8, Math.max(3, t.radius / 2)) : Math.min(6, Math.max(3, t.radius / 3));
    const dark = t.name === "dark";
    const out: string[] = [];
    let k = 0;
    rows.forEach((row, ri) => {
      const total = row.reduce((a, b) => a + b.w, 0) + GAP_X * (row.length - 1);
      let x = center ? (W - total) / 2 : 2;
      const y = 2 + ri * (BH + GAP_Y);
      for (const b of row) {
        const i = k++;
        const cid = `bd${i}`;
        const hasVal = !!b.value;
        const outline = style === "outline";
        // label-only badges take the colour themselves
        const solo = !hasVal;
        const labelBg = solo && !empty ? b.color : t.raised;
        const labelInk = outline ? (solo && !empty ? b.color : t.text) : solo && !empty ? onAccent(t, b.color) : t.text;
        const iconInk = outline ? b.color : solo && !empty ? onAccent(t, b.color) : brand && !isGlyph(b.icon) ? "brand" : b.color;
        const valInk = outline ? b.color : onAccent(t, b.color);
        const ty = y + BH / 2 + FS * 0.36;
        const ix = x + pad;
        const lx = ix + (b.icon ? 14 + 6 : 0);
        const parts: string[] = [];
        parts.push(`<clipPath id="${cid}"><rect x="${n1(x)}" y="${y}" width="${n1(b.w)}" height="${BH}" rx="${r}"/></clipPath>`);
        if (outline) {
          parts.push(`<rect x="${n1(x + 0.5)}" y="${y + 0.5}" width="${n1(b.w - 1)}" height="${BH - 1}" rx="${r}" fill="${b.color}" fill-opacity="${dark ? 0.08 : 0.05}" stroke="${empty ? t.subtle : b.color}" stroke-opacity="${empty ? 1 : 0.75}" ${empty ? `stroke-dasharray="3 3"` : ""}/>`);
          if (hasVal) parts.push(`<rect x="${n1(x + b.lw)}" y="${y + 5}" width="1" height="${BH - 10}" fill="${b.color}" opacity=".45"/>`);
        } else {
          parts.push(`<g clip-path="url(#${cid})"><rect x="${n1(x)}" y="${y}" width="${n1(b.lw + 1)}" height="${BH}" fill="${empty ? "none" : labelBg}"/>${hasVal ? `<rect x="${n1(x + b.lw)}" y="${y}" width="${n1(b.w - b.lw)}" height="${BH}" fill="${b.color}"/>` : ""}</g>`);
          parts.push(`<rect x="${n1(x + 0.5)}" y="${y + 0.5}" width="${n1(b.w - 1)}" height="${BH - 1}" rx="${r}" stroke="${empty ? t.subtle : t.border}" ${empty ? `stroke-dasharray="3 3"` : `stroke-opacity="${hasVal ? 1 : 0}"`}/>`);
        }
        if (b.icon) parts.push(mark(t, b.icon, ix, y + 7, 14, iconInk, labelBg));
        if (b.label) parts.push(`<text x="${n1(lx)}" y="${n1(ty)}" font-size="${FS}" letter-spacing="${lOpts.letterSpacing}" class="b" fill="${empty ? t.muted : labelInk}">${esc(b.label)}</text>`);
        if (hasVal) parts.push(`<text x="${n1(x + b.lw + pad)}" y="${n1(ty)}" font-size="${FS}" letter-spacing="${vOpts.letterSpacing}" class="b" fill="${valInk}">${esc(b.value)}</text>`);
        if (o.shine !== false && !empty) parts.push(`<g clip-path="url(#${cid})"><rect class="sh loop loop-only" style="animation-delay:${(1.2 + i * 0.35).toFixed(2)}s" x="${n1(x)}" y="${y}" width="40" height="${BH}" fill="url(#shine)"/></g>`);
        out.push(`<g class="fx bp" style="animation-delay:${(0.05 + i * 0.06).toFixed(2)}s">${parts.join("")}</g>`);
        x += b.w + GAP_X;
      }
    });
    const css = `
.bp{animation:bpop .6s cubic-bezier(.2,.8,.2,1.2) both}
@keyframes bpop{from{opacity:0;transform:translateY(6px) scale(.94)}to{opacity:1;transform:none}}
.sh{animation:bsh ${n1(Math.max(6, list.length * 0.35 + 3))}s ease-in-out infinite}
@keyframes bsh{0%{transform:translateX(-60px)}18%,100%{transform:translateX(${Math.round(Math.max(...list.map((b) => b.w)) + 60)}px)}}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, body: out.join("\n") });
  },
});
