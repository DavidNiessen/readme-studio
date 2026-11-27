import type { Theme } from "../theme";
import { fontFaceCss, fontStack, measureText, type Weight } from "../fonts";
import { esc } from "./escape";

export interface SvgOptions {
  width: number;
  height: number;
  theme: Theme;
  /** accessible title (aria-label); never rendered */
  title: string;
  body: string;
  css?: string;
  defs?: string;
  /** embed fonts (default true) */
  fonts?: boolean;
}

/** Easing used for most entrance motion. */
export const EASE = "cubic-bezier(.2,.7,.2,1)";

function motionCss(t: Theme): string {
  const reduce = `*{animation-delay:0s!important;animation-duration:1ms!important;animation-iteration-count:1!important}.loop{animation:none!important}.loop-only{display:none}`;
  if (t.motion === "off") return reduce;
  if (t.motion === "subtle") return `.loop{animation:none!important}.loop-only{display:none}`;
  return "";
}

/** Shared CSS available to every widget. */
export function baseCss(t: Theme): string {
  return `
svg{color-scheme:${t.name}}
text{font-family:${fontStack(t.font)};}
.h{font-family:${fontStack(t.headingFont)}}
.t{fill:${t.text}}.m{fill:${t.muted}}.a{fill:${t.accent}}.g{fill:${t.glow}}.s{fill:${t.subtle}}.a2{fill:${t.accent2}}
.b{font-weight:700}
.fx{transform-box:fill-box;transform-origin:center}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pop{0%{opacity:0;transform:scale(.2)}70%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes spinR{to{transform:rotate(-360deg)}}
@keyframes roll{to{transform:translateY(var(--y))}}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes shimmer{0%{transform:translateX(-120%)}60%,100%{transform:translateX(220%)}}
.in{animation:fadeUp .8s ${EASE} both}
.fade{animation:fadeIn .8s ease both}
.blink{animation:blink 1s step-end infinite}
${motionCss(t)}
@media (prefers-reduced-motion: reduce){
  *{animation-delay:0s!important;animation-duration:1ms!important;animation-iteration-count:1!important}
  .loop{animation:none!important}.loop-only{display:none}
}`;
}

/** Wrap a widget body into a standalone SVG document. */
export function svg(o: SvgOptions): string {
  const t = o.theme;
  const fonts = o.fonts === false ? "" : fontFaceCss([t.font, t.headingFont]);
  const w = Math.round(o.width);
  const h = Math.round(o.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="${esc(o.title)}">
<title>${esc(o.title)}</title>
<style>${fonts}${baseCss(t)}${o.css ?? ""}</style>
<defs>${commonDefs(t)}${o.defs ?? ""}</defs>
${o.body}
</svg>
`;
}

/** Defs that many widgets use: glow filter, textures, accent gradient, shine. */
export function commonDefs(t: Theme): string {
  const dark = t.name === "dark";
  return `
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="softglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="8"/></filter>
<pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${t.subtle}" opacity="${dark ? 0.55 : 0.8}"/></pattern>
<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="${t.subtle}" stroke-width=".6" opacity="${dark ? 0.5 : 0.7}"/></pattern>
<pattern id="lines" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V10" stroke="${t.subtle}" stroke-width=".8" opacity="${dark ? 0.35 : 0.5}"/></pattern>
<linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.glow}"/></linearGradient>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${dark ? 0.12 : 0.5}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="cardFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.card}" stop-opacity="0"/><stop offset="1" stop-color="${t.card}"/></linearGradient>`;
}

export interface CardOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
  /** overrides the theme radius */
  radius?: number;
  /** draw the theme texture (default true) */
  texture?: boolean;
}

/** Fill for a card surface, honouring transparent themes. */
export function surfaceFill(t: Theme): string {
  return t.surface ? t.card : "none";
}

/** A rounded card surface with a hairline border and the theme texture. */
export function card(t: Theme, o: CardOptions): string {
  const { x = 0.5, y = 0.5, width, height, texture = true } = o;
  const r = o.radius ?? t.radius;
  const bw = t.borderWidth;
  const stroke = bw > 0 ? ` stroke="${t.border}" stroke-width="${bw}"` : "";
  const inset = bw > 1 ? (bw - 1) / 2 : 0;
  const rect = (extra: string) =>
    `<rect x="${x + inset}" y="${y + inset}" width="${width - 1 - inset * 2}" height="${height - 1 - inset * 2}" rx="${r}" ${extra}/>`;
  const tex = texture && t.texture !== "none" ? rect(`fill="url(#${t.texture})" opacity=".5"`) : "";
  return `${rect(`fill="${surfaceFill(t)}"${stroke}`)}${tex}`;
}

/** Card outline only (for drawing on top of clipped content). */
export function cardStroke(t: Theme, width: number, height: number, radius = t.radius): string {
  if (t.borderWidth <= 0) return "";
  const inset = t.borderWidth > 1 ? (t.borderWidth - 1) / 2 : 0;
  return `<rect x="${0.5 + inset}" y="${0.5 + inset}" width="${width - 1 - inset * 2}" height="${height - 1 - inset * 2}" rx="${radius}" stroke="${t.border}" stroke-width="${t.borderWidth}"/>`;
}

/** Section label like `● CONTRIBUTIONS` with a pulsing accent dot. */
export function label(t: Theme, x: number, y: number, text: string, delay = 0): string {
  return `<g class="in" style="animation-delay:${delay}s">
<circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${t.accent}"/><circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${t.accent}" class="loop" style="animation:pulse 2s ease-in-out infinite" filter="url(#glow)"/>
<text x="${x + 16}" y="${y}" font-size="12" letter-spacing="2" class="m b">${esc(text.toUpperCase())}</text></g>`;
}

export interface MeasureOptions {
  bold?: boolean;
  heading?: boolean;
  letterSpacing?: number;
}

/** Rendered width of text in the theme's body (or heading) font. */
export function textWidth(t: Theme, text: string, size: number, o: MeasureOptions = {}): number {
  const w: Weight = o.bold ? 700 : 400;
  return measureText(text, size, o.heading ? t.headingFont : t.font, w, o.letterSpacing ?? 0);
}

/** Cut text with an ellipsis so it fits `max` px. */
export function fitText(t: Theme, text: string, size: number, max: number, o: MeasureOptions = {}): string {
  if (textWidth(t, text, size, o) <= max) return text;
  const chars = [...text];
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(t, chars.slice(0, mid).join("") + "…", size, o) <= max) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join("").trimEnd() + "…";
}

/** Largest font size ≤ `size` (down to `min`) at which text fits in `max` px. */
export function fitSize(t: Theme, text: string, size: number, max: number, min = size * 0.5, o: MeasureOptions = {}): number {
  let s = size;
  while (s > min && textWidth(t, text, s, o) > max) s -= 0.5;
  return s;
}

/** Greedy word wrap by measured width, at most maxLines lines; the last line is ellipsised when cut. */
export function wrapText(t: Theme, text: string, size: number, max: number, maxLines: number, o: MeasureOptions = {}): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = cur ? `${cur} ${w}` : w;
    if (textWidth(t, next, size, o) <= max) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const used = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (used < words.length && lines.length) {
    lines[lines.length - 1] = fitText(t, `${lines[lines.length - 1]} ${words.slice(used).join(" ")}`, size, max, o);
  }
  return lines.map((l) => fitText(t, l, size, max, o));
}

/** Inline style with an animation delay. */
export function delay(s: number): string {
  return `animation-delay:${s.toFixed(2)}s`;
}

/** Polar → cartesian. Angle in degrees, 0 = 12 o'clock, clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** SVG arc path between two angles (degrees, clockwise from 12 o'clock). */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Number with fixed decimals as attribute value. */
export function f(n: number, d = 1): string {
  return Number(n.toFixed(d)).toString();
}
