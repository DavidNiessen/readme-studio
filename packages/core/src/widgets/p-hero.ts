import { projectName } from "../config";
import { esc, groupDigits } from "../lib/escape";
import { hasIcon, icon } from "../lib/icons";
import { odometer, odometerWidth } from "../lib/odometer";
import { cardStroke, fitSize, surfaceFill, svg, textWidth, wrapText } from "../lib/svg";
import { TNUM, compact, dl, optBool, optPick, optStr } from "./kit-d";
import { homeUrl, latestTag, mono, pdata, repoSlug, xglyph, type XGlyph } from "./kit-e";
import { accentDeep, glyph, onAccent, type GlyphName } from "./parts";
import { fillPlaceholders } from "./placeholders";
import { defineWidget, type Ctx } from "./types";

const W = 840;

interface MiniStat {
  g: { kind: "g"; name: GlyphName } | { kind: "x"; name: XGlyph };
  value: string;
  /** roll the value on an odometer */
  roll: boolean;
  unit: string;
}

function miniStats(ctx: Ctx, third: string): MiniStat[] {
  const pd = pdata(ctx);
  if (!pd) return [];
  const out: MiniStat[] = [
    { g: { kind: "g", name: "star" }, value: groupDigits(pd.stars), roll: true, unit: pd.stars === 1 ? "star" : "stars" },
    { g: { kind: "g", name: "fork" }, value: groupDigits(pd.forks), roll: true, unit: pd.forks === 1 ? "fork" : "forks" },
  ];
  const dl0 = (pd.downloads ?? []).find((d) => d && typeof d.lastWeek === "number");
  const order = [third, "license", "downloads", "contributors"];
  for (const k of order) {
    if (k === "license" && pd.license) return [...out, { g: { kind: "x", name: "scale" }, value: pd.license, roll: false, unit: "licence" }];
    if (k === "downloads" && dl0) return [...out, { g: { kind: "x", name: "download" }, value: compact(dl0.lastWeek!), roll: false, unit: "/ week" }];
    if (k === "contributors" && pd.contributorCount > 0)
      return [...out, { g: { kind: "g", name: "users" }, value: groupDigits(pd.contributorCount), roll: true, unit: "contributors" }];
  }
  return out;
}

/** Install hint with placeholders; hidden when a placeholder it uses has no value. */
function installHint(ctx: Ctx, raw: string): string {
  if (!raw) return "";
  const tokens = raw.match(/\{\s*[a-zA-Z]+\s*\}/g) ?? [];
  for (const tk of tokens) if (!fillPlaceholders(tk, ctx).trim() || fillPlaceholders(tk, ctx) === tk) return "";
  return fillPlaceholders(raw, ctx).trim();
}

function monogramText(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s._-]/gu, "").split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return [...words[0]][0].toUpperCase();
  return ([...words[0]][0] + [...words[1]][0]).toUpperCase();
}

export const projectHero = defineWidget({
  type: "project-hero",
  title: "Project hero",
  description: "Your project's name drawn on, its tagline, version, install command and headline numbers over an ambient glow.",
  scope: "project",
  category: "Header",
  kind: "svg",
  width: "full",
  needs: ["project", "releases"],
  defaults: {
    title: "",
    align: "left",
    version: true,
    stats: true,
    third: "license",
    install: "npm i {npm}",
    emblem: "",
    emblemStyle: "orbit",
    scanline: true,
    glow: true,
  },
  fields: [
    { key: "title", label: "Headline", type: "text", placeholder: "Defaults to the project name" },
    {
      key: "align",
      label: "Alignment",
      type: "segmented",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Centre" },
      ],
    },
    { key: "version", label: "Version pill", type: "toggle", help: "Latest release tag next to the name." },
    { key: "install", label: "Install command", type: "text", placeholder: "npm i {npm}", help: "Shown in a code pill under the tagline. Leave empty to hide. Placeholders: {npm} {repo} {project} {version}" },
    { key: "stats", label: "Headline numbers", type: "toggle" },
    {
      key: "third",
      label: "Third number",
      type: "segmented",
      when: { key: "stats", is: [true] },
      options: [
        { value: "license", label: "Licence" },
        { value: "downloads", label: "Downloads" },
        { value: "contributors", label: "Contributors" },
      ],
    },
    { key: "emblem", label: "Emblem icon", type: "icon", help: "Defaults to the project logo; without one a monogram tile is drawn." },
    {
      key: "emblemStyle",
      label: "Emblem style",
      type: "segmented",
      options: [
        { value: "orbit", label: "Orbit" },
        { value: "plain", label: "Plain" },
        { value: "none", label: "None" },
      ],
    },
    { key: "scanline", label: "Scanline sweep", type: "toggle" },
    { key: "glow", label: "Ambient glow", type: "toggle" },
  ],
  alt: (ctx, o) => {
    const name = fillPlaceholders(optStr(o.title), ctx) || projectName(ctx.project);
    const tag = (ctx.project.tagline || pdata(ctx)?.description || "").trim();
    return tag ? `${name} — ${tag}` : name;
  },
  href: (ctx) => homeUrl(ctx),
  render(ctx, o) {
    const t = ctx.theme;
    const pd = pdata(ctx);
    const center = optPick(o.align, ["left", "center"], "left") === "center";
    const style = optPick(o.emblemStyle, ["orbit", "plain", "none"], "orbit");
    const name = fillPlaceholders(optStr(o.title), ctx) || projectName(ctx.project) || pd?.name || "project";
    const tagline = (ctx.project.tagline || pd?.description || "").trim();
    const tag = optBool(o.version, true) ? latestTag(pd) : "";
    const cmd = installHint(ctx, optStr(o.install));
    const stats = optBool(o.stats, true) ? miniStats(ctx, optStr(o.third, "license")) : [];
    const slug = repoSlug(ctx);
    const mo = mono(t);

    const sideEmblem = style !== "none" && !center;
    const topEmblem = style !== "none" && center;
    const x0 = center ? W / 2 : 56;
    const colW = center ? 680 : sideEmblem ? 520 : 728;
    const anchor = center ? "middle" : "start";

    // ------------------------------------------------ vertical rhythm
    let y = topEmblem ? 128 : 58;
    const eyebrowY = y;
    // version pill sits next to the name, so it eats into the name's room
    const pillSize = 12;
    const pillW = tag ? textWidth(t, tag, pillSize, { bold: true }) + 22 : 0;
    const nameMax = colW - (tag ? pillW + 16 : 0);
    const nameSize = fitSize(t, name, 64, nameMax, 28, { bold: true, heading: true, letterSpacing: -1.5 });
    const nameW = textWidth(t, name, nameSize, { bold: true, heading: true, letterSpacing: -1.5 });
    const nameY = y + 20 + Math.round(nameSize * 0.74);
    y = nameY;
    const tagSize = 17;
    const lines = tagline ? wrapText(t, tagline, tagSize, colW, 2) : [];
    const tagY = nameY + 38;
    if (lines.length) y = tagY + (lines.length - 1) * 25;
    const cmdSize = 13;
    const cmdH = 36;
    const cmdTextW = cmd ? mo.measure(cmd, cmdSize) : 0;
    const cmdW = cmd ? Math.min(colW, cmdTextW + 82) : 0;
    const cmdY = y + (lines.length ? 24 : 26);
    if (cmd) y = cmdY + cmdH;
    const statY = y + (cmd ? 36 : 40);
    if (stats.length) y = statY;
    const H = Math.max(sideEmblem ? 250 : 200, Math.round(y + (center ? 36 : stats.length ? 42 : 46)));

    // ------------------------------------------------ name + version pill
    const groupW = nameW + (tag ? 16 + pillW : 0);
    const nameX = center ? W / 2 - groupW / 2 : x0;
    const dash = Math.max(180, Math.round(nameW * 0.9));
    const pillX = nameX + nameW + 16;
    const pillY = nameY - nameSize * 0.72 + (nameSize * 0.72 - 24) / 2;
    const version = tag
      ? `<g class="in" style="${dl(1.5)}">
<rect x="${pillX.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="24" rx="12" fill="${t.accent}"/>
<rect x="${pillX.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="24" rx="12" fill="url(#shine)" class="psh loop loop-only"/>
<text x="${(pillX + pillW / 2).toFixed(1)}" y="${(pillY + 16.3).toFixed(1)}" font-size="${pillSize}" text-anchor="middle" fill="${onAccent(t)}" class="b">${esc(tag)}</text></g>`
      : "";

    // ------------------------------------------------ eyebrow (repo slug)
    let eyebrow = "";
    if (slug) {
      const txt = slug.toUpperCase();
      const lw = 16 + textWidth(t, txt, 11.5, { bold: true, letterSpacing: 2 });
      const lx = center ? W / 2 - lw / 2 : x0;
      eyebrow = `<g class="in" style="${dl(0.1)}">
<circle cx="${lx + 4}" cy="${eyebrowY - 4}" r="4" fill="${t.accent}"/><circle cx="${lx + 4}" cy="${eyebrowY - 4}" r="4" fill="${t.accent}" class="loop" style="animation:pulse 2s ease-in-out infinite" filter="url(#glow)"/>
<text x="${lx + 16}" y="${eyebrowY}" font-size="11.5" letter-spacing="2" class="m b">${esc(txt)}</text></g>`;
    }

    // ------------------------------------------------ tagline
    const tagMarkup = lines
      .map((l, i) => `<text x="${x0}" y="${tagY + i * 25}" font-size="${tagSize}" text-anchor="${anchor}" class="m in" style="${dl(1.3 + i * 0.08)}">${esc(l)}</text>`)
      .join("");

    // ------------------------------------------------ install pill
    let install = "";
    if (cmd) {
      const cx0 = center ? W / 2 - cmdW / 2 : x0;
      const shown = cmdTextW + 82 > colW ? cmd.slice(0, Math.max(4, Math.floor(((colW - 82) / cmdTextW) * cmd.length) - 1)) + "…" : cmd;
      const r = Math.min(10, t.radius);
      install = `<g class="in" style="${dl(1.6)}">
<rect x="${cx0.toFixed(1)}" y="${cmdY}" width="${cmdW.toFixed(1)}" height="${cmdH}" rx="${r}" fill="${t.raised}" stroke="${t.border}"/>
<text x="${(cx0 + 16).toFixed(1)}" y="${cmdY + 22.6}" font-size="${cmdSize}" class="a b mono">$</text>
<text x="${(cx0 + 34).toFixed(1)}" y="${cmdY + 22.6}" font-size="${cmdSize}" class="t mono">${esc(shown)}</text>
<rect x="${(cx0 + 34 + mo.measure(shown, cmdSize) + 3).toFixed(1)}" y="${cmdY + 11}" width="7" height="14" rx="1" fill="${t.accent}" class="blink loop"/>
<path d="M${(cx0 + cmdW - 40).toFixed(1)} ${cmdY + 9}V${cmdY + cmdH - 9}" stroke="${t.border}"/>
${xglyph("copy", cx0 + cmdW - 28, cmdY + 10, 16, t.muted)}
</g>`;
    }

    // ------------------------------------------------ inline stats
    let statRow = "";
    if (stats.length) {
      const size = 15;
      const items = stats.map((s) => {
        const vw = s.roll ? odometerWidth(t, s.value, size, true) : textWidth(t, s.value, size, { bold: true });
        const uw = textWidth(t, s.unit, 13);
        return { s, vw, uw, w: 22 + vw + 6 + uw };
      });
      const gap = 30;
      const total = items.reduce((a, b) => a + b.w, 0) + gap * (items.length - 1);
      let sx = center ? W / 2 - total / 2 : x0;
      statRow = items
        .map((it, i) => {
          const d0 = 1.8 + i * 0.12;
          const gx = sx;
          const g = it.s.g.kind === "g" ? glyph(it.s.g.name, gx, statY - 12.5, 15, t.accent) : xglyph(it.s.g.name, gx, statY - 12.5, 15, t.accent);
          const vx = gx + 22;
          const val = it.s.roll
            ? `<g class="tn">${odometer(t, it.s.value, { x: vx, y: statY, fontSize: size, delay: d0 + 0.1, duration: 1.4 })}</g>`
            : `<text x="${vx.toFixed(1)}" y="${statY}" font-size="${size}" class="t b">${esc(it.s.value)}</text>`;
          const sep = i < items.length - 1 ? `<circle cx="${(sx + it.w + gap / 2).toFixed(1)}" cy="${statY - 5}" r="1.6" fill="${t.subtle}"/>` : "";
          sx += it.w + gap;
          return `<g class="in" style="${dl(d0)}">${g}${val}<text x="${(vx + it.vw + 6).toFixed(1)}" y="${statY}" font-size="13" class="m">${esc(it.s.unit)}</text>${sep}</g>`;
        })
        .join("");
    }

    // ------------------------------------------------ emblem
    const logoId = optStr(o.emblem) || ctx.project.logo || "";
    const useIcon = !!logoId && hasIcon(logoId);
    const emblemAt = (cx: number, cy: number, ks: number, rings: boolean) => {
      const half = ks / 2;
      let inner: string;
      if (useIcon) {
        const em = icon(logoId);
        const emInner = em.inner.replace(/fill="currentColor"/g, 'fill="url(#kgrad)"');
        inner = `<svg x="${-ks * 0.3}" y="${-ks * 0.3}" width="${ks * 0.6}" height="${ks * 0.6}" viewBox="${em.viewBox}" color="url(#kgrad)">${emInner}</svg>`;
      } else {
        const s = ks * 0.62;
        const m = monogramText(name);
        const fs = m.length > 1 ? s * 0.4 : s * 0.52;
        inner = `<rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${Math.max(6, s * 0.26).toFixed(1)}" fill="url(#kgrad)"/>
<rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s / 2}" rx="${Math.max(6, s * 0.26).toFixed(1)}" fill="#fff" opacity="${t.name === "dark" ? 0.08 : 0.14}"/>
<text x="0" y="${(fs * 0.36).toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="middle" fill="${onAccent(t)}" class="b h" letter-spacing="-.5">${esc(m)}</text>`;
      }
      const ringMarkup = rings
        ? `<circle class="ring loop" cx="0" cy="0" r="${ks * 0.78}" stroke="${t.subtle}" stroke-dasharray="2 10" stroke-width="2"/>
<circle class="ring2 loop" cx="0" cy="0" r="${ks * 0.62}" stroke="${t.accent}" stroke-opacity=".5" stroke-dasharray="40 160 10 60" stroke-width="1.5"/>
<g class="orbit loop"><circle cx="0" cy="0" r="${ks * 0.62}"/><circle cx="${ks * 0.62}" cy="0" r="3.5" fill="${t.glow}" filter="url(#glow)"/></g>`
        : "";
      return `<g transform="translate(${cx} ${cy})"><g class="in" style="${dl(0.4)}">
${ringMarkup}
<g class="bob loop">
<circle class="kpulse loop" cx="0" cy="0" r="${half * 0.72}" fill="${t.accent}" filter="url(#softglow)"/>
${inner}
</g></g></g>`;
    };
    const emblem = sideEmblem ? emblemAt(704, Math.round(H / 2), 128, style === "orbit") : topEmblem ? emblemAt(W / 2, 62, 72, style === "orbit") : "";

    const dark = t.name === "dark";
    const css = `${TNUM}${mo.css}
.drift{animation:drift 6s linear infinite}
@keyframes drift{to{transform:translate(-16px,-16px)}}
.blob{animation:blob 14s ease-in-out infinite alternate}
@keyframes blob{0%{transform:translate(0,0)}50%{transform:translate(-120px,40px)}100%{transform:translate(60px,-20px)}}
.name{stroke:${t.text};stroke-width:1.2;stroke-dasharray:${dash};stroke-dashoffset:${dash};fill:${t.text};fill-opacity:0;
  animation:draw 2s cubic-bezier(.6,.1,.3,1) .2s forwards,fillIn .8s ease 1.5s forwards}
@keyframes fillIn{to{fill-opacity:1;stroke-width:0}}
.scan{animation:scan 5s linear infinite}
@keyframes scan{from{transform:translateY(-20px)}to{transform:translateY(${H + 20}px)}}
.bob{animation:bob 5s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.ring{transform-box:fill-box;transform-origin:center;animation:spin 18s linear infinite}
.ring2{transform-box:fill-box;transform-origin:center;animation:spinR 26s linear infinite}
.orbit{transform-box:fill-box;transform-origin:center;animation:spin 9s linear infinite}
.kpulse{transform-box:fill-box;transform-origin:center;animation:kp 3s ease-in-out infinite}
@keyframes kp{0%,100%{opacity:.25;transform:scale(.9)}50%{opacity:.6;transform:scale(1.1)}}
.psh{animation:pshine 5s ease-in-out 3s infinite}
@keyframes pshine{0%,70%,100%{opacity:0}80%{opacity:1}}`;
    const defs = `
<clipPath id="frame"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${t.radius + 4}"/></clipPath>
<linearGradient id="kgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset=".55" stop-color="${t.accent}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<radialGradient id="blobG"><stop offset="0" stop-color="${t.accent}" stop-opacity="${dark ? 0.32 : 0.16}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="scanG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset="1" stop-color="${t.accent}" stop-opacity="${dark ? 0.12 : 0.05}"/></linearGradient>`;
    const body = `
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="${surfaceFill(t)}"/>
  ${t.texture !== "none" ? `<g class="drift loop"><rect x="0" y="0" width="${W + 32}" height="${H + 32}" fill="url(#${t.texture})"/></g>` : ""}
  ${optBool(o.glow, true) ? `<g class="blob loop"><circle cx="${center ? W / 2 : 600}" cy="${Math.round(H * 0.45)}" r="260" fill="url(#blobG)"/></g>` : ""}
  ${optBool(o.scanline, true) ? `<rect class="scan loop loop-only" x="0" y="0" width="${W}" height="20" fill="url(#scanG)"/>` : ""}
</g>
${cardStroke(t, W, H, t.radius + 4)}
${eyebrow}
<text x="${nameX.toFixed(1)}" y="${nameY}" font-size="${nameSize}" class="name b h" letter-spacing="-1.5">${esc(name)}</text>
${version}
${tagMarkup}
${install}
${statRow}
${emblem}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
