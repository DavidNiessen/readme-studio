import { esc } from "../lib/escape";
import { card, cardStroke, fitSize, fitText, label, svg, textWidth, wrapText } from "../lib/svg";
import type { Theme } from "../theme";
import { initials, n1, pick, str, strings } from "./kit-c";
import { accentDeep, glyph, onAccent, type GlyphName } from "./parts";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget, type Ctx } from "./types";

const W = 840;

interface Chip {
  glyph: GlyphName;
  text: string;
}

function chipWidth(t: Theme, c: Chip): number {
  return 10 + 14 + 7 + textWidth(t, c.text, 12) + 12;
}

function chipMarkup(t: Theme, c: Chip, x: number, y: number, d: number): string {
  const w = chipWidth(t, c);
  return `<g class="in" style="animation-delay:${d.toFixed(2)}s">
<rect x="${n1(x)}" y="${y}" width="${n1(w)}" height="28" rx="14" fill="${t.raised}" stroke="${t.border}"/>
${glyph(c.glyph, x + 10, y + 7, 14, t.accent)}
<text x="${n1(x + 31)}" y="${y + 18.5}" font-size="12" class="t">${esc(c.text)}</text></g>`;
}

/** Bio paragraphs wrapped by measured width; blank lines become paragraph gaps. */
function bioLines(t: Theme, bio: string, size: number, maxW: number, maxLines: number): (string | null)[] {
  const out: (string | null)[] = [];
  const paras = bio.split(/\n\s*\n|\r?\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paras) {
    const left = maxLines - out.filter((l) => l !== null).length;
    if (left <= 0) break;
    if (out.length) out.push(null);
    out.push(...wrapText(t, p, size, maxW, left));
  }
  return out;
}

export const about = defineWidget({
  type: "about",
  title: "About card",
  description: "A typographic introduction: monogram, name and pronouns, your roles, a short bio and chips for where you work and live.",
  scope: "profile",
  category: "Identity",
  kind: "svg",
  width: "full",
  defaults: {
    label: "about me",
    name: "",
    pronouns: "",
    roles: [],
    bio: "",
    layout: "left",
    monogram: true,
    chips: true,
    extraChips: ["Open to collaborations"],
  },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "about me" },
    { key: "name", label: "Name", type: "text", placeholder: "Defaults to your profile name" },
    { key: "pronouns", label: "Pronouns", type: "text", placeholder: "Defaults to your profile pronouns", max: 24 },
    { key: "roles", label: "Roles", type: "tags", placeholder: "Defaults to your profile roles", max: 4 },
    { key: "bio", label: "Bio", type: "text", multiline: true, placeholder: "Defaults to your profile bio", help: `Up to five lines; a blank line starts a new paragraph. ${PLACEHOLDER_HELP}` },
    {
      key: "layout",
      label: "Layout",
      type: "segmented",
      options: [
        { value: "left", label: "Left-aligned" },
        { value: "center", label: "Centered" },
      ],
    },
    { key: "monogram", label: "Monogram", type: "toggle", help: "Your initials in an accent disc." },
    { key: "chips", label: "Company & location chips", type: "toggle" },
    { key: "extraChips", label: "Extra chips", type: "tags", placeholder: "Open to collaborations", max: 3, when: { key: "chips", is: [true] } },
  ],
  alt: (ctx, o) => {
    const name = fillPlaceholders(str(o.name), ctx) || ctx.profile.name || ctx.profile.login;
    const bio = fillPlaceholders(str(o.bio), ctx) || ctx.profile.bio;
    return [`About ${name || "me"}`, bio].filter(Boolean).join(": ");
  },
  render(ctx: Ctx, o) {
    const t = ctx.theme;
    const p = ctx.profile;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const centered = pick(o.layout, ["left", "center"] as const, "left") === "center";
    const name = fill(str(o.name)) || p.name || p.login || "Hello, world";
    const pronouns = fill(str(o.pronouns)) || p.pronouns || "";
    const optRoles = strings(o.roles).map(fill).filter(Boolean);
    const roles = optRoles.length ? optRoles : (p.roles ?? []).filter(Boolean);
    const bio = fill(str(o.bio)) || p.bio || "";
    const chips: Chip[] = [];
    if (o.chips !== false) {
      if (p.company) chips.push({ glyph: "briefcase", text: p.company });
      if (p.location?.city) chips.push({ glyph: "pin", text: p.location.city });
      for (const c of strings(o.extraChips).slice(0, 3)) chips.push({ glyph: "sparkle", text: fill(c) });
    }
    const monogram = o.monogram !== false;
    const lbl = str(o.label);
    const top = lbl ? 56 : 30;

    // geometry
    const M = centered ? 76 : 92;
    const tx = centered ? W / 2 : monogram ? 24 + M + 28 : 24;
    const maxW = centered ? 680 : W - tx - 32;
    const nameTop = centered ? top + (monogram ? M + 22 : 0) : top;
    const nameOpts = { bold: true, heading: true, letterSpacing: -0.5 };
    const pronW = pronouns ? textWidth(t, pronouns, 11) + 20 : 0;
    const nameSize = fitSize(t, name, 32, maxW - (pronW ? pronW + 12 : 0), 20, nameOpts);
    const nameText = fitText(t, name, nameSize, maxW - (pronW ? pronW + 12 : 0), nameOpts);
    const nameW = textWidth(t, nameText, nameSize, nameOpts);
    const nameY = nameTop + Math.round(nameSize * 0.82);

    // roles: drop from the end until they fit, then ellipsise
    const sep = "  /  ";
    let shown = roles.slice(0, 4);
    while (shown.length > 1 && textWidth(t, shown.join(sep), 14) > maxW) shown = shown.slice(0, -1);
    const rolesY = nameY + 28;
    let rolesMarkup = "";
    if (shown.length) {
      const full = fitText(t, shown.join(sep), 14, maxW);
      const first = fitText(t, shown[0], 14, maxW, { bold: true });
      if (shown.length === 1 || full !== shown.join(sep)) {
        rolesMarkup = `<text x="${n1(tx)}" y="${rolesY}" font-size="14" text-anchor="${centered ? "middle" : "start"}" class="a b">${esc(shown.length === 1 ? first : full)}</text>`;
      } else {
        const spans = shown.map((r, i) => `${i ? `<tspan class="s">${esc(sep)}</tspan>` : ""}<tspan class="${i ? "m" : "a b"}">${esc(r)}</tspan>`).join("");
        rolesMarkup = `<text x="${n1(tx)}" y="${rolesY}" font-size="14" text-anchor="${centered ? "middle" : "start"}" xml:space="preserve">${spans}</text>`;
      }
    }

    const bioSize = 14.5;
    const lh = 23;
    const bioTop = (shown.length ? rolesY : nameY) + 32;
    const lines = bio ? bioLines(t, bio, bioSize, centered ? Math.min(maxW, 620) : maxW, 5) : [];
    let y = bioTop;
    const bioMarkup: string[] = [];
    let li = 0;
    for (const l of lines) {
      if (l === null) {
        y += 10;
        continue;
      }
      bioMarkup.push(`<text x="${n1(tx)}" y="${y}" font-size="${bioSize}" text-anchor="${centered ? "middle" : "start"}" class="t" opacity=".86">${esc(l)}</text>`);
      y += lh;
      li++;
    }
    if (!lines.length && !shown.length) {
      bioMarkup.push(`<text x="${n1(tx)}" y="${y}" font-size="13" text-anchor="${centered ? "middle" : "start"}" class="m">Add a short bio and your roles to introduce yourself.</text>`);
      y += lh;
      li = 1;
    }
    let contentBottom = li ? y - lh + 6 : (shown.length ? rolesY : nameY) + 6;

    // chips (single row, drop what doesn't fit)
    let chipsMarkup = "";
    if (chips.length) {
      const fitChips: Chip[] = [];
      let total = 0;
      for (const c of chips) {
        const text = fitText(t, c.text, 12, 220);
        const cc = { ...c, text };
        const w = chipWidth(t, cc) + (fitChips.length ? 8 : 0);
        if (total + w > maxW) break;
        fitChips.push(cc);
        total += w;
      }
      const cy = contentBottom + 18;
      let cx = centered ? W / 2 - total / 2 : tx;
      chipsMarkup = fitChips
        .map((c, i) => {
          const m = chipMarkup(t, c, cx, cy, 0.55 + i * 0.08);
          cx += chipWidth(t, c) + 8;
          return m;
        })
        .join("");
      if (fitChips.length) contentBottom = cy + 28;
    }

    const H = Math.max(centered ? 0 : top + (monogram ? M : 0) + 30, contentBottom + 30);

    // monogram
    let mono = "";
    const mx = centered ? W / 2 : 24 + M / 2;
    const my = top + M / 2;
    if (monogram) {
      const ini = initials(name) || "?";
      const iniSize = fitSize(t, ini, M * 0.36, M * 0.56, 12, { bold: true, heading: true });
      const r = M / 2;
      mono = `<g class="fx" style="animation:pop .7s ${0.05}s both">
<circle cx="${mx}" cy="${my}" r="${r}" fill="url(#monoG)"/>
<circle cx="${mx}" cy="${my}" r="${r - 0.5}" stroke="#fff" stroke-opacity="${t.name === "dark" ? 0.18 : 0.35}"/>
<text x="${mx}" y="${n1(my + iniSize * 0.36)}" font-size="${n1(iniSize)}" text-anchor="middle" letter-spacing="1" class="b h" fill="${onAccent(t)}">${esc(ini)}</text>
</g>
<circle class="orbit loop" cx="${mx}" cy="${my}" r="${r + 7}" stroke="${t.accent}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="3 7" fill="none"/>
<g class="orbit2 loop loop-only"><circle cx="${mx}" cy="${n1(my - r - 7)}" r="2.6" fill="${t.glow}" filter="url(#glow)"/></g>`;
    }

    const groupW = nameW + (pronouns ? 12 + pronW : 0);
    const nameX = centered ? W / 2 - groupW / 2 : tx;
    const pronX = nameX + nameW + 12;
    const pronMid = nameY - nameSize * 0.36;
    const pron = pronouns
      ? `<g class="in" style="animation-delay:.2s"><rect x="${n1(pronX)}" y="${n1(pronMid - 10)}" width="${n1(pronW)}" height="20" rx="10" stroke="${t.subtle}"/>
<text x="${n1(pronX + pronW / 2)}" y="${n1(pronMid + 4)}" font-size="11" text-anchor="middle" class="m">${esc(pronouns)}</text></g>`
      : "";

    const css = `
.orbit{transform-origin:${mx}px ${my}px;animation:spin 24s linear infinite}
.orbit2{transform-origin:${mx}px ${my}px;animation:spin 9s linear infinite}
.blob{animation:blob 16s ease-in-out infinite alternate}
@keyframes blob{from{transform:translate(0,0)}to{transform:translate(-90px,30px)}}`;
    const defs = `<linearGradient id="monoG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset=".55" stop-color="${t.accent}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<radialGradient id="aboutBlob"><stop offset="0" stop-color="${t.accent}" stop-opacity="${t.name === "dark" ? 0.16 : 0.08}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<clipPath id="aboutClip"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${t.radius}"/></clipPath>`;

    const body = `${card(t, { width: W, height: H })}
<g clip-path="url(#aboutClip)"><g class="blob loop"><circle cx="${W - 120}" cy="${40}" r="220" fill="url(#aboutBlob)"/></g></g>
${cardStroke(t, W, H)}
${lbl ? label(t, 24, 30, fill(lbl)) : ""}
${mono}
<text x="${n1(nameX)}" y="${nameY}" font-size="${n1(nameSize)}" letter-spacing="-0.5" class="t b h in" style="animation-delay:.12s">${esc(nameText)}</text>
${pron}
${rolesMarkup ? `<g class="in" style="animation-delay:.25s">${rolesMarkup}</g>` : ""}
${bioMarkup.map((m, i) => `<g class="in" style="animation-delay:${(0.35 + i * 0.06).toFixed(2)}s">${m}</g>`).join("")}
${chipsMarkup}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
