import { esc } from "../lib/escape";
import { card, fitText, label, svg, textWidth, wrapText } from "../lib/svg";
import type { Theme } from "../theme";
import { items, n1, numOpt, pick, str } from "./kit-c";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;

/** A filled typographic opening quote mark (“) drawn as paths, independent of the font. */
function quoteMarks(color: string, x: number, y: number, s: number, cls = ""): string {
  // one "6"-shaped mark: a ball with a tail rising to the upper right
  const one = (ox: number) =>
    `<circle cx="${n1(ox + 9 * s)}" cy="${n1(y + 24 * s)}" r="${n1(9 * s)}" fill="${color}"/><path d="M${n1(ox + 0.6 * s)} ${n1(y + 24 * s)}C${n1(ox + 0.6 * s)} ${n1(y + 11 * s)} ${n1(ox + 7 * s)} ${n1(y + 3 * s)} ${n1(ox + 17 * s)} ${n1(y + 0.5 * s)}" stroke="${color}" stroke-width="${n1(5.2 * s)}" stroke-linecap="round" fill="none"/>`;
  return `<g class="${cls}">${one(x)}${one(x + 25 * s)}</g>`;
}

interface Q {
  lines: string[];
  author: string;
  source: string;
}

function layoutQuotes(t: Theme, raw: { text: string; author: string; source: string }[], maxW: number): { size: number; quotes: Q[] } {
  const opts = { heading: true };
  for (const size of [28, 26, 24, 22, 20, 18]) {
    const qs = raw.map((q) => ({ ...q, lines: wrapText(t, q.text, size, maxW, 99, opts) }));
    if (qs.every((q) => q.lines.length <= 3)) return { size, quotes: qs };
  }
  return { size: 18, quotes: raw.map((q) => ({ ...q, lines: wrapText(t, q.text, 18, maxW, 4, opts) })) };
}

export const quote = defineWidget({
  type: "quote",
  title: "Quote",
  description: "A large typographic quote with attribution; add several and it cross-fades through them on a loop.",
  category: "Content",
  kind: "svg",
  width: "full",
  defaults: {
    label: "words to build by",
    marks: "serif",
    rotate: true,
    seconds: 7,
    progress: true,
    quotes: [
      { text: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra", source: "" },
      { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson", source: "SICP" },
      { text: "Make it work, make it right, make it fast.", author: "Kent Beck", source: "" },
    ],
  },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "Leave empty to hide" },
    {
      key: "marks",
      label: "Quote mark",
      type: "segmented",
      options: [
        { value: "serif", label: "Marks" },
        { value: "bar", label: "Accent bar" },
        { value: "none", label: "None" },
      ],
    },
    { key: "rotate", label: "Rotate through quotes", type: "toggle", help: "Cross-fades through every quote in the list; off shows only the first." },
    { key: "seconds", label: "Time per quote", type: "number", min: 3, max: 20, step: 1, unit: "s", when: { key: "rotate", is: [true] } },
    { key: "progress", label: "Progress ticks", type: "toggle", when: { key: "rotate", is: [true] } },
    {
      key: "quotes",
      label: "Quotes",
      type: "list",
      itemLabel: "Quote",
      titleKey: "author",
      max: 8,
      newItem: { text: "", author: "", source: "" },
      item: [
        { key: "text", label: "Quote", type: "text", multiline: true, max: 240, help: PLACEHOLDER_HELP },
        { key: "author", label: "Author", type: "text" },
        { key: "source", label: "Source", type: "text", placeholder: "Book, talk or year (optional)" },
      ],
    },
  ],
  alt: (ctx, o) => {
    const q = items(o.quotes).find((x) => str(x.text));
    if (!q) return "Quote";
    const a = str(q.author);
    return `“${fillPlaceholders(str(q.text), ctx)}”${a ? ` — ${a}` : ""}`;
  },
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const style = pick(o.marks, ["serif", "bar", "none"] as const, "serif");
    let raw = items(o.quotes)
      .map((q) => ({ text: fill(str(q.text)).replace(/\s+/g, " "), author: fill(str(q.author)), source: fill(str(q.source)) }))
      .filter((q) => q.text)
      .slice(0, 8);
    const empty = !raw.length;
    if (empty) raw = [{ text: "Add a quote that captures how you like to work.", author: "", source: "" }];
    const rotating = o.rotate !== false && raw.length > 1 && t.motion === "full";
    if (!rotating) raw = raw.slice(0, 1);

    const lbl = fill(str(o.label));
    const tx = style === "serif" ? 112 : style === "bar" ? 68 : 48;
    const maxW = W - tx - 64;
    const { size, quotes } = layoutQuotes(t, raw, maxW);
    const lh = Math.round(size * 1.42);
    const authorGap = 38;
    const blockH = (q: Q) => (q.lines.length - 1) * lh + size * 0.78 + (q.author || q.source ? authorGap : 0);
    const areaH = Math.max(...quotes.map(blockH), size * 2.2);
    const top = lbl ? 62 : 40;
    const showProgress = rotating && o.progress !== false;
    const H = Math.round(top + areaH + (showProgress ? 50 : 40));

    const n = quotes.length;
    const slot = numOpt(o.seconds, 7, 3, 20);
    const total = slot * n;
    const fadePct = (0.7 / total) * 100;
    const f = 100 / n;
    const css = `
@keyframes qc{0%{opacity:0;transform:translateY(8px)}${n1(fadePct)}%{opacity:1;transform:none}${n1(f - fadePct)}%{opacity:1;transform:none}${n1(f)}%{opacity:0;transform:translateY(-6px)}100%{opacity:0}}
@keyframes qp{0%{transform:scaleX(0);opacity:1}${n1(f - fadePct / 2)}%{transform:scaleX(1);opacity:1}${n1(f)}%{transform:scaleX(1);opacity:0}100%{opacity:0}}
.q{animation:qc ${total}s linear infinite both}
.qp{transform-box:fill-box;transform-origin:left;animation:qp ${total}s linear infinite both}
.bar{transform-box:fill-box;transform-origin:top;animation:grow 1s cubic-bezier(.2,.7,.2,1) .1s both}
.mk{transform-box:fill-box;transform-origin:center;animation:pop .7s ease .05s both}
.mkg{animation:pulse 4s ease-in-out infinite}`;

    const blocks = quotes.map((q, i) => {
      const y0 = top;
      const first = y0 + size * 0.78;
      const lines = q.lines
        .map((l, k) => `<text x="${tx}" y="${n1(first + k * lh)}" font-size="${size}" class="${empty ? "m" : "t"} h">${esc(l)}</text>`)
        .join("");
      const ay = first + (q.lines.length - 1) * lh + authorGap;
      let author = "";
      if (q.author || q.source) {
        const a = fitText(t, q.author, 13, maxW - 40, { bold: true });
        const aw = q.author ? textWidth(t, a, 13, { bold: true }) : 0;
        const src = q.source ? fitText(t, q.source, 13, maxW - 40 - aw - 16) : "";
        author = `<rect x="${tx}" y="${n1(ay - 5)}" width="20" height="2" rx="1" fill="${t.accent}"/>
${q.author ? `<text x="${tx + 30}" y="${n1(ay)}" font-size="13" class="t b">${esc(a)}</text>` : ""}
${src ? `<text x="${n1(tx + 30 + (aw ? aw + 10 : 0))}" y="${n1(ay)}" font-size="13" class="m">${aw ? "· " : ""}${esc(src)}</text>` : ""}`;
      }
      const inner = `${lines}${author}`;
      if (!rotating) return `<g class="in" style="animation-delay:.2s">${inner}</g>`;
      return `<g class="q loop" style="animation-delay:${(i * slot).toFixed(2)}s"${i ? ` opacity="0"` : ""}>${inner}</g>`;
    });

    let deco = "";
    if (style === "serif") {
      const s = 1.15;
      deco = `<g class="mk">${quoteMarks(t.accent, 44, top + 2, s)}</g>`;
    } else if (style === "bar") {
      deco = `<rect class="bar" x="44" y="${top - 4}" width="3" height="${n1(areaH + 8)}" rx="1.5" fill="url(#qbarG)"/>`;
    }

    let progress = "";
    if (showProgress) {
      const tw = 22;
      const gap = 6;
      const px = W - 48 - n * tw - (n - 1) * gap;
      const py = H - 30;
      progress = quotes
        .map((_, i) => {
          const x = px + i * (tw + gap);
          return `<rect x="${x}" y="${py}" width="${tw}" height="3" rx="1.5" fill="${t.subtle}" opacity=".7"/><rect class="qp loop" style="animation-delay:${(i * slot).toFixed(2)}s" x="${x}" y="${py}" width="${tw}" height="3" rx="1.5" fill="${t.accent}"${i ? ` opacity="0"` : ""}/>`;
        })
        .join("");
      progress = `<g class="fade" style="animation-delay:.6s">${progress}</g>`;
    }

    const defs = `<linearGradient id="qbarG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${t.accent}" stop-opacity=".15"/></linearGradient>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${deco}
${blocks.join("\n")}
${progress}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
