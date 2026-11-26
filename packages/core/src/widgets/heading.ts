import { esc } from "../lib/escape";
import { card, fitSize, fitText, svg, textWidth } from "../lib/svg";
import { hasMark, mark, n1, pick, str } from "./kit-c";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;

export const heading = defineWidget({
  type: "heading",
  title: "Section heading",
  description: "A slim section title with an eyebrow label and an animated hairline, for giving your README a clear structure.",
  category: "Decoration",
  kind: "svg",
  width: "full",
  defaults: {
    eyebrow: "01 · selected work",
    title: "Featured projects",
    icon: "",
    align: "left",
    line: true,
    card: false,
  },
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Optional small label above the title", max: 48 },
    { key: "title", label: "Title", type: "text", max: 60, help: PLACEHOLDER_HELP },
    { key: "icon", label: "Icon", type: "icon", help: "Optional; a brand icon or a line glyph (rocket, code, book, star…)." },
    {
      key: "align",
      label: "Alignment",
      type: "segmented",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
    },
    { key: "line", label: "Hairline", type: "toggle" },
    { key: "card", label: "Card background", type: "toggle", help: "Off blends the heading into the page." },
  ],
  alt: (ctx, o) => fillPlaceholders(str(o.title), ctx) || fillPlaceholders(str(o.eyebrow), ctx) || "Section",
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const eyebrow = fill(str(o.eyebrow));
    const title = fill(str(o.title)) || (eyebrow ? "" : "Section title");
    const center = pick(o.align, ["left", "center"] as const, "left") === "center";
    const withCard = o.card === true;
    const iconId = str(o.icon);
    const hasIco = hasMark(iconId);
    const H = eyebrow && title ? 76 : 52;
    const px = withCard ? 24 : 2;
    const tOpts = { bold: true, heading: true, letterSpacing: -0.4 };
    const iconW = hasIco ? 32 : 0;
    const maxTitle = W - px * 2 - iconW - (o.line !== false ? (center ? 120 : 80) : 0);
    const tSize = fitSize(t, title, 26, maxTitle, 17, tOpts);
    const titleText = fitText(t, title, tSize, maxTitle, tOpts);
    const tw = title ? textWidth(t, titleText, tSize, tOpts) : 0;
    const groupW = tw + iconW;
    const titleY = eyebrow && title ? 58 : 34;
    const midY = title ? titleY - tSize * 0.34 : 28;
    const gx = center ? W / 2 - groupW / 2 : px;

    // eyebrow: accent dot + spaced caps
    let eb = "";
    if (eyebrow) {
      const ebText = fitText(t, eyebrow.toUpperCase(), 11, W - px * 2 - 20, { bold: true, letterSpacing: 2.2 });
      const ebW = textWidth(t, ebText, 11, { bold: true, letterSpacing: 2.2 }) + 14;
      const ex = center ? W / 2 - ebW / 2 : px;
      const ey = title ? 22 : 32;
      eb = `<g class="in">
<circle cx="${n1(ex + 3.5)}" cy="${ey - 4}" r="3.5" fill="${t.accent}"/><circle class="loop" style="animation:pulse 2s ease-in-out infinite" cx="${n1(ex + 3.5)}" cy="${ey - 4}" r="3.5" fill="${t.accent}" filter="url(#glow)"/>
<text x="${n1(ex + 14)}" y="${ey}" font-size="11" letter-spacing="2.2" class="a b">${esc(ebText)}</text></g>`;
    }

    const icon = hasIco ? `<g class="fx" style="animation:pop .6s ease .15s both">${mark(t, iconId, gx, midY - 11, 22, t.accent)}</g>` : "";
    const titleMarkup = title ? `<text x="${n1(gx + iconW)}" y="${titleY}" font-size="${n1(tSize)}" letter-spacing="-0.4" class="t b h in" style="animation-delay:.1s">${esc(titleText)}</text>` : "";

    let line = "";
    const css = `
.hl{transform-box:fill-box;animation:growX 1.1s cubic-bezier(.2,.7,.2,1) .35s both}
.hlL{transform-origin:left}.hlR{transform-origin:right}
.comet{animation:hc 6s cubic-bezier(.5,0,.5,1) 1.6s infinite}
@keyframes hc{0%{transform:translateX(0);opacity:0}8%{opacity:1}70%{opacity:1}80%,100%{transform:translateX(var(--d));opacity:0}}`;
    const defs = `<linearGradient id="hlR" x1="0" x2="1"><stop offset="0" stop-color="${t.subtle}"/><stop offset="1" stop-color="${t.subtle}" stop-opacity="0"/></linearGradient>
<linearGradient id="hlL" x1="0" x2="1"><stop offset="0" stop-color="${t.subtle}" stop-opacity="0"/><stop offset="1" stop-color="${t.subtle}"/></linearGradient>
<linearGradient id="hcG" x1="0" x2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset="1" stop-color="${t.glow}"/></linearGradient>`;
    if (o.line !== false && title) {
      const ly = n1(midY);
      if (center) {
        const l1 = px;
        const r1 = gx - 24;
        const l2 = gx + groupW + 24;
        const r2 = W - px;
        if (r1 - l1 > 24) {
          line = `<rect class="hl hlR" x="${l1}" y="${ly}" width="${n1(r1 - l1)}" height="1" fill="url(#hlL)"/>
<rect class="hl hlL" x="${n1(l2)}" y="${ly}" width="${n1(r2 - l2)}" height="1" fill="url(#hlR)"/>
<rect class="fx" style="animation:pop .5s ease .9s both" x="${n1(r1 - 3)}" y="${n1(midY - 2.5)}" width="5" height="5" rx="1" transform="rotate(45 ${n1(r1 - 0.5)} ${n1(midY)})" fill="${t.accent}"/>
<rect class="fx" style="animation:pop .5s ease .9s both" x="${n1(l2 - 2)}" y="${n1(midY - 2.5)}" width="5" height="5" rx="1" transform="rotate(45 ${n1(l2 + 0.5)} ${n1(midY)})" fill="${t.accent}"/>`;
        }
      } else {
        const l = gx + groupW + 20;
        const r = W - px;
        if (r - l > 40) {
          const run = r - l - 60;
          line = `<rect class="hl hlL" x="${n1(l)}" y="${ly}" width="${n1(r - l)}" height="1" fill="url(#hlR)"/>
<rect class="hl hlL" x="${n1(l)}" y="${n1(midY - 0.5)}" width="28" height="2" rx="1" fill="${t.accent}"/>
<g class="comet loop loop-only" style="--d:${n1(run * 0.75)}px"><rect x="${n1(l + 10)}" y="${n1(midY - 0.5)}" width="60" height="2" rx="1" fill="url(#hcG)"/></g>`;
        }
      }
    }

    const body = `${withCard ? card(t, { width: W, height: H }) : ""}
${line}
${eb}
${icon}
${titleMarkup}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
