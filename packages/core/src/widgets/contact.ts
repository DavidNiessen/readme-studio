import { esc } from "../lib/escape";
import { card, cardStroke, fitSize, fitText, svg, textWidth, wrapText } from "../lib/svg";
import { hasMark, items, mark, n1, pick, statusColor, str } from "./kit-c";
import { accentDeep, onAccent } from "./parts";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;
const STATUS = {
  open: "Open to new projects",
  busy: "Booked — limited availability",
  away: "Not available right now",
} as const;

export const contact = defineWidget({
  type: "contact",
  title: "Contact card",
  description: "A “let's work together” card with your availability, a short pitch and up to three call-to-action buttons.",
  category: "Identity",
  kind: "svg",
  width: "full",
  defaults: {
    status: "open",
    statusText: "",
    headline: "Let's build something together",
    text: "I'm taking on a few freelance and open-source collaborations this season. Drop me a line and I'll usually reply within a day.",
    ctas: [
      { label: "Email me", icon: "mail" },
      { label: "Book a call", icon: "calendar" },
      { label: "LinkedIn", icon: "linkedin" },
    ],
    url: "",
    emblem: "mail",
    signal: true,
  },
  fields: [
    {
      key: "status",
      label: "Availability",
      type: "segmented",
      options: [
        { value: "open", label: "Open to work" },
        { value: "busy", label: "Busy" },
        { value: "away", label: "Not available" },
      ],
    },
    { key: "statusText", label: "Status text", type: "text", placeholder: "Defaults to the availability", max: 48 },
    { key: "headline", label: "Headline", type: "text", max: 80, help: PLACEHOLDER_HELP },
    { key: "text", label: "Text", type: "text", multiline: true, max: 300 },
    {
      key: "ctas",
      label: "Buttons",
      type: "list",
      itemLabel: "Button",
      titleKey: "label",
      max: 3,
      newItem: { label: "Say hello", icon: "mail" },
      item: [
        { key: "label", label: "Label", type: "text", max: 28 },
        { key: "icon", label: "Icon", type: "icon" },
      ],
      help: "Buttons are drawn into the image; the whole card links to the URL below.",
    },
    { key: "url", label: "Link", type: "text", placeholder: "Defaults to your first profile link", help: "mailto:, a booking page or any URL." },
    { key: "emblem", label: "Emblem", type: "icon", help: "Shown inside the signal on the right." },
    { key: "signal", label: "Signal emblem", type: "toggle" },
  ],
  alt: (ctx, o) => {
    const status = pick(o.status, ["open", "busy", "away"] as const, "open");
    const parts = [fillPlaceholders(str(o.headline), ctx), str(o.statusText) || STATUS[status]];
    return parts.filter(Boolean).join(" — ") || "Contact";
  },
  href: (ctx, o) => {
    const u = str(o.url);
    if (u) return u;
    return ctx.profile.links.find((l) => l.url)?.url || undefined;
  },
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const status = pick(o.status, ["open", "busy", "away"] as const, "open");
    const sColor = statusColor(t, status);
    const statusText = fill(str(o.statusText)) || STATUS[status];
    const headline = fill(str(o.headline)) || "Get in touch";
    const text = fill(str(o.text));
    const ctas = items(o.ctas)
      .map((c) => ({ label: fill(str(c.label)), icon: str(c.icon) }))
      .filter((c) => c.label || hasMark(c.icon))
      .slice(0, 3);
    const signal = o.signal !== false;
    const emblemId = hasMark(str(o.emblem)) ? str(o.emblem) : "mail";

    const x = 32;
    const RINGS = [40, 62, 84, 106];
    const sx = W - 140;
    const contentW = signal ? sx - RINGS[3] - 36 - x : W - x * 2;

    // status pill
    const sOpts = { bold: true, letterSpacing: 1.2 };
    const sText = fitText(t, statusText.toUpperCase(), 10.5, contentW - 40, sOpts);
    const sW = textWidth(t, sText, 10.5, sOpts) + 38;
    const sy = 30;
    const pill = `<g class="in">
<rect x="${x}" y="${sy}" width="${n1(sW)}" height="26" rx="13" fill="${sColor}" fill-opacity="${t.name === "dark" ? 0.12 : 0.08}" stroke="${sColor}" stroke-opacity=".45"/>
<circle cx="${x + 15}" cy="${sy + 13}" r="4" fill="${sColor}"/>
${status !== "away" ? `<circle class="ping loop loop-only" cx="${x + 15}" cy="${sy + 13}" r="4" fill="${sColor}"/>` : ""}
<text x="${x + 27}" y="${sy + 17}" font-size="10.5" letter-spacing="1.2" class="b" fill="${t.name === "dark" ? sColor : t.text}">${esc(sText)}</text></g>`;

    // headline (≤2 lines) and text (≤3 lines)
    const hOpts = { bold: true, heading: true, letterSpacing: -0.6 };
    let hSize = fitSize(t, headline, 32, contentW, 26, hOpts);
    let hLines = [headline];
    if (textWidth(t, headline, hSize, hOpts) > contentW) {
      hSize = 28;
      hLines = wrapText(t, headline, hSize, contentW, 2, hOpts);
    }
    const hLh = hSize * 1.18;
    const hy = sy + 26 + 26 + hSize * 0.78;
    const head = hLines.map((l, i) => `<text x="${x}" y="${n1(hy + i * hLh)}" font-size="${hSize}" letter-spacing="-0.6" class="t b h in" style="animation-delay:${(0.12 + i * 0.08).toFixed(2)}s">${esc(l)}</text>`).join("");
    let y = hy + (hLines.length - 1) * hLh;
    const tLines = text ? wrapText(t, text, 14.5, Math.min(contentW, 560), 3) : [];
    const textMarkup = tLines
      .map((l, i) => {
        y += i === 0 ? 30 : 23;
        return `<text x="${x}" y="${n1(y)}" font-size="14.5" class="m in" style="animation-delay:${(0.28 + i * 0.06).toFixed(2)}s">${esc(l)}</text>`;
      })
      .join("");

    // call-to-action pills
    const by = y + 26;
    const BH = 40;
    let bx = x;
    const btns: string[] = [];
    ctas.forEach((c, i) => {
      const primary = i === 0;
      const ic = hasMark(c.icon);
      const lab = fitText(t, c.label, 13.5, 200, { bold: true });
      const w = 18 + (ic ? 16 + (lab ? 9 : 0) : 0) + textWidth(t, lab, 13.5, { bold: true }) + (primary ? 34 : 18);
      if (bx + w > x + contentW + (signal ? 24 : 0)) return;
      const ink = primary ? onAccent(t) : t.text;
      const tx = bx + 18 + (ic ? 25 : 0);
      btns.push(`<g class="in" style="animation-delay:${(0.45 + i * 0.1).toFixed(2)}s">
${primary ? `<rect x="${n1(bx)}" y="${n1(by)}" width="${n1(w)}" height="${BH}" rx="${BH / 2}" fill="url(#ctaG)"/><clipPath id="ctaC"><rect x="${n1(bx)}" y="${n1(by)}" width="${n1(w)}" height="${BH}" rx="${BH / 2}"/></clipPath><g clip-path="url(#ctaC)"><rect class="sh loop loop-only" x="${n1(bx - 70)}" y="${n1(by)}" width="70" height="${BH}" fill="url(#shine)"/></g>` : `<rect x="${n1(bx + 0.5)}" y="${n1(by + 0.5)}" width="${n1(w - 1)}" height="${BH - 1}" rx="${(BH - 1) / 2}" fill="${t.raised}" stroke="${t.border}"/>`}
${ic ? mark(t, c.icon, bx + 18, by + 12, 16, primary ? ink : t.accent, primary ? t.accent : t.raised) : ""}
${lab ? `<text x="${n1(tx)}" y="${n1(by + 24.5)}" font-size="13.5" class="b" fill="${ink}">${esc(lab)}</text>` : ""}
${primary ? `<g class="nudge loop"><path d="M${n1(bx + w - 26)} ${by + 20}h9m-3.5-4 4 4-4 4" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>` : ""}
</g>`);
      bx += w + 10;
    });
    const bottom = btns.length ? by + BH : y + 6;
    const H = Math.round(Math.max(signal ? 260 : 0, bottom + 32));

    // signal emblem on the right
    let sig = "";
    const syc = H / 2;
    if (signal) {
      const rings = RINGS.map((r, i) => `<circle cx="${sx}" cy="${n1(syc)}" r="${r}" stroke="${t.subtle}" stroke-opacity="${(0.9 - i * 0.18).toFixed(2)}" ${i % 2 ? `stroke-dasharray="2 6"` : ""}/>`).join("");
      const waves = [0, 1, 2].map((i) => `<circle class="wave loop loop-only" style="animation-delay:${(i * 1.2).toFixed(1)}s" cx="${sx}" cy="${n1(syc)}" r="40" stroke="${t.accent}" stroke-width="1.5" opacity="0"/>`).join("");
      const orbit = `<g class="orb loop loop-only"><circle cx="${sx}" cy="${n1(syc - RINGS[2])}" r="3.5" fill="${t.glow}" filter="url(#glow)"/></g><g class="orb2 loop loop-only"><circle cx="${sx + RINGS[1]}" cy="${n1(syc)}" r="2.5" fill="${t.accent2}"/></g>`;
      sig = `<g clip-path="url(#ctClip)"><g class="fade" style="animation-delay:.3s">${rings}${waves}${orbit}</g></g>
<g class="fx" style="animation:pop .7s ease .35s both">
<circle cx="${sx}" cy="${n1(syc)}" r="34" fill="url(#ctaG)"/>
<circle cx="${sx}" cy="${n1(syc)}" r="34" fill="${t.accent}" filter="url(#softglow)" opacity=".45" class="breathe loop"/>
<circle cx="${sx}" cy="${n1(syc)}" r="33.5" stroke="#fff" stroke-opacity="${t.name === "dark" ? 0.2 : 0.35}"/>
${mark(t, emblemId, sx - 14, syc - 14, 28, onAccent(t), t.accent)}
</g>`;
    }

    const css = `
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2s cubic-bezier(0,0,.2,1) infinite}
@keyframes ping{0%{transform:scale(1);opacity:.8}75%,100%{transform:scale(2.6);opacity:0}}
.wave{transform-box:fill-box;transform-origin:center;animation:wave 3.6s cubic-bezier(.2,.6,.4,1) infinite}
@keyframes wave{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.8);opacity:0}}
.orb{transform-origin:${sx}px ${n1(syc)}px;animation:spin 14s linear infinite}
.orb2{transform-origin:${sx}px ${n1(syc)}px;animation:spinR 9s linear infinite}
.breathe{animation:pulse 3s ease-in-out infinite}
.sh{animation:ctSh 4.5s ease-in-out 1.5s infinite}
@keyframes ctSh{0%{transform:translateX(0)}50%,100%{transform:translateX(320px)}}
.nudge{animation:nudge 1.8s ease-in-out infinite}
@keyframes nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}`;
    const defs = `<linearGradient id="ctaG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset=".6" stop-color="${t.accent}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<clipPath id="ctClip"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${t.radius}"/></clipPath>`;
    const body = `${card(t, { width: W, height: H })}
${sig}
${cardStroke(t, W, H)}
${pill}
${head}
${textMarkup}
${btns.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
