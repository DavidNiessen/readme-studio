import { esc } from "../lib/escape";
import { card, fitText, label, svg, textWidth } from "../lib/svg";
import { hasMark, items, mark, n1, pick, str, emptyHint } from "./kit-c";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;
const ROW = 46;

export const facts = defineWidget({
  type: "facts",
  title: "Quick facts",
  description: "A tidy key-value list of things worth knowing about you, revealed row by row, in one or two columns.",
  category: "Identity",
  kind: "svg",
  width: "full",
  defaults: {
    label: "quick facts",
    columns: "2",
    leaders: true,
    iconColor: "accent",
    items: [
      { icon: "pin", key: "Based in", value: "{city}" },
      { icon: "briefcase", key: "Working on", value: "Developer tooling" },
      { icon: "code", key: "Daily drivers", value: "TypeScript, Rust, Go" },
      { icon: "book", key: "Learning", value: "Distributed systems" },
      { icon: "coffee", key: "Fuelled by", value: "Flat whites" },
      { icon: "sparkle", key: "Ask me about", value: "Design systems, CLIs" },
    ],
  },
  fields: [
    { key: "label", label: "Title", type: "text", placeholder: "quick facts" },
    {
      key: "columns",
      label: "Columns",
      type: "segmented",
      options: [
        { value: "1", label: "One" },
        { value: "2", label: "Two" },
      ],
    },
    { key: "leaders", label: "Dotted leaders", type: "toggle", help: "A dotted line between each key and its value." },
    {
      key: "iconColor",
      label: "Icon colour",
      type: "segmented",
      options: [
        { value: "accent", label: "Accent" },
        { value: "brand", label: "Brand" },
        { value: "muted", label: "Muted" },
      ],
    },
    {
      key: "items",
      label: "Facts",
      type: "list",
      itemLabel: "Fact",
      titleKey: "key",
      max: 12,
      newItem: { icon: "sparkle", key: "Fun fact", value: "" },
      item: [
        { key: "icon", label: "Icon", type: "icon", help: "A brand icon, or a line glyph such as pin, briefcase, code, book, heart, rocket, globe." },
        { key: "key", label: "Key", type: "text", placeholder: "Based in" },
        { key: "value", label: "Value", type: "text", placeholder: "Lisbon", help: PLACEHOLDER_HELP },
      ],
    },
  ],
  alt: (ctx, o) => {
    const rows = items(o.items)
      .map((r) => `${fillPlaceholders(str(r.key), ctx)}: ${fillPlaceholders(str(r.value), ctx)}`)
      .filter((s) => s !== ": ");
    return rows.length ? `${str(o.label) || "Facts"} — ${rows.join("; ")}` : "Quick facts";
  },
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const rows = items(o.items)
      .map((r) => ({ icon: str(r.icon), key: fill(str(r.key)), value: fill(str(r.value)) }))
      .filter((r) => r.key || r.value)
      .slice(0, 12);
    const cols = rows.length > 1 && pick(o.columns, ["1", "2"] as const, "2") === "2" ? 2 : 1;
    const lbl = fill(str(o.label));
    const top = lbl ? 48 : 18;
    const gap = 40;
    const cw = (W - 48 - gap * (cols - 1)) / cols;
    const perCol = Math.ceil(rows.length / cols);
    const iconMode = pick(o.iconColor, ["accent", "brand", "muted"] as const, "accent");
    const iconColor = iconMode === "accent" ? t.accent : iconMode === "muted" ? t.muted : "brand";

    if (!rows.length) {
      const H = top + 76;
      const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${emptyHint(t, W / 2, top + 34, "sparkle", "Add a few facts about yourself in the inspector")}`;
      return svg({ width: W, height: H, theme: t, title: "Quick facts", body });
    }

    const H = top + perCol * ROW + 14;
    const anyIcon = rows.some((r) => hasMark(r.icon));
    const out: string[] = [];
    rows.forEach((r, i) => {
      // fill column-first so reading order runs down each column
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const x = 24 + col * (cw + gap);
      const y = top + row * ROW;
      const d = 0.15 + (row * cols + col) * 0.08;
      const hasIcon = hasMark(r.icon);
      // keep keys on one vertical line when any row has an icon
      const kx = anyIcon ? x + 40 : x;
      const inner = x + cw - kx;
      const key = fitText(t, r.key, 13, inner * 0.5);
      const keyW = textWidth(t, key, 13);
      const value = fitText(t, r.value || "—", 13.5, inner - keyW - 28, { bold: true });
      const valW = textWidth(t, value, 13.5, { bold: true });
      const base = y + 27;
      const leaderFrom = kx + keyW + 10;
      const leaderTo = x + cw - valW - 10;
      out.push(`<g class="in" style="animation-delay:${d.toFixed(2)}s">
${hasIcon ? `<rect x="${x}" y="${y + 8}" width="28" height="28" rx="${Math.min(8, Math.max(4, t.radius - 4))}" fill="${t.raised}" stroke="${t.border}"/>${mark(t, r.icon, x + 6, y + 14, 16, iconColor, t.raised)}` : ""}
<text x="${n1(kx)}" y="${base}" font-size="13" class="m">${esc(key)}</text>
${o.leaders !== false && leaderTo - leaderFrom > 12 ? `<path class="lead" style="animation-delay:${(d + 0.15).toFixed(2)}s" d="M${n1(leaderFrom)} ${base - 4}H${n1(leaderTo)}" stroke="${t.subtle}" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="0.1 5"/>` : ""}
</g>
<text x="${n1(x + cw)}" y="${base}" font-size="13.5" text-anchor="end" class="${r.value ? "t" : "s"} b val" style="animation-delay:${(d + 0.12).toFixed(2)}s">${esc(value)}</text>
${row < perCol - 1 ? `<rect x="${x}" y="${y + ROW - 0.5}" width="${n1(cw)}" height="1" fill="${t.border}" class="sep" style="animation-delay:${(d + 0.05).toFixed(2)}s"/>` : ""}`);
    });
    const css = `
.val{animation:slideL .7s cubic-bezier(.2,.7,.2,1) both}
@keyframes slideL{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
.sep{transform-box:fill-box;transform-origin:left;animation:growX .9s cubic-bezier(.2,.7,.2,1) both}
.lead{opacity:0;animation:fadeIn .6s ease forwards}`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${out.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, body });
  },
});
