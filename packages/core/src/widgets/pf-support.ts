import { esc } from "../lib/escape";
import { card, fitSize, fitText, label, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { hasMark, items, mark, n1, pick, str } from "./kit-c";
import { balancedWrap, pkgNames, xglyph } from "./kit-f";
import { accentDeep, onAccent } from "./parts";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget, type Ctx } from "./types";

const W = 840;

type Kind = "sponsors" | "kofi" | "bmc" | "opencollective" | "patreon" | "paypal" | "custom";
const KINDS: { value: Kind; label: string }[] = [
  { value: "sponsors", label: "GitHub Sponsors" },
  { value: "kofi", label: "Ko-fi" },
  { value: "bmc", label: "Buy Me a Coffee" },
  { value: "opencollective", label: "Open Collective" },
  { value: "patreon", label: "Patreon" },
  { value: "paypal", label: "PayPal" },
  { value: "custom", label: "Custom" },
];

const KIND_LABEL: Record<Kind, string> = {
  sponsors: "Sponsor",
  kofi: "Ko-fi",
  bmc: "Buy me a coffee",
  opencollective: "Open Collective",
  patreon: "Patreon",
  paypal: "PayPal",
  custom: "Support",
};

const HEART = "M12 21.2s-7.6-4.6-9.7-9.3C.8 8.5 2.8 4.5 6.6 4.2c2.2-.2 4 1 5.4 3 1.4-2 3.2-3.2 5.4-3 3.8.3 5.8 4.3 4.3 7.7-2.1 4.7-9.7 9.3-9.7 9.3z";

type Meta = Pick<Ctx, "profile" | "data" | "project" | "kind">;

function owner(ctx: Meta): string {
  if (ctx.kind === "project") {
    const o = (ctx.project?.repo || "").split("/")[0];
    if (o) return o;
  }
  return ctx.profile.login;
}

function defaultUrl(ctx: Meta, k: Kind): string {
  const who = owner(ctx);
  const proj = pkgNames(ctx).bin;
  switch (k) {
    case "sponsors":
      return `https://github.com/sponsors/${who}`;
    case "kofi":
      return `https://ko-fi.com/${who}`;
    case "bmc":
      return `https://buymeacoffee.com/${who}`;
    case "opencollective":
      return `https://opencollective.com/${ctx.kind === "project" ? proj : who}`;
    case "patreon":
      return `https://www.patreon.com/${who}`;
    case "paypal":
      return `https://paypal.me/${who}`;
    case "custom":
      return "";
  }
}

interface Btn {
  kind: Kind;
  label: string;
  url: string;
  icon: string;
}

function fill(ctx: Meta, s: string): string {
  return fillPlaceholders(s.replace(/\{owner\}/gi, owner(ctx)), ctx);
}

function buttons(ctx: Meta, o: Record<string, unknown>): Btn[] {
  return items(o.buttons)
    .map((b) => {
      const kind = pick(b.kind, KINDS.map((k) => k.value), "custom");
      return { kind, label: fill(ctx, str(b.label)) || KIND_LABEL[kind], url: fill(ctx, str(b.url)) || defaultUrl(ctx, kind), icon: str(b.icon) };
    })
    .slice(0, 3);
}

/** Icon for a button kind; `color` "brand" keeps brand colours. */
function btnIcon(t: Theme, b: Btn, x: number, y: number, size: number, color: string, bg: string): string {
  switch (b.kind) {
    case "sponsors": {
      const c = color === "brand" ? (t.name === "dark" ? "#db61a2" : "#bf3989") : color;
      return `<svg x="${n1(x)}" y="${n1(y)}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${HEART}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
    }
    case "kofi":
      return mark(t, "kofi", x, y, size, color, bg);
    case "bmc":
      return mark(t, "buymeacoffee", x, y, size, color, bg);
    case "patreon":
      return mark(t, "patreon", x, y, size, color, bg);
    case "paypal":
      return mark(t, "paypal", x, y, size, color, bg);
    case "opencollective":
      return xglyph("collective", x, y, size, color === "brand" ? (t.name === "dark" ? "#7fadf2" : "#1f6feb") : color);
    case "custom":
      return hasMark(b.icon) ? mark(t, b.icon, x, y, size, color === "brand" ? t.accent : color, bg) : "";
  }
}

export const pfSupport = defineWidget({
  type: "support",
  title: "Support & sponsor",
  description: "A warm call to action for sponsors: headline, a short pitch, up to three drawn buttons (GitHub Sponsors, Ko-fi, Open Collective, …) and a beating heart.",
  scope: "any",
  category: "Identity",
  kind: "svg",
  width: "full",
  defaults: {
    label: "support",
    headline: "",
    text: "",
    buttons: [
      { kind: "sponsors", label: "Sponsor", url: "" },
      { kind: "opencollective", label: "Open Collective", url: "" },
      { kind: "kofi", label: "Buy a coffee", url: "" },
    ],
    backers: "Thank you to everyone who already chips in.",
    emblem: true,
  },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "support" },
    { key: "headline", label: "Headline", type: "text", max: 80, placeholder: "Automatic", help: PLACEHOLDER_HELP },
    { key: "text", label: "Text", type: "text", multiline: true, max: 300, placeholder: "Automatic" },
    {
      key: "buttons",
      label: "Buttons",
      type: "list",
      itemLabel: "Button",
      titleKey: "label",
      max: 3,
      newItem: { kind: "custom", label: "Support", url: "", icon: "heart" },
      help: "Drawn into the image; the card links to the first button's URL. URLs default to your account on each platform ({owner} is the repository owner).",
      item: [
        { key: "kind", label: "Platform", type: "select", options: KINDS },
        { key: "label", label: "Label", type: "text", max: 28 },
        { key: "url", label: "URL", type: "text", placeholder: "Automatic" },
        { key: "icon", label: "Icon", type: "icon", when: { key: "kind", is: ["custom"] } },
      ],
    },
    { key: "backers", label: "Backers line", type: "text", max: 90, placeholder: "Backed by 120+ sponsors", help: "A short line under the buttons, e.g. how many people back the work." },
    { key: "emblem", label: "Heart emblem", type: "toggle" },
  ],
  alt: (ctx, o) => {
    const h = fill(ctx, str(o.headline)) || autoHeadline(ctx);
    const b = buttons(ctx, o).map((x) => x.label);
    return b.length ? `${h} — ${b.join(", ")}` : h;
  },
  href: (ctx, o) => buttons(ctx, o).find((b) => b.url)?.url || undefined,
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = fill(ctx, str(o.label));
    const headline = fill(ctx, str(o.headline)) || autoHeadline(ctx);
    const text = fill(ctx, str(o.text)) || autoText(ctx);
    const btns = buttons(ctx, o);
    const backers = fill(ctx, str(o.backers));
    const emblem = o.emblem !== false;

    const x = 32;
    const sx = W - 138;
    const contentW = emblem ? sx - 136 - x : W - x * 2;
    const top = lbl ? 62 : 34;

    // headline (≤2 lines)
    const hOpts = { bold: true, heading: true, letterSpacing: -0.6 };
    let hSize = fitSize(t, headline, 30, contentW, 24, hOpts);
    let hLines = [headline];
    if (textWidth(t, headline, hSize, hOpts) > contentW) {
      hSize = 26;
      hLines = balancedWrap(t, headline, hSize, contentW, 2, hOpts);
    }
    const hLh = hSize * 1.18;
    const hy = top + hSize * 0.78;
    const head = hLines.map((l, i) => `<text x="${x}" y="${n1(hy + i * hLh)}" font-size="${hSize}" letter-spacing="-0.6" class="t b h in" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s">${esc(l)}</text>`).join("");
    let y = hy + (hLines.length - 1) * hLh;
    const tLines = text ? balancedWrap(t, text, 14.5, Math.min(contentW, 560), 3) : [];
    const textMarkup = tLines
      .map((l, i) => {
        y += i === 0 ? 30 : 23;
        return `<text x="${x}" y="${n1(y)}" font-size="14.5" class="m in" style="animation-delay:${(0.25 + i * 0.06).toFixed(2)}s">${esc(l)}</text>`;
      })
      .join("");

    // buttons
    const by = y + 26;
    const BH = 40;
    let bx = x;
    const out: string[] = [];
    btns.forEach((b, i) => {
      const primary = i === 0;
      const lab = fitText(t, b.label, 13.5, 200, { bold: true });
      const hasIc = b.kind !== "custom" || hasMark(b.icon);
      const w = 18 + (hasIc ? 16 + (lab ? 9 : 0) : 0) + textWidth(t, lab, 13.5, { bold: true }) + 18;
      if (bx + w > x + contentW + (emblem ? 60 : 0)) return;
      const ink = primary ? onAccent(t) : t.text;
      const bg = primary ? t.accent : t.raised;
      const icon = hasIc ? btnIcon(t, b, bx + 18, by + 12, 16, primary ? ink : "brand", bg) : "";
      out.push(`<g class="in" style="animation-delay:${(0.42 + i * 0.1).toFixed(2)}s">
${primary ? `<rect x="${n1(bx)}" y="${n1(by)}" width="${n1(w)}" height="${BH}" rx="${BH / 2}" fill="url(#spG)"/><clipPath id="spC"><rect x="${n1(bx)}" y="${n1(by)}" width="${n1(w)}" height="${BH}" rx="${BH / 2}"/></clipPath><g clip-path="url(#spC)"><rect class="sh loop loop-only" x="${n1(bx - 70)}" y="${n1(by)}" width="70" height="${BH}" fill="url(#shine)"/></g>` : `<rect x="${n1(bx + 0.5)}" y="${n1(by + 0.5)}" width="${n1(w - 1)}" height="${BH - 1}" rx="${(BH - 1) / 2}" fill="${t.raised}" stroke="${t.border}"/>`}
${icon}
${lab ? `<text x="${n1(bx + 18 + (hasIc ? 25 : 0))}" y="${n1(by + 24.5)}" font-size="13.5" class="b" fill="${ink}">${esc(lab)}</text>` : ""}
</g>`);
      bx += w + 10;
    });
    let bottom = out.length ? by + BH : y + 6;

    // backers line with a little stack of supporter dots
    let backersMarkup = "";
    if (backers) {
      const ly = bottom + 30;
      const dots = [t.accent, t.accent2, t.glow, t.subtle]
        .map((c, i) => `<circle cx="${x + 9 + i * 13}" cy="${ly - 4.5}" r="9" fill="${c}" stroke="${t.card}" stroke-width="2"/>`)
        .join("");
      const hx = x + 9 + 3 * 13 - 6;
      const heart = `<svg x="${hx}" y="${ly - 10.5}" width="12" height="12" viewBox="0 0 24 24"><path d="${HEART}" fill="${t.card}"/></svg>`;
      const tx = x + 9 + 3 * 13 + 20;
      backersMarkup = `<g class="in" style="animation-delay:.7s">${dots}${heart}<text x="${tx}" y="${ly}" font-size="12.5" class="m">${esc(fitText(t, backers, 12.5, contentW + (emblem ? 60 : 0) - (tx - x)))}</text></g>`;
      bottom = ly + 6;
    }
    const H = Math.round(Math.max(emblem ? 270 : 0, bottom + 34));
    // centre short content against the emblem's minimum height
    const dy = Math.max(0, (H - (bottom + 34)) / 2);

    // heart emblem with an ECG trace
    let emb = "";
    if (emblem) {
      const cy = H / 2 + (lbl ? 8 : 0);
      const R = 38;
      const ex0 = sx - 132;
      const ex1 = W - 1;
      const spike = (c: number) => `H${c - 22}l5 -5 5 5H${c - 6}l4 10 6 -34 6 30 4 -6H${c + 22}l5 -6 6 6`;
      const ecg = `M${ex0} ${cy}${spike(sx - 78)}H${sx + 60}${spike(sx + 90)}H${ex1}`;
      const rings = [62, 86, 110].map((r, i) => `<circle cx="${sx}" cy="${n1(cy)}" r="${r}" stroke="${t.subtle}" stroke-opacity="${(0.8 - i * 0.22).toFixed(2)}"${i % 2 ? ' stroke-dasharray="2 6"' : ""}/>`).join("");
      const waves = [0, 1].map((i) => `<circle class="wave loop loop-only" style="animation-delay:${(0.3 + i * 0.25).toFixed(2)}s" cx="${sx}" cy="${n1(cy)}" r="${R}" stroke="${t.accent}" stroke-width="1.5" opacity="0"/>`).join("");
      const floaters = [
        [-46, -20, 9, 0],
        [40, -30, 7, 1.6],
        [-20, -44, 6, 3.1],
      ]
        .map(([dx, dy, s, d]) => `<g class="float loop-only loop" style="animation-delay:${d}s"><svg x="${n1(sx + dx - s / 2)}" y="${n1(cy + dy - s / 2)}" width="${s}" height="${s}" viewBox="0 0 24 24"><path d="${HEART}" fill="${t.glow}"/></svg></g>`)
        .join("");
      emb = `<g clip-path="url(#spClip)"><g class="fade" style="animation-delay:.3s">${rings}
<g mask="url(#ecgM)"><path d="${ecg}" stroke="${t.subtle}" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
<path d="${ecg}" stroke="${t.accent}" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round" pathLength="100" stroke-dasharray="16 100" class="ecg loop loop-only" filter="url(#glow)"/></g>
${waves}${floaters}</g></g>
<g class="fx" style="animation:pop .7s ease .35s both"><g class="fx beat loop">
<circle cx="${sx}" cy="${n1(cy)}" r="${R}" fill="url(#spG)"/>
<circle cx="${sx}" cy="${n1(cy)}" r="${R}" fill="${t.accent}" filter="url(#softglow)" opacity=".4"/>
<circle cx="${sx}" cy="${n1(cy)}" r="${R - 0.5}" stroke="#fff" stroke-opacity="${t.name === "dark" ? 0.2 : 0.35}"/>
<svg x="${sx - 16}" y="${n1(cy - 15)}" width="32" height="32" viewBox="0 0 24 24"><path d="${HEART}" fill="${onAccent(t)}"/></svg>
</g></g>`;
    }

    const css = `
.sh{animation:shimmer 3.6s ease-in-out 2s infinite}
.beat{animation:beat 1.6s ease-in-out 1.2s infinite}
@keyframes beat{0%,100%{transform:scale(1)}12%{transform:scale(1.12)}24%{transform:scale(1)}36%{transform:scale(1.07)}52%{transform:scale(1)}}
.wave{transform-box:fill-box;transform-origin:center;animation:spWave 1.6s cubic-bezier(.2,.6,.4,1) 1.2s infinite}
@keyframes spWave{0%{transform:scale(1);opacity:.6}70%,100%{transform:scale(2.3);opacity:0}}
.ecg{animation:ecg 3.2s linear infinite}
@keyframes ecg{from{stroke-dashoffset:116}to{stroke-dashoffset:0}}
.float{opacity:0;animation:float 4.8s ease-out infinite}
@keyframes float{0%{opacity:0;transform:translateY(8px)}20%{opacity:.9}100%{opacity:0;transform:translateY(-34px)}}`;
    const defs = `<linearGradient id="spG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<linearGradient id="ecgF" gradientUnits="userSpaceOnUse" x1="${sx - 132}" y1="0" x2="${sx - 62}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
<mask id="ecgM" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#ecgF)"/></mask>
<clipPath id="spClip"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${t.radius}"/></clipPath>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, x, 34, lbl) : ""}
${emb}
<g transform="translate(0 ${n1(dy)})">${head}
${textMarkup}
${out.join("\n")}
${backersMarkup}</g>`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});

function autoHeadline(ctx: Meta): string {
  return ctx.kind === "project" ? `Support ${pkgNames(ctx).name}` : "Support my open-source work";
}

function autoText(ctx: Meta): string {
  return ctx.kind === "project"
    ? `${pkgNames(ctx).name} is free, open source and maintained in spare evenings. Sponsorship pays for CI, docs and the time to keep it healthy.`
    : "Everything I publish is free and open source. Sponsorship keeps it maintained, documented and fun to work on.";
}
