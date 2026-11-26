import { contrast } from "../lib/color";
import { esc } from "../lib/escape";
import { icon, iconSvg } from "../lib/icons";
import { fitText, surfaceFill, svg } from "../lib/svg";
import type { Theme } from "../theme";
import { defineWidget } from "./types";

const H = 52;

function iconColor(t: Theme, id: string, mode: string): string {
  if (mode === "accent") return t.accent;
  if (mode === "text") return t.text;
  const c = icon(id).color;
  if (!c) return "brand";
  return contrast(c, t.raised) < 1.7 ? t.text : c;
}

function keyOf(i: number, iconId: string): string {
  return `${i + 1}-${iconId.replace(/[^a-z0-9]/gi, "").toLowerCase() || "link"}`;
}

export const socials = defineWidget({
  type: "socials",
  title: "Social pills",
  description: "One animated, clickable pill per profile link. Each is its own image so every link works.",
  category: "Identity",
  kind: "svg",
  width: "full",
  fixedHeight: H,
  defaults: { style: "pill", iconColor: "accent", runner: true },
  fields: [
    {
      key: "style",
      label: "Style",
      type: "segmented",
      options: [
        { value: "pill", label: "Pill" },
        { value: "compact", label: "Compact" },
        { value: "icon", label: "Icon only" },
      ],
    },
    {
      key: "iconColor",
      label: "Icon colour",
      type: "segmented",
      options: [
        { value: "accent", label: "Accent" },
        { value: "brand", label: "Brand" },
        { value: "text", label: "Text" },
      ],
    },
    { key: "runner", label: "Running border light", type: "toggle" },
  ],
  alt: () => "social links",
  parts: (ctx) =>
    ctx.profile.links
      .filter((l) => l.url)
      .map((l, i) => ({ key: keyOf(i, l.icon), alt: l.label || l.icon, href: l.url })),
  render(ctx, o) {
    const first = this.parts!(ctx, o)[0];
    return first ? this.renderPart!(ctx, o, first.key) : svg({ width: 200, height: H, theme: ctx.theme, title: "no links", body: "" });
  },
  renderPart(ctx, o, key) {
    const t = ctx.theme;
    const links = ctx.profile.links.filter((l) => l.url);
    const index = Math.max(0, links.findIndex((l, i) => keyOf(i, l.icon) === key));
    const link = links[index] ?? { icon: "website", label: "Link", url: "", handle: "" };
    const style = o.style as string;
    const W = style === "icon" ? H : style === "compact" ? 150 : 200;
    const r = Math.min(14, t.radius + 2);
    const perim = 2 * (W - 2 + H - 2);
    const d0 = index * 0.25;
    const css = `
.run{stroke-dasharray:60 ${perim - 60};animation:runB 4s linear ${index * -1.3}s infinite}
@keyframes runB{to{stroke-dashoffset:-${perim}}}
.sh{animation:shimmer 4.5s ease-in-out ${1 + index * 0.6}s infinite}
.bob{transform-box:fill-box;transform-origin:center;animation:ibob 3s ease-in-out ${index * 0.4}s infinite}
@keyframes ibob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(-6deg)}}
.arrow{animation:arr 2.2s ease-in-out infinite}
@keyframes arr{0%,100%{transform:translate(0,0)}50%{transform:translate(2px,-2px)}}`;
    const color = iconColor(t, link.icon, o.iconColor as string);
    const frame = `<clipPath id="pc"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${r}"/></clipPath>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${r}" fill="${surfaceFill(t)}" stroke="${t.border}"/>
${o.runner ? `<rect class="run loop loop-only" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${r}" stroke="url(#accentGrad)" stroke-width="1.5" stroke-linecap="round"/>` : ""}
<g clip-path="url(#pc)"><rect class="sh loop loop-only" x="0" y="0" width="80" height="${H}" fill="url(#shine)" transform="skewX(-20)"/></g>`;
    let inner: string;
    if (style === "icon") {
      inner = `<g class="bob loop">${iconSvg(link.icon, 15, 15, 22, color)}</g>`;
    } else {
      const textX = 66;
      const maxW = W - textX - (style === "pill" ? 30 : 12);
      const title = fitText(t, link.label || icon(link.icon).title, 13.5, maxW, { bold: true });
      const sub = fitText(t, link.handle || link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), 10.5, maxW);
      inner = `<rect x="12" y="10" width="44" height="32" rx="${Math.max(4, r - 5)}" fill="${t.raised}" stroke="${t.border}"/>
<g class="bob loop">${iconSvg(link.icon, 25, 17, 18, color)}</g>
<text x="${textX}" y="${sub ? 24 : 30.5}" font-size="13.5" class="t b">${esc(title)}</text>
${sub ? `<text x="${textX}" y="39" font-size="10.5" class="m">${esc(sub)}</text>` : ""}
${style === "pill" ? `<g class="arrow loop"><path d="M${W - 24} 30l8-8M${W - 22} 22h6v6" stroke="${t.muted}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>` : ""}`;
    }
    const body = `<g class="in" style="animation-delay:${d0}s">${frame}${inner}</g>`;
    return svg({ width: W, height: H, theme: t, title: link.label || link.icon, css, body });
  },
});
