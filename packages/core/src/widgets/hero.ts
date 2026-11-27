import { formatLongDate, greeting, moonPhase } from "../lib/astro";
import { esc } from "../lib/escape";
import { cardStroke, fitSize, surfaceFill, svg, textWidth } from "../lib/svg";
import { emblemMark, hasMark } from "./kit-c";
import { accentDeep, moonGlyph } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;
const H = 280;

/** SMIL typewriter: per-role clip width + cursor x, typed and erased char by char. */
function typewriter(ctx: Ctx, roles: string[], x: number, y: number, size: number): string {
  const t = ctx.theme;
  if (!roles.length) return "";
  if (t.motion === "off" || roles.length === 0) {
    return `<text x="${x - size * 1.3}" y="${y}" font-size="${size}" class="a b">&gt;</text><text x="${x}" y="${y}" font-size="${size}" class="t">${esc(roles[0])}</text>`;
  }
  const slot = 4;
  const total = slot * roles.length;
  const parts: string[] = [];
  roles.forEach((role, i) => {
    const chars = [...role];
    const n = chars.length;
    const start = i * slot;
    const typeDur = Math.min(1.6, n * 0.06);
    const eraseDur = Math.min(0.7, n * 0.025);
    const holdEnd = start + slot - eraseDur - 0.15;
    const frames: [number, number][] = [[0, 0]];
    if (start > 0) frames.push([start, 0]);
    for (let c = 1; c <= n; c++) frames.push([start + (typeDur * c) / n, c]);
    frames.push([holdEnd, n]);
    for (let c = n - 1; c >= 0; c--) frames.push([holdEnd + (eraseDur * (n - c)) / n, c]);
    frames.push([total, 0]);
    const widthAt = (c: number) => textWidth(t, chars.slice(0, c).join(""), size);
    const keyTimes = frames.map(([s]) => (s / total).toFixed(4)).join(";");
    const widths = frames.map(([, c]) => widthAt(c).toFixed(1)).join(";");
    const id = `tw${i}`;
    parts.push(`<clipPath id="${id}"><rect x="${x}" y="${y - size}" height="${size * 1.4}" width="0"><animate attributeName="width" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${widths}"/></rect></clipPath>
<text x="${x}" y="${y}" font-size="${size}" class="t" clip-path="url(#${id})">${esc(role)}</text>
<rect y="${y - size * 0.82}" width="${size * 0.55}" height="${size}" fill="${t.accent}" x="${x}" opacity="0">
<animate attributeName="x" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${frames.map(([, c]) => (x + widthAt(c) + 2).toFixed(1)).join(";")}"/>
<animate attributeName="opacity" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${(start / total).toFixed(4)};${((start + slot) / total).toFixed(4)}" values="0;1;0"/>
</rect>`);
  });
  return `<text x="${x - size * 1.3}" y="${y}" font-size="${size}" class="a b">&gt;</text>${parts.join("\n")}`;
}

const heroRoles = (o: Record<string, unknown>) => (Array.isArray(o.roles) ? o.roles : []).filter((r): r is string => typeof r === "string" && r.trim() !== "");

export const hero = defineWidget({
  type: "hero",
  title: "Hero banner",
  description: "Your name drawn on stroke by stroke, a typewriter cycling through your roles and an orbiting emblem.",
  scope: "profile",
  category: "Header",
  kind: "svg",
  width: "full",
  defaults: {
    title: "",
    roles: ["Software Engineer", "Open-source tinkerer", "Coffee-driven developer"],
    typewriter: true,
    greeting: true,
    emblem: "github",
    emblemStyle: "orbit",
    glitch: true,
    scanline: true,
    glow: true,
  },
  fields: [
    { key: "title", label: "Name", type: "text", placeholder: "Defaults to your GitHub name" },
    { key: "roles", label: "Roles", type: "tags", placeholder: "Add a role and press Enter", max: 12, help: "Cycled by the typewriter. Other widgets and the {role} placeholder use the first." },
    { key: "typewriter", label: "Typewriter roles", type: "toggle", help: "Cycles through the roles above." },
    { key: "greeting", label: "Greeting line", type: "toggle", help: "Time-of-day greeting, date and moon phase." },
    { key: "emblem", label: "Emblem", type: "icon" },
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
    { key: "glitch", label: "Glitch flicker", type: "toggle" },
    { key: "scanline", label: "Scanline sweep", type: "toggle" },
    { key: "glow", label: "Ambient glow", type: "toggle" },
  ],
  alt: (ctx, o) => {
    const role = heroRoles(o)[0] ?? "";
    return `${o.title || ctx.profile.name}${role ? ` — ${role}` : ""}`;
  },
  render(ctx, o) {
    const t = ctx.theme;
    const name = (o.title as string) || ctx.profile.name;
    const hasEmblem = o.emblemStyle !== "none";
    const maxNameW = hasEmblem ? 520 : 744;
    const nameSize = fitSize(t, name, 56, maxNameW, 26, { bold: true, heading: true, letterSpacing: -1 });
    const nameW = textWidth(t, name, nameSize, { bold: true, heading: true, letterSpacing: -1 });
    const dash = Math.max(180, Math.round(nameW * 0.9));
    const css = `
.drift{animation:drift 6s linear infinite}
@keyframes drift{to{transform:translate(-16px,-16px)}}
.blob{animation:blob 14s ease-in-out infinite alternate}
@keyframes blob{0%{transform:translate(0,0)}50%{transform:translate(-120px,40px)}100%{transform:translate(60px,-20px)}}
.name{stroke:${t.text};stroke-width:1.2;stroke-dasharray:${dash};stroke-dashoffset:${dash};fill:${t.text};fill-opacity:0;
  animation:draw 2.2s cubic-bezier(.6,.1,.3,1) .2s forwards,fillIn .8s ease 1.8s forwards}
@keyframes fillIn{to{fill-opacity:1;stroke-width:0}}
.gl{opacity:0;animation:glitch 7s steps(1) 3s infinite}
.gl2{animation-delay:3.08s}
@keyframes glitch{0%{opacity:0;transform:none}2%{opacity:.9;transform:translate(-5px,0)}3%{transform:translate(4px,0)}4.5%{transform:translate(-2px,0)}6%{opacity:0;transform:none}100%{opacity:0}}
.scan{animation:scan 5s linear infinite}
@keyframes scan{from{transform:translateY(-20px)}to{transform:translateY(${H + 20}px)}}
.bob{animation:bob 5s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.ring{transform-box:fill-box;transform-origin:center;animation:spin 18s linear infinite}
.ring2{transform-box:fill-box;transform-origin:center;animation:spinR 26s linear infinite}
.kpulse{transform-box:fill-box;transform-origin:center;opacity:.25;transform:scale(.9);animation:kp 3s ease-in-out infinite}
@keyframes kp{0%,100%{opacity:.25;transform:scale(.9)}50%{opacity:.6;transform:scale(1.1)}}
.under{transform-box:fill-box;transform-origin:left;animation:growX 1.2s cubic-bezier(.2,.7,.2,1) 2s both}`;
    const nameY = 122;
    const defs = `
<clipPath id="frame"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${t.radius + 4}"/></clipPath>
<clipPath id="sliceA"><rect x="0" y="${nameY - 60}" width="${W}" height="12"/><rect x="0" y="${nameY - 30}" width="${W}" height="6"/></clipPath>
<clipPath id="sliceB"><rect x="0" y="${nameY - 46}" width="${W}" height="10"/></clipPath>
<linearGradient id="kgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset=".55" stop-color="${t.accent}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<radialGradient id="blobG"><stop offset="0" stop-color="${t.accent}" stop-opacity="${t.name === "dark" ? 0.35 : 0.18}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="scanG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset="1" stop-color="${t.accent}" stop-opacity="${t.name === "dark" ? 0.12 : 0.05}"/></linearGradient>`;
    const ks = 130;
    const kx = 640;
    const ky = 70;
    const footY = 236;
    const greet = `${greeting(ctx.now.hour)}${ctx.profile.location.city ? ` from ${ctx.profile.location.city}` : ""}`;
    const moon = moonPhase(ctx.date);
    const emblemId = String(o.emblem ?? "");
    const emblem =
      o.emblemStyle === "none"
        ? ""
        : `<g transform="translate(${kx} ${ky})">
  ${
    o.emblemStyle === "orbit"
      ? `<circle class="ring loop" cx="${ks / 2}" cy="${ks / 2}" r="${ks * 0.78}" stroke="${t.subtle}" stroke-dasharray="2 10" stroke-width="2"/>
  <circle class="ring2 loop" cx="${ks / 2}" cy="${ks / 2}" r="${ks * 0.62}" stroke="${t.accent}" stroke-opacity=".5" stroke-dasharray="40 160 10 60" stroke-width="1.5"/>`
      : ""
  }
  <g class="bob loop">
    <circle class="kpulse loop" cx="${ks / 2}" cy="${ks / 2}" r="${ks * 0.36}" fill="${t.accent}" filter="url(#softglow)"/>
    ${emblemMark(hasMark(emblemId) ? emblemId : "github", ks * 0.2, ks * 0.2, ks * 0.6, "url(#kgrad)")}
  </g>
</g>`;
    const roles = o.typewriter ? heroRoles(o) : [];
    const body = `
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="${surfaceFill(t)}"/>
  ${t.texture !== "none" ? `<g class="drift loop"><rect x="0" y="0" width="${W + 32}" height="${H + 32}" fill="url(#${t.texture})"/></g>` : ""}
  ${o.glow ? `<g class="blob loop"><circle cx="560" cy="120" r="260" fill="url(#blobG)"/></g>` : ""}
  ${o.scanline ? `<rect class="scan loop loop-only" x="0" y="0" width="${W}" height="20" fill="url(#scanG)"/>` : ""}
</g>
${cardStroke(t, W, H, t.radius + 4)}
<text x="48" y="${nameY}" font-size="${nameSize}" class="name b h" letter-spacing="-1">${esc(name)}</text>
${
  o.glitch
    ? `<g class="gl loop" clip-path="url(#sliceA)"><text x="48" y="${nameY}" font-size="${nameSize}" class="b h" fill="${t.accent}" letter-spacing="-1">${esc(name)}</text></g>
<g class="gl gl2 loop" clip-path="url(#sliceB)"><text x="51" y="${nameY}" font-size="${nameSize}" class="b h" fill="${t.muted}" letter-spacing="-1">${esc(name)}</text></g>`
    : ""
}
<rect class="under" x="50" y="${nameY + 16}" width="${Math.max(40, nameW * 0.32).toFixed(0)}" height="4" rx="2" fill="url(#accentGrad)"/>
${typewriter(ctx, roles, 70, 182, 22)}
${
  o.greeting
    ? `<g class="in" style="animation-delay:2.4s">
  ${moonGlyph(t, 58, footY - 4, 9, moon.phase)}
  <text x="76" y="${footY}" font-size="13" class="m">${esc(greet)} · ${esc(formatLongDate(ctx.now))} · ${esc(moon.name.toLowerCase())}</text>
</g>`
    : ""
}
${emblem}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
