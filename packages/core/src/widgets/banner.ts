import { esc } from "../lib/escape";
import { cardStroke, fitSize, fitText, surfaceFill, svg, textWidth, wrapText } from "../lib/svg";
import { n1, pick, str } from "./kit-c";
import { accentDeep } from "./parts";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;
const HEIGHTS = { compact: 150, regular: 200, tall: 260 } as const;
const SIZES = { compact: 44, regular: 58, tall: 72 } as const;

/** Four-point sparkle used as the marquee separator. */
function star(cx: number, cy: number, r: number, fill: string): string {
  const k = r * 0.22;
  return `<path d="M${n1(cx)} ${n1(cy - r)}Q${n1(cx + k)} ${n1(cy - k)} ${n1(cx + r)} ${n1(cy)}Q${n1(cx + k)} ${n1(cy + k)} ${n1(cx)} ${n1(cy + r)}Q${n1(cx - k)} ${n1(cy + k)} ${n1(cx - r)} ${n1(cy)}Q${n1(cx - k)} ${n1(cy - k)} ${n1(cx)} ${n1(cy - r)}Z" fill="${fill}"/>`;
}

export const banner = defineWidget({
  type: "banner",
  title: "Statement banner",
  description: "A big typographic statement with a subline, brought to life by a gradient sweep, an outline draw-on, a letter-by-letter rise or a marquee.",
  category: "Header",
  kind: "svg",
  width: "full",
  defaults: {
    headline: "Crafting calm, fast software.",
    subline: "Developer tools, typed APIs and small interfaces that feel good to use.",
    effect: "gradient",
    align: "left",
    height: "regular",
    glow: true,
    corners: true,
  },
  fields: [
    { key: "headline", label: "Headline", type: "text", max: 80, help: PLACEHOLDER_HELP },
    { key: "subline", label: "Subline", type: "text", max: 160, placeholder: "Optional" },
    {
      key: "effect",
      label: "Effect",
      type: "select",
      options: [
        { value: "gradient", label: "Gradient sweep" },
        { value: "outline", label: "Outline draw-on" },
        { value: "rise", label: "Letter-by-letter rise" },
        { value: "marquee", label: "Marquee loop" },
        { value: "none", label: "None" },
      ],
    },
    {
      key: "align",
      label: "Alignment",
      type: "segmented",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
    },
    {
      key: "height",
      label: "Height",
      type: "segmented",
      options: [
        { value: "compact", label: "Compact" },
        { value: "regular", label: "Regular" },
        { value: "tall", label: "Tall" },
      ],
    },
    { key: "glow", label: "Ambient glow", type: "toggle" },
    { key: "corners", label: "Corner marks", type: "toggle", help: "Small registration ticks in the corners." },
  ],
  alt: (ctx, o) => [fillPlaceholders(str(o.headline), ctx), fillPlaceholders(str(o.subline), ctx)].filter(Boolean).join(" — ") || "Banner",
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const hk = pick(o.height, ["compact", "regular", "tall"] as const, "regular");
    const H = HEIGHTS[hk];
    let effect = pick(o.effect, ["gradient", "outline", "rise", "marquee", "none"] as const, "gradient");
    const center = pick(o.align, ["left", "center"] as const, "left") === "center";
    const headline = fill(str(o.headline)) || fill(str(this.defaults.headline));
    const subline = fill(str(o.subline));
    const smil = t.motion === "full";
    if (effect === "marquee" && t.motion !== "full") effect = "gradient";

    const pad = 56;
    const maxW = W - pad * 2;
    const hOpts = { bold: true, heading: true, letterSpacing: -1 };
    const target = SIZES[hk];
    // one line if it fits at ≥70% of the target size, otherwise wrap to two lines
    let size = fitSize(t, headline, target, maxW, target * 0.7, hOpts);
    let lines = [headline];
    if (effect !== "marquee" && textWidth(t, headline, size, hOpts) > maxW) {
      size = target * 0.74;
      lines = wrapText(t, headline, size, maxW, 2, hOpts);
    } else if (effect === "marquee") {
      size = target;
    } else lines = [fitText(t, headline, size, maxW, hOpts)];
    if (H === 150 && lines.length > 1) size = Math.min(size, 30);
    const lh = size * 1.08;
    const subSize = hk === "compact" ? 14 : 16;
    const subLines = subline ? wrapText(t, subline, subSize, center ? 620 : maxW, hk === "compact" ? 1 : 2) : [];
    const subLh = subSize * 1.5;
    const capH = size * 0.74;
    const blockH = capH + (lines.length - 1) * lh + (subLines.length ? 22 + (subLines.length - 1) * subLh + subSize * 0.75 : 0);
    const y0 = (H - blockH) / 2;
    const base0 = y0 + capH;
    const anchor = center ? "middle" : "start";
    const x = center ? W / 2 : pad;

    let css = `
.blob{animation:blob 14s ease-in-out infinite alternate}
@keyframes blob{from{transform:translate(0,0)}to{transform:translate(-160px,24px)}}
.under{transform-box:fill-box;transform-origin:${center ? "center" : "left"};animation:growX 1s cubic-bezier(.2,.7,.2,1) 1s both}`;
    let defs = `<clipPath id="bnClip"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${t.radius}"/></clipPath>
<radialGradient id="bnBlob"><stop offset="0" stop-color="${t.accent}" stop-opacity="${t.name === "dark" ? 0.28 : 0.14}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="bnTex" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="${center ? 0 : 1}"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="bnMask"><rect width="${W}" height="${H}" fill="url(#bnTex)"/></mask>`;

    const headText = (l: string, y: number, attrs: string, cls = "b h") =>
      `<text x="${n1(x)}" y="${n1(y)}" font-size="${n1(size)}" text-anchor="${anchor}" letter-spacing="-1" class="${cls}" ${attrs}>${esc(l)}</text>`;

    let head = "";
    if (effect === "gradient") {
      defs += `<linearGradient id="sweep" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0">
<stop offset="0" stop-color="${t.text}"/><stop offset=".38" stop-color="${t.text}"/><stop offset=".47" stop-color="${t.glow}"/><stop offset=".53" stop-color="${t.accent}"/><stop offset=".62" stop-color="${t.text}"/><stop offset="1" stop-color="${t.text}"/>
${smil ? `<animateTransform attributeName="gradientTransform" type="translate" values="-${W} 0;${W} 0;${W} 0" keyTimes="0;.55;1" dur="6s" begin="1s" repeatCount="indefinite"/>` : ""}
</linearGradient>
<linearGradient id="sweepStatic" gradientUnits="userSpaceOnUse" x1="${center ? W / 2 - 300 : pad}" y1="0" x2="${center ? W / 2 + 300 : pad + 600}" y2="0"><stop offset="0" stop-color="${t.text}"/><stop offset=".55" stop-color="${t.text}"/><stop offset="1" stop-color="${t.accent}"/></linearGradient>`;
      head = lines.map((l, i) => `<g class="in" style="animation-delay:${(0.1 + i * 0.12).toFixed(2)}s">${headText(l, base0 + i * lh, `fill="url(#${smil ? "sweep" : "sweepStatic"})"`)}</g>`).join("");
    } else if (effect === "outline") {
      const dash = Math.round(size * 6);
      css += `
.ol{stroke:${t.text};stroke-width:1.2;stroke-dasharray:${dash};stroke-dashoffset:${dash};fill:${t.text};fill-opacity:0;animation:draw 2.4s cubic-bezier(.6,.1,.3,1) .2s forwards,fillIn .9s ease 2s forwards}
@keyframes fillIn{to{fill-opacity:1;stroke-width:0}}`;
      head = lines.map((l, i) => headText(l, base0 + i * lh, `style="animation-delay:${(0.2 + i * 0.3).toFixed(2)}s,${(2 + i * 0.3).toFixed(2)}s"`, "b h ol")).join("");
    } else if (effect === "rise") {
      css += `
.ch{animation:rise .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(${n1(size * 0.55)}px)}to{opacity:1;transform:none}}`;
      let k = 0;
      head = lines
        .map((l, i) => {
          const y = base0 + i * lh;
          const lw = textWidth(t, l, size, hOpts);
          const sx = center ? W / 2 - lw / 2 : pad;
          const chars = [...l];
          const clip = `rise${i}`;
          defs += `<clipPath id="${clip}"><rect x="0" y="${n1(y - size * 1.05)}" width="${W}" height="${n1(size * 1.32)}"/></clipPath>`;
          const glyphs = chars
            .map((c, j) => {
              const cx = sx + (j ? textWidth(t, chars.slice(0, j).join(""), size, hOpts) - 1 : 0);
              const d = 0.15 + k++ * 0.035;
              if (c === " ") return "";
              return `<text x="${n1(cx)}" y="${n1(y)}" font-size="${n1(size)}" class="t b h ch" style="animation-delay:${d.toFixed(3)}s">${esc(c)}</text>`;
            })
            .join("");
          return `<g clip-path="url(#${clip})">${glyphs}</g>`;
        })
        .join("");
    } else if (effect === "marquee") {
      const item = headline;
      const iw = textWidth(t, item, size, hOpts);
      const sepW = size * 1.3;
      const unit = iw + sepW;
      const reps = Math.ceil((W * 2) / unit) + 1;
      const dur = Math.max(10, unit / 45);
      css += `.mq{animation:mq ${n1(dur)}s linear infinite}@keyframes mq{to{transform:translateX(-${n1(unit * 2)}px)}}`;
      const y = subLines.length ? base0 : H / 2 + capH / 2;
      const parts: string[] = [];
      for (let i = 0; i < reps * 2; i++) {
        const ix = i * unit;
        const outline = i % 2 === 1;
        parts.push(
          `<text x="${n1(ix)}" y="${n1(y)}" font-size="${size}" letter-spacing="-1" class="b h" ${outline ? `fill="none" stroke="${t.text}" stroke-width="1.1" stroke-opacity=".7"` : `fill="${t.text}"`}>${esc(item)}</text>${star(ix + iw + sepW / 2, y - capH / 2, size * 0.22, t.accent)}`,
        );
      }
      defs += `<linearGradient id="mqFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/><stop offset=".92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="mqMask"><rect width="${W}" height="${H}" fill="url(#mqFade)"/></mask>`;
      head = `<g class="fade" style="animation-delay:.1s" mask="url(#mqMask)"><g class="mq loop">${parts.join("")}</g></g>`;
    } else {
      head = lines.map((l, i) => `<g class="in" style="animation-delay:${(0.1 + i * 0.12).toFixed(2)}s">${headText(l, base0 + i * lh, `fill="${t.text}"`)}</g>`).join("");
    }

    const lastBase = base0 + (effect === "marquee" ? 0 : (lines.length - 1) * lh);
    const subY = lastBase + 22 + subSize * 0.75;
    const sub = subLines
      .map((l, i) => `<text x="${n1(x)}" y="${n1(subY + i * subLh)}" font-size="${subSize}" text-anchor="${anchor}" class="m in" style="animation-delay:${(effect === "outline" ? 1.6 : effect === "rise" ? 0.7 : 0.35) + i * 0.08}s">${esc(l)}</text>`)
      .join("");
    const underW = Math.min(120, Math.max(48, maxW * 0.08));
    const under =
      effect === "marquee"
        ? ""
        : `<rect class="under" x="${n1(center ? W / 2 - underW / 2 : pad + 2)}" y="${n1(y0 - 22)}" width="${n1(underW)}" height="3" rx="1.5" fill="url(#bnUnder)"/>`;
    defs += `<linearGradient id="bnUnder" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>`;

    const tick = (cx: number, cy: number, dx: number, dy: number) => `<path d="M${cx + dx * 10} ${cy}H${cx}V${cy + dy * 10}" stroke="${t.subtle}" stroke-width="1.2" fill="none"/>`;
    const corners = o.corners !== false ? `<g class="fade" style="animation-delay:.4s">${tick(16, 16, 1, 1)}${tick(W - 16, 16, -1, 1)}${tick(16, H - 16, 1, -1)}${tick(W - 16, H - 16, -1, -1)}</g>` : "";

    const body = `<g clip-path="url(#bnClip)">
<rect width="${W}" height="${H}" fill="${surfaceFill(t)}"/>
${t.texture !== "none" ? `<rect width="${W}" height="${H}" fill="url(#${t.texture})" mask="url(#bnMask)" opacity=".8"/>` : ""}
${o.glow !== false ? `<g class="blob loop"><ellipse cx="${center ? W / 2 + 140 : W - 160}" cy="${H * 0.35}" rx="300" ry="${Math.max(140, H)}" fill="url(#bnBlob)"/></g>` : ""}
${effect === "marquee" ? head : ""}
</g>
${cardStroke(t, W, H)}
${corners}
${effect !== "marquee" && y0 - 22 > 14 ? under : ""}
${effect !== "marquee" ? head : ""}
${sub}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
